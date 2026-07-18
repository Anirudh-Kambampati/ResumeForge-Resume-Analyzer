"use client";

import { Resume } from "@/types/resume";
import { BuilderSection } from "@/store/resumeStore";
import { Inter } from "next/font/google";
import { normalizeEmail, normalizeUrl } from "@/lib/contactLinks";
import { getResumeDensity, getResumeLayout, type ResumeDensity } from "@/lib/resumeLayout";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type Props = {
  resume: Resume;
  selectedSection: BuilderSection;
};

// Re-export for other components that may import from here
export type { ResumeDensity };
export { getResumeDensity };

export default function ResumePage({
  resume,
  selectedSection,
}: Props) {
  const highlight = (section: BuilderSection) =>
    selectedSection === section
      ? "ring-2 ring-blue-500/40 rounded-sm transition-all duration-200 print:ring-0 print:outline-none"
      : "";

  const density = getResumeDensity(resume);
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

  const sectionHeading = (label: string) => (
    <h2
      className="border-b-2 border-neutral-800 uppercase tracking-wider text-neutral-900 font-bold"
      style={{
        fontSize: pt(L.sectionHeaderFontSize),
        borderBottomWidth: L.sectionHeaderBorderWidth,
        paddingBottom: pt(L.sectionHeaderPaddingBottom),
        marginBottom: pt(L.sectionHeaderMarginBottom),
      }}
    >
      {label}
    </h2>
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
      style={{
        padding: pt(L.pagePadding),
      }}
    >
      <div className="flex h-full flex-col text-left">

        {/* Header */}
        <header
          className={`text-center border-b border-neutral-300 ${highlight("Profile")}`}
          style={{ paddingBottom: pt(L.headerPaddingBottom) }}
        >
          <h1
            className="font-bold tracking-tight text-neutral-900 uppercase"
            style={{
              fontSize: pt(L.nameFontSize),
              lineHeight: String(L.nameLineHeight),
            }}
          >
            {profile.fullName || "Your Full Name"}
          </h1>
          <p
            className="font-semibold tracking-wider text-neutral-600 uppercase"
            style={{
              fontSize: pt(L.titleFontSize),
              marginTop: pt(L.titleMarginTop),
            }}
          >
            {profile.title || "Professional Title"}
          </p>

          {contactInfo.length > 0 && (
            <div
              className="flex flex-wrap justify-center items-center text-neutral-700 font-sans"
              style={{
                marginTop: pt(L.skillsMarginTop),
                fontSize: pt(L.contactFontSize),
                gap: cssPx(L.contactRowGap),
              }}
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

        <div className="text-neutral-800">

          {/* Professional Summary */}
          {resume.summary?.enabled && resume.summary.text?.trim() && (
            <section className={highlight("Summary")} style={{ marginTop: pt(L.sectionMarginTop) }}>
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

          {/* Experience */}
          {resume.experience && resume.experience.filter((job) => job.enabled).length > 0 && (
            <section className={highlight("Experience")} style={{ marginTop: pt(L.sectionMarginTop) }}>
              {sectionHeading("EXPERIENCE")}
              <div>
                {resume.experience
                  .filter((job) => job.enabled)
                  .map((job, idx) => (
                    <div
                      key={job.id}
                      style={{
                        marginTop: idx > 0 ? pt(L.entryGap) : "0px",
                      }}
                    >
                      <div
                        className="flex justify-between font-sans"
                        style={{
                          fontSize: pt(L.entryTitleFontSize),
                          lineHeight: String(L.entryTitleLineHeight),
                        }}
                      >
                        <div>
                          <strong className="text-neutral-900 font-semibold" style={{ fontSize: pt(L.entrySubtitleFontSize) }}>
                            {job.role}
                          </strong>
                          <span className="text-neutral-600" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                            {" "}&mdash;{" "}{job.company}
                          </span>
                        </div>
                        <div className="text-neutral-500 font-medium text-right" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                          {job.location && <span>{job.location} | </span>}
                          <span>
                            {job.startDate} &ndash;{" "}
                            {job.currentlyWorking ? "Present" : job.endDate}
                          </span>
                        </div>
                      </div>
                      {job.bullets && job.bullets.length > 0 && (
                        <ul
                          className="list-disc text-neutral-700 leading-normal"
                          style={{
                            marginTop: pt(L.bulletListMarginTop),
                            paddingLeft: pt(L.bulletListPaddingLeft),
                          }}
                        >
                          {job.bullets
                            .filter((b) => b.trim())
                            .map((bullet, bulletIdx) => (
                              <li
                                key={bulletIdx}
                                style={{
                                  fontSize: pt(L.bulletFontSize),
                                  lineHeight: String(L.bulletLineHeight),
                                  marginBottom: pt(L.bulletGap),
                                }}
                              >
                                {bullet}
                              </li>
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
            <section className={highlight("Education")} style={{ marginTop: pt(L.sectionMarginTop) }}>
              {sectionHeading("EDUCATION")}
              <div>
                {resume.education
                  .filter((edu) => edu.enabled)
                  .map((edu, idx) => (
                    <div
                      key={edu.id}
                      className="flex justify-between font-sans"
                      style={{
                        marginTop: idx > 0 ? pt(L.entryGap) : "0px",
                        fontSize: pt(L.entryTitleFontSize),
                        lineHeight: String(L.entryTitleLineHeight),
                      }}
                    >
                      <div>                          <strong className="text-neutral-900 font-semibold" style={{ fontSize: pt(L.entrySubtitleFontSize) }}>
                            {edu.degree}
                          </strong>
                        {edu.field && (
                          <span className="text-neutral-600" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                            {" "}in {edu.field}
                          </span>
                        )}
                        <div className="text-neutral-600" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                          {edu.institution}
                        </div>
                        {edu.grade && (
                          <div className="italic text-neutral-500" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                            GPA: {edu.grade}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-neutral-500 font-medium font-sans" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                        <div>{edu.startDate} &ndash; {edu.endDate}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Projects */}
          {resume.projects && resume.projects.filter((project) => project.enabled).length > 0 && (
            <section className={highlight("Projects")} style={{ marginTop: pt(L.sectionMarginTop) }}>
              {sectionHeading("PROJECTS")}
              <div>
                {resume.projects
                  .filter((project) => project.enabled)
                  .map((project, idx) => (
                    <div
                      key={project.id}
                      style={{
                        marginTop: idx > 0 ? pt(L.entryGap) : "0px",
                      }}
                    >
                      <div
                        className="flex justify-between font-sans"
                        style={{
                          fontSize: pt(L.entryTitleFontSize),
                          lineHeight: String(L.entryTitleLineHeight),
                        }}
                      >
                        <div>
                          <strong className="text-neutral-900 font-semibold" style={{ fontSize: pt(L.entrySubtitleFontSize) }}>
                            {project.title}
                          </strong>
                          {project.link && (
                            <span
                              className="text-neutral-500 ml-2 select-all font-mono"
                              style={{ fontSize: pt(L.entryMetaFontSize) }}
                            >
                              ({project.link})
                            </span>
                          )}
                        </div>
                        {project.technologies && project.technologies.length > 0 && (
                          <div className="text-neutral-500 italic font-medium" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                            {project.technologies.join(", ")}
                          </div>
                        )}
                      </div>
                      {project.bullets && project.bullets.length > 0 && (
                        <ul
                          className="list-disc text-neutral-700 leading-normal"
                          style={{
                            marginTop: pt(L.bulletListMarginTop),
                            paddingLeft: pt(L.bulletListPaddingLeft),
                          }}
                        >
                          {project.bullets
                            .filter((b) => b.trim())
                            .map((bullet, bulletIdx) => (
                              <li
                                key={bulletIdx}
                                style={{
                                  fontSize: pt(L.bulletFontSize),
                                  lineHeight: String(L.bulletLineHeight),
                                  marginBottom: pt(L.bulletGap),
                                }}
                              >
                                {bullet}
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Research */}
          {resume.research && resume.research.filter((r: any) => r.enabled).length > 0 && (
            <section className={highlight("Research")} style={{ marginTop: pt(L.sectionMarginTop) }}>
              {sectionHeading("RESEARCH")}
              <div>
                {resume.research
                  .filter((r: any) => r.enabled)
                  .map((item: any, idx: number) => (
                    <div
                      key={item.id}
                      style={{
                        marginTop: idx > 0 ? pt(L.entryGap) : "0px",
                      }}
                    >
                      <div
                        className="flex justify-between font-sans"
                        style={{
                          fontSize: pt(L.entryTitleFontSize),
                          lineHeight: String(L.entryTitleLineHeight),
                        }}
                      >
                        <div>
                          <strong className="text-neutral-900 font-semibold" style={{ fontSize: pt(L.entrySubtitleFontSize) }}>
                            {item.title}
                          </strong>
                          {item.institution && (
                            <span className="text-neutral-600" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                              {" "}&mdash;{" "}{item.institution}
                            </span>
                          )}
                          {item.advisor && (
                            <div className="text-neutral-500 italic" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                              Advisor: {item.advisor}
                            </div>
                          )}
                          {item.link && (
                            <span
                              className="text-neutral-500 ml-2 select-all font-mono"
                              style={{ fontSize: pt(L.entryMetaFontSize) }}
                            >
                              ({item.link})
                            </span>
                          )}
                        </div>
                        <div className="text-neutral-500 font-medium text-right" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                          {item.duration && <div>{item.duration}</div>}
                          {item.keywords?.length > 0 && (
                            <div className="italic">{item.keywords.join(", ")}</div>
                          )}
                        </div>
                      </div>
                      {item.bullets && item.bullets.filter(Boolean).length > 0 && (
                        <ul
                          className="list-disc text-neutral-700 leading-normal"
                          style={{
                            marginTop: pt(L.bulletListMarginTop),
                            paddingLeft: pt(L.bulletListPaddingLeft),
                          }}
                        >
                          {item.bullets
                            .filter((b: string) => b.trim())
                            .map((bullet: string, bulletIdx: number) => (
                              <li
                                key={bulletIdx}
                                style={{
                                  fontSize: pt(L.bulletFontSize),
                                  lineHeight: String(L.bulletLineHeight),
                                  marginBottom: pt(L.bulletGap),
                                }}
                              >
                                {bullet}
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Publications */}
          {resume.publications && resume.publications.filter((p: any) => p.enabled).length > 0 && (
            <section className={highlight("Publications")} style={{ marginTop: pt(L.sectionMarginTop) }}>
              {sectionHeading("PUBLICATIONS")}
              <div>
                {resume.publications
                  .filter((p: any) => p.enabled)
                  .map((item: any, idx: number) => (
                    <div
                      key={item.id}
                      style={{
                        marginTop: idx > 0 ? pt(L.entryGap) : "0px",
                      }}
                    >
                      <div
                        className="flex justify-between font-sans"
                        style={{
                          fontSize: pt(L.entryTitleFontSize),
                          lineHeight: String(L.entryTitleLineHeight),
                        }}
                      >
                        <div>
                          <strong className="text-neutral-900 font-semibold" style={{ fontSize: pt(L.entrySubtitleFontSize) }}>
                            {item.title}
                          </strong>
                          {item.authors && (
                            <div className="text-neutral-600" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                              {item.authors}
                            </div>
                          )}
                          <div className="text-neutral-600" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                            {item.venue}
                            {item.doi && (
                              <span className="text-neutral-500 ml-2 select-all font-mono" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                                ({item.doi})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-neutral-500 font-medium font-sans" style={{ fontSize: pt(L.entryMetaFontSize) }}>
                          {item.date && <div>{item.date}</div>}
                          {item.keywords?.length > 0 && (
                            <div className="italic">{item.keywords.join(", ")}</div>
                          )}
                        </div>
                      </div>
                      {item.description && (
                        <p
                          className="text-neutral-700 leading-normal mt-1"
                          style={{
                            fontSize: pt(L.bulletFontSize),
                            lineHeight: String(L.bulletLineHeight),
                          }}
                        >
                          {item.description}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Skills */}
          {resume.skills && resume.skills.length > 0 && (
            <section className={highlight("Skills")} style={{ marginTop: pt(L.sectionMarginTop) }}>
              {sectionHeading("SKILLS")}
              <div className="font-sans" style={{ marginTop: pt(L.skillsMarginTop) }}>
                {resume.skills
                  .filter((cat) => cat.title && cat.items?.length > 0)
                  .map((category) => (
                    <div
                      key={category.id}
                      style={{
                        fontSize: pt(L.skillsItemFontSize),
                        lineHeight: String(L.skillsItemLineHeight),
                        marginBottom: pt(L.skillsItemMarginBottom),
                      }}
                    >
                      <strong className="text-neutral-900 font-semibold">{category.title}:</strong>{" "}
                      <span className="text-neutral-700">{category.items.join(", ")}</span>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Achievements */}
          {resume.achievements && resume.achievements.filter((ach) => ach.enabled).length > 0 && (
            <section className={highlight("Achievements")} style={{ marginTop: pt(L.sectionMarginTop) }}>
              {sectionHeading("ACHIEVEMENTS")}
              <ul
                className="list-disc font-sans"
                style={{
                  marginTop: pt(L.achievementsListMarginTop),
                  paddingLeft: pt(L.achievementsPaddingLeft),
                }}
              >
                {resume.achievements
                  .filter((achievement) => achievement.enabled)
                  .map((achievement) => (
                    <li
                      key={achievement.id}
                      style={{
                        fontSize: pt(L.achievementsItemFontSize),
                        lineHeight: String(L.achievementsItemLineHeight),
                        marginBottom: pt(L.achievementsItemMarginBottom),
                      }}
                    >
                      <span className="text-neutral-950">{achievement.title}</span>
                      {achievement.description && <span> &mdash; {achievement.description}</span>}
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {/* Certifications */}
          {resume.certifications && resume.certifications.filter((c) => c.enabled).length > 0 && (
            <section className={highlight("Certifications")} style={{ marginTop: pt(L.sectionMarginTop) }}>
              {sectionHeading("CERTIFICATIONS")}
              <div
                className="flex font-sans"
                style={{ marginTop: pt(L.certificationsMarginTop) }}
              >
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: pt(L.certificationsGap),
                  }}
                >
                  {resume.certifications
                    .filter((c) => c.enabled)
                    .filter((_, idx) => idx % 2 === 0)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="flex justify-between text-neutral-700"
                        style={{
                          fontSize: pt(L.certificationsItemFontSize),
                          lineHeight: String(L.certificationsItemLineHeight),
                        }}
                      >
                        <div>
                          <strong className="text-neutral-900">{c.title}</strong> &mdash; {c.issuer}
                          {c.credentialId && (
                            <span
                              className="text-neutral-500 font-mono ml-2"
                              style={{ fontSize: pt(L.certificationsItemFontSize - 1) }}
                            >
                              ({c.credentialId})
                            </span>
                          )}
                        </div>
                        <div className="text-neutral-500 font-medium ml-2 whitespace-nowrap">{c.date}</div>
                      </div>
                    ))}
                </div>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: pt(L.certificationsGap),
                  }}
                >
                  {resume.certifications
                    .filter((c) => c.enabled)
                    .filter((_, idx) => idx % 2 === 1)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="flex justify-between text-neutral-700"
                        style={{
                          fontSize: pt(L.certificationsItemFontSize),
                          lineHeight: String(L.certificationsItemLineHeight),
                        }}
                      >
                        <div>
                          <strong className="text-neutral-900">{c.title}</strong> &mdash; {c.issuer}
                          {c.credentialId && (
                            <span
                              className="text-neutral-500 font-mono ml-2"
                              style={{ fontSize: pt(L.certificationsItemFontSize - 1) }}
                            >
                              ({c.credentialId})
                            </span>
                          )}
                        </div>
                        <div className="text-neutral-500 font-medium ml-2 whitespace-nowrap">{c.date}</div>
                      </div>
                    ))}
                </div>
              </div>
            </section>
          )}

          {/* Languages */}
          {resume.languages && resume.languages.filter((l) => l.enabled && (l.name || l.proficiency)).length > 0 && (
            <section className={highlight("Languages")} style={{ marginTop: pt(L.sectionMarginTop) }}>
              {sectionHeading("LANGUAGES")}
              <div
                className="flex flex-wrap font-sans"
                style={{
                  marginTop: pt(L.languagesMarginTop),
                  gap: cssPx(L.languagesGap),
                }}
              >
                {resume.languages
                  .filter((lang) => lang.enabled && (lang.name || lang.proficiency))
                  .map((lang) => (
                    <div
                      key={lang.id}
                      style={{
                        fontSize: pt(L.languagesItemFontSize),
                        lineHeight: String(L.languagesItemLineHeight),
                      }}
                    >
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
