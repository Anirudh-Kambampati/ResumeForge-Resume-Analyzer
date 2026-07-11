"use client";

import { useState } from "react";
import { Resume, Education } from "@/types/resume";
import { Plus, Trash, ChevronDown, ChevronUp } from "lucide-react";

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
            text-white
            transition
            hover:bg-blue-500
          "
        >
          <Plus size={16} />
          Add Education
        </button>
      </div>

      <div className="space-y-4">
        {resume.education.map((edu) => {
          const isExpanded = expandedId === edu.id;
          return (
            <div
              key={edu.id}
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
                onClick={() => setExpandedId(isExpanded ? null : edu.id)}
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
                    checked={edu.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateField(edu.id, "enabled", e.target.checked);
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
                      {edu.degree || "Untitled Degree"}{edu.field ? ` in ${edu.field}` : ""}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {edu.institution || "No Institution"} &bull; {edu.startDate || "Start Year"} — {edu.endDate || "End Year"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeEducation(edu.id);
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
                      <input
                        type="text"
                        value={edu.institution}
                        onChange={(e) => updateField(edu.id, "institution", e.target.value)}
                        placeholder="e.g. Stanford University"
                        className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">Degree</label>
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) => updateField(edu.id, "degree", e.target.value)}
                        placeholder="e.g. Bachelor of Science"
                        className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">Field of Study</label>
                      <input
                        type="text"
                        value={edu.field}
                        onChange={(e) => updateField(edu.id, "field", e.target.value)}
                        placeholder="e.g. Computer Science"
                        className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">Grade / GPA / Score</label>
                      <input
                        type="text"
                        value={edu.grade}
                        onChange={(e) => updateField(edu.id, "grade", e.target.value)}
                        placeholder="e.g. 3.9 GPA or 90%"
                        className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">Start Date / Year</label>
                      <input
                        type="text"
                        value={edu.startDate}
                        onChange={(e) => updateField(edu.id, "startDate", e.target.value)}
                        placeholder="e.g. 2016"
                        className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">End Date / Year</label>
                      <input
                        type="text"
                        value={edu.endDate}
                        onChange={(e) => updateField(edu.id, "endDate", e.target.value)}
                        placeholder="e.g. 2020"
                        className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
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
