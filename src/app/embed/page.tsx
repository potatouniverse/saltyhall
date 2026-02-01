"use client";

import { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";

interface Room {
  id: string;
  name: string;
  display_name: string;
  description: string;
  type: string;
}

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://saltyhall.com";

export default function EmbedGeneratorPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [compact, setCompact] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [limit, setLimit] = useState(50);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/rooms")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.rooms.length > 0) {
          setRooms(data.rooms);
          setSelectedRoom(data.rooms[0].name);
        }
      });
  }, []);

  const embedUrl = `${BASE_URL}/embed/${selectedRoom}?theme=${theme}&limit=${limit}&header=${showHeader}&compact=${compact}`;

  const iframeCode = `<iframe src="${embedUrl}" width="400" height="600" frameborder="0" style="border-radius:8px;"></iframe>`;

  const scriptCode = `<script src="${BASE_URL}/embed.js" data-room="${selectedRoom}" data-theme="${theme}" data-compact="${compact}" data-header="${showHeader}" data-limit="${limit}"></script>`;

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <NavBar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">🧂 Embed SaltyHall</h1>
        <p className="text-gray-400 mb-8">Add a live chat widget to your website</p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Controls */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Room</label>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="w-full bg-[#1a1f2e] border border-[rgba(0,212,255,0.2)] rounded-lg px-3 py-2 text-white"
              >
                {rooms.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Theme</label>
              <div className="flex gap-2">
                {(["dark", "light"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-4 py-2 rounded-lg text-sm capitalize ${
                      theme === t
                        ? "bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40"
                        : "bg-[#1a1f2e] text-gray-400 border border-transparent"
                    }`}
                  >
                    {t === "dark" ? "🌙" : "☀️"} {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showHeader}
                  onChange={(e) => setShowHeader(e.target.checked)}
                  className="rounded"
                />
                <span className="text-gray-300">Show header</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={compact}
                  onChange={(e) => setCompact(e.target.checked)}
                  className="rounded"
                />
                <span className="text-gray-300">Compact mode</span>
              </label>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Message limit: {limit}</label>
              <input
                type="range"
                min={10}
                max={200}
                step={10}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Embed codes */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">iframe embed</label>
              <div className="relative">
                <pre className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-lg p-3 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                  {iframeCode}
                </pre>
                <button
                  onClick={() => copyToClipboard(iframeCode, "iframe")}
                  className="absolute top-2 right-2 px-2 py-1 bg-[#00d4ff]/20 text-[#00d4ff] rounded text-xs hover:bg-[#00d4ff]/30"
                >
                  {copied === "iframe" ? "✓ Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Script embed (responsive)</label>
              <div className="relative">
                <pre className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-lg p-3 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                  {scriptCode}
                </pre>
                <button
                  onClick={() => copyToClipboard(scriptCode, "script")}
                  className="absolute top-2 right-2 px-2 py-1 bg-[#00d4ff]/20 text-[#00d4ff] rounded text-xs hover:bg-[#00d4ff]/30"
                >
                  {copied === "script" ? "✓ Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Preview</label>
            <div className="border border-[rgba(0,212,255,0.2)] rounded-lg overflow-hidden" style={{ height: 600 }}>
              {selectedRoom && (
                <iframe
                  src={`/embed/${selectedRoom}?theme=${theme}&limit=${limit}&header=${showHeader}&compact=${compact}`}
                  width="100%"
                  height="100%"
                  style={{ border: "none" }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
