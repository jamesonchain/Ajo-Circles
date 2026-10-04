# Security notes

The program is unaudited and should only use the configured test mint until an independent review is complete.

## Trust boundaries

The Circle PDA owns the pot vault and the deposit vault. No admin instruction can transfer user funds. The admin can initialize configuration, choose the configured mint, set the treasury token account, and set a fee no higher than 2 percent during initialization. The current code has no admin withdrawal path.

Every vault transfer is signed with the Circle PDA seeds. Every token account is checked against the circle mint. Member accounts are checked against both the circle and wallet. State transitions require the expected circle status, and round arithmetic uses checked operations.

## Money invariants

The pot and deposit vaults are separate. A contribution increases the pot and a default settlement moves only the covered amount from a member deposit into the pot. A payout takes the fee and recipient amount from the pot. A deposit withdrawal or cancellation refund takes only the member's remaining deposit. Tests must continue to assert that no vault pays more than its balance and that repeated actions fail.

When a member with defaults reaches their payout turn, the remaining pot moves into the deposit vault and is recorded in the forfeiture pool. Shares use the fixed total pool and are claimable only by members with no defaults. The local integration suite checks token conservation after joins, contributions, settlements, payouts, and forfeiture claims across circles with 3, 5, and 12 members.

## Known limits

The local suite covers the requested wrong account, replay, deadline, fee, boundary, default, shortfall, and forfeiture cases. The invariant scenarios are deterministic rather than randomized. Devnet deployment and wallet based end to end testing are not complete. The program has not had an independent audit.
