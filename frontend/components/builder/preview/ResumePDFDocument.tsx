import React from "react";
import {
  Document,
  Font,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  Svg,
  Path,
  Circle,
  Rect,
} from "@react-pdf/renderer";
import { Resume } from "@/types/resume";
import { normalizeEmail, normalizeUrl, normalizeExternalUrl, getLinkDisplay, buildContactItems, type ContactItem } from "@/lib/contactLinks";
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
          {items.map((item, idx) => {
            const projectLink = item.link ? normalizeExternalUrl(item.link) : null;
            return (
              <Entry
                key={item.id}
                styles={S}
                isFirst={idx === 0}
                title={item.title}
                titleStyle={S.projectTitle}
                extraLeft={projectLink ? (
                  <View style={{ marginTop: 2 }}>
                    <Link src={projectLink} style={S.link}>↗ {item.link}</Link>
                  </View>
                ) : item.link ? (
                  <View style={{ marginTop: 2 }}><Text style={S.caption}>{item.link}</Text></View>
                ) : null}
                rightTop={item.technologies?.length > 0 ? item.technologies.join(", ") : undefined}
                rightTopStyle={S.metaMediumItalic}
              >
                {item.bullets && item.bullets.length > 0 && (
                  <Bullets items={item.bullets} styles={S} />
                )}
              </Entry>
            );
          })}
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

// ============================================================
// Contact Icons — SVG icons for PDF header
// Mirrors the icon rendering in ResumePage.tsx (browser preview)
// but uses @react-pdf/renderer SVG components instead of
// lucide-react or react-icons.
// ============================================================

function getContactIconType(item: ContactItem): string {
  switch (item.type) {
    case "email": return "mail";
    case "phone": return "phone";
    case "location": return "location";
    case "link": {
      if (!item.platformLabel) return "globe";
      const lower = item.platformLabel.toLowerCase();
      if (lower === "github") return "github";
      if (lower === "linkedin") return "linkedin";
      return "globe";
    }
    default: return "globe";
  }
}

function ContactIconPdf({ iconType, size = 9 }: { iconType: string; size?: number }) {
  const strokeColor = COLORS.textSecondary;
  const sw = 1.8;

  switch (iconType) {
    case "mail":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke={strokeColor} strokeWidth={sw} />
          <Path d="M22 4L12 13L2 4" fill="none" stroke={strokeColor} strokeWidth={sw} />
        </Svg>
      );
    case "phone":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
            fill="none"
            stroke={strokeColor}
            strokeWidth={sw}
          />
        </Svg>
      );
    case "location":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke={strokeColor} strokeWidth={sw} />
          <Circle cx="12" cy="10" r="3" fill="none" stroke={strokeColor} strokeWidth={sw} />
        </Svg>
      );
    case "github":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.338c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
            fill={strokeColor}
          />
        </Svg>
      );
    case "linkedin":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="2" width="20" height="20" rx="2" ry="2" fill="none" stroke={strokeColor} strokeWidth={sw} />
          <Path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" fill="none" stroke={strokeColor} strokeWidth={sw} />
          <Rect x="2" y="9" width="4" height="12" fill="none" stroke={strokeColor} strokeWidth={sw} />
          <Circle cx="4" cy="4" r="2" fill="none" stroke={strokeColor} strokeWidth={sw} />
        </Svg>
      );
    case "globe":
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="10" fill="none" stroke={strokeColor} strokeWidth={sw} />
          <Path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none" stroke={strokeColor} strokeWidth={sw} />
        </Svg>
      );
  }
}

export const ResumePDFDocument = ({ resume }: { resume: Resume }) => {
  const L = getResumeLayout(resume);
  const T = getTemplateStyles(resume.template);
  const S = buildStyles(L, T);

  const profile = resume.profile;
  const contactItems = buildContactItems(profile);

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
          {contactItems.length > 0 && (
            <View style={S.contactRow}>
              {contactItems.map((item, idx) => {
                const iconType = getContactIconType(item);
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && <Text style={S.contactSep}>|</Text>}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <ContactIconPdf iconType={iconType} size={9} />
                      {item.href ? (
                        <Link src={item.href} style={S.link}>
                          {item.label}
                        </Link>
                      ) : (
                        <Text style={S.metadata}>{item.label}</Text>
                      )}
                    </View>
                  </React.Fragment>
                );
              })}
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