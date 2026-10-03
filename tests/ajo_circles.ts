import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AjoCircles } from "../target/types/ajo_circles.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  calculateDeposit,
  deriveCircle,
  deriveConfig,
  nextDeadline,
} from "../sdk/src/index.js";

describe("ajo_circles", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.AjoCircles as Program<AjoCircles>;
  const payer = provider.wallet.payer!;
  const decimals = 6;
  const contribution = 10_000_000;
  let mint: PublicKey;
  let treasury: PublicKey;
  let config: PublicKey;
  const members = Array.from({ length: 5 }, () => Keypair.generate());

  const circlePda = (creator: PublicKey, circleId: number) =>
    PublicKey.findProgramAddressSync(
      [
        Buffer.from("circle"),
        creator.toBuffer(),
        new anchor.BN(circleId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];
  const memberPda = (circle: PublicKey, wallet: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("member"), circle.toBuffer(), wallet.toBuffer()],
      program.programId
    )[0];
  const vaultPda = (seed: string, circle: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from(seed), circle.toBuffer()],
      program.programId
    )[0];
  const scorePda = (wallet: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("score"), wallet.toBuffer()],
      program.programId
    )[0];

  async function fund(wallet: Keypair, amount: number) {
    const signature = await provider.connection.requestAirdrop(
      wallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature, "confirmed");
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mint,
      wallet.publicKey
    );
    await mintTo(provider.connection, payer, mint, ata.address, payer, amount);
    return ata.address;
  }

  async function createAndPrepareCircle(
    circleId: number,
    maxMembers = 5,
    periodSecs = 60
  ) {
    const circle = circlePda(provider.wallet.publicKey, circleId);
    const potVault = vaultPda("pot", circle);
    const depositVault = vaultPda("deposit", circle);
    await program.methods
      .createCircle(
        new anchor.BN(circleId),
        `Circle ${circleId}`,
        new anchor.BN(contribution),
        new anchor.BN(periodSecs),
        maxMembers
      )
      .accountsPartial({
        creator: provider.wallet.publicKey,
        config,
        mint,
        circle,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    await program.methods
      .initializePotVault()
      .accountsPartial({
        creator: provider.wallet.publicKey,
        circle,
        mint,
        potVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    await program.methods
      .initializeDepositVault()
      .accountsPartial({
        creator: provider.wallet.publicKey,
        circle,
        mint,
        depositVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return { circle, potVault, depositVault };
  }

  before(async () => {
    mint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      decimals
    );
    treasury = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        mint,
        payer.publicKey
      )
    ).address;
    config = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    )[0];
    await program.methods
      .initConfig(50, new anchor.BN(1))
      .accountsPartial({
        admin: provider.wallet.publicKey,
        config,
        mint,
        treasury,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    for (const member of members) {
      await fund(member, 100 * 10 ** decimals);
    }
  });

  it("loads the Ajo Circles program", () => {
    if (
      program.programId.toBase58() !==
      "B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw"
    ) {
      throw new Error(
        "The loaded program id does not match the configured program"
      );
    }
  });

  it("calculates slot deposits and deterministic addresses", () => {
    if (calculateDeposit(10_000_000n, 5, 0) !== 40_000_000n) {
      throw new Error("Early slot deposit formula is incorrect");
    }
    if (calculateDeposit(10_000_000n, 5, 4) !== 10_000_000n) {
      throw new Error("Late slot deposit floor is incorrect");
    }
    const expectedConfig = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    )[0];
    if (!deriveConfig(program.programId).equals(expectedConfig)) {
      throw new Error("Config PDA derivation is incorrect");
    }
    if (
      !deriveCircle(program.programId, provider.wallet.publicKey, 9).equals(
        circlePda(provider.wallet.publicKey, 9)
      )
    ) {
      throw new Error("Circle PDA derivation is incorrect");
    }
    if (nextDeadline(100n, 60n) !== 160n) {
      throw new Error("Deadline calculation is incorrect");
    }
  });

  it("runs a complete five member circle and records scores", async () => {
    const { circle, potVault, depositVault } = await createAndPrepareCircle(1);
    for (let slot = 0; slot < members.length; slot += 1) {
      const wallet = members[slot];
      await program.methods
        .joinCircle(slot)
        .accountsPartial({
          wallet: wallet.publicKey,
          config,
          circle,
          member: memberPda(circle, wallet.publicKey),
          source: getAssociatedTokenAddressSync(mint, wallet.publicKey),
          depositVault,
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
        .rpc();
    }
    for (let round = 0; round < members.length; round += 1) {
      for (const wallet of members) {
        await program.methods
          .contribute()
          .accountsPartial({
            wallet: wallet.publicKey,
            config,
            circle,
            member: memberPda(circle, wallet.publicKey),
            source: getAssociatedTokenAddressSync(mint, wallet.publicKey),
            potVault,
            mint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([wallet])
          .rpc();
      }
      const recipient = members[round];
      await program.methods
        .claimPayout()
        .accountsPartial({
          caller: provider.wallet.publicKey,
          config,
          circle,
          recipientMember: memberPda(circle, recipient.publicKey),
          recipientWallet: recipient.publicKey,
          potVault,
          treasury,
          mint,
          recipientTokenAccount: getAssociatedTokenAddressSync(
            mint,
            recipient.publicKey
          ),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }
    const finalCircle = await program.account.circle.fetch(circle);
    if (
      finalCircle.status.completed === undefined ||
      finalCircle.totalPaidOut.isZero()
    ) {
      throw new Error("Circle did not complete");
    }
    for (const wallet of members) {
      await program.methods
        .withdrawDeposit()
        .accountsPartial({
          wallet: wallet.publicKey,
          circle,
          member: memberPda(circle, wallet.publicKey),
          depositVault,
          destination: getAssociatedTokenAddressSync(mint, wallet.publicKey),
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([wallet])
        .rpc();
      await program.methods
        .finalizeScore()
        .accountsPartial({
          caller: provider.wallet.publicKey,
          circle,
          member: memberPda(circle, wallet.publicKey),
          score: scorePda(wallet.publicKey),
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }
    const pot = await getAccount(provider.connection, potVault);
    const deposits = await getAccount(provider.connection, depositVault);
    if (pot.amount !== 0n || deposits.amount !== 0n) {
      throw new Error("Vaults were not emptied");
    }
  });

  it("covers a missed payment from the member deposit", async () => {
    const { circle, potVault, depositVault } = await createAndPrepareCircle(
      2,
      3,
      1
    );
    const three = members.slice(0, 3);
    for (let slot = 0; slot < three.length; slot += 1) {
      const wallet = three[slot];
      await program.methods
        .joinCircle(slot)
        .accountsPartial({
          wallet: wallet.publicKey,
          config,
          circle,
          member: memberPda(circle, wallet.publicKey),
          source: getAssociatedTokenAddressSync(mint, wallet.publicKey),
          depositVault,
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
        .rpc();
    }
    for (const wallet of three.slice(1)) {
      await program.methods
        .contribute()
        .accountsPartial({
          wallet: wallet.publicKey,
          config,
          circle,
          member: memberPda(circle, wallet.publicKey),
          source: getAssociatedTokenAddressSync(mint, wallet.publicKey),
          potVault,
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([wallet])
        .rpc();
    }
    await new Promise((resolve) => setTimeout(resolve, 1800));
    await program.methods
      .settleDefault()
      .accountsPartial({
        caller: provider.wallet.publicKey,
        circle,
        member: memberPda(circle, three[0].publicKey),
        depositVault,
        potVault,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    const member = await program.account.member.fetch(
      memberPda(circle, three[0].publicKey)
    );
    if (
      member.defaults !== 1 ||
      member.depositRemaining.gte(member.depositTotal)
    ) {
      throw new Error("Default was not covered from deposit");
    }
  });

  it("refunds deposits after cancellation", async () => {
    const { circle, depositVault } = await createAndPrepareCircle(3, 3);
    const wallet = members[0];
    await program.methods
      .joinCircle(0)
      .accountsPartial({
        wallet: wallet.publicKey,
        config,
        circle,
        member: memberPda(circle, wallet.publicKey),
        source: getAssociatedTokenAddressSync(mint, wallet.publicKey),
        depositVault,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();
    const before = (
      await getAccount(
        provider.connection,
        getAssociatedTokenAddressSync(mint, wallet.publicKey)
      )
    ).amount;
    await program.methods
      .cancelCircle()
      .accountsPartial({ creator: provider.wallet.publicKey, circle })
      .rpc();
    await program.methods
      .refundDeposit()
      .accountsPartial({
        wallet: wallet.publicKey,
        circle,
        member: memberPda(circle, wallet.publicKey),
        depositVault,
        destination: getAssociatedTokenAddressSync(mint, wallet.publicKey),
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet])
      .rpc();
    const after = (
      await getAccount(
        provider.connection,
        getAssociatedTokenAddressSync(mint, wallet.publicKey)
      )
    ).amount;
    if (after <= before) throw new Error("Deposit was not refunded");
  });
});
