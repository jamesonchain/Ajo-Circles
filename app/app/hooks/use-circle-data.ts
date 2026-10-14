"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { readTokenBalance } from "../lib/token-balance";
import { useConnection, useWallet, type WalletContextState } from "@solana/wallet-adapter-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import {
  AjoCirclesClient,
  decodeCircle,
  decodeMember,
  type AjoCircles,
  type WalletCircle,
} from "ajo_circles_sdk";
import { IDL } from "ajo_circles_sdk";

const retryDelays = [250, 750, 1500];

function isRateLimited(error: unknown) {
  return /429|rate.?limit|too many requests/i.test(
    error instanceof Error ? error.message : String(error)
  );
}

function rpcReason(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const reason = message.replace(/^Error:\s*/i, "").split("\n")[0].trim();
  return reason || "The RPC did not provide a reason.";
}

function balanceMint(fallback: PublicKey) {
  const configured = process.env.NEXT_PUBLIC_TEST_MINT_ADDRESS;
  return configured ? new PublicKey(configured) : fallback;
}

async function withRpcRetry<T>(
  task: () => Promise<T>,
  onRetry: () => void,
  onSuccess: () => void
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const result = await task();
      onSuccess();
      return result;
    } catch (error) {
      if (!isRateLimited(error) || attempt >= retryDelays.length) throw error;
      onRetry();
      await new Promise((resolve) => window.setTimeout(resolve, retryDelays[attempt]));
    }
  }
}

const readOnlyWallet = {
  publicKey: PublicKey.default,
  signTransaction: async () => {
    throw new Error("Connect a wallet to approve this transaction");
  },
  signAllTransactions: async () => {
    throw new Error("Connect a wallet to approve this transaction");
  },
} as unknown as anchor.Wallet;

type CircleAccount = Awaited<ReturnType<AjoCirclesClient["fetchCircle"]>>;
type CircleRow = { address: PublicKey; account: CircleAccount };
type MemberAccount = Awaited<ReturnType<AjoCirclesClient["fetchMember"]>>;
type ApiAccount = { address: string; data: string };
type ApiCircles = { circles: ApiAccount[]; members: ApiAccount[]; stale: boolean; reason?: string };

function sortCircleRows(left: CircleRow, right: CircleRow) {
  const leftCreated = left.account?.createdTs;
  const rightCreated = right.account?.createdTs;
  if (leftCreated && rightCreated) {
    const compared = rightCreated.cmp(leftCreated);
    if (compared !== 0) return compared;
  }
  return left.address.toBase58().localeCompare(right.address.toBase58());
}

async function fetchCircleDirectory(wallet?: string) {
  const response = await fetch(wallet ? `/api/circles?wallet=${encodeURIComponent(wallet)}` : "/api/circles");
  const value = (await response.json()) as ApiCircles & { error?: string };
  if (!response.ok) throw new Error(value.error ?? "The circle directory could not be loaded.");
  return value;
}

export function useCircleData(selectedCircleAddress = "", walletOverride?: WalletContextState) {
  const { connection } = useConnection();
  const adapterWallet = useWallet();
  const wallet = walletOverride ?? adapterWallet;
  const walletKey = wallet.publicKey?.toBase58() ?? "";
  const queryClient = useQueryClient();
  const { data: directoryData, refetch: refetchDirectory } = useQuery({
    queryKey: ["circles", "directory", walletKey],
    queryFn: () => fetchCircleDirectory(),
    placeholderData: keepPreviousData,
    staleTime: 4_000,
    refetchInterval: () =>
      walletKey && typeof document !== "undefined" && document.visibilityState === "visible"
        ? 6_000
        : false,
  });
  const { data: walletData, refetch: refetchWallet } = useQuery({
    queryKey: ["circles", "wallet", walletKey],
    queryFn: () => fetchCircleDirectory(wallet.publicKey!.toBase58()),
    enabled: Boolean(walletKey),
    staleTime: 4_000,
    refetchInterval: () =>
      walletKey && typeof document !== "undefined" && document.visibilityState === "visible"
        ? 6_000
        : false,
  });
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [directoryMembers, setDirectoryMembers] = useState<{ address: PublicKey; account: MemberAccount }[]>([]);
  const [memberships, setMemberships] = useState<WalletCircle[]>([]);
  const [score, setScore] =
    useState<Awaited<ReturnType<AjoCirclesClient["fetchScore"]>>>(null);
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
  const [solBalance, setSolBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const rateLimitFailures = useRef(0);
  const hasLoaded = useRef(false);
  const currentWalletKey = useRef(walletKey);
  const previousWalletKey = useRef("");
  useEffect(() => {
    currentWalletKey.current = walletKey;
  }, [walletKey]);
  const onRpcRetry = useCallback(() => {
    rateLimitFailures.current += 1;
    if (rateLimitFailures.current >= 3) setError("The network is busy, retrying");
  }, []);
  const onRpcSuccess = useCallback(() => {
    rateLimitFailures.current = 0;
    setError("");
  }, []);

  const readBalances = useCallback(async (owner: PublicKey, mint: PublicKey) => {
    const sol = await connection.getBalance(owner, "confirmed");
    let usdc = 0n;
    try {
      usdc = await readTokenBalance(connection, owner, mint);
    } catch (error) {
      console.warn("[Ajo Circles] USDC balance unavailable", error);
    }
    return {
      sol: BigInt(sol),
      usdc,
    };
  }, [connection]);

  const clearWalletData = useCallback(() => {
    hasLoaded.current = false;
    setMemberships([]);
    setScore(null);
    setTokenBalance(null);
    setSolBalance(null);
    setLoading(true);
  }, []);

  useEffect(() => {
    const previous = previousWalletKey.current;
    if (previous && previous !== walletKey) {
      void queryClient.cancelQueries({ queryKey: ["circles", "wallet", previous], exact: true });
      queryClient.removeQueries({ queryKey: ["circles", "wallet", previous], exact: true });
    }
    if (!walletKey) {
      const walletQueries = (query: { queryKey: readonly unknown[] }) =>
        query.queryKey[0] === "circles" && query.queryKey[1] === "wallet";
      void queryClient.cancelQueries({ predicate: walletQueries });
      queryClient.removeQueries({ predicate: walletQueries });
    }
    previousWalletKey.current = walletKey;
    const timer = window.setTimeout(clearWalletData, 0);
    return () => window.clearTimeout(timer);
  }, [clearWalletData, queryClient, walletKey]);

  const optimisticBalances = useCallback((usdc: bigint, sol: bigint) => {
    setTokenBalance((current) => (current ?? 0n) + usdc);
    setSolBalance((current) => (current ?? 0n) + sol);
  }, []);

  const invalidateDirectory = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["circles", "directory", walletKey] });
    if (walletKey) {
      void queryClient.invalidateQueries({ queryKey: ["circles", "wallet", walletKey] });
    }
  }, [queryClient, walletKey]);

  const provider = useMemo(() => {
    const signedWallet =
      wallet.publicKey && wallet.signTransaction
        ? (wallet as unknown as anchor.Wallet)
        : readOnlyWallet;
    return new anchor.AnchorProvider(connection, signedWallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
  }, [
    wallet,
    connection,
  ]);

  const client = useMemo(
    () =>
      new AjoCirclesClient(
        new anchor.Program<AjoCircles>(IDL as unknown as AjoCircles, provider)
      ),
    [provider]
  );

  const decodeDirectory = useCallback((value: ApiCircles | undefined) => {
    if (!value) return { circles: [] as CircleRow[], members: [] as { address: PublicKey; account: MemberAccount }[] };
    return {
      circles: value.circles.flatMap(({ address, data }) => {
        try {
          return [{ address: new PublicKey(address), account: decodeCircle(Buffer.from(data, "base64")) }];
        } catch (error) {
          console.warn("[Ajo Circles] skipped an undecodable Circle account", address, error);
          return [];
        }
      }),
      members: value.members.flatMap(({ address, data }) => {
        try {
          return [{ address: new PublicKey(address), account: decodeMember(Buffer.from(data, "base64")) }];
        } catch (error) {
          console.warn("[Ajo Circles] skipped an undecodable Member account", address, error);
          return [];
        }
      }),
    };
  }, []);

  useEffect(() => {
    if (!directoryData) return;
    const decoded = decodeDirectory(directoryData);
    const timer = window.setTimeout(() => {
      setCircles(decoded.circles);
      setDirectoryMembers(decoded.members);
      if (directoryData.stale && directoryData.reason) {
        setError(`RPC rejected the request: ${directoryData.reason}`);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [decodeDirectory, directoryData]);

  useEffect(() => {
    if (!walletData || !wallet.publicKey) return;
    const decoded = decodeDirectory(walletData);
    const circlesByAddress = new Map(decoded.circles.map((row) => [row.address.toBase58(), row]));
    const joined = decoded.members.flatMap((member) => {
      const circle = circlesByAddress.get(member.account.circle.toBase58());
      return circle ? [{ memberAddress: member.address, member: member.account, circleAddress: circle.address, circle: circle.account }] : [];
    });
    const joinedAddresses = new Set(joined.map((row) => row.circleAddress.toBase58()));
    const timer = window.setTimeout(() => setMemberships([
      ...joined,
      ...decoded.circles
        .filter((row) => row.account.creator.equals(wallet.publicKey!))
        .filter((row) => !joinedAddresses.has(row.address.toBase58()))
        .map((row) => ({ memberAddress: null, member: null, circleAddress: row.address, circle: row.account })),
    ]), 0);
    return () => window.clearTimeout(timer);
  }, [decodeDirectory, wallet.publicKey, walletData]);

  const refresh = useCallback(async () => {
    const requestWalletKey = walletKey;
    if (!hasLoaded.current) setLoading(true);
    setError("");
    try {
      const [directoryResult, walletResult] = await Promise.all([
        refetchDirectory(),
        wallet.publicKey ? refetchWallet() : Promise.resolve({ data: undefined, error: null }),
      ]);
      if (directoryResult.error) throw directoryResult.error;
      if (walletResult.error) throw walletResult.error;
      if (currentWalletKey.current !== requestWalletKey) return;
      const directory = decodeDirectory(directoryResult.data);
      setCircles(directory.circles.sort(sortCircleRows));
      setDirectoryMembers(directory.members);
      if (requestWalletKey && wallet.publicKey) {
        const [walletCircles, walletScore, config] = await withRpcRetry(
          () =>
            Promise.all([
              Promise.resolve(decodeDirectory(walletResult.data)),
              client.fetchScore(wallet.publicKey!),
              client.fetchConfig(),
            ]),
          onRpcRetry,
          onRpcSuccess
        );
        const joined = walletCircles.members.flatMap((member) => {
          const circle = walletCircles.circles.find((row) => row.address.equals(member.account.circle));
          return circle ? [{ memberAddress: member.address, member: member.account, circleAddress: circle.address, circle: circle.account }] : [];
        });
        const joinedAddresses = new Set(joined.map((row) => row.circleAddress.toBase58()));
        setMemberships([...joined, ...walletCircles.circles.filter((row) => row.account.creator.equals(wallet.publicKey!)).filter((row) => !joinedAddresses.has(row.address.toBase58())).map((row) => ({ memberAddress: null, member: null, circleAddress: row.address, circle: row.account }))]);
        setScore(walletScore);
        const mint = balanceMint(config.mint);
        console.debug("[Ajo Circles] balance source", {
          publicKey: wallet.publicKey.toBase58(),
          cluster: "devnet",
          mint: mint.toBase58(),
        });
        const balances = await withRpcRetry(
          () => readBalances(wallet.publicKey!, mint),
          onRpcRetry,
          onRpcSuccess
        );
        if (currentWalletKey.current !== requestWalletKey) return;
        setSolBalance(balances.sol);
        setTokenBalance(balances.usdc);
      } else {
        setMemberships([]);
        setScore(null);
        setTokenBalance(null);
        setSolBalance(null);
      }
    } catch (cause) {
      console.error("[Ajo Circles] RPC request failed", cause);
      if (!isRateLimited(cause)) setError(`RPC rejected the request: ${rpcReason(cause)}`);
    } finally {
      hasLoaded.current = true;
      setLoading(false);
    }
  }, [client, decodeDirectory, onRpcRetry, onRpcSuccess, readBalances, refetchDirectory, refetchWallet, wallet.publicKey, walletKey]);

  const refreshSelected = useCallback(async () => {
    const requestWalletKey = walletKey;
    if (!selectedCircleAddress || !requestWalletKey) return;
    try {
      const address = new PublicKey(selectedCircleAddress);
      const [account, member, selectedScore] = await withRpcRetry(
        () => Promise.all([
          client.fetchCircle(address),
          wallet.publicKey ? client.fetchMemberForWallet(address, wallet.publicKey) : Promise.resolve(null),
          wallet.publicKey ? client.fetchScore(wallet.publicKey) : Promise.resolve(null),
        ]),
        onRpcRetry,
        onRpcSuccess
      );
      if (currentWalletKey.current !== requestWalletKey) return;
      setCircles((current) => {
        const next = current.filter((row) => !row.address.equals(address));
        return [...next, { address, account }].sort(sortCircleRows);
      });
      if (wallet.publicKey) {
        setScore(selectedScore);
        const balances = await withRpcRetry(
          () => readBalances(wallet.publicKey!, balanceMint(account.mint)),
          onRpcRetry,
          onRpcSuccess
        );
        setSolBalance(balances.sol);
        setTokenBalance(balances.usdc);
        const walletPublicKey = wallet.publicKey;
        setMemberships((current) => {
          const withoutCircle = current.filter((row) => !row.circleAddress.equals(address));
          if (member) {
            return [{
              memberAddress: client.member(address, wallet.publicKey!),
              member,
              circleAddress: address,
              circle: account,
            }, ...withoutCircle];
          }
          if (account.creator.equals(walletPublicKey)) {
            return [{ memberAddress: null, member: null, circleAddress: address, circle: account }, ...withoutCircle];
          }
          return withoutCircle;
        });
      }
    } catch (cause) {
      console.error("[Ajo Circles] RPC request failed", cause);
      if (!isRateLimited(cause)) setError(`RPC rejected the request: ${rpcReason(cause)}`);
    }
  }, [client, onRpcRetry, onRpcSuccess, readBalances, selectedCircleAddress, wallet.publicKey, walletKey]);

  const markCircleCancelled = useCallback((address: PublicKey) => {
    setCircles((current) =>
      current.map((row) =>
        row.address.equals(address)
          ? { ...row, account: { ...row.account, status: { cancelled: {} } } }
          : row
      )
    );
    setMemberships((current) =>
      current.map((row) =>
        row.circleAddress.equals(address)
          ? { ...row, circle: { ...row.circle, status: { cancelled: {} } } }
          : row
      )
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (!selectedCircleAddress || !walletKey) return;
    const initial = window.setTimeout(() => void refreshSelected(), 0);
    const poll = () => {
      if (document.visibilityState === "visible") void refreshSelected();
    };
    const timer = window.setInterval(poll, 6_000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [refreshSelected, selectedCircleAddress, walletKey]);

  return {
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
    directoryMembers,
    invalidateDirectory,
    clearWalletData,
    optimisticBalances,
    markCircleCancelled,
    wallet,
  };
}
