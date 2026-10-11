import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  unpackAccount,
} from "@solana/spl-token";
import type { AccountInfo, Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

const mintOwners = new Map<string, PublicKey | null>();

export async function tokenAccountForMint(
  connection: Connection,
  wallet: PublicKey,
  mint: PublicKey,
) {
  const key = mint.toBase58();
  let tokenProgram = mintOwners.get(key);
  if (tokenProgram === undefined) {
    const mintInfo = await connection.getAccountInfo(mint, "confirmed");
    tokenProgram = mintInfo && (mintInfo.owner.equals(TOKEN_PROGRAM_ID) || mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID))
      ? mintInfo.owner
      : null;
    mintOwners.set(key, tokenProgram);
  }
  if (!tokenProgram) return { address: null, info: null, tokenProgram: null };
  const address = getAssociatedTokenAddressSync(mint, wallet, true, tokenProgram);
  const info = await connection.getAccountInfo(address, "confirmed");
  return { address, info, tokenProgram };
}

export async function readTokenBalance(
  connection: Connection,
  wallet: PublicKey,
  mint: PublicKey,
) {
  const token = await tokenAccountForMint(connection, wallet, mint);
  if (!token.address || !token.info || !token.tokenProgram) return 0n;
  try {
    return unpackAccount(token.address, token.info as AccountInfo<Buffer>, token.tokenProgram).amount;
  } catch {
    return 0n;
  }
}
