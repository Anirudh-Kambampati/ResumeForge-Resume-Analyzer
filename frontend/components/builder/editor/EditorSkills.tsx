"use client";

import { useState } from "react";
import { Resume, SkillCategory } from "@/types/resume";
import { Plus, Trash } from "lucide-react";
import MoveButtons, { moveItem } from "@/components/ui/MoveButtons";
import ClearableInput from "@/components/ui/ClearableInput";
import ClearableTextarea from "@/components/ui/ClearableTextarea";

type Props = {
  resume: Resume;
  setResume: (resume: Resume) => void;
};

export default function EditorSkills({ resume, setResume }: Props) {
  const [newCategoryTitle, setNewCategoryTitle] = useState("");

  // Local raw text for each category's textarea to preserve cursor position.
  // Keyed by category.id. Falls back to items.join(", ") when unset.
  const [skillTexts, setSkillTexts] = useState<Record<string, string>>({});

  const updateSkills = (skills: SkillCategory[]) => {
    setResume({
      ...resume,
      skills,
    });
  };

  const addCategory = () => {
    if (!newCategoryTitle.trim()) return;
    const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `skills-${Date.now()}`;
    const newCat: SkillCategory = {
      id: newId,
      title: newCategoryTitle.trim(),
      items: [],
    };
    updateSkills([...resume.skills, newCat]);
    setNewCategoryTitle("");
  };

  const removeCategory = (id: string) => {
    updateSkills(resume.skills.filter((cat) => cat.id !== id));
    setSkillTexts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateCategoryTitle = (id: string, newTitle: string) => {
    const updated = resume.skills.map((cat) => {
      if (cat.id === id) {
        return { ...cat, title: newTitle };
      }
      return cat;
    });
    updateSkills(updated);
  };

  /**
   * Get the text to display in a category's textarea.
   * If the user has typed into it, return their raw text (preserves cursor).
   * Otherwise, fall back to the model's items joined by ", ".
   */
  const getSkillText = (cat: SkillCategory): string =>
    skillTexts[cat.id] ?? cat.items.join(", ");

  const handleItemsChange = (id: string, rawValue: string) => {
    // 1. Update local raw text (source of truth for the textarea display)
    setSkillTexts((prev) => ({ ...prev, [id]: rawValue }));

    // 2. Parse into items and update model
    const items = rawValue.split(",").map((i) => i.trim()).filter(Boolean);
    const updated = resume.skills.map((cat) => {
      if (cat.id === id) {
        return { ...cat, items };
      }
      return cat;
    });
    updateSkills(updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Skills</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Group your technical skills into clear, scan-friendly categories.
        </p>
      </div>

      {/* Category List */}
      <div className="space-y-5">
        {resume.skills.map((category, index) => (
          <div
            key={category.id}
            className="
              rounded-xl
              border
              border-white/10
              bg-card/40
              p-4
              space-y-3
            "
          >
            <div className="flex items-center justify-between gap-3">
              <ClearableInput
                value={category.title}
                onChange={(e) => updateCategoryTitle(category.id, e.target.value)}
                onClear={() => updateCategoryTitle(category.id, "")}
                placeholder="Category Title (e.g. Languages)"
                className="bg-transparent border-none text-lg font-medium text-white w-1/2 border-b border-dashed border-white/10 focus:border-blue-500 pb-0.5"
              />
              <div className="flex items-center gap-1">
                <MoveButtons index={index} count={resume.skills.length} onMove={(dir) => updateSkills(moveItem(resume.skills, index, dir))} />
                <button
                onClick={() => removeCategory(category.id)}
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
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Skills (Comma-separated)</label>
              <ClearableTextarea
                value={getSkillText(category)}
                onChange={(e) => handleItemsChange(category.id, e.target.value)}
                onClear={() => handleItemsChange(category.id, "")}
                placeholder="e.g. React, Next.js, Vue, Angular"
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Add Category Form */}
      <div
        className="
          flex
          items-center
          gap-3
          bg-card/20
          p-4
          rounded-xl
          border
          border-dashed
          border-white/10
        "
      >
        <input
          type="text"
          placeholder="New Category Title (e.g., Databases)"
          value={newCategoryTitle}
          onChange={(e) => setNewCategoryTitle(e.target.value)}
          className="
            flex-1
            bg-panel
            border
            border-white/10
            rounded-lg
            px-3
            py-2
            text-sm
            text-white
            focus:border-blue-500
            outline-none
          "
        />
        <button
          onClick={addCategory}
          disabled={!newCategoryTitle.trim()}
          className="
            flex
            items-center
            gap-1
            rounded-lg
            bg-blue-600
            px-4
            py-2
            text-sm
            font-medium
            text-on-accent
            transition
            hover:bg-blue-500
            disabled:opacity-40
            disabled:hover:bg-blue-600
          "
        >
          <Plus size={16} />
          Add Category
        </button>
      </div>
    </div>
  );
}
