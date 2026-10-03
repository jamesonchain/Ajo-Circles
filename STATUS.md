# Status

## Current milestone

Milestone A is in progress. The settlement instruction surface now exists, the local money flow tests pass, and the SDK and web app foundations are in place.

## Works

The Anchor workspace builds its core account model for config, circle, and member accounts. Circle creation makes separate pot and deposit vaults. Members select a slot, transfer the calculated deposit, and the last member activates the circle. Active members can contribute once per round before the deadline.

Full clean `anchor build` succeeds with Anchor CLI 0.31.1 and Anchor crates 0.31.2. It regenerates `target/idl/ajo_circles.json` and `target/types/ajo_circles.ts`. Root and app TypeScript checks pass, and the Anchor suite currently reports 5 passing tests and 0 failures. The suite covers the complete five-member path, a third-party default settlement, forming-circle cancellation and refunds, SDK helpers, score finalization plus replay rejection, treasury fee totals, and a scripted token-conservation check after each join, contribution, and payout. The SDK now exposes PDA derivation, deposit math, deadlines, account readers, event parsing, and instruction builders. The Next.js App Router route now renders a responsive Ajo Circles landing and dashboard experience instead of the README.

### Section 5.5 coverage

1. Happy path: covered.
2. Default path: partially covered. Deposit coverage and third-party settlement pass, but the test does not yet assert the recipient's full payout.
3. Early slot walkaway: not covered. The current test defaults before slot 0 has paid.
4. Shortfall path: not covered.
5. Forfeit path: not covered end to end.
6. Cancel path: covered.
7. Attack/error matrix: not covered as a dedicated test.
8. Fee test: covered for the five-round happy path.
9. Invariant test: covered by the scripted conservation assertions in the happy-path test.
10. Score test: covered, including one-time recording and replay rejection.
11. Boundary tests: helper boundaries are covered, but on-chain minimum/maximum member, period, and contribution boundaries are not yet covered.

## Broken or unfinished

The remaining milestone gap is the uncompleted section 5.5 matrix: early walkaway, shortfall, forfeiture-share, full recipient-payout assertion, dedicated attack/error cases, and on-chain boundary cases. Devnet deployment and a clean deployment script are not complete. The SDK is not yet published as its own package. The web app currently uses local demo state and does not yet connect a wallet, read RPC data, or submit transactions. The Rust build still emits non-fatal dependency and macro configuration warnings, plus existing glob re-export warnings; there are no build errors or stack warnings.

## Next

Finish the security test matrix, deploy the program to devnet, wire the SDK to a wallet adapter and RPC, then connect the app flows to real transactions.
