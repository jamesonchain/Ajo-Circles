import assert from "node:assert/strict";
import test from "node:test";
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { IDL } from "../src/index.js";

test("decodes a real devnet Circle account with the generated IDL name", { skip: !process.env.RUN_DEVNET_TESTS }, async () => {
  const endpoint = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
  const address = new PublicKey(
    process.env.DEVNET_TEST_CIRCLE ?? "CU8i9Yg43chjyRL6qHbFcmoBXvvpoWKnxSb1V747KVpH"
  );
  const info = await new Connection(endpoint, "confirmed").getAccountInfo(address, "confirmed");
  assert.ok(info, "the devnet Circle account should exist");
  assert.equal(info.owner.toBase58(), IDL.address);
  const account = new anchor.BorshAccountsCoder(IDL as never).decode("Circle", info.data);
  assert.ok(account.creator instanceof PublicKey);
  assert.ok(account.mint instanceof PublicKey);
});
