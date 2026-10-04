# Decisions

## 2026 10 03

The program targets Anchor 0.30.1 and uses the SPL token interface so the same instruction accounts can work with the configured USDC mint on devnet and mainnet.

The config stores the configured mint in addition to the requested fields. This prevents a circle creator from selecting an unrelated token.

The first milestone implements configuration, circle creation, joining, and contributions. Later instructions will be added only after the first build and test pass.

Circle creation initializes state first. Pot and deposit vaults are initialized by two separate instructions because Solana's account validation stack limit is exceeded when both token accounts are created in the same Anchor account context. The client flow will call all three instructions together.

The proc-macro2 1.0.94 compatibility pin was tried first, as required, but it still failed because that release also references the unavailable `proc_macro::Span::source_file` API on this toolchain. The chosen fix was upgrading Anchor CLI to 0.31.1, `anchor-lang` and `anchor-spl` to 0.31.1, which resolve to 0.31.2, and the TypeScript client to 0.31.1. The SPL `idl-build` feature and TypeScript 5.9 were also enabled so IDL generation and type checking succeed.

The stack safe circle creation flow remains split into state creation, pot vault creation, and deposit vault creation. New payout contexts are boxed as well because associated token account creation and multiple token accounts can exceed Solana's stack frame limit.

Default cover transfers the smaller of the contribution and the member's remaining deposit. A shortfall is recorded on the circle and the round still advances once the default is settled. A member with any default forfeits the payout for that turn. The program immediately moves that round's pot into the deposit vault so later payouts cannot consume it. At completion, `forfeit_total` is the fixed distribution basis and `forfeit_pool` tracks the amount still available. Members with zero defaults split the total, with remainder units going to the first eligible claimants.

Protocol fees are rounded down in the smallest token unit. The treasury receives the fee before the recipient receives the remainder. The fee is capped at 2 percent and the current initialization default is 0.5 percent.

The section 5.5 forfeiture test exposed that a forfeited payout remained in the pot and could be included in a later member's payout. The program now transfers that amount from the pot vault into the circle deposit vault, increments `forfeit_pool` immediately, and pays forfeiture shares from the reserved deposit vault balance. This keeps forfeited funds separate from future payouts and preserves exact token accounting through completion.

The payout replay test exposed that a second claim during a later round returned `PayoutNotReady` before the program checked the member's `received` flag. The claim instruction now checks that flag before round readiness and recipient slot checks, so a replay returns the dedicated `PayoutAlreadyClaimed` error and cannot be confused with an unready payout.

The long invariant test exposed that forfeiture shares were calculated from the shrinking unclaimed pool. That made later claims smaller and left tokens undistributed. Circle state now keeps the immutable `forfeit_total` for share calculations while decrementing `forfeit_pool` after each claim.

The largest contribution payout test exposed that multiplying the pot by the fee basis points in `u64` overflowed before division, even when the final fee fit. Fee calculation now widens the multiplication to `u128` before converting the divided result back to `u64`.
