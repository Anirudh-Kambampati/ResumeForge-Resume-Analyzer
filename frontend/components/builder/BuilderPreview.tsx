"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Resume } from "@/types/resume";
import { BuilderSection } from "@/store/resumeStore";

import ResumePage from "./preview/ResumePage";

// Matches ResumePage's fixed A4 width (w-[794px])
const PAGE_WIDTH = 794;

type Props = {
  resume: Resume;
  selectedSection: BuilderSection;
};

export default function BuilderPreview({
  resume,
  selectedSection,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [scale, setScale] = useState(1);

  // Shrink the page to fit narrow screens; never upscale. Print resets to 1.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(el);
      const inner = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (inner > 0) setScale(Math.min(1, inner / PAGE_WIDTH));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="flex h-full items-start justify-center overflow-auto bg-canvas p-4 sm:p-10"
    >
      <div
        className="[zoom:var(--preview-scale)] print:[zoom:1]"
        style={{ "--preview-scale": scale } as CSSProperties}
      >
        <ResumePage
          resume={resume}
          selectedSection={selectedSection}
        />
      </div>
    </section>
  );
}
