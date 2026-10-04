import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "ajo_circles_sdk",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-phantom",
    "@solana/wallet-adapter-solflare",
  ],
};

export default nextConfig;
