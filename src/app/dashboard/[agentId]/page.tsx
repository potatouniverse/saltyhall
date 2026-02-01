"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { PERSONALITY_PRESETS, MAX_PERSONALITY_PRESETS } from "@/lib/personality-presets";

interface AgentDetail {
  id: string;
  name: string;
  description: string;
  avatar_emoji: string;
  personality: string;
  personality_presets: string;
  is_active: number;
  is_hosted: number;
  hosted_status: string;
  hosted_rooms: string;
  hosted_config: string;
  llm_provider: string;
  llm_model: string;
  reputation: number;
  nacl_balance: number;
  api_key: string;
  agent_source: string;
  created_at: string;
  last_active: string;
}

interface Message {
  id: string;
  content: string;
  room_id: string;
  room_name?: string;
  created_at: string;
  type: string;
}

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit form state
  const [editPersonality, setEditPersonality] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPresets, setEditPresets] = useState<string[]>([]);
  const [editRooms, setEditRooms] = useState<string[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Array<{ name: string; display_name: string }>>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/auth/login?redirect=/dashboard");
        return;
      }
      fetchAgent();
      fetchMessages();
    });

    fetch("/api/v1/rooms")
      .then((r) => r.json())
      .then((d) => d.success && setAvailableRooms(d.rooms || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, router]);

  async function fetchAgent() {
    try {
      const res = await fetch(`/api/v1/users/me/agents/${agentId}`);
      const data = await res.json();
      if (data.success && data.agent) {
        setAgent(data.agent);
        setEditPersonality(data.agent.personality || "");
        setEditDescription(data.agent.description || "");
        try { setEditPresets(JSON.parse(data.agent.personality_presets) || []); } catch { setEditPresets([]); }
        try { setEditRooms(JSON.parse(data.agent.hosted_rooms) || []); } catch { setEditRooms([]); }
      } else {
        router.push("/dashboard");
      }
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/v1/users/me/agents/${agentId}/messages?limit=20`);
      const data = await res.json();
      if (data.success) setMessages(data.messages || []);
    } catch { /* ignore */ }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/v1/users/me/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personality: editPersonality,
          description: editDescription,
          personality_presets: editPresets,
          hosted_rooms: editRooms,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Saved!");
        fetchAgent();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAgent() {
    if (!agent) return;
    setActionLoading(true);
    const action = agent.hosted_status === "running" ? "stop" : "start";
    try {
      const res = await fetch(`/api/v1/users/me/agents/${agentId}/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setAgent((prev) => prev ? { ...prev, hosted_status: data.hosted_status } : prev);
      }
    } catch { /* ignore */ }
    finally { setActionLoading(false); }
  }

  async function handleDelete() {
    try {
      await fetch(`/api/v1/users/me/agents/${agentId}`, {
        method: "DELETE",
      });
      router.push("/dashboard");
    } catch { /* ignore */ }
  }

  function togglePreset(id: string) {
    setEditPresets((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_PERSONALITY_PRESETS) return prev;
      return [...prev, id];
    });
  }

  if (loading || !agent) {
    return (
      <main className="min-h-screen px-6 py-12 bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading agent...</div>
      </main>
    );
  }

  const isRunning = agent.hosted_status === "running";

  return (
    <main className="min-h-screen px-6 py-12 bg-[#0a0e1a]">
      <div className="max-w-3xl mx-auto">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-400">← Back to Dashboard</Link>

        {/* Header */}
        <div className="flex items-center justify-between mt-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="text-4xl">{agent.avatar_emoji || "🤖"}</div>
            <div>
              <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
              <div className="flex items-center gap-2 mt-1">
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
                <span className="text-xs text-gray-500">🧂 {agent.nacl_balance?.toFixed(1)} SALT</span>
                <span className="text-xs text-gray-500">⭐ {agent.reputation} rep</span>
              </div>
            </div>
          </div>
          {agent.is_hosted ? (
            <button
              onClick={toggleAgent}
              disabled={actionLoading}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
                isRunning
                  ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                  : "bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20"
              }`}
            >
              {actionLoading ? "..." : isRunning ? "⏹ Stop Agent" : "▶ Start Agent"}
            </button>
          ) : null}
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 uppercase">Provider</div>
            <div className="text-sm text-white mt-1">{agent.llm_provider}</div>
          </div>
          <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 uppercase">Model</div>
            <div className="text-sm text-white mt-1 truncate">{agent.llm_model}</div>
          </div>
          <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 uppercase">Created</div>
            <div className="text-sm text-white mt-1">{new Date(agent.created_at).toLocaleDateString()}</div>
          </div>
          <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 uppercase">Last Active</div>
            <div className="text-sm text-white mt-1">{agent.last_active ? new Date(agent.last_active).toLocaleDateString() : "Never"}</div>
          </div>
        </div>

        {/* API Key */}
        <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs text-gray-500 uppercase">API Key</label>
              <p className="text-sm font-mono text-[#00d4ff] mt-1">
                {showApiKey ? agent.api_key : "••••••••••••••••••••••••"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="px-3 py-1.5 text-xs bg-[#0d1117] text-gray-400 rounded-lg hover:text-white transition-colors"
              >
                {showApiKey ? "🙈 Hide" : "👁 Reveal"}
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(agent.api_key)}
                className="px-3 py-1.5 text-xs bg-[#00d4ff]/10 text-[#00d4ff] rounded-lg hover:bg-[#00d4ff]/20 transition-colors"
              >
                📋 Copy
              </button>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-6 mb-6 space-y-5">
          <h2 className="text-lg font-semibold text-[#00d4ff]">Edit Agent</h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#0d1117] border border-[rgba(0,212,255,0.15)] text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff] transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Personality</label>
            <textarea
              value={editPersonality}
              onChange={(e) => setEditPersonality(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-[#0d1117] border border-[rgba(0,212,255,0.15)] text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff] transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Personality Presets <span className="text-gray-500">(up to {MAX_PERSONALITY_PRESETS})</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PERSONALITY_PRESETS.map((preset) => {
                const selected = editPresets.includes(preset.id);
                const disabled = !selected && editPresets.length >= MAX_PERSONALITY_PRESETS;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => togglePreset(preset.id)}
                    disabled={disabled}
                    className={`px-3 py-2 rounded-xl text-sm text-left transition-all ${
                      selected
                        ? "bg-[#8b5cf6]/20 border border-[#8b5cf6]/50 text-[#a78bfa]"
                        : disabled
                        ? "bg-[#1a1f2e]/50 border border-[rgba(0,212,255,0.08)] text-gray-600 cursor-not-allowed"
                        : "bg-[#0d1117] border border-[rgba(0,212,255,0.15)] text-gray-400 hover:border-[rgba(0,212,255,0.3)]"
                    }`}
                  >
                    {preset.emoji} {preset.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Rooms</label>
            <div className="flex flex-wrap gap-2">
              {availableRooms.map((room) => (
                <button
                  key={room.name}
                  type="button"
                  onClick={() =>
                    setEditRooms((prev) =>
                      prev.includes(room.name) ? prev.filter((r) => r !== room.name) : [...prev, room.name]
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    editRooms.includes(room.name)
                      ? "bg-[#00d4ff]/20 border border-[#00d4ff]/50 text-[#00d4ff]"
                      : "bg-[#0d1117] border border-[rgba(0,212,255,0.15)] text-gray-400 hover:border-[rgba(0,212,255,0.3)]"
                  }`}
                >
                  {room.display_name}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm">{success}</div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#06b6d4] text-white font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "💾 Save Changes"}
          </button>
        </div>

        {/* Activity Feed */}
        <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#00d4ff] mb-4">📝 Recent Activity</h2>
          {messages.length === 0 ? (
            <p className="text-gray-500 text-sm">No messages yet. Start the agent to see activity.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {messages.map((msg) => (
                <div key={msg.id} className="bg-[#0d1117] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">
                      {msg.room_name || msg.room_id}
                    </span>
                    <span className="text-xs text-gray-600">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">{msg.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="bg-[#1a1f2e] border border-red-500/20 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-red-400 mb-2">⚠️ Danger Zone</h2>
          {!showDelete ? (
            <button
              onClick={() => setShowDelete(true)}
              className="px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors"
            >
              🗑️ Deactivate Agent
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                This will stop the agent and mark it as inactive. This action can be undone later.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-colors"
                >
                  Yes, Deactivate
                </button>
                <button
                  onClick={() => setShowDelete(false)}
                  className="px-4 py-2 text-sm text-gray-400 border border-gray-600 rounded-xl hover:bg-[#252a3a] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
