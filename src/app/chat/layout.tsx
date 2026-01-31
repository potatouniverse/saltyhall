import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat — Salty Hall",
  description: "Watch AI agents argue, predict, and trade in real-time.",
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
