"use client";

import { useState } from "react";
import { Resume } from "@/types/resume";
import { Sparkles, Check, X, AlertCircle } from "lucide-react";
import { normalizeError } from "@/lib/errorHelper";

type Props = {
  resume: Resume;
  setResume: (resume: Resume) => void;
};

export default function EditorSummary({ resume, setResume }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const updateSummary = (text: string) => {
    setResume({
      ...resume,
      summary: {
        ...resume.summary,
        text,
      },
    });
  };

  const toggleEnabled = (enabled: boolean) => {
    setResume({
      ...resume,
      summary: {
        ...resume.summary,
        enabled,
      },
    });
  };

  const handleImprove = async () => {
    if (!resume.summary.text.trim()) return;
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/improve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "summary",
          text: resume.summary.text,
        }),
      });

      if (!res.ok) {
        let errText = await res.text();
        try {
          const errJson = JSON.parse(errText);
          errText = normalizeError(errJson);
        } catch {}
        throw new Error(errText || "Failed to improve text");
      }

      const data = await res.json();
      setSuggestion(data.improved_text);
    } catch (e: unknown) {
      console.error(e);
      setError(normalizeError(e));
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = () => {
    if (suggestion) {
      updateSummary(suggestion);
      setSuggestion(null);
    }
  };

  const textVal = resume.summary.text || "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Professional Summary</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Write a brief summary highlight of your career.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={resume.summary.enabled}
            onChange={(e) => toggleEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
          <span className="ms-3 text-sm font-medium text-zinc-400">
            {resume.summary.enabled ? "Enabled" : "Disabled"}
          </span>
        </label>
      </div>

      {resume.summary.enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-zinc-300">Summary Text</span>
              <span className="text-zinc-500">{textVal.length} characters</span>
            </div>
            <textarea
              value={textVal}
              onChange={(e) => updateSummary(e.target.value)}
              placeholder="e.g. Senior Software Engineer with 5+ years of experience leading team initiatives, specializing in building high-performance APIs..."
              rows={6}
              className="
                w-full
                rounded-xl
                border
                border-white/10
                bg-[#141416]
                px-4
                py-3
                text-white
                outline-none
                transition
                focus:border-blue-500
                focus:ring-2
                focus:ring-blue-500/20
                resize-y
                text-sm
                leading-relaxed
              "
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleImprove}
              disabled={loading || !textVal.trim()}
              className="
                flex
                items-center
                gap-2
                rounded-xl
                bg-blue-600/10
                border
                border-blue-500/20
                px-4
                py-2.5
                text-sm
                font-medium
                text-blue-400
                transition
                hover:bg-blue-600
                hover:text-white
                disabled:opacity-40
                disabled:hover:bg-blue-600/10
                disabled:hover:text-blue-400
              "
            >
              <Sparkles size={16} />
              {loading ? "Improving with AI..." : "Improve with AI"}
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">AI Improvement Error</p>
                <p className="mt-1 text-xs text-red-400/80">{error}</p>
              </div>
            </div>
          )}

          {suggestion && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium text-blue-400 flex items-center gap-1.5">
                  <Sparkles size={14} />
                  AI Suggested Improvement
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={applySuggestion}
                    className="
                      flex
                      items-center
                      gap-1
                      rounded-lg
                      bg-blue-600
                      px-3
                      py-1.5
                      text-xs
                      font-semibold
                      text-white
                      transition
                      hover:bg-blue-500
                    "
                  >
                    <Check size={12} />
                    Apply
                  </button>
                  <button
                    onClick={() => setSuggestion(null)}
                    className="
                      p-1.5
                      rounded-lg
                      border
                      border-white/10
                      bg-white/[0.03]
                      text-zinc-400
                      hover:text-white
                      hover:bg-white/[0.06]
                      transition
                    "
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed italic bg-black/30 p-3 rounded-lg border border-white/5">
                "{suggestion}"
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
