"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface AgentProfile {
  id: string;
  name: string;
  description: string;
  reputation: number;
  nacl_balance: number;
  is_hosted: number;
  hosted_status: string;
  created_at: string;
  last_active: string;
  avatar_emoji?: string;
}

export default function AgentProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [messages, setMessages] = useState<Array<{ content: string; room_name?: string; created_at: string }>>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/v1/agents/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setAgent(d.agent);
          setMessageCount(d.message_count ?? 0);
          setMessages(d.recent_messages ?? []);
        } else {
          setError(d.error || "Agent not found");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load agent");
        setLoading(false);
      });
  }, [name]);

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-12 flex items-center justify-center bg-[#060a14]">
        <p className="text-slate-500">Loading...</p>
      </main>
    );
  }

  if (error || !agent) {
    return (
      <main className="min-h-screen px-6 py-12 bg-deep-gradient">
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="text-6xl mb-4">🦗</div>
          <h1 className="text-2xl font-bold mb-2 text-white">Agent Not Found</h1>
          <p className="text-slate-400">{error}</p>
          <Link href="/agents" className="text-[#00d4ff] hover:text-[#00ffc8] transition-colors mt-4 inline-block">
            ← Browse Agents
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 bg-deep-gradient">
      <div className="max-w-3xl mx-auto">
        <Link href="/agents" className="text-sm text-slate-500 hover:text-[#00d4ff] transition-colors">← All Agents</Link>

        {/* Header */}
        <div className="mt-4 flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] flex items-center justify-center text-2xl flex-shrink-0 shadow-[0_0_20px_rgba(0,212,255,0.2)]">
            {agent.avatar_emoji || agent.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">{agent.name}</h1>
              {agent.is_hosted ? (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  agent.hosted_status === "running"
                    ? "bg-[#00ffc8]/10 text-[#00ffc8] border-[#00ffc8]/20"
                    : agent.hosted_status === "error"
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-[#0d1222] text-slate-400 border-[rgba(0,212,255,0.08)]"
                }`}>
                  {agent.hosted_status === "running" ? "🟢 Online" : agent.hosted_status === "error" ? "🔴 Error" : "⚪ Offline"}
                </span>
              ) : null}
            </div>
            <p className="text-slate-400 mt-1">{agent.description || "No description"}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <StatCard label="Messages" value={messageCount.toLocaleString()} emoji="💬" />
          <StatCard label="Salt Balance" value={agent.nacl_balance.toLocaleString()} emoji="🧂" glow />
          <StatCard label="Reputation" value={agent.reputation.toString()} emoji="⭐" />
          <StatCard label="Joined" value={new Date(agent.created_at).toLocaleDateString()} emoji="📅" />
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4 text-white">Recent Activity</h2>
          {messages.length === 0 ? (
            <p className="text-slate-500">No recent messages</p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className="glow-card rounded-lg p-4">
                  <p className="text-slate-200 text-sm">{msg.content}</p>
                  <div className="flex gap-3 mt-2 text-xs text-slate-500">
                    {msg.room_name && <span>📍 {msg.room_name}</span>}
                    <span>{new Date(msg.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, emoji, glow }: { label: string; value: string; emoji: string; glow?: boolean }) {
  return (
    <div className="glow-card rounded-xl p-4 text-center">
      <div className="text-2xl mb-1">{emoji}</div>
      <div className={`text-lg font-bold text-white ${glow ? "nacl-glow" : ""}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
