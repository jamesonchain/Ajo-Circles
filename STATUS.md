# Status

## Current milestone

Milestone one is in progress. The repository layout and the first four onchain instructions are implemented.

## Works

The Anchor workspace builds its core account model for config, circle, and member accounts. Circle creation makes separate pot and deposit vaults. Members select a slot, transfer the calculated deposit, and the last member activates the circle. Active members can contribute once per round before the deadline.

## Broken or unfinished

The program still needs default settlement, payout, completion, cancellation, refunds, deposit withdrawal, SDK, web app, and the full test suite. The account model and first four instructions compile with `anchor build --no-idl`. The create stack warning is resolved by boxing large accounts and moving pot and deposit vault initialization into two small follow up instructions. Full IDL generation is blocked by Anchor 0.30.1 calling the removed `proc_macro2::Span::source_file` API, so `target/idl` and `target/types` are not currently generated. The TypeScript test cannot run without those generated artifacts and installed Node dependencies.

## Next

Establish a compatible IDL generation toolchain, add the milestone tests, and commit the working milestone.
