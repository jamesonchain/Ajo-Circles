import assert from "node:assert/strict";
import test from "node:test";
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { IDL, accountMemcmp, decodeCircle, decodeMember } from "../src/index.js";

test("decodes a real devnet Circle account with the generated IDL name", { skip: !process.env.RUN_DEVNET_TESTS }, async () => {
  const endpoint = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
  const address = new PublicKey(
    process.env.DEVNET_TEST_CIRCLE ?? "CU8i9Yg43chjyRL6qHbFcmoBXvvpoWKnxSb1V747KVpH"
  );
  const info = await new Connection(endpoint, "confirmed").getAccountInfo(address, "confirmed");
  assert.ok(info, "the devnet Circle account should exist");
  assert.equal(info.owner.toBase58(), IDL.address);
  const account = decodeCircle(info.data);
  assert.ok(account.creator instanceof PublicKey);
  assert.ok(account.mint instanceof PublicKey);
  assert.ok(account.createdTs instanceof anchor.BN);
  assert.ok(account.roundStartTs instanceof anchor.BN);
  assert.ok(account.periodSecs instanceof anchor.BN);
  assert.equal(typeof account.maxMembers, "number");
  assert.equal(typeof account.memberCount, "number");

  const members = await new Connection(endpoint, "confirmed").getProgramAccounts(
    new PublicKey(IDL.address),
    { filters: [accountMemcmp("member"), { memcmp: { offset: 40, bytes: address.toBase58() } }] }
  );
  assert.ok(members.length > 0, "the devnet Circle should have a Member account");
  const member = decodeMember(members[0].account.data);
  assert.ok(member.wallet instanceof PublicKey);
  assert.ok(member.circle instanceof PublicKey);
  assert.ok(member.depositRemaining instanceof anchor.BN);
});
