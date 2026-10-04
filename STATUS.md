# Status

## Current milestone

Milestone A, contract, and Milestone A2, devnet deployment, are complete and verified. Milestone B, SDK, is next.

## Verified results

The full Anchor build passed. The integration suite passed with 12 tests and 0 failures on a fresh local validator ledger. The root TypeScript type check, Rust formatting check, and patch whitespace check passed. Generated build, package, and validator state folders are ignored by Git and none are tracked.

Tests cover the complete cycle, default settlement by a third party with exact deposit debit and payout accounting, an early slot zero walkaway, exhausted deposit shortfall and event values, forfeited payout reservation and exact eligible share distribution, score finalization, exact attack errors, boundary conditions, and conservation after each balance changing step for circles with 3, 5, and 12 members.

The tests found and retain three program fixes: payout replay error ordering, immutable forfeiture share calculation, and widened fee multiplication for large pots. See `DECISIONS.md` for the causes and fixes.

The program is deployed to Solana devnet at `B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw`. The Anchor CLI deployment to devnet succeeded on October 4, 2026. The program account is executable, and its upgrade authority is the configured deployer `3thGwAqmDcUattjmSVUdRcvTdJenBVV1M5M5LuvuPWdD`.

The `pnpm devnet:smoke` script created test mint `9qGJsamQ8irgapMSmEoR525GhD7DH4tFMsbtfUNHEvdb`, created circle `CU8i9Yg43chjyRL6qHbFcmoBXvvpoWKnxSb1V747KVpH`, initialized both vaults, joined three test wallets, and fetched the circle with member count 3. The repeat run also succeeded and printed the confirmed transaction signatures. Generated wallet keys are saved under the ignored `.devnet` directory. RPC airdrop failed once and the official faucet required a browser challenge that could not load, so the script funded wallets with transfers from the configured devnet deployer instead. No airdrop retry was made.

## Not Yet Verified

The SDK is not complete against Milestone B. The web app remains a foundation and is not connected to real wallet transactions or live circle state. A full savings cycle with a covered default has not been run on devnet. No independent security audit has been performed.

The build emits existing Anchor macro configuration, glob re export, and deprecation warnings. They do not prevent the build or tests from passing.

## Next

Begin Milestone B. Complete and test the TypeScript SDK client methods, PDA helpers, account and event readers, Ajo Score reader, package example, published IDL and types, and unit tests. Run the full build and test suite, update this status, then commit and push the milestone. The full plan is in `docs/MASTER_PROMPT_V2.md`.
