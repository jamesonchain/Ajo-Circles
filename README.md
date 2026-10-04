# Ajo Circles

Ajo Circles is a savings group app for rotating pots on Solana. Members contribute on a schedule, and the smart contract tracks deposits, turns, and default cover.

The project is under active construction. The Anchor program, SDK foundation, and a polished local demo frontend are included. See [STATUS.md](STATUS.md) for the current implementation state.

## SDK

Build the SDK with `pnpm build:sdk`. For a local consumer, install it from the SDK folder with `pnpm add file:/path/to/sdk`. Configure `ANCHOR_PROVIDER_URL` and `ANCHOR_WALLET`, then use this five line example to read a wallet's circles, next payment due, and Ajo Score. A wallet with no completed circle has no score account yet, so the score result is `null`.

```ts
import { createAjoCirclesClientFromEnv } from "ajo_circles_sdk";
const client = createAjoCirclesClientFromEnv();
const wallet = client.provider.wallet.publicKey;
const summary = await client.walletSummary(wallet);
console.log(summary.circles, summary.nextPayment, summary.score);
```

## Quick start

Install the root dependencies, then run the verified local contract flow.

```text
pnpm install
anchor build
anchor test
```

To run the web demo, use `pnpm install` and `pnpm dev` inside `app`. The local demo route is intentionally separate from live wallet and RPC state until the devnet deployment is recorded.

Local tests use `B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw`. The same program is deployed to devnet as verified below.

## Devnet verification

The Ajo Circles program is deployed to Solana devnet at `B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw`. On October 4, 2026, the devnet smoke script created a six decimal test mint, created a circle, initialized both vaults, joined three test wallets, and read the circle back with three members.

Test mint: `9qGJsamQ8irgapMSmEoR525GhD7DH4tFMsbtfUNHEvdb`.

Smoke circle: `CU8i9Yg43chjyRL6qHbFcmoBXvvpoWKnxSb1V747KVpH`.

Set `ANCHOR_PROVIDER_URL` to `https://api.devnet.solana.com` and `ANCHOR_WALLET` to a funded signer, then run `pnpm devnet:smoke` from the repository root. The script saves generated wallet keys and setup state in the ignored `.devnet` directory. It funds test wallets with transfers from the configured signer and checks that the RPC endpoint is devnet before sending transactions.
