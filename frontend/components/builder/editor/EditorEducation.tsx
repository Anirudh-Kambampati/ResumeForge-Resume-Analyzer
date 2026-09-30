"use client";

import { useState } from "react";
import { Resume, Education } from "@/types/resume";
import { Plus, Trash, ChevronDown, ChevronUp } from "lucide-react";
import MoveButtons, { moveItem } from "@/components/ui/MoveButtons";
import ClearableInput from "@/components/ui/ClearableInput";

type Props = {
  resume: Resume;
  setResume: (resume: Resume) => void;
};

export default function EditorEducation({ resume, setResume }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const updateEducation = (education: Education[]) => {
    setResume({
      ...resume,
      education,
    });
  };

  const addEducation = () => {
    const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `edu-${Date.now()}`;
    const newEdu: Education = {
      id: newId,
      enabled: true,
      institution: "",
      degree: "",
      field: "",
      grade: "",
      startDate: "",
      endDate: "",
    };
    updateEducation([...resume.education, newEdu]);
    setExpandedId(newId);
  };

  const removeEducation = (id: string) => {
    updateEducation(resume.education.filter((edu) => edu.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const updateField = (id: string, field: keyof Education, value: any) => {
    const updated = resume.education.map((edu) => {
      if (edu.id === id) {
        return { ...edu, [field]: value };
      }
      return edu;
    });
    updateEducation(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Education</h2>
          <p className="mt-1 text-sm text-zinc-500">
            List your academic degrees, certifications, and institutions.
          </p>
        </div>
        <button
          onClick={addEducation}
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
          Add Education
        </button>
      </div>

      <div className="space-y-4">
        {resume.education.map((edu, index) => {
          const safeId = edu.id || `edu-${index}-${Date.now()}`;
          const isExpanded = expandedId === safeId;
          const isEnabled = typeof edu.enabled === "boolean" ? edu.enabled : true;
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
                      {edu.degree || "Untitled Degree"}{edu.field ? ` in ${edu.field}` : ""}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {edu.institution || "No Institution"} &bull; {edu.startDate || "Start Year"} — {edu.endDate || "End Year"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MoveButtons index={index} count={resume.education.length} onMove={(dir) => updateEducation(moveItem(resume.education, index, dir))} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeEducation(safeId);
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
                      <label className="text-xs font-semibold text-zinc-400">Institution / School</label>
                      <ClearableInput
                        value={edu.institution}
                        onChange={(e) => updateField(safeId, "institution", e.target.value)}
                        onClear={() => updateField(safeId, "institution", "")}
                        placeholder="e.g. Stanford University"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">Degree</label>
                      <ClearableInput
                        value={edu.degree}
                        onChange={(e) => updateField(safeId, "degree", e.target.value)}
                        onClear={() => updateField(safeId, "degree", "")}
                        placeholder="e.g. Bachelor of Science"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">Field of Study</label>
                      <ClearableInput
                        value={edu.field}
                        onChange={(e) => updateField(safeId, "field", e.target.value)}
                        onClear={() => updateField(safeId, "field", "")}
                        placeholder="e.g. Computer Science"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">Grade / GPA / Score</label>
                      <ClearableInput
                        value={edu.grade}
                        onChange={(e) => updateField(safeId, "grade", e.target.value)}
                        onClear={() => updateField(safeId, "grade", "")}
                        placeholder="e.g. 3.9 GPA or 90%"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">Start Date / Year</label>
                      <ClearableInput
                        value={edu.startDate}
                        onChange={(e) => updateField(safeId, "startDate", e.target.value)}
                        onClear={() => updateField(safeId, "startDate", "")}
                        placeholder="e.g. 2016"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">End Date / Year</label>
                      <ClearableInput
                        value={edu.endDate}
                        onChange={(e) => updateField(safeId, "endDate", e.target.value)}
                        onClear={() => updateField(safeId, "endDate", "")}
                        placeholder="e.g. 2020"
                      />
                    </div>
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
