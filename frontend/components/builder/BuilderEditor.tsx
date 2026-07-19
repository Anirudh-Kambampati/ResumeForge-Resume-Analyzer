"use client";

import { useEffect, useRef } from "react";
import { Resume } from "@/types/resume";
import { BuilderSection } from "@/store/resumeStore";
import EditorAbout from "./editor/EditorAbout";
import EditorExperience from "./editor/EditorExperience";
import EditorEducation from "./editor/EditorEducation";
import EditorProjects from "./editor/EditorProjects";
import EditorSkills from "./editor/EditorSkills";
import EditorAchievements from "./editor/EditorAchievements";
import EditorCertifications from "./editor/EditorCertifications";
import EditorLanguages from "./editor/EditorLanguages";

import GenericEntryEditor from "./editor/GenericEntryEditor";
import { sectionConfigs } from "@/lib/sectionConfig";

type Props = {
  resume: Resume;
  setResume: (resume: Resume) => void;
  selectedSection: BuilderSection;
};

export default function BuilderEditor({
  resume,
  setResume,
  selectedSection,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Smooth-scroll to the top of the editor panel when switching sections
  useEffect(() => {
    if (containerRef.current) {
      const editorPanel = containerRef.current.closest(".overflow-y-auto");
      if (editorPanel) {
        editorPanel.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [selectedSection]);

  return (
    <div ref={containerRef} className="p-6">
      {(() => {
        switch (selectedSection) {
          case "Profile":
            return <EditorAbout resume={resume} setResume={setResume} />;
          case "Experience":
            return <EditorExperience resume={resume} setResume={setResume} />;
          case "Education":
            return <EditorEducation resume={resume} setResume={setResume} />;
          case "Projects":
          case "Research":
          case "Publications":
            return (
              <GenericEntryEditor
                resume={resume}
                setResume={setResume}
                config={sectionConfigs[selectedSection]}
              />
            );
          case "Skills":
            return <EditorSkills resume={resume} setResume={setResume} />;
          case "Achievements":
            return <EditorAchievements resume={resume} setResume={setResume} />;
          case "Certifications":
            return <EditorCertifications resume={resume} setResume={setResume} />;
          case "Languages":
            return <EditorLanguages resume={resume} setResume={setResume} />;
          default:
            return null;
        }
      })()}
    </div>
  );
}
