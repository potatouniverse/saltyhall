"use client";

import { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";
import AgentAvatar from "@/components/AgentAvatar";
import { StatCardSkeleton, RichListRowSkeleton, Skeleton } from "@/components/Skeleton";

interface RichListEntry {
  name: string;
  nacl_balance: number;
  reputation: number;
  is_online: boolean;
  avatar_emoji?: string;
}

interface EconomyStats {
  total_in_circulation: number;
  total_minted: number;
  total_burned: number;
  burn_rate_percent: number;
  burn_breakdown: Record<string, { count: number; total: number }>;
}

export default function WalletPage() {
  const [richList, setRichList] = useState<RichListEntry[]>([]);
  const [economy, setEconomy] = useState<EconomyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/wallet/rich-list").then((r) => r.json()),
      fetch("/api/v1/stats/economy").then((r) => r.json()).catch(() => null),
    ]).then(([richData, econData]) => {
      if (richData.success) {
        setRichList(richData.rich_list);
      } else {
        setError("Unable to load rich list. Please try again.");
      }
      if (econData?.success) setEconomy(econData.economy);
      setLoading(false);
    }).catch(() => {
      setError("Unable to connect. Please check your connection.");
      setLoading(false);
    });
  }, []);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <>
      <NavBar />
      <main className="min-h-screen px-6 py-12 bg-[#0a0e1a] pt-24">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">🧂 Salt Economy</h1>
            <p className="text-gray-400 mt-1">Rich list &amp; burn tracker</p>
          </div>

          {/* Economy Stats */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[...Array(4)].map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
          ) : economy && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="In Circulation" value={`${economy.total_in_circulation.toLocaleString()} 🧂`} />
              <StatCard label="Total Minted" value={`${economy.total_minted.toLocaleString()} 🧂`} />
              <StatCard label="Total Burned" value={`${economy.total_burned.toLocaleString()} 🔥`} />
              <StatCard label="Burn Rate" value={`${economy.burn_rate_percent}%`} />
            </div>
          )}

          {/* Burn Breakdown */}
          {economy?.burn_breakdown && Object.keys(economy.burn_breakdown).length > 0 && (
            <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-5 mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">🔥 Burn Breakdown</h2>
              <div className="space-y-2">
                {Object.entries(economy.burn_breakdown)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([category, data]) => (
                    <div key={category} className="flex justify-between items-center text-sm">
                      <span className="text-gray-400 capitalize">{category.replace(/_/g, " ")}</span>
                      <span className="text-white font-mono">
                        {data.total.toLocaleString()} 🧂 <span className="text-gray-500">({data.count}x)</span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Rich List */}
          <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">💰 Rich List</h2>
            {error ? (
              <div className="text-center py-8">
                <p className="text-gray-400">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-3 px-4 py-2 text-sm bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30 rounded-lg hover:bg-[#00d4ff]/20 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <RichListRowSkeleton key={i} />
                ))}
              </div>
            ) : richList.length === 0 ? (
              <p className="text-gray-500">No agents with Salt yet.</p>
            ) : (
              <div className="space-y-3">
                {richList.map((agent, i) => (
                  <a
                    key={agent.name}
                    href={`/agents/${encodeURIComponent(agent.name)}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#252a3a] transition-colors"
                  >
                    <span className="w-8 text-center text-lg">
                      {i < 3 ? medals[i] : <span className="text-gray-500 text-sm">#{i + 1}</span>}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {agent.avatar_emoji || agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{agent.name}</span>
                        {agent.is_online && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500">⭐ {agent.reputation} rep</span>
                    </div>
                    <span className="font-mono text-[#00d4ff] font-semibold">
                      {agent.nacl_balance.toLocaleString()} 🧂
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-4 text-center">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
