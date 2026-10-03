import * as anchor from "@coral-xyz/anchor";
import { AjoCircles } from "../../target/types/ajo_circles.js";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";

export const SEEDS = {
  config: "config",
  circle: "circle",
  member: "member",
  pot: "pot",
  deposit: "deposit",
  score: "score",
} as const;

export type AjoProgram = anchor.Program<AjoCircles>;

export function deriveConfig(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.config)],
    programId
  )[0];
}

export function deriveCircle(
  programId: PublicKey,
  creator: PublicKey,
  circleId: anchor.BN | bigint | number
): PublicKey {
  const id = (
    circleId instanceof anchor.BN
      ? circleId
      : new anchor.BN(circleId.toString())
  ).toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.circle), creator.toBuffer(), id],
    programId
  )[0];
}

export function deriveMember(
  programId: PublicKey,
  circle: PublicKey,
  wallet: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.member), circle.toBuffer(), wallet.toBuffer()],
    programId
  )[0];
}

export function deriveVault(
  programId: PublicKey,
  kind: "pot" | "deposit",
  circle: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS[kind]), circle.toBuffer()],
    programId
  )[0];
}

export function deriveScore(
  programId: PublicKey,
  wallet: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.score), wallet.toBuffer()],
    programId
  )[0];
}

export function calculateDeposit(
  contribution: bigint | number,
  maxMembers: number,
  slot: number
): bigint {
  if (!Number.isInteger(maxMembers) || maxMembers < 3 || maxMembers > 12)
    throw new Error("Member count must be between 3 and 12");
  if (!Number.isInteger(slot) || slot < 0 || slot >= maxMembers)
    throw new Error("Slot is outside the circle");
  const multiplier = Math.max(1, maxMembers - 1 - slot);
  return BigInt(contribution) * BigInt(multiplier);
}

export function nextDeadline(
  roundStartTs: anchor.BN | bigint | number,
  periodSecs: anchor.BN | bigint | number
): bigint {
  const start =
    roundStartTs instanceof anchor.BN
      ? BigInt(roundStartTs.toString())
      : BigInt(roundStartTs);
  const period =
    periodSecs instanceof anchor.BN
      ? BigInt(periodSecs.toString())
      : BigInt(periodSecs);
  return start + period;
}

export class AjoCirclesClient {
  constructor(readonly program: AjoProgram) {}

  get programId() {
    return this.program.programId;
  }
  get config() {
    return deriveConfig(this.programId);
  }
  circle(creator: PublicKey, circleId: anchor.BN | bigint | number) {
    return deriveCircle(this.programId, creator, circleId);
  }
  member(circle: PublicKey, wallet: PublicKey) {
    return deriveMember(this.programId, circle, wallet);
  }
  score(wallet: PublicKey) {
    return deriveScore(this.programId, wallet);
  }
  vault(kind: "pot" | "deposit", circle: PublicKey) {
    return deriveVault(this.programId, kind, circle);
  }

  async instruction(
    name: keyof AjoCirclesClientInstructions,
    args: unknown[],
    accounts: Record<string, PublicKey>
  ): Promise<TransactionInstruction> {
    const builder = (
      this.program.methods as unknown as Record<
        string,
        (...values: unknown[]) => any
      >
    )[name](...args);
    return builder.accountsPartial(accounts).instruction();
  }

  async fetchCircle(address: PublicKey) {
    return this.program.account.circle.fetch(address);
  }
  async fetchMember(address: PublicKey) {
    return this.program.account.member.fetch(address);
  }
  async fetchScore(wallet: PublicKey) {
    return this.program.account.ajoScore.fetch(this.score(wallet));
  }
  async listMembers(circle: PublicKey) {
    return this.program.account.member.all([
      { memcmp: { offset: 8 + 32, bytes: circle.toBase58() } },
    ]);
  }
  decodeEvents(logs: string[]) {
    return [
      ...new anchor.EventParser(
        this.program.programId,
        this.program.coder
      ).parseLogs(logs),
    ];
  }
}

export type AjoCirclesClientInstructions = {
  initConfig: unknown;
  createCircle: unknown;
  initializePotVault: unknown;
  initializeDepositVault: unknown;
  joinCircle: unknown;
  contribute: unknown;
  cancelCircle: unknown;
  refundDeposit: unknown;
  settleDefault: unknown;
  claimPayout: unknown;
  claimForfeitShare: unknown;
  withdrawDeposit: unknown;
  finalizeScore: unknown;
};
