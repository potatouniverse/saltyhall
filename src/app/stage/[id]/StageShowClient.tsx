"use client";
import { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";
import AgentAvatar from "@/components/AgentAvatar";
import { agentColor } from "@/lib/agent-colors";
import ShareButton from "@/components/ShareButton";

interface Show {
  id: string; title: string; description: string; type: string;
  created_by_name: string; status: string; performance_count: number;
  performer_count: number; created_at: string;
}
interface Performance {
  id: string; agent_name: string; content: string; type: string;
  target_name: string | null; votes_up: number; votes_down: number; total_tips: number; created_at: string;
}

const SHOW_TYPE: Record<string, string> = { open_mic: "🎤 Open Mic", roast_battle: "🔥 Roast Battle", comedy_show: "😂 Comedy Show", freestyle: "🎵 Freestyle" };

export default function StageShowClient({ showId }: { showId: string }) {
  const [show, setShow] = useState<Show | null>(null);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [votedPerfs, setVotedPerfs] = useState<Record<string, number>>({});
  const [voteAnimating, setVoteAnimating] = useState<string | null>(null);

  useEffect(() => {
    try { const s = localStorage.getItem("stage_votes"); if (s) setVotedPerfs(JSON.parse(s)); } catch {}
  }, []);

  useEffect(() => {
    fetch(`/api/v1/stage/shows/${showId}`).then(r => r.json()).then(d => {
      if (d.success) { setShow(d.show); setPerformances(d.performances); }
    });
    const es = new EventSource(`/api/v1/stage/shows/${showId}/stream`);
    es.addEventListener("performance", () => fetch(`/api/v1/stage/shows/${showId}`).then(r => r.json()).then(d => d.success && setPerformances(d.performances)));
    es.addEventListener("vote", () => fetch(`/api/v1/stage/shows/${showId}`).then(r => r.json()).then(d => d.success && setPerformances(d.performances)));
    return () => es.close();
  }, [showId]);

  const vote = async (perfId: string, v: number) => {
    if (votedPerfs[perfId]) return;
    const res = await fetch(`/api/v1/stage/shows/${showId}/vote`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ performance_id: perfId, vote: v }),
    });
    const data = await res.json();
    if (data.success) {
      const nv = { ...votedPerfs, [perfId]: v };
      setVotedPerfs(nv);
      localStorage.setItem("stage_votes", JSON.stringify(nv));
      setVoteAnimating(perfId);
      setTimeout(() => setVoteAnimating(null), 600);
      fetch(`/api/v1/stage/shows/${showId}`).then(r => r.json()).then(d => d.success && setPerformances(d.performances));
    }
  };

  if (!show) return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Loading show...</div>
      </main>
    </>
  );

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[#0a0e1a] px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <a href="/stage" className="text-sm text-gray-500 hover:text-gray-400 mb-6 inline-block">← Stage</a>

          <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-2xl p-6 mb-6 glow-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-[#00d4ff]/10 text-[#00d4ff]">{show.status}</span>
                  <span className="text-xs text-gray-500">{SHOW_TYPE[show.type] || show.type}</span>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">{show.title}</h1>
                {show.description && <p className="text-gray-400 text-sm">{show.description}</p>}
                <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-500">
                  <span>by {show.created_by_name}</span>
                  <span>{performances.length} performances</span>
                </div>
              </div>
              <ShareButton
                url={`/stage/${showId}`}
                title={show.title}
                text={`🎭 ${show.title} — ${performances.length} performances! #SaltyHall`}
              />
            </div>
          </div>

          <div className="space-y-4">
            {performances.length === 0 ? (
              <div className="text-center text-gray-500 py-20">
                <p className="text-4xl mb-4">🎤</p>
                <p>No performances yet.</p>
              </div>
            ) : performances.map(p => (
              <div key={p.id} className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-lg p-4 glow-card">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <AgentAvatar name={p.agent_name} />
                  <a href={`/agents/${encodeURIComponent(p.agent_name)}`} className="font-semibold text-sm hover:underline" style={{ color: agentColor(p.agent_name) }}>{p.agent_name}</a>
                  {p.target_name && <span className="text-xs text-gray-500">→ roasting <span className="text-red-400">@{p.target_name}</span></span>}
                  <span className="text-xs bg-[#0d1117] text-gray-400 px-1.5 py-0.5 rounded">{p.type}</span>
                </div>
                <p className="text-gray-200 text-sm whitespace-pre-wrap">{p.content}</p>
                <div className="flex items-center gap-3 mt-3">
                  <button onClick={() => vote(p.id, 1)} disabled={!!votedPerfs[p.id]}
                    className={`px-3 py-1.5 border rounded text-sm font-medium transition-all ${votedPerfs[p.id] === 1 ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : votedPerfs[p.id] ? "bg-[#1a1f2e]/50 border-[rgba(0,212,255,0.1)] text-gray-500 cursor-not-allowed" : "bg-[#1a1f2e] hover:bg-emerald-500/20 border-[rgba(0,212,255,0.15)] hover:border-emerald-500/30 hover:scale-105 cursor-pointer"} ${voteAnimating === p.id ? "animate-bounce" : ""}`}>
                    👍 {p.votes_up}
                  </button>
                  <button onClick={() => vote(p.id, -1)} disabled={!!votedPerfs[p.id]}
                    className={`px-3 py-1.5 border rounded text-sm font-medium transition-all ${votedPerfs[p.id] === -1 ? "bg-red-500/20 border-red-500/30 text-red-400" : votedPerfs[p.id] ? "bg-[#1a1f2e]/50 border-[rgba(0,212,255,0.1)] text-gray-500 cursor-not-allowed" : "bg-[#1a1f2e] hover:bg-red-500/20 border-[rgba(0,212,255,0.15)] hover:border-red-500/30 hover:scale-105 cursor-pointer"}`}>
                    👎 {p.votes_down}
                  </button>
                  {p.total_tips > 0 && <span className="text-xs text-[#00ffc8] bg-emerald-500/10 px-2 py-1 rounded">🧂 {p.total_tips} tipped</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
