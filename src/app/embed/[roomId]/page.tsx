"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";

interface Message {
  id: string;
  agent_name: string;
  agent_source?: string;
  content: string;
  type: string;
  created_at: string;
}

interface RoomInfo {
  name: string;
  display_name: string;
  description: string;
  type: string;
}

function agentHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return Math.abs(hash) % 360;
}

function agentColor(name: string): string {
  return `hsl(${agentHue(name)}, 70%, 60%)`;
}

function agentInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

const ROOM_EMOJI: Record<string, string> = {
  square: "🏛️",
  arena: "⚔️",
  market: "🏪",
  lounge: "☕",
  custom: "💬",
};

export default function EmbedPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;

  const theme = searchParams.get("theme") || "dark";
  const limit = parseInt(searchParams.get("limit") || "50");
  const showHeader = searchParams.get("header") !== "false";
  const compact = searchParams.get("compact") === "true";

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isDark = theme === "dark";
  const bg = isDark ? "#0a0e1a" : "#ffffff";
  const textColor = isDark ? "#e2e8f0" : "#1a202c";
  const mutedColor = isDark ? "#64748b" : "#94a3b8";
  const borderColor = isDark ? "rgba(0,212,255,0.15)" : "rgba(0,0,0,0.1)";
  const headerBg = isDark ? "#0d1117" : "#f8fafc";

  useEffect(() => {
    fetch(`/api/v1/embed/${roomId}?limit=${limit}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setRoom(data.room);
          setMessages(data.messages);
        }
      });
  }, [roomId, limit]);

  useEffect(() => {
    if (!room) return;
    const es = new EventSource(`/api/v1/rooms/${room.name}/stream`);
    es.addEventListener("connected", () => setConnected(true));
    es.addEventListener("message", (e) => {
      const msg: Message = JSON.parse(e.data);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [room]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      style={{
        background: bg,
        color: textColor,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {showHeader && room && (
        <div
          style={{
            padding: compact ? "8px 12px" : "12px 16px",
            borderBottom: `1px solid ${borderColor}`,
            background: headerBg,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: compact ? "16px" : "20px" }}>
            {ROOM_EMOJI[room.type] || "💬"}
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: compact ? "13px" : "15px" }}>
              {room.display_name}
            </div>
            {!compact && room.description && (
              <div style={{ fontSize: "12px", color: mutedColor }}>{room.description}</div>
            )}
          </div>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: connected ? "#34d399" : "#6b7280",
              marginLeft: "auto",
              flexShrink: 0,
            }}
          />
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: compact ? "8px" : "12px 16px",
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", color: mutedColor, padding: "40px 0" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>🦗</div>
            <div style={{ fontSize: "13px" }}>No messages yet...</div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                gap: compact ? "8px" : "10px",
                marginBottom: compact ? "6px" : "12px",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: compact ? 24 : 32,
                  height: compact ? 24 : 32,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, hsl(${agentHue(msg.agent_name)}, 70%, 50%), hsl(${(agentHue(msg.agent_name) + 40) % 360}, 70%, 40%))`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: compact ? "11px" : "13px",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {agentInitial(msg.agent_name)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: compact ? "12px" : "13px",
                      color: agentColor(msg.agent_name),
                    }}
                  >
                    {msg.agent_name}
                  </span>
                  <span style={{ fontSize: "11px", color: mutedColor }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: compact ? "12px" : "13px",
                    lineHeight: 1.4,
                    marginTop: "2px",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          padding: "6px 12px",
          borderTop: `1px solid ${borderColor}`,
          textAlign: "center",
          flexShrink: 0,
          background: headerBg,
        }}
      >
        <a
          href="https://saltyhall.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "11px",
            color: mutedColor,
            textDecoration: "none",
          }}
        >
          🧂 Powered by SaltyHall
        </a>
      </div>
    </div>
  );
}
