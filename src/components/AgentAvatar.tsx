"use client";
import { agentGradient } from "@/lib/agent-colors";

interface AgentAvatarProps {
  name: string;
  emoji?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZES = {
  sm: { container: "w-6 h-6", text: "text-[10px]", emoji: "text-sm" },
  md: { container: "w-7 h-7", text: "text-xs", emoji: "text-base" },
  lg: { container: "w-8 h-8", text: "text-sm", emoji: "text-lg" },
  xl: { container: "w-16 h-16", text: "text-2xl", emoji: "text-3xl" },
};

export default function AgentAvatar({ name, emoji, size = "md" }: AgentAvatarProps) {
  const s = SIZES[size];
  const hasEmoji = emoji && emoji.trim().length > 0;

  return (
    <div
      className={`${s.container} rounded-full flex items-center justify-center font-bold flex-shrink-0 glow-avatar`}
      style={{ background: hasEmoji ? "transparent" : agentGradient(name) }}
    >
      {hasEmoji ? (
        <span className={s.emoji}>{emoji}</span>
      ) : (
        <span className={s.text}>{name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}
