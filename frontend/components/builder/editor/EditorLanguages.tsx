"use client";

import { useState } from "react";
import { Resume, Language } from "@/types/resume";
import { Plus, Trash, ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  resume: Resume;
  setResume: (resume: Resume) => void;
};

export default function EditorLanguages({ resume, setResume }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const updateLanguages = (languages: Language[]) => {
    setResume({
      ...resume,
      languages,
    });
  };

  const addLanguage = () => {
    const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `lang-${Date.now()}`;
    const newLang: Language = {
      id: newId,
      enabled: true,
      name: "",
      proficiency: "",
    };
    updateLanguages([...(resume.languages || []), newLang]);
    setExpandedId(newId);
  };

  const removeLanguage = (id: string) => {
    updateLanguages((resume.languages || []).filter((l) => l.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const updateField = (id: string, field: keyof Language, value: any) => {
    const updated = (resume.languages || []).map((l) => {
      if (l.id === id) {
        return { ...l, [field]: value };
      }
      return l;
    });
    updateLanguages(updated);
  };

  const languageList = resume.languages || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Languages</h2>
          <p className="mt-1 text-sm text-zinc-500">
            List languages you speak and your proficiency levels.
          </p>
        </div>
        <button
          onClick={addLanguage}
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
          Add Language
        </button>
      </div>

      <div className="space-y-4">
        {languageList.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 py-12 text-center">
            <p className="text-sm text-zinc-400">No languages added yet.</p>
            <button
              onClick={addLanguage}
              className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-500 hover:text-blue-400 transition"
            >
              <Plus size={16} />
              Add your first language
            </button>
          </div>
        ) : (
          languageList.map((lang) => {
            const isExpanded = expandedId === lang.id;
            return (
            <div
              key={lang.id}
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
                onClick={() => setExpandedId(isExpanded ? null : lang.id)}
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
                    checked={lang.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateField(lang.id, "enabled", e.target.checked);
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
                      {lang.name || "Untitled Language"}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {lang.proficiency || "No Proficiency Set"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLanguage(lang.id);
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
                      <label className="text-xs font-semibold text-zinc-400">Language Name</label>
                      <input
                        type="text"
                        value={lang.name}
                        onChange={(e) => updateField(lang.id, "name", e.target.value)}
                        placeholder="e.g. English, Spanish, Japanese"
                        className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">Proficiency</label>
                      <input
                        type="text"
                        value={lang.proficiency}
                        onChange={(e) => updateField(lang.id, "proficiency", e.target.value)}
                        placeholder="e.g. Native, Fluent, Conversational, Basic"
                        className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })
        )}
      </div>
    </div>
  );
}
