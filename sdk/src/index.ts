import * as anchor from "@coral-xyz/anchor";
import type { AjoCircles } from "./idl/ajo_circles.js";
import { IDL } from "./idl/ajo_circles_idl.js";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";

export { IDL };
export type { AjoCircles };
export type AjoProgram = anchor.Program<AjoCircles>;
type CircleAccount = Awaited<ReturnType<AjoProgram["account"]["circle"]["fetch"]>>;
type ConfigAccount = Awaited<ReturnType<AjoProgram["account"]["config"]["fetch"]>>;
type MemberAccount = Awaited<ReturnType<AjoProgram["account"]["member"]["fetch"]>>;
type ScoreAccount = Awaited<ReturnType<AjoProgram["account"]["ajoScore"]["fetch"]>>;

export const SEEDS = {
  config: "config",
  circle: "circle",
  member: "member",
  pot: "pot",
  deposit: "deposit",
  score: "score",
} as const;

const accountCoder = new anchor.BorshAccountsCoder(IDL as never);
const normalizeAccountName = (name: string) => name.replace(/_/g, "").toLowerCase();

function camelize<T>(value: T): T {
  if (
    value === null ||
    typeof value !== "object" ||
    value instanceof anchor.BN ||
    value instanceof PublicKey ||
    value instanceof Uint8Array
  ) return value;
  if (Array.isArray(value)) return value.map(camelize) as T;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      camelize(child),
    ])
  ) as T;
}

function idlAccountName(logicalName: string) {
  const account = IDL.accounts?.find(
    ({ name }) => normalizeAccountName(name) === normalizeAccountName(logicalName)
  );
  if (!account) {
    const available = IDL.accounts?.map(({ name }) => name).join(", ") ?? "none";
    throw new Error(`IDL account ${logicalName} was not found. Available accounts: ${available}`);
  }
  return account.name;
}

export function accountDiscriminator(logicalName: string) {
  return accountCoder.accountDiscriminator(idlAccountName(logicalName));
}

export function accountMemcmp(logicalName: string) {
  return { memcmp: { offset: 0, bytes: anchor.utils.bytes.bs58.encode(accountDiscriminator(logicalName)) } };
}

export function decodeCircle(data: Buffer) {
  return camelize(accountCoder.decode(idlAccountName("circle"), data)) as CircleAccount;
}

export function decodeMember(data: Buffer) {
  return camelize(accountCoder.decode(idlAccountName("member"), data)) as MemberAccount;
}

export function decodeConfig(data: Buffer) {
  return camelize(accountCoder.decode(idlAccountName("config"), data)) as ConfigAccount;
}

export function decodeScore(data: Buffer) {
  return camelize(accountCoder.decode(idlAccountName("ajo_score"), data)) as ScoreAccount;
}

if (typeof console !== "undefined" && process.env.NODE_ENV !== "production") {
  console.debug("[Ajo Circles] loaded IDL account names", IDL.accounts?.map(({ name }) => name) ?? []);
}

export type IntegerLike = anchor.BN | bigint | number;
export type InstructionAccounts = Readonly<Record<string, PublicKey>>;

export type CircleMembership = {
  memberAddress: PublicKey;
  member: Awaited<ReturnType<AjoProgram["account"]["member"]["fetch"]>>;
  circleAddress: PublicKey;
  circle: Awaited<ReturnType<AjoProgram["account"]["circle"]["fetch"]>>;
};

export type WalletCircle =
  | CircleMembership
  | {
      memberAddress: null;
      member: null;
      circleAddress: PublicKey;
      circle: Awaited<ReturnType<AjoProgram["account"]["circle"]["fetch"]>>;
    };

export type CircleStatusName = "forming" | "active" | "completed" | "cancelled" | "unknown";

export function circleStatusName(status: object): CircleStatusName {
  const value = status as unknown;
  const raw = typeof value === "string"
    ? value
    : value && typeof value === "object"
      ? Object.keys(value)[0]
      : undefined;
  const key = raw?.replace(/_/g, "").toLowerCase();
  return key === "forming" || key === "active" || key === "completed" || key === "cancelled" ? key : "unknown";
}

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
  return circleStatusName((status ?? {}) as object) === "active";
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

  async fetchCircle(address: PublicKey): Promise<CircleAccount> {
    return camelize(await this.program.account.circle.fetch(address)) as CircleAccount;
  }

  async fetchConfig(address = this.config): Promise<ConfigAccount> {
    return camelize(await this.program.account.config.fetch(address)) as ConfigAccount;
  }

  async fetchMember(address: PublicKey): Promise<MemberAccount> {
    return camelize(await this.program.account.member.fetch(address)) as MemberAccount;
  }

  async fetchMemberForWallet(circle: PublicKey, wallet: PublicKey): Promise<MemberAccount | null> {
    const member = await this.program.account.member.fetchNullable(this.member(circle, wallet));
    return member ? camelize(member) as MemberAccount : null;
  }

  async fetchScore(wallet: PublicKey): Promise<ScoreAccount | null> {
    const score = await this.program.account.ajoScore.fetchNullable(this.score(wallet));
    return score ? camelize(score) : null;
  }

  async listMembers(circle: PublicKey) {
    const members = await this.program.account.member.all([
      { memcmp: { offset: 8 + 32, bytes: circle.toBase58() } },
    ]);
    return members.map(({ publicKey, account }) => ({ publicKey, account: camelize(account) as MemberAccount })).sort(
      (left, right) => left.account.slot - right.account.slot
    );
  }

  async listCirclesForWallet(wallet: PublicKey): Promise<WalletCircle[]> {
    const [memberships, createdCircles] = await Promise.all([
      this.program.account.member.all([
        { memcmp: { offset: 8, bytes: wallet.toBase58() } },
      ]),
      this.program.account.circle.all([
        { memcmp: { offset: 8, bytes: wallet.toBase58() } },
      ]),
    ]);
    const joined = await Promise.all(
      memberships.map(async ({ publicKey, account: rawAccount }) => {
        const account = camelize(rawAccount) as MemberAccount;
        return {
        memberAddress: publicKey,
        member: account,
        circleAddress: account.circle,
        circle: await this.fetchCircle(account.circle),
        };
      })
    );
    const joinedAddresses = new Set(joined.map(({ circleAddress }) => circleAddress.toBase58()));
    return [
      ...joined,
      ...createdCircles
        .filter(({ publicKey }) => !joinedAddresses.has(publicKey.toBase58()))
        .map(({ publicKey, account: rawAccount }) => ({
          memberAddress: null,
          member: null,
          circleAddress: publicKey,
          circle: camelize(rawAccount) as CircleAccount,
        })),
    ];
  }

  async nextPaymentsDue(wallet: PublicKey): Promise<PaymentDue[]> {
    const memberships = await this.listCirclesForWallet(wallet);
    return memberships
      .filter((membership): membership is CircleMembership => {
        const { circle, member } = membership;
        if (!member) return false;
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
    new anchor.Program<AjoCircles>(IDL as unknown as AjoCircles, provider)
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
