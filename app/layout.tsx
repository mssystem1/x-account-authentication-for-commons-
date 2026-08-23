import type { Metadata } from "next";
import "./globals.css";
import "./integrity.css";

export const metadata: Metadata = {
  title: "VouchGuard AI — Audit the Commons leaderboard",
  description: "Reconstruct Commons vouch/slash support networks and estimate whether a leaderboard position looks organic, reciprocal or coordinated.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    title: "VouchGuard AI — Audit the Commons leaderboard",
    description: "Commons-native supporter graph analysis with deterministic integrity metrics and Grok verdicts.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VouchGuard AI",
    description: "See how a Commons rank was built.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
