import React from "react";
import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { Resume } from "@/types/resume";
import { normalizeEmail, normalizeUrl } from "@/lib/contactLinks";

// Keep words intact: a resume benefits more from clean reading than aggressive line fitting.
Font.registerHyphenationCallback((word) => [word]);

const spacing = { page: 32, headerBottom: 8, section: 7, headingDivider: 2, dividerContent: 4, entry: 4, metadata: 1, bullets: 2, bulletGap: 1, certGap: 12 };
const styles = StyleSheet.create({
  page: { padding: spacing.page, fontFamily: "Helvetica", fontSize: 9, lineHeight: 1.25, color: "#171717" },
  header: { marginBottom: spacing.headerBottom }, name: { fontFamily: "Helvetica-Bold", fontSize: 25, lineHeight: 1.05, marginBottom: 2 },
  title: { fontSize: 10.5, color: "#404040", marginBottom: 3 }, contact: { flexDirection: "row", flexWrap: "wrap", fontSize: 8.75, color: "#333" }, contactItem: { marginRight: 7, fontSize: 8.75, color: "#333", textDecoration: "none" },
  section: { marginBottom: spacing.section }, heading: { fontFamily: "Helvetica-Bold", fontSize: 9.5, letterSpacing: .6 }, divider: { borderBottomWidth: .65, borderBottomColor: "#262626", marginTop: spacing.headingDivider, marginBottom: spacing.dividerContent },
  summary: { fontSize: 8.8, lineHeight: 1.3 }, entry: { marginBottom: spacing.entry }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, entryMain: { flexGrow: 1, paddingRight: 8 }, primary: { fontFamily: "Helvetica-Bold", fontSize: 9 }, secondary: { fontSize: 8.5, color: "#404040", marginTop: spacing.metadata }, date: { fontSize: 8.3, color: "#404040", minWidth: 78, textAlign: "right" },
  bulletList: { marginTop: spacing.bullets, paddingLeft: 7 }, bullet: { flexDirection: "row", marginBottom: spacing.bulletGap }, bulletMark: { width: 7, fontSize: 8.5 }, bulletText: { flex: 1, fontSize: 8.5, lineHeight: 1.25 }, skill: { flexDirection: "row", marginBottom: 1 }, skillTitle: { fontFamily: "Helvetica-Bold", fontSize: 8.5 }, skillItems: { flex: 1, fontSize: 8.5 },
  achievement: { flexDirection: "row", marginBottom: 1 }, certRows: { gap: 2 }, certRow: { flexDirection: "row", gap: spacing.certGap }, cert: { flex: 1, fontSize: 8.4 }, language: { marginBottom: 1, fontSize: 8.5 },
});

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <View style={styles.section}><Text style={styles.heading}>{title}</Text><View style={styles.divider} />{children}</View>;
const Bullets = ({ items }: { items: string[] }) => <View style={styles.bulletList}>{items.filter(Boolean).map((item, index) => <View key={index} style={styles.bullet}><Text style={styles.bulletMark}>•</Text><Text style={styles.bulletText}>{item}</Text></View>)}</View>;

export const ResumePDFDocument = ({ resume }: { resume: Resume }) => {
  const profile = resume.profile;
  const enabledExperience = (resume.experience || []).filter((item) => item.enabled);
  const enabledProjects = (resume.projects || []).filter((item) => item.enabled);
  const enabledEducation = (resume.education || []).filter((item) => item.enabled);
  const activeSkills = (resume.skills || []).filter((item) => item.title?.trim() && item.items?.some((skill) => skill.trim()));
  const achievements = (resume.achievements || []).filter((item) => item.enabled && (item.title || item.description));
  const certifications = (resume.certifications || []).filter((item) => item.enabled && (item.title || item.issuer));
  const languages = (resume.languages || []).filter((item) => item.enabled && (item.name || item.proficiency));
  const certRows = Array.from({ length: Math.ceil(certifications.length / 2) }, (_, i) => certifications.slice(i * 2, i * 2 + 2));
  return <Document><Page size="A4" style={styles.page}>
    <View style={styles.header}>
      <Text style={styles.name}>{profile.fullName?.trim() || "Candidate Name"}</Text>
      {!!profile.title?.trim() && <Text style={styles.title}>{profile.title}</Text>}
      <View style={styles.contact}>
        {!!normalizeEmail(profile.email) && <Link src={normalizeEmail(profile.email)} style={styles.contactItem}>{profile.email.trim()}</Link>}
        {!!profile.phone && <Text style={styles.contactItem}>• {profile.phone}</Text>}
        {!!profile.location && <Text style={styles.contactItem}>• {profile.location}</Text>}
        {(profile.links || []).filter((link) => normalizeUrl(link.url)).map((link, index) => <Link key={index} src={normalizeUrl(link.url)} style={styles.contactItem}>• {link.label?.toLowerCase() === "linkedin" ? "LinkedIn" : link.label?.toLowerCase() === "github" ? "GitHub" : link.label || link.url.trim()}</Link>)}
      </View>
    </View>
    {resume.summary?.enabled && resume.summary.text?.trim() && <Section title="PROFESSIONAL SUMMARY"><Text style={styles.summary}>{resume.summary.text}</Text></Section>}
    {!!enabledExperience.length && <Section title="EXPERIENCE">{enabledExperience.map((item) => <View key={item.id} style={styles.entry}><View style={styles.row}><View style={styles.entryMain}><Text style={styles.primary}>{item.role}</Text><Text style={styles.secondary}>{item.company}{item.location ? ` | ${item.location}` : ""}</Text></View><Text style={styles.date}>{item.startDate} - {item.currentlyWorking ? "Present" : item.endDate}</Text></View><Bullets items={item.bullets || []} /></View>)}</Section>}
    {!!enabledProjects.length && <Section title="PROJECTS">{enabledProjects.map((item) => <View key={item.id} style={styles.entry}><Text style={styles.primary}>{item.title}</Text>{item.technologies?.length > 0 && <Text style={styles.secondary}>Technologies: {item.technologies.filter(Boolean).join(", ")}</Text>}{item.link && <Link src={item.link} style={styles.secondary}>{item.link}</Link>}<Bullets items={item.bullets || []} /></View>)}</Section>}
    {!!enabledEducation.length && <Section title="EDUCATION">{enabledEducation.map((item) => <View key={item.id} style={styles.entry}><View style={styles.row}><View style={styles.entryMain}><Text style={styles.primary}>{item.institution}</Text><Text style={styles.secondary}>{item.degree}{item.field ? ` | ${item.field}` : ""}{item.grade ? ` | ${item.grade}` : ""}</Text></View><Text style={styles.date}>{item.startDate} - {item.endDate}</Text></View></View>)}</Section>}
    {!!activeSkills.length && <Section title="SKILLS">{activeSkills.map((item) => <View key={item.id} style={styles.skill}><Text style={styles.skillTitle}>{item.title}: </Text><Text style={styles.skillItems}>{[...new Set(item.items.filter(Boolean))].join(", ")}</Text></View>)}</Section>}
    {!!achievements.length && <Section title="ACHIEVEMENTS">{achievements.map((item) => <View key={item.id} style={styles.achievement}><Text style={styles.bulletMark}>•</Text><Text style={styles.bulletText}><Text style={styles.primary}>{item.title}</Text>{item.title && item.description ? " — " : ""}{item.description}</Text></View>)}</Section>}
    {!!certifications.length && <Section title="CERTIFICATIONS">{certifications.length === 1 ? <Text style={styles.cert}><Text style={styles.primary}>{certifications[0].title}</Text>{certifications[0].title && certifications[0].issuer ? " — " : ""}{certifications[0].issuer}</Text> : <View style={styles.certRows}>{certRows.map((row, index) => <View key={index} style={styles.certRow}>{row.map((item) => <Text key={item.id} style={styles.cert}><Text style={styles.primary}>{item.title}</Text>{item.title && item.issuer ? " — " : ""}{item.issuer}</Text>)}{row.length === 1 && <View style={styles.cert} />}</View>)}</View>}</Section>}
    {!!languages.length && <Section title="LANGUAGES">{languages.map((item) => <Text key={item.id} style={styles.language}><Text style={styles.primary}>{item.name}</Text>{item.name && item.proficiency ? ": " : ""}{item.proficiency}</Text>)}</Section>}
  </Page></Document>;
};
