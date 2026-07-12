"use client";

import { useState } from "react";
import { Resume, Achievement } from "@/types/resume";
import { Plus, Trash, ChevronDown, ChevronUp, Sparkles, Check, X, AlertCircle } from "lucide-react";
import { normalizeError } from "@/lib/errorHelper";

type Props = {
  resume: Resume;
  setResume: (resume: Resume) => void;
};

export default function EditorAchievements({ resume, setResume }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // AI improvement states
  const [improvingId, setImprovingId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ id: string; text: string; insight?: string } | null>(null);

  const updateAchievements = (achievements: Achievement[]) => {
    setResume({
      ...resume,
      achievements,
    });
  };

  const addAchievement = () => {
    const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ach-${Date.now()}`;
    const newAch: Achievement = {
      id: newId,
      enabled: true,
      title: "",
      description: "",
    };
    updateAchievements([...resume.achievements, newAch]);
    setExpandedId(newId);
  };

  const removeAchievement = (id: string) => {
    updateAchievements(resume.achievements.filter((ach) => ach.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const updateField = (id: string, field: keyof Achievement, value: any) => {
    const updated = resume.achievements.map((ach) => {
      if (ach.id === id) {
        return { ...ach, [field]: value };
      }
      return ach;
    });
    updateAchievements(updated);
  };

  const handleImproveAchievement = async (id: string, currentText: string, title: string) => {
    if (!currentText.trim()) return;
    setImprovingId(id);
    setAiError(null);
    setAiSuggestion(null);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/improve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "achievement",
          text: currentText,
          context: title,
        }),
      });

      if (!res.ok) {
        let errText = await res.text();
        try {
          const errJson = JSON.parse(errText);
          errText = normalizeError(errJson);
        } catch {}
        throw new Error(errText || "Failed to improve achievement");
      }

      const data = await res.json();
      setAiSuggestion({ id, text: data.improved_text, insight: data.insight });
    } catch (e: unknown) {
      console.error(e);
      setAiError(normalizeError(e));
    } finally {
      setImprovingId(null);
    }
  };

  const applyAchievementSuggestion = () => {
    if (aiSuggestion) {
      updateField(aiSuggestion.id, "description", aiSuggestion.text);
      setAiSuggestion(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Achievements</h2>
          <p className="mt-1 text-sm text-zinc-500">
            List your awards, honors, competitions, and notable milestones.
          </p>
        </div>
        <button
          onClick={addAchievement}
          className="
            flex
            items-center
            gap-1.5
            rounded-xl
            bg-blue-600
            px-4
            py-2
            text-sm
            font-medium
            text-white
            transition
            hover:bg-blue-500
          "
        >
          <Plus size={16} />
          Add Achievement
        </button>
      </div>

      <div className="space-y-4">
        {resume.achievements.map((ach) => {
          const isExpanded = expandedId === ach.id;
          return (
            <div
              key={ach.id}
              className="
                rounded-xl
                border
                border-white/10
                bg-[#141416]/40
                overflow-hidden
                transition-all
                duration-200
              "
            >
              {/* Accordion Header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : ach.id)}
                className="
                  flex
                  items-center
                  justify-between
                  p-4
                  cursor-pointer
                  hover:bg-white/5
                  transition
                "
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={ach.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateField(ach.id, "enabled", e.target.checked);
                    }}
                    className="
                      h-4
                      w-4
                      rounded
                      border-white/10
                      bg-[#0C0C0E]
                      text-blue-600
                      focus:ring-blue-500
                    "
                  />
                  <div>
                    <h3 className="font-semibold text-white">
                      {ach.title || "Untitled Achievement"}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAchievement(ach.id);
                    }}
                    className="
                      p-1.5
                      rounded-lg
                      text-zinc-500
                      hover:text-red-500
                      hover:bg-white/5
                      transition
                    "
                  >
                    <Trash size={16} />
                  </button>
                  {isExpanded ? <ChevronUp size={18} className="text-zinc-400" /> : <ChevronDown size={18} className="text-zinc-400" />}
                </div>
              </div>

              {/* Accordion Content */}
              {isExpanded && (
                <div className="border-t border-white/10 p-5 space-y-4 bg-black/20">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400">Achievement Title</label>
                    <input
                      type="text"
                      value={ach.title}
                      onChange={(e) => updateField(ach.id, "title", e.target.value)}
                      placeholder="e.g. Winner - National Hackathon"
                      className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400">Description</label>
                    <div className="flex gap-2">
                      <textarea
                        value={ach.description}
                        onChange={(e) => updateField(ach.id, "description", e.target.value)}
                        placeholder="e.g. Won first place among 250+ teams for building an AI productivity platform."
                        rows={3}
                        className="
                          w-full
                          rounded-lg
                          border
                          border-white/10
                          bg-[#0C0C0E]
                          px-3
                          py-2
                          text-sm
                          text-white
                          focus:border-blue-500
                          outline-none
                          resize-y
                        "
                      />
                      <div className="flex flex-col gap-1.5 justify-start">
                        <button
                          onClick={() => handleImproveAchievement(ach.id, ach.description, ach.title)}
                          disabled={improvingId === ach.id || !ach.description.trim()}
                          title="Refine Achievement"
                          className="
                            p-2
                            rounded-lg
                            bg-blue-600/10
                            text-blue-400
                            border
                            border-blue-500/20
                            hover:bg-blue-600
                            hover:text-white
                            transition
                            disabled:opacity-40
                            disabled:hover:bg-blue-600/10
                            disabled:hover:text-blue-400
                          "
                        >
                          <Sparkles size={14} />
                        </button>
                      </div>
                    </div>

                    {improvingId === ach.id && (
                      <p className="text-xs text-blue-400 animate-pulse pt-1">Refining achievement with AI...</p>
                    )}

                    {aiSuggestion?.id === ach.id && (
                      <div className="mt-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                            <Sparkles size={10} />
                            AI Suggestion
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={applyAchievementSuggestion}
                              className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-0.5 rounded transition flex items-center gap-0.5"
                            >
                              <Check size={10} /> Apply
                            </button>
                            <button
                              onClick={() => setAiSuggestion(null)}
                              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs p-1 rounded transition"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-300 italic">
                          "{aiSuggestion.text}"
                        </p>
                        {aiSuggestion.insight && (
                          <p className="text-[10px] text-zinc-500 mt-1">
                            <span className="font-semibold text-blue-400/70">Insight:</span> {aiSuggestion.insight}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {aiError && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400 mt-2">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{aiError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
