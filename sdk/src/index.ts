import * as anchor from "@coral-xyz/anchor";
import type { AjoCircles } from "./idl/ajo_circles.js";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const IDL = require("./idl/ajo_circles.json") as AjoCircles;

export { IDL };
export type { AjoCircles };

export const SEEDS = {
  config: "config",
  circle: "circle",
  member: "member",
  pot: "pot",
  deposit: "deposit",
  score: "score",
} as const;

export type AjoProgram = anchor.Program<AjoCircles>;
export type IntegerLike = anchor.BN | bigint | number;
export type InstructionAccounts = Readonly<Record<string, PublicKey>>;

export type CircleMembership = {
  memberAddress: PublicKey;
  member: Awaited<ReturnType<AjoProgram["account"]["member"]["fetch"]>>;
  circleAddress: PublicKey;
  circle: Awaited<ReturnType<AjoProgram["account"]["circle"]["fetch"]>>;
};

export type PaymentDue = CircleMembership & {
  deadline: bigint;
};

export function deriveConfig(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.config)],
    programId
  )[0];
}

export function deriveCircle(
  programId: PublicKey,
  creator: PublicKey,
  circleId: IntegerLike
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
  if (BigInt(contribution) <= 0n)
    throw new Error("Contribution must be positive");
  if (!Number.isInteger(maxMembers) || maxMembers < 3 || maxMembers > 12)
    throw new Error("Member count must be between 3 and 12");
  if (!Number.isInteger(slot) || slot < 0 || slot >= maxMembers)
    throw new Error("Slot is outside the circle");
  const multiplier = Math.max(1, maxMembers - 1 - slot);
  return BigInt(contribution) * BigInt(multiplier);
}

export function nextDeadline(
  roundStartTs: IntegerLike,
  periodSecs: IntegerLike
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

function toAnchorBn(value: IntegerLike): anchor.BN {
  return value instanceof anchor.BN ? value : new anchor.BN(value.toString());
}

function isActiveStatus(status: unknown): boolean {
  return (
    typeof status === "object" &&
    status !== null &&
    Object.prototype.hasOwnProperty.call(status, "active")
  );
}

export class AjoCirclesClient {
  constructor(
    readonly program: AjoProgram,
    readonly provider: anchor.Provider = program.provider
  ) {}

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

  private async buildInstruction(
    name: AjoCirclesClientInstruction,
    args: unknown[],
    accounts: InstructionAccounts
  ): Promise<TransactionInstruction> {
    const builder = (
      this.program.methods as unknown as Record<
        string,
        (...values: unknown[]) => any
      >
    )[name](...args);
    return builder.accountsPartial(accounts).instruction();
  }

  initConfig(
    feeBps: number,
    minPeriodSecs: IntegerLike,
    accounts: InstructionAccounts
  ) {
    return this.buildInstruction(
      "initConfig",
      [feeBps, toAnchorBn(minPeriodSecs)],
      accounts
    );
  }

  createCircle(
    circleId: IntegerLike,
    name: string,
    contribution: IntegerLike,
    periodSecs: IntegerLike,
    maxMembers: number,
    accounts: InstructionAccounts
  ) {
    return this.buildInstruction(
      "createCircle",
      [
        toAnchorBn(circleId),
        name,
        toAnchorBn(contribution),
        toAnchorBn(periodSecs),
        maxMembers,
      ],
      accounts
    );
  }

  initializePotVault(accounts: InstructionAccounts) {
    return this.buildInstruction("initializePotVault", [], accounts);
  }

  initializeDepositVault(accounts: InstructionAccounts) {
    return this.buildInstruction("initializeDepositVault", [], accounts);
  }

  joinCircle(slot: number, accounts: InstructionAccounts) {
    return this.buildInstruction("joinCircle", [slot], accounts);
  }

  contribute(accounts: InstructionAccounts) {
    return this.buildInstruction("contribute", [], accounts);
  }

  cancelCircle(accounts: InstructionAccounts) {
    return this.buildInstruction("cancelCircle", [], accounts);
  }

  refundDeposit(accounts: InstructionAccounts) {
    return this.buildInstruction("refundDeposit", [], accounts);
  }

  settleDefault(accounts: InstructionAccounts) {
    return this.buildInstruction("settleDefault", [], accounts);
  }

  claimPayout(accounts: InstructionAccounts) {
    return this.buildInstruction("claimPayout", [], accounts);
  }

  claimForfeitShare(accounts: InstructionAccounts) {
    return this.buildInstruction("claimForfeitShare", [], accounts);
  }

  withdrawDeposit(accounts: InstructionAccounts) {
    return this.buildInstruction("withdrawDeposit", [], accounts);
  }

  finalizeScore(accounts: InstructionAccounts) {
    return this.buildInstruction("finalizeScore", [], accounts);
  }

  async fetchCircle(address: PublicKey) {
    return this.program.account.circle.fetch(address);
  }

  async fetchConfig(address = this.config) {
    return this.program.account.config.fetch(address);
  }

  async fetchMember(address: PublicKey) {
    return this.program.account.member.fetch(address);
  }

  async fetchScore(wallet: PublicKey) {
    return this.program.account.ajoScore.fetchNullable(this.score(wallet));
  }

  async listMembers(circle: PublicKey) {
    const members = await this.program.account.member.all([
      { memcmp: { offset: 8 + 32, bytes: circle.toBase58() } },
    ]);
    return members.sort(
      (left, right) => left.account.slot - right.account.slot
    );
  }

  async listCirclesForWallet(wallet: PublicKey): Promise<CircleMembership[]> {
    const memberships = await this.program.account.member.all([
      { memcmp: { offset: 8, bytes: wallet.toBase58() } },
    ]);
    return Promise.all(
      memberships.map(async ({ publicKey, account }) => ({
        memberAddress: publicKey,
        member: account,
        circleAddress: account.circle,
        circle: await this.fetchCircle(account.circle),
      }))
    );
  }

  async nextPaymentsDue(wallet: PublicKey): Promise<PaymentDue[]> {
    const memberships = await this.listCirclesForWallet(wallet);
    return memberships
      .filter(({ circle, member }) => {
        if (!isActiveStatus(circle.status)) return false;
        const roundBit = 1 << circle.currentRound;
        return (member.paidBitmask & roundBit) === 0;
      })
      .map((membership) => ({
        ...membership,
        deadline: nextDeadline(
          membership.circle.roundStartTs,
          membership.circle.periodSecs
        ),
      }))
      .sort((left, right) =>
        left.deadline < right.deadline
          ? -1
          : left.deadline > right.deadline
          ? 1
          : 0
      );
  }

  async nextPaymentDue(wallet: PublicKey): Promise<PaymentDue | null> {
    return (await this.nextPaymentsDue(wallet))[0] ?? null;
  }

  async walletSummary(wallet: PublicKey) {
    const [circles, nextPayment, score] = await Promise.all([
      this.listCirclesForWallet(wallet),
      this.nextPaymentDue(wallet),
      this.fetchScore(wallet),
    ]);
    return { circles, nextPayment, score };
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

export function createAjoCirclesClient(
  provider: anchor.Provider
): AjoCirclesClient {
  return new AjoCirclesClient(
    new anchor.Program<AjoCircles>(IDL as AjoCircles, provider)
  );
}

export function createAjoCirclesClientFromEnv(): AjoCirclesClient {
  return createAjoCirclesClient(anchor.AnchorProvider.env());
}

export type AjoCirclesClientInstruction =
  | "initConfig"
  | "createCircle"
  | "initializePotVault"
  | "initializeDepositVault"
  | "joinCircle"
  | "contribute"
  | "cancelCircle"
  | "refundDeposit"
  | "settleDefault"
  | "claimPayout"
  | "claimForfeitShare"
  | "withdrawDeposit"
  | "finalizeScore";
