import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

export const runtime = "nodejs";

const requests = new Map<string, number>();

function keypairFromEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(value) as number[]));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { wallet?: string };
    const wallet = new PublicKey(body.wallet ?? "");
    const now = Date.now();
    const limitMs = Number(process.env.TEST_MONEY_RATE_LIMIT_MS ?? 3_600_000);
    const previous = requests.get(wallet.toBase58()) ?? 0;
    if (now - previous < limitMs) {
      return Response.json({ error: "Test funds were already requested recently." }, { status: 429 });
    }

    const rpc = process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
    if (!rpc.includes("devnet")) return Response.json({ error: "Test money is only available on devnet." }, { status: 400 });
    const mint = new PublicKey(process.env.TEST_MINT_ADDRESS ?? "");
    const authority = keypairFromEnv("TEST_MONEY_AUTHORITY_SECRET_KEY");
    const connection = new Connection(rpc, "confirmed");
    const ata = await getOrCreateAssociatedTokenAccount(connection, authority, mint, wallet);
    const usdc = BigInt(process.env.TEST_MONEY_USDC_AMOUNT ?? "100000000");
    const sol = Number(process.env.TEST_MONEY_SOL_LAMPORTS ?? "10000000");
    const signature = await mintTo(connection, authority, mint, ata.address, authority, usdc);
    const solSignature = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: wallet, lamports: sol })),
      [authority],
      { commitment: "confirmed" }
    );
    requests.set(wallet.toBase58(), now);
    return Response.json({ signature, solSignature, usdc: usdc.toString() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Test funds could not be sent." }, { status: 400 });
  }
}
