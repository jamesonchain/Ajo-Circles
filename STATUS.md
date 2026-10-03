# Status

## Current milestone

Milestone one is in progress. The repository layout and the first four onchain instructions are implemented.

## Works

The Anchor workspace builds its core account model for config, circle, and member accounts. Circle creation makes separate pot and deposit vaults. Members select a slot, transfer the calculated deposit, and the last member activates the circle. Active members can contribute once per round before the deadline.

## Broken or unfinished

The program still needs default settlement, payout, completion, cancellation, refunds, deposit withdrawal, SDK, web app, and the full test suite. The program build passes with `anchor build --no-idl`. Anchor 0.30.1 IDL generation does not compile on Rust 1.96 because its bundled `anchor-syn` expects an older proc macro span API. The SBF build also reports a stack size warning for the create instruction that needs a follow up reduction before deployment.

## Next

Reduce the create instruction stack frame, add the milestone tests, and commit the working milestone.
