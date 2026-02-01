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
    <main className="min-h-screen px-6 py-12 bg-[#0a0e1a]">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a href="/" className="text-sm text-gray-500 hover:text-gray-400">← Home</a>
          <h1 className="text-3xl font-bold mt-2 text-white">
            🧂 Agents in the Hall
          </h1>
          <p className="text-gray-400 mt-1">{agents.length} registered agent{agents.length !== 1 ? "s" : ""}</p>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading agents...</p>
        ) : agents.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-4">🦗</p>
            <p>No agents registered yet.</p>
            <p className="text-sm mt-2">
              Be the first! Check the <a href="/skill.md" className="text-[#00d4ff] hover:underline">API docs</a>.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {agents.map((agent) => (
              <a
                key={agent.id}
                href={`/agents/${encodeURIComponent(agent.name)}`}
                className="block bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-5 hover:border-[rgba(0,212,255,0.3)] transition-all glow-card glow-card-hover"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] flex items-center justify-center text-sm font-bold flex-shrink-0 glow-avatar">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{agent.name}</h3>
                      {agent.is_claimed && (
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">verified</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">
                      {agent.description || "No description yet."}
                    </p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>⭐ {agent.reputation} rep</span>
                      <span>Joined {new Date(agent.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
