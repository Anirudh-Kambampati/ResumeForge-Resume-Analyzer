import React from "react";
import {
  Document,
  Font,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { Resume } from "@/types/resume";
import { normalizeEmail, normalizeUrl } from "@/lib/contactLinks";
import {
  getResumeLayout,
  COLORS,
  type ResumeLayout,
} from "@/lib/resumeLayout";
import { hasSectionData } from "@/config/sections";
import { getTemplateStyles, type TemplateStyles } from "@/config/templates";

// ============================================================
// Typography — Inter (sans-serif)
// Font files are served from public/fonts/inter/ and are
// downloaded from @fontsource/inter at build time.
//
// Weight scheme:
//   400 Regular — body text, bullets, summary, achievement text
//   500 Medium  — dates, org names, institutions, descriptors
//   600 SemiBold — job/project/degree titles, skill labels
//   700 Bold    — name, section headings
// ============================================================
Font.register({
  family: "Sans",
  fonts: [
    {
      src: "/fonts/inter/Inter-Regular.ttf",
      fontWeight: 400,
      fontStyle: "normal",
    },
    {
      src: "/fonts/inter/Inter-Italic.ttf",
      fontWeight: 400,
      fontStyle: "italic",
    },
    {
      src: "/fonts/inter/Inter-Medium.ttf",
      fontWeight: 500,
      fontStyle: "normal",
    },
    {
      src: "/fonts/inter/Inter-MediumItalic.ttf",
      fontWeight: 500,
      fontStyle: "italic",
    },
    {
      src: "/fonts/inter/Inter-SemiBold.ttf",
      fontWeight: 600,
      fontStyle: "normal",
    },
    {
      src: "/fonts/inter/Inter-Bold.ttf",
      fontWeight: 700,
      fontStyle: "normal",
    },

  ],
});

// Keep words intact: a resume benefits more from clean reading than aggressive line fitting.
Font.registerHyphenationCallback((word) => [word]);

// Shared inline separators — single source of truth for inter-word spacing patterns.
const SEP = " — "; // em-dash with surrounding spaces
const NDASH = " – "; // en-dash with surrounding spaces

// ============================================================
// Layout Tokens — Spacing & Typography
// Single source of truth, derived from resumeLayout.ts.
// No magic numbers. Everything flows from L (layout config).
// ============================================================

function buildStyles(L: ResumeLayout, T: TemplateStyles) {
  return StyleSheet.create({
    // Page container
    page: {
      padding: L.pagePadding,
      fontFamily: "Sans",
      fontSize: L.bodyTextFontSize,
      lineHeight: L.bodyTextLineHeight,
      color: COLORS.textPrimary,
    },

    // Header component
    header: {
      borderBottomWidth: 0.75,
      borderBottomColor: COLORS.borderLight,
      paddingBottom: L.headerPaddingBottom,
    },
    displayName: {
      fontFamily: "Sans",
      fontWeight: T.nameFontWeight,
      fontSize: L.nameFontSize * T.nameSizeMultiplier,
      lineHeight: L.nameLineHeight,
      textAlign: "center" as const,
      marginBottom: L.nameMarginBottom,
    },
    professionalTitle: {
      fontFamily: "Sans",
      fontWeight: T.titleFontWeight as 400 | 500 | 600 | 700,
      fontSize: L.titleFontSize,
      letterSpacing: T.titleLetterSpacing,
      color: COLORS.textSecondary,
      textAlign: "center" as const,
      marginTop: L.titleMarginTop,
      marginBottom: L.titleMarginBottom,
    },
    contactRow: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginTop: 0,
      marginBottom: 8,
    },
    link: {
      fontFamily: "Sans",
      fontWeight: 400,
      fontSize: L.contactFontSize,
      color: COLORS.textBody,
      textDecoration: "none",
    },
    metadata: {
      fontFamily: "Sans",
      fontWeight: 400,
      fontSize: L.contactFontSize,
      color: COLORS.textBody,
    },
    contactSep: {
      marginHorizontal: L.contactRowGap * 0.35,
      color: COLORS.textMuted,
      fontSize: L.contactFontSize,
    },

    // Sections
    section: {
      marginTop: L.sectionMarginTop,
    },
    sectionHeading: {
      fontFamily: "Sans",
      fontWeight: T.sectionHeaderFontWeight,
      fontSize: L.sectionHeaderFontSize,
      letterSpacing: T.sectionHeaderLetterSpacing,
    },
    sectionDivider: {
      borderBottomWidth: Math.max(T.sectionHeaderBorderWidth, 0.75),
      borderBottomColor: COLORS.border,
      marginTop: L.sectionHeaderPaddingBottom,
      marginBottom: L.sectionHeaderMarginBottom,
    },

    // Body & paragraphs
    body: {
      fontFamily: "Sans",
      fontWeight: 400,
      fontSize: L.bodyTextFontSize,
      lineHeight: L.bodyTextLineHeight,
      color: COLORS.textBody,
      marginTop: L.bodyTextMarginTop,
    },

    // Entry structures
    entry: {
      marginTop: L.entryGap,
    },
    entryRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "flex-start" as const,
    },
    entryMain: {
      flexGrow: 1,
      paddingRight: 8,
    },

    // Semantic typography roles
    jobTitle: {
      fontFamily: "Sans",
      fontWeight: T.entryTitleFontWeight,
      fontSize: L.entrySubtitleFontSize,
      color: COLORS.textPrimary,
    },
    companyName: {
      fontFamily: "Sans",
      fontWeight: T.entrySubtitleFontWeight,
      fontSize: L.entryMetaFontSize,
      color: COLORS.textSecondary,
    },
    projectTitle: {
      fontFamily: "Sans",
      fontWeight: T.entryTitleFontWeight,
      fontSize: L.entrySubtitleFontSize,
      color: COLORS.textPrimary,
    },
    researchTitle: {
      fontFamily: "Sans",
      fontWeight: T.entryTitleFontWeight,
      fontSize: L.entrySubtitleFontSize,
      color: COLORS.textPrimary,
    },
    publicationTitle: {
      fontFamily: "Sans",
      fontWeight: T.entryTitleFontWeight,
      fontSize: L.entrySubtitleFontSize,
      color: COLORS.textPrimary,
    },

    // Dates & Locations & tech stack (entry metadata)
    date: {
      fontFamily: "Sans",
      fontWeight: 500,
      fontSize: L.entryMetaFontSize,
      color: COLORS.textTertiary,
      textAlign: "right" as const,
    },
    caption: {
      fontFamily: "Sans",
      fontWeight: 400,
      fontSize: L.entryMetaFontSize - 0.5,
      color: COLORS.textTertiary,
    },
    captionItalic: {
      fontFamily: "Sans",
      fontWeight: 400,
      fontStyle: "italic",
      fontSize: L.entryMetaFontSize - 0.5,
      color: COLORS.textTertiary,
    },
    // For project tech stack, advisor, etc.
    metaMediumItalic: {
      fontFamily: "Sans",
      fontWeight: 500,
      fontStyle: "italic",
      fontSize: L.entryMetaFontSize,
      color: COLORS.textTertiary,
    },
    metaItalic: {
      fontFamily: "Sans",
      fontWeight: 400,
      fontStyle: "italic",
      fontSize: L.entryMetaFontSize,
      color: COLORS.textTertiary,
    },

    // Bullets
    bulletList: {
      marginTop: L.bulletListMarginTop,
      paddingLeft: L.bulletListPaddingLeft,
    },
    bullet: {
      flexDirection: "row" as const,
      marginBottom: L.bulletGap,
    },
    bulletMark: {
      fontFamily: "Sans",
      fontWeight: 400,
      width: L.bulletListPaddingLeft * 0.5,
      fontSize: L.bulletFontSize,
      color: COLORS.textMuted,
    },
    bulletText: {
      flex: 1,
      fontFamily: "Sans",
      fontWeight: 400,
      fontSize: L.bulletFontSize,
      lineHeight: L.bulletLineHeight,
      color: COLORS.textBody,
    },

    // Skills
    skillsContainer: {
      marginTop: L.skillsMarginTop,
    },
    skillRow: {
      flexDirection: "row" as const,
      marginBottom: L.skillsItemMarginBottom,
    },
    skillTitle: {
      fontFamily: "Sans",
      fontWeight: T.entryTitleFontWeight,
      fontSize: L.skillsItemFontSize,
      color: COLORS.textPrimary,
    },
    skillItems: {
      flex: 1,
      fontFamily: "Sans",
      fontWeight: 400,
      fontSize: L.skillsItemFontSize,
      color: COLORS.textBody,
    },

    // Certifications (newly added for PDF)
    certificationsContainer: {
      marginTop: L.certificationsMarginTop,
      flexDirection: "row" as const,
      gap: 12,
    },
    certificationsColumn: {
      flex: 1,
      flexDirection: "column" as const,
      gap: L.certificationsGap,
    },
    certificationItem: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "flex-start" as const,
    },
    certificationMain: {
      flex: 1,
      paddingRight: 4,
    },
    certificationTitle: {
      fontFamily: "Sans",
      fontWeight: T.entryTitleFontWeight,
      fontSize: L.certificationsItemFontSize,
      color: COLORS.textPrimary,
    },
    certificationIssuer: {
      fontFamily: "Sans",
      fontWeight: 400,
      fontSize: L.certificationsItemFontSize,
      color: COLORS.textBody,
    },
    certificationId: {
      fontFamily: "Sans",
      fontWeight: 400,
      fontSize: L.certificationsItemFontSize - 1,
      color: COLORS.textSecondary,
    },
    certificationDate: {
      fontFamily: "Sans",
      fontWeight: 500,
      fontSize: L.certificationsItemFontSize,
      color: COLORS.textSecondary,
      textAlign: "right" as const,
    },

    // Languages (newly added for PDF)
    languagesContainer: {
      marginTop: L.languagesMarginTop,
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: L.languagesGap,
    },
    languageItem: {
      fontSize: L.languagesItemFontSize,
      lineHeight: L.languagesItemLineHeight,
    },
    languageName: {
      fontFamily: "Sans",
      fontWeight: T.entryTitleFontWeight,
      color: COLORS.textPrimary,
    },
    languageProficiency: {
      fontFamily: "Sans",
      fontWeight: 400,
      fontStyle: "italic",
      color: COLORS.textSecondary,
    },
  });
}

// ============================================================
// Sub-components
// ============================================================

const Bullets = ({
  items,
  styles,
}: {
  items: string[];
  styles: ReturnType<typeof buildStyles>;
}) => (
  <View style={styles.bulletList}>
    {items.filter(Boolean).map((item, index) => (
      <View key={index} style={styles.bullet}>
        <Text style={styles.bulletMark}>{"\u2022"}</Text>
        <Text style={styles.bulletText}>{item}</Text>
      </View>
    ))}
  </View>
);

const Section = ({
  title,
  styles,
  children,
}: {
  title: string;
  styles: ReturnType<typeof buildStyles>;
  children: React.ReactNode;
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionHeading}>{title}</Text>
    <View style={styles.sectionDivider} />
    {children}
  </View>
);

interface EntryProps {
  styles: ReturnType<typeof buildStyles>;
  title: string;
  titleStyle: any;
  subtitle?: string;
  subtitlePrefix?: string;
  subtitleStyle?: any;
  institution?: string;
  authors?: string;
  extraLeft?: React.ReactNode;
  rightTop?: string;
  rightTopStyle?: any;
  rightBottom?: string;
  rightBottomStyle?: any;
  children?: React.ReactNode;
  isFirst?: boolean;
}

const Entry = ({
  styles,
  title,
  titleStyle,
  subtitle,
  subtitlePrefix = SEP,
  subtitleStyle,
  institution,
  authors,
  extraLeft,
  rightTop,
  rightTopStyle,
  rightBottom,
  rightBottomStyle,
  children,
  isFirst = false,
}: EntryProps) => (
  <View style={isFirst ? undefined : styles.entry}>
    <View style={styles.entryRow}>
      <View style={styles.entryMain}>
        <Text style={titleStyle}>
          {title}
          {subtitle ? (
            <Text style={subtitleStyle || styles.companyName}>
              {subtitlePrefix}
              {subtitle}
            </Text>
          ) : null}
        </Text>
        {institution ? <Text style={styles.companyName}>{institution}</Text> : null}
        {authors ? <Text style={styles.companyName}>{authors}</Text> : null}
        {extraLeft ? <View style={{ marginBottom: 2 }}>{extraLeft}</View> : null}
      </View>
      <View style={{ alignItems: "flex-end" as const }}>
        {rightTop ? (
          <Text style={rightTopStyle || styles.date}>
            {rightTop}
          </Text>
        ) : null}
        {rightBottom ? (
          <View style={{ marginTop: 1, marginBottom: 1 }}>
            <Text style={rightBottomStyle || styles.metaItalic}>
              {rightBottom}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
    {children}
  </View>
);

// ============================================================
// PDF Section Renderer — driven by sectionOrder from resume
// ============================================================

function PDFSectionRenderer({
  section,
  resume,
  S,
  L,
}: {
  section: string;
  resume: Resume;
  S: ReturnType<typeof buildStyles>;
  L: ResumeLayout;
}) {
  const T = getTemplateStyles(resume.template);
  const SEP = " — ";
  const NDASH = " – ";

  switch (section) {
    case "Experience": {
      const items = (resume.experience || []).filter((item) => item.enabled);
      if (items.length === 0) return null;
      return (
        <Section title="EXPERIENCE" styles={S}>
          {items.map((item, idx) => (
            <Entry
              key={item.id}
              styles={S}
              isFirst={idx === 0}
              title={item.role}
              titleStyle={S.jobTitle}
              subtitle={item.company}
              rightTop={`${item.location ? `${item.location} | ` : ""}${item.startDate}${NDASH}${item.currentlyWorking ? "Present" : item.endDate}`}
            >
              {item.bullets && item.bullets.length > 0 && (
                <Bullets items={item.bullets} styles={S} />
              )}
            </Entry>
          ))}
        </Section>
      );
    }

    case "Education": {
      const items = (resume.education || []).filter((item) => item.enabled);
      if (items.length === 0) return null;
      return (
        <Section title="EDUCATION" styles={S}>
          {items.map((item, idx) => (
            <Entry
              key={item.id}
              styles={S}
              isFirst={idx === 0}
              title={item.degree}
              titleStyle={S.jobTitle}
              subtitle={item.field}
              subtitlePrefix=" in "
              institution={item.institution}
              extraLeft={item.grade ? <Text style={S.captionItalic}>GPA: {item.grade}</Text> : null}
              rightTop={`${item.startDate}${NDASH}${item.endDate}`}
            />
          ))}
        </Section>
      );
    }

    case "Projects": {
      const items = (resume.projects || []).filter((item) => item.enabled);
      if (items.length === 0) return null;
      return (
        <Section title="PROJECTS" styles={S}>
          {items.map((item, idx) => (
            <Entry
              key={item.id}
              styles={S}
              isFirst={idx === 0}
              title={item.title}
              titleStyle={S.projectTitle}
              extraLeft={item.link ? <View style={{ marginTop: 2 }}><Text style={S.caption}>({item.link})</Text></View> : null}
              rightTop={item.technologies?.length > 0 ? item.technologies.join(", ") : undefined}
              rightTopStyle={S.metaMediumItalic}
            >
              {item.bullets && item.bullets.length > 0 && (
                <Bullets items={item.bullets} styles={S} />
              )}
            </Entry>
          ))}
        </Section>
      );
    }

    case "Research": {
      const items = (resume.research || []).filter((item: any) => item.enabled);
      if (items.length === 0) return null;
      return (
        <Section title="RESEARCH" styles={S}>
          {items.map((item: any, idx: number) => (
            <Entry
              key={item.id}
              styles={S}
              isFirst={idx === 0}
              title={item.title}
              titleStyle={S.researchTitle}
              subtitle={item.institution}
              extraLeft={
                (item.advisor || item.link) ? (
                  <Text style={S.captionItalic}>
                    {item.advisor ? `Advisor: ${item.advisor}` : ""}
                    {item.advisor && item.link ? " | " : ""}
                    {item.link ? item.link : ""}
                  </Text>
                ) : null
              }
              rightTop={item.duration}
              rightBottom={item.keywords?.length > 0 ? item.keywords.join(", ") : undefined}
            >
              {item.bullets && item.bullets.filter(Boolean).length > 0 && (
                <Bullets items={item.bullets} styles={S} />
              )}
            </Entry>
          ))}
        </Section>
      );
    }

    case "Publications": {
      const items = (resume.publications || []).filter((item: any) => item.enabled);
      if (items.length === 0) return null;
      return (
        <Section title="PUBLICATIONS" styles={S}>
          {items.map((item: any, idx: number) => (
            <Entry
              key={item.id}
              styles={S}
              isFirst={idx === 0}
              title={item.title}
              titleStyle={S.publicationTitle}
              subtitle={item.venue}
              authors={item.authors}
              extraLeft={item.doi ? <Text style={S.caption}>({item.doi})</Text> : null}
              rightTop={item.date}
              rightBottom={item.keywords?.length > 0 ? item.keywords.join(", ") : undefined}
            >
              {item.description ? (
                <Text style={S.body}>{item.description}</Text>
              ) : null}
            </Entry>
          ))}
        </Section>
      );
    }

    case "Skills": {
      const active = (resume.skills || []).filter(
        (item) => item.title?.trim() && item.items?.some((s) => s.trim())
      );
      if (active.length === 0) return null;
      return (
        <Section title="SKILLS" styles={S}>
          <View style={S.skillsContainer}>
            {active.map((item) => (
              <View key={item.id} style={S.skillRow}>
                <Text style={S.skillTitle}>{item.title}: </Text>
                <Text style={S.skillItems}>
                  {[...new Set(item.items.filter(Boolean))].join(", ")}
                </Text>
              </View>
            ))}
          </View>
        </Section>
      );
    }

    case "Achievements": {
      const items = (resume.achievements || []).filter(
        (item) => item.enabled && (item.title || item.description)
      );
      if (items.length === 0) return null;
      return (
        <Section title="ACHIEVEMENTS" styles={S}>
          <View style={S.bulletList}>
            {items.map((item) => (
              <View key={item.id} style={S.bullet}>
                <Text style={S.bulletMark}>{"\u2022"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.bulletText}>
                    {item.title}{item.title && item.description ? SEP : ""}{item.description || ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Section>
      );
    }

    case "Certifications": {
      const items = (resume.certifications || []).filter((item) => item.enabled);
      if (items.length === 0) return null;
      const renderCert = (c: any, idx: number) => (
        <View key={c.id} style={S.certificationItem}>
          <View style={S.certificationMain}>
            <Text style={S.certificationTitle}>
              {c.title}
              <Text style={S.certificationIssuer}> &mdash; {c.issuer}</Text>
            </Text>
            {c.credentialId && (
              <Text style={S.certificationId}>({c.credentialId})</Text>
            )}
          </View>
          <Text style={S.certificationDate}>{c.date}</Text>
        </View>
      );
      const leftCol = items.filter((_, idx) => idx % 2 === 0);
      const rightCol = items.filter((_, idx) => idx % 2 === 1);
      return (
        <View style={{ marginTop: 4 }}>
        <Section title="CERTIFICATIONS" styles={S}>
          <View style={S.certificationsContainer}>
            <View style={S.certificationsColumn}>
              {leftCol.map(renderCert)}
            </View>
            {rightCol.length > 0 && (
              <View style={S.certificationsColumn}>
                {rightCol.map(renderCert)}
              </View>
            )}
          </View>
        </Section>
        </View>
      );
    }

    case "Languages": {
      const items = (resume.languages || []).filter(
        (item) => item.enabled && (item.name || item.proficiency)
      );
      if (items.length === 0) return null;
      return (
        <Section title="LANGUAGES" styles={S}>
          <View style={S.languagesContainer}>
            {items.map((lang) => (
              <Text key={lang.id} style={S.languageItem}>
                {lang.name && <Text style={S.languageName}>{lang.name}</Text>}
                {lang.name && lang.proficiency && ": "}
                {lang.proficiency && (
                  <Text style={S.languageProficiency}>{lang.proficiency}</Text>
                )}
              </Text>
            ))}
          </View>
        </Section>
      );
    }

    default:
      return null;
  }
}

// ============================================================
// Main Document Component
// ============================================================

export const ResumePDFDocument = ({ resume }: { resume: Resume }) => {
  const L = getResumeLayout(resume);
  const T = getTemplateStyles(resume.template);
  const S = buildStyles(L, T);

  const profile = resume.profile;

  const contactInfo: { label: string; href?: string }[] = [
    profile.email && { label: profile.email, href: normalizeEmail(profile.email) },
    profile.phone && { label: profile.phone },
    profile.location && { label: profile.location },
    ...(profile.links || [])
      .map((link) => {
        const href = normalizeUrl(link.url);
        return href ? { label: link.label || link.url, href } : null;
      })
      .filter(Boolean),
  ].filter(Boolean) as { label: string; href?: string }[];

  // Render sections in order defined by sectionOrder
  const sectionsToRender = (resume.sectionOrder || []).filter((section) =>
    hasSectionData(resume, section)
  );

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.displayName}>
            {(profile.fullName || "Candidate Name").toUpperCase()}
          </Text>
          {!!profile.title?.trim() && (
            <Text style={S.professionalTitle}>{profile.title}</Text>
          )}
          {contactInfo.length > 0 && (
            <View style={S.contactRow}>
              {contactInfo.map((info, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <Text style={S.contactSep}>|</Text>}
                  {info.href ? (
                    <Link src={info.href} style={S.link}>
                      {info.label}
                    </Link>
                  ) : (
                    <Text style={S.metadata}>{info.label}</Text>
                  )}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* Professional Summary — rendered directly after header (part of Profile) */}
        {resume.summary?.enabled && resume.summary.text?.trim() && (
          <Section title="PROFESSIONAL SUMMARY" styles={S}>
            <Text style={S.body}>{resume.summary.text}</Text>
          </Section>
        )}

        {/* Render remaining sections in sectionOrder */}
        {sectionsToRender.map((section) => (
          <React.Fragment key={section}>
            {PDFSectionRenderer({ section, resume, S, L })}
          </React.Fragment>
        ))}
      </Page>
    </Document>
  );
};
