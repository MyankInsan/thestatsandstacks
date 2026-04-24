"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunWorkflowButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const router = useRouter();

  const handleRun = async () => {
    setLoading(true);
    setStatus('Starting agents...');
    
    try {
      const res = await fetch("/api/run-workflow", { method: "POST" });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setStatus(`Done! ${data.slideCount} slides generated.`);
        setTimeout(() => {
          router.refresh();
          setLoading(false);
          setStatus('');
        }, 2000);
      } else {
        setStatus('Failed. Check terminal.');
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      setStatus('Error occurred.');
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {status && (
        <span className="text-[10px] text-amber-400 font-mono animate-pulse">{status}</span>
      )}
      <button
        onClick={handleRun}
        disabled={loading}
        className="bg-emerald-500 text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "⏳ Agents Working..." : "🚀 Run Full Pipeline"}
      </button>
    </div>
  );
}
