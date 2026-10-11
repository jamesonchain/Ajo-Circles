# Status

## Current milestone

Milestones A, contract, A2, devnet deployment, and B, SDK, are complete and verified. Milestone C is in progress.

## Verified results

The full Anchor build passed. The integrated test command passed 5 SDK unit tests and 12 Anchor integration tests with 0 failures on a fresh local validator ledger. The SDK package build, root TypeScript type check, project formatting checks, and patch whitespace check passed. Generated build, package, and validator state folders are ignored by Git and none are tracked.

Tests cover the complete cycle, default settlement by a third party with exact deposit debit and payout accounting, an early slot zero walkaway, exhausted deposit shortfall and event values, forfeited payout reservation and exact eligible share distribution, score finalization, exact attack errors, boundary conditions, and conservation after each balance changing step for circles with 3, 5, and 12 members.

The tests found and retain three program fixes: payout replay error ordering, immutable forfeiture share calculation, and widened fee multiplication for large pots. See `DECISIONS.md` for the causes and fixes.

The program is deployed to Solana devnet at `B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw`. The Anchor CLI deployment to devnet succeeded on October 4, 2026. The program account is executable, and its upgrade authority is the configured deployer `3thGwAqmDcUattjmSVUdRcvTdJenBVV1M5M5LuvuPWdD`.

The `pnpm devnet:smoke` script created test mint `9qGJsamQ8irgapMSmEoR525GhD7DH4tFMsbtfUNHEvdb`, created circle `CU8i9Yg43chjyRL6qHbFcmoBXvvpoWKnxSb1V747KVpH`, initialized both vaults, joined three test wallets, and fetched the circle with member count 3. The repeat run also succeeded and printed the confirmed transaction signatures. Generated wallet keys are saved under the ignored `.devnet` directory. RPC airdrop failed once and the official faucet required a browser challenge that could not load, so the script funded wallets with transfers from the configured devnet deployer instead. No airdrop retry was made.

The SDK is a workspace package with explicit builders for all 13 instructions, packaged IDL and generated types, PDA and deposit helpers, account readers, member listing, wallet circle discovery, next payment due lookup, Ajo Score reads, and event decoding. The five line wallet summary example was installed and run from an isolated consumer project against devnet. It returned the deployer wallet, zero circles, no due payment, and no score, as expected for that wallet.

The app has a real Phantom and Solflare wallet selector, devnet account reads, a data driven circle ring, live totals, wallet circle and score states, an open circle directory, and the circle creation wizard. The slot review was verified in the browser and showed the expected deposits. No app transaction has been signed from a browser wallet.

The RPC resilience changes and `scripts/demo.ts` were committed before the devnet run. The demo run did not complete because the configured public devnet RPC returned repeated 429 responses before it could produce cycle signatures or final balances. A dedicated RPC URL is still required for the full cycle proof.

A dedicated faucet wallet is saved at the ignored `.devnet/faucet.json`. The deployer was confirmed as the test mint authority, funded the faucet with 1 SOL, and transferred mint authority to it on devnet. The local app environment uses the faucet key without tracking or displaying its secret. The restarted `/api/test-money` route was called successfully for a known devnet test wallet and sent 100 USDC plus SOL. That wallet now has 104 USDC. The connected wallet beginning with 2cmL and ending with Jzdz could not be resolved because no browser surface was available.

## Milestone C step record

| Step | Code exists | App typecheck and Next build | Signed on devnet |
| --- | --- | --- | --- |
| 1. Create circle wizard | Yes. Name and amount, frequency and size, deposit review, invite link, copy, WhatsApp share, and real create and vault transaction builders exist. | Yes. The app typecheck and production build passed after this step. | No. The create and vault transactions were not signed from the app. |
| 2. Circle page | Yes. Ring, countdown, one primary action, payout timeline, member badges, payout and cover actions exist. | Yes. The app typecheck and production build passed after this step. | No. Payment, payout, and cover transactions were not signed from the app. |
| 3. Get test money | Yes. The dynamic `/api/test-money` route, rate limit, devnet guard, SOL transfer, USDC mint, client button, contract error mapping, and dedicated faucet exist. | Yes. The app typecheck and production build passed after this step. | Yes. The restarted local route minted 100 USDC and sent SOL to a known devnet test wallet. |
| 4. My circles and completion | Yes. The My circles dashboard and completion panel with Withdraw my deposit and Update my Ajo Score exist. | Yes. The app typecheck and production build passed after this step. | No. Withdraw and score transactions were not signed from the app. |
| 5. Environment and deployment readiness | Yes. `.env.example` lists the app and test money variables, and the app exposes the test money route. | Yes. The final app typecheck and production build passed. | No. Vercel deployment and a signed app flow were not verified. |

## Not Yet Verified

No Step 1, 2, or 4 app flow has been signed from a browser wallet on devnet. Step 3 was verified through the local route with a known test wallet, not the connected browser wallet. A full savings cycle with a covered default has not been run through the app on devnet. Vercel deployment has not been verified. The SDK has not been published to a public package registry. No independent security audit has been performed.

The build emits existing Anchor macro configuration, glob re export, and deprecation warnings. They do not prevent the build or tests from passing.

## Next

Set a working dedicated devnet RPC URL, rerun `scripts/demo.ts`, record its confirmed signatures and final balances, then run the browser wallet flows and verify deployment on Vercel.

## 2026 10 11 balance and Phantom account fixes

The data layer now reads the connected wallet SOL account and associated test USDC account together with `getMultipleAccountsInfo`, refreshes them after confirmed actions, and reports the actual RPC failure reason in the banner and console. The configured RPC runs a startup `getVersion` check. Test money updates balances immediately from the route response and explains the rate limit wait.

Phantom account changes are observed through the provider and wallet adapter events. A switch clears wallet specific data, blocks signing, shows the new shortened address, and requires signing in again before reloading. The header shows Phantom and the active address while connected and includes Disconnect. App typecheck and ESLint pass after these changes. No new devnet Phantom transaction was signed during this fix.

## 2026 10 11 app fixes

The app typecheck and ESLint pass. Four issues were found and fixed:

1. Circle creation sent three wallet transactions. Create and vault setup now share one simulated transaction with compute budget, one blockhash, confirmed commitment, retry limits, and an oversized transaction fallback using one sign all request.

2. Creators were missing from My circles because only Member accounts were queried. The SDK now queries Circle accounts by creator and merges them with member circles, with immediate refresh after actions.

3. Refresh polling retried too early and kept the busy banner visible. Selected circles now poll every 8 seconds only while visible, use batched account reads, retry rate limits with backoff, clear the banner after success, and show loading skeletons before an empty state.

4. The development overlay reported hydration and effect warnings, and the app still used the removed Next lint command. Time values now start deterministically, browser effects are deferred, wallet errors are forwarded to friendly toasts, and ESLint uses the Next 16 flat configuration.

## 2026 10 11 cancellation feature

Circle cancellation is implemented in the app and SDK. A creator can cancel only a Forming circle through a confirmation dialog, one simulated transaction, one wallet approval, disabled in flight, Explorer success feedback, and an optimistic cache update. Cancelled circles are hidden from Open circles and the default My circles view, with a Show cancelled toggle and muted badge.

Members of a cancelled circle see the refund instruction and Refund my deposit action. The refund uses the existing refund_deposit instruction and returns the member deposit to that member’s test USDC account. Cancelled is now an explicit SDK status mapping and cancelled circles cannot be joined.

App typecheck and ESLint pass. No Anchor program changes were needed.

## 2026 10 11 join reliability

The join path previously treated a missing source associated token account as a fatal client error, so it never reached the program and showed the generic fallback message. Join now derives the Member PDA directly, fetches that Member account before sending, adds an idempotent source ATA instruction followed by join_circle in one transaction, simulates the complete transaction, logs simulation logs and program error codes, and maps known failure reasons to friendly messages. Confirmation uses HTTP status polling because the dedicated RPC does not expose signatureSubscribe.

The devnet reproduction initially exposed a separate faucet failure: the dedicated faucet had 0.00093436 SOL and could not fund the temporary wallets. The deployer topped it up, then scripts/join-status.ts created a temporary circle, joined turns one through three with three wallets, and verified each Member PDA directly. The confirmed join signatures were 5C9phLDFgEugvsdFwUq5AVc48zXBeTzNgz3Ez1DpYs5B9Vd2cwLSzH7Px3nictkGJoRup7dzmYGkVW9ynm3dGLY6, 5SyosreqLjbT1s73A8jjWrtHqhLpKdaVj9CLTMbCo8ZniugHVz9PTn3Y3NQQwhtYZMgLqorp1FbDg2kvwPsVKFS, and 32mvUMEPQhkgi3CU4Co8o1Bq5T35ZNRZJp9Z11kqSVSiUj9djuJbtfEkjjuyZkyXkLAfFSkR9BDvWdt4mwNRjopu. Circle 5au6tvygtVnPAdtFd4awMuinisKBEHYzmSwSkEP6FAF7 passed the direct status check.

## 2026 10 11 Phantom and demo readiness

Phantom remains the default and first wallet option in the header. Every app action uses the same transaction dispatcher and wallet signer interface. Phantom signs create with vault setup, creator ATA setup, and creator join in one transaction, join with ATA setup and join in one transaction, and pay, claim, withdraw, finalize score, cancel, and refund as one transaction each. Demo wallets use the same dispatcher with local browser keypairs and no wallet popup.

The demo wallet switcher creates Ada, Tunde, and Chioma once in browser local storage, labels them as demo wallets for test money only, shows the active wallet address and balances, and keeps Switch to Phantom visible. The test money route now funds all three demo wallets in one request, with one combined ATA, USDC mint, and SOL transaction per wallet. Demo funding bypasses the normal wallet rate limit.

The create wizard now self joins the creator in the selected turn and shows the exact protected deposit before approval. The weekday picker is currently a displayed preference because the deployed program starts the first round when the circle becomes full and has no weekday field; persisting that preference onchain is future work.

`pnpm devnet:demo-ui` passed against devnet after replenishing the dedicated faucet. It printed PASS for creator creation at 1 / 3, wallet two joining by link with its USDC balance dropping, wallet three joining at 3 / 3, and a covered default after the 60 second period. Circle 9DJKtsxujjvMm2EAxRSKUYAUGJPeoKEcA6y1BMQTbXm4 was used for that run. The run printed confirmed signatures for every funding and action transaction.

Phantom manual checklist for browser verification:

1. Start the app with `NEXT_PUBLIC_SOLANA_RPC_URL` set and select Phantom first in the header.
2. Connect Phantom on devnet and use Get test money. Confirm the balance toast and Explorer link.
3. Create a three member circle, choose a creator turn, confirm exactly one Phantom approval, and verify the creator appears as You are a member at 1 / 3.
4. Copy the invite, open `/join/[circleAddress]` or paste the full URL, confirm the selected turn and deposit, then verify exactly one approval and 2 / 3.
5. Complete the remaining join, pay, claim payout, withdraw deposit, and finalize score actions. Each should show one approval, a confirmed Explorer toast, and no duplicate transaction.

The Phantom browser checklist has not been executed in an available browser session. The demo signer flow is verified on devnet; the real Phantom signing path remains pending manual browser confirmation.

## 2026 10 11 server backed directory

The browser no longer calls `getProgramAccounts`. `/api/circles` queries Circle and Member accounts on the server with discriminator filters, caches each directory or wallet result for 5 seconds, retries once on the public devnet RPC, and returns stale data with the real reason when both endpoints fail. React Query keeps previous directory data during refresh, and confirmed actions clear the server cache, invalidate client queries, then refresh the selected circle directly. App typecheck and ESLint pass.
