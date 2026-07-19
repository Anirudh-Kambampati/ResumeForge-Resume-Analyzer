export interface BaseSection {
  id: string;
  enabled: boolean;
}

// ============================================================
// Template and Layout types
// ============================================================

export type ResumeTemplate = "ats" | "faang" | "research";

export type ResumeLayoutName = "ats" | "faang" | "research" | "custom";

// ============================================================
// Resume — the single source of truth for all resume content
// Template, layout, and sectionOrder control presentation.
// ============================================================

export interface Resume {
  id: string;

  // Presentation configuration
  template: ResumeTemplate;
  layout: ResumeLayoutName;
  sectionOrder: string[];

  // Content
  profile: Profile;

  summary: Summary;

  experience: Experience[];

  education: Education[];

  skills: SkillCategory[];

  projects: Project[];

  achievements: Achievement[];

  certifications: Certification[];

  languages: Language[];

  research: Research[];

  publications: Publication[];

  customSections: CustomSection[];
}

export interface Profile {
  fullName: string;
  title: string;

  email: string;
  phone: string;
  location: string;

  links: ResumeLink[];
}

export interface ResumeLink {
  label: string;
  url: string;
}

export interface Summary extends BaseSection {
  text: string;
}

export interface Experience extends BaseSection {
  company: string;
  role: string;
  location: string;

  startDate: string;
  endDate: string;

  currentlyWorking: boolean;

  bullets: string[];
}

export interface Education extends BaseSection {
  institution: string;

  degree: string;

  field: string;

  grade: string;

  startDate: string;
  endDate: string;
}

export interface SkillCategory {
  id: string;

  title: string;

  items: string[];
}

export interface Project extends BaseSection {
  title: string;

  link?: string;

  technologies: string[];

  bullets: string[];
}

export interface Achievement extends BaseSection {
  title: string;

  description: string;
}

export interface Certification extends BaseSection {
  title: string;

  issuer: string;

  date: string;

  credentialId?: string;
}

export interface Language extends BaseSection {
  name: string;

  proficiency: string;
}

export interface Research extends BaseSection {
  title: string;
  institution: string;
  advisor: string;
  duration: string;
  link: string;
  keywords: string[];
  bullets: string[];
}

export interface Publication extends BaseSection {
  title: string;
  authors: string;
  venue: string;
  date: string;
  doi: string;
  keywords: string[];
  description: string;
}

export interface CustomSection extends BaseSection {
  title: string;

  items: string[];
}