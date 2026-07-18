"use client";

import { useState } from "react";
import { Resume } from "@/types/resume";
import { Plus, Trash, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Sparkles, Check, X, AlertCircle } from "lucide-react";
import { normalizeError } from "@/lib/errorHelper";

// ============================================================
// Field definition for a configurable entry section
// ============================================================

export interface EntryField {
  key: string;           // field name on the entry object
  label: string;         // display label
  type: "text" | "textarea" | "tags" | "url" | "textarea-sm";
  placeholder?: string;
  spanFull?: boolean;    // span full width in grid
}

export interface SectionConfig {
  dataKey: string;             // "projects" | "research" | "publications"
  title: string;
  description: string;
  addLabel: string;
  fields: EntryField[];
  hasAIImprovement?: boolean;
  improvementType?: string;    // api type for AI improvement
  improveLabel?: string;       // context label for AI
  createNew: () => Record<string, any>;
  getEntries: (resume: Resume) => any[];
  setEntries: (resume: Resume, entries: any[]) => Resume;
  getEntryTitle: (entry: any) => string;
  getEntrySubtitle: (entry: any) => string;
}

// ============================================================
// Generic Entry Editor
// ============================================================

type Props = {
  resume: Resume;
  setResume: (resume: Resume) => void;
  config: SectionConfig;
};

export default function GenericEntryEditor({ resume, setResume, config }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [improvingIdx, setImprovingIdx] = useState<{ itemId: string; bulletIdx: number } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ itemId: string; bulletIdx: number; text: string } | null>(null);
  const [tagTexts, setTagTexts] = useState<Record<string, string>>({});

  const entries = config.getEntries(resume);

  const updateEntries = (updated: any[]) => {
    setResume(config.setEntries(resume, updated));
  };

  const moveEntry = (id: string, direction: -1 | 1) => {
    const idx = entries.findIndex((e: any) => e.id === id);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= entries.length) return;
    const updated = [...entries];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    updateEntries(updated);
  };

  const addEntry = () => {
    const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${config.dataKey}-${Date.now()}`;
    const entry = { ...config.createNew(), id: newId };
    updateEntries([...entries, entry]);
    setExpandedId(newId);
  };

  const removeEntry = (id: string) => {
    updateEntries(entries.filter((e: any) => e.id !== id));
    setTagTexts((prev) => { const n = { ...prev }; delete n[id]; return n; });
    if (expandedId === id) setExpandedId(null);
  };

  const updateField = (id: string, field: string, value: any) => {
    updateEntries(entries.map((e: any) => e.id === id ? { ...e, [field]: value } : e));
  };

  // Find the tags field (if any) to know the key name
  const tagsField = config.fields.find((f) => f.type === "tags");

  const getTagText = (entry: any): string => {
    if (!tagsField) return "";
    return tagTexts[entry.id] ?? (entry[tagsField.key] || []).join(", ");
  };

  const handleTagChange = (id: string, rawValue: string) => {
    if (!tagsField) return;
    setTagTexts((prev) => ({ ...prev, [id]: rawValue }));
    const items = rawValue.split(",").map((t: string) => t.trim()).filter(Boolean);
    updateField(id, tagsField.key, items);
  };

  const updateBullet = (itemId: string, bulletIdx: number, text: string) => {
    const updated = entries.map((e: any) => {
      if (e.id === itemId) {
        const bullets = e.bullets ? [...e.bullets] : [];
        bullets[bulletIdx] = text;
        return { ...e, bullets };
      }
      return e;
    });
    updateEntries(updated);
  };

  const addBullet = (itemId: string) => {
    updateEntries(entries.map((e: any) => {
      if (e.id === itemId) {
        return { ...e, bullets: [...(e.bullets || []), ""] };
      }
      return e;
    }));
  };

  const removeBullet = (itemId: string, bulletIdx: number) => {
    updateEntries(entries.map((e: any) => {
      if (e.id === itemId) {
        const b = (e.bullets || []).filter((_: any, idx: number) => idx !== bulletIdx);
        return { ...e, bullets: b.length ? b : [""] };
      }
      return e;
    }));
  };

  const handleImproveBullet = async (itemId: string, bulletIdx: number, currentText: string, contextTitle: string) => {
    if (!currentText.trim()) return;
    setImprovingIdx({ itemId, bulletIdx });
    setAiError(null);
    setAiSuggestion(null);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: config.improvementType || "bullet",
          text: currentText,
          context: contextTitle,
        }),
      });

      if (!res.ok) {
        let errText = await res.text();
        try { const errJson = JSON.parse(errText); errText = normalizeError(errJson); } catch {}
        throw new Error(errText || "Failed to improve bullet");
      }

      const data = await res.json();
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

  const renderField = (entry: any, field: EntryField) => {
    const value = entry[field.key] ?? "";

    switch (field.type) {
      case "url":
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateField(entry.id, field.key, e.target.value)}
            placeholder={field.placeholder}
            className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
          />
        );
      case "tags":
        return (
          <input
            type="text"
            value={getTagText(entry)}
            onChange={(e) => handleTagChange(entry.id, e.target.value)}
            placeholder={field.placeholder}
            className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
          />
        );
      case "textarea":
        return (
          <textarea
            value={value}
            onChange={(e) => updateField(entry.id, field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none resize-none"
          />
        );
      case "textarea-sm":
        return (
          <textarea
            value={value}
            onChange={(e) => updateField(entry.id, field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none resize-none"
          />
        );
      case "text":
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateField(entry.id, field.key, e.target.value)}
            placeholder={field.placeholder}
            className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">{config.title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{config.description}</p>
        </div>
        <button
          onClick={addEntry}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          <Plus size={16} />
          {config.addLabel}
        </button>
      </div>

      <div className="space-y-4">
        {entries.map((entry: any) => {
          const isExpanded = expandedId === entry.id;
          return (
            <div
              key={entry.id}
              className="rounded-xl border border-white/10 bg-[#141416]/40 overflow-hidden transition-all duration-200"
            >
              {/* Accordion Header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    onChange={(e) => { e.stopPropagation(); updateField(entry.id, "enabled", e.target.checked); }}
                    className="h-4 w-4 rounded border-white/10 bg-[#0C0C0E] text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <h3 className="font-semibold text-white">
                      {config.getEntryTitle(entry) || `Untitled ${config.title.slice(0, -1)}`}
                    </h3>
                    {config.getEntrySubtitle(entry) && (
                      <p className="text-xs text-zinc-500">{config.getEntrySubtitle(entry)}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); moveEntry(entry.id, -1); }}
                    disabled={entries.indexOf(entry) === 0}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition disabled:opacity-20 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveEntry(entry.id, 1); }}
                    disabled={entries.indexOf(entry) === entries.length - 1}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition disabled:opacity-20 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-white/5 transition"
                  >
                    <Trash size={16} />
                  </button>
                  {isExpanded ? <ChevronUp size={18} className="text-zinc-400" /> : <ChevronDown size={18} className="text-zinc-400" />}
                </div>
              </div>

              {/* Accordion Content */}
              {isExpanded && (
                <div className="border-t border-white/10 p-5 space-y-4 bg-black/20">
                  {/* Fields in grid layout */}
                  {(() => {
                    const visibleFields = config.fields.filter(f => f.type !== "tags");
                    const rows: EntryField[][] = [];
                    let currentRow: EntryField[] = [];
                    visibleFields.forEach((f) => {
                      if (f.spanFull) {
                        if (currentRow.length > 0) { rows.push(currentRow); currentRow = []; }
                        rows.push([f]);
                      } else {
                        currentRow.push(f);
                        if (currentRow.length === 2) { rows.push(currentRow); currentRow = []; }
                      }
                    });
                    if (currentRow.length > 0) rows.push(currentRow);
                    return rows.map((row, ri) => (
                      <div key={ri} className={row.length === 1 && row[0].spanFull ? "space-y-1" : "grid grid-cols-2 gap-4"}>
                        {row.map((field) => (
                          <div key={field.key} className={field.spanFull ? "space-y-1 col-span-2" : "space-y-1"}>
                            <label className="text-xs font-semibold text-zinc-400">{field.label}</label>
                            {renderField(entry, field)}
                          </div>
                        ))}
                      </div>
                    ));
                  })()}

                  {/* Tags field */}
                  {tagsField && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">{tagsField.label}</label>
                      {renderField(entry, tagsField)}
                    </div>
                  )}

                  {/* Bullets Section */}
                  {(entry.bullets !== undefined) && (
                    <div className="border-t border-white/5 pt-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-zinc-300">Details</h4>
                        <button
                          onClick={() => addBullet(entry.id)}
                          className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition"
                        >
                          <Plus size={12} />
                          Add Item
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(entry.bullets || []).map((bullet: string, bulletIdx: number) => {
                          const isImproving = improvingIdx?.itemId === entry.id && improvingIdx?.bulletIdx === bulletIdx;
                          const hasSuggestion = aiSuggestion?.itemId === entry.id && aiSuggestion?.bulletIdx === bulletIdx;

                          return (
                            <div key={bulletIdx} className="space-y-2">
                              <div className="flex gap-2">
                                <span className="text-zinc-500 text-sm mt-2.5 font-bold">&bull;</span>
                                <textarea
                                  value={bullet}
                                  onChange={(e) => updateBullet(entry.id, bulletIdx, e.target.value)}
                                  placeholder="Describe your contribution..."
                                  rows={2}
                                  className="flex-1 rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none resize-none"
                                />
                                <div className="flex flex-col gap-1.5 justify-center">
                                  {config.hasAIImprovement && (
                                    <button
                                      onClick={() => handleImproveBullet(entry.id, bulletIdx, bullet, config.getEntryTitle(entry))}
                                      disabled={isImproving || !bullet.trim()}
                                      title="Improve with AI"
                                      className="p-2 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition disabled:opacity-40 disabled:hover:bg-blue-600/10 disabled:hover:text-blue-400"
                                    >
                                      <Sparkles size={14} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => removeBullet(entry.id, bulletIdx)}
                                    className="p-2 rounded-lg bg-white/5 text-zinc-500 hover:text-red-500 hover:bg-white/10 transition"
                                  >
                                    <Trash size={14} />
                                  </button>
                                </div>
                              </div>

                              {isImproving && (
                                <p className="text-xs text-blue-400 animate-pulse pl-5">Improving with AI...</p>
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
                                        <button onClick={applyBulletSuggestion} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-0.5 rounded transition flex items-center gap-0.5">
                                          <Check size={10} /> Apply
                                        </button>
                                        <button onClick={() => setAiSuggestion(null)} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs p-1 rounded transition">
                                          <X size={10} />
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-xs text-zinc-300 italic">&ldquo;{aiSuggestion.text}&rdquo;</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Description field for Publications (no bullets) */}
                  {entry.description !== undefined && entry.bullets === undefined && (
                    <div className="border-t border-white/5 pt-4 space-y-3">
                      <h4 className="text-sm font-semibold text-zinc-300">Description</h4>
                      {/* description is already rendered as a textarea-sm field above */}
                    </div>
                  )}

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
