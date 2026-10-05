# Status

## Current milestone

Milestones A, contract, A2, devnet deployment, and B, SDK, are complete and verified. Milestone C is in progress.

## Verified results

The full Anchor build passed. The integrated test command passed 5 SDK unit tests and 12 Anchor integration tests with 0 failures on a fresh local validator ledger. The SDK package build, root TypeScript type check, project formatting checks, and patch whitespace check passed. Generated build, package, and validator state folders are ignored by Git and none are tracked.

Tests cover the complete cycle, default settlement by a third party with exact deposit debit and payout accounting, an early slot zero walkaway, exhausted deposit shortfall and event values, forfeited payout reservation and exact eligible share distribution, score finalization, exact attack errors, boundary conditions, and conservation after each balance changing step for circles with 3, 5, and 12 members.

The tests found and retain three program fixes: payout replay error ordering, immutable forfeiture share calculation, and widened fee multiplication for large pots. See `DECISIONS.md` for the causes and fixes.

The program is deployed to Solana devnet at `B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw`. The Anchor CLI deployment to devnet succeeded on October 4, 2026. The program account is executable, and its upgrade authority is the configured deployer `3thGwAqmDcUattjmSVUdRcvTdJenBVV1M5M5LuvuPWdD`.

The `pnpm devnet:smoke` script created test mint `9qGJsamQ8irgapMSmEoR525GhD7DH4tFMsbtfUNHEvdb`, created circle `CU8i9Yg43chjyRL6qHbFcmoBXvvpoWKnxSb1V747KVpH`, initialized both vaults, joined three test wallets, and fetched the circle with member count 3. The repeat run also succeeded and printed the confirmed transaction signatures. Generated wallet keys are saved under the ignored `.devnet` directory. RPC airdrop failed once and the official faucet required a browser challenge that could not load, so the script funded wallets with transfers from the configured devnet deployer instead. No airdrop retry was made.

The SDK is a workspace package with explicit builders for all 13 instructions, packaged IDL and generated types, PDA and deposit helpers, account readers, member listing, wallet circle discovery, next payment due lookup, Ajo Score reads, and event decoding. The five line wallet summary example was installed and run from an isolated consumer project against devnet. It returned the deployer wallet, zero circles, no due payment, and no score, as expected for that wallet.

The app has a real Phantom and Solflare wallet selector, devnet account reads, a data driven circle ring, live totals, wallet circle and score states, an open circle directory, and the circle creation wizard. The slot review was verified in the browser and showed the expected deposits. No app transaction has been signed from a browser wallet.

## Milestone C step record

| Step | Code exists | App typecheck and Next build | Signed on devnet |
| --- | --- | --- | --- |
| 1. Create circle wizard | Yes. Name and amount, frequency and size, deposit review, invite link, copy, WhatsApp share, and real create and vault transaction builders exist. | Yes. The app typecheck and production build passed after this step. | No. The create and vault transactions were not signed from the app. |
| 2. Circle page | Yes. Ring, countdown, one primary action, payout timeline, member badges, payout and cover actions exist. | Yes. The app typecheck and production build passed after this step. | No. Payment, payout, and cover transactions were not signed from the app. |
| 3. Get test money | Yes. The dynamic `/api/test-money` route, rate limit, devnet guard, SOL transfer, USDC mint, client button, and contract error mapping exist. | Yes. The app typecheck and production build passed after this step. | No. The route was not invoked against devnet from the deployed app. |
| 4. My circles and completion | Yes. The My circles dashboard and completion panel with Withdraw my deposit and Update my Ajo Score exist. | Yes. The app typecheck and production build passed after this step. | No. Withdraw and score transactions were not signed from the app. |
| 5. Environment and deployment readiness | Yes. `.env.example` lists the app and test money variables, and the app exposes the test money route. | Yes. The final app typecheck and production build passed. | No. Vercel deployment and a signed app flow were not verified. |

## Not Yet Verified

No Step 1 to 5 app flow has been signed from a browser wallet on devnet. A full savings cycle with a covered default has not been run through the app on devnet. Vercel deployment has not been verified. The SDK has not been published to a public package registry. No independent security audit has been performed.

The build emits existing Anchor macro configuration, glob re export, and deprecation warnings. They do not prevent the build or tests from passing.

## Next

Run the app flows with a connected wallet on devnet, including create, invite join, payment, payout, missed payment cover, test money, withdrawal, and score update. Then verify deployment on Vercel and record the confirmed signatures here.
