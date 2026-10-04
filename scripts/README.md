# Scripts

Run the devnet smoke flow from the repository root after setting `ANCHOR_PROVIDER_URL` to `https://api.devnet.solana.com` and `ANCHOR_WALLET` to a funded signer, then run `pnpm devnet:smoke`.

The script creates a six decimal test mint, funds three saved test wallets, initializes configuration when needed, creates a circle, initializes its vaults, and joins the wallets. It verifies the final member count and prints recent transaction signatures. Saved wallet keys and setup state stay in the ignored `.devnet` directory.

The confirmed program address is `B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw`. The current smoke mint is `9qGJsamQ8irgapMSmEoR525GhD7DH4tFMsbtfUNHEvdb`, and the current smoke circle is `CU8i9Yg43chjyRL6qHbFcmoBXvvpoWKnxSb1V747KVpH`.
