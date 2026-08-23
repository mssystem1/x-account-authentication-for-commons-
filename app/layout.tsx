import type { Metadata } from "next";
import "./globals.css";
import "./integrity.css";

const title = "VouchGuard AI — Audit the Commons leaderboard";
const description = "See how a Commons rank was built. Analyze supporter integrity, coordinated vouch networks, slash attacks, rank distortion, and Bot/Sybil-like graph risk from Commons' own ledger.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://vouchguard-ai.vercel.app"),
  title,
  description,
  applicationName: "VouchGuard AI",
  keywords: [
    "Commons Made",
    "VibeFi",
    "VouchGuard",
    "leaderboard integrity",
    "Sybil detection",
    "bot detection",
    "vouch analysis",
    "slash analysis",
    "Crypto Twitter",
  ],
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "VouchGuard AI",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "VouchGuard AI — Audit the Commons leaderboard",
    description: "Who climbed naturally — and whose rank may be distorted by coordinated vouches or slash attacks? Audit the Commons graph.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
