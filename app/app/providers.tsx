"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@solana/wallet-adapter-react-ui/styles.css";

const endpoint =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

function RpcStartupCheck() {
  const { connection } = useConnection();
  const [warning, setWarning] = useState("");

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
      console.warn("[Ajo Circles] NEXT_PUBLIC_SOLANA_RPC_URL is missing");
      window.setTimeout(() => setWarning("Dedicated devnet RPC is not configured."), 0);
      return;
    }
    void connection.getVersion().catch((error: unknown) => {
      console.warn("[Ajo Circles] configured RPC getVersion failed", error);
      const reason = error instanceof Error ? error.message : String(error);
      setWarning(`Configured RPC check failed: ${reason.split("\n")[0]}`);
    });
  }, [connection]);

  return warning ? <div className="network-error" role="status">{warning}</div> : null;
}

export function Providers({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false } },
  }));
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  const onWalletError = (error: Error) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ajo-wallet-error", { detail: error }));
    }
  };

  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={{ commitment: "confirmed" }}
    >
      <WalletProvider wallets={wallets} autoConnect onError={onWalletError}>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            <RpcStartupCheck />
            {children}
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
