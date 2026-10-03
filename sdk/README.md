# Ajo Circles SDK

The SDK exposes deterministic account derivation, slot deposit math, deadline calculation, account readers, event decoding, and instruction builders for every current program instruction.

```ts
import { AjoCirclesClient, calculateDeposit } from "ajo-circles-sdk";

const client = new AjoCirclesClient(program);
const member = client.member(circleAddress, wallet.publicKey);
const deposit = calculateDeposit(10_000_000n, 5, 0);
const score = await client.fetchScore(wallet.publicKey);
```

The current package is source checked inside this repository. It is not yet published to npm, and transaction signing remains the responsibility of the wallet integration that consumes the returned instructions.
