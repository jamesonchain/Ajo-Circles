# Ajo Circles

Ajo Circles is a savings group app for rotating pots on Solana. Members contribute on a schedule, and the smart contract tracks deposits, turns, and default cover.

The project is under active construction. The Anchor program, SDK foundation, and a polished local demo frontend are included. See [STATUS.md](STATUS.md) for the current implementation state.

## Quick start

Install the root dependencies, then run the verified local contract flow.

```text
pnpm install
anchor build
anchor test
```

To run the web demo, use `pnpm install` and `pnpm dev` inside `app`. The local demo route is intentionally separate from live wallet and RPC state until the devnet deployment is recorded.

Local tests use `B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw`. The same program is deployed to devnet as verified below.

## Devnet verification

The Ajo Circles program is deployed to Solana devnet at `B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw`. On October 4, 2026, the devnet smoke script created a six decimal test mint, created a circle, initialized both vaults, joined three test wallets, and read the circle back with three members.

Test mint: `9qGJsamQ8irgapMSmEoR525GhD7DH4tFMsbtfUNHEvdb`.

Smoke circle: `CU8i9Yg43chjyRL6qHbFcmoBXvvpoWKnxSb1V747KVpH`.

Set `ANCHOR_PROVIDER_URL` to `https://api.devnet.solana.com` and `ANCHOR_WALLET` to a funded signer, then run `pnpm devnet:smoke` from the repository root. The script saves generated wallet keys and setup state in the ignored `.devnet` directory. It funds test wallets with transfers from the configured signer and checks that the RPC endpoint is devnet before sending transactions.
