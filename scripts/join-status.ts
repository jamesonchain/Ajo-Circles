import * as anchor from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { AjoCirclesClient, IDL } from "ajo_circles_sdk";

const rpc = process.env.ANCHOR_PROVIDER_URL ?? process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
if (!rpc.includes("devnet")) throw new Error("The join status script only runs on devnet");
const connection = new Connection(rpc, "confirmed");
const faucet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(".devnet/faucet.json", "utf8")) as number[]));
const state = JSON.parse(await readFile(".devnet/smoke-state.json", "utf8")) as { mint: string };
const mint = new PublicKey(state.mint);
const wallet = { publicKey: faucet.publicKey, signTransaction: async <T extends anchor.web3.Transaction>(tx: T) => { tx.partialSign(faucet); return tx; }, signAllTransactions: async <T extends anchor.web3.Transaction[]>(txs: T) => { txs.forEach((tx) => tx.partialSign(faucet)); return txs; } } as anchor.Wallet;
const provider = new anchor.AnchorProvider(connection as unknown as anchor.web3.Connection, wallet, { commitment: "confirmed", preflightCommitment: "confirmed" });
const client = new AjoCirclesClient(new anchor.Program(IDL as unknown as anchor.Idl, provider));
const members = [Keypair.generate(), Keypair.generate(), Keypair.generate()];

async function fund(member: Keypair) {
  const transfer = new Transaction().add(SystemProgram.transfer({ fromPubkey: faucet.publicKey, toPubkey: member.publicKey, lamports: 40_000_000 }));
  const blockhash = await connection.getLatestBlockhash("confirmed");
  transfer.feePayer = faucet.publicKey;
  transfer.recentBlockhash = blockhash.blockhash;
  transfer.sign(faucet);
  const signature = await connection.sendRawTransaction(transfer.serialize(), { skipPreflight: false, maxRetries: 5 });
  await confirm(signature);
  const ata = await getAssociatedTokenAddress(mint, member.publicKey);
  const tokenTx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(faucet.publicKey, ata, member.publicKey, mint),
    createMintToInstruction(mint, ata, faucet.publicKey, 10_000_000)
  );
  const tokenBlockhash = await connection.getLatestBlockhash("confirmed");
  tokenTx.feePayer = faucet.publicKey;
  tokenTx.recentBlockhash = tokenBlockhash.blockhash;
  tokenTx.sign(faucet);
  const tokenSignature = await connection.sendRawTransaction(tokenTx.serialize(), { skipPreflight: false, maxRetries: 5 });
  await confirm(tokenSignature);
}

async function confirm(signature: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = (await connection.getSignatureStatuses([signature])).value[0];
    if (status?.err) throw new Error(JSON.stringify(status.err));
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Transaction confirmation timed out");
}

async function send(member: Keypair, instructions: anchor.web3.TransactionInstruction[]) {
  const transaction = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ...instructions);
  const blockhash = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = member.publicKey;
  transaction.recentBlockhash = blockhash.blockhash;
  transaction.sign(member);
  const simulation = await connection.simulateTransaction(transaction);
  if (simulation.value.err) throw new Error(`Join simulation failed: ${simulation.value.logs?.join(" | ") ?? simulation.value.err}`);
  const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false, maxRetries: 5 });
  await confirm(signature);
  return signature;
}

await Promise.all(members.map(fund));
const config = await client.fetchConfig();
const circleId = new anchor.BN(Date.now());
const circle = client.circle(members[0].publicKey, circleId);
const depositVault = client.vault("deposit", circle);
const potVault = client.vault("pot", circle);
await send(members[0], [await client.createCircle(circleId, "Join status check", 1_000_000, 3600, 3, { creator: members[0].publicKey, config: client.config, mint, circle, systemProgram: SystemProgram.programId })]);
await send(members[0], [await client.initializePotVault({ creator: members[0].publicKey, circle, mint, potVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }), await client.initializeDepositVault({ creator: members[0].publicKey, circle, mint, depositVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })]);
for (const [slot, member] of members.entries()) {
  const source = await getAssociatedTokenAddress(mint, member.publicKey);
  const signature = await send(member, [
    createAssociatedTokenAccountIdempotentInstruction(member.publicKey, source, member.publicKey, mint),
    await client.joinCircle(slot, { wallet: member.publicKey, config: client.config, circle, member: client.member(circle, member.publicKey), source, depositVault, mint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }),
  ]);
  const status = await client.fetchMemberForWallet(circle, member.publicKey);
  if (!status || status.slot !== slot) throw new Error(`Member status mismatch for turn ${slot + 1}`);
  console.log(`Join turn ${slot + 1}: ${signature}`);
}
console.log(`Join status check passed for ${circle.toBase58()}`);
console.log(`Config mint: ${config.mint.toBase58()}`);
