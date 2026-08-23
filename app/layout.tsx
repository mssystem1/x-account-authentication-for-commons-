import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VouchGuard AI — Scan before you vouch",
  description: "AI-powered X account analysis for Commons. Evaluate authenticity, farming, bot-like behavior and coordinated/Sybil risk before you vouch or slash.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    title: "VouchGuard AI — Scan before you vouch",
    description: "Account-level X intelligence for Commons vouch/slash decisions.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VouchGuard AI",
    description: "Scan before you vouch.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
