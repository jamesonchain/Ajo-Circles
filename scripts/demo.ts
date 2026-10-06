import * as anchor from "@coral-xyz/anchor";
import {
  getAccount,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { AjoCirclesClient, IDL } from "ajo_circles_sdk";

const rpc = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
if (!rpc.includes("devnet")) throw new Error("The demo only runs on devnet");
const connection = new Connection(rpc, "confirmed");
const readKey = async (path: string) =>
  Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(path, "utf8")) as number[]));
const faucet = await readKey(".devnet/faucet.json");
const state = JSON.parse(await readFile(".devnet/smoke-state.json", "utf8")) as { mint: string };
const mint = new PublicKey(state.mint);
const faucetWallet = {
  publicKey: faucet.publicKey,
  signTransaction: async <T extends anchor.web3.Transaction>(tx: T) => {
    tx.partialSign(faucet);
    return tx;
  },
  signAllTransactions: async <T extends anchor.web3.Transaction[]>(txs: T) => {
    txs.forEach((tx) => tx.partialSign(faucet));
    return txs;
  },
} as anchor.Wallet;
const provider = new anchor.AnchorProvider(connection, faucetWallet, {
  commitment: "confirmed",
  preflightCommitment: "confirmed",
});
const client = new AjoCirclesClient(
  new anchor.Program(IDL as unknown as anchor.Idl, provider)
);
const config = await client.fetchConfig();
const contribution = 1_000_000;
const period = 60;
const members = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
const signatures: string[] = [];

async function send(label: string, signer: Keypair, instruction: anchor.web3.TransactionInstruction) {
  const signature = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [signer],
    { commitment: "confirmed" }
  );
  signatures.push(`${label}: ${signature}`);
  return signature;
}

async function fund(wallet: Keypair) {
  const sol = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: faucet.publicKey, toPubkey: wallet.publicKey, lamports: 200_000_000 })
  );
  signatures.push(`fund SOL ${wallet.publicKey.toBase58()}: ${await sendAndConfirmTransaction(connection, sol, [faucet], { commitment: "confirmed" })}`);
  const ata = await getOrCreateAssociatedTokenAccount(connection, faucet, mint, wallet.publicKey);
  signatures.push(`fund USDC ${wallet.publicKey.toBase58()}: ${await mintTo(connection, faucet, mint, ata.address, faucet, 10_000_000)}`);
}

for (const member of members) await fund(member);
const circleId = new anchor.BN(Date.now());
const circle = client.circle(members[0].publicKey, circleId);
const potVault = client.vault("pot", circle);
const depositVault = client.vault("deposit", circle);
await send("create", members[0], await client.createCircle(circleId, "Devnet full cycle", contribution, period, 3, {
  creator: members[0].publicKey, config: client.config, mint, circle, systemProgram: SystemProgram.programId,
}));
await send("initialize pot", members[0], await client.initializePotVault({ creator: members[0].publicKey, circle, mint, potVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }));
await send("initialize deposit", members[0], await client.initializeDepositVault({ creator: members[0].publicKey, circle, mint, depositVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }));
for (let slot = 0; slot < members.length; slot += 1) {
  const member = members[slot];
  await send(`join ${slot}`, member, await client.joinCircle(slot, {
    wallet: member.publicKey, config: client.config, circle, member: client.member(circle, member.publicKey),
    source: await getAssociatedTokenAddress(mint, member.publicKey), depositVault, mint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
  }));
}

async function contribute(member: Keypair) {
  await send(`contribute ${member.publicKey.toBase58()}`, member, await client.contribute({
    wallet: member.publicKey, config: client.config, circle, member: client.member(circle, member.publicKey),
    source: await getAssociatedTokenAddress(mint, member.publicKey), potVault, mint, tokenProgram: TOKEN_PROGRAM_ID,
  }));
}

async function claim(member: Keypair) {
  await send(`claim ${member.publicKey.toBase58()}`, member, await client.claimPayout({
    caller: member.publicKey, config: client.config, circle, recipientMember: client.member(circle, member.publicKey), recipientWallet: member.publicKey,
    potVault, depositVault, treasury: config.treasury, mint, recipientTokenAccount: await getAssociatedTokenAddress(mint, member.publicKey),
    tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
  }));
}

await Promise.all(members.map(contribute));
await claim(members[0]);
await Promise.all([contribute(members[0]), contribute(members[2])]);
await new Promise((resolve) => setTimeout(resolve, 61_000));
await send("cover missed payment", members[0], await client.settleDefault({ caller: members[0].publicKey, circle, member: client.member(circle, members[1].publicKey), depositVault, potVault, mint, tokenProgram: TOKEN_PROGRAM_ID }));
await claim(members[1]);
await Promise.all([contribute(members[0]), contribute(members[1]), contribute(members[2])]);
await claim(members[2]);

for (const member of [members[0], members[2]]) {
  await send(`claim forfeit ${member.publicKey.toBase58()}`, member, await client.claimForfeitShare({ caller: member.publicKey, circle, member: client.member(circle, member.publicKey), depositVault, destination: await getAssociatedTokenAddress(mint, member.publicKey), mint, tokenProgram: TOKEN_PROGRAM_ID }));
}
for (const member of members) {
  const destination = await getAssociatedTokenAddress(mint, member.publicKey);
  const account = await getAccount(connection, destination);
  const memberAccount = await client.fetchMember(client.member(circle, member.publicKey));
  if (memberAccount.depositRemaining > 0) {
    await send(`withdraw ${member.publicKey.toBase58()}`, member, await client.withdrawDeposit({ wallet: member.publicKey, circle, member: client.member(circle, member.publicKey), depositVault, destination, mint, tokenProgram: TOKEN_PROGRAM_ID }));
  }
  await send(`score ${member.publicKey.toBase58()}`, member, await client.finalizeScore({ caller: member.publicKey, circle, member: client.member(circle, member.publicKey), score: client.score(member.publicKey), systemProgram: SystemProgram.programId }));
  console.log(`Final balance ${member.publicKey.toBase58()}: ${(await getAccount(connection, destination)).amount.toString()} USDC, before ${account.amount.toString()} USDC`);
}
console.log(signatures.join("\n"));
console.log(`Circle: ${circle.toBase58()}`);
console.log(`Final status: ${(await client.fetchCircle(circle)).status}`);
