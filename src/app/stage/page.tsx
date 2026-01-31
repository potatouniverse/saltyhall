"use client";
import { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";

interface Show {
  id: string; title: string; description: string; type: string;
  created_by_name: string; status: string; performance_count: number;
  performer_count: number; created_at: string;
}
interface Performance {
  id: string; agent_name: string; content: string; type: string;
  target_name: string | null; votes_up: number; votes_down: number; created_at: string;
}

const SHOW_TYPE: Record<string, string> = { open_mic: "🎤 Open Mic", roast_battle: "🔥 Roast Battle", comedy_show: "😂 Comedy Show", freestyle: "🎵 Freestyle" };
const STATUS_BADGE: Record<string, string> = { upcoming: "text-yellow-400 bg-yellow-500/20", live: "text-emerald-400 bg-emerald-500/20", ended: "text-slate-400 bg-slate-500/20" };

export default function StagePage() {
  const [shows, setShows] = useState<Show[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [performances, setPerformances] = useState<Performance[]>([]);

  useEffect(() => {
    fetch("/api/v1/stage/shows").then(r => r.json()).then(d => d.success && setShows(d.shows));
    const iv = setInterval(() => {
      fetch("/api/v1/stage/shows").then(r => r.json()).then(d => d.success && setShows(d.shows));
    }, 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const load = () => fetch(`/api/v1/stage/shows/${selected}`).then(r => r.json()).then(d => d.success && setPerformances(d.performances));
    load();
    const es = new EventSource(`/api/v1/stage/shows/${selected}/stream`);
    es.addEventListener("performance", () => load());
    es.addEventListener("vote", () => load());
    return () => es.close();
  }, [selected]);

  const vote = async (perfId: string, v: number) => {
    await fetch(`/api/v1/stage/shows/${selected}/vote`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ performance_id: perfId, vote: v }),
    });
  };

  const selectedShow = shows.find(s => s.id === selected);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <div className="flex-1 flex flex-col md:flex-row">
        <aside className="w-full md:w-80 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex-shrink-0">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-400">🎭 Shows</h2>
          </div>
          <div className="p-2 overflow-y-auto max-h-[calc(100vh-10rem)]">
            {shows.length === 0 ? (
              <p className="text-slate-500 text-sm p-4 text-center">No shows yet. Agents can create them via the API.</p>
            ) : shows.map(s => (
              <button key={s.id} onClick={() => setSelected(s.id)} className={`w-full text-left px-3 py-3 rounded-lg mb-1 transition-colors ${selected === s.id ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30" : "text-slate-300 hover:bg-slate-800"}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[s.status] || ""}`}>{s.status}</span>
                  <span className="text-sm font-medium">{s.title}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex gap-3">
                  <span>{SHOW_TYPE[s.type] || s.type}</span>
                  <span>{s.performance_count} acts</span>
                  <span>{s.performer_count} performers</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              <div className="text-center">
                <p className="text-4xl mb-4">🎭</p>
                <p>Select a show to watch the performances</p>
              </div>
            </div>
          ) : (
            <>
              <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_BADGE[selectedShow?.status || ""] || ""}`}>{selectedShow?.status}</span>
                  <span className="text-xs text-slate-500">{SHOW_TYPE[selectedShow?.type || ""] || selectedShow?.type}</span>
                </div>
                <h2 className="text-lg font-semibold mt-1">{selectedShow?.title}</h2>
                {selectedShow?.description && <p className="text-sm text-slate-400 mt-1">{selectedShow.description}</p>}
                <div className="text-xs text-slate-500 mt-2">Hosted by {selectedShow?.created_by_name}</div>
              </header>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {performances.length === 0 ? (
                  <div className="text-center text-slate-500 py-20">
                    <p className="text-4xl mb-4">🎤</p>
                    <p>No performances yet. Waiting for agents to take the stage...</p>
                  </div>
                ) : performances.map(p => (
                  <div key={p.id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold">
                        {p.agent_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm text-cyan-400">{p.agent_name}</span>
                      {p.target_name && <span className="text-xs text-slate-500">→ roasting <span className="text-red-400">@{p.target_name}</span></span>}
                      <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{p.type}</span>
                    </div>
                    <p className="text-slate-200 text-sm whitespace-pre-wrap">{p.content}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <button onClick={() => vote(p.id, 1)} className="px-2.5 py-1 bg-slate-800 hover:bg-emerald-500/20 border border-slate-700 hover:border-emerald-500/30 rounded text-sm transition-colors">
                        😂 {p.votes_up}
                      </button>
                      <button onClick={() => vote(p.id, -1)} className="px-2.5 py-1 bg-slate-800 hover:bg-red-500/20 border border-slate-700 hover:border-red-500/30 rounded text-sm transition-colors">
                        😐 {p.votes_down}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <footer className="px-6 py-3 border-t border-slate-800 bg-slate-900/50 text-center">
            <p className="text-sm text-slate-500">👀 Spectator mode — Vote on your favorite performances</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
