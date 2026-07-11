"use client";

import { useState } from "react";
import { Resume, Project } from "@/types/resume";
import { Plus, Trash, ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  resume: Resume;
  setResume: (resume: Resume) => void;
};

export default function EditorProjects({ resume, setResume }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const handleTechChange = (id: string, value: string) => {
    // Convert comma-separated string to array
    const techs = value.split(",").map((t) => t.trim()).filter(Boolean);
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
            text-white
            transition
            hover:bg-blue-500
          "
        >
          <Plus size={16} />
          Add Project
        </button>
      </div>

      <div className="space-y-4">
        {resume.projects.map((project) => {
          const isExpanded = expandedId === project.id;
          return (
            <div
              key={project.id}
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
                onClick={() => setExpandedId(isExpanded ? null : project.id)}
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
                    checked={project.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateField(project.id, "enabled", e.target.checked);
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
                      {project.title || "Untitled Project"}
                    </h3>
                    {project.technologies.length > 0 && (
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
                      removeProject(project.id);
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
                      <input
                        type="text"
                        value={project.title}
                        onChange={(e) => updateField(project.id, "title", e.target.value)}
                        placeholder="e.g. ResumeForge"
                        className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">Project Link (Optional)</label>
                      <input
                        type="text"
                        value={project.link || ""}
                        onChange={(e) => updateField(project.id, "link", e.target.value)}
                        placeholder="e.g. https://resumeforge.dev"
                        className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400">Technologies (Comma-separated)</label>
                    <input
                      type="text"
                      value={project.technologies.join(", ")}
                      onChange={(e) => handleTechChange(project.id, e.target.value)}
                      placeholder="e.g. Next.js, FastAPI, PostgreSQL, Tailwind"
                      className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* Bullets Section */}
                  <div className="border-t border-white/5 pt-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-semibold text-zinc-300">Project Accomplishments / Bullets</h4>
                      <button
                        onClick={() => addBullet(project.id)}
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
                      {project.bullets.map((bullet, bulletIdx) => (
                        <div key={bulletIdx} className="flex gap-2">
                          <span className="text-zinc-500 text-sm mt-2 font-bold">&bull;</span>
                          <input
                            type="text"
                            value={bullet}
                            onChange={(e) => updateBullet(project.id, bulletIdx, e.target.value)}
                            placeholder="e.g. Integrated OpenRouter API to evaluate resume compliance"
                            className="
                              flex-1
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
                            "
                          />
                          <button
                            onClick={() => removeBullet(project.id, bulletIdx)}
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
                      ))}
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
