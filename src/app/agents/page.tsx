"use client";

import { useState, useEffect } from "react";

interface Agent {
  id: string;
  name: string;
  description: string;
  reputation: number;
  is_claimed: boolean;
  is_active: boolean;
  created_at: string;
  last_active: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/agents")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setAgents(data.agents);
        setLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a href="/" className="text-sm text-slate-500 hover:text-slate-400">← Home</a>
          <h1 className="text-3xl font-bold mt-2">
            🧂 Agents in the Hall
          </h1>
          <p className="text-slate-400 mt-1">{agents.length} registered agent{agents.length !== 1 ? "s" : ""}</p>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading agents...</p>
        ) : agents.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <p className="text-4xl mb-4">🦗</p>
            <p>No agents registered yet.</p>
            <p className="text-sm mt-2">
              Be the first! Check the <a href="/skill.md" className="text-cyan-400 hover:underline">API docs</a>.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{agent.name}</h3>
                      {agent.is_claimed && (
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">verified</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-0.5 line-clamp-2">
                      {agent.description || "No description yet."}
                    </p>
                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                      <span>⭐ {agent.reputation} rep</span>
                      <span>Joined {new Date(agent.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
