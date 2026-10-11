"use client";

import { useEffect, useMemo, useState } from "react";
import { Keypair, type Connection, type SendOptions, type Transaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

const storageKey = "ajo-circles-demo-wallets-v1";
const names = ["Ada", "Tunde", "Chioma"];

export type DemoWalletInfo = {
  name: string;
  publicKey: import("@solana/web3.js").PublicKey;
};

type DemoWalletState = {
  mode: "phantom" | "demo";
  activeIndex: number;
  wallets: DemoWalletInfo[];
  activeWallet: WalletContextState | null;
  setMode: (mode: "phantom" | "demo") => void;
  setActiveIndex: (index: number) => void;
};

export function useDemoWallet(connection: Connection): DemoWalletState {
  const [keypairs, setKeypairs] = useState<Keypair[]>([]);
  const [mode, setMode] = useState<"phantom" | "demo">("phantom");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    const next = stored
      ? (JSON.parse(stored) as number[][]).map((secret) => Keypair.fromSecretKey(Uint8Array.from(secret)))
      : names.map(() => Keypair.generate());
    if (!stored) window.localStorage.setItem(storageKey, JSON.stringify(next.map((keypair) => Array.from(keypair.secretKey))));
    const timer = window.setTimeout(() => setKeypairs(next), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const activeKeypair = keypairs[activeIndex];
  const activeWallet = useMemo(() => {
    if (mode !== "demo" || !activeKeypair) return null;
    const wallet = {
      publicKey: activeKeypair.publicKey,
      connected: true,
      connecting: false,
      disconnecting: false,
      wallet: null,
      signTransaction: async <T extends Transaction>(transaction: T) => {
        transaction.partialSign(activeKeypair);
        return transaction;
      },
      signAllTransactions: async <T extends Transaction[]>(transactions: T) => {
        transactions.forEach((transaction) => transaction.partialSign(activeKeypair));
        return transactions;
      },
      sendTransaction: async (transaction: Transaction, sendConnection: Connection, options?: SendOptions) => {
        transaction.partialSign(activeKeypair);
        return sendConnection.sendRawTransaction(transaction.serialize(), options);
      },
      connect: async () => undefined,
      disconnect: async () => undefined,
      select: () => undefined,
    } as unknown as WalletContextState;
    return wallet;
  }, [activeKeypair, mode]);

  return {
    mode,
    activeIndex,
    wallets: keypairs.map((keypair, index) => ({ name: names[index], publicKey: keypair.publicKey })),
    activeWallet,
    setMode,
    setActiveIndex,
  };
}
