# Decisions

## 2026 10 03

The program targets Anchor 0.30.1 and uses the SPL token interface so the same instruction accounts can work with the configured USDC mint on devnet and mainnet.

The config stores the configured mint in addition to the requested fields. This prevents a circle creator from selecting an unrelated token.

The first milestone implements configuration, circle creation, joining, and contributions. Later instructions will be added only after the first build and test pass.

Circle creation initializes state first. Pot and deposit vaults are initialized by two separate instructions because Solana's account validation stack limit is exceeded when both token accounts are created in the same Anchor account context. The client flow will call all three instructions together.

The proc-macro2 1.0.94 compatibility pin was tried first, as required, but it still failed because that release also references the unavailable `proc_macro::Span::source_file` API on this toolchain. The chosen fix was upgrading Anchor CLI to 0.31.1, `anchor-lang` and `anchor-spl` to 0.31.1, which resolve to 0.31.2, and the TypeScript client to 0.31.1. The SPL `idl-build` feature and TypeScript 5.9 were also enabled so IDL generation and type checking succeed.
