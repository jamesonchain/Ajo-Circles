"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { getAccount } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  AjoCirclesClient,
  type AjoCircles,
  type CircleMembership,
} from "ajo_circles_sdk";
import { IDL } from "ajo_circles_sdk";

const retryDelays = [250, 750, 1500];

function isRateLimited(error: unknown) {
  return /429|rate.?limit|too many requests/i.test(
    error instanceof Error ? error.message : String(error)
  );
}

async function withRpcRetry<T>(task: () => Promise<T>, onRetry: () => void) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
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

export function useCircleData(selectedCircleAddress = "") {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [memberships, setMemberships] = useState<CircleMembership[]>([]);
  const [score, setScore] =
    useState<Awaited<ReturnType<AjoCirclesClient["fetchScore"]>>>(null);
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    connection,
    wallet.publicKey,
    wallet.signTransaction,
    wallet.signAllTransactions,
  ]);

  const client = useMemo(
    () =>
      new AjoCirclesClient(
        new anchor.Program<AjoCircles>(IDL as unknown as AjoCircles, provider)
      ),
    [provider]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const allCircles = await withRpcRetry(
        () => client.program.account.circle.all(),
        () => setError("The network is busy, retrying")
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
          () => setError("The network is busy, retrying")
        );
        setMemberships(walletCircles);
        setScore(walletScore);
        const [account] = (
          await withRpcRetry(
            () =>
              connection.getTokenAccountsByOwner(
                wallet.publicKey!,
                { mint: config.mint },
                "confirmed"
              ),
            () => setError("The network is busy, retrying")
          )
        ).value;
        if (!account) {
          setTokenBalance(0n);
        } else {
          setTokenBalance(
            (await getAccount(connection, account.pubkey, "confirmed")).amount
          );
        }
      } else {
        setMemberships([]);
        setScore(null);
        setTokenBalance(null);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Circle information is unavailable right now"
      );
    } finally {
      setLoading(false);
    }
  }, [client, connection, wallet.publicKey]);

  const refreshSelected = useCallback(async () => {
    if (!selectedCircleAddress) return;
    try {
      const address = new PublicKey(selectedCircleAddress);
      const account = await withRpcRetry(
        () => client.fetchCircle(address),
        () => setError("The network is busy, retrying")
      );
      setCircles((current) => {
        const next = current.filter((row) => !row.address.equals(address));
        return [...next, { address, account }].sort((left, right) =>
          right.account.createdTs.cmp(left.account.createdTs)
        );
      });
    } catch (cause) {
      if (isRateLimited(cause)) setError("The network is busy, retrying");
    }
  }, [client, selectedCircleAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedCircleAddress) return;
    void refreshSelected();
    const timer = window.setInterval(() => void refreshSelected(), 15_000);
    return () => window.clearInterval(timer);
  }, [refreshSelected, selectedCircleAddress]);

  return {
    client,
    circles,
    memberships,
    score,
    tokenBalance,
    loading,
    error,
    refresh,
    wallet,
  };
}
