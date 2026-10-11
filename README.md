# Ajo Circles

Ajo Circles is a savings group app for rotating pots on Solana. Members contribute on a schedule, and the smart contract tracks deposits, turns, and default cover.

The project is under active construction. The Anchor program, SDK foundation, and a polished local demo frontend are included. See [STATUS.md](STATUS.md) for the current implementation state.

## How to test

Live app: [ajo-circles-blond.vercel.app](https://ajo-circles-blond.vercel.app) on Solana devnet.

### Wallet setup

Install Phantom. In Phantom, open Settings, then Developer Settings, and turn on Testnet Mode. Each Phantom account must approve this site separately.

### Get test money

Connect Phantom and click Get test money. The button sends devnet SOL and test USDC from mint `9qGJsamQ8irgapMSmEoR525GhD7DH4tFMsbtfUNHEvdb`. It is rate limited.

### Walkthrough

1. Create a circle and choose Demo: every 60 seconds.
2. Copy the invite link.
3. Switch to a second approved Phantom account and open the link.
4. Join the circle. The protected deposit locks.
5. Pay the round contribution.
6. If a member does not pay, wait for the round to end, click Settle default, and verify the deposit cover.
7. The turn holder clicks Claim payout.
8. Finalize the score and verify that the Ajo Score updates.

The app also has a Demo wallets toggle. It switches to the saved demo wallets for local devnet testing without Phantom signing.

### Run locally

Prerequisites are Node.js, pnpm, Rust, the Solana CLI, and Anchor 0.31.1.

From the repository root:

```sh
cp .env.example .env
cp .env.example app/.env.local
pnpm install
pnpm build:sdk
anchor build
anchor test
```

The current test file has 22 integration cases in `tests/ajo_circles.ts`; `anchor test` also runs the SDK tests. Do not commit `.env`, `app/.env.local`, or secret key values.

The environment files contain these variables:

```text
NEXT_PUBLIC_SOLANA_RPC_URL
SOLANA_RPC_URL
TEST_MINT_ADDRESS
NEXT_PUBLIC_TEST_MINT_ADDRESS
NEXT_PUBLIC_HIDDEN_CIRCLES
TEST_MONEY_AUTHORITY_SECRET_KEY
TEST_MONEY_RATE_LIMIT_MS
TEST_MONEY_USDC_AMOUNT
TEST_MONEY_SOL_LAMPORTS
```

To build and run the web app, use the app directory:

```sh
cd app
pnpm build
pnpm dev
```

### Program and repository layout

The Anchor program ID is `B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw`, recorded in [Anchor.toml](Anchor.toml).

```text
programs/    Anchor program source
sdk/         TypeScript SDK and SDK tests
app/         Next.js web app
scripts/     Devnet smoke, funding, and demo scripts
tests/       Anchor integration tests
docs/        Project documentation
```

### Honest limits

This app is devnet only. The test USDC has no real value. The project is not audited. Demo length periods are for testing.

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
