import * as anchor from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { AjoCirclesClient, IDL } from "ajo_circles_sdk";

const rpc = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
const connection = new Connection(rpc, "confirmed");
const state = JSON.parse(await readFile(".devnet/smoke-state.json", "utf8")) as { mint: string; memberSecretKeys: number[][] };
const mint = new PublicKey(state.mint);
const wallets = state.memberSecretKeys.slice(0, 3).map((secret) => Keypair.fromSecretKey(Uint8Array.from(secret)));
const faucet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(".devnet/faucet.json", "utf8")) as number[]));
const signer = { publicKey: faucet.publicKey, signTransaction: async <T extends Transaction>(tx: T) => { tx.partialSign(faucet); return tx; }, signAllTransactions: async <T extends Transaction[]>(txs: T) => { txs.forEach((tx) => tx.partialSign(faucet)); return txs; } } as anchor.Wallet;
const provider = new anchor.AnchorProvider(connection as unknown as anchor.web3.Connection, signer, { commitment: "confirmed", preflightCommitment: "confirmed" });
const client = new AjoCirclesClient(new anchor.Program(IDL as unknown as anchor.Idl, provider));

async function confirm(signature: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = (await connection.getSignatureStatuses([signature])).value[0];
    if (status?.err) throw new Error(JSON.stringify(status.err));
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Transaction confirmation timed out");
}

async function send(signerKey: Keypair, instructions: anchor.web3.TransactionInstruction[]) {
  const transaction = new Transaction().add(...instructions);
  const blockhash = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = signerKey.publicKey;
  transaction.recentBlockhash = blockhash.blockhash;
  transaction.sign(signerKey);
  const simulation = await connection.simulateTransaction(transaction);
  if (simulation.value.err) throw new Error(simulation.value.logs?.join(" | ") ?? JSON.stringify(simulation.value.err));
  const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false, maxRetries: 5 });
  await confirm(signature);
  return signature;
}

function pass(label: string, value: boolean) {
  console.log(`${value ? "PASS" : "FAIL"}: ${label}`);
  if (!value) throw new Error(label);
}

const config = await client.fetchConfig();
const circleId = new anchor.BN(Date.now());
const circle = client.circle(wallets[0].publicKey, circleId);
const potVault = client.vault("pot", circle);
const depositVault = client.vault("deposit", circle);
await send(wallets[0], [await client.createCircle(circleId, "Invite target check", 1_000_000, 3600, 3, { creator: wallets[0].publicKey, config: client.config, mint, circle, systemProgram: SystemProgram.programId })]);
await send(wallets[0], [
  await client.initializePotVault({ creator: wallets[0].publicKey, circle, mint, potVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }),
  await client.initializeDepositVault({ creator: wallets[0].publicKey, circle, mint, depositVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }),
]);
pass("invite circle is fetched by its address", (await client.fetchCircle(circle)).name === "Invite target check");
for (const [slot, member] of wallets.entries()) {
  const memberAddress = client.member(circle, member.publicKey);
  pass(`member PDA is scoped to invite circle for wallet ${slot + 1}`, (await client.fetchMemberForWallet(circle, member.publicKey)) === null);
  const source = await getAssociatedTokenAddress(mint, member.publicKey);
  await send(member, [await client.joinCircle(slot, { wallet: member.publicKey, config: client.config, circle, member: memberAddress, source, depositVault, mint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })]);
  const joined = await client.fetchMember(memberAddress);
  pass(`invite join turn ${slot + 1} stores the target circle`, joined.circle.equals(circle) && joined.wallet.equals(member.publicKey) && joined.slot === slot);
}
console.log(`Invite join check passed for ${circle.toBase58()}`);
