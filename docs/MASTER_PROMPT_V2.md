AJO CIRCLES MASTER PLAN V2

RULES OF WORK
1. Read STATUS.md, DECISIONS.md, the program source and the tests before changing anything.
2. Build in milestones. After each: run the full build and all tests, fix everything, update STATUS.md, commit and push.
3. Never mark anything as working unless a test or a real run proves it. No fake logic or placeholder functions.
4. Production quality only. The contract must be careful with money. The UI must look like a real fintech product.
5. Use no dashes of any kind in user facing text, docs or code comments. Use commas, periods or the word to.
6. If blocked for more than 30 minutes, record the blocker in STATUS.md, pick the simplest workable alternative, note it in DECISIONS.md and move on.
7. When you hit a request limit, write exactly what is done and what is next in STATUS.md before stopping.

THE PRODUCT
Ajo Circles is an onchain rotating savings group on Solana (called ajo or esusu in Nigeria, susu, tanda, hui or chit fund elsewhere). A group agrees on an amount, everyone pays in each period, one member takes the whole pot each round, and the turn rotates. Members lock a deposit when they join, sized by their turn because early turns carry more risk: deposit for slot s equals contribution times max(1, max_members minus 1 minus s). If a member misses a payment, anyone can trigger a cover from that member's deposit so the person receiving the pot is never short. Unused deposits are returned at the end. Completed circles build an onchain Ajo Score that any app can read. Users never see crypto jargon: they see pot, your turn, deposit and next payment.

GOAL
Win the Colosseum Crypto World's Fair grand prize and the Solana track. Submissions close Oct 12, 2026 at 11:59pm Pacific. Treat Oct 11 as the real deadline.

JUDGING (EQUAL WEIGHT)
1. Functionality and code quality: works end to end on devnet, deep tests, clean code, security notes.
2. Impact and market size: use only sourced statistics and mark estimates as estimates.
3. Novelty: slot based deposits that price turn risk, automatic default cover, the Ajo Score.
4. UX with blockchain: a normal person uses it with no crypto knowledge, joins from a WhatsApp shared link, never needs to hold SOL.
5. Open source and composability: clean program, TypeScript SDK, published IDL, documented accounts and events.
6. Business plan: simple, believable, with unit economics.

STACK
Anchor 0.31.x program, USDC (own test mint on devnet), Next.js app router with TypeScript, Tailwind, shadcn, Framer Motion and Solana wallet adapter, a TypeScript SDK package, Anchor tests with a movable clock, program on devnet, app on Vercel.

MILESTONE A: CONTRACT (DONE, VERIFY ONLY)
All instructions exist: init_config, create_circle, join_circle, contribute, cancel_circle, refund_deposit, settle_default, claim_payout, claim_forfeit_share, withdraw_deposit, finalize_score. 12 tests pass including default, walkaway, shortfall, forfeit, attack, boundary, invariant and score cases. Three bugs were found and fixed (payout replay error order, forfeit share using a shrinking pool, fee overflow). Keep every test.

NEXT: MILESTONE A2, DEVNET DEPLOY
1. Deploy to devnet. If the airdrop is rate limited, use the Solana devnet faucet website and do not loop retries.
2. Record the program address in README.md and STATUS.md.
3. Write scripts that create a test USDC mint, fund test wallets, and run a real create circle and join circle transaction on devnet. Do not claim devnet works until a real transaction succeeds.

MILESTONE B: SDK
A TypeScript package in sdk/ with a client method for every instruction, helpers to derive every PDA, calculate the slot deposit, fetch and decode accounts, list members, compute the next deadline, decode events from logs and read any wallet's Ajo Score. Include a 5 line integration example in the README that reads a wallet's circles, next payment due and Ajo Score, and make sure it runs in a fresh project. Publish the IDL and types in the repo. Add unit tests for the deposit math and PDA derivation.

MILESTONE C: WEB APP
Design: warm, trustworthy African fintech. Colors: paper background F6F0E4, deep green 0F3D2E, gold E3A72F, terracotta C4532D, ink 1B1B18, plus a dark mode with the same character. Fraunces for headings, Inter for body, big confident numbers for money. Signature visual: an SVG ring of member avatars around a central pot showing whose turn it is, who paid, who missed and the countdown, animated gently on pay and payout. A subtle Adire or Ankara inspired pattern as dividers. Mobile first at 390px. Real loading, empty and error states, with every contract error mapped to a friendly sentence. Show USDC with an approximate Naira value labeled "about", with the rate from an environment variable. Respect reduced motion.
Screens: landing with live stats read from chain; create circle wizard ending with an invite link, copy button and a Share on WhatsApp button; join circle from the invite link with open slots and their deposits explained in plain words; circle page with the ring, countdown, one big next action button, payout timeline, member list with paid and missed badges and Ajo Scores, and a live activity feed from chain events; my circles dashboard; a Cover this payment action for missed payments; a completion screen with Withdraw my deposit and Update my Ajo Score; an Ajo Score profile page; an explorer of open circles if time allows.
UX rules: no wallet jargon, friendly transaction progress steps and toasts, a Get test money button that sends devnet test USDC and a little SOL with rate limiting, invite links that work on mobile and offer a wallet app deep link, accessibility with keyboard support and an aria text alternative for the ring, good performance, and a configurable RPC with graceful handling when it is slow.

MILESTONE D: POLISH AND PROOF
Run a full cycle on devnet through the real app with several wallets including a covered default and fix every bug. Test at phone size and in dark mode and capture screenshots. Add an end to end browser test or a written manual test script. Stretch goals in this order only after everything works and is deployed: a Solana Action so the invite can be joined from a link on X, fee sponsorship so users never need SOL, email or social login with an embedded wallet, then yield on idle funds only if fully tested. Deploy the app to Vercel with a .env.example documenting every variable.

MILESTONE E: DOCS AND SUBMISSION
README with a two sentence summary, screenshot, quick start under 5 minutes, devnet address, live link and the SDK example. docs/ARCHITECTURE.md with accounts, instructions, the deposit formula with a worked example, the default flow, the Ajo Score design and a diagram. docs/SECURITY.md with the threat model, what the admin can and cannot do, the tested invariants and an honest note that the program is unaudited. docs/BUSINESS.md under two pages: problem, sourced market size, revenue model (a small fee on each payout, later yield share, premium circles and Ajo Score lookups), first market Nigeria through communities and workplaces spread by WhatsApp, unit economics with a worked example, and risks. docs/PITCH.md with a 2 minute video script with timings that shows the live product within 20 seconds, a covered default and the Ajo Score. docs/DEMO_SHOTLIST.md with every shot. docs/SUBMISSION.md with ready to paste text for every Colosseum field and draft accelerator answers. scripts/demo.ts that creates a fast demo circle on devnet with 5 funded test wallets and a short period so a full cycle with a covered default can be recorded in minutes.

SCHEDULE
Sun Oct 4: devnet deploy and start the SDK. Mon Oct 5: SDK done, app scaffold and landing page. Tue Oct 6: create and join flows. Wed Oct 7: circle page, ring, contribute, claim, activity feed. Thu Oct 8: default handling, dashboard, completion, Ajo Score page, test money button. Fri Oct 9: polish, mobile testing, deploy to Vercel. Sat Oct 10: stretch goals and record the demo. Sun Oct 11: docs, video edit, submit. Mon Oct 12: buffer only. If behind, cut the explorer, then stretch goals, then the Ajo Score page. Never cut tests, the ring, the default cover demo or the docs.

DEFINITION OF DONE
Anyone can open the live link on a phone, connect a wallet, get test money, create a circle, invite others and finish a full cycle on devnet including a covered default. All tests pass. The SDK example works in a fresh project. The UI looks excellent on phone and laptop in light and dark mode. All docs are complete with no dashes. STATUS.md is honest and current.