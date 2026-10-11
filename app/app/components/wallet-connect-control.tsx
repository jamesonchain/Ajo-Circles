"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

type ConnectState = "idle" | "connecting" | "connected" | "error";

function errorCode(error: unknown) {
  const value = error as { code?: number; message?: string };
  return value?.code ?? Number(value?.message?.match(/-?\d{4,}/)?.[0]);
}

function messageFor(error: unknown) {
  const code = errorCode(error);
  if (code === -32002) return "Phantom has a pending request. Open Phantom and approve it.";
  if (code === 4001) return "The wallet request was cancelled.";
  const message = error instanceof Error ? error.message : String(error);
  return message || "Phantom could not connect. Try again.";
}

function notifyPending(pending: boolean) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ajo-wallet-request", { detail: pending }));
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export function WalletConnectControl({ className = "wallet-button" }: { className?: string }) {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [state, setState] = useState<ConnectState>(wallet.connected ? "connected" : "idle");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const timeout = useRef<number | null>(null);

  useEffect(() => () => {
    if (timeout.current !== null) window.clearTimeout(timeout.current);
    notifyPending(false);
  }, []);

  const cancel = useCallback(async () => {
    if (timeout.current !== null) window.clearTimeout(timeout.current);
    try {
      await wallet.disconnect();
    } catch {
      // The wallet may already have closed the request.
    } finally {
      inFlight.current = false;
      notifyPending(false);
      setState("idle");
    }
  }, [wallet]);

  const connect = useCallback(async () => {
    if (inFlight.current || wallet.connecting || wallet.connected) return;
    inFlight.current = true;
    setState("connecting");
    setError("");
    notifyPending(true);
    try {
      const phantom = wallet.wallets.find(({ adapter }) => adapter.name === "Phantom");
      if (!phantom) {
        setVisible(true);
        throw new Error("Phantom was not detected. Choose Phantom in the wallet list.");
      }
      if (wallet.wallet?.adapter.name !== "Phantom") {
        wallet.select(phantom.adapter.name);
        setVisible(true);
        return;
      }
      const request = wallet.connect();
      await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          timeout.current = window.setTimeout(() => reject(new Error("Phantom did not respond. Open the Phantom icon and approve, or press Try again")), 15_000);
        }),
      ]);
      setState("connected");
    } catch (cause) {
      setState("error");
      setError(messageFor(cause));
    } finally {
      if (timeout.current !== null) window.clearTimeout(timeout.current);
      timeout.current = null;
      inFlight.current = false;
      notifyPending(false);
    }
  }, [wallet, setVisible]);

  const retry = useCallback(async () => {
    await cancel();
    await wait(300);
    await connect();
  }, [cancel, connect]);

  if (wallet.connected) {
    return <button className={className} onClick={() => void wallet.disconnect().then(() => { setState("idle"); setError(""); })}>Disconnect</button>;
  }
  if (state === "connecting" || wallet.connecting) {
    return <span className="wallet-connect-pending"><button className={className} disabled>Check Phantom to approve</button><button className="wallet-cancel" onClick={() => void cancel()}>Cancel</button></span>;
  }
  if (state === "error") {
    return <span className="wallet-connect-error"><span role="status">{error}</span><button className={className} onClick={() => void retry()}>Try again</button></span>;
  }
  return <span className="wallet-connect-control"><button className={className} onClick={() => void connect()}>Connect Phantom</button>{wallet.wallets.length > 1 && <small>More than one wallet extension detected. Choose one.</small>}</span>;
}
