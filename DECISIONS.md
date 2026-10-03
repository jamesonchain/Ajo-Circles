# Decisions

## 2026 10 03

The program targets Anchor 0.30.1 and uses the SPL token interface so the same instruction accounts can work with the configured USDC mint on devnet and mainnet.

The config stores the configured mint in addition to the requested fields. This prevents a circle creator from selecting an unrelated token.

The first milestone implements configuration, circle creation, joining, and contributions. Later instructions will be added only after the first build and test pass.
