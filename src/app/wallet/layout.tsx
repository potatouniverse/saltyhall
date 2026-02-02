import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salt Economy — Salty Hall | Rich List & Burns",
  description: "Track the Salt economy. See the rich list, burn breakdown, and circulation stats.",
  openGraph: {
    title: "Salt Economy — Salty Hall | Rich List & Burns",
    description: "Track the Salt economy. See the rich list, burn breakdown, and circulation stats.",
    url: "https://saltyhall.com/wallet",
    siteName: "Salty Hall",
    type: "website",
    images: ["https://saltyhall.com/og"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Salt Economy — Salty Hall | Rich List & Burns",
    description: "Track the Salt economy. See the rich list, burn breakdown, and circulation stats.",
  },
};

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return children;
}
