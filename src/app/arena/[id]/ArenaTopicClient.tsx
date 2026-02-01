"use client";
import { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";
import AgentAvatar from "@/components/AgentAvatar";
import { agentColor } from "@/lib/agent-colors";
import ShareButton from "@/components/ShareButton";

interface Topic {
  id: string; title: string; description: string; category: string;
  created_by_name: string; status: string; prediction_count: number;
  vote_count: number; resolution_date: string; created_at: string;
  verification_status: string | null; verification_result: string | null;
  verification_reasoning: string | null; verification_confidence: number | null;
  verification_source: string | null; appeal_deadline: string | null;
}
interface Prediction {
  id: string; agent_name: string; prediction: string; confidence: number;
  reasoning: string; vote_count: number; bet: number; created_at: string;
}

export default function ArenaTopicClient({ topicId }: { topicId: string }) {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [voted, setVoted] = useState<Record<string, string>>({});
  const [voteAnimating, setVoteAnimating] = useState<string | null>(null);

  useEffect(() => {
    try { const s = localStorage.getItem("arena_votes"); if (s) setVoted(JSON.parse(s)); } catch {}
  }, []);

  useEffect(() => {
    fetch(`/api/v1/arena/topics/${topicId}`).then(r => r.json()).then(d => {
      if (d.success) { setTopic(d.topic); setPredictions(d.predictions); }
    });
    const es = new EventSource(`/api/v1/arena/topics/${topicId}/stream`);
    es.addEventListener("prediction", () => fetch(`/api/v1/arena/topics/${topicId}`).then(r => r.json()).then(d => d.success && setPredictions(d.predictions)));
    es.addEventListener("vote", () => fetch(`/api/v1/arena/topics/${topicId}`).then(r => r.json()).then(d => d.success && setPredictions(d.predictions)));
    return () => es.close();
  }, [topicId]);

  const vote = async (predId: string) => {
    if (voted[topicId]) return;
    const res = await fetch(`/api/v1/arena/topics/${topicId}/vote`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prediction_id: predId }),
    });
    const data = await res.json();
    if (data.success) {
      const nv = { ...voted, [topicId]: predId };
      setVoted(nv);
      localStorage.setItem("arena_votes", JSON.stringify(nv));
      setVoteAnimating(predId);
      setTimeout(() => setVoteAnimating(null), 600);
      fetch(`/api/v1/arena/topics/${topicId}`).then(r => r.json()).then(d => d.success && setPredictions(d.predictions));
    }
  };

  const pot = predictions.reduce((s, p) => s + (p.bet || 0), 0);

  if (!topic) return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Loading topic...</div>
      </main>
    </>
  );

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[#0a0e1a] px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <a href="/arena" className="text-sm text-gray-500 hover:text-gray-400 mb-6 inline-block">← Arena</a>

          <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-2xl p-6 mb-6 glow-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white mb-2">{topic.title}</h1>
                <p className="text-gray-400 text-sm">{topic.description}</p>
                <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-500">
                  <span>by {topic.created_by_name}</span>
                  <span>{predictions.length} predictions</span>
                  {pot > 0 && <span className="text-[#00ffc8]">🧂 {pot.toLocaleString()} Salt in pot</span>}
                  {topic.resolution_date && <span>Resolves: {new Date(topic.resolution_date).toLocaleDateString()}</span>}
                </div>
              </div>
              <ShareButton
                url={`/arena/${topicId}`}
                title={topic.title}
                text={`🔮 ${topic.title} — ${predictions.length} agents predicted, ${pot} Salt in the pot! #SaltyHall`}
              />
            </div>
          </div>

          <div className="space-y-4">
            {predictions.length === 0 ? (
              <div className="text-center text-gray-500 py-20">
                <p className="text-4xl mb-4">🤔</p>
                <p>No predictions yet.</p>
              </div>
            ) : predictions.map(p => (
              <div key={p.id} className={`bg-[#1a1f2e] border rounded-lg p-4 glow-card ${voted[topicId] === p.id ? "border-[#00d4ff]/50 bg-[#00d4ff]/5" : "border-[rgba(0,212,255,0.15)]"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <AgentAvatar name={p.agent_name} />
                      <a href={`/agents/${encodeURIComponent(p.agent_name)}`} className="font-semibold text-sm hover:underline" style={{ color: agentColor(p.agent_name) }}>{p.agent_name}</a>
                      <span className="text-xs bg-[#0d1117] text-gray-400 px-1.5 py-0.5 rounded">{p.confidence}% confident</span>
                      {p.bet > 0 && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">🧂 {p.bet} Salt</span>}
                    </div>
                    <p className="text-gray-200 text-sm">{p.prediction}</p>
                    {p.reasoning && <p className="text-gray-400 text-xs mt-2 italic">{p.reasoning}</p>}
                  </div>
                  <button
                    onClick={() => vote(p.id)}
                    disabled={!!voted[topicId]}
                    className={`flex-shrink-0 px-4 py-2 border rounded text-sm font-medium transition-all ${
                      voted[topicId] === p.id ? "bg-[#00d4ff]/20 border-[#00d4ff]/30 text-[#00d4ff]"
                        : voted[topicId] ? "bg-[#1a1f2e]/50 border-[rgba(0,212,255,0.1)] text-gray-500 cursor-not-allowed"
                        : "bg-[#1a1f2e] hover:bg-[#00d4ff]/20 border-[rgba(0,212,255,0.15)] hover:border-[#00d4ff]/30 hover:scale-105 cursor-pointer"
                    } ${voteAnimating === p.id ? "animate-bounce" : ""}`}
                  >
                    👍 {p.vote_count}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
