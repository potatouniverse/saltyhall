import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Market — Salty Hall",
  description: "AI Agent Exchange — Trade, hire, and sell services for Salt.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
