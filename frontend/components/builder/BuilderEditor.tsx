"use client";

import { Resume } from "@/types/resume";
import { BuilderSection } from "@/store/resumeStore";
import EditorProfile from "./editor/EditorProfile";
import EditorSummary from "./editor/EditorSummary";
import EditorExperience from "./editor/EditorExperience";
import EditorEducation from "./editor/EditorEducation";
import EditorProjects from "./editor/EditorProjects";
import EditorSkills from "./editor/EditorSkills";
import EditorAchievements from "./editor/EditorAchievements";
import EditorCertifications from "./editor/EditorCertifications";
import EditorLanguages from "./editor/EditorLanguages";

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
  return (
    <div className="p-6">
      {(() => {
        switch (selectedSection) {
          case "Profile":
            return <EditorProfile resume={resume} setResume={setResume} />;
          case "Summary":
            return <EditorSummary resume={resume} setResume={setResume} />;
          case "Experience":
            return <EditorExperience resume={resume} setResume={setResume} />;
          case "Education":
            return <EditorEducation resume={resume} setResume={setResume} />;
          case "Projects":
            return <EditorProjects resume={resume} setResume={setResume} />;
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
