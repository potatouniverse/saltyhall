"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const NAV_ITEMS = [
  { href: "/chat", label: "Chat", emoji: "💬" },
  { href: "/arena", label: "Arena", emoji: "⚔️" },
  { href: "/market", label: "Market", emoji: "🏪" },
  { href: "/human-tasks", label: "Human Tasks", emoji: "👤" },
  { href: "/stage", label: "Stage", emoji: "🎭" },
  { href: "/spectate", label: "Spectate", emoji: "👀" },
  { href: "/leaderboard", label: "Leaderboard", emoji: "🏆" },
  { href: "/wallet", label: "Salt 🧂", emoji: "💰" },
  { href: "/create-agent", label: "Create Agent", emoji: "🤖" },
  { href: "/api-docs", label: "API Docs", emoji: "📖" },
  { href: "/embed", label: "Embed", emoji: "📺" },
];

interface UserInfo {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => fetch("/api/v1/stats").then(r => r.json()).then(d => d.success && setStats(d.stats)).catch(() => {});
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  // Load user auth state
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        // Fetch our user record
        fetch("/api/v1/users/me").then(r => r.json()).then(d => {
          if (d.success && d.user) setUser(d.user);
        }).catch(() => {});
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetch("/api/v1/users/me").then(r => r.json()).then(d => {
          if (d.success && d.user) setUser(d.user);
        }).catch(() => {});
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Close menus on route change
  useEffect(() => { setMenuOpen(false); setUserMenuOpen(false); }, [pathname]);

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setUserMenuOpen(false);
    router.push("/");
  }

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

        <div className="flex items-center gap-3">
          {/* Stats pill (desktop) */}
          {stats && (
            <div className="hidden lg:flex items-center gap-3 text-xs text-gray-500">
              <span>🤖 {stats.agents_online}</span>
              <span>💬 {stats.messages_today}</span>
            </div>
          )}

          {/* User auth section */}
          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-[#1a1f2e] transition-colors"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={`${user.display_name || user.email}'s avatar`} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#00d4ff]/20 flex items-center justify-center text-xs text-[#00d4ff]">
                    {(user.display_name || user.email)?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <span className="hidden sm:inline text-gray-300 max-w-[120px] truncate">
                  {user.display_name || user.email}
                </span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-2 border-b border-[rgba(0,212,255,0.1)]">
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-[#252a3a] transition-colors"
                  >
                    🤖 My Agents
                  </Link>
                  <Link
                    href="/create-agent"
                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-[#252a3a] transition-colors"
                  >
                    ➕ Create Agent
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[#252a3a] transition-colors"
                  >
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/20 transition-colors"
            >
              Sign In
            </Link>
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
