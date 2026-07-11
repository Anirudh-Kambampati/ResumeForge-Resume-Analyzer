"use client";

import { Resume } from "@/types/resume";
import { BuilderSection } from "@/store/resumeStore";

import ResumePage from "./preview/ResumePage";

type Props = {
  resume: Resume;
  selectedSection: BuilderSection;
};

export default function BuilderPreview({
  resume,
  selectedSection,
}: Props) {
  return (
    <section className="flex h-full items-start justify-center overflow-auto bg-[#111113] p-10">

      <ResumePage
        resume={resume}
        selectedSection={selectedSection}
      />

    </section>
  );
}