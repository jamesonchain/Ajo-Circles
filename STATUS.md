# Status

## Current milestone

Milestones A, contract, A2, devnet deployment, and B, SDK, are complete and verified. Milestone C, web app, is next.

## Verified results

The full Anchor build passed. The integrated test command passed 5 SDK unit tests and 12 Anchor integration tests with 0 failures on a fresh local validator ledger. The SDK package build, root TypeScript type check, project formatting checks, and patch whitespace check passed. Generated build, package, and validator state folders are ignored by Git and none are tracked.

Tests cover the complete cycle, default settlement by a third party with exact deposit debit and payout accounting, an early slot zero walkaway, exhausted deposit shortfall and event values, forfeited payout reservation and exact eligible share distribution, score finalization, exact attack errors, boundary conditions, and conservation after each balance changing step for circles with 3, 5, and 12 members.

The tests found and retain three program fixes: payout replay error ordering, immutable forfeiture share calculation, and widened fee multiplication for large pots. See `DECISIONS.md` for the causes and fixes.

The program is deployed to Solana devnet at `B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw`. The Anchor CLI deployment to devnet succeeded on October 4, 2026. The program account is executable, and its upgrade authority is the configured deployer `3thGwAqmDcUattjmSVUdRcvTdJenBVV1M5M5LuvuPWdD`.

The `pnpm devnet:smoke` script created test mint `9qGJsamQ8irgapMSmEoR525GhD7DH4tFMsbtfUNHEvdb`, created circle `CU8i9Yg43chjyRL6qHbFcmoBXvvpoWKnxSb1V747KVpH`, initialized both vaults, joined three test wallets, and fetched the circle with member count 3. The repeat run also succeeded and printed the confirmed transaction signatures. Generated wallet keys are saved under the ignored `.devnet` directory. RPC airdrop failed once and the official faucet required a browser challenge that could not load, so the script funded wallets with transfers from the configured devnet deployer instead. No airdrop retry was made.

The SDK is a workspace package with explicit builders for all 13 instructions, packaged IDL and generated types, PDA and deposit helpers, account readers, member listing, wallet circle discovery, next payment due lookup, Ajo Score reads, and event decoding. The five line wallet summary example was installed and run from an isolated consumer project against devnet. It returned the deployer wallet, zero circles, no due payment, and no score, as expected for that wallet.

## Not Yet Verified

The SDK has not been published to a public package registry. The web app remains a foundation and is not connected to real wallet transactions or live circle state. A full savings cycle with a covered default has not been run on devnet. No independent security audit has been performed.

The build emits existing Anchor macro configuration, glob re export, and deprecation warnings. They do not prevent the build or tests from passing.

## Next

Begin Milestone C. Inspect the existing app before editing, then implement real wallet connection and chain backed views against the verified devnet program. Preserve the existing circle ring foundation. Follow the screens and UX requirements in `docs/MASTER_PROMPT_V2.md`, verify each working flow in a real run, then run the full build and tests, update this status, and commit and push the milestone.
