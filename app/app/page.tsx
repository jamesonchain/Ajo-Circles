"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import dynamic from "next/dynamic";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  unpackAccount,
} from "@solana/spl-token";
import { useConnection } from "@solana/wallet-adapter-react";
import { ComputeBudgetProgram, Transaction } from "@solana/web3.js";
import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CircleHelp,
  Clock3,
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { calculateDeposit, circleStatusName, type CircleMembership } from "ajo_circles_sdk";
import { CircleRing } from "./components/circle-ring";
import { useCircleData } from "./hooks/use-circle-data";
import { useDemoWallet } from "./hooks/use-demo-wallet";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (module) => module.WalletMultiButton
    ),
  {
    ssr: false,
    loading: () => <button className="wallet-button">Connect</button>,
  }
);

const explorerBase = "https://explorer.solana.com/address";
const decimals = 6;

function amountText(amount: bigint | number | string) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) / 10 ** decimals);
}

function solText(amount: bigint | number | string) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(amount) / 1_000_000_000);
}

function compactAddress(address: string) {
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function statusName(status: object) {
  const key = circleStatusName(status);
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const known: Record<string, string> = {
    InvalidFee: "The circle settings include an unsupported service fee.",
    InvalidMinimumPeriod: "Choose a payment period longer than zero.",
    NameTooLong: "Keep the circle name to 32 characters or fewer.",
    InvalidContribution: "Enter a contribution greater than zero.",
    CircleNotForming: "This circle is no longer accepting members.",
    CircleFull: "This circle is full. Choose another open circle.",
    AlreadyMember: "You are already a member of this circle.",
    AlreadyPaid: "You have already paid for this round.",
    DeadlinePassed:
      "The payment window has closed. Ask someone in the circle to cover this payment.",
    DeadlineNotPassed: "This payment is still within its payment window.",
    PayoutNotReady:
      "The pot is ready after every member has paid or been covered.",
    WrongRecipient: "It is not this member’s payout turn.",
    CircleNotCompleted:
      "The deposit becomes available after the circle is complete.",
    NoDeposit: "There is no deposit left to withdraw.",
    SlotTaken: "That turn has already been chosen.",
    PeriodTooShort: "Choose a longer payment period.",
    InvalidMemberCount: "Choose between 3 and 12 members.",
    InvalidSlot: "That turn is outside this circle.",
    MintMismatch: "This account does not use the circle’s test USDC.",
    MathOverflow: "Those circle settings are too large. Choose a smaller amount.",
    TokenOwnerMismatch:
      "Choose a test USDC account owned by your connected wallet.",
    CircleNotActive: "This action is available while the circle is active.",
    CircleNotFull: "This action is available after every turn is chosen.",
    AlreadySettled: "This payment has already been settled.",
    CircleComplete: "This circle has already finished.",
    CircleNotCancelled: "This circle is not cancelled.",
    DepositAlreadyWithdrawn: "This deposit has already been returned.",
    PayoutAlreadyClaimed: "This turn has already been paid.",
    NoForfeitShare: "There is no eligible share left to claim.",
    ForfeitShareAlreadyClaimed: "Your circle share has already been claimed.",
    ScoreAlreadyRecorded:
      "Your Ajo Score has already been updated for this circle.",
    MemberMismatch: "This wallet is not a member of the selected circle.",
  };
  for (const [code, text] of Object.entries(known)) {
    if (message.includes(code)) return text;
  }
  if (/insufficient funds|custom program error: 0x1/i.test(message)) {
    return /lamport|sol|fee/i.test(message)
      ? "This wallet needs more devnet SOL for this action."
      : "This wallet needs more test USDC for this action.";
  }
  if (/already in use|already initialized|account.*exists/i.test(message)) {
    return "You are already a member of this circle.";
  }
  if (/account.*not found|account does not exist|token account/i.test(message)) {
    return "This wallet needs a test USDC token account before joining.";
  }
  if (/rejected|declined/i.test(message))
    return "The wallet request was cancelled.";
  return "That request did not finish. Check the network and try again.";
}

function walletErrorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/not ready|not initialized|unavailable/i.test(message)) {
    return "Your wallet is not ready. Open it and try again.";
  }
  if (/reject|declin|cancel/i.test(message)) {
    return "The wallet request was rejected.";
  }
  return "Your wallet could not complete that request.";
}

function deadlineText(deadline: bigint, now = 0) {
  if (!now) return "Calculating";
  const seconds = Number(deadline) - Math.floor(now / 1000);
  if (seconds <= 0) return "Past due";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

function frequencyText(periodSecs: anchor.BN) {
  const seconds = periodSecs.toNumber();
  if (seconds === 86_400) return "day";
  if (seconds === 1_209_600) return "two weeks";
  if (seconds === 2_592_000) return "month";
  if (seconds === 604_800) return "week";
  return `every ${Math.max(1, Math.round(seconds / 86_400))} days`;
}

function isActive(status: object) {
  return Object.prototype.hasOwnProperty.call(status, "active");
}

function simulationFailure(value: anchor.web3.SimulatedTransactionResponse) {
  const logs = value.logs ?? [];
  const programErrorCode = logs.find((line) => /custom program error|Error Code:/i.test(line)) ?? null;
  console.error("[Ajo Circles] transaction simulation failed", {
    message: value.err,
    logs,
    programErrorCode,
  });
  return new Error(programErrorCode ?? logs.at(-1) ?? "The transaction could not be simulated.");
}

async function confirmSignature(
  connection: anchor.web3.Connection,
  signature: string,
  blockhash: anchor.web3.BlockhashWithExpiryBlockHeight
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const [status, blockHeight] = await Promise.all([
      connection.getSignatureStatuses([signature]),
      connection.getBlockHeight("confirmed"),
    ]);
    const value = status.value[0];
    if (value?.err) throw new Error(JSON.stringify(value.err));
    if (value?.confirmationStatus === "confirmed" || value?.confirmationStatus === "finalized") return;
    if (blockHeight > blockhash.lastValidBlockHeight) throw new Error("The transaction expired before confirmation.");
    await new Promise((resolve) => window.setTimeout(resolve, 400));
  }
  throw new Error("The transaction was sent but confirmation took too long.");
}

function circleAddressFromInput(value: string) {
  const input = value.trim();
  try {
    const url = new URL(input);
    return url.searchParams.get("circle") ?? url.pathname.split("/").filter(Boolean).at(-1) ?? input;
  } catch {
    return input;
  }
}

export default function Home() {
  const [selectedAddress, setSelectedAddress] = useState("");
  const { connection } = useConnection();
  const demo = useDemoWallet(connection);
  const {
    client,
    circles,
    memberships,
    score,
    tokenBalance,
    solBalance,
    loading,
    error,
    refresh,
    refreshSelected,
    markCircleCancelled,
    wallet,
  } = useCircleData(selectedAddress, demo.activeWallet ?? undefined);
  const [selectedMembers, setSelectedMembers] = useState<
    CircleMembership["member"][]
  >([]);
  const [potAmount, setPotAmount] = useState(0n);
  const [dialog, setDialog] = useState<"create" | "join" | null>(null);
  const [circleAddressInput, setCircleAddressInput] = useState("");
  const [joinSlot, setJoinSlot] = useState<number | null>(null);
  const [circleName, setCircleName] = useState("");
  const [contribution, setContribution] = useState("10");
  const [frequency, setFrequency] = useState("weekly");
  const [maxMembers, setMaxMembers] = useState("5");
  const [createStep, setCreateStep] = useState(1);
  const [createdInvite, setCreatedInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [noticeLink, setNoticeLink] = useState("");
  const [shareReady, setShareReady] = useState(false);
  const [clock, setClock] = useState(0);
  const [testMoneyBusy, setTestMoneyBusy] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [creatorSlot, setCreatorSlot] = useState(0);
  const [startMode, setStartMode] = useState<"full" | "demo">("full");
  const [weekday, setWeekday] = useState("Wednesday");

  const selectedCircle = useMemo(
    () => circles.find(({ address }) => address.toBase58() === selectedAddress),
    [circles, selectedAddress]
  );
  const selectedMembership = useMemo(
    () =>
      memberships.find(
        ({ circleAddress }) => circleAddress.toBase58() === selectedAddress
      ),
    [memberships, selectedAddress]
  );
  const selectedMember = selectedMembership?.member;
  const selectedCancelled = Boolean(selectedCircle && circleStatusName(selectedCircle.account.status) === "cancelled");
  const selectedIsCreator = Boolean(
    selectedCircle && wallet.publicKey && selectedCircle.account.creator.equals(wallet.publicKey)
  );
  const activeCount = circles.filter(({ account }) =>
    isActive(account.status)
  ).length;
  const totalMembers = circles.reduce(
    (sum, row) => sum + row.account.memberCount,
    0
  );

  useEffect(() => {
    if (!selectedAddress && memberships.length) {
      const timer = window.setTimeout(
        () => setSelectedAddress(memberships[0].circleAddress.toBase58()),
        0
      );
      return () => window.clearTimeout(timer);
    } else if (!selectedAddress && circles.length) {
      const timer = window.setTimeout(
        () => setSelectedAddress(circles[0].address.toBase58()),
        0
      );
      return () => window.clearTimeout(timer);
    }
  }, [circles, memberships, selectedAddress]);

  useEffect(() => {
    let cancelled = false;
    async function loadSelected() {
      if (!selectedCircle) {
        setSelectedMembers([]);
        setPotAmount(0n);
        return;
      }
      try {
        const vaultAddress = client.vault("pot", selectedCircle.address);
        const [members, vaultInfo] = await Promise.all([
          client.listMembers(selectedCircle.address),
          connection
            .getMultipleAccountsInfo([vaultAddress], "confirmed")
            .then(([account]) =>
              account ? unpackAccount(vaultAddress, account, selectedCircle.account.mint) : null
            ),
        ]);
        if (cancelled) return;
        setSelectedMembers(members.map(({ account }) => account));
        setPotAmount(vaultInfo?.amount ?? 0n);
      } catch {
        if (!cancelled) {
          setSelectedMembers([]);
          setPotAmount(0n);
        }
      }
    }
    void loadSelected();
    return () => {
      cancelled = true;
    };
  }, [client, connection, selectedCircle]);

  useEffect(() => {
    const initial = window.setTimeout(() => setClock(Date.now()), 0);
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  const showNotice = useCallback((message: string, isError = false, link = "") => {
    setNotice(message);
    setNoticeError(isError);
    setNoticeLink(link);
    window.setTimeout(() => {
      setNotice("");
      setNoticeLink("");
    }, 5200);
  }, []);

  useEffect(() => {
    const onWalletError = (event: Event) => {
      showNotice(walletErrorText((event as CustomEvent).detail), true);
    };
    window.addEventListener("ajo-wallet-error", onWalletError);
    return () => window.removeEventListener("ajo-wallet-error", onWalletError);
  }, [showNotice]);

  const sendInstruction = useCallback(
    async (
      label: string,
      instruction: anchor.web3.TransactionInstruction | anchor.web3.TransactionInstruction[]
    ) => {
      if (!wallet.publicKey || !wallet.sendTransaction) {
        throw new Error("Connect a wallet first");
      }
      setBusy(true);
      setShareReady(false);
      setNotice(`${label}, approve the request in your wallet`);
      setNoticeError(false);
      setNoticeLink("");
      try {
        const transaction = new Transaction().add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
          ...(Array.isArray(instruction) ? instruction : [instruction])
        );
        const blockhash = await connection.getLatestBlockhash("confirmed");
        transaction.feePayer = wallet.publicKey;
        transaction.recentBlockhash = blockhash.blockhash;
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) throw simulationFailure(simulation.value);
        let signature: string;
        if (transaction.serialize({ requireAllSignatures: false }).length > 1_232 && wallet.signAllTransactions) {
          const [signed] = await wallet.signAllTransactions([transaction]);
          signature = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
            maxRetries: 5,
          });
        } else {
          signature = await wallet.sendTransaction(transaction, connection, {
            skipPreflight: false,
            maxRetries: 5,
          });
        }
        setNotice(`${label}, waiting for confirmation`);
        await confirmSignature(connection, signature, blockhash);
        await refreshSelected();
        setShareReady(true);
        showNotice(
          `${label} is confirmed`,
          false,
          `https://explorer.solana.com/tx/${signature}?cluster=devnet`
        );
        return signature;
      } finally {
        setBusy(false);
      }
    },
    [connection, refreshSelected, showNotice, wallet]
  );

  async function createCircle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createStep < 3) {
      setCreateStep((step) => step + 1);
      return;
    }
    if (!wallet.publicKey) {
      showNotice("Connect your wallet to create a circle.", true);
      return;
    }
    const amount = Math.round(Number(contribution) * 10 ** decimals);
    const membersCount = Number(maxMembers);
    const periodSeconds = startMode === "demo" ? 60 : {
      daily: 86_400,
      weekly: 604_800,
      biweekly: 1_209_600,
      monthly: 2_592_000,
    }[frequency];
    if (
      !circleName.trim() ||
      circleName.length > 32 ||
      amount <= 0 ||
      !periodSeconds ||
      membersCount < 3 ||
      membersCount > 12
    ) {
      showNotice(
        "Enter a name, positive amount, period of at least one day, and 3 to 12 members.",
        true
      );
      return;
    }
    try {
      const circleId = BigInt(Math.floor(Date.now() / 1000));
      const address = client.circle(wallet.publicKey, circleId);
      const currentConfig = await client.fetchConfig();
      const baseAccounts = {
        creator: wallet.publicKey,
        config: client.config,
        mint: currentConfig.mint,
        circle: address,
        systemProgram: anchor.web3.SystemProgram.programId,
      };
      const instructions = await Promise.all([
        client.createCircle(
          circleId,
          circleName.trim(),
          amount,
          periodSeconds,
          membersCount,
          baseAccounts
        ),
        client.initializePotVault({
          creator: wallet.publicKey,
          circle: address,
          mint: currentConfig.mint,
          potVault: client.vault("pot", address),
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        }),
        client.initializeDepositVault({
          creator: wallet.publicKey,
          circle: address,
          mint: currentConfig.mint,
          depositVault: client.vault("deposit", address),
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        }),
        createAssociatedTokenAccountIdempotentInstruction(
          wallet.publicKey,
          await getAssociatedTokenAddress(currentConfig.mint, wallet.publicKey),
          wallet.publicKey,
          currentConfig.mint
        ),
        await client.joinCircle(creatorSlot, {
          wallet: wallet.publicKey,
          config: client.config,
          circle: address,
          member: client.member(address, wallet.publicKey),
          source: await getAssociatedTokenAddress(currentConfig.mint, wallet.publicKey),
          depositVault: client.vault("deposit", address),
          mint: currentConfig.mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        }),
      ]);
      const signature = await sendInstruction("Circle created", instructions);
      setSelectedAddress(address.toBase58());
      setCreatedInvite(address.toBase58());
      setCreateStep(4);
      await refresh();
      showNotice(
        "Circle created. Share the invite so members can choose their turns.",
        false,
        `https://explorer.solana.com/tx/${signature}?cluster=devnet`
      );
    } catch (cause) {
      showNotice(friendlyError(cause), true);
    }
  }

  async function joinCircle(addressText: string, requestedSlot = joinSlot) {
    if (!wallet.publicKey) {
      showNotice("Connect your wallet to choose a turn.", true);
      return;
    }
    try {
      let address: anchor.web3.PublicKey;
      try {
        address = new anchor.web3.PublicKey(circleAddressFromInput(addressText));
      } catch {
        throw new Error("This circle link is invalid.");
      }
      let circle: Awaited<ReturnType<typeof client.fetchCircle>>;
      try {
        circle = await client.fetchCircle(address);
      } catch {
        throw new Error("That circle could not be found on devnet.");
      }
      const memberAddress = client.member(address, wallet.publicKey);
      const existingMember = await client.fetchMemberForWallet(address, wallet.publicKey);
      if (existingMember) {
        setSelectedAddress(address.toBase58());
        setDialog(null);
        showNotice(`You are already a member on turn ${existingMember.slot + 1}.`);
        return;
      }
      const currentConfig = await client.fetchConfig();
      const source = await getAssociatedTokenAddress(
        currentConfig.mint,
        wallet.publicKey
      );
      const sourceAccount = await getAccount(
        connection,
        source,
        "confirmed"
      ).catch(() => null);
      const slot = requestedSlot ?? Array.from(
        { length: circle.maxMembers },
        (_, index) => index
      ).find((index) => (circle.slotsTaken & (1 << index)) === 0) ?? -1;
      if (slot < 0) throw new Error("There are no turns left in this circle.");
      if (slot >= circle.maxMembers) {
        throw new Error("That turn is outside this circle.");
      }
      if ((circle.slotsTaken & (1 << slot)) !== 0) {
        throw new Error("That turn has already been chosen.");
      }
      const required =
        BigInt(circle.contribution.toString()) *
        BigInt(Math.max(1, circle.maxMembers - 1 - slot));
      if ((sourceAccount?.amount ?? 0n) < required) {
        throw new Error(
          `This turn needs ${amountText(
            required
          )} test USDC. This wallet has ${amountText(sourceAccount?.amount ?? 0n)}.`
        );
      }
      const createSourceAta = createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        source,
        wallet.publicKey,
        currentConfig.mint
      );
      const signature = await sendInstruction(
        "Turn chosen",
        [
          createSourceAta,
          await client.joinCircle(slot, {
            wallet: wallet.publicKey,
            config: client.config,
            circle: address,
            member: memberAddress,
            source,
            depositVault: client.vault("deposit", address),
            mint: currentConfig.mint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          }),
        ]
      );
      setSelectedAddress(address.toBase58());
      setCircleAddressInput("");
      setDialog(null);
      showNotice(
        "You joined the circle. Next step is to wait for every turn to be chosen.",
        false,
        `https://explorer.solana.com/tx/${signature}?cluster=devnet`
      );
    } catch (cause) {
      showNotice(friendlyError(cause), true);
    }
  }

  async function payCurrentRound() {
    if (!selectedCircle || !wallet.publicKey || !selectedMember) return;
    try {
      const currentConfig = await client.fetchConfig();
      const source = await getAssociatedTokenAddress(
        currentConfig.mint,
        wallet.publicKey
      );
      const account = await getAccount(connection, source, "confirmed").catch(
        () => null
      );
      const needed = BigInt(selectedCircle.account.contribution.toString());
      if (!account || account.amount < needed) {
        throw new Error(
          `This payment needs ${amountText(
            needed
          )} test USDC. Check your wallet balance.`
        );
      }
      await sendInstruction(
        "Payment sent",
        await client.contribute({
          wallet: wallet.publicKey,
          config: client.config,
          circle: selectedCircle.address,
          member: selectedMembership!.memberAddress,
          source,
          potVault: client.vault("pot", selectedCircle.address),
          mint: currentConfig.mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
      );
    } catch (cause) {
      showNotice(friendlyError(cause), true);
    }
  }

  async function coverMissingPayment() {
    if (!selectedCircle || !wallet.publicKey) return;
    const caller = wallet.publicKey;
    const roundBit = 1 << selectedCircle.account.currentRound;
    const missed = selectedMembers.find(
      (member) =>
        (member.paidBitmask & roundBit) === 0 &&
        !member.wallet.equals(caller)
    );
    if (!missed) {
      showNotice("Every member has paid or been covered this round.");
      return;
    }
    try {
      await sendInstruction(
        "Payment covered",
        await client.settleDefault({
          caller: wallet.publicKey,
          circle: selectedCircle.address,
          member: client.member(selectedCircle.address, missed.wallet),
          depositVault: client.vault("deposit", selectedCircle.address),
          potVault: client.vault("pot", selectedCircle.address),
          mint: selectedCircle.account.mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
      );
    } catch (cause) {
      showNotice(friendlyError(cause), true);
    }
  }

  async function claimCurrentPayout() {
    if (!selectedCircle || !wallet.publicKey) return;
    const recipient = selectedMembers.find(
      (member) => member.slot === selectedCircle.account.currentRound
    );
    if (!recipient) return;
    try {
      const currentConfig = await client.fetchConfig();
      await sendInstruction(
        "Pot claimed",
        await client.claimPayout({
          caller: wallet.publicKey,
          config: client.config,
          circle: selectedCircle.address,
          recipientMember: client.member(
            selectedCircle.address,
            recipient.wallet
          ),
          recipientWallet: recipient.wallet,
          potVault: client.vault("pot", selectedCircle.address),
          depositVault: client.vault("deposit", selectedCircle.address),
          treasury: currentConfig.treasury,
          mint: currentConfig.mint,
          recipientTokenAccount: await getAssociatedTokenAddress(
            currentConfig.mint,
            recipient.wallet
          ),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
      );
    } catch (cause) {
      showNotice(friendlyError(cause), true);
    }
  }

  async function withdrawDeposit() {
    if (!selectedCircle || !wallet.publicKey || !selectedMembership?.member || !selectedMembership.memberAddress) return;
    try {
      const currentConfig = await client.fetchConfig();
      const destination = await getAssociatedTokenAddress(
        currentConfig.mint,
        wallet.publicKey
      );
      await sendInstruction(
        "Deposit returned",
        await client.withdrawDeposit({
          wallet: wallet.publicKey,
          circle: selectedCircle.address,
          member: selectedMembership.memberAddress,
          depositVault: client.vault("deposit", selectedCircle.address),
          destination,
          mint: currentConfig.mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
      );
    } catch (cause) {
      showNotice(friendlyError(cause), true);
    }
  }

  async function finalizeScore() {
    if (!selectedCircle || !wallet.publicKey || !selectedMembership?.member || !selectedMembership.memberAddress) return;
    try {
      await sendInstruction(
        "Ajo Score updated",
        await client.finalizeScore({
          caller: wallet.publicKey,
          circle: selectedCircle.address,
          member: selectedMembership.memberAddress,
          score: client.score(wallet.publicKey),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
      );
    } catch (cause) {
      showNotice(friendlyError(cause), true);
    }
  }

  async function cancelCircle() {
    if (!selectedCircle || !wallet.publicKey || !selectedIsCreator) return;
    try {
      const signature = await sendInstruction(
        "Circle cancelled",
        await client.cancelCircle({
          creator: wallet.publicKey,
          circle: selectedCircle.address,
        })
      );
      markCircleCancelled(selectedCircle.address);
      setCancelConfirmOpen(false);
      showNotice(
        "Circle cancelled. Members can now refund their deposits.",
        false,
        `https://explorer.solana.com/tx/${signature}?cluster=devnet`
      );
    } catch (cause) {
      showNotice(friendlyError(cause), true);
    }
  }

  async function refundMyDeposit() {
    if (!selectedCircle || !wallet.publicKey || !selectedMembership?.memberAddress) return;
    try {
      const currentConfig = await client.fetchConfig();
      const destination = await getAssociatedTokenAddress(currentConfig.mint, wallet.publicKey);
      await sendInstruction(
        "Deposit refunded",
        await client.refundDeposit({
          wallet: wallet.publicKey,
          circle: selectedCircle.address,
          member: selectedMembership.memberAddress,
          depositVault: client.vault("deposit", selectedCircle.address),
          destination,
          mint: currentConfig.mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
      );
    } catch (cause) {
      showNotice(friendlyError(cause), true);
    }
  }

  async function copyInvite(address: string) {
    await navigator.clipboard.writeText(
      `${window.location.origin}/?circle=${address}`
    );
    showNotice("Invite link copied.");
  }

  async function requestTestMoney() {
    if (!wallet.publicKey) {
      showNotice("Connect your wallet to request test money.", true);
      return;
    }
    setTestMoneyBusy(true);
    try {
      const response = await fetch("/api/test-money", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          demo.mode === "demo"
            ? { wallets: demo.wallets.map(({ publicKey }) => publicKey.toBase58()), demo: true }
            : { wallet: wallet.publicKey.toBase58() }
        ),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Test money could not be sent.");
      await refresh();
      showNotice(demo.mode === "demo" ? "Demo wallets funded with test USDC and devnet SOL." : "Test USDC and devnet SOL sent to your wallet.");
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : "Test money could not be sent.", true);
    } finally {
      setTestMoneyBusy(false);
    }
  }

  async function shareInvite(address: string, name: string) {
    const link = `${window.location.origin}/?circle=${address}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        `Join my savings circle, ${name}: ${link}`
      )}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get("circle");
    if (invite) {
      const address = circleAddressFromInput(invite);
      const timer = window.setTimeout(() => {
        setCircleAddressInput(address);
        setSelectedAddress(address);
        setDialog("join");
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const joinCircleAddress = selectedCircle?.address.toBase58();
  const joinCircleMaxMembers = selectedCircle?.account.maxMembers;
  const joinCircleSlotsTaken = selectedCircle?.account.slotsTaken;
  useEffect(() => {
    if (dialog !== "join" || !joinCircleAddress) {
      const timer = window.setTimeout(() => setJoinSlot(null), 0);
      return () => window.clearTimeout(timer);
    }
    const firstOpenSlot = Array.from(
      { length: joinCircleMaxMembers ?? 0 },
      (_, slot) => slot
    ).find((slot) => ((joinCircleSlotsTaken ?? 0) & (1 << slot)) === 0);
    const timer = window.setTimeout(() => {
      setJoinSlot(firstOpenSlot ?? null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [dialog, joinCircleAddress, joinCircleMaxMembers, joinCircleSlotsTaken]);

  const nextPayment = memberships
    .map((membership) => ({
      membership,
      deadline:
        BigInt(membership.circle.roundStartTs.toString()) +
        BigInt(membership.circle.periodSecs.toString()),
    }))
    .filter(
      ({ membership }) =>
        membership.member &&
        isActive(membership.circle.status) &&
        (membership.member.paidBitmask &
          (1 << membership.circle.currentRound)) ===
          0
    )
    .sort((left, right) =>
      left.deadline < right.deadline
        ? -1
        : left.deadline > right.deadline
        ? 1
        : 0
    )[0];

  const ringMembers = selectedMembers.map((member) => ({
    wallet: member.wallet.toBase58(),
    slot: member.slot,
    paid:
      (member.paidBitmask &
        (1 << (selectedCircle?.account.currentRound ?? 0))) !==
      0,
    missed: member.defaults > 0,
  }));
  const selectedIsActive = selectedCircle
    ? isActive(selectedCircle.account.status)
    : false;
  const roundComplete =
    selectedCircle?.account.contributionsThisRound ===
    selectedCircle?.account.memberCount;
  const memberTurn =
    selectedMember?.slot === selectedCircle?.account.currentRound;
  const isRecipient =
    selectedMembership?.member?.slot === selectedCircle?.account.currentRound;
  const selectedComplete =
    selectedCircle &&
    Object.prototype.hasOwnProperty.call(
      selectedCircle.account.status,
      "completed"
    );
  const roundDeadline = selectedCircle
    ? BigInt(selectedCircle.account.roundStartTs.toString()) +
      BigInt(selectedCircle.account.periodSecs.toString())
    : 0n;
  const deadlinePassed =
    selectedCircle !== undefined && BigInt(Math.floor(clock / 1000)) >= roundDeadline;
  const currentRoundBit = selectedCircle
    ? 1 << selectedCircle.account.currentRound
    : 0;
  const currentRoundPaid = selectedMembership?.member
    ? (selectedMembership.member.paidBitmask & currentRoundBit) !== 0
    : false;
  const missedMember = selectedMembers.find(
    (member) => (member.paidBitmask & currentRoundBit) === 0
  );
  const primaryAction = selectedComplete
    ? null
    : selectedIsActive && roundComplete && isRecipient
    ? { label: "Claim payout", action: claimCurrentPayout, icon: ArrowDownToLine }
    : selectedIsActive && selectedMembership?.member && !currentRoundPaid
    ? {
        label: memberTurn ? "Your turn" : "Pay now",
        action: payCurrentRound,
        icon: ArrowUpRight,
      }
    : selectedIsActive && selectedMembership?.member
    ? { label: "Waiting for others", action: undefined, icon: Clock3 }
    : null;
  const ActionIcon = primaryAction?.icon;
  const timelineRounds = selectedCircle
    ? Array.from({ length: selectedCircle.account.maxMembers }, (_, round) => {
        const recipient = selectedMembers.find((member) => member.slot === round);
        return { round, recipient };
      })
    : [];
  const explorerLink = selectedAddress
    ? `${explorerBase}/${selectedAddress}?cluster=devnet`
    : "";
  const visibleMemberships = memberships.filter(
    ({ circle }) => showCancelled || circleStatusName(circle.status) !== "cancelled"
  );

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Ajo Circles home">
          <span className="brand-mark">A</span>
          <span>Ajo Circles</span>
        </a>
        <nav className="nav" aria-label="Main navigation">
          <a href="#circles">Circles</a>
          <a href="#directory">Open circles</a>
          <a href="#score">Ajo Score</a>
          <div className="wallet-switcher" aria-label="Wallet mode">
            <button className={demo.mode === "phantom" ? "wallet-mode-active" : ""} onClick={() => demo.setMode("phantom")}>Phantom</button>
            <button className={demo.mode === "demo" ? "wallet-mode-active" : ""} onClick={() => demo.setMode("demo")}>Demo wallets</button>
          </div>
          {demo.mode === "phantom" ? (
            <WalletMultiButton className="wallet-button" />
          ) : (
            <div className="demo-wallet-picker">
              <select value={demo.activeIndex} onChange={(event) => demo.setActiveIndex(Number(event.target.value))} aria-label="Active demo wallet">
                {demo.wallets.map((demoWallet, index) => <option key={demoWallet.publicKey.toBase58()} value={index}>{demoWallet.name}</option>)}
              </select>
              <small>Demo wallet, test money only · {demo.wallets[demo.activeIndex] ? compactAddress(demo.wallets[demo.activeIndex].publicKey.toBase58()) : "Loading"}</small>
              <small>{solText(solBalance ?? 0n)} SOL · {amountText(tokenBalance ?? 0n)} USDC</small>
              <button className="switch-phantom" onClick={() => demo.setMode("phantom")}>Switch to Phantom</button>
            </div>
          )}
        </nav>
      </header>

      <section className="app-heading" id="top">
        <div>
          <span className="eyebrow">Solana devnet</span>
          <h1>Save together.</h1>
          <p>Clear turns, protected payments, your own record.</p>
        </div>
        <div className="heading-actions">
          <button
            className="button button-quiet"
            onClick={() => void refresh()}
            disabled={loading}
            title="Refresh chain data"
          >
            <RefreshCw size={17} className={loading ? "spin" : ""} />
            <span>Refresh</span>
          </button>
          <button
            className="button button-primary"
            onClick={() => setDialog("create")}
          >
            <Plus size={18} /> Create circle
          </button>
          <button className="button button-outline" onClick={() => void requestTestMoney()} disabled={testMoneyBusy || !wallet.publicKey}>
            <Wallet size={17} /> {testMoneyBusy ? "Funding wallets" : demo.mode === "demo" ? "Fund demo wallets" : "Get test money"}
          </button>
        </div>
      </section>

      <section className="stats" aria-label="Live network totals">
        <div className="stats-inner">
          <div className="stat">
            <strong>{loading ? "..." : circles.length}</strong>
            <span>circles on chain</span>
          </div>
          <div className="stat">
            <strong>{loading ? "..." : activeCount}</strong>
            <span>active circles</span>
          </div>
          <div className="stat">
            <strong>{loading ? "..." : totalMembers}</strong>
            <span>member places</span>
          </div>
          <div className="stat">
            <strong>
              {tokenBalance === null
                ? "Connect"
                : `${amountText(tokenBalance)} USDC`}
            </strong>
            <span>your test balance</span>
          </div>
          <div className="stat">
            <strong>{solBalance === null ? "Connect" : `${solText(solBalance)} SOL`}</strong>
            <span>devnet balance</span>
          </div>
        </div>
      </section>

      {error && (
        <div className="network-error" role="status">
          <CircleHelp size={18} /> {error}
        </div>
      )}

      <section className="workspace" id="circles">
        <div className="workspace-main">
          <div className="section-head compact-head">
            <div>
              <span className="eyebrow">My circles</span>
              <h2>Circle activity</h2>
            </div>
            <div className="section-head-actions">
              {wallet.publicKey && (
                <span className="wallet-address">
                  <Wallet size={15} />{" "}
                  {compactAddress(wallet.publicKey.toBase58())}
                </span>
              )}
              {wallet.publicKey && memberships.some(({ circle }) => circleStatusName(circle.status) === "cancelled") && (
                <button className="cancel-toggle" onClick={() => setShowCancelled((value) => !value)}>
                  {showCancelled ? "Hide cancelled" : "Show cancelled"}
                </button>
              )}
            </div>
          </div>

          {!wallet.publicKey ? (
            <div className="empty-state">
              <div className="empty-mark">
                <Users size={24} />
              </div>
              <h3>Connect to see your circles</h3>
              <p>
                Your turns, payments, deposits, and Ajo Score will appear here.
              </p>
              <WalletMultiButton className="wallet-button" />
            </div>
          ) : loading ? (
            <div className="circle-skeletons" aria-label="Loading your circles">
              {Array.from({ length: 3 }, (_, index) => (
                <div className="circle-skeleton" key={index} />
              ))}
            </div>
          ) : visibleMemberships.length === 0 ? (
            <div className="empty-state compact-empty">
              <div className="empty-mark">
                <Users size={24} />
              </div>
              <h3>{memberships.length ? "No active circles" : "No circles yet"}</h3>
              <p>{memberships.length ? "Your cancelled circles are hidden." : "Browse an open circle or create one for your group."}</p>
              <button
                className="button button-gold"
                onClick={() => setDialog("create")}
              >
                <Plus size={17} /> Create circle
              </button>
            </div>
          ) : (
            <div className="circle-table" role="list">
              {visibleMemberships.map(
                ({ memberAddress, member, circleAddress, circle }) => {
                  const active = isActive(circle.status);
                  const cancelled = circleStatusName(circle.status) === "cancelled";
                  const creator = Boolean(wallet.publicKey && circle.creator.equals(wallet.publicKey));
                  const due =
                    Boolean(member) &&
                    active &&
                    ((member?.paidBitmask ?? 0) & (1 << circle.currentRound)) === 0;
                  const selected = selectedAddress === circleAddress.toBase58();
                  return (
                    <div
                      className={`circle-row-shell ${cancelled ? "cancelled-row" : ""}`}
                      key={memberAddress?.toBase58() ?? circleAddress.toBase58()}
                      role="listitem"
                    >
                      <button className={`circle-row ${selected ? "circle-row-selected" : ""}`} onClick={() => setSelectedAddress(circleAddress.toBase58())}>
                        <span className="circle-row-icon">{circle.name.slice(0, 1).toUpperCase()}</span>
                        <span className="circle-row-copy">
                          <strong>{circle.name}</strong>
                          <small>{member ? `You are a member, turn ${member.slot + 1}` : active ? `Round ${Math.min(circle.currentRound + 1, circle.maxMembers)} of ${circle.maxMembers}` : statusName(circle.status)}</small>
                        </span>
                        <span className={`state-pill ${due ? "state-due" : active ? "state-current" : ""}`}>
                          {due ? "Payment due" : active ? "On track" : member ? statusName(circle.status) : "Creator"}
                        </span>
                        <span className="circle-row-amount">{amountText(circle.contribution.toString())}<small>USDC</small></span>
                        <ArrowUpRight size={17} className="row-arrow" />
                      </button>
                      {cancelled && <span className="cancelled-badge">Cancelled</span>}
                      {creator && !cancelled && circleStatusName(circle.status) === "forming" && (
                        <button className="row-cancel-button" disabled={busy} onClick={() => { setSelectedAddress(circleAddress.toBase58()); setCancelConfirmOpen(true); }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}

          <div className="action-line">
            <button
              className="button button-outline"
              onClick={() => setDialog("join")}
            >
              <ArrowUpRight size={17} /> Join with a circle link
            </button>
            {nextPayment && (
              <span className="due-note">
                <Clock3 size={15} /> Next payment{" "}
                {deadlineText(nextPayment.deadline, clock)}
              </span>
            )}
          </div>
        </div>

        <aside className="score-panel" id="score">
          <div className="score-panel-head">
            <div>
              <span className="eyebrow">Your record</span>
              <h2>Ajo Score</h2>
            </div>
            <ShieldCheck size={21} />
          </div>
          {!wallet.publicKey ? (
            <p className="muted-copy">
              Connect a wallet to read its public score.
            </p>
          ) : score ? (
            <>
              <div className="score-number">
                {score.circlesCompleted}
                <small> circles complete</small>
              </div>
              <div className="score-facts">
                <span>
                  {score.roundsPaidOnTime.toString()}
                  <small>payments on time</small>
                </span>
                <span>
                  {score.roundsDefaulted.toString()}
                  <small>defaults</small>
                </span>
              </div>
              <p className="muted-copy">
                This record is read from your wallet’s Ajo Score account.
              </p>
            </>
          ) : (
            <p className="muted-copy">
              No score recorded yet. Complete a circle to start your history.
            </p>
          )}
          {selectedComplete &&
            selectedMembership?.member &&
            !selectedMembership.member.scoreRecorded && (
              <button
                className="button button-gold score-action"
                onClick={() => void finalizeScore()}
                disabled={busy}
              >
                <Check size={17} /> Update my Ajo Score
              </button>
            )}
        </aside>
      </section>

      <section className="selected-circle" aria-labelledby="selected-title">
        <div className="selected-head">
          <div>
            <span className="eyebrow">Selected circle</span>
            <h2 id="selected-title">
              {selectedCircle?.account.name ?? "Choose a circle"}
            </h2>
            {selectedCircle && (
              <p>
                {compactAddress(selectedCircle.address.toBase58())}{" "}
                <a
                  href={explorerLink}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="View circle on Solana explorer"
                >
                  <ExternalLink size={14} />
                </a>
              </p>
            )}
          </div>
          {selectedCircle && (
            <button
              className="icon-button"
              onClick={() => void copyInvite(selectedCircle.address.toBase58())}
              title="Copy invite link"
            >
              <Copy size={17} />
            </button>
          )}
        </div>
        {selectedComplete && selectedMembership?.member && (
          <div className="completion-card">
            <div>
              <span className="eyebrow">Circle complete</span>
              <h3>Your savings cycle is finished</h3>
              <p>Your unused deposit is ready to return. Record this completed circle in your Ajo Score.</p>
            </div>
            <div className="completion-actions">
              {!selectedMembership.member.depositWithdrawn && (
                <button className="button button-primary" onClick={() => void withdrawDeposit()} disabled={busy}><ArrowDownToLine size={17} /> Withdraw my deposit</button>
              )}
              {!selectedMembership.member.scoreRecorded && (
                <button className="button button-gold" onClick={() => void finalizeScore()} disabled={busy}><Check size={17} /> Update my Ajo Score</button>
              )}
            </div>
          </div>
        )}
        <div className="selected-layout">
          <div className="ring-stage">
            <CircleRing
              circle={selectedCircle?.account ?? null}
              members={ringMembers}
              potAmount={potAmount}
            />
          </div>
          <div className="selected-details">
            <div className="detail-stats">
              <div>
                <span>Contribution</span>
                <strong>
                  {selectedCircle
                    ? `${amountText(
                        selectedCircle.account.contribution.toString()
                      )} USDC`
                    : "—"}
                </strong>
              </div>
              <div>
                <span>Members</span>
                <strong>
                  {selectedCircle
                    ? `${selectedCircle.account.memberCount} / ${selectedCircle.account.maxMembers}`
                    : "—"}
                </strong>
              </div>
              <div>
                <span>Payment window</span>
                <strong>
                  {selectedCircle
                    ? selectedCancelled || selectedCircle.account.memberCount <
                      selectedCircle.account.maxMembers
                      ? "Not started"
                      : deadlineText(
                        BigInt(selectedCircle.account.roundStartTs.toString()) +
                          BigInt(selectedCircle.account.periodSecs.toString()),
                        clock
                        )
                    : "—"}
                </strong>
              </div>
              <div>
                <span>Your deposit</span>
                <strong>
                  {selectedMembership?.member
                    ? `${amountText(
                        selectedMembership.member.depositRemaining.toString()
                      )} USDC`
                    : "Not joined"}
                </strong>
              </div>
            </div>
            <div className="primary-action-row">
              {selectedMember ? (
                <p className="member-state-line">You are a member, turn {selectedMember.slot + 1}, deposit {amountText(selectedMember.depositRemaining.toString())} USDC.</p>
              ) : selectedIsCreator ? (
                <p className="member-state-line">You created this circle. Choose a turn to join it.</p>
              ) : null}
              {selectedCircle && !selectedMember && circleStatusName(selectedCircle.account.status) === "forming" && (
                <button className="button button-outline" onClick={() => { setCircleAddressInput(selectedCircle.address.toBase58()); setDialog("join"); }} disabled={busy}>
                  Choose a turn and join
                </button>
              )}
              {selectedIsCreator && circleStatusName(selectedCircle?.account.status ?? {}) === "forming" && (
                <button className="button button-outline" onClick={() => setCancelConfirmOpen(true)} disabled={busy}>
                  Cancel circle
                </button>
              )}
              {selectedCancelled && selectedMembership?.member && selectedMembership.member.depositRemaining.gt(new anchor.BN(0)) && (
                <button className="button button-primary" onClick={() => void refundMyDeposit()} disabled={busy}>
                  <ArrowDownToLine size={18} /> Refund my deposit
                </button>
              )}
              {primaryAction && (
                <button
                  className="button button-gold primary-circle-action"
                  onClick={primaryAction.action ? () => void primaryAction.action() : undefined}
                  disabled={busy || !primaryAction.action}
                >
                  {ActionIcon && <ActionIcon size={18} />} {primaryAction.label}
                </button>
              )}
              {selectedCancelled && selectedMembership?.member && selectedMembership.member.depositRemaining.gt(new anchor.BN(0)) && (
                <p className="muted-copy refund-note">This circle was cancelled. Refund your deposit to return your funds.</p>
              )}
              {selectedIsActive && deadlinePassed && wallet.publicKey && missedMember && (
                <button
                  className="button button-outline"
                  onClick={() => void coverMissingPayment()}
                  disabled={busy || missedMember.wallet.equals(wallet.publicKey)}
                >
                  <ShieldCheck size={17} /> Cover this payment
                </button>
              )}
              {!selectedCircle && (
                <span className="muted-copy">
                  Open a circle to see its live turns here.
                </span>
              )}
            </div>
            {selectedCircle && (
              <div className="member-status-line">
                <span>
                  <i className="status-dot paid-dot" />{" "}
                  {
                    selectedMembers.filter(
                      (member) =>
                        (member.paidBitmask &
                          (1 << selectedCircle.account.currentRound)) !==
                        0
                    ).length
                  }{" "}
                  settled this round
                </span>
                <span>
                  <i className="status-dot waiting-dot" />{" "}
                  {
                    selectedMembers.filter(
                      (member) =>
                        (member.paidBitmask &
                          (1 << selectedCircle.account.currentRound)) ===
                        0
                    ).length
                  }{" "}
                  still due
                </span>
              </div>
            )}
            {selectedCircle && shareReady && (
              <button
                className="whatsapp-link"
                onClick={() =>
                  void shareInvite(
                    selectedCircle.address.toBase58(),
                    selectedCircle.account.name
                  )
                }
              >
                Share on WhatsApp <ArrowUpRight size={15} />
              </button>
            )}
            {selectedCircle && (
              <>
                <div className="circle-subsection">
                  <div className="subsection-heading"><span className="eyebrow">Payout timeline</span><span>Round {selectedCircle.account.currentRound + 1}</span></div>
                  <div className="payout-timeline">
                    {timelineRounds.map(({ round, recipient }) => (
                      <div className={`timeline-item ${round === selectedCircle.account.currentRound ? "timeline-current" : ""}`} key={round}>
                        <span className="timeline-dot" />
                        <span>Round {round + 1}</span>
                        <strong>{recipient ? compactAddress(recipient.wallet.toBase58()) : "Open turn"}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="circle-subsection">
                  <div className="subsection-heading"><span className="eyebrow">Members</span><span>{selectedMembers.length} joined</span></div>
                  <div className="member-list">
                    {selectedMembers.map((member) => {
                      const paid = (member.paidBitmask & currentRoundBit) !== 0;
                      return <div className="member-row" key={member.wallet.toBase58()}><span><strong>Turn {member.slot + 1}</strong><small>{compactAddress(member.wallet.toBase58())}</small></span><span className={`member-badge ${paid ? "member-paid" : member.defaults > 0 ? "member-missed" : "member-due"}`}>{paid ? "Paid" : member.defaults > 0 ? "Missed" : "Due"}</span></div>;
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="directory" id="directory">
        <div className="section-head compact-head">
          <div>
            <span className="eyebrow">Onchain directory</span>
            <h2>Open circles</h2>
          </div>
          <span className="directory-count">
            {
              circles.filter(
                ({ account }) =>
                  !Object.prototype.hasOwnProperty.call(
                    account.status,
                    "completed"
                  ) &&
                  !Object.prototype.hasOwnProperty.call(
                    account.status,
                    "cancelled"
                  )
              ).length
            }{" "}
            listed
          </span>
        </div>
        {circles.length === 0 ? (
          <div className="directory-empty">
            No circles have been created on this network yet.
          </div>
        ) : (
          <div className="directory-grid">
            {circles
              .filter(
                ({ account }) =>
                  !Object.prototype.hasOwnProperty.call(
                    account.status,
                    "completed"
                  ) &&
                  !Object.prototype.hasOwnProperty.call(
                    account.status,
                    "cancelled"
                  )
              )
              .map(({ address, account }) => {
                const spots = account.maxMembers - account.memberCount;
                const membership = memberships.find(({ circleAddress }) => circleAddress.equals(address));
                const creator = Boolean(wallet.publicKey && account.creator.equals(wallet.publicKey));
                return (
                  <article className="directory-row" key={address.toBase58()}>
                    <div className="directory-name">
                      <span className="circle-row-icon">
                        {account.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <h3>{account.name}</h3>
                        <p>
                          {compactAddress(address.toBase58())} ·{" "}
                          {statusName(account.status)}
                        </p>
                        {membership?.member && <span className="directory-joined">Joined, turn {membership.member.slot + 1}</span>}
                        {creator && !membership?.member && <span className="directory-joined">You created this circle</span>}
                      </div>
                    </div>
                    <div className="directory-value">
                      <strong>
                        {amountText(account.contribution.toString())} USDC
                      </strong>
                      <span>
                        {spots} {spots === 1 ? "turn" : "turns"} open
                      </span>
                    </div>
                    {membership?.member ? (
                      <button className="button button-outline" onClick={() => setSelectedAddress(address.toBase58())}>
                        View circle
                      </button>
                    ) : spots > 0 && circleStatusName(account.status) === "forming" ? (
                      <button
                        className="button button-outline"
                        onClick={() => {
                          setSelectedAddress(address.toBase58());
                          setCircleAddressInput(address.toBase58());
                          setDialog("join");
                        }}
                      >
                        View and join
                      </button>
                    ) : (
                      <span className="full-label">Full</span>
                    )}
                  </article>
                );
              })}
          </div>
        )}
      </section>

      <footer className="footer">
        <span>Ajo Circles</span>
        <a
          href={`${explorerBase}/${client.programId.toBase58()}?cluster=devnet`}
          target="_blank"
          rel="noreferrer"
        >
          Program on Solana Explorer <ExternalLink size={13} />
        </a>
        <span>Devnet test token</span>
      </footer>

      {dialog && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialog(null);
          }}
        >
          <motion.section
            className="dialog-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="dialog-head">
              <div>
                <span className="eyebrow">
                  {dialog === "create" ? "New savings group" : "Choose a turn"}
                </span>
                <h2 id="dialog-title">
                  {dialog === "create" ? "Create a circle" : "Join a circle"}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setDialog(null)}
              >
                <X size={19} />
              </button>
            </div>
            {dialog === "create" ? createStep === 4 ? (
              <div className="circle-form">
                <p className="form-help">Your circle and both vaults are confirmed on devnet. Share this invite so your group can choose their turns.</p>
                <label>Invite link<input readOnly value={`${typeof window === "undefined" ? "" : window.location.origin}/?circle=${createdInvite}`} /></label>
                <button className="button button-primary form-submit" onClick={() => void copyInvite(createdInvite)}><Copy size={17} /> Copy invite link</button>
                <button className="button button-outline form-submit" onClick={() => void shareInvite(createdInvite, circleName)}><ArrowUpRight size={17} /> Share on WhatsApp</button>
                <button className="button button-quiet form-submit" onClick={() => { setDialog(null); setCreateStep(1); setCircleName(""); }}>Done</button>
              </div>
            ) : (
              <form
                className="circle-form"
                onSubmit={(event) => void createCircle(event)}
              >
                {createStep === 1 && <>
                <div className="wizard-progress">Step 1 of 3, circle details</div>
                <label>
                  Circle name
                  <input
                    value={circleName}
                    maxLength={32}
                    onChange={(event) => setCircleName(event.target.value)}
                    placeholder="For example, Sunday group"
                    required
                  />
                </label>
                <div className="form-row">
                  <label>
                    Contribution per round
                    <input
                      inputMode="decimal"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={contribution}
                      onChange={(event) => setContribution(event.target.value)}
                      required
                    />
                    <small>USDC</small>
                  </label>
                </div>
                </>}
                {createStep === 2 && <>
                <div className="wizard-progress">Step 2 of 3, payment schedule</div>
                <label>How often will everyone contribute?
                  <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
                    <option value="daily">Every day</option>
                    <option value="weekly">Every week</option>
                    <option value="biweekly">Every two weeks</option>
                    <option value="monthly">Every month</option>
                  </select>
                </label>
                <label>How many people are in the circle?
                  <select value={maxMembers} onChange={(event) => setMaxMembers(event.target.value)}>
                    {Array.from({ length: 10 }, (_, index) => index + 3).map((count) => <option key={count} value={count}>{count} members</option>)}
                  </select>
                </label>
                <label>Creator turn
                  <select value={creatorSlot} onChange={(event) => setCreatorSlot(Number(event.target.value))}>
                    {Array.from({ length: Number(maxMembers) }, (_, slot) => <option key={slot} value={slot}>Turn {slot + 1}</option>)}
                  </select>
                </label>
                <label>When should payments start?
                  <select value={startMode} onChange={(event) => setStartMode(event.target.value as "full" | "demo")}>
                    <option value="full">When the circle is full</option>
                    <option value="demo">Demo: start now with a 60 second period</option>
                  </select>
                </label>
                {startMode === "full" && <p className="form-help">Payments follow your chosen weekday.</p>}
                {startMode === "full" && <label>Payment weekday
                  <select value={weekday} onChange={(event) => setWeekday(event.target.value)}>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => <option key={day}>{day}</option>)}
                  </select>
                </label>}
                </>}
                {createStep === 3 && <>
                <div className="wizard-progress">Step 3 of 3, review deposits</div>
                <div className="join-preview"><strong>{circleName}</strong><span>{contribution} USDC each round, {startMode === "demo" ? "demo period of 60 seconds" : `every ${weekday}`}</span><span>{maxMembers} member turns, creator chooses turn {creatorSlot + 1}</span></div>
                <div className="slot-deposit-list">
                  {Array.from({ length: Number(maxMembers) }, (_, slot) => (
                    <div className="slot-deposit-row" key={slot}><span>Turn {slot + 1}{slot === 0 ? ", earliest" : ""}</span><strong>{amountText(calculateDeposit(BigInt(Math.round(Number(contribution) * 10 ** decimals)), Number(maxMembers), slot))} USDC</strong></div>
                  ))}
                </div>
                <div className="deposit-note"><ShieldCheck size={17} /><span>You will pay {amountText(BigInt(Math.round(Number(contribution) * 10 ** decimals)) * BigInt(Math.max(1, Number(maxMembers) - 1 - creatorSlot)))} USDC as your protected deposit. Your first contribution is paid when the circle is active.</span></div>
                <div className="deposit-note"><ShieldCheck size={17} /><span>Earlier turns hold a larger deposit. Your unused amount can be withdrawn after the circle is complete.</span></div>
                </>}
                {createStep > 1 && <button type="button" className="button button-quiet form-submit" onClick={() => setCreateStep((step) => step - 1)}>Back</button>}
                <button
                  className="button button-primary form-submit"
                  disabled={
                    busy ||
                    (createStep === 3 && !wallet.publicKey) ||
                    (createStep === 1 &&
                      (!circleName.trim() || Number(contribution) <= 0))
                  }
                >
                  {busy ? "Waiting for wallet" : createStep < 3 ? "Continue" : "Create circle"}
                </button>
              </form>
            ) : (
              <form
                className="circle-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void joinCircle(circleAddressInput);
                }}
              >
                {selectedCircle && (
                  <>
                    <div className="join-preview">
                      <strong>{selectedCircle.account.name}</strong>
                      <span>{selectedCircle.account.memberCount} of {selectedCircle.account.maxMembers} turns chosen</span>
                      <span>{amountText(selectedCircle.account.contribution.toString())} USDC every {frequencyText(selectedCircle.account.periodSecs)}</span>
                    </div>
                    {selectedMember ? (
                      <p className="member-state-line">You are a member, turn {selectedMember.slot + 1}, deposit {amountText(selectedMember.depositRemaining.toString())} USDC.</p>
                    ) : (
                    <label>Choose an open turn
                      <select value={joinSlot ?? ""} onChange={(event) => setJoinSlot(Number(event.target.value))} required>
                        {Array.from({ length: selectedCircle.account.maxMembers }, (_, slot) => slot)
                          .filter((slot) => (selectedCircle.account.slotsTaken & (1 << slot)) === 0)
                          .map((slot) => {
                            const deposit = calculateDeposit(BigInt(selectedCircle.account.contribution.toString()), selectedCircle.account.maxMembers, slot);
                            return <option key={slot} value={slot}>Turn {slot + 1}, deposit {amountText(deposit)} USDC</option>;
                          })}
                      </select>
                    </label>
                    )}
                    <div className="deposit-note"><ShieldCheck size={17} /><span>The deposit helps cover missed payments. Earlier turns require a larger deposit. Any unused amount can be withdrawn after the circle ends.</span></div>
                  </>
                )}
                {!selectedCircle && <label>Circle link or address<input value={circleAddressInput} onChange={(event) => setCircleAddressInput(event.target.value)} placeholder="Paste an invite link or circle address" required /></label>}
                {tokenBalance !== null && tokenBalance === 0n && (
                  <p className="form-help">
                    This wallet has no test USDC yet. Test funds are issued to
                    approved devnet wallets.
                  </p>
                )}
                <button
                  className="button button-primary form-submit"
                  disabled={busy || !wallet.publicKey || Boolean(selectedMember || selectedCancelled || (selectedCircle && selectedCircle.account.memberCount >= selectedCircle.account.maxMembers))}
                >
                  {selectedMember ? "You are a member" : busy ? "Waiting for wallet" : "Choose turn and join"}
                </button>
              </form>
            )}
          </motion.section>
        </div>
      )}

      {cancelConfirmOpen && (
        <div className="dialog-backdrop" role="presentation">
          <motion.section className="dialog-panel confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <div className="dialog-head">
              <div><span className="eyebrow">Cancel circle</span><h2 id="cancel-dialog-title">Cancel this circle?</h2></div>
              <button className="icon-button" aria-label="Close dialog" onClick={() => setCancelConfirmOpen(false)}><X size={19} /></button>
            </div>
            <p>Members get their deposits back. This cannot be undone.</p>
            <div className="dialog-actions">
              <button className="button button-quiet" onClick={() => setCancelConfirmOpen(false)} disabled={busy}>Cancel</button>
              <button className="button button-primary" onClick={() => void cancelCircle()} disabled={busy}>{busy ? "Cancelling" : "Confirm"}</button>
            </div>
          </motion.section>
        </div>
      )}

      {notice && (
        <div
          className={`toast ${noticeError ? "toast-error" : ""}`}
          role="status"
        >
          {notice}
          {noticeLink && (
            <a href={noticeLink} target="_blank" rel="noreferrer">
              View transaction
            </a>
          )}
          {shareReady && <Check size={16} />}
        </div>
      )}
    </main>
  );
}
