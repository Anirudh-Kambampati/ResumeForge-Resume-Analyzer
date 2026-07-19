# ResumeForge 📄✨

> Build better resumes. Understand why they work.

ResumeForge is a full-stack resume builder and analyzer that helps you create ATS-friendly resumes, evaluate resume quality, and compare your resume against real job descriptions.

Instead of throwing a mysterious AI score at you, ResumeForge combines **deterministic ATS analysis** with **AI-powered feedback** to provide meaningful, explainable insights.

---

## 🚀 Features

- 🎨 Visual Resume Builder
- 👀 Live Resume Preview
- 📄 Text-Preserving PDF Export
- 📊 Deterministic ATS Scoring
- 🤖 AI Resume Review
- 🎯 Job Description Matching
- ✨ AI-powered Bullet & Summary Improvements

---

## 🛠 Tech Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- Zustand
- Framer Motion

### Backend
- FastAPI
- Python
- PyPDF
- Pydantic

### AI
- OpenRouter API

---

## ⚡ Getting Started

Clone the repository

```bash
git clone <repository-url>
cd ResumeForge-Resume-Analyzer
```

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env`

```env
OPENROUTER_API_KEY=your_key
OPENROUTER_MODEL=your_model
```

Run the server

```bash
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create a `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 📂 Project Structure

```text
ResumeForge
├── frontend
├── backend
└── README.md
```

---

## 🧭 Future Improvements

- 📄 DOCX support
- 🤖 More AI-powered writing tools
- 💼 Smarter job-specific resume tailoring
- 🎯 AI-powered interview preparation
---

## ⚠️ Disclaimer

ResumeForge helps you improve your resume—it can't magically get you hired (we're still working on that feature 😉).

Always review AI-generated suggestions before submitting your applications.

---

## 👨‍💻 Author

**Anirudh Kambampati**

Computer Science student passionate about building practical full-stack applications with AI.

If you found this project useful, consider ⭐ starring the repository!
