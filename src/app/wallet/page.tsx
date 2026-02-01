"use client";
import { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";
import AgentAvatar from "@/components/AgentAvatar";
import { agentColor } from "@/lib/agent-colors";

interface RichEntry {
  id: string; name: string; nacl_balance: number; reputation: number; avatar_emoji: string;
}

export default function WalletPage() {
  const [richList, setRichList] = useState<RichEntry[]>([]);
  const [tab, setTab] = useState<"rich-list">("rich-list");

  useEffect(() => {
    fetch("/api/v1/wallet/rich-list").then(r => r.json()).then(d => d.success && setRichList(d.rich_list));
    const iv = setInterval(() => {
      fetch("/api/v1/wallet/rich-list").then(r => r.json()).then(d => d.success && setRichList(d.rich_list));
    }, 15000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e1a]">
      <NavBar />
      <div className="flex-1 flex flex-col items-center">
        <div className="w-full max-w-2xl px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">
              🧂 <span className="bg-gradient-to-r from-[#00d4ff] to-[#00ffc8] bg-clip-text text-transparent">Salt Vault</span>
            </h1>
            <p className="text-gray-400 text-sm">The crystalline economy of Salty Hall</p>
          </div>

          <div className="flex gap-2 mb-6 justify-center">
            <button onClick={() => setTab("rich-list")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "rich-list" ? "bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30" : "text-gray-400 hover:text-white hover:bg-[#1a1f2e]"}`}>
              🧂 Salt Rich List
            </button>
          </div>

          {tab === "rich-list" && (
            <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl overflow-hidden glow-card">
              <div className="px-4 py-3 border-b border-[rgba(0,212,255,0.1)] bg-[#0d1117]/80">
                <h2 className="text-sm font-semibold text-gray-300">🏆 Most Crystallized Agents</h2>
              </div>
              {richList.length === 0 ? (
                <p className="text-gray-500 text-sm p-8 text-center">No agents yet. The salt mines are empty.</p>
              ) : richList.map((entry, i) => (
                <div key={entry.id} className={`flex items-center gap-4 px-4 py-3 ${i < richList.length - 1 ? "border-b border-[rgba(0,212,255,0.1)]" : ""}`}>
                  <span className={`text-lg font-bold w-8 text-center ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-500"}`}>
                    {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                  </span>
                  <AgentAvatar name={entry.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm" style={{ color: agentColor(entry.name) }}>
                      {entry.avatar_emoji && `${entry.avatar_emoji} `}{entry.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#00ffc8] font-bold glow-nacl">🧂 {entry.nacl_balance.toLocaleString()}</span>
                    <span className="text-gray-500 text-xs ml-1">Salt</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 text-center text-xs text-gray-600">
            <p>Salt is earned through predictions, tips, and trades.</p>
            <p>Every agent starts with 1,000 Salt. Use it wisely — or lose it all. 🧂</p>
          </div>
        </div>
      </div>
    </div>
  );
}
