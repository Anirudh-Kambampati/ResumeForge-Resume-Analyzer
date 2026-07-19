"use client";

import { Resume } from "@/types/resume";
import { BuilderSection } from "@/store/resumeStore";
import { Inter } from "next/font/google";
import { normalizeEmail, normalizeUrl } from "@/lib/contactLinks";
import { getResumeLayout } from "@/lib/resumeLayout";
import { hasSectionData } from "@/config/sections";
import { getTemplateStyles } from "@/config/templates";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type Props = {
  resume: Resume;
  selectedSection: BuilderSection;
};



export default function ResumePage({
  resume,
  selectedSection,
}: Props) {
  const highlight = (section: BuilderSection) =>
    selectedSection === section
      ? "ring-2 ring-blue-500/40 rounded-sm transition-all duration-200 print:ring-0 print:outline-none"
      : "";

  const L = getResumeLayout(resume);

  const pt = (v: number) => `${v}pt`;
  const cssPx = (v: number) => `${Math.round(v * 1.333)}px`;

  const profile = resume.profile || {};
  const links = profile.links || [];

  const contactInfo = [
    profile.email && { label: profile.email, href: normalizeEmail(profile.email) },
    profile.phone && { label: profile.phone },
    profile.location && { label: profile.location },
    ...links.map((link) => {
      const href = normalizeUrl(link.url);
      return href ? { label: link.label || link.url, href } : null;
    }),
  ].filter(Boolean) as { label: string; href?: string }[];

  const T = getTemplateStyles(resume.template);

  const sectionHeading = (label: string) => {
    const textTransform = T.sectionHeaderTransform === "uppercase" ? "uppercase" : "none";
    return (
      <h2
        className={`border-b-2 border-neutral-800 tracking-wider text-neutral-900`}
        style={{
          fontSize: pt(L.sectionHeaderFontSize),
          fontWeight: T.sectionHeaderFontWeight,
          letterSpacing: T.sectionHeaderLetterSpacing,
          borderBottomWidth: T.sectionHeaderBorderWidth,
          borderBottomStyle: T.sectionHeaderBorderStyle as "solid" | "double",
          paddingBottom: pt(L.sectionHeaderPaddingBottom),
          marginBottom: pt(L.sectionHeaderMarginBottom),
          textTransform: textTransform as "uppercase" | "none",
        }}
      >
        {label}
      </h2>
    );
  };

  // ============================================================
  // Section renderer — driven by sectionOrder from resume
  // Each section renders its content based on the section key.
  // ============================================================
  const renderSection = (section: string) => {
    switch (section) {
      // ========================
      // Experience
      // ========================
      case "Experience": {
        const enabled = (resume.experience || []).filter((job) => job.enabled);
        if (enabled.length === 0) return null;
        return (
          <section className={highlight("Experience")} style={{ marginTop: pt(L.sectionMarginTop) }}>
            {sectionHeading("EXPERIENCE")}
            <div>
              {enabled.map((job, idx) => (
                <div key={job.id} style={{ marginTop: idx > 0 ? pt(L.entryGap) : "0px" }}>
                  <div
                    className="flex justify-between font-sans"
                    style={{ fontSize: pt(L.entryTitleFontSize), lineHeight: String(L.entryTitleLineHeight) }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: pt(L.entrySubtitleFontSize),
                          fontWeight: T.entryTitleFontWeight,
                          color: "#171717",
                        }}
                      >
                        {job.role}
                      </span>
                      <span className="text-neutral-600" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                        {" "}&mdash;{" "}{job.company}
                      </span>
                    </div>
                    <div className="text-neutral-500 font-medium text-right" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                      {job.location && <span>{job.location} | </span>}
                      <span>{job.startDate} &ndash; {job.currentlyWorking ? "Present" : job.endDate}</span>
                    </div>
                  </div>
                  {job.bullets && job.bullets.length > 0 && (
                    <ul className="list-disc text-neutral-700 leading-normal" style={{ marginTop: pt(L.bulletListMarginTop), paddingLeft: pt(L.bulletListPaddingLeft) }}>
                      {job.bullets.filter((b) => b.trim()).map((bullet, bulletIdx) => (
                        <li key={bulletIdx} style={{ fontSize: pt(L.bulletFontSize), lineHeight: String(L.bulletLineHeight), marginBottom: pt(L.bulletGap) }}>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      }

      // ========================
      // Education
      // ========================
      case "Education": {
        const enabled = (resume.education || []).filter((edu) => edu.enabled);
        if (enabled.length === 0) return null;
        return (
          <section className={highlight("Education")} style={{ marginTop: pt(L.sectionMarginTop) }}>
            {sectionHeading("EDUCATION")}
            <div>
              {enabled.map((edu, idx) => (
                <div key={edu.id} className="flex justify-between font-sans" style={{ marginTop: idx > 0 ? pt(L.entryGap) : "0px", fontSize: pt(L.entryTitleFontSize), lineHeight: String(L.entryTitleLineHeight) }}>
                  <div>
                    <span
                      style={{
                        fontSize: pt(L.entrySubtitleFontSize),
                        fontWeight: T.entryTitleFontWeight,
                        color: "#171717",
                      }}
                    >
                      {edu.degree}
                    </span>
                    {edu.field && <span className="text-neutral-600" style={{ fontSize: pt(L.entryMetaFontSize) }}> in {edu.field}</span>}
                    <div className="text-neutral-600" style={{ fontSize: pt(L.entryMetaFontSize) }}>{edu.institution}</div>
                    {edu.grade && <div className="italic text-neutral-500" style={{ fontSize: pt(L.entryMetaFontSize) }}>GPA: {edu.grade}</div>}
                  </div>
                  <div className="text-right text-neutral-500 font-medium font-sans" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                    <div>{edu.startDate} &ndash; {edu.endDate}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      }

      // ========================
      // Projects
      // ========================
      case "Projects": {
        const enabled = (resume.projects || []).filter((p) => p.enabled);
        if (enabled.length === 0) return null;
        return (
          <section className={highlight("Projects")} style={{ marginTop: pt(L.sectionMarginTop) }}>
            {sectionHeading("PROJECTS")}
            <div>
              {enabled.map((project, idx) => (
                <div key={project.id} style={{ marginTop: idx > 0 ? pt(L.entryGap) : "0px" }}>
                  <div className="flex justify-between font-sans" style={{ fontSize: pt(L.entryTitleFontSize), lineHeight: String(L.entryTitleLineHeight) }}>
                    <div>
                      <span style={{ fontSize: pt(L.entrySubtitleFontSize), fontWeight: T.entryTitleFontWeight, color: "#171717" }}>{project.title}</span>
                      {project.link && <span className="text-neutral-500 ml-2 select-all font-mono" style={{ fontSize: pt(L.entryMetaFontSize) }}>({project.link})</span>}
                    </div>
                    {project.technologies && project.technologies.length > 0 && (
                      <div className="text-neutral-500 italic font-medium" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                        {project.technologies.join(", ")}
                      </div>
                    )}
                  </div>
                  {project.bullets && project.bullets.length > 0 && (
                    <ul className="list-disc text-neutral-700 leading-normal" style={{ marginTop: pt(L.bulletListMarginTop), paddingLeft: pt(L.bulletListPaddingLeft) }}>
                      {project.bullets.filter((b) => b.trim()).map((bullet, bulletIdx) => (
                        <li key={bulletIdx} style={{ fontSize: pt(L.bulletFontSize), lineHeight: String(L.bulletLineHeight), marginBottom: pt(L.bulletGap) }}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      }

      // ========================
      // Research
      // ========================
      case "Research": {
        const enabled = (resume.research || []).filter((r: any) => r.enabled);
        if (enabled.length === 0) return null;
        return (
          <section className={highlight("Research")} style={{ marginTop: pt(L.sectionMarginTop) }}>
            {sectionHeading("RESEARCH")}
            <div>
              {enabled.map((item: any, idx: number) => (
                <div key={item.id} style={{ marginTop: idx > 0 ? pt(L.entryGap) : "0px" }}>
                  <div className="flex justify-between font-sans" style={{ fontSize: pt(L.entryTitleFontSize), lineHeight: String(L.entryTitleLineHeight) }}>
                    <div>
                      <span style={{ fontSize: pt(L.entrySubtitleFontSize), fontWeight: T.entryTitleFontWeight, color: "#171717" }}>{item.title}</span>
                      {item.institution && <span className="text-neutral-600" style={{ fontSize: pt(L.entryMetaFontSize) }}> &mdash; {item.institution}</span>}
                      {item.advisor && <div className="text-neutral-500 italic" style={{ fontSize: pt(L.entryMetaFontSize) }}>Advisor: {item.advisor}</div>}
                      {item.link && <span className="text-neutral-500 ml-2 select-all font-mono" style={{ fontSize: pt(L.entryMetaFontSize) }}>({item.link})</span>}
                    </div>
                    <div className="text-neutral-500 font-medium text-right" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                      {item.duration && <div>{item.duration}</div>}
                      {item.keywords?.length > 0 && <div className="italic">{item.keywords.join(", ")}</div>}
                    </div>
                  </div>
                  {item.bullets && item.bullets.filter(Boolean).length > 0 && (
                    <ul className="list-disc text-neutral-700 leading-normal" style={{ marginTop: pt(L.bulletListMarginTop), paddingLeft: pt(L.bulletListPaddingLeft) }}>
                      {item.bullets.filter((b: string) => b.trim()).map((bullet: string, bulletIdx: number) => (
                        <li key={bulletIdx} style={{ fontSize: pt(L.bulletFontSize), lineHeight: String(L.bulletLineHeight), marginBottom: pt(L.bulletGap) }}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      }

      // ========================
      // Publications
      // ========================
      case "Publications": {
        const enabled = (resume.publications || []).filter((p: any) => p.enabled);
        if (enabled.length === 0) return null;
        return (
          <section className={highlight("Publications")} style={{ marginTop: pt(L.sectionMarginTop) }}>
            {sectionHeading("PUBLICATIONS")}
            <div>
              {enabled.map((item: any, idx: number) => (
                <div key={item.id} style={{ marginTop: idx > 0 ? pt(L.entryGap) : "0px" }}>
                  <div className="flex justify-between font-sans" style={{ fontSize: pt(L.entryTitleFontSize), lineHeight: String(L.entryTitleLineHeight) }}>
                    <div>
                      <span style={{ fontSize: pt(L.entrySubtitleFontSize), fontWeight: T.entryTitleFontWeight, color: "#171717" }}>{item.title}</span>
                      {item.authors && <div className="text-neutral-600" style={{ fontSize: pt(L.entryMetaFontSize) }}>{item.authors}</div>}
                      <div className="text-neutral-600" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                        {item.venue}
                        {item.doi && <span className="text-neutral-500 ml-2 select-all font-mono" style={{ fontSize: pt(L.entryMetaFontSize) }}>({item.doi})</span>}
                      </div>
                    </div>
                    <div className="text-right text-neutral-500 font-medium font-sans" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                      {item.date && <div>{item.date}</div>}
                      {item.keywords?.length > 0 && <div className="italic">{item.keywords.join(", ")}</div>}
                    </div>
                  </div>
                  {item.description && (
                    <p className="text-neutral-700 leading-normal mt-1" style={{ fontSize: pt(L.bulletFontSize), lineHeight: String(L.bulletLineHeight) }}>
                      {item.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      }

      // ========================
      // Skills
      // ========================
      case "Skills": {
        const active = (resume.skills || []).filter((cat) => cat.title && cat.items?.length > 0);
        if (active.length === 0) return null;
        return (
          <section className={highlight("Skills")} style={{ marginTop: pt(L.sectionMarginTop) }}>
            {sectionHeading("SKILLS")}
            <div className="font-sans" style={{ marginTop: pt(L.skillsMarginTop) }}>
              {active.map((category) => (
                <div key={category.id} style={{ fontSize: pt(L.skillsItemFontSize), lineHeight: String(L.skillsItemLineHeight), marginBottom: pt(L.skillsItemMarginBottom) }}>
                  <span style={{ fontWeight: T.entryTitleFontWeight, color: "#171717" }}>{category.title}:</span>{" "}
                  <span className="text-neutral-700">{category.items.join(", ")}</span>
                </div>
              ))}
            </div>
          </section>
        );
      }

      // ========================
      // Achievements
      // ========================
      case "Achievements": {
        const enabled = (resume.achievements || []).filter((a) => a.enabled);
        if (enabled.length === 0) return null;
        return (
          <section className={highlight("Achievements")} style={{ marginTop: pt(L.sectionMarginTop) }}>
            {sectionHeading("ACHIEVEMENTS")}
            <ul className="list-disc font-sans" style={{ marginTop: pt(L.achievementsListMarginTop), paddingLeft: pt(L.achievementsPaddingLeft) }}>
              {enabled.map((achievement) => (
                <li key={achievement.id} style={{ fontSize: pt(L.achievementsItemFontSize), lineHeight: String(L.achievementsItemLineHeight), marginBottom: pt(L.achievementsItemMarginBottom) }}>
                  <span className="text-neutral-950">{achievement.title}</span>
                  {achievement.description && <span> &mdash; {achievement.description}</span>}
                </li>
              ))}
            </ul>
          </section>
        );
      }

      // ========================
      // Certifications
      // ========================
      case "Certifications": {
        const enabled = (resume.certifications || []).filter((c) => c.enabled);
        if (enabled.length === 0) return null;
        const leftCol = enabled.filter((_, idx) => idx % 2 === 0);
        const rightCol = enabled.filter((_, idx) => idx % 2 === 1);
        const renderCert = (c: any) => (
          <div key={c.id} className="flex justify-between text-neutral-700" style={{ fontSize: pt(L.certificationsItemFontSize), lineHeight: String(L.certificationsItemLineHeight) }}>
            <div>
              <span style={{ fontWeight: T.entryTitleFontWeight, color: "#171717" }}>{c.title}</span> &mdash; {c.issuer}
              {c.credentialId && <span className="text-neutral-500 font-mono ml-2" style={{ fontSize: pt(L.certificationsItemFontSize - 1) }}>({c.credentialId})</span>}
            </div>
            <div className="text-neutral-500 font-medium ml-2 whitespace-nowrap">{c.date}</div>
          </div>
        );
        return (
          <section className={highlight("Certifications")} style={{ marginTop: pt(L.sectionMarginTop) }}>
            {sectionHeading("CERTIFICATIONS")}
            <div className="flex font-sans" style={{ marginTop: pt(L.certificationsMarginTop) }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: pt(L.certificationsGap) }}>
                {leftCol.map(renderCert)}
              </div>
              {rightCol.length > 0 && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: pt(L.certificationsGap) }}>
                  {rightCol.map(renderCert)}
                </div>
              )}
            </div>
          </section>
        );
      }

      // ========================
      // Languages
      // ========================
      case "Languages": {
        const enabled = (resume.languages || []).filter((l) => l.enabled && (l.name || l.proficiency));
        if (enabled.length === 0) return null;
        return (
          <section className={highlight("Languages")} style={{ marginTop: pt(L.sectionMarginTop) }}>
            {sectionHeading("LANGUAGES")}
            <div className="flex flex-wrap font-sans" style={{ marginTop: pt(L.languagesMarginTop), gap: cssPx(L.languagesGap) }}>
              {enabled.map((lang) => (
                <div key={lang.id} style={{ fontSize: pt(L.languagesItemFontSize), lineHeight: String(L.languagesItemLineHeight) }}>
                  {lang.name && <span style={{ fontWeight: T.entryTitleFontWeight, color: "#171717" }}>{lang.name}</span>}
                  {lang.name && lang.proficiency && <span>: </span>}
                  {lang.proficiency && <span className="italic text-neutral-600">{lang.proficiency}</span>}
                </div>
              ))}
            </div>
          </section>
        );
      }

      default:
        return null;
    }
  };

  // ============================================================
  // Render
  // Header is always rendered first, then sections from sectionOrder.
  // ============================================================
  const sectionsToRender = (resume.sectionOrder || []).filter((section) =>
    hasSectionData(resume, section)
  );

  return (
    <article
      id="resume-page"
      className={`
        w-[794px]
        min-h-[1123px]
        bg-white
        text-black
        shadow-2xl
        print:shadow-none
        print:w-full
        print:max-w-full
        print:min-h-0
        print:bg-white
        print:text-black
        ${inter.className}
      `}
      style={{ padding: pt(L.pagePadding) }}
    >
      <div className="flex h-full flex-col text-left">

        {/* Header — always first */}
        <header
          className={`text-center border-b border-neutral-300 ${highlight("Profile")}`}
          style={{ paddingBottom: pt(L.headerPaddingBottom) }}
        >
          <h1
            className="tracking-tight text-neutral-900 uppercase"
            style={{
              fontSize: pt(L.nameFontSize * T.nameSizeMultiplier),
              fontWeight: T.nameFontWeight,
              lineHeight: String(L.nameLineHeight),
            }}
          >
            {profile.fullName || "Your Full Name"}
          </h1>
          <p
            className="tracking-wider text-neutral-600 uppercase"
            style={{
              fontSize: pt(L.titleFontSize),
              fontWeight: T.titleFontWeight,
              letterSpacing: T.titleLetterSpacing,
              marginTop: pt(L.titleMarginTop),
            }}
          >
            {profile.title || "Professional Title"}
          </p>
          {contactInfo.length > 0 && (
            <div
              className="flex flex-wrap justify-center items-center text-neutral-700 font-sans"
              style={{ marginTop: pt(L.skillsMarginTop), fontSize: pt(L.contactFontSize), gap: cssPx(L.contactRowGap) }}
            >
              {contactInfo.map((info, idx) => (
                <span key={idx} className="flex items-center">
                  {idx > 0 && <span className="mr-[0.5em] text-neutral-400 select-none">|</span>}
                  {info.href ? <a href={info.href}>{info.label}</a> : info.label}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Professional Summary — rendered directly after header (part of Profile) */}
        {resume.summary?.enabled && resume.summary.text?.trim() && (
          <section className={highlight("Profile")} style={{ marginTop: pt(L.sectionMarginTop) }}>
            {sectionHeading("PROFESSIONAL SUMMARY")}
            <p
              className="text-neutral-700 font-sans"
              style={{
                fontSize: pt(L.bodyTextFontSize),
                lineHeight: String(L.bodyTextLineHeight),
                marginTop: pt(L.bodyTextMarginTop),
              }}
            >
              {resume.summary.text}
            </p>
          </section>
        )}

        {/* Render remaining sections in sectionOrder */}
        <div className="text-neutral-800">
          {sectionsToRender.map((section) => (
            <div key={section}>{renderSection(section)}</div>
          ))}
        </div>

      </div>
    </article>
  );
}
