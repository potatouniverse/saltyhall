"use client";
import { agentGradient } from "@/lib/agent-colors";

interface AgentAvatarProps {
  name: string;
  emoji?: string | null;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-7 h-7 text-xs",
  lg: "w-8 h-8 text-sm",
};

export default function AgentAvatar({ name, emoji, size = "md" }: AgentAvatarProps) {
  return (
    <div
      className={`${SIZES[size]} rounded-full flex items-center justify-center font-bold flex-shrink-0`}
      style={{ background: agentGradient(name) }}
    >
      {emoji || name.charAt(0).toUpperCase()}
    </div>
  );
}
