# Ajo Circles SDK

The package exports the program IDL and TypeScript type, PDA derivation, deposit math, deadline math, account readers, event decoding, wallet circle discovery, due payment queries, Ajo Score reads, and an instruction builder for each program instruction. Builders return `TransactionInstruction` values. The consuming wallet signs and submits them.

## Build and test

From the repository root, run `pnpm build:sdk` and `pnpm test:sdk`. The package output includes JavaScript, declarations, and the program IDL.

## Read a wallet

Install this package from its folder with `pnpm add file:/path/to/sdk`. Set `ANCHOR_PROVIDER_URL` and `ANCHOR_WALLET` for the desired cluster. This five line example reads memberships, the next unpaid turn, and the wallet score. The score is `null` until the wallet completes a circle.

```ts
import { createAjoCirclesClientFromEnv } from "ajo_circles_sdk";
const client = createAjoCirclesClientFromEnv();
const wallet = client.provider.wallet.publicKey;
const summary = await client.walletSummary(wallet);
console.log(summary.circles, summary.nextPayment, summary.score);
```

## Instruction builders

The client has one builder for every instruction: `initConfig`, `createCircle`, `initializePotVault`, `initializeDepositVault`, `joinCircle`, `contribute`, `cancelCircle`, `refundDeposit`, `settleDefault`, `claimPayout`, `claimForfeitShare`, `withdrawDeposit`, and `finalizeScore`. Each takes the instruction arguments followed by an account address map and returns an instruction that can be signed by an Anchor wallet or wallet adapter.

`listCirclesForWallet` discovers circles through member accounts. `nextPaymentsDue` returns active unpaid turns sorted by their deadlines, including overdue turns. `fetchScore` returns `null` when the wallet has not recorded a score.
