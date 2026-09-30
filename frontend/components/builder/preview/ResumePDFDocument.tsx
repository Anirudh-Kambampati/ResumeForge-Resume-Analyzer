import React from "react";
import {
  Document,
  Font,
  Link,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { Resume } from "@/types/resume";
import { buildATSContactLine, type ContactType } from "@/lib/contactLinks";
import { getContactIcon } from "@/lib/contactIcons";
import { getProjectLinkInfo } from "@/lib/projectLinks";
import { formatDateRange, normalizeDate } from "@/lib/dateFormat";
import {
  getResumeLayout,
  getContactIconSize,
  chunkRows,
  getCertificationColumns,
  COLORS,
  type ResumeLayout,
} from "@/lib/resumeLayout";
import { hasSectionData } from "@/config/sections";
import { getTemplateStyles, type TemplateStyles } from "@/config/templates";
import {
  findOptimalLayout,
  applyCompressLevel,
  type CompressLevel,
} from "@/lib/autoFitEngine";

Font.register({
  family: "Sans",
  fonts: [
    { src: "/fonts/inter/Inter-Regular.ttf", fontWeight: 400, fontStyle: "normal" },
    { src: "/fonts/inter/Inter-Italic.ttf", fontWeight: 400, fontStyle: "italic" },
    { src: "/fonts/inter/Inter-Medium.ttf", fontWeight: 500, fontStyle: "normal" },
    { src: "/fonts/inter/Inter-MediumItalic.ttf", fontWeight: 500, fontStyle: "italic" },
    { src: "/fonts/inter/Inter-SemiBold.ttf", fontWeight: 600, fontStyle: "normal" },
    { src: "/fonts/inter/Inter-Bold.ttf", fontWeight: 700, fontStyle: "normal" },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

const pt = (v: number) => `${v}pt`;

function buildStyles(L: ResumeLayout, T: TemplateStyles) {
  return StyleSheet.create({
    page: { padding: L.pagePadding, fontFamily: "Sans", fontSize: L.bodyTextFontSize, lineHeight: L.bodyTextLineHeight, color: COLORS.textPrimary },
    header: { paddingBottom: L.headerPaddingBottom },
    name: { fontFamily: "Sans", fontWeight: T.nameFontWeight, fontSize: L.nameFontSize * T.nameSizeMultiplier, lineHeight: L.nameLineHeight, textAlign: "center", color: COLORS.textPrimary, marginBottom: L.nameMarginBottom },
    titleRow: { fontFamily: "Sans", fontWeight: T.titleFontWeight, fontSize: L.titleFontSize, lineHeight: L.titleLineHeight, letterSpacing: T.titleLetterSpacing, textAlign: "center", color: COLORS.textBody, marginTop: L.titleMarginTop, marginBottom: L.titleMarginBottom },
    contactRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", columnGap: L.contactItemGap, rowGap: L.contactRowGap },
    contactItem: { flexDirection: "row", alignItems: "center", color: COLORS.textBody, textDecoration: "none" },
    contactIcon: { width: getContactIconSize(L), height: getContactIconSize(L), marginRight: L.contactIconGap },
    contactText: { fontFamily: "Sans", fontWeight: 400, fontSize: L.contactFontSize, lineHeight: L.contactLineHeight, color: COLORS.textBody, textDecoration: "none" },
    section: { marginTop: L.sectionMarginTop },
    sectionHeading: { fontFamily: "Sans", fontWeight: T.sectionHeaderFontWeight, fontSize: L.sectionHeaderFontSize, letterSpacing: T.sectionHeaderLetterSpacing, textTransform: T.sectionHeaderTransform as "uppercase" },
    sectionDivider: { borderBottomWidth: T.sectionHeaderBorderWidth, borderBottomColor: "#000000", marginTop: L.sectionHeaderPaddingBottom, marginBottom: L.sectionHeaderMarginBottom },
    bodyText: { fontFamily: "Sans", fontWeight: 400, fontSize: L.bodyTextFontSize, lineHeight: L.bodyTextLineHeight, color: COLORS.textBody },
    entry: { marginTop: L.entryGap },
    entryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    entryLeft: { flexGrow: 1, paddingRight: 8 },
    entryTitle: { fontFamily: "Sans", fontWeight: T.entryTitleFontWeight, fontSize: L.entrySubtitleFontSize, color: COLORS.textPrimary },
    entrySubtitle: { fontFamily: "Sans", fontWeight: T.entrySubtitleFontWeight, fontSize: L.entryMetaFontSize, color: COLORS.textSecondary },
    entryDate: { fontFamily: "Sans", fontWeight: 500, fontSize: L.entryMetaFontSize, color: COLORS.textTertiary, textAlign: "right" },
    entryMeta: { fontFamily: "Sans", fontWeight: 400, fontSize: L.entryMetaFontSize, color: COLORS.textSecondary },
    bulletList: { marginTop: L.bulletListMarginTop },
    bullet: { flexDirection: "row", marginBottom: L.bulletGap },
    bulletMark: { fontFamily: "Sans", fontWeight: 400, width: L.bulletListPaddingLeft * 0.45, fontSize: L.bulletFontSize, color: COLORS.textMuted },
    bulletText: { flex: 1, fontFamily: "Sans", fontWeight: 400, fontSize: L.bulletFontSize, lineHeight: L.bulletLineHeight, color: COLORS.textBody },
    skillsContainer: { marginTop: L.skillsMarginTop },
    skillRow: { marginBottom: L.skillsItemMarginBottom },
    skillTitle: { fontFamily: "Sans", fontWeight: T.entryTitleFontWeight, fontSize: L.skillsItemFontSize, color: COLORS.textPrimary, marginBottom: 1.5 },
    skillItems: { fontFamily: "Sans", fontWeight: 400, fontSize: L.skillsItemFontSize, color: COLORS.textBody },
    achievementBullet: { flexDirection: "row", marginBottom: L.achievementsItemMarginBottom },
    certRow: { flexDirection: "row", marginBottom: L.certificationsGap * 0.4 },
    certCell: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
    certCellLeft: { marginRight: L.certificationsColumnGap },
    certText: { fontFamily: "Sans", fontWeight: 400, fontSize: L.certificationsItemFontSize, lineHeight: L.certificationsItemLineHeight, color: COLORS.textBody },
    certTitle: { fontFamily: "Sans", fontWeight: T.entryTitleFontWeight, fontSize: L.certificationsItemFontSize, color: COLORS.textPrimary },
    languagesContainer: { marginTop: L.languagesMarginTop, flexDirection: "row", flexWrap: "wrap" },
    langItem: { fontSize: L.languagesItemFontSize, marginRight: L.languagesGap, marginBottom: L.languagesGap * 0.3 },
    langName: { fontFamily: "Sans", fontWeight: T.entryTitleFontWeight, color: COLORS.textPrimary },
    langProficiency: { fontFamily: "Sans", fontWeight: 400, fontStyle: "italic", color: COLORS.textSecondary },
  });
}

const ContactIconPDF = ({ type, styles: stl }: { type: ContactType; styles: ReturnType<typeof buildStyles> }) => {
  const icon = getContactIcon(type);
  const color = COLORS.textBody;
  return (
    <Svg viewBox={icon.viewBox} style={stl.contactIcon}>
      {icon.paths.map((d, i) =>
        icon.mode === "stroke" ? (
          <Path key={i} d={d} fill="none" stroke={color} strokeWidth={icon.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <Path key={i} d={d} fill={color} />
        )
      )}
    </Svg>
  );
};

const BulletsComp = ({ items, styles: stl }: { items: string[]; styles: ReturnType<typeof buildStyles> }) => (
  <View style={stl.bulletList}>
    {items.filter(Boolean).map((item, index) => (
      <View key={index} style={stl.bullet}>
        <Text style={stl.bulletMark}>{"\u2022"}</Text>
        <Text style={stl.bulletText}>{item}</Text>
      </View>
    ))}
  </View>
);

const SectionComp = ({ title, styles: stl, children }: { title: string; styles: ReturnType<typeof buildStyles>; children: React.ReactNode }) => (
  <View style={stl.section}>
    <Text style={stl.sectionHeading}>{title}</Text>
    <View style={stl.sectionDivider} />
    {children}
  </View>
);

function SectionRenderer({ section, resume, S, L }: { section: string; resume: Resume; S: ReturnType<typeof buildStyles>; L: ResumeLayout; }) {
  if (section === "Experience") {
    const items = (resume.experience || []).filter((item) => item.enabled);
    if (items.length === 0) return null;
    return (
      <SectionComp title="Experience" styles={S}>
        {items.map((item, idx) => (
          <View key={item.id} style={idx > 0 ? S.entry : undefined}>
            <View style={S.entryRow}>
              <Text style={S.entryTitle}>{item.role}</Text>
              <Text style={S.entryDate}>{formatDateRange(item.startDate, item.endDate, item.currentlyWorking)}</Text>
            </View>
            <Text style={S.entrySubtitle}>{item.company}{item.location ? `, ${item.location}` : ""}</Text>
            {item.bullets && item.bullets.length > 0 && <BulletsComp items={item.bullets} styles={S} />}
          </View>
        ))}
      </SectionComp>
    );
  }

  if (section === "Education") {
    const items = (resume.education || []).filter((item) => item.enabled);
    if (items.length === 0) return null;
    return (
      <SectionComp title="Education" styles={S}>
        {items.map((item, idx) => {
          let degreeStr = item.degree;
          if (item.field && !item.degree.toLowerCase().includes(item.field.toLowerCase())) degreeStr += ` in ${item.field}`;
          return (
            <View key={item.id} style={idx > 0 ? S.entry : undefined}>
              <View style={S.entryRow}>
                <Text style={S.entryTitle}>{degreeStr}</Text>
                <Text style={S.entryDate}>{formatDateRange(item.startDate, item.endDate)}</Text>
              </View>
              <Text style={S.entrySubtitle}>{item.institution}{item.grade ? ` \u2014 ${item.grade}` : ""}</Text>
            </View>
          );
        })}
      </SectionComp>
    );
  }

  if (section === "Projects") {
    const items = (resume.projects || []).filter((item) => item.enabled);
    if (items.length === 0) return null;
    return (
      <SectionComp title="Projects" styles={S}>
        {items.map((item, idx) => {
          const linkInfo = getProjectLinkInfo(item.link);
          return (
            <View key={item.id} style={idx > 0 ? S.entry : undefined}>
              <View style={S.entryRow}>
                <View style={S.entryLeft}>
                  <Text style={S.entryTitle}>
                    {item.title}
                    {item.technologies && item.technologies.length > 0 ? (<Text style={S.entryMeta}>{" | "}{item.technologies.join(", ")}</Text>) : null}
                  </Text>
                </View>
                {linkInfo ? (<Link src={linkInfo.href} style={S.entryDate}>{linkInfo.label}</Link>) : null}
              </View>
              {item.bullets && item.bullets.length > 0 && <BulletsComp items={item.bullets} styles={S} />}
            </View>
          );
        })}
      </SectionComp>
    );
  }

  if (section === "Research") {
    const items = (resume.research || []).filter((item: any) => item.enabled);
    if (items.length === 0) return null;
    return (
      <SectionComp title="Research" styles={S}>
        {items.map((item: any, idx: number) => (
          <View key={item.id} style={idx > 0 ? S.entry : undefined}>
            <View style={S.entryRow}>
              <View style={S.entryLeft}>
                <Text style={S.entryTitle}>{item.title}</Text>
                {item.institution && (<Text style={S.entrySubtitle}>{item.institution}{item.advisor ? ` \u2014 Advisor: ${item.advisor}` : ""}</Text>)}
              </View>
              <Text style={S.entryDate}>{normalizeDate(item.duration)}</Text>
            </View>
            {item.bullets && item.bullets.filter(Boolean).length > 0 && <BulletsComp items={item.bullets} styles={S} />}
          </View>
        ))}
      </SectionComp>
    );
  }

  if (section === "Publications") {
    const items = (resume.publications || []).filter((item: any) => item.enabled);
    if (items.length === 0) return null;
    return (
      <SectionComp title="Publications" styles={S}>
        {items.map((item: any, idx: number) => (
          <View key={item.id} style={idx > 0 ? S.entry : undefined}>
            <View style={S.entryRow}>
              <View style={S.entryLeft}>
                <Text style={S.entryTitle}>{item.title}</Text>
                {item.authors && (<Text style={S.entrySubtitle}>{item.authors}</Text>)}
                <Text style={S.entryMeta}>{item.venue}{item.doi ? ` \u2014 ${item.doi}` : ""}</Text>
              </View>
              {item.date && (<Text style={S.entryDate}>{normalizeDate(item.date)}</Text>)}
            </View>
            {item.description ? (<Text style={S.bodyText}>{item.description}</Text>) : null}
          </View>
        ))}
      </SectionComp>
    );
  }

  if (section === "Skills") {
    const active = (resume.skills || []).filter((item) => item.title?.trim() && item.items?.some((s) => s.trim()));
    if (active.length === 0) return null;
    return (
      <SectionComp title="Skills" styles={S}>
        <View style={S.skillsContainer}>
          {active.map((item) => (
            <View key={item.id} style={{ flexDirection: "row", marginBottom: L.skillsItemMarginBottom }}>
              <Text style={S.skillTitle}>{item.title}: </Text>
              <Text style={{ flex: 1, fontFamily: "Sans", fontWeight: 400, fontSize: L.skillsItemFontSize, color: COLORS.textBody }}>
                {[...new Set(item.items.filter(Boolean))].join(", ")}
              </Text>
            </View>
          ))}
        </View>
      </SectionComp>
    );
  }

  if (section === "Achievements") {
    const items = (resume.achievements || []).filter((item) => item.enabled && (item.title || item.description));
    if (items.length === 0) return null;
    return (
      <SectionComp title="Achievements" styles={S}>
        {items.map((item) => (
          <View key={item.id} style={S.achievementBullet}>
            <Text style={S.bulletMark}>{"\u2022"}</Text>
            <Text style={S.bulletText}>{item.title}{item.title && item.description ? " \u2014 " : ""}{item.description || ""}</Text>
          </View>
        ))}
      </SectionComp>
    );
  }

  if (section === "Certifications") {
    const items = (resume.certifications || []).filter((item) => item.enabled);
    if (items.length === 0) return null;
    const columns = getCertificationColumns(items.length);
    return (
      <SectionComp title="Certifications" styles={S}>
        {/* Two equal columns, filled row by row */}
        {chunkRows(items, columns).map((row) => (
          <View key={row[0].id} style={S.certRow}>
            {Array.from({ length: columns }, (_, col) => {
              const item = row[col];
              return (
                <View key={col} style={col < columns - 1 ? [S.certCell, S.certCellLeft] : S.certCell}>
                  {item && (
                    <Text style={S.certText}>
                      <Text style={S.certTitle}>{item.title}</Text>
                      {item.issuer ? ` \u2014 ${item.issuer}` : ""}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </SectionComp>
    );
  }

  if (section === "Languages") {
    const items = (resume.languages || []).filter((item) => item.enabled && (item.name || item.proficiency));
    if (items.length === 0) return null;
    return (
      <SectionComp title="Languages" styles={S}>
        <View style={S.languagesContainer}>
          {items.map((lang) => (
            <Text key={lang.id} style={S.langItem}>
              {lang.name && <Text style={S.langName}>{lang.name}</Text>}
              {lang.name && lang.proficiency ? ": " : null}
              {lang.proficiency && <Text style={S.langProficiency}>{lang.proficiency}</Text>}
            </Text>
          ))}
        </View>
      </SectionComp>
    );
  }

  return null;
}

export const ResumePDFDocument = ({ resume }: { resume: Resume }) => {
  // Auto-fit: find optimal compress level for one-page layout
  const autoFit = findOptimalLayout(resume);
  const baseL = getResumeLayout(resume);
  const L = applyCompressLevel(baseL, autoFit.level);
  const T = getTemplateStyles(resume.template);
  const S = buildStyles(L, T);
  const profile = resume.profile;
  const atsContact = buildATSContactLine(profile);
  const titleLine = (profile.titles || []).filter(Boolean).join(" | ");
  const sectionsToRender = (resume.sectionOrder || []).filter((section) => hasSectionData(resume, section));

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* HEADER — full width */}
        <View style={S.header}>
          {/* Name → Titles → Contact */}
          <Text style={S.name}>{profile.fullName || "Candidate Name"}</Text>

          {titleLine && <Text style={S.titleRow}>{titleLine}</Text>}

          {atsContact.length > 0 && (
            <View style={[S.contactRow, { marginTop: titleLine ? 0 : L.titleMarginTop }]}>
              {atsContact.map((entry, idx) =>
                entry.href ? (
                  <Link key={idx} src={entry.href} style={S.contactItem}>
                    <ContactIconPDF type={entry.type} styles={S} />
                    <Text style={S.contactText}>{entry.display}</Text>
                  </Link>
                ) : (
                  <View key={idx} style={S.contactItem}>
                    <ContactIconPDF type={entry.type} styles={S} />
                    <Text style={S.contactText}>{entry.display}</Text>
                  </View>
                )
              )}
            </View>
          )}
        </View>

        {/* Professional Summary */}
        {resume.summary?.enabled && resume.summary.text?.trim() && (
          <SectionComp title="Summary" styles={S}>
            <Text style={S.bodyText}>{resume.summary.text}</Text>
          </SectionComp>
        )}

        {/* SECTIONS — single column */}
        {sectionsToRender.map((section) => (
          <React.Fragment key={section}>{SectionRenderer({ section, resume, S, L })}</React.Fragment>
        ))}
      </Page>
    </Document>
  );
};
