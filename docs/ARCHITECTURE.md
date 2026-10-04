# Architecture

The Anchor program uses a config account, one circle account per creator and circle id, one member account per wallet, and separate token vaults for the pot and security deposits.

For slot `s`, the deposit is `contribution times max of 1 and max members minus 1 minus s`. With five members and a contribution of 10 USDC, slots 0 through 4 require 40, 30, 20, 10, and 10 USDC.

The program now includes cancellation, deposit refunds, default cover, payouts, forfeiture shares, deposit withdrawal, and Ajo Score finalization. All transfers from either vault use the Circle PDA as the signing authority. Account validation checks the circle seeds, member relationship, token mint, token owners, and configured treasury.

The active round is complete when every member has either contributed or been settled as a default. A payout uses the pot balance at that point. The fee is the floor of pot balance multiplied by fee basis points divided by ten thousand. The recipient receives the remainder. Fee multiplication uses a widened integer so large valid pots do not overflow before division. If the recipient has defaulted, the whole pot moves into the deposit vault and is reserved immediately. `forfeit_pool` tracks the unclaimed amount and `forfeit_total` remains the fixed basis for equal shares. Members with zero defaults claim shares, with remainder units assigned one each to the first claims.

The AjoScore account is derived from the wallet and is updated once for each completed circle. It records completed circles, rounds paid on time, defaults, and the amount contributed directly by the wallet. The current test harness proves the complete no default path, one covered default, cancellation refund, score finalization, and the core helper math.
