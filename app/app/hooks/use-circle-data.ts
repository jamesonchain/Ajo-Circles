"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { unpackAccount } from "@solana/spl-token";
import { useConnection, useWallet, type WalletContextState } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  AjoCirclesClient,
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

export function useCircleData(selectedCircleAddress = "", walletOverride?: WalletContextState) {
  const { connection } = useConnection();
  const adapterWallet = useWallet();
  const wallet = walletOverride ?? adapterWallet;
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [memberships, setMemberships] = useState<WalletCircle[]>([]);
  const [score, setScore] =
    useState<Awaited<ReturnType<AjoCirclesClient["fetchScore"]>>>(null);
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
  const [solBalance, setSolBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const rateLimitFailures = useRef(0);
  const hasLoaded = useRef(false);
  const onRpcRetry = useCallback(() => {
    rateLimitFailures.current += 1;
    if (rateLimitFailures.current >= 3) setError("The network is busy, retrying");
  }, []);
  const onRpcSuccess = useCallback(() => {
    rateLimitFailures.current = 0;
    setError("");
  }, []);

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

  const refresh = useCallback(async () => {
    if (!hasLoaded.current) setLoading(true);
    setError("");
    try {
      const allCircles = await withRpcRetry(
        () => client.program.account.circle.all(),
        onRpcRetry,
        onRpcSuccess
      );
      setCircles(
        allCircles
          .map(({ publicKey, account }) => ({ address: publicKey, account }))
          .sort((left, right) =>
            right.account.createdTs.cmp(left.account.createdTs)
          )
      );
      if (wallet.publicKey) {
        const [walletCircles, walletScore, config] = await withRpcRetry(
          () =>
            Promise.all([
              client.listCirclesForWallet(wallet.publicKey!),
              client.fetchScore(wallet.publicKey!),
              client.fetchConfig(),
            ]),
          onRpcRetry,
          onRpcSuccess
        );
        setMemberships(walletCircles);
        setScore(walletScore);
        setSolBalance(BigInt(await connection.getBalance(wallet.publicKey, "confirmed")));
        const [account] = (
          await withRpcRetry(
            () =>
              connection.getTokenAccountsByOwner(
                wallet.publicKey!,
                { mint: config.mint },
                "confirmed"
              ),
            onRpcRetry,
            onRpcSuccess
          )
        ).value;
        if (!account) {
          setTokenBalance(0n);
        } else {
          setTokenBalance(unpackAccount(account.pubkey, account.account, config.mint).amount);
        }
      } else {
        setMemberships([]);
        setScore(null);
        setTokenBalance(null);
        setSolBalance(null);
      }
    } catch (cause) {
      if (!isRateLimited(cause)) setError("Circle information is unavailable right now");
    } finally {
      hasLoaded.current = true;
      setLoading(false);
    }
  }, [client, connection, onRpcRetry, onRpcSuccess, wallet.publicKey]);

  const refreshSelected = useCallback(async () => {
    if (!selectedCircleAddress) return;
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
      setCircles((current) => {
        const next = current.filter((row) => !row.address.equals(address));
        return [...next, { address, account }].sort((left, right) =>
          right.account.createdTs.cmp(left.account.createdTs)
        );
      });
      if (wallet.publicKey) {
        setScore(selectedScore);
        setSolBalance(BigInt(await connection.getBalance(wallet.publicKey, "confirmed")));
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
      if (!isRateLimited(cause)) setError("Circle information is unavailable right now");
    }
  }, [client, connection, onRpcRetry, onRpcSuccess, selectedCircleAddress, wallet.publicKey]);

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
    if (!selectedCircleAddress) return;
    const initial = window.setTimeout(() => void refreshSelected(), 0);
    const poll = () => {
      if (document.visibilityState === "visible") void refreshSelected();
    };
    const timer = window.setInterval(poll, 8_000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [refreshSelected, selectedCircleAddress]);

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
    markCircleCancelled,
    wallet,
  };
}
