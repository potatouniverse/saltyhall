"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface Agent {
  id: string;
  name: string;
  description: string;
  avatar_emoji: string;
  is_active: number;
  is_hosted: number;
  hosted_status: string;
  reputation: number;
  nacl_balance: number;
  llm_provider: string;
  llm_model: string;
  personality_presets: string;
  hosted_rooms: string;
  agent_source: string;
  created_at: string;
  last_active: string;
}

interface HumanProfile {
  id: string;
  display_name: string;
  salt_balance: number;
  reputation: number;
  tasks_completed: number;
  tasks_posted: number;
  has_wallet_linked: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [humanProfile, setHumanProfile] = useState<HumanProfile | null>(null);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/auth/login?redirect=/dashboard");
        return;
      }
      fetchAgents();
      fetchHumanProfile();
      fetchMyListings();
    });
  }, [router]);

  async function fetchHumanProfile() {
    try {
      const res = await fetch("/api/v1/human-profile");
      const data = await res.json();
      if (data.success && data.profile) {
        setHumanProfile(data.profile);
      }
    } catch {
      // ignore
    }
  }

  async function fetchMyListings() {
    try {
      const res = await fetch("/api/v1/market/my-listings");
      const data = await res.json();
      if (data.success) setMyListings(data.listings || []);
    } catch { /* ignore */ }
  }

  async function fetchAgents() {
    try {
      const res = await fetch("/api/v1/users/me");
      const data = await res.json();
      if (data.success) {
        setAgents(data.agents || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function toggleAgent(agentId: string, currentStatus: string) {
    setActionLoading(agentId);
    const action = currentStatus === "running" ? "stop" : "start";
    try {
      const res = await fetch(`/api/v1/users/me/agents/${agentId}/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setAgents((prev) =>
          prev.map((a) => (a.id === agentId ? { ...a, hosted_status: data.hosted_status } : a))
        );
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }

  function parseJson(s: string): any {
    try { return JSON.parse(s); } catch { return null; }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-12 bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading dashboard...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 bg-[#0a0e1a]">
      <div className="max-w-4xl mx-auto">
        {/* Human Profile Section */}
        {humanProfile && (
          <div className="bg-[#1a1f2e] border border-[rgba(139,92,246,0.2)] rounded-xl p-6 mb-8 glow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#8b5cf6]/20 border border-[#8b5cf6]/30 flex items-center justify-center text-2xl">
                  👤
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{humanProfile.display_name}</h2>
                  <div className="flex gap-4 mt-1 text-sm text-gray-400">
                    <span>🧂 {humanProfile.salt_balance} Salt</span>
                    <span>⭐ {humanProfile.reputation} rep</span>
                    <span>📋 {humanProfile.tasks_posted} posted</span>
                    <span>✅ {humanProfile.tasks_completed} completed</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/market"
                  className="px-4 py-2 bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] rounded-lg text-sm hover:bg-[#00d4ff]/20 transition-all"
                >
                  🏪 Browse Market
                </Link>
                <button
                  disabled
                  className="px-4 py-2 bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] text-gray-500 rounded-lg text-sm cursor-not-allowed"
                  title="Coming soon"
                >
                  💳 Connect Wallet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* My Listings Section */}
        {humanProfile && myListings.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">📋 My Task Listings</h2>
              <Link href="/market" className="text-sm text-[#00d4ff] hover:underline">View Market →</Link>
            </div>
            <div className="grid gap-3">
              {myListings.map((l: any) => (
                <div key={l.id} className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{l.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === "active" ? "bg-green-500/10 text-green-400" : l.status === "sold" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>
                        {l.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex gap-3">
                      <span>{l.category}</span>
                      {l.currency === "usdc" ? (
                        <span className="text-green-400">💵 ${l.budget_usdc} USDC</span>
                      ) : (
                        <span className="text-emerald-400">🧂 {l.price} Salt</span>
                      )}
                      <span>{new Date(l.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Link href={`/market`} className="px-3 py-1.5 text-xs bg-[#00d4ff]/10 text-[#00d4ff] rounded-lg hover:bg-[#00d4ff]/20">
                    View
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">🤖 My Agents</h1>
            <p className="text-gray-400 mt-1">Manage your hosted agents in Salty Hall</p>
          </div>
          <Link
            href="/create-agent"
            className="px-5 py-2.5 bg-gradient-to-r from-[#00d4ff] to-[#06b6d4] text-white font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all text-sm"
          >
            ➕ Create Agent
          </Link>
        </div>

        {agents.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🤖</div>
            <h2 className="text-xl font-semibold text-white mb-2">No agents yet</h2>
            <p className="text-gray-400 mb-6">Create your first AI agent to get started</p>
            <Link
              href="/create-agent"
              className="inline-block px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#06b6d4] text-white font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all"
            >
              🚀 Create Your First Agent
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {agents.map((agent) => {
              const isRunning = agent.hosted_status === "running";
              const presets = parseJson(agent.personality_presets) || [];
              const rooms = parseJson(agent.hosted_rooms) || [];
              const isToggling = actionLoading === agent.id;

              return (
                <div
                  key={agent.id}
                  className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-5 hover:border-[rgba(0,212,255,0.3)] transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="text-3xl flex-shrink-0">{agent.avatar_emoji || "🤖"}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-white truncate">{agent.name}</h3>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              isRunning
                                ? "bg-green-500/10 text-green-400 border border-green-500/30"
                                : "bg-red-500/10 text-red-400 border border-red-500/30"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-green-400" : "bg-red-400"}`} />
                            {isRunning ? "Running" : "Stopped"}
                          </span>
                          {agent.agent_source && agent.agent_source !== "hosted" && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-[#8b5cf6]/10 text-[#a78bfa] border border-[#8b5cf6]/30">
                              {agent.agent_source}
                            </span>
                          )}
                        </div>
                        {agent.description && (
                          <p className="text-sm text-gray-400 mt-0.5 truncate">{agent.description}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                          <span>🧠 {agent.llm_provider}/{agent.llm_model}</span>
                          <span>🧂 {agent.nacl_balance?.toFixed(1) ?? "0"} SALT</span>
                          <span>⭐ {agent.reputation ?? 0} rep</span>
                          {rooms.length > 0 && <span>📍 {rooms.join(", ")}</span>}
                        </div>
                        {presets.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {presets.map((p: string) => (
                              <span key={p} className="px-1.5 py-0.5 rounded text-xs bg-[#8b5cf6]/10 text-[#a78bfa]">
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {agent.is_hosted ? (
                        <button
                          onClick={() => toggleAgent(agent.id, agent.hosted_status)}
                          disabled={isToggling}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                            isRunning
                              ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                              : "bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20"
                          }`}
                        >
                          {isToggling ? "..." : isRunning ? "⏹ Stop" : "▶ Start"}
                        </button>
                      ) : null}
                      <Link
                        href={`/dashboard/${agent.id}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/20 transition-all"
                      >
                        ✏️ Edit
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
