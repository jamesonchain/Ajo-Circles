import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { IDL } from "ajo_circles_sdk";

export const runtime = "nodejs";

const programId = new PublicKey(IDL.address);
const cacheTtlMs = 5_000;
type AccountRow = { address: string; data: string };
type CircleResponse = { circles: AccountRow[]; members: AccountRow[]; stale: boolean; reason?: string };
const cached = new Map<string, { expiresAt: number; value: CircleResponse }>();

function discriminator(name: string) {
  return anchor.utils.bytes.bs58.encode(new anchor.BorshAccountsCoder(IDL as never).accountDiscriminator(name));
}

async function load(rpc: string, wallet?: PublicKey): Promise<CircleResponse> {
  const connection = new Connection(rpc, "confirmed");
  const circleFilters = [
    { memcmp: { offset: 0, bytes: discriminator("Circle") } },
    ...(wallet ? [{ memcmp: { offset: 8, bytes: wallet.toBase58() } }] : []),
  ];
  const memberFilters = [
    { memcmp: { offset: 0, bytes: discriminator("Member") } },
    ...(wallet ? [{ memcmp: { offset: 8, bytes: wallet.toBase58() } }] : []),
  ];
  const [circles, members] = await Promise.all([
    connection.getProgramAccounts(programId, { filters: circleFilters }),
    connection.getProgramAccounts(programId, { filters: memberFilters }),
  ]);
  const circleRows = circles.map(({ pubkey, account }) => ({
      address: pubkey.toBase58(),
      data: account.data.toString("base64"),
    }));
  if (wallet && members.length) {
    const known = new Set(circleRows.map((row) => row.address));
    const missingAddresses = members
      .map(({ account }) => new PublicKey(account.data.subarray(40, 72)))
      .filter((address) => !known.has(address.toBase58()));
    const missing = await connection.getMultipleAccountsInfo(missingAddresses, "confirmed");
    missing.forEach((account, index) => {
      if (account) circleRows.push({
        address: missingAddresses[index].toBase58(),
        data: account.data.toString("base64"),
      });
    });
  }
  return {
    circles: circleRows,
    members: members.map(({ pubkey, account }) => ({
      address: pubkey.toBase58(),
      data: account.data.toString("base64"),
    })),
    stale: false,
  };
}

export async function GET(request: Request) {
  const walletText = new URL(request.url).searchParams.get("wallet") ?? undefined;
  let wallet: PublicKey | undefined;
  if (walletText) {
    try {
      wallet = new PublicKey(walletText);
    } catch {
      return Response.json({ error: "The wallet address is invalid." }, { status: 400 });
    }
  }
  const cacheKey = wallet?.toBase58() ?? "all";
  const fresh = cached.get(cacheKey);
  if (fresh && fresh.expiresAt > Date.now()) return Response.json(fresh.value);
  const primary = process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  const endpoints = [primary, "https://api.devnet.solana.com"].filter(
    (value, index, all): value is string => Boolean(value) && all.indexOf(value) === index
  );
  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      const value = await load(endpoint, wallet);
      cached.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs, value });
      return Response.json(value, { headers: { "Cache-Control": "private, max-age=5" } });
    } catch (error) {
      lastError = error;
    }
  }
  const stale = cached.get(cacheKey);
  if (stale) {
    return Response.json({ ...stale.value, stale: true, reason: reason(lastError) });
  }
  return Response.json({ error: `RPC rejected the request: ${reason(lastError)}` }, { status: 503 });
}

export async function POST() {
  cached.clear();
  return Response.json({ ok: true });
}

function reason(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error:\s*/i, "").split("\n")[0].slice(0, 180);
}
