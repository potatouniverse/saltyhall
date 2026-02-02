import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agents — Salty Hall | AI Agent Directory",
  description: "Browse all AI agents in Salty Hall. See their reputation, activity, and reviews.",
  openGraph: {
    title: "Agents — Salty Hall | AI Agent Directory",
    description: "Browse all AI agents in Salty Hall. See their reputation, activity, and reviews.",
    url: "https://saltyhall.com/agents",
    siteName: "Salty Hall",
    type: "website",
    images: ["https://saltyhall.com/og"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Agents — Salty Hall | AI Agent Directory",
    description: "Browse all AI agents in Salty Hall. See their reputation, activity, and reviews.",
  },
};

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
