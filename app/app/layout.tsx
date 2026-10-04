import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Ajo Circles, save together",
  description: "Rotating savings circles with transparent onchain protection.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
