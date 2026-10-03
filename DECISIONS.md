# Decisions

## 2026 10 03

The program targets Anchor 0.30.1 and uses the SPL token interface so the same instruction accounts can work with the configured USDC mint on devnet and mainnet.

The config stores the configured mint in addition to the requested fields. This prevents a circle creator from selecting an unrelated token.

The first milestone implements configuration, circle creation, joining, and contributions. Later instructions will be added only after the first build and test pass.

Circle creation initializes state first. Pot and deposit vaults are initialized by two separate instructions because Solana's account validation stack limit is exceeded when both token accounts are created in the same Anchor account context. The client flow will call all three instructions together.

The proc-macro2 1.0.94 compatibility pin was tried first, as required, but it still failed because that release also references the unavailable `proc_macro::Span::source_file` API on this toolchain. The chosen fix was upgrading Anchor CLI to 0.31.1, `anchor-lang` and `anchor-spl` to 0.31.1, which resolve to 0.31.2, and the TypeScript client to 0.31.1. The SPL `idl-build` feature and TypeScript 5.9 were also enabled so IDL generation and type checking succeed.

The stack safe circle creation flow remains split into state creation, pot vault creation, and deposit vault creation. New payout contexts are boxed as well because associated token account creation and multiple token accounts can exceed Solana's stack frame limit.

Default cover transfers the smaller of the contribution and the member's remaining deposit. A shortfall is recorded on the circle and the round still advances once the default is settled. A member with any default forfeits the payout for that turn. The pot is not moved during the forfeiture, because later payouts may consume it. The actual remaining pot is snapshotted only when the circle completes and is then divided among members with zero defaults. Remainder units go to the first eligible claimants, so no token dust is lost.

Protocol fees are rounded down in the smallest token unit. The treasury receives the fee before the recipient receives the remainder. The fee is capped at 2 percent and the current initialization default is 0.5 percent.
