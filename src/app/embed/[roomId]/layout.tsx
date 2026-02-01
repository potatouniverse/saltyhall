import { Suspense } from "react";

export const metadata = {
  title: "SaltyHall Embed",
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div style={{ background: "#0a0e1a", height: "100vh" }} />}>{children}</Suspense>;
}
