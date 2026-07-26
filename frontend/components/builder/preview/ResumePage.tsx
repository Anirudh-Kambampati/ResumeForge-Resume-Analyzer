"use client";

import React from "react";
import { Resume } from "@/types/resume";
import { BuilderSection } from "@/store/resumeStore";
import { Inter } from "next/font/google";
import { buildATSContactLine } from "@/lib/contactLinks";
import { getProjectLinkInfo } from "@/lib/projectLinks";
import { formatDateRange, normalizeDate } from "@/lib/dateFormat";
import { getResumeLayout } from "@/lib/resumeLayout";
import { hasSectionData } from "@/config/sections";
import { getTemplateStyles } from "@/config/templates";
import {
  findOptimalLayout,
  applyCompressLevel,
  type CompressLevel,
} from "@/lib/autoFitEngine";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type Props = {
  resume: Resume;
  selectedSection: BuilderSection;
  /** When provided, uses this pre-computed compress level instead of auto-detecting. */
  compressLevel?: CompressLevel;
};

export default function ResumePage({ resume, selectedSection, compressLevel }: Props) {
  const highlight = (section: BuilderSection) =>
    selectedSection === section
      ? "ring-2 ring-blue-500/40 rounded-sm transition-all duration-200 print:ring-0 print:outline-none"
      : "";

  // Auto-fit: find the optimal compress level if not provided externally
  const autoFit = React.useMemo(
    () => (compressLevel !== undefined ? null : findOptimalLayout(resume)),
    [resume, compressLevel]
  );

  // Use provided compressLevel, auto-detected level, or 0
  const effectiveCompress =
    compressLevel ?? autoFit?.level ?? 0;

  const T = getTemplateStyles(resume.template);

  // Get base layout and apply compression
  const baseL = getResumeLayout(resume);
  const L = React.useMemo(
    () => applyCompressLevel(baseL, effectiveCompress),
    [baseL, effectiveCompress]
  );

  // Whether word-wrap optimization (level 6+) is active
  const useBalanceWrap = effectiveCompress >= 6;

  const pt = (v: number) => `${v}pt`;

  // Balanced word wrapping style — applied at level 6+
  const balanceWrap: React.CSSProperties = useBalanceWrap
    ? { overflowWrap: "break-word", textWrap: "balance" }
    : {};



  const profile = resume.profile || {};
  const atsContact = buildATSContactLine(profile);

  // ============================================================
  // Section heading renderer
  // ============================================================
  const sectionHeading = (label: string) => {
    const textTransform = T.sectionHeaderTransform === "uppercase" ? "uppercase" : "none";
    const hasBorder = T.sectionHeaderBorderWidth > 0;
    const borderColor = "#000000";
    return (
      <h2
        className="text-neutral-900"
        style={{
          fontSize: pt(L.sectionHeaderFontSize),
          fontWeight: T.sectionHeaderFontWeight,
          letterSpacing: T.sectionHeaderLetterSpacing,
          borderBottomWidth: hasBorder ? T.sectionHeaderBorderWidth : 0,
          borderBottomStyle: hasBorder ? "solid" : "none",
          borderBottomColor: borderColor,
          paddingBottom: hasBorder ? pt(L.sectionHeaderPaddingBottom) : 0,
          marginBottom: pt(L.sectionHeaderMarginBottom),
          marginTop: "0px",
          textTransform: textTransform as "uppercase" | "none",
        }}
      >
        {label}
      </h2>
    );
  };

  // ============================================================
  // Bullet component (shared structure with PDF)
  // ============================================================
  const Bullets = ({ items: bulletItems }: { items: string[] }) => (
    <div style={{ marginTop: pt(L.bulletListMarginTop) }}>
      {bulletItems.filter(Boolean).map((item, index) => (
        <div
          key={index}
          style={{ display: "flex", flexDirection: "row", marginBottom: pt(L.bulletGap) }}
        >
          <span
            style={{
              display: "inline-block",
              width: pt(L.bulletListPaddingLeft * 0.45),
              fontSize: pt(L.bulletFontSize),
              color: "#a3a3a3",
            }}
          >
            {"\u2022"}
          </span>
          <span
            style={{
              flex: 1,
              fontSize: pt(L.bulletFontSize),
              lineHeight: String(L.bulletLineHeight),
              color: "#404040",
              ...balanceWrap,
            }}
          >
            {item}
          </span>
        </div>
      ))}
    </div>
  );

  // ============================================================
  // Section component (shared structure with PDF)
  // ============================================================
  const SectionContainer = ({
    label,
    section,
    children,
  }: {
    label: string;
    section: BuilderSection;
    children: React.ReactNode;
  }) => (
    <section className={highlight(section)} style={{ marginTop: pt(L.sectionMarginTop) }}>
      {sectionHeading(label)}
      {children}
    </section>
  );

  // ============================================================
  // Section renderer — exactly matches PDF SectionRenderer
  // ============================================================
  const renderSection = (sectionId: string) => {
    const NDASH = " \u2013 ";
    const SEP = " \u2014 ";

    // ---- EXPERIENCE ----
    if (sectionId === "Experience") {
      const items = (resume.experience || []).filter((item) => item.enabled);
      if (items.length === 0) return null;
      return (
        <SectionContainer label="Experience" section="Experience">
          {items.map((item, idx) => (
            <div
              key={item.id}
              style={{ marginTop: idx > 0 ? pt(L.entryGap) : "0px" }}
            >
              {/* Title + Date */}
              <div
                className="flex justify-between items-baseline"
                style={{ fontSize: pt(L.entrySubtitleFontSize) }}
              >
                <span style={{ fontWeight: T.entryTitleFontWeight, color: "#171717" }}>
                  {item.role}
                </span>
                <span
                  className="text-neutral-500 font-medium text-right whitespace-nowrap"
                  style={{ fontSize: pt(L.entryMetaFontSize), marginLeft: "8px" }}
                >
                  {formatDateRange(item.startDate, item.endDate, item.currentlyWorking)}
                </span>
              </div>
              {/* Company + Location */}
              <div
                className="text-neutral-600"
                style={{
                  fontWeight: T.entrySubtitleFontWeight,
                  fontSize: pt(L.entryMetaFontSize),
                }}
              >
                {item.company}{item.location ? `, ${item.location}` : ""}
              </div>
              {/* Bullets */}
              {item.bullets && item.bullets.length > 0 && (
                <Bullets items={item.bullets} />
              )}
            </div>
          ))}
        </SectionContainer>
      );
    }

    // ---- EDUCATION ----
    if (sectionId === "Education") {
      const items = (resume.education || []).filter((item) => item.enabled);
      if (items.length === 0) return null;
      return (
        <SectionContainer label="Education" section="Education">
          {items.map((item, idx) => {
            let degreeStr = item.degree;
            if (item.field && !item.degree.toLowerCase().includes(item.field.toLowerCase())) {
              degreeStr += ` in ${item.field}`;
            }
            return (
              <div
                key={item.id}
                style={{ marginTop: idx > 0 ? pt(L.entryGap) : "0px" }}
              >
                {/* Degree + Date */}
                <div
                  className="flex justify-between items-baseline"
                  style={{ fontSize: pt(L.entrySubtitleFontSize) }}
                >
                  <span style={{ fontWeight: T.entryTitleFontWeight, color: "#171717" }}>
                    {degreeStr}
                  </span>
                  <span
                    className="text-neutral-500 font-medium text-right whitespace-nowrap"
                    style={{ fontSize: pt(L.entryMetaFontSize), marginLeft: "8px" }}
                  >
                    {formatDateRange(item.startDate, item.endDate)}
                  </span>
                </div>
                {/* Institution + GPA */}
                <div
                  className="text-neutral-600"
                  style={{
                    fontWeight: T.entrySubtitleFontWeight,
                    fontSize: pt(L.entryMetaFontSize),
                }}
              >
                {item.institution}{item.grade ? `${SEP}${item.grade}` : ""}
              </div>
            </div>
            );
          })}
        </SectionContainer>
      );
    }

    // ---- PROJECTS ----
    if (sectionId === "Projects") {
      const items = (resume.projects || []).filter((item) => item.enabled);
      if (items.length === 0) return null;
      return (
        <SectionContainer label="Projects" section="Projects">
          {items.map((item, idx) => {
            const linkInfo = getProjectLinkInfo(item.link);
            return (
              <div
                key={item.id}
                style={{ marginTop: idx > 0 ? pt(L.entryGap) : "0px" }}
              >
                {/* Project Name | Technologies + Link */}
                <div className="flex justify-between items-baseline" style={{ fontSize: pt(L.entrySubtitleFontSize) }}>
                  <span>
                    <span style={{ fontWeight: T.entryTitleFontWeight, color: "#171717" }}>
                      {item.title}
                    </span>
                    {item.technologies && item.technologies.length > 0 && (
                      <span
                        className="text-neutral-600"
                        style={{ fontWeight: 400, fontSize: pt(L.entryMetaFontSize) }}
                      >
                        {" | "}{item.technologies.join(", ")}
                      </span>
                    )}
                  </span>
                  {linkInfo && (
                    <a
                      href={linkInfo.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-500 hover:text-neutral-800 transition-colors"
                      style={{ fontSize: pt(L.entryMetaFontSize), marginLeft: "6px", textDecoration: "none" }}
                    >
                      {linkInfo.label}
                    </a>
                  )}
                </div>
                {/* Bullets */}
                {item.bullets && item.bullets.length > 0 && (
                  <Bullets items={item.bullets} />
                )}
              </div>
            );
          })}
        </SectionContainer>
      );
    }

    // ---- RESEARCH ----
    if (sectionId === "Research") {
      const items = (resume.research || []).filter((item: any) => item.enabled);
      if (items.length === 0) return null;
      return (
        <SectionContainer label="Research" section="Research">
          {items.map((item: any, idx: number) => (
            <div
              key={item.id}
              style={{ marginTop: idx > 0 ? pt(L.entryGap) : "0px" }}
            >
              {/* Title + Date */}
              <div className="flex justify-between items-baseline" style={{ fontSize: pt(L.entrySubtitleFontSize) }}>
                <div>
                  <span style={{ fontWeight: T.entryTitleFontWeight, color: "#171717" }}>
                    {item.title}
                  </span>
                  {item.institution && (
                    <div
                      className="text-neutral-600"
                      style={{ fontWeight: T.entrySubtitleFontWeight, fontSize: pt(L.entryMetaFontSize) }}
                    >
                      {item.institution}
                      {item.advisor ? ` \u2014 Advisor: ${item.advisor}` : ""}
                    </div>
                  )}
                </div>
                <span
                  className="text-neutral-500 font-medium text-right whitespace-nowrap"
                  style={{ fontSize: pt(L.entryMetaFontSize), marginLeft: "8px" }}
                >
                  {normalizeDate(item.duration)}
                </span>
              </div>
              {/* Bullets */}
              {item.bullets && item.bullets.filter(Boolean).length > 0 && (
                <Bullets items={item.bullets} />
              )}
            </div>
          ))}
        </SectionContainer>
      );
    }

    // ---- PUBLICATIONS ----
    if (sectionId === "Publications") {
      const items = (resume.publications || []).filter((item: any) => item.enabled);
      if (items.length === 0) return null;
      return (
        <SectionContainer label="Publications" section="Publications">
          {items.map((item: any, idx: number) => (
            <div
              key={item.id}
              style={{ marginTop: idx > 0 ? pt(L.entryGap) : "0px" }}
            >
              <div className="flex justify-between" style={{ fontSize: pt(L.entrySubtitleFontSize) }}>
                <div>
                  <span style={{ fontWeight: T.entryTitleFontWeight, color: "#171717" }}>
                    {item.title}
                  </span>
                  {item.authors && (
                    <div
                      className="text-neutral-600"
                      style={{ fontWeight: T.entrySubtitleFontWeight, fontSize: pt(L.entryMetaFontSize) }}
                    >
                      {item.authors}
                    </div>
                  )}
                  <div
                    className="text-neutral-600"
                    style={{ fontWeight: 400, fontSize: pt(L.entryMetaFontSize) }}
                  >
                    {item.venue}
                    {item.doi ? ` \u2014 ${item.doi}` : ""}
                  </div>
                </div>
                {item.date && (
                  <span
                    className="text-neutral-500 font-medium text-right whitespace-nowrap"
                    style={{ fontSize: pt(L.entryMetaFontSize), marginLeft: "8px" }}
                  >
                    {normalizeDate(item.date)}
                  </span>
                )}
              </div>
              {item.description && (
                <div
                  className="text-neutral-700"
                  style={{
                    fontSize: pt(L.bodyTextFontSize),
                    lineHeight: String(L.bodyTextLineHeight),
                    marginTop: pt(L.bodyTextMarginTop),
                    ...balanceWrap,
                  }}
                >
                  {item.description}
                </div>
              )}
            </div>
          ))}
        </SectionContainer>
      );
    }

    // ---- SKILLS ----
    if (sectionId === "Skills") {
      const active = (resume.skills || []).filter(
        (item) => item.title?.trim() && item.items?.length > 0
      );
      if (active.length === 0) return null;
      return (
        <SectionContainer label="Skills" section="Skills">
          <div style={{ marginTop: pt(L.skillsMarginTop) }}>
            {active.map((item) => (
              <div
                key={item.id}
                className="font-sans"
                style={{
                  fontSize: pt(L.skillsItemFontSize),
                  lineHeight: String(L.skillsItemLineHeight),
                  marginBottom: pt(L.skillsItemMarginBottom),
                }}
              >
                <span style={{ fontWeight: T.entryTitleFontWeight, color: "#171717" }}>
                  {item.title}:
                </span>{" "}
                <span className="text-neutral-700">
                  {[...new Set(item.items.filter(Boolean))].join(", ")}
                </span>
              </div>
            ))}
          </div>
        </SectionContainer>
      );
    }

    // ---- ACHIEVEMENTS ----
    if (sectionId === "Achievements") {
      const items = (resume.achievements || []).filter(
        (item) => item.enabled && (item.title || item.description)
      );
      if (items.length === 0) return null;
      return (
        <SectionContainer label="Achievements" section="Achievements">
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                flexDirection: "row",
                marginBottom: pt(L.achievementsItemMarginBottom),
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: pt(L.bulletListPaddingLeft * 0.45),
                  fontSize: pt(L.bulletFontSize),
                  color: "#a3a3a3",
                }}
              >
                {"\u2022"}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: pt(L.bulletFontSize),
                  lineHeight: String(L.bulletLineHeight),
                  color: "#404040",
                  ...balanceWrap,
                }}
              >
                {item.title}
                {item.title && item.description ? " \u2014 " : ""}
                {item.description || ""}
              </span>
            </div>
          ))}
        </SectionContainer>
      );
    }

    // ---- CERTIFICATIONS (single column) ----
    if (sectionId === "Certifications") {
      const items = (resume.certifications || []).filter((item) => item.enabled);
      if (items.length === 0) return null;
      return (
        <SectionContainer label="Certifications" section="Certifications">
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                marginBottom: pt(L.certificationsGap * 0.4),
              }}
            >
              <span
                className="text-neutral-700"
                style={{ fontSize: pt(L.certificationsItemFontSize), lineHeight: String(L.certificationsItemLineHeight) }}
              >
                <span style={{ fontWeight: T.entryTitleFontWeight, color: "#171717" }}>
                  {item.title}
                </span>
                {item.issuer ? ` \u2014 ${item.issuer}` : ""}
              </span>
            </div>
          ))}
        </SectionContainer>
      );
    }

    // ---- LANGUAGES ----
    if (sectionId === "Languages") {
      const items = (resume.languages || []).filter(
        (item) => item.enabled && (item.name || item.proficiency)
      );
      if (items.length === 0) return null;
      return (
        <SectionContainer label="Languages" section="Languages">
          <div
            className="flex flex-wrap"
            style={{ marginTop: pt(L.languagesMarginTop) }}
          >
            {items.map((lang) => (
              <div
                key={lang.id}
                style={{
                  fontSize: pt(L.languagesItemFontSize),
                  lineHeight: String(L.languagesItemLineHeight),
                  marginRight: pt(L.languagesGap),
                  marginBottom: pt(L.languagesGap * 0.3),
                }}
              >
                {lang.name && (
                  <span style={{ fontWeight: T.entryTitleFontWeight, color: "#171717" }}>
                    {lang.name}
                  </span>
                )}
                {lang.name && lang.proficiency ? ": " : null}
                {lang.proficiency && (
                  <span className="italic text-neutral-600">{lang.proficiency}</span>
                )}
              </div>
            ))}
          </div>
        </SectionContainer>
      );
    }

    return null;
  };

  // ============================================================
  // Render
  // ============================================================
  const sectionsToRender = (resume.sectionOrder || []).filter((section) =>
    hasSectionData(resume, section)
  );

  return (
    <article
      id="resume-page"
      className={`
        w-[794px] min-h-[1123px] bg-white text-black
        shadow-2xl print:shadow-none print:w-full print:max-w-full print:min-h-0 print:bg-white print:text-black
        ${inter.className}
      `}
      style={{ padding: pt(L.pagePadding) }}
    >
      {/* HEADER */}
      <header
        className={`text-center ${highlight("Profile")}`}
        style={{ marginBottom: pt(L.headerPaddingBottom) }}
      >
        <h1
          className="tracking-tight text-neutral-900"
          style={{
            fontSize: pt(L.nameFontSize * T.nameSizeMultiplier),
            fontWeight: T.nameFontWeight,
            lineHeight: String(L.nameLineHeight),
            marginBottom: pt(L.nameMarginBottom),
          }}
        >
          {profile.fullName || "Your Full Name"}
        </h1>

        {/* Name → Contact → Titles */}
        {atsContact.length > 0 && (
          <div
            className="flex flex-wrap justify-center items-center text-neutral-600"
            style={{
              fontSize: pt(L.contactFontSize),
              marginBottom: pt(L.contactRowGap),
            }}
          >
            {atsContact.map((entry, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <span className="text-neutral-300 select-none" style={{ margin: `0 ${pt(L.contactRowGap * 0.4)}` }}>
                    |
                  </span>
                )}
                {entry.href ? (
                  <a
                    href={entry.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none", color: "#404040" }}
                  >
                    {entry.display}
                  </a>
                ) : (
                  <span>{entry.display}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {(profile.titles?.length ?? 0) > 0 && (
          <p
            className="text-neutral-700"
            style={{
              fontSize: pt(L.titleFontSize),
              fontWeight: T.titleFontWeight,
              marginBottom: pt(L.titleMarginBottom),
            }}
          >
            {profile.titles.filter(Boolean).join(" | ")}
          </p>
        )}
      </header>

      {/* PROFESSIONAL SUMMARY */}
      {resume.summary?.enabled && resume.summary.text?.trim() && (
        <section className={highlight("Profile")} style={{ marginTop: pt(L.sectionMarginTop) }}>
          {sectionHeading("Summary")}
          <p
            className="text-neutral-700"
            style={{
              fontSize: pt(L.bodyTextFontSize),
              lineHeight: String(L.bodyTextLineHeight),
              ...balanceWrap,
            }}
          >
            {resume.summary.text}
          </p>
        </section>
      )}

      {/* SECTIONS */}
      <div className="text-neutral-800">
        {sectionsToRender.map((section) => (
          <div key={section}>{renderSection(section)}</div>
        ))}
      </div>
    </article>
  );
}
