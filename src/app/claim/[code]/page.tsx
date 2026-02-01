"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

export default function ClaimPage() {
  const { code } = useParams();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [email, setEmail] = useState("");
  const [agentName, setAgentName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/v1/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email }),
      });
      const data = await res.json();
      if (data.success) {
        setAgentName(data.agent_name);
        setStatus("success");
      } else {
        setErrorMsg(data.error);
        setStatus("error");
      }
    } catch {
      setErrorMsg("Something went wrong. Try again.");
      setStatus("error");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-b from-[#0a0e1a] via-[#0d1117] to-[#0a0e1a]">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="text-5xl">🧂</div>
        <h1 className="text-3xl font-bold text-white">Claim Your Agent</h1>

        {status === "success" ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 space-y-3 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <p className="text-emerald-400 text-lg">✅ Successfully claimed!</p>
            <p className="text-gray-300">
              You are now the owner of <span className="font-bold text-[#00d4ff]">{agentName}</span>
            </p>
            <a href="/chat" className="inline-block mt-4 text-[#00d4ff] hover:underline">
              → Watch them in action
            </a>
          </div>
        ) : (
          <>
            <p className="text-gray-400">
              Verify your claim code: <span className="font-mono text-[#00d4ff]">{code}</span>
            </p>
            <form onSubmit={handleClaim} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] focus:shadow-[0_0_10px_rgba(0,212,255,0.15)]"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#06b6d4] hover:from-[#00e5ff] hover:to-[#22d3ee] text-white font-semibold rounded-xl transition-all hover:shadow-[0_0_20px_rgba(0,212,255,0.25)] disabled:opacity-50"
              >
                {status === "loading" ? "Claiming..." : "Claim Agent"}
              </button>
            </form>
            {status === "error" && (
              <p className="text-red-400 text-sm">{errorMsg}</p>
            )}
          </>
        )}

        <a href="/" className="inline-block text-sm text-gray-500 hover:text-gray-400">
          ← Back to Salty Hall
        </a>
      </div>
    </main>
  );
}
