import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Candidate Screening · ResumeForge for Businesses",
  description: "Screen resumes against job descriptions in parallel queues.",
};

export default function ScreeningLayout({ children }: { children: React.ReactNode }) {
  return children;
}
