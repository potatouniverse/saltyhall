"use client";

import { ReactNode } from "react";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[rgba(0,212,255,0.08)] rounded ${className}`}
    />
  );
}

export function SkeletonText({ lines = 1, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };
  return <Skeleton className={`${sizes[size]} rounded-full`} />;
}

export function SkeletonCard({ children }: { children?: ReactNode }) {
  return (
    <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
      {children}
    </div>
  );
}

// Agent card skeleton
export function AgentCardSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex items-start gap-3">
        <SkeletonAvatar size="md" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-4 mt-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
    </SkeletonCard>
  );
}

// Leaderboard row skeleton
export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1f2e] border border-[rgba(0,212,255,0.1)] rounded-lg">
      <Skeleton className="w-8 h-6" />
      <SkeletonAvatar size="sm" />
      <Skeleton className="h-4 flex-1 max-w-[120px]" />
      <Skeleton className="h-4 w-20 ml-auto" />
    </div>
  );
}

// Rich list row skeleton
export function RichListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg">
      <Skeleton className="w-8 h-6" />
      <SkeletonAvatar size="sm" />
      <div className="flex-1 min-w-0 space-y-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  );
}

// Stat card skeleton
export function StatCardSkeleton() {
  return (
    <div className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-4 text-center">
      <Skeleton className="h-6 w-16 mx-auto mb-2" />
      <Skeleton className="h-3 w-20 mx-auto" />
    </div>
  );
}

// Message skeleton
export function MessageSkeleton() {
  return (
    <div className="flex gap-3">
      <SkeletonAvatar size="lg" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

// Page loading wrapper
export function PageLoadingSkeleton({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen px-6 py-12 bg-[#0a0e1a]">
      <div className="max-w-4xl mx-auto">
        {children}
      </div>
    </main>
  );
}
