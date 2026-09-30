"use client";

import { useState } from "react";
import { Resume, Project } from "@/types/resume";
import { Plus, Trash, ChevronDown, ChevronUp, Sparkles, Check, X, AlertCircle } from "lucide-react";
import { normalizeError } from "@/lib/errorHelper";
import { apiPostJson } from "@/lib/api";
import { getProjectLinkInfo } from "@/lib/projectLinks";
import ClearableInput from "@/components/ui/ClearableInput";
import ClearableTextarea from "@/components/ui/ClearableTextarea";

// ============================================================
// Link label config — color and icon for each classification
// ============================================================

const LINK_LABEL_STYLES: Record<string, { color: string; icon: string }> = {
  GitHub: { color: "text-neutral-300", icon: "" },
  GitLab: { color: "text-orange-400", icon: "" },
  Bitbucket: { color: "text-blue-400", icon: "" },
  "Live Demo": { color: "text-green-400", icon: "" },
};

type Props = {
  resume: Resume;
  setResume: (resume: Resume) => void;
};

export default function EditorProjects({ resume, setResume }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // AI improvement states
  const [improvingIdx, setImprovingIdx] = useState<{ itemId: string; bulletIdx: number } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ itemId: string; bulletIdx: number; text: string } | null>(null);

  // Local raw text for each project's technologies input to preserve cursor position.
  // Keyed by project.safeId (id or fallback). Falls back to technologies.join(", ") when unset.
  const [techTexts, setTechTexts] = useState<Record<string, string>>({});

  const updateProjects = (projects: Project[]) => {
    setResume({
      ...resume,
      projects,
    });
  };

  const addProject = () => {
    const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `proj-${Date.now()}`;
    const newProj: Project = {
      id: newId,
      enabled: true,
      title: "",
      link: "",
      technologies: [],
      bullets: [""],
    };
    updateProjects([...resume.projects, newProj]);
    setExpandedId(newId);
  };

  const removeProject = (id: string) => {
    updateProjects(resume.projects.filter((proj) => proj.id !== id));
    setTechTexts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (expandedId === id) setExpandedId(null);
  };

  const updateField = (id: string, field: keyof Project, value: any) => {
    const updated = resume.projects.map((proj) => {
      if (proj.id === id) {
        return { ...proj, [field]: value };
      }
      return proj;
    });
    updateProjects(updated);
  };

  /**
   * Get the text to display in a project's technologies input.
   * If the user has typed into it, return their raw text (preserves cursor).
   * Otherwise, fall back to the model's technologies joined by ", ".
   */
  const getTechText = (project: Project): string =>
    techTexts[project.id] ?? project.technologies.join(", ");

  const handleTechChange = (id: string, rawValue: string) => {
    // 1. Update local raw text (source of truth for the input display)
    setTechTexts((prev) => ({ ...prev, [id]: rawValue }));

    // 2. Parse into array and update model
    const techs = rawValue.split(",").map((t) => t.trim()).filter(Boolean);
    updateField(id, "technologies", techs);
  };

  const updateBullet = (itemId: string, bulletIdx: number, text: string) => {
    const updated = resume.projects.map((proj) => {
      if (proj.id === itemId) {
        const newBullets = [...proj.bullets];
        newBullets[bulletIdx] = text;
        return { ...proj, bullets: newBullets };
      }
      return proj;
    });
    updateProjects(updated);
  };

  const addBullet = (itemId: string) => {
    const updated = resume.projects.map((proj) => {
      if (proj.id === itemId) {
        return { ...proj, bullets: [...proj.bullets, ""] };
      }
      return proj;
    });
    updateProjects(updated);
  };

  const removeBullet = (itemId: string, bulletIdx: number) => {
    const updated = resume.projects.map((proj) => {
      if (proj.id === itemId) {
        const newBullets = proj.bullets.filter((_, idx) => idx !== bulletIdx);
        return { ...proj, bullets: newBullets.length ? newBullets : [""] };
      }
      return proj;
    });
    updateProjects(updated);
  };

  const handleImproveBullet = async (itemId: string, bulletIdx: number, currentText: string, projectTitle: string) => {
    if (!currentText.trim()) return;
    setImprovingIdx({ itemId, bulletIdx });
    setAiError(null);
    setAiSuggestion(null);

    try {
      const data = await apiPostJson<{ improved_text: string }>("/api/improve", {
        type: "project_bullet",
        text: currentText,
        context: projectTitle,
      });
      setAiSuggestion({ itemId, bulletIdx, text: data.improved_text });
    } catch (e: unknown) {
      console.error(e);
      setAiError(normalizeError(e));
    } finally {
      setImprovingIdx(null);
    }
  };

  const applyBulletSuggestion = () => {
    if (aiSuggestion) {
      updateBullet(aiSuggestion.itemId, aiSuggestion.bulletIdx, aiSuggestion.text);
      setAiSuggestion(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Projects</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Showcase your best software projects, hacks, or contributions.
          </p>
        </div>
        <button
          onClick={addProject}
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
            text-on-accent
            transition
            hover:bg-blue-500
          "
        >
          <Plus size={16} />
          Add Project
        </button>
      </div>

      <div className="space-y-4">
        {resume.projects.map((project, index) => {
          const safeId = project.id || `proj-${index}-${Date.now()}`;
          const isExpanded = expandedId === safeId;
          const isEnabled = typeof project.enabled === "boolean" ? project.enabled : true;
          return (
            <div
              key={safeId}
              className="
                rounded-xl
                border
                border-white/10
                bg-card/40
                overflow-hidden
                transition-all
                duration-200
              "
            >
              {/* Accordion Header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : safeId)}
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
                    checked={isEnabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateField(safeId, "enabled", e.target.checked);
                    }}
                    className="
                      h-4
                      w-4
                      rounded
                      border-white/10
                      bg-panel
                      text-blue-600
                      focus:ring-blue-500
                    "
                  />
                  <div>
                    <h3 className="font-semibold text-white">
                      {project.title || "Untitled Project"}
                    </h3>
                    {(project.technologies || []).length > 0 && (
                      <p className="text-xs text-zinc-500">
                        {project.technologies.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProject(safeId);
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">Project Title</label>
                      <ClearableInput
                        value={project.title}
                        onChange={(e) => updateField(safeId, "title", e.target.value)}
                        onClear={() => updateField(safeId, "title", "")}
                        placeholder="e.g. ResumeForge"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">Project Link (Optional)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={project.link || ""}
                          onChange={(e) => updateField(safeId, "link", e.target.value)}
                          placeholder="e.g. https://resumeforge.dev"
                          className={`w-full rounded-lg border border-white/10 bg-panel py-2 text-sm text-white focus:border-blue-500 outline-none ${
                            project.link ? "pr-8 px-3" : "px-3"
                          }`}
                        />
                        {project.link && (
                          <button
                            type="button"
                            onClick={() => updateField(safeId, "link", "")}
                            aria-label="Clear link"
                            tabIndex={0}
                            className="
                              absolute right-1.5 top-1/2 -translate-y-1/2
                              flex items-center justify-center
                              w-5 h-5 rounded
                              text-zinc-500 hover:text-red-400
                              cursor-pointer
                              transition-colors
                            "
                          >
                            <span className="text-sm leading-none font-medium">&times;</span>
                          </button>
                        )}
                      </div>
                      {/* Auto-detected link label badge */}
                      {project.link && (() => {
                        const info = getProjectLinkInfo(project.link);
                        if (!info) return null;
                        const style = LINK_LABEL_STYLES[info.label] || { color: "text-green-400", icon: "" };
                        return (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${style.color}`}>
                              {info.label}
                            </span>
                            <span className="text-[9px] text-zinc-600">
                              &middot; auto-detected
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400">Technologies (Comma-separated)</label>
                    <ClearableInput
                      value={getTechText(project)}
                      onChange={(e) => handleTechChange(safeId, e.target.value)}
                      onClear={() => handleTechChange(safeId, "")}
                      placeholder="e.g. Next.js, FastAPI, PostgreSQL, Tailwind"
                    />
                  </div>

                  {/* Bullets Section */}
                  <div className="border-t border-white/5 pt-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-semibold text-zinc-300">Project Accomplishments / Bullets</h4>
                      <button
                        onClick={() => addBullet(safeId)}
                        className="
                          flex
                          items-center
                          gap-1
                          rounded-lg
                          bg-white/5
                          border
                          border-white/10
                          px-2.5
                          py-1
                          text-xs
                          font-semibold
                          text-zinc-300
                          hover:text-white
                          hover:bg-white/10
                          transition
                        "
                      >
                        <Plus size={12} />
                        Add Bullet
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(project.bullets || [""]).map((bullet, bulletIdx) => {
                        const isImproving = improvingIdx?.itemId === safeId && improvingIdx?.bulletIdx === bulletIdx;
                        const hasSuggestion = aiSuggestion?.itemId === safeId && aiSuggestion?.bulletIdx === bulletIdx;
                        const bulletText = typeof bullet === "string" ? bullet : "";

                        return (
                          <div key={bulletIdx} className="space-y-2">
                            <div className="flex gap-2">
                              <span className="text-zinc-500 text-sm mt-2.5 font-bold">&bull;</span>
                              <ClearableTextarea
                                value={bulletText}
                                onChange={(e) => updateBullet(safeId, bulletIdx, e.target.value)}
                                onClear={() => updateBullet(safeId, bulletIdx, "")}
                                placeholder="e.g. Integrated OpenRouter API to evaluate resume compliance"
                                rows={2}
                                className="flex-1 resize-none"
                              />
                              <div className="flex flex-col gap-1.5 justify-center">
                                <button
                                  onClick={() => handleImproveBullet(safeId, bulletIdx, bulletText, project.title)}
                                  disabled={isImproving || !bulletText.trim()}
                                  title="Improve with AI"
                                  className="
                                    p-2
                                    rounded-lg
                                    bg-blue-600/10
                                    text-blue-400
                                    border
                                    border-blue-500/20
                                    hover:bg-blue-600
                                    hover:text-on-accent
                                    transition
                                    disabled:opacity-40
                                    disabled:hover:bg-blue-600/10
                                    disabled:hover:text-blue-400
                                  "
                                >
                                  <Sparkles size={14} />
                                </button>
                                <button
                                  onClick={() => removeBullet(safeId, bulletIdx)}
                                  className="
                                    p-2
                                    rounded-lg
                                    bg-white/5
                                    text-zinc-500
                                    hover:text-red-500
                                    hover:bg-white/10
                                    transition
                                  "
                                >
                                  <Trash size={14} />
                                </button>
                              </div>
                            </div>

                            {isImproving && (
                              <p className="text-xs text-blue-400 animate-pulse pl-5">Improving bullet with AI...</p>
                            )}

                            {hasSuggestion && (
                              <div className="pl-5 pr-2 py-2">
                                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                                      <Sparkles size={10} />
                                      AI Suggestion
                                    </span>
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={applyBulletSuggestion}
                                        className="bg-blue-600 hover:bg-blue-500 text-on-accent text-xs px-2 py-0.5 rounded transition flex items-center gap-0.5"
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
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {aiError && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
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
