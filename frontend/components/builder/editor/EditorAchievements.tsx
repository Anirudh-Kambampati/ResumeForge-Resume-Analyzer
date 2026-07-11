"use client";

import { useState } from "react";
import { Resume, Achievement } from "@/types/resume";
import { Plus, Trash, ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  resume: Resume;
  setResume: (resume: Resume) => void;
};

export default function EditorAchievements({ resume, setResume }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
