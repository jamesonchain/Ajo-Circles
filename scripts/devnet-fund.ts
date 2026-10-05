import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
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

const walletText = process.argv[2];
if (!walletText) throw new Error("Usage: pnpm devnet:fund WALLET_ADDRESS");
const recipient = new PublicKey(walletText);
const rpc = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
if (!rpc.includes("devnet")) throw new Error("This command only runs against devnet");
const keypairPath = process.env.ANCHOR_WALLET ?? `${process.env.HOME}/.config/solana/id.json`;
const authority = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(await readFile(keypairPath, "utf8")) as number[])
);
const state = JSON.parse(await readFile(".devnet/smoke-state.json", "utf8")) as { mint?: string };
const mintText = process.env.TEST_MINT_ADDRESS ?? state.mint;
if (!mintText) throw new Error("Set TEST_MINT_ADDRESS or run the devnet smoke setup first");
const connection = new Connection(rpc, "confirmed");
const mint = new PublicKey(mintText);
const tokenAccount = await getOrCreateAssociatedTokenAccount(
  connection,
  authority,
  mint,
  recipient
);
const usdc = BigInt(process.env.TEST_MONEY_USDC_AMOUNT ?? "100000000");
const sol = Number(process.env.TEST_MONEY_SOL_LAMPORTS ?? "10000000");
const usdcSignature = await mintTo(
  connection,
  authority,
  mint,
  tokenAccount.address,
  authority,
  usdc
);
const solSignature = await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: authority.publicKey,
      toPubkey: recipient,
      lamports: sol,
    })
  ),
  [authority],
  { commitment: "confirmed" }
);
console.log(`Funded ${recipient.toBase58()} with ${Number(usdc) / 1_000_000} test USDC and ${sol / 1_000_000_000} SOL.`);
console.log(`USDC transaction: ${usdcSignature}`);
console.log(`SOL transaction: ${solSignature}`);
