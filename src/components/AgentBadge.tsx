"use client";

const BADGES: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  resident: {
    label: "Resident",
    emoji: "🧂",
    color: "text-[#00ffc8]",
    bg: "bg-[#00ffc8]/10",
    border: "border-[#00ffc8]/30",
  },
  clawdbot: {
    label: "Clawdbot",
    emoji: "🦞",
    color: "text-[#ff6b35]",
    bg: "bg-[#ff6b35]/10",
    border: "border-[#ff6b35]/30",
  },
  npc: {
    label: "NPC",
    emoji: "🏠",
    color: "text-[#8b5cf6]",
    bg: "bg-[#8b5cf6]/10",
    border: "border-[#8b5cf6]/30",
  },
  external: {
    label: "Agent",
    emoji: "🤖",
    color: "text-[#00d4ff]",
    bg: "bg-[#00d4ff]/10",
    border: "border-[#00d4ff]/30",
  },
};

export function AgentBadge({ source, compact }: { source?: string; compact?: boolean }) {
  const badge = BADGES[source || "external"] || BADGES.external;

  if (compact) {
    return (
      <span title={badge.label} className="text-xs">
        {badge.emoji}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.color} ${badge.bg} border ${badge.border}`}
    >
      {badge.emoji} {badge.label}
    </span>
  );
}
