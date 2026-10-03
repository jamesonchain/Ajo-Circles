# Security notes

The program is unaudited and should only use the configured test mint until an independent review is complete.

## Trust boundaries

The Circle PDA owns the pot vault and the deposit vault. No admin instruction can transfer user funds. The admin can initialize configuration, choose the configured mint, set the treasury token account, and set a fee no higher than 2 percent during initialization. The current code has no admin withdrawal path.

Every vault transfer is signed with the Circle PDA seeds. Every token account is checked against the circle mint. Member accounts are checked against both the circle and wallet. State transitions require the expected circle status, and round arithmetic uses checked operations.

## Money invariants

The pot and deposit vaults are separate. A contribution increases the pot and a default settlement moves only the covered amount from a member deposit into the pot. A payout takes the fee and recipient amount from the pot. A deposit withdrawal or cancellation refund takes only the member's remaining deposit. Tests must continue to assert that no vault pays more than its balance and that repeated actions fail.

## Known limits

The current local suite still needs the full wrong account, replay, randomized invariant, fee, boundary, and forfeiture test matrix. Devnet deployment and wallet based end to end testing are not complete. The program has not had an independent audit.
