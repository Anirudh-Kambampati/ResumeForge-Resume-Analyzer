"use client";

import Link from "next/link";
import {
  User,
  FileText,
  Briefcase,
  GraduationCap,
  FolderKanban,
  Wrench,
  Trophy,
  Award,
  Globe,
} from "lucide-react";

import { BuilderSection } from "@/store/resumeStore";

const sections: {
  id: BuilderSection;
  label: string;
  icon: React.ElementType;
}[] = [
  {
    id: "Profile",
    label: "Profile",
    icon: User,
  },
  {
    id: "Summary",
    label: "Summary",
    icon: FileText,
  },
  {
    id: "Experience",
    label: "Experience",
    icon: Briefcase,
  },
  {
    id: "Education",
    label: "Education",
    icon: GraduationCap,
  },
  {
    id: "Projects",
    label: "Projects",
    icon: FolderKanban,
  },
  {
    id: "Skills",
    label: "Skills",
    icon: Wrench,
  },
  {
    id: "Achievements",
    label: "Achievements",
    icon: Trophy,
  },
  {
    id: "Certifications",
    label: "Certifications",
    icon: Award,
  },
  {
    id: "Languages",
    label: "Languages",
    icon: Globe,
  },
];

type Props = {
  selectedSection: BuilderSection;
  setSelectedSection: (section: BuilderSection) => void;
};

export default function BuilderSidebar({
  selectedSection,
  setSelectedSection,
}: Props) {
  return (
    <aside className="flex w-64 flex-col border-r border-white/10 bg-[#09090B]">

      {/* Logo */}

      <div className="border-b border-white/10 px-6 py-7">

        <h1>
          <Link
            href="/"
            className="cursor-pointer text-2xl font-bold tracking-tight transition-colors hover:text-blue-400"
          >
            ResumeForge
          </Link>
        </h1>

        <p className="mt-2 text-sm text-zinc-500">
          ATS Resume Builder
        </p>

      </div>

      {/* Navigation */}

      <nav className="flex-1 px-4 py-6">

        <div className="space-y-2">

          {sections.map((section) => {
            const active = selectedSection === section.id;

            const Icon = section.icon;

            return (
              <button
                key={section.id}
                onClick={() => setSelectedSection(section.id)}
                className={`
                  flex
                  w-full
                  items-center
                  gap-3
                  rounded-xl
                  px-4
                  py-3
                  text-left
                  transition-all
                  duration-200

                  ${
                    active
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }
                `}
              >
                <Icon size={18} />

                <span className="font-medium">
                  {section.label}
                </span>
              </button>
            );
          })}

        </div>

      </nav>


    </aside>
  );
}
