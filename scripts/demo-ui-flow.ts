import * as anchor from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { AjoCirclesClient, IDL } from "ajo_circles_sdk";

const rpc = process.env.ANCHOR_PROVIDER_URL ?? process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
if (!rpc.includes("devnet")) throw new Error("The demo UI flow only runs on devnet");
const connection = new Connection(rpc, "confirmed");
const faucet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(".devnet/faucet.json", "utf8")) as number[]));
const { mint: mintText } = JSON.parse(await readFile(".devnet/smoke-state.json", "utf8")) as { mint: string };
const mint = new PublicKey(mintText);
const wallet = { publicKey: faucet.publicKey, signTransaction: async <T extends Transaction>(tx: T) => { tx.partialSign(faucet); return tx; }, signAllTransactions: async <T extends Transaction[]>(txs: T) => { txs.forEach((tx) => tx.partialSign(faucet)); return txs; } } as anchor.Wallet;
const provider = new anchor.AnchorProvider(connection as unknown as anchor.web3.Connection, wallet, { commitment: "confirmed", preflightCommitment: "confirmed" });
const client = new AjoCirclesClient(new anchor.Program(IDL as unknown as anchor.Idl, provider));
const wallets = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
const signatures: string[] = [];

async function confirm(signature: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = (await connection.getSignatureStatuses([signature])).value[0];
    if (status?.err) throw new Error(JSON.stringify(status.err));
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Transaction confirmation timed out");
}

async function send(label: string, signer: Keypair, instructions: anchor.web3.TransactionInstruction[]) {
  const transaction = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ...instructions);
  const blockhash = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = signer.publicKey;
  transaction.recentBlockhash = blockhash.blockhash;
  transaction.sign(signer);
  const simulation = await connection.simulateTransaction(transaction);
  if (simulation.value.err) throw new Error(`${label} simulation failed: ${simulation.value.logs?.join(" | ") ?? simulation.value.err}`);
  const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false, maxRetries: 5 });
  await confirm(signature);
  signatures.push(`${label}: ${signature}`);
  return signature;
}

async function fund(recipient: Keypair) {
  const ata = await getAssociatedTokenAddress(mint, recipient.publicKey);
  await send(`fund ${recipient.publicKey.toBase58()}`, faucet, [
    SystemProgram.transfer({ fromPubkey: faucet.publicKey, toPubkey: recipient.publicKey, lamports: 40_000_000 }),
    createAssociatedTokenAccountIdempotentInstruction(faucet.publicKey, ata, recipient.publicKey, mint),
    createMintToInstruction(mint, ata, faucet.publicKey, 100_000_000),
  ]);
}

function pass(label: string, value: boolean) {
  console.log(`${value ? "PASS" : "FAIL"}: ${label}`);
  if (!value) throw new Error(label);
}

await Promise.all(wallets.map(fund));
const config = await client.fetchConfig();
const circleId = new anchor.BN(Date.now());
const circle = client.circle(wallets[0].publicKey, circleId);
const potVault = client.vault("pot", circle);
const depositVault = client.vault("deposit", circle);
const contribution = 10_000_000;
const creatorSource = await getAssociatedTokenAddress(mint, wallets[0].publicKey);
await send("create circle and join creator", wallets[0], [
  await client.createCircle(circleId, "Phantom ready demo", contribution, 60, 3, { creator: wallets[0].publicKey, config: client.config, mint, circle, systemProgram: SystemProgram.programId }),
  await client.initializePotVault({ creator: wallets[0].publicKey, circle, mint, potVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }),
  await client.initializeDepositVault({ creator: wallets[0].publicKey, circle, mint, depositVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }),
  createAssociatedTokenAccountIdempotentInstruction(wallets[0].publicKey, creatorSource, wallets[0].publicKey, mint),
  await client.joinCircle(0, { wallet: wallets[0].publicKey, config: client.config, circle, member: client.member(circle, wallets[0].publicKey), source: creatorSource, depositVault, mint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }),
]);
pass("creator shows 1 / 3", (await client.fetchCircle(circle)).memberCount === 1);
const secondSource = await getAssociatedTokenAddress(mint, wallets[1].publicKey);
const beforeSecond = (await getAccount(connection as unknown as Parameters<typeof getAccount>[0], secondSource)).amount;
await send("join wallet two by link", wallets[1], [
  createAssociatedTokenAccountIdempotentInstruction(wallets[1].publicKey, secondSource, wallets[1].publicKey, mint),
  await client.joinCircle(1, { wallet: wallets[1].publicKey, config: client.config, circle, member: client.member(circle, wallets[1].publicKey), source: secondSource, depositVault, mint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }),
]);
const afterSecond = (await getAccount(connection as unknown as Parameters<typeof getAccount>[0], secondSource)).amount;
pass("wallet two joins and its USDC drops", (await client.fetchCircle(circle)).memberCount === 2 && afterSecond < beforeSecond);
const thirdSource = await getAssociatedTokenAddress(mint, wallets[2].publicKey);
await send("join wallet three by link", wallets[2], [
  createAssociatedTokenAccountIdempotentInstruction(wallets[2].publicKey, thirdSource, wallets[2].publicKey, mint),
  await client.joinCircle(2, { wallet: wallets[2].publicKey, config: client.config, circle, member: client.member(circle, wallets[2].publicKey), source: thirdSource, depositVault, mint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }),
]);
pass("wallet three joins and circle is full", (await client.fetchCircle(circle)).memberCount === 3);
await send("wallet one pays", wallets[0], [await client.contribute({ wallet: wallets[0].publicKey, config: client.config, circle, member: client.member(circle, wallets[0].publicKey), source: creatorSource, potVault, mint, tokenProgram: TOKEN_PROGRAM_ID })]);
await send("wallet three pays", wallets[2], [await client.contribute({ wallet: wallets[2].publicKey, config: client.config, circle, member: client.member(circle, wallets[2].publicKey), source: thirdSource, potVault, mint, tokenProgram: TOKEN_PROGRAM_ID })]);
await new Promise((resolve) => setTimeout(resolve, 61_000));
await send("cover wallet two default", wallets[0], [await client.settleDefault({ caller: wallets[0].publicKey, circle, member: client.member(circle, wallets[1].publicKey), depositVault, potVault, mint, tokenProgram: TOKEN_PROGRAM_ID })]);
pass("covered default settles", (await client.fetchMemberForWallet(circle, wallets[1].publicKey))?.defaults === 1);
console.log(`Circle: ${circle.toBase58()}`);
console.log(signatures.join("\n"));
