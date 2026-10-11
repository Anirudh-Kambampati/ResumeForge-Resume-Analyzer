<div align="center">

# 🔥 ResumeForge

### Forge resumes that get noticed.

**An AI-powered resume builder and analyzer designed to help job seekers create ATS-friendly, recruiter-ready resumes with a beautiful editing experience.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python)]
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)]
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-38BDF8?style=for-the-badge&logo=tailwindcss)]

</div>

---

## ✨ Overview

ResumeForge is an end-to-end resume platform that combines an intuitive visual resume builder with a powerful AI-assisted analyzer.

Whether you're a student applying for internships, a software engineer targeting FAANG, or an experienced professional, ResumeForge helps you create polished, ATS-friendly resumes while providing actionable feedback to improve your chances of landing interviews.

---

# 🚀 Features

### 📝 Visual Resume Builder

- Live resume preview
- Multiple professional templates
- Real-time editing
- ATS-friendly layouts
- Automatic pagination
- Export as PDF
- Import an existing resume (PDF or DOCX) — parsed deterministically, then reviewed by AI before it fills the builder
- Reorder entries within every section

---

### 🤖 Resume Analyzer

- ATS compatibility score
- AI-powered resume feedback
- Resume section analysis
- Keyword optimization
- Grammar & writing suggestions
- Actionable improvement tips
- Analyze directly from the builder and apply rewritten bullets in one click

---

### 🏢 ResumeForge for Businesses

- Screen a batch of resumes against one job description (`/business/screening`)
- Parallel queues — one per opening, all screening at once with fair scheduling
- AI extracts requirements once; recruiters review and edit them
- Deterministic, explainable 100-point match score for every candidate
- On-demand AI candidate briefs with gaps and interview questions
- CSV export; nothing stored server-side
- AI features run on your own key (BYOK); scoring is free

---

### 🔑 Bring Your Own Key

- Add an OpenAI, Anthropic, Google Gemini, Groq or OpenRouter key in the app
- Individuals: ResumeForge's free AI runs first; your key is used only when it's exhausted
- Businesses: AI features always use your key
- Key stays in your browser (opt-in "remember on this device"); the server forwards it per request and never stores or logs it

---

### 🎨 Modern UI

- Responsive design
- Smooth animations
- Clean dashboard
- Professional typography
- Light & Dark mode support
- Fast editing experience

---

### ⚡ Performance

- Fast PDF generation
- Optimized rendering
- Lightweight frontend
- Efficient backend APIs

---
# 🛠️ Tech Stack

## Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion
- React PDF

## Backend

- FastAPI
- Python
- Groq (free tier), with OpenRouter free models as fallback
- Pydantic

## AI

- Resume Analysis
- ATS Scoring
- Resume Feedback
- AI Suggestions

---

# 🚀 Getting Started

## Clone

```bash
git clone https://github.com/Anirudh-Kambampati/ResumeForge-Resume-Analyzer.git
```

```bash
cd ResumeForge-Resume-Analyzer
```

---

## Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload
```

Copy `backend/.env.example` to `backend/.env` and add a free [Groq API key](https://console.groq.com/keys) (`GROQ_API_KEY`) and/or an [OpenRouter key](https://openrouter.ai/keys) (`OPENROUTER_API_KEY`). Only free models are used.

---

## Run both together

After installing both parts, start the backend and frontend with one command from the repo root:

```bash
npm run dev:all
```

The app runs at http://localhost:3000 and the API at http://localhost:8000. Ctrl+C stops both.

---

# 📈 Roadmap

- [x] Resume Builder
- [x] Resume Analyzer
- [x] AI Feedback
- [x] ATS Scoring
- [x] Multiple Templates
- [x] Responsive Design
- [x] PDF Export
- [x] Builder Analyzer Sync
- [x] Importing Existing Resume

---

# 📄 License

This project is licensed under the MIT License.

---

<div align="center">

### ⭐ If you found this project useful, consider giving it a star!

**Built with ❤️ by Anirudh Kambampati**

</div>
