import { Resume } from "@/types/resume";

export const mockResume: Resume = {
  id: "resume-001",

  profile: {
    fullName: "John Doe",

    title: "Software Engineer",

    email: "john@example.com",

    phone: "+1 (555) 123-4567",

    location: "San Francisco, CA",

    links: [
      {
        label: "LinkedIn",
        url: "linkedin.com/in/johndoe",
      },
      {
        label: "GitHub",
        url: "github.com/johndoe",
      },
      {
        label: "Portfolio",
        url: "johndoe.dev",
      },
    ],
  },

  summary: {
    id: "summary",

    enabled: true,

    text:
      "Software Engineer with 5+ years of experience building scalable web applications, cloud-native systems, and delightful user experiences.",
  },

  experience: [
    {
      id: "exp-google",

      enabled: true,

      company: "Google",

      role: "Software Engineer",

      location: "Mountain View, CA",

      startDate: "Jan 2023",

      endDate: "",

      currentlyWorking: true,

      bullets: [
        "Developed internal dashboards used by 300+ employees.",
        "Reduced reporting latency by 42%.",
        "Led migration of legacy APIs to modern infrastructure.",
        "Collaborated with cross-functional teams across three continents.",
      ],
    },

    {
      id: "exp-amazon",

      enabled: true,

      company: "Amazon",

      role: "Software Development Engineer",

      location: "Seattle, WA",

      startDate: "Jul 2020",

      endDate: "Dec 2022",

      currentlyWorking: false,

      bullets: [
        "Designed backend services handling millions of requests daily.",
        "Improved deployment reliability using CI/CD pipelines.",
      ],
    },
  ],

  education: [
    {
      id: "edu-stanford",

      enabled: true,

      institution: "Stanford University",

      degree: "Bachelor of Science",

      field: "Computer Science",

      grade: "3.91 GPA",

      startDate: "2016",

      endDate: "2020",
    },
  ],

  skills: [
    {
      id: "lang",

      title: "Programming Languages",

      items: [
        "Python",
        "Java",
        "TypeScript",
        "SQL",
      ],
    },

    {
      id: "frameworks",

      title: "Frameworks",

      items: [
        "React",
        "Next.js",
        "Node.js",
        "FastAPI",
      ],
    },

    {
      id: "tools",

      title: "Tools",

      items: [
        "Git",
        "Docker",
        "AWS",
        "PostgreSQL",
      ],
    },
  ],

  projects: [
    {
      id: "resumeforge",

      enabled: true,

      title: "ResumeForge",

      link: "https://resumeforge.dev",

      technologies: [
        "Next.js",
        "FastAPI",
        "Tailwind CSS",
      ],

      bullets: [
        "Built an AI-powered resume builder.",
        "Implemented real-time resume preview.",
        "Added ATS optimization pipeline.",
      ],
    },
  ],

  achievements: [
    {
      id: "hackathon",

      enabled: true,

      title: "Winner - National Hackathon",

      description:
        "Won first place among 250+ teams for building an AI productivity platform.",
    },
  ],

  certifications: [
    {
      id: "aws",

      enabled: true,

      title: "AWS Certified Cloud Practitioner",

      issuer: "Amazon Web Services",

      date: "2024",
    },
  ],

  languages: [],

  customSections: [],
};