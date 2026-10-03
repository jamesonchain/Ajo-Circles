# Status

## Current milestone

Milestone A is in progress. The settlement instruction surface now exists, the local money flow tests pass, and the SDK and web app foundations are in place.

## Works

The Anchor workspace builds its core account model for config, circle, and member accounts. Circle creation makes separate pot and deposit vaults. Members select a slot, transfer the calculated deposit, and the last member activates the circle. Active members can contribute once per round before the deadline.

Full `anchor build` succeeds with Anchor CLI 0.31.1 and Anchor crates 0.31.2. It generates `target/idl/ajo_circles.json` and `target/types/ajo_circles.ts`. Node dependencies install, TypeScript type checking passes, and the Anchor suite passes program loading, a five member complete circle, default cover, cancellation refund, and SDK helper checks. The SDK now exposes PDA derivation, deposit math, deadlines, account readers, event parsing, and instruction builders. The Next.js App Router route now renders a responsive Ajo Circles landing and dashboard experience instead of the README.

## Broken or unfinished

The program still needs the full attack, invariant, boundary, forfeiture share, fee, and score replay test matrix. Devnet deployment and a clean deployment script are not complete. The SDK is not yet published as its own package. The web app currently uses local demo state and does not yet connect a wallet, read RPC data, or submit transactions. The Rust build still emits non fatal dependency and macro configuration warnings, plus existing glob re export warnings; there are no build errors or stack warnings.

## Next

Finish the security test matrix, deploy the program to devnet, wire the SDK to a wallet adapter and RPC, then connect the app flows to real transactions.
