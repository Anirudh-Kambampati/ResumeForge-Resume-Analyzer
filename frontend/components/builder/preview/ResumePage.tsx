"use client";

import { Resume } from "@/types/resume";
import { BuilderSection } from "@/store/resumeStore";
import { normalizeEmail, normalizeUrl } from "@/lib/contactLinks";

type Props = {
  resume: Resume;
  selectedSection: BuilderSection;
};

export type ResumeDensity = "comfortable" | "compact" | "dense" | "ultraCompact";

export function getResumeDensity(resume: Resume): ResumeDensity {
  let score = 0;

  // 1. Profile contacts (base overhead)
  const contactInfoCount = [
    resume.profile?.email,
    resume.profile?.phone,
    resume.profile?.location,
    ...(resume.profile?.links || [])
  ].filter(Boolean).length;
  score += contactInfoCount * 0.5;

  // 2. Summary
  if (resume.summary?.enabled && resume.summary.text?.trim()) {
    score += 3;
    score += resume.summary.text.trim().length / 60;
  }

  // 3. Experience
  const activeExp = (resume.experience || []).filter(job => job.enabled);
  if (activeExp.length > 0) {
    score += 3;
    for (const job of activeExp) {
      score += 3;
      const bullets = (job.bullets || []).filter(b => b.trim());
      for (const bullet of bullets) {
        score += 1;
        score += bullet.trim().length / 80;
      }
    }
  }

  // 4. Projects
  const activeProjects = (resume.projects || []).filter(p => p.enabled);
  if (activeProjects.length > 0) {
    score += 3;
    for (const p of activeProjects) {
      score += 3;
      const bullets = (p.bullets || []).filter(b => b.trim());
      for (const bullet of bullets) {
        score += 1;
        score += bullet.trim().length / 80;
      }
    }
  }

  // 5. Education
  const activeEdu = (resume.education || []).filter(e => e.enabled);
  if (activeEdu.length > 0) {
    score += 3;
    score += activeEdu.length * 3.5;
  }

  // 6. Skills
  const activeSkills = (resume.skills || []).filter(cat => cat.title && cat.items?.length > 0);
  if (activeSkills.length > 0) {
    score += 3;
    for (const cat of activeSkills) {
      score += 1.5;
      score += cat.items.length * 0.2;
    }
  }

  // 7. Achievements
  const activeAch = (resume.achievements || []).filter(a => a.enabled);
  if (activeAch.length > 0) {
    score += 3;
    score += activeAch.length * 2;
  }

  // 8. Certifications
  const activeCert = (resume.certifications || []).filter(c => c.enabled);
  if (activeCert.length > 0) {
    score += 3;
    score += activeCert.length * 1.25;
  }

  // 9. Languages
  const activeLang = (resume.languages || []).filter(l => l.enabled && (l.name || l.proficiency));
  if (activeLang.length > 0) {
    score += 3;
    score += activeLang.length * 1;
  }

  if (score <= 40) return "comfortable";
  if (score <= 55) return "compact";
  if (score <= 72) return "dense";
  return "ultraCompact";
}

const densityStyles = {
  comfortable: {
    page: {
      padding: "20mm",
    },
    header: {
      paddingBottom: "16px",
    },
    name: {
      fontSize: "24pt",
      lineHeight: "1.2",
    },
    title: {
      fontSize: "11pt",
      marginTop: "4px",
    },
    contactRow: {
      marginTop: "10px",
      fontSize: "9pt",
      gap: "12px",
    },
    sectionGap: {
      marginTop: "20px",
    },
    sectionHeader: {
      fontSize: "10pt",
      paddingBottom: "4px",
      marginBottom: "8px",
    },
    entryGap: {
      marginTop: "10px",
    },
    entryHeader: {
      fontSize: "10pt",
      lineHeight: "1.4",
    },
    entryCompany: {
      fontSize: "10pt",
    },
    entryMeta: {
      fontSize: "9.5pt",
    },
    bulletList: {
      marginTop: "6px",
      paddingLeft: "16px",
      gap: "4px",
    },
    bulletItem: {
      fontSize: "9.5pt",
      lineHeight: "1.4",
      marginBottom: "4px",
    },
    bodyText: {
      fontSize: "9.5pt",
      lineHeight: "1.4",
      marginTop: "6px",
    },
    skillsGap: {
      marginTop: "6px",
    },
    skillsItem: {
      fontSize: "9.5pt",
      lineHeight: "1.4",
      marginBottom: "4px",
    },
    achievementsList: {
      marginTop: "6px",
      paddingLeft: "16px",
    },
    achievementsItem: {
      fontSize: "9.5pt",
      lineHeight: "1.4",
      marginBottom: "4px",
    },
    certificationsContainer: {
      marginTop: "6px",
      gap: "16px",
    },
    certificationsItem: {
      fontSize: "9.5pt",
      lineHeight: "1.4",
    },
    languagesContainer: {
      marginTop: "6px",
      gap: "12px",
    },
    languagesItem: {
      fontSize: "9.5pt",
      lineHeight: "1.4",
    }
  },
  compact: {
    page: {
      padding: "15mm",
    },
    header: {
      paddingBottom: "12px",
    },
    name: {
      fontSize: "24pt",
      lineHeight: "1.2",
    },
    title: {
      fontSize: "10.5pt",
      marginTop: "3px",
    },
    contactRow: {
      marginTop: "8px",
      fontSize: "8.75pt",
      gap: "10px",
    },
    sectionGap: {
      marginTop: "16px",
    },
    sectionHeader: {
      fontSize: "9.5pt",
      paddingBottom: "3px",
      marginBottom: "6px",
    },
    entryGap: {
      marginTop: "8px",
    },
    entryHeader: {
      fontSize: "9.5pt",
      lineHeight: "1.3",
    },
    entryCompany: {
      fontSize: "9.5pt",
    },
    entryMeta: {
      fontSize: "9pt",
    },
    bulletList: {
      marginTop: "4px",
      paddingLeft: "14px",
      gap: "3px",
    },
    bulletItem: {
      fontSize: "9.2pt",
      lineHeight: "1.3",
      marginBottom: "3px",
    },
    bodyText: {
      fontSize: "9.2pt",
      lineHeight: "1.3",
      marginTop: "4px",
    },
    skillsGap: {
      marginTop: "4px",
    },
    skillsItem: {
      fontSize: "9.2pt",
      lineHeight: "1.3",
      marginBottom: "3px",
    },
    achievementsList: {
      marginTop: "4px",
      paddingLeft: "14px",
    },
    achievementsItem: {
      fontSize: "9.2pt",
      lineHeight: "1.3",
      marginBottom: "3px",
    },
    certificationsContainer: {
      marginTop: "4px",
      gap: "12px",
    },
    certificationsItem: {
      fontSize: "9.2pt",
      lineHeight: "1.3",
    },
    languagesContainer: {
      marginTop: "4px",
      gap: "10px",
    },
    languagesItem: {
      fontSize: "9.2pt",
      lineHeight: "1.3",
    }
  },
  dense: {
    page: {
      padding: "12mm",
    },
    header: {
      paddingBottom: "8px",
    },
    name: {
      fontSize: "24pt",
      lineHeight: "1.1",
    },
    title: {
      fontSize: "10.5pt",
      marginTop: "2px",
    },
    contactRow: {
      marginTop: "6px",
      fontSize: "8.75pt",
      gap: "8px",
    },
    sectionGap: {
      marginTop: "12px",
    },
    sectionHeader: {
      fontSize: "9pt",
      paddingBottom: "2px",
      marginBottom: "4px",
    },
    entryGap: {
      marginTop: "6px",
    },
    entryHeader: {
      fontSize: "9pt",
      lineHeight: "1.2",
    },
    entryCompany: {
      fontSize: "9pt",
    },
    entryMeta: {
      fontSize: "8.5pt",
    },
    bulletList: {
      marginTop: "3px",
      paddingLeft: "12px",
      gap: "2px",
    },
    bulletItem: {
      fontSize: "8.8pt",
      lineHeight: "1.25",
      marginBottom: "2px",
    },
    bodyText: {
      fontSize: "8.8pt",
      lineHeight: "1.25",
      marginTop: "3px",
    },
    skillsGap: {
      marginTop: "3px",
    },
    skillsItem: {
      fontSize: "8.8pt",
      lineHeight: "1.25",
      marginBottom: "2px",
    },
    achievementsList: {
      marginTop: "3px",
      paddingLeft: "12px",
    },
    achievementsItem: {
      fontSize: "8.8pt",
      lineHeight: "1.25",
      marginBottom: "2px",
    },
    certificationsContainer: {
      marginTop: "3px",
      gap: "8px",
    },
    certificationsItem: {
      fontSize: "8.8pt",
      lineHeight: "1.25",
    },
    languagesContainer: {
      marginTop: "3px",
      gap: "8px",
    },
    languagesItem: {
      fontSize: "8.8pt",
      lineHeight: "1.25",
    }
  },
  ultraCompact: {
    page: {
      padding: "10mm",
    },
    header: {
      paddingBottom: "6px",
    },
    name: {
      fontSize: "24pt",
      lineHeight: "1.1",
    },
    title: {
      fontSize: "10.5pt",
      marginTop: "2px",
    },
    contactRow: {
      marginTop: "4px",
      fontSize: "8.75pt",
      gap: "6px",
    },
    sectionGap: {
      marginTop: "8px",
    },
    sectionHeader: {
      fontSize: "8.5pt",
      paddingBottom: "1px",
      marginBottom: "3px",
    },
    entryGap: {
      marginTop: "4px",
    },
    entryHeader: {
      fontSize: "8.5pt",
      lineHeight: "1.2",
    },
    entryCompany: {
      fontSize: "8.5pt",
    },
    entryMeta: {
      fontSize: "8pt",
    },
    bulletList: {
      marginTop: "2px",
      paddingLeft: "10px",
      gap: "1px",
    },
    bulletItem: {
      fontSize: "8.5pt",
      lineHeight: "1.2",
      marginBottom: "1px",
    },
    bodyText: {
      fontSize: "8.5pt",
      lineHeight: "1.2",
      marginTop: "2px",
    },
    skillsGap: {
      marginTop: "2px",
    },
    skillsItem: {
      fontSize: "8.5pt",
      lineHeight: "1.2",
      marginBottom: "1px",
    },
    achievementsList: {
      marginTop: "2px",
      paddingLeft: "10px",
    },
    achievementsItem: {
      fontSize: "8.5pt",
      lineHeight: "1.2",
      marginBottom: "1px",
    },
    certificationsContainer: {
      marginTop: "2px",
      gap: "6px",
    },
    certificationsItem: {
      fontSize: "8.5pt",
      lineHeight: "1.2",
    },
    languagesContainer: {
      marginTop: "2px",
      gap: "6px",
    },
    languagesItem: {
      fontSize: "8.5pt",
      lineHeight: "1.2",
    }
  }
};

export default function ResumePage({
  resume,
  selectedSection,
}: Props) {
  const highlight = (section: BuilderSection) =>
    selectedSection === section
      ? "ring-2 ring-blue-500/40 rounded-sm transition-all duration-200 print:ring-0 print:outline-none"
      : "";

  const density = getResumeDensity(resume);
  const styles = densityStyles[density];

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

  return (
    <article
      id="resume-page"
      className="
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
        font-serif
      "
      style={{
        padding: styles.page.padding,
        "--resume-page-padding": styles.page.padding,
      } as React.CSSProperties}
    >
      <div className="flex h-full flex-col text-left">
        
        {/* Header */}
        <header 
          className={`text-center border-b border-neutral-300 ${highlight("Profile")}`}
          style={styles.header}
        >
          <h1 
            className="font-bold tracking-tight text-neutral-900 uppercase"
            style={styles.name}
          >
            {profile.fullName || "Your Full Name"}
          </h1>
          <p 
            className="font-semibold tracking-wider text-neutral-600 uppercase"
            style={styles.title}
          >
            {profile.title || "Professional Title"}
          </p>
          
          {contactInfo.length > 0 && (
            <div 
              className="flex flex-wrap justify-center items-center text-neutral-700 font-sans"
              style={styles.contactRow}
            >
              {contactInfo.map((info, idx) => (
                <span key={idx} className="flex items-center">
                  {idx > 0 && <span className="mr-3 text-neutral-400 select-none">|</span>}
                  {info.href ? <a href={info.href}>{info.label}</a> : info.label}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="text-neutral-800">

          {/* Professional Summary */}
          {resume.summary?.enabled && resume.summary.text?.trim() && (
            <section className={highlight("Summary")} style={styles.sectionGap}>
              <h2 
                className="border-b-2 border-neutral-800 uppercase tracking-wider text-neutral-900 font-bold"
                style={styles.sectionHeader}
              >
                PROFESSIONAL SUMMARY
              </h2>
              <p className="text-neutral-700 font-sans" style={styles.bodyText}>
                {resume.summary.text}
              </p>
            </section>
          )}

          {/* Experience */}
          {resume.experience && resume.experience.filter((job) => job.enabled).length > 0 && (
            <section className={highlight("Experience")} style={styles.sectionGap}>
              <h2 
                className="border-b-2 border-neutral-800 font-bold uppercase tracking-wider text-neutral-900"
                style={styles.sectionHeader}
              >
                EXPERIENCE
              </h2>
              <div style={{ marginTop: styles.entryGap.marginTop }}>
                {resume.experience
                  .filter((job) => job.enabled)
                  .map((job, idx) => (
                    <div 
                      key={job.id} 
                      style={{ 
                        marginTop: idx > 0 ? styles.entryGap.marginTop : "0px" 
                      }}
                    >
                      <div className="flex justify-between font-sans" style={styles.entryHeader}>
                        <div>
                          <strong className="text-neutral-900 font-bold" style={styles.entryCompany}>{job.role}</strong>
                          <span className="text-neutral-600" style={styles.entryMeta}> &mdash; {job.company}</span>
                        </div>
                        <div className="text-neutral-600 font-medium" style={styles.entryMeta}>
                          {job.location && <span>{job.location} | </span>}
                          <span>
                            {job.startDate} &ndash;{" "}
                            {job.currentlyWorking ? "Present" : job.endDate}
                          </span>
                        </div>
                      </div>
                      {job.bullets && job.bullets.length > 0 && (
                        <ul className="list-disc text-neutral-700 leading-normal" style={styles.bulletList}>
                          {job.bullets
                            .filter((b) => b.trim())
                            .map((bullet, bulletIdx) => (
                              <li key={bulletIdx} style={styles.bulletItem}>{bullet}</li>
                            ))}
                        </ul>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Projects */}
          {resume.projects && resume.projects.filter((project) => project.enabled).length > 0 && (
            <section className={highlight("Projects")} style={styles.sectionGap}>
              <h2 
                className="border-b-2 border-neutral-800 font-bold uppercase tracking-wider text-neutral-900"
                style={styles.sectionHeader}
              >
                PROJECTS
              </h2>
              <div style={{ marginTop: styles.entryGap.marginTop }}>
                {resume.projects
                  .filter((project) => project.enabled)
                  .map((project, idx) => (
                    <div 
                      key={project.id} 
                      style={{ 
                        marginTop: idx > 0 ? styles.entryGap.marginTop : "0px" 
                      }}
                    >
                      <div className="flex justify-between font-sans" style={styles.entryHeader}>
                        <div>
                          <strong className="text-neutral-900 font-bold" style={styles.entryCompany}>
                            {project.title}
                          </strong>
                          {project.link && (
                            <span className="text-neutral-500 ml-2 select-all font-mono" style={{ fontSize: styles.entryMeta.fontSize }}>
                              ({project.link})
                            </span>
                          )}
                        </div>
                        {project.technologies && project.technologies.length > 0 && (
                          <div className="text-neutral-600 italic font-medium" style={styles.entryMeta}>
                            {project.technologies.join(", ")}
                          </div>
                        )}
                      </div>
                      {project.bullets && project.bullets.length > 0 && (
                        <ul className="list-disc text-neutral-700 leading-normal" style={styles.bulletList}>
                          {project.bullets
                            .filter((b) => b.trim())
                            .map((bullet, bulletIdx) => (
                              <li key={bulletIdx} style={styles.bulletItem}>{bullet}</li>
                            ))}
                        </ul>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Education */}
          {resume.education && resume.education.filter((edu) => edu.enabled).length > 0 && (
            <section className={highlight("Education")} style={styles.sectionGap}>
              <h2 
                className="border-b-2 border-neutral-800 font-bold uppercase tracking-wider text-neutral-900"
                style={styles.sectionHeader}
              >
                EDUCATION
              </h2>
              <div style={{ marginTop: styles.entryGap.marginTop }}>
                {resume.education
                  .filter((edu) => edu.enabled)
                  .map((edu, idx) => (
                    <div 
                      key={edu.id} 
                      className="flex justify-between font-sans"
                      style={{ 
                        marginTop: idx > 0 ? styles.entryGap.marginTop : "0px" 
                      }}
                    >
                      <div style={styles.entryHeader}>
                        <strong className="text-neutral-900 font-bold" style={styles.entryCompany}>{edu.degree}</strong>
                        {edu.field && <span style={styles.entryMeta}> in {edu.field}</span>}
                        <div className="text-neutral-600" style={styles.entryMeta}>{edu.institution}</div>
                      </div>
                      <div className="text-right text-neutral-600 font-medium font-sans" style={styles.entryMeta}>
                        <div>{edu.startDate} &ndash; {edu.endDate}</div>
                        {edu.grade && <div className="italic text-neutral-500" style={{ fontSize: styles.entryMeta.fontSize }}>GPA: {edu.grade}</div>}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Skills */}
          {resume.skills && resume.skills.length > 0 && (
            <section className={highlight("Skills")} style={styles.sectionGap}>
              <h2 
                className="border-b-2 border-neutral-800 font-bold uppercase tracking-wider text-neutral-900"
                style={styles.sectionHeader}
              >
                SKILLS
              </h2>
              <div style={styles.skillsGap} className="font-sans">
                {resume.skills
                  .filter((cat) => cat.title && cat.items?.length > 0)
                  .map((category) => (
                    <div key={category.id} style={styles.skillsItem}>
                      <strong className="text-neutral-900">{category.title}:</strong>{" "}
                      <span className="text-neutral-700">{category.items.join(", ")}</span>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Achievements */}
          {resume.achievements && resume.achievements.filter((ach) => ach.enabled).length > 0 && (
            <section className={highlight("Achievements")} style={styles.sectionGap}>
              <h2 
                className="border-b-2 border-neutral-800 font-bold uppercase tracking-wider text-neutral-900"
                style={styles.sectionHeader}
              >
                ACHIEVEMENTS
              </h2>
              <ul className="list-disc font-sans" style={styles.achievementsList}>
                {resume.achievements
                  .filter((achievement) => achievement.enabled)
                  .map((achievement) => (
                    <li key={achievement.id} style={styles.achievementsItem}>
                      <strong className="text-neutral-950 font-semibold">{achievement.title}</strong>
                      {achievement.description && <span> &mdash; {achievement.description}</span>}
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {/* Certifications */}
          {resume.certifications && resume.certifications.filter((c) => c.enabled).length > 0 && (
            <section className={highlight("Certifications")} style={styles.sectionGap}>
              <h2 
                className="border-b-2 border-neutral-800 font-bold uppercase tracking-wider text-neutral-900"
                style={styles.sectionHeader}
              >
                CERTIFICATIONS
              </h2>
              <div className="flex font-sans" style={styles.certificationsContainer}>
                <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: styles.certificationsContainer.gap }}>
                  {resume.certifications
                    .filter((c) => c.enabled)
                    .filter((_, idx) => idx % 2 === 0)
                    .map((c) => (
                      <div key={c.id} className="flex justify-between text-neutral-700" style={styles.certificationsItem}>
                        <div>
                          <strong className="text-neutral-900">{c.title}</strong> &mdash; {c.issuer}
                          {c.credentialId && <span className="text-neutral-500 font-mono ml-2" style={{ fontSize: `calc(${styles.certificationsItem.fontSize} - 1pt)` }}>({c.credentialId})</span>}
                        </div>
                        <div className="text-neutral-600 font-medium ml-2">{c.date}</div>
                      </div>
                    ))}
                </div>
                <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: styles.certificationsContainer.gap }}>
                  {resume.certifications
                    .filter((c) => c.enabled)
                    .filter((_, idx) => idx % 2 === 1)
                    .map((c) => (
                      <div key={c.id} className="flex justify-between text-neutral-700" style={styles.certificationsItem}>
                        <div>
                          <strong className="text-neutral-900">{c.title}</strong> &mdash; {c.issuer}
                          {c.credentialId && <span className="text-neutral-500 font-mono ml-2" style={{ fontSize: `calc(${styles.certificationsItem.fontSize} - 1pt)` }}>({c.credentialId})</span>}
                        </div>
                        <div className="text-neutral-600 font-medium ml-2">{c.date}</div>
                      </div>
                    ))}
                </div>
              </div>
            </section>
          )}

          {/* Languages */}
          {resume.languages && resume.languages.filter((l) => l.enabled && (l.name || l.proficiency)).length > 0 && (
            <section className={highlight("Languages")} style={styles.sectionGap}>
              <h2 
                className="border-b-2 border-neutral-800 font-bold uppercase tracking-wider text-neutral-900"
                style={styles.sectionHeader}
              >
                LANGUAGES
              </h2>
              <div className="flex flex-wrap font-sans" style={styles.languagesContainer}>
                {resume.languages
                  .filter((lang) => lang.enabled && (lang.name || lang.proficiency))
                  .map((lang) => (
                    <div key={lang.id} style={styles.languagesItem}>
                      {lang.name && <strong className="text-neutral-900">{lang.name}</strong>}
                      {lang.name && lang.proficiency && <span>: </span>}
                      {lang.proficiency && <span className="italic text-neutral-600">{lang.proficiency}</span>}
                    </div>
                  ))}
              </div>
            </section>
          )}

        </div>

      </div>
    </article>
  );
}
