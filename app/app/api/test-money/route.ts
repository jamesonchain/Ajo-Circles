import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
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
    const body = (await request.json()) as { wallet?: string; wallets?: string[]; demo?: boolean };
    const walletTexts = body.wallets?.length ? body.wallets : body.wallet ? [body.wallet] : [];
    let wallets: PublicKey[];
    try {
      wallets = walletTexts.map((value) => new PublicKey(value));
    } catch {
      return Response.json({ error: "The connected wallet address is invalid." }, { status: 400 });
    }
    if (!wallets.length || wallets.length > 3) return Response.json({ error: "Choose a valid wallet to fund." }, { status: 400 });
    const now = Date.now();
    const limitMs = Number(process.env.TEST_MONEY_RATE_LIMIT_MS ?? 3_600_000);
    const previous = requests.get(wallets[0].toBase58()) ?? 0;
    if (!body.demo && now - previous < limitMs) {
      return Response.json({ error: "Test funds were already requested recently." }, { status: 429 });
    }

    const rpc = process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
    if (!rpc.includes("devnet")) return Response.json({ error: "Test money is only available on devnet." }, { status: 400 });
    if (!process.env.TEST_MINT_ADDRESS || !process.env.TEST_MONEY_AUTHORITY_SECRET_KEY) {
      return Response.json(
        { error: "Test money is not configured. Add TEST_MINT_ADDRESS and TEST_MONEY_AUTHORITY_SECRET_KEY to app/.env.local." },
        { status: 500 }
      );
    }
    const mint = new PublicKey(process.env.TEST_MINT_ADDRESS);
    const authority = keypairFromEnv("TEST_MONEY_AUTHORITY_SECRET_KEY");
    const connection = new Connection(rpc, "confirmed");
    const usdc = BigInt(process.env.TEST_MONEY_USDC_AMOUNT ?? "100000000");
    const sol = Number(process.env.TEST_MONEY_SOL_LAMPORTS ?? "10000000");
    async function fund(wallet: PublicKey) {
      const ata = await getAssociatedTokenAddress(mint, wallet);
      const transaction = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, ata, wallet, mint),
        createMintToInstruction(mint, ata, authority.publicKey, usdc),
        SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: wallet, lamports: sol })
      );
      const blockhash = await connection.getLatestBlockhash("confirmed");
      transaction.feePayer = authority.publicKey;
      transaction.recentBlockhash = blockhash.blockhash;
      transaction.sign(authority);
      const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false, maxRetries: 5 });
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const status = (await connection.getSignatureStatuses([signature])).value[0];
        if (status?.err) throw new Error(JSON.stringify(status.err));
        if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return signature;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      throw new Error("The funding transaction took too long to confirm.");
    }
    const signatures = await Promise.all(wallets.map(fund));
    requests.set(wallets[0].toBase58(), now);
    return Response.json({ signature: signatures[0], signatures, usdc: usdc.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const friendly = /insufficient funds|insufficient lamports/i.test(message)
      ? "The test money funder needs more devnet SOL."
      : /fetch|timeout|429|503/i.test(message)
      ? "Devnet is not responding right now. Try again shortly."
      : "Test money could not be sent. Check the server configuration.";
    return Response.json({ error: friendly }, { status: 400 });
  }
}
