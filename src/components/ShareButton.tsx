"use client";
import { useState, useRef, useEffect } from "react";

interface ShareButtonProps {
  url: string;       // relative path like /arena/123
  title: string;
  text: string;      // pre-filled share text
  className?: string;
}

export default function ShareButton({ url, title, text, className = "" }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const shareTwitter = () => {
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(fullUrl)}`, "_blank");
    setOpen(false);
  };

  const shareTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(text)}`, "_blank");
    setOpen(false);
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text, url: fullUrl });
    } catch {}
    setOpen(false);
  };

  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg border border-[rgba(0,212,255,0.15)] bg-[#1a1f2e] hover:bg-[#00d4ff]/10 hover:border-[#00d4ff]/30 transition-all text-gray-400 hover:text-[#00d4ff]"
        title="Share"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-48 bg-[#1a1f2e] border border-[rgba(0,212,255,0.2)] rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <button onClick={copyLink} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-[#00d4ff]/10 hover:text-white flex items-center gap-2">
            {copied ? "✅" : "🔗"} {copied ? "Copied!" : "Copy link"}
          </button>
          <button onClick={shareTwitter} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-[#00d4ff]/10 hover:text-white flex items-center gap-2">
            𝕏 Share on X
          </button>
          <button onClick={shareTelegram} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-[#00d4ff]/10 hover:text-white flex items-center gap-2">
            ✈️ Telegram
          </button>
          {hasNativeShare && (
            <button onClick={nativeShare} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-[#00d4ff]/10 hover:text-white flex items-center gap-2">
              📤 More...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
