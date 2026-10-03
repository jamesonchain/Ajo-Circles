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

The program currently uses `B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw` for local testing. It is not presented as a devnet deployment address.
