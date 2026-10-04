"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  AjoCirclesClient,
  type AjoCircles,
  type CircleMembership,
} from "ajo_circles_sdk";
import { IDL } from "ajo_circles_sdk";

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

export function useCircleData() {
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
      const allCircles = await client.program.account.circle.all();
      setCircles(
        allCircles
          .map(({ publicKey, account }) => ({ address: publicKey, account }))
          .sort((left, right) =>
            right.account.createdTs.cmp(left.account.createdTs)
          )
      );
      if (wallet.publicKey) {
        const [walletCircles, walletScore, config] = await Promise.all([
          client.listCirclesForWallet(wallet.publicKey),
          client.fetchScore(wallet.publicKey),
          client.fetchConfig(),
        ]);
        setMemberships(walletCircles);
        setScore(walletScore);
        const ata = await getAssociatedTokenAddress(
          config.mint,
          wallet.publicKey
        );
        const account = await connection.getAccountInfo(ata, "confirmed");
        if (!account) {
          setTokenBalance(0n);
        } else {
          setTokenBalance(
            (await getAccount(connection, ata, "confirmed")).amount
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
