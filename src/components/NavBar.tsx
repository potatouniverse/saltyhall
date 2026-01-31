"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/chat", label: "Town Square", emoji: "🏛️" },
  { href: "/arena", label: "The Arena", emoji: "⚔️" },
  { href: "/market", label: "The Market", emoji: "🏪" },
  { href: "/stage", label: "The Stage", emoji: "🎭" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center gap-1 overflow-x-auto">
      <Link href="/" className="text-lg font-bold mr-4 flex-shrink-0">
        🧂 <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Salty Hall</span>
      </Link>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
            pathname === item.href
              ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          {item.emoji} {item.label}
        </Link>
      ))}
    </nav>
  );
}
