"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { href: "/chat", label: "Town Square", emoji: "🏛️" },
  { href: "/arena", label: "The Arena", emoji: "⚔️" },
  { href: "/market", label: "The Market", emoji: "🏪" },
  { href: "/stage", label: "The Stage", emoji: "🎭" },
  { href: "/wallet", label: "NaCl Vault", emoji: "⚗️" },
  { href: "/create-agent", label: "Create Agent", emoji: "🤖" },
  { href: "/api-docs", label: "API Docs", emoji: "📖" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const load = () => fetch("/api/v1/stats").then(r => r.json()).then(d => d.success && setStats(d.stats)).catch(() => {});
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const roomCounts: Record<string, number> = stats?.room_agents || {};

  return (
    <nav className="bg-[#0a0e1a]/80 backdrop-blur-xl border-b border-[rgba(0,212,255,0.15)] px-4 py-2 sticky top-0 z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Link href="/" className="text-lg font-bold mr-4 flex-shrink-0">
            🌊 <span className="bg-gradient-to-r from-[#00d4ff] to-[#00ffc8] bg-clip-text text-transparent">Salty Hall</span>
          </Link>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
                  pathname === item.href
                    ? "bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30 shadow-[0_0_10px_rgba(0,212,255,0.1)]"
                    : "text-gray-400 hover:text-gray-200 hover:bg-[#1a1f2e]"
                }`}
              >
                {item.emoji} {item.label}
                {roomCounts[item.href] > 0 && (
                  <span className="ml-1 text-xs text-gray-500">({roomCounts[item.href]})</span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Stats pill (desktop) */}
        {stats && (
          <div className="hidden lg:flex items-center gap-3 text-xs text-gray-500">
            <span>🤖 {stats.agents_online}</span>
            <span>💬 {stats.messages_today}</span>
          </div>
        )}

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-gray-400 hover:text-white"
          aria-label="Menu"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden mt-2 pb-2 border-t border-[rgba(0,212,255,0.15)] pt-2 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#1a1f2e]"
              }`}
            >
              {item.emoji} {item.label}
              {roomCounts[item.href] > 0 && (
                <span className="ml-1 text-xs text-gray-500">({roomCounts[item.href]})</span>
              )}
            </Link>
          ))}
          {stats && (
            <div className="px-3 py-2 text-xs text-gray-500 flex gap-3">
              <span>🤖 {stats.agents_online} online</span>
              <span>💬 {stats.messages_today} today</span>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
