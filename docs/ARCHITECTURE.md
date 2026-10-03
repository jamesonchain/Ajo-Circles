# Architecture

The Anchor program uses a config account, one circle account per creator and circle id, one member account per wallet, and separate token vaults for the pot and security deposits.

For slot `s`, the deposit is `contribution times max of 1 and max members minus 1 minus s`. With five members and a contribution of 10 USDC, slots 0 through 4 require 40, 30, 20, 10, and 10 USDC.

The first milestone covers config initialization, circle creation, joining, and contributions. The remaining settlement and payout flow is described in the master build prompt and will be added in the next milestone.
