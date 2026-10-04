# Status

## Current milestone

The contract test milestone is complete locally. The program builds, the requested section 5.5 money paths and attack cases have integration coverage, and the full Anchor suite passed on a fresh local validator ledger.

## Verified results

`anchor build` completed successfully. The Anchor integration suite reported 12 passing tests and 0 failing tests in approximately 10 minutes. `pnpm exec tsc --noEmit`, `cargo fmt --all -- --check`, and `git diff --check` completed successfully. The required generated directories `test-ledger`, `.next`, `node_modules`, `.pnpm-store`, and `target` are ignored by Git and none are tracked.

The suite covers the complete five member circle and fees, default settlement by a third party with exact deposit debit and payout accounting, an early slot zero walkaway, exhausted deposit shortfall and event values, forfeited payout reservation and exact eligible share distribution, and conservation after every balance changing step for circles with 3, 5, and 12 members. The attack matrix asserts exact errors for wrong mint, wrong vault, repeated contribution, repeated payout claim, occupied slot, contribution after the deadline, settlement before the deadline, settling a member who paid, premature withdrawal, repeated withdrawal, signer and member mismatch, and a payout token account owned by the wrong recipient. Boundary coverage includes 3 and 12 members, the configured minimum period, a one unit contribution with a fee rounded to zero, and a large contribution whose payout fee multiplication exceeds the prior 64 bit intermediate limit.

The regression tests found and retained three contract fixes. A repeated payout claim now returns `PayoutAlreadyClaimed` before later round readiness checks. Forfeiture shares use the fixed `forfeit_total` rather than the decreasing `forfeit_pool`. Fee multiplication uses a 128 bit intermediate to avoid rejecting valid large payouts. The causes and fixes are recorded in `DECISIONS.md`.

## Not Yet Verified

The program has not been deployed to devnet. No devnet mint, wallet funding, create circle transaction, or join circle transaction has been verified. The SDK and web app are foundations only and are not complete against the master plan. No independent security audit has been performed.

The build emits existing Anchor macro configuration, glob re export, and deprecation warnings. They do not prevent the build or tests from passing.

## Next

Complete Milestone A2. Deploy to devnet, record the program address, create scripts for a devnet test mint and funded wallets, and verify real create circle and join circle transactions. Never report devnet success until those transactions succeed. The full plan is in `docs/MASTER_PROMPT_V2.md`.
