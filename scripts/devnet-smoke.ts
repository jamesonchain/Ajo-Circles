import * as anchor from "@coral-xyz/anchor";
import {
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { AjoCircles } from "../target/types/ajo_circles.js";

type SmokeState = {
  mint?: string;
  circleId?: string;
  memberSecretKeys?: number[][];
};

const stateDirectory = new URL("../.devnet/", import.meta.url);
const stateFile = new URL("../.devnet/smoke-state.json", import.meta.url);
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
if (!provider.connection.rpcEndpoint.includes("devnet")) {
  throw new Error("The smoke script only runs against a devnet RPC endpoint");
}
const payer = provider.wallet.payer!;
const idl = JSON.parse(
  await readFile(
    new URL("../target/idl/ajo_circles.json", import.meta.url),
    "utf8"
  )
) as AjoCircles;
const program = new anchor.Program<AjoCircles>(idl, provider);
const config = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  program.programId
)[0];
const mintDecimals = 6;
const contribution = 1_000_000;
const memberCount = 3;
const minimumWalletBalance = 50_000_000;
const requestedWalletFunding = 100_000_000;

async function readState(): Promise<SmokeState> {
  try {
    return JSON.parse(await readFile(stateFile, "utf8")) as SmokeState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function saveState(state: SmokeState) {
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(stateFile, 0o600);
}

function deriveCircle(creator: PublicKey, circleId: anchor.BN) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("circle"),
      creator.toBuffer(),
      circleId.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  )[0];
}

function deriveVault(seed: string, circle: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(seed), circle.toBuffer()],
    program.programId
  )[0];
}

function deriveMember(circle: PublicKey, wallet: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("member"), circle.toBuffer(), wallet.toBuffer()],
    program.programId
  )[0];
}

async function ensureWalletFunding(wallet: Keypair) {
  const balance = await provider.connection.getBalance(wallet.publicKey);
  if (balance >= minimumWalletBalance) return;
  const payerBalance = await provider.connection.getBalance(payer.publicKey);
  if (payerBalance < requestedWalletFunding + minimumWalletBalance) {
    throw new Error(
      "The configured deployer does not have enough SOL to fund the test wallet"
    );
  }
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: wallet.publicKey,
      lamports: requestedWalletFunding,
    })
  );
  const blockhash = await provider.connection.getLatestBlockhash("confirmed");
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = blockhash.blockhash;
  transaction.sign(payer);
  const signature = await provider.connection.sendRawTransaction(
    transaction.serialize()
  );
  await provider.connection.confirmTransaction(
    { signature, ...blockhash },
    "confirmed"
  );
  const fundedBalance = await provider.connection.getBalance(wallet.publicKey);
  if (fundedBalance < minimumWalletBalance) {
    throw new Error(
      `The devnet SOL transfer did not fund ${wallet.publicKey.toBase58()}`
    );
  }
}

let state = await readState();
await mkdir(stateDirectory, { recursive: true, mode: 0o700 });

if (!state.memberSecretKeys) {
  state.memberSecretKeys = Array.from({ length: memberCount }, () =>
    Array.from(Keypair.generate().secretKey)
  );
  await saveState(state);
}
const members = state.memberSecretKeys.map((secretKey) =>
  Keypair.fromSecretKey(Uint8Array.from(secretKey))
);

if (!state.mint) {
  state.mint = (
    await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      mintDecimals
    )
  ).toBase58();
  await saveState(state);
}
const mint = new PublicKey(state.mint);
const treasury = (
  await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    mint,
    payer.publicKey
  )
).address;

const configAccount = await provider.connection.getAccountInfo(config);
if (!configAccount) {
  await program.methods
    .initConfig(50, new anchor.BN(1))
    .accountsPartial({
      admin: payer.publicKey,
      config,
      mint,
      treasury,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
} else {
  const existingConfig = await program.account.config.fetch(config);
  if (!existingConfig.mint.equals(mint)) {
    throw new Error(
      `The existing devnet config uses ${existingConfig.mint.toBase58()}, not the saved test mint ${mint.toBase58()}`
    );
  }
}

for (const wallet of members) {
  await ensureWalletFunding(wallet);
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    mint,
    wallet.publicKey
  );
  const tokenBalance = (
    await getAccount(provider.connection, tokenAccount.address)
  ).amount;
  if (tokenBalance < BigInt(contribution * 4)) {
    await mintTo(
      provider.connection,
      payer,
      mint,
      tokenAccount.address,
      payer,
      BigInt(contribution * 4) - tokenBalance
    );
  }
}

if (!state.circleId) {
  state.circleId = Math.floor(Date.now() / 1000).toString();
  await saveState(state);
}
const circleId = new anchor.BN(state.circleId);
const circle = deriveCircle(payer.publicKey, circleId);
const potVault = deriveVault("pot", circle);
const depositVault = deriveVault("deposit", circle);
const existingCircle = await provider.connection.getAccountInfo(circle);

if (!existingCircle) {
  await program.methods
    .createCircle(
      circleId,
      "Devnet smoke circle",
      new anchor.BN(contribution),
      new anchor.BN(3600),
      memberCount
    )
    .accountsPartial({
      creator: payer.publicKey,
      config,
      mint,
      circle,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

if (!(await provider.connection.getAccountInfo(potVault))) {
  await program.methods
    .initializePotVault()
    .accountsPartial({
      creator: payer.publicKey,
      circle,
      mint,
      potVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

if (!(await provider.connection.getAccountInfo(depositVault))) {
  await program.methods
    .initializeDepositVault()
    .accountsPartial({
      creator: payer.publicKey,
      circle,
      mint,
      depositVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

for (let slot = 0; slot < members.length; slot += 1) {
  const wallet = members[slot];
  const member = deriveMember(circle, wallet.publicKey);
  if (await provider.connection.getAccountInfo(member)) continue;
  await program.methods
    .joinCircle(slot)
    .accountsPartial({
      wallet: wallet.publicKey,
      config,
      circle,
      member,
      source: getAssociatedTokenAddressSync(mint, wallet.publicKey),
      depositVault,
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([wallet])
    .rpc();
}

const finalCircle = await program.account.circle.fetch(circle);
if (finalCircle.memberCount !== memberCount) {
  throw new Error(
    `Expected ${memberCount} joined members, found ${finalCircle.memberCount}`
  );
}

console.log(`Program: ${program.programId.toBase58()}`);
console.log(`Test mint: ${mint.toBase58()}`);
console.log(`Circle: ${circle.toBase58()}`);
console.log(`Members joined: ${finalCircle.memberCount}`);
const recentTransactions = await provider.connection.getSignaturesForAddress(
  circle,
  { limit: 20 },
  "confirmed"
);
for (const transaction of recentTransactions) {
  console.log(`Transaction: ${transaction.signature}`);
}
console.log(`Circle creation and all join transactions succeeded on devnet.`);
