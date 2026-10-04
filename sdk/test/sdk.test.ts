import assert from "node:assert/strict";
import test from "node:test";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  IDL,
  createAjoCirclesClient,
  calculateDeposit,
  deriveCircle,
  deriveConfig,
  deriveMember,
  deriveScore,
  deriveVault,
  nextDeadline,
} from "../src/index.js";

const programId = new PublicKey("B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw");
const creator = new PublicKey(new Uint8Array(32).fill(1));
const wallet = new PublicKey(new Uint8Array(32).fill(2));
const circle = new PublicKey(new Uint8Array(32).fill(3));

test("calculates deposits at supported member and slot boundaries", () => {
  assert.equal(calculateDeposit(10_000_000n, 3, 0), 20_000_000n);
  assert.equal(calculateDeposit(10_000_000n, 3, 2), 10_000_000n);
  assert.equal(calculateDeposit(1n, 12, 10), 1n);
  assert.equal(calculateDeposit(1n, 12, 11), 1n);
  assert.throws(() => calculateDeposit(1n, 2, 0), /Member count/);
  assert.throws(() => calculateDeposit(1n, 3, 3), /Slot/);
  assert.throws(() => calculateDeposit(0n, 3, 0), /positive/);
});

test("derives every account address with the program seed scheme", () => {
  const expectedConfig = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  )[0];
  const encodedCircleId = Buffer.alloc(8);
  encodedCircleId.writeBigUInt64LE(42n);
  const expectedCircle = PublicKey.findProgramAddressSync(
    [Buffer.from("circle"), creator.toBuffer(), encodedCircleId],
    programId
  )[0];
  const expectedMember = PublicKey.findProgramAddressSync(
    [Buffer.from("member"), circle.toBuffer(), wallet.toBuffer()],
    programId
  )[0];
  const expectedPot = PublicKey.findProgramAddressSync(
    [Buffer.from("pot"), circle.toBuffer()],
    programId
  )[0];
  const expectedDeposit = PublicKey.findProgramAddressSync(
    [Buffer.from("deposit"), circle.toBuffer()],
    programId
  )[0];
  const expectedScore = PublicKey.findProgramAddressSync(
    [Buffer.from("score"), wallet.toBuffer()],
    programId
  )[0];

  assert.ok(deriveConfig(programId).equals(expectedConfig));
  assert.ok(deriveCircle(programId, creator, 42).equals(expectedCircle));
  assert.ok(deriveCircle(programId, creator, 42n).equals(expectedCircle));
  assert.ok(
    deriveCircle(programId, creator, new anchor.BN(42)).equals(expectedCircle)
  );
  assert.ok(deriveMember(programId, circle, wallet).equals(expectedMember));
  assert.ok(deriveVault(programId, "pot", circle).equals(expectedPot));
  assert.ok(deriveVault(programId, "deposit", circle).equals(expectedDeposit));
  assert.ok(deriveScore(programId, wallet).equals(expectedScore));
});

test("calculates deadlines from numbers, bigints, and Anchor values", () => {
  assert.equal(nextDeadline(100, 60), 160n);
  assert.equal(nextDeadline(100n, 60n), 160n);
  assert.equal(nextDeadline(new anchor.BN(100), new anchor.BN(60)), 160n);
});

test("publishes an IDL whose address matches the SDK program ID", () => {
  assert.equal(IDL.address, programId.toBase58());
  assert.equal(IDL.instructions.length, 13);
});

test("builds an instruction for every published program instruction", async () => {
  const client = createAjoCirclesClient({} as anchor.Provider);
  const accounts = Object.fromEntries(
    IDL.instructions.flatMap((instruction) =>
      instruction.accounts.map((account) => [
        account.name.replace(/_([a-z])/g, (_, letter: string) =>
          letter.toUpperCase()
        ),
        programId,
      ])
    )
  );
  const instructions = await Promise.all([
    client.initConfig(50, 1, accounts),
    client.createCircle(1, "SDK test", 10, 60, 3, accounts),
    client.initializePotVault(accounts),
    client.initializeDepositVault(accounts),
    client.joinCircle(0, accounts),
    client.contribute(accounts),
    client.cancelCircle(accounts),
    client.refundDeposit(accounts),
    client.settleDefault(accounts),
    client.claimPayout(accounts),
    client.claimForfeitShare(accounts),
    client.withdrawDeposit(accounts),
    client.finalizeScore(accounts),
  ]);

  assert.equal(instructions.length, IDL.instructions.length);
  for (const instruction of instructions) {
    assert.ok(instruction.programId.equals(programId));
    assert.ok(instruction.data.length >= 8);
  }
});
