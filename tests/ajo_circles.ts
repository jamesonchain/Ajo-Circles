import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AjoCircles } from "../target/types/ajo_circles.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
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
  const members = Array.from({ length: 12 }, () => Keypair.generate());

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
    periodSecs = 60,
    circleContribution: number | bigint = contribution
  ) {
    const circle = circlePda(provider.wallet.publicKey, circleId);
    const potVault = vaultPda("pot", circle);
    const depositVault = vaultPda("deposit", circle);
    await program.methods
      .createCircle(
        new anchor.BN(circleId),
        `Circle ${circleId}`,
        new anchor.BN(circleContribution.toString()),
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

  async function createActiveCircle(
    circleId: number,
    maxMembers = 3,
    periodSecs = 60,
    circleContribution: number | bigint = contribution
  ) {
    const prepared = await createAndPrepareCircle(
      circleId,
      maxMembers,
      periodSecs,
      circleContribution
    );
    const circleMembers = members.slice(0, maxMembers);
    for (let slot = 0; slot < circleMembers.length; slot += 1) {
      await join(
        prepared.circle,
        prepared.depositVault,
        circleMembers[slot],
        slot
      );
    }
    return { ...prepared, members: circleMembers };
  }

  async function join(
    circle: PublicKey,
    depositVault: PublicKey,
    wallet: Keypair,
    slot: number,
    mintOverride = mint,
    sourceOverride = getAssociatedTokenAddressSync(mint, wallet.publicKey),
    vaultOverride = depositVault
  ) {
    await program.methods
      .joinCircle(slot)
      .accountsPartial({
        wallet: wallet.publicKey,
        config,
        circle,
        member: memberPda(circle, wallet.publicKey),
        source: sourceOverride,
        depositVault: vaultOverride,
        mint: mintOverride,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();
  }

  async function contribute(
    circle: PublicKey,
    potVault: PublicKey,
    wallet: Keypair,
    sourceOverride = getAssociatedTokenAddressSync(mint, wallet.publicKey),
    vaultOverride = potVault
  ) {
    return program.methods
      .contribute()
      .accountsPartial({
        wallet: wallet.publicKey,
        config,
        circle,
        member: memberPda(circle, wallet.publicKey),
        source: sourceOverride,
        potVault: vaultOverride,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet])
      .rpc();
  }

  async function settleDefault(
    circle: PublicKey,
    depositVault: PublicKey,
    potVault: PublicKey,
    wallet: Keypair
  ) {
    return program.methods
      .settleDefault()
      .accountsPartial({
        caller: provider.wallet.publicKey,
        circle,
        member: memberPda(circle, wallet.publicKey),
        depositVault,
        potVault,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  async function claim(
    circle: PublicKey,
    potVault: PublicKey,
    depositVault: PublicKey,
    wallet: Keypair,
    caller = provider.wallet.publicKey,
    recipientTokenAccount = getAssociatedTokenAddressSync(
      mint,
      wallet.publicKey
    )
  ) {
    return program.methods
      .claimPayout()
      .accountsPartial({
        caller,
        config,
        circle,
        recipientMember: memberPda(circle, wallet.publicKey),
        recipientWallet: wallet.publicKey,
        potVault,
        depositVault,
        treasury,
        mint,
        recipientTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async function advanceClock(seconds = 2) {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000 + 500));
  }

  async function expectError(action: () => Promise<unknown>, code: string) {
    try {
      await action();
    } catch (error) {
      const text = JSON.stringify(error);
      if (text.includes(code)) return;
      throw new Error(`Expected ${code}, received ${text}`);
    }
    throw new Error(`Expected ${code}, but the transaction succeeded`);
  }

  async function readEvent(signature: string, eventName: string) {
    let tx = null;
    for (let attempt = 0; attempt < 5 && !tx; attempt += 1) {
      tx = await provider.connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!tx?.meta?.logMessages) throw new Error("Transaction logs unavailable");
    const parser = new anchor.EventParser(program.programId, program.coder);
    for (const event of parser.parseLogs(tx.meta.logMessages)) {
      if (event.name.toLowerCase() === eventName.toLowerCase()) {
        return event.data as Record<string, any>;
      }
    }
    throw new Error(`Event ${eventName} was not emitted`);
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
      await fund(member, 1_000 * 10 ** decimals);
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

  it("runs a complete five member circle, records scores, and checks conservation", async () => {
    const { circle, potVault, depositVault } = await createAndPrepareCircle(1);
    const circleMembers = members.slice(0, 5);
    const treasuryBefore = (await getAccount(provider.connection, treasury))
      .amount;
    let totalIn = 0n;
    let previousOut = 0n;
    const assertConservation = async () => {
      const pot = (await getAccount(provider.connection, potVault)).amount;
      const deposits = (await getAccount(provider.connection, depositVault))
        .amount;
      if (pot + deposits > totalIn) {
        throw new Error("Vault balances exceed tokens ever put in");
      }
      const totalOut = totalIn - pot - deposits;
      if (totalOut < previousOut || pot + deposits + totalOut !== totalIn) {
        throw new Error("Token conservation invariant failed");
      }
      previousOut = totalOut;
    };
    for (let slot = 0; slot < circleMembers.length; slot += 1) {
      const wallet = circleMembers[slot];
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
      totalIn += calculateDeposit(contribution, circleMembers.length, slot);
      await assertConservation();
    }
    for (let round = 0; round < circleMembers.length; round += 1) {
      for (const wallet of circleMembers) {
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
        totalIn += BigInt(contribution);
        await assertConservation();
      }
      const recipient = circleMembers[round];
      await program.methods
        .claimPayout()
        .accountsPartial({
          caller: provider.wallet.publicKey,
          config,
          circle,
          recipientMember: memberPda(circle, recipient.publicKey),
          recipientWallet: recipient.publicKey,
          potVault,
          depositVault,
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
      await assertConservation();
    }
    const finalCircle = await program.account.circle.fetch(circle);
    if (
      finalCircle.status.completed === undefined ||
      finalCircle.totalPaidOut.isZero()
    ) {
      throw new Error("Circle did not complete");
    }
    for (const wallet of circleMembers) {
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
      const score = await program.account.ajoScore.fetch(
        scorePda(wallet.publicKey)
      );
      if (score.circlesCompleted !== 1 || score.circlesJoined !== 1) {
        throw new Error("Score was not finalized correctly");
      }
      if (wallet === members[0]) {
        let replayRejected = false;
        try {
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
        } catch {
          replayRejected = true;
        }
        if (!replayRejected) throw new Error("Score replay was accepted");
      }
    }
    const pot = await getAccount(provider.connection, potVault);
    const deposits = await getAccount(provider.connection, depositVault);
    if (pot.amount !== 0n || deposits.amount !== 0n) {
      throw new Error("Vaults were not emptied");
    }
    const treasuryAfter = (await getAccount(provider.connection, treasury))
      .amount;
    const expectedFees =
      (BigInt(contribution * circleMembers.length * circleMembers.length) *
        50n) /
      10_000n;
    if (treasuryAfter - treasuryBefore !== expectedFees) {
      throw new Error("Treasury fee total is incorrect");
    }
  });

  it("covers a missed payment from the member deposit", async () => {
    const { circle, potVault, depositVault } = await createAndPrepareCircle(
      2,
      3,
      10
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
    await advanceClock(11);
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

  it("settles a full default and pays the recipient the available pot", async () => {
    const { circle, potVault, depositVault } = await createAndPrepareCircle(
      4,
      3,
      10
    );
    const three = members.slice(0, 3);
    for (let slot = 0; slot < three.length; slot += 1) {
      await join(circle, depositVault, three[slot], slot);
    }
    await contribute(circle, potVault, three[0]);
    await contribute(circle, potVault, three[1]);
    await advanceClock(11);
    const beforeDeposit = (
      await program.account.member.fetch(memberPda(circle, three[2].publicKey))
    ).depositRemaining;
    await settleDefault(circle, depositVault, potVault, three[2]);
    const afterDeposit = (
      await program.account.member.fetch(memberPda(circle, three[2].publicKey))
    ).depositRemaining;
    if (beforeDeposit.sub(afterDeposit).toNumber() !== contribution) {
      throw new Error("Default did not consume exactly one contribution");
    }
    const potBefore = (await getAccount(provider.connection, potVault)).amount;
    const recipientBefore = (
      await getAccount(
        provider.connection,
        getAssociatedTokenAddressSync(mint, three[0].publicKey)
      )
    ).amount;
    const treasuryBefore = (await getAccount(provider.connection, treasury))
      .amount;
    const signature = await claim(circle, potVault, depositVault, three[0]);
    await expectError(
      () => claim(circle, potVault, depositVault, three[0]),
      "PayoutAlreadyClaimed"
    );
    const payoutEvent = await readEvent(signature, "PayoutClaimed");
    const recipientAfter = (
      await getAccount(
        provider.connection,
        getAssociatedTokenAddressSync(mint, three[0].publicKey)
      )
    ).amount;
    const treasuryAfter = (await getAccount(provider.connection, treasury))
      .amount;
    const fee = (potBefore * 50n) / 10_000n;
    if (recipientAfter - recipientBefore !== potBefore - fee) {
      throw new Error("Recipient did not receive the full available pot");
    }
    if (treasuryAfter - treasuryBefore !== fee) {
      throw new Error("Default payout fee was incorrect");
    }
    if (payoutEvent.amount.toString() !== (potBefore - fee).toString()) {
      throw new Error("Payout event amount was incorrect");
    }
  });

  it("covers every remaining round after an early slot walkaway", async () => {
    const { circle, potVault, depositVault } = await createAndPrepareCircle(
      5,
      3,
      10
    );
    const three = members.slice(0, 3);
    for (let slot = 0; slot < three.length; slot += 1) {
      await join(circle, depositVault, three[slot], slot);
    }
    for (const wallet of three) await contribute(circle, potVault, wallet);
    await claim(circle, potVault, depositVault, three[0]);
    let remaining = (
      await program.account.member.fetch(memberPda(circle, three[0].publicKey))
    ).depositRemaining;
    for (const recipient of [three[1], three[2]]) {
      await contribute(circle, potVault, three[1]);
      await contribute(circle, potVault, three[2]);
      await advanceClock(11);
      await settleDefault(circle, depositVault, potVault, three[0]);
      const updated = (
        await program.account.member.fetch(
          memberPda(circle, three[0].publicKey)
        )
      ).depositRemaining;
      if (remaining.sub(updated).toNumber() !== contribution) {
        throw new Error(
          "Walkaway deposit did not cover exactly one contribution"
        );
      }
      remaining = updated;
      await claim(circle, potVault, depositVault, recipient);
    }
    const walkedAway = await program.account.member.fetch(
      memberPda(circle, three[0].publicKey)
    );
    const otherMembers = await Promise.all(
      three
        .slice(1)
        .map((wallet) =>
          program.account.member.fetch(memberPda(circle, wallet.publicKey))
        )
    );
    const finalCircle = await program.account.circle.fetch(circle);
    if (
      walkedAway.defaults !== 2 ||
      !walkedAway.depositRemaining.isZero() ||
      (finalCircle.shortfallTotal !== undefined &&
        !finalCircle.shortfallTotal.isZero()) ||
      otherMembers.some((member) => member.defaults !== 0)
    ) {
      throw new Error("Early walkaway was not fully covered");
    }
  });

  it("records a shortfall and pays exactly the available pot less its fee", async () => {
    const { circle, potVault, depositVault } = await createAndPrepareCircle(
      6,
      3,
      10
    );
    const three = members.slice(0, 3);
    for (let slot = 0; slot < three.length; slot += 1) {
      await join(circle, depositVault, three[slot], slot);
    }
    for (let round = 0; round < 3; round += 1) {
      await contribute(circle, potVault, three[1]);
      await contribute(circle, potVault, three[2]);
      await advanceClock(11);
      const signature = await settleDefault(
        circle,
        depositVault,
        potVault,
        three[0]
      );
      if (round === 2) {
        const event = await readEvent(signature, "DefaultSettled");
        if (event.shortfall.toString() !== contribution.toString()) {
          throw new Error("Shortfall event amount was incorrect");
        }
        const potBefore = (await getAccount(provider.connection, potVault))
          .amount;
        const recipientBefore = (
          await getAccount(
            provider.connection,
            getAssociatedTokenAddressSync(mint, three[2].publicKey)
          )
        ).amount;
        const treasuryBefore = (await getAccount(provider.connection, treasury))
          .amount;
        const payoutSignature = await claim(
          circle,
          potVault,
          depositVault,
          three[2]
        );
        const recipientAfter = (
          await getAccount(
            provider.connection,
            getAssociatedTokenAddressSync(mint, three[2].publicKey)
          )
        ).amount;
        const treasuryAfter = (await getAccount(provider.connection, treasury))
          .amount;
        const fee = (potBefore * 50n) / 10_000n;
        const payout = recipientAfter - recipientBefore;
        const payoutEvent = await readEvent(payoutSignature, "PayoutClaimed");
        if (
          payout !== potBefore - fee ||
          treasuryAfter - treasuryBefore !== fee ||
          payout + (treasuryAfter - treasuryBefore) !== potBefore ||
          payoutEvent.amount.toString() !== payout.toString()
        ) {
          throw new Error(
            "Shortfall payout did not reconcile to the pot balance"
          );
        }
      } else {
        await claim(circle, potVault, depositVault, three[round]);
      }
    }
    const finalCircle = await program.account.circle.fetch(circle);
    if (finalCircle.shortfallTotal.toNumber() !== contribution) {
      throw new Error("Shortfall was not recorded on the circle");
    }
  });

  it("reserves forfeited payouts and splits them without dust", async () => {
    const { circle, potVault, depositVault } = await createAndPrepareCircle(
      7,
      4,
      10
    );
    const four = members.slice(0, 4);
    for (let slot = 0; slot < four.length; slot += 1) {
      await join(circle, depositVault, four[slot], slot);
    }
    for (let round = 0; round < four.length; round += 1) {
      for (const wallet of four.slice(1)) {
        await contribute(circle, potVault, wallet);
      }
      await advanceClock(11);
      await settleDefault(circle, depositVault, potVault, four[0]);
      await claim(
        circle,
        potVault,
        depositVault,
        round === 0 ? four[0] : four[round]
      );
    }
    const completed = await program.account.circle.fetch(circle);
    const expectedPool = BigInt(contribution * 4);
    if (completed.forfeitPool.toString() !== expectedPool.toString()) {
      throw new Error("Forfeited payout was not reserved");
    }
    await expectError(
      () =>
        program.methods
          .claimForfeitShare()
          .accountsPartial({
            caller: provider.wallet.publicKey,
            circle,
            member: memberPda(circle, four[0].publicKey),
            depositVault,
            destination: getAssociatedTokenAddressSync(mint, four[0].publicKey),
            mint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc(),
      "NoForfeitShare"
    );
    const defaultedBalance = (
      await getAccount(
        provider.connection,
        getAssociatedTokenAddressSync(mint, four[0].publicKey)
      )
    ).amount;
    let claimed = 0n;
    for (let index = 1; index < four.length; index += 1) {
      const wallet = four[index];
      const before = (
        await getAccount(
          provider.connection,
          getAssociatedTokenAddressSync(mint, wallet.publicKey)
        )
      ).amount;
      await program.methods
        .claimForfeitShare()
        .accountsPartial({
          caller: provider.wallet.publicKey,
          circle,
          member: memberPda(circle, wallet.publicKey),
          depositVault,
          destination: getAssociatedTokenAddressSync(mint, wallet.publicKey),
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      const after = (
        await getAccount(
          provider.connection,
          getAssociatedTokenAddressSync(mint, wallet.publicKey)
        )
      ).amount;
      claimed += after - before;
      const expectedShare = expectedPool / 3n + (index === 1 ? 1n : 0n);
      if (after - before !== expectedShare) {
        throw new Error(
          "Eligible member received an incorrect forfeiture share"
        );
      }
    }
    const defaultedBalanceAfter = (
      await getAccount(
        provider.connection,
        getAssociatedTokenAddressSync(mint, four[0].publicKey)
      )
    ).amount;
    const afterCircle = await program.account.circle.fetch(circle);
    if (
      claimed !== expectedPool ||
      !afterCircle.forfeitPool.isZero() ||
      defaultedBalanceAfter !== defaultedBalance
    ) {
      throw new Error("Forfeit shares were overpaid or left dust");
    }
  });

  it("rejects the section 5.5 attack matrix with exact errors", async () => {
    const active = await createActiveCircle(8, 3, 60);
    const alternateMint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      decimals
    );
    const wrongMintSource = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        alternateMint,
        active.members[0].publicKey
      )
    ).address;
    await expectError(
      () =>
        contribute(
          active.circle,
          active.potVault,
          active.members[0],
          wrongMintSource
        ),
      "MintMismatch"
    );
    await expectError(
      () =>
        contribute(
          active.circle,
          active.potVault,
          active.members[0],
          undefined,
          active.depositVault
        ),
      "ConstraintSeeds"
    );
    await contribute(active.circle, active.potVault, active.members[0]);
    await expectError(
      () => contribute(active.circle, active.potVault, active.members[0]),
      "AlreadyPaid"
    );
    await expectError(
      () =>
        settleDefault(
          active.circle,
          active.depositVault,
          active.potVault,
          active.members[2]
        ),
      "DeadlineNotPassed"
    );

    const taken = await createAndPrepareCircle(9, 3, 60);
    await join(taken.circle, taken.depositVault, members[0], 0);
    await expectError(
      () => join(taken.circle, taken.depositVault, members[1], 0),
      "SlotTaken"
    );
    await expectError(
      () =>
        program.methods
          .withdrawDeposit()
          .accountsPartial({
            wallet: members[0].publicKey,
            circle: taken.circle,
            member: memberPda(taken.circle, members[0].publicKey),
            depositVault: taken.depositVault,
            destination: getAssociatedTokenAddressSync(
              mint,
              members[0].publicKey
            ),
            mint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([members[0]])
          .rpc(),
      "CircleNotCompleted"
    );
    await expectError(
      () =>
        program.methods
          .contribute()
          .accountsPartial({
            wallet: members[1].publicKey,
            config,
            circle: taken.circle,
            member: memberPda(taken.circle, members[0].publicKey),
            source: getAssociatedTokenAddressSync(mint, members[1].publicKey),
            potVault: vaultPda("pot", taken.circle),
            mint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([members[1]])
          .rpc(),
      "ConstraintSeeds"
    );

    const expired = await createActiveCircle(10, 3, 1);
    await advanceClock();
    await expectError(
      () => contribute(expired.circle, expired.potVault, expired.members[0]),
      "DeadlinePassed"
    );

    const alreadyPaid = await createActiveCircle(11, 3, 1);
    await contribute(
      alreadyPaid.circle,
      alreadyPaid.potVault,
      alreadyPaid.members[0]
    );
    await advanceClock();
    await expectError(
      () =>
        settleDefault(
          alreadyPaid.circle,
          alreadyPaid.depositVault,
          alreadyPaid.potVault,
          alreadyPaid.members[0]
        ),
      "AlreadySettled"
    );

    const payout = await createActiveCircle(12, 3, 60);
    for (const wallet of payout.members) {
      await contribute(payout.circle, payout.potVault, wallet);
    }
    await expectError(
      () =>
        claim(
          payout.circle,
          payout.potVault,
          payout.depositVault,
          payout.members[0],
          provider.wallet.publicKey,
          getAssociatedTokenAddressSync(mint, payout.members[1].publicKey)
        ),
      "ConstraintTokenOwner"
    );
    await claim(
      payout.circle,
      payout.potVault,
      payout.depositVault,
      payout.members[0]
    );
    await expectError(
      () =>
        claim(
          payout.circle,
          payout.potVault,
          payout.depositVault,
          payout.members[0]
        ),
      "PayoutAlreadyClaimed"
    );

    const completed = await createActiveCircle(13, 3, 60);
    for (let round = 0; round < completed.members.length; round += 1) {
      for (const wallet of completed.members) {
        await contribute(completed.circle, completed.potVault, wallet);
      }
      await claim(
        completed.circle,
        completed.potVault,
        completed.depositVault,
        completed.members[round]
      );
    }
    const wallet = completed.members[0];
    const withdrawal = {
      wallet: wallet.publicKey,
      circle: completed.circle,
      member: memberPda(completed.circle, wallet.publicKey),
      depositVault: completed.depositVault,
      destination: getAssociatedTokenAddressSync(mint, wallet.publicKey),
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
    };
    await program.methods
      .withdrawDeposit()
      .accountsPartial(withdrawal)
      .signers([wallet])
      .rpc();
    await expectError(
      () =>
        program.methods
          .withdrawDeposit()
          .accountsPartial(withdrawal)
          .signers([wallet])
          .rpc(),
      "DepositAlreadyWithdrawn"
    );
  });

  it("covers member, period, contribution, and zero-fee boundaries", async () => {
    const minimum = await createAndPrepareCircle(20, 3, 1, 1);
    const minimumCircle = await program.account.circle.fetch(minimum.circle);
    if (
      minimumCircle.periodSecs.toNumber() !== 1 ||
      minimumCircle.maxMembers !== 3
    ) {
      throw new Error("Minimum period or member count boundary was rejected");
    }
    const zeroFee = await createActiveCircle(22, 3, 60, 1);
    const treasuryBefore = (await getAccount(provider.connection, treasury))
      .amount;
    for (const wallet of zeroFee.members) {
      await contribute(zeroFee.circle, zeroFee.potVault, wallet);
    }
    const smallestPot = (
      await getAccount(provider.connection, zeroFee.potVault)
    ).amount;
    const recipientBefore = (
      await getAccount(
        provider.connection,
        getAssociatedTokenAddressSync(mint, zeroFee.members[0].publicKey)
      )
    ).amount;
    await claim(
      zeroFee.circle,
      zeroFee.potVault,
      zeroFee.depositVault,
      zeroFee.members[0]
    );
    const recipientAfter = (
      await getAccount(
        provider.connection,
        getAssociatedTokenAddressSync(mint, zeroFee.members[0].publicKey)
      )
    ).amount;
    const treasuryAfter = (await getAccount(provider.connection, treasury))
      .amount;
    if (
      smallestPot !== 3n ||
      recipientAfter - recipientBefore !== smallestPot ||
      treasuryAfter !== treasuryBefore
    ) {
      throw new Error(
        "Smallest contribution did not produce a zero-rounded fee"
      );
    }

    const maximumMemberCircle = await createActiveCircle(23, 12, 60);
    const largestMembers = Array.from({ length: 3 }, () => Keypair.generate());
    for (const wallet of largestMembers) {
      await fund(wallet, 1_000 * 10 ** decimals);
    }
    const currentSupply = (await getMint(provider.connection, mint)).supply;
    const supplyReserve = 1_000_000_000_000n;
    const maximumContribution =
      ((1n << 64n) - 1n - currentSupply - supplyReserve) / 7n;
    const largest = await createAndPrepareCircle(
      21,
      3,
      60,
      maximumContribution
    );
    for (let slot = 0; slot < largestMembers.length; slot += 1) {
      const wallet = largestMembers[slot];
      const source = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      const needed =
        calculateDeposit(maximumContribution, 3, slot) + maximumContribution;
      const currentBalance = (await getAccount(provider.connection, source))
        .amount;
      if (currentBalance < needed) {
        await mintTo(
          provider.connection,
          payer,
          mint,
          source,
          payer,
          needed - currentBalance
        );
      }
      await join(largest.circle, largest.depositVault, wallet, slot);
    }
    for (const wallet of largestMembers) {
      await contribute(largest.circle, largest.potVault, wallet);
    }
    const largestPot = (await getAccount(provider.connection, largest.potVault))
      .amount;
    const largestRecipientBefore = (
      await getAccount(
        provider.connection,
        getAssociatedTokenAddressSync(mint, largestMembers[0].publicKey)
      )
    ).amount;
    const largestTreasuryBefore = (
      await getAccount(provider.connection, treasury)
    ).amount;
    await claim(
      largest.circle,
      largest.potVault,
      largest.depositVault,
      largestMembers[0]
    );
    const largestRecipientAfter = (
      await getAccount(
        provider.connection,
        getAssociatedTokenAddressSync(mint, largestMembers[0].publicKey)
      )
    ).amount;
    const largestTreasuryAfter = (
      await getAccount(provider.connection, treasury)
    ).amount;
    const largestFee = (largestPot * 50n) / 10_000n;
    if (
      largestPot * 50n <= (1n << 64n) - 1n ||
      largestRecipientAfter - largestRecipientBefore !==
        largestPot - largestFee ||
      largestTreasuryAfter - largestTreasuryBefore !== largestFee
    ) {
      throw new Error("Largest contribution payout or fee was not exact");
    }

    const maximumCircle = await program.account.circle.fetch(largest.circle);
    const maximumMemberState = await program.account.circle.fetch(
      maximumMemberCircle.circle
    );
    const largestDepositBalance = (
      await getAccount(provider.connection, largest.depositVault)
    ).amount;
    const maximumDepositBalance = (
      await getAccount(provider.connection, maximumMemberCircle.depositVault)
    ).amount;
    if (
      maximumCircle.memberCount !== 3 ||
      maximumCircle.contribution.toString() !==
        maximumContribution.toString() ||
      largestDepositBalance !== maximumContribution * 4n ||
      maximumMemberState.memberCount !== 12 ||
      maximumMemberState.maxMembers !== 12 ||
      maximumDepositBalance !== BigInt(contribution) * 67n
    ) {
      throw new Error("Maximum member or contribution boundary was not exact");
    }
  });

  it("checks conservation after every step with defaults, shortfalls, and forfeits", async () => {
    for (const memberCount of [3, 5, 12]) {
      const circleId = 30 + memberCount;
      const { circle, potVault, depositVault } = await createAndPrepareCircle(
        circleId,
        memberCount,
        10
      );
      const circleMembers = members.slice(0, memberCount);
      let totalIn = 0n;
      let totalOut = 0n;
      const assertConservation = async () => {
        const pot = (await getAccount(provider.connection, potVault)).amount;
        const deposits = (await getAccount(provider.connection, depositVault))
          .amount;
        if (pot + deposits + totalOut !== totalIn) {
          throw new Error(
            `Token conservation failed for ${memberCount} members: ${pot} + ${deposits} + ${totalOut} != ${totalIn}`
          );
        }
      };
      await assertConservation();
      for (let slot = 0; slot < memberCount; slot += 1) {
        await join(circle, depositVault, circleMembers[slot], slot);
        totalIn += calculateDeposit(contribution, memberCount, slot);
        await assertConservation();
      }

      let expectedForfeitPool = 0n;
      for (let round = 0; round < memberCount; round += 1) {
        for (const wallet of circleMembers.slice(1)) {
          await contribute(circle, potVault, wallet);
          totalIn += BigInt(contribution);
          await assertConservation();
        }
        await advanceClock(11);
        const potBeforeSettlement = (
          await getAccount(provider.connection, potVault)
        ).amount;
        const settlementSignature = await settleDefault(
          circle,
          depositVault,
          potVault,
          circleMembers[0]
        );
        const settlementEvent = await readEvent(
          settlementSignature,
          "DefaultSettled"
        );
        if (
          settlementEvent.covered.toString() !==
          (round < memberCount - 1 ? contribution : 0).toString()
        ) {
          throw new Error(
            "Default coverage did not match the remaining deposit"
          );
        }
        if (
          round === memberCount - 1 &&
          settlementEvent.shortfall.toString() !== contribution.toString()
        ) {
          throw new Error("Final default did not report the exact shortfall");
        }
        await assertConservation();
        if (round === 0) {
          expectedForfeitPool = potBeforeSettlement + BigInt(contribution);
        }

        const recipient = circleMembers[round];
        const recipientTokenAccount = getAssociatedTokenAddressSync(
          mint,
          recipient.publicKey
        );
        const recipientBefore = (
          await getAccount(provider.connection, recipientTokenAccount)
        ).amount;
        const treasuryBefore = (await getAccount(provider.connection, treasury))
          .amount;
        await claim(circle, potVault, depositVault, recipient);
        const recipientAfter = (
          await getAccount(provider.connection, recipientTokenAccount)
        ).amount;
        const treasuryAfter = (await getAccount(provider.connection, treasury))
          .amount;
        totalOut += recipientAfter - recipientBefore;
        totalOut += treasuryAfter - treasuryBefore;
        await assertConservation();
        if (
          round === 0 &&
          (await getAccount(provider.connection, potVault)).amount !== 0n
        ) {
          throw new Error("Forfeited first-round pot was not fully reserved");
        }
      }

      const completed = await program.account.circle.fetch(circle);
      if (
        completed.status.completed === undefined ||
        completed.shortfallTotal.toString() !== contribution.toString() ||
        completed.forfeitPool.toString() !== expectedForfeitPool.toString()
      ) {
        throw new Error(
          "Default scenario did not finalize its shortfall and pool"
        );
      }
      const forfeitBalanceBefore = (
        await getAccount(
          provider.connection,
          getAssociatedTokenAddressSync(mint, circleMembers[0].publicKey)
        )
      ).amount;
      let distributedForfeit = 0n;
      for (const wallet of circleMembers.slice(1)) {
        const destination = getAssociatedTokenAddressSync(
          mint,
          wallet.publicKey
        );
        const before = (await getAccount(provider.connection, destination))
          .amount;
        await program.methods
          .claimForfeitShare()
          .accountsPartial({
            caller: provider.wallet.publicKey,
            circle,
            member: memberPda(circle, wallet.publicKey),
            depositVault,
            destination,
            mint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        const after = (await getAccount(provider.connection, destination))
          .amount;
        const share = after - before;
        distributedForfeit += share;
        totalOut += share;
        await assertConservation();
      }
      const forfeitBalanceAfter = (
        await getAccount(
          provider.connection,
          getAssociatedTokenAddressSync(mint, circleMembers[0].publicKey)
        )
      ).amount;
      const finalCircle = await program.account.circle.fetch(circle);
      const defaultedMember = await program.account.member.fetch(
        memberPda(circle, circleMembers[0].publicKey)
      );
      if (
        distributedForfeit !== expectedForfeitPool ||
        !finalCircle.forfeitPool.isZero() ||
        defaultedMember.defaults !== memberCount ||
        !defaultedMember.depositRemaining.isZero() ||
        forfeitBalanceAfter !== forfeitBalanceBefore
      ) {
        throw new Error(
          `Forfeit invariant failed for ${memberCount}: distributed ${distributedForfeit}, expected ${expectedForfeitPool}, remaining ${
            finalCircle.forfeitPool
          }, defaults ${defaultedMember.defaults}, deposit ${
            defaultedMember.depositRemaining
          }, defaulter delta ${forfeitBalanceAfter - forfeitBalanceBefore}`
        );
      }
    }
  });
});
