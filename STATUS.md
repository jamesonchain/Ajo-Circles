# Status

## Current milestone

Milestone one is in progress. The repository layout and the first four onchain instructions are implemented, and the Anchor build and milestone test now pass.

## Works

The Anchor workspace builds its core account model for config, circle, and member accounts. Circle creation makes separate pot and deposit vaults. Members select a slot, transfer the calculated deposit, and the last member activates the circle. Active members can contribute once per round before the deadline.

Full `anchor build` succeeds with Anchor CLI 0.31.1 and Anchor crates 0.31.2. It generates `target/idl/ajo_circles.json` and `target/types/ajo_circles.ts`. Node dependencies install, TypeScript type checking passes, and `anchor test` passes the program loading milestone test.

## Broken or unfinished

The program still needs default settlement, payout, completion, cancellation, refunds, deposit withdrawal, SDK, web app, and the full test suite. The create stack warning is resolved by boxing large accounts and moving pot and deposit vault initialization into two small follow up instructions. The Rust build still emits non-fatal dependency and macro configuration warnings, plus existing glob re-export warnings; there are no build errors or stack warnings. The frontend is still not implemented and `app/` remains documentation only.

## Next

Add the onchain milestone tests, then implement the SDK and Next.js web app.
