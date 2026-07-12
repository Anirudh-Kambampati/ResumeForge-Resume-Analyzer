# ResumeForge

### Build better resumes. Understand how they are evaluated. Match them against real jobs.

ResumeForge is a full-stack resume builder and analysis platform designed to help students, graduates, and job seekers create ATS-friendly resumes, evaluate resume quality, and understand how well their experience aligns with a target job description.

Instead of relying on a single opaque AI-generated score, ResumeForge combines deterministic resume analysis, AI-powered qualitative review, and job-description matching to provide a more structured view of resume quality.

The platform also includes a live visual resume builder with text-preserving PDF export, allowing users to create resumes that remain selectable, extractable, and readable by resume parsing systems.

---

## Why ResumeForge?

Most resume tools fall into one of two categories:

- resume builders that focus primarily on visual templates
- AI analyzers that return an unexplained score and generic suggestions

ResumeForge was built to explore a different approach.

A resume should be evaluated from multiple perspectives:

1. **Can a machine reliably parse the resume?**
2. **Does the resume follow strong structural and ATS-oriented practices?**
3. **How strong is the actual content and professional positioning?**
4. **How closely does the resume align with a specific job description?**

ResumeForge separates these concerns instead of compressing everything into a single AI-generated number.

---

## Core Features

### Visual Resume Builder

Build and edit a professional resume through a structured visual editor.

The builder supports sections including:

- Profile
- Professional Summary
- Experience
- Education
- Projects
- Skills
- Achievements
- Certifications
- Languages

Changes are reflected in the resume preview as the user edits their information.

Resume data is managed through a centralized Zustand store and persisted locally for a smoother editing experience.

---

### Live Resume Preview

ResumeForge provides a live resume preview while editing.

The browser preview and PDF export consume the same resume data while maintaining independent rendering implementations.

This architecture allows the web interface to remain responsive while the PDF renderer focuses specifically on A4 layout and text preservation.

```text
Current Resume State
        |
        +----------------------+
        |                      |
        v                      v
  HTML Resume Preview    PDF Resume Renderer
     ResumePage          ResumePDFDocument
```

---

### Text-Preserving PDF Export

ResumeForge generates resumes using `@react-pdf/renderer`.

Unlike screenshot-based or canvas-based PDF generation, visible resume content is rendered as actual PDF text.

This means generated resumes remain:

- selectable
- copyable
- extractable
- machine-readable
- compatible with text-based resume analysis pipelines

The export pipeline uses dedicated PDF primitives such as:

- `Document`
- `Page`
- `View`
- `Text`
- `Link`
- `StyleSheet`

The resume is generated as an A4 document with a compact, ATS-oriented layout.

Contact links are normalized before being passed to the PDF renderer so that LinkedIn and GitHub links use absolute web URLs and email addresses use valid `mailto:` targets.

---

## Resume Analyzer

The ResumeForge analyzer accepts a text-based PDF resume and optionally a job description.

Two analysis modes are supported.

### General Resume Analysis

When no job description is provided, ResumeForge evaluates the resume using:

- Deterministic Rule Score
- AI Review Score
- rule category breakdowns
- score-gap analysis
- strengths
- weaknesses
- prioritized suggestions
- safe bullet improvement suggestions

### Job Match Analysis

When a meaningful job description is provided, ResumeForge additionally performs job alignment analysis.

The result may include:

- Job Match Score
- job match breakdown
- matched keywords and skills
- missing keywords and skills
- job-specific suggestions
- interview focus areas

The job description is optional.

---

## Hybrid Scoring Architecture

ResumeForge deliberately separates deterministic scoring from AI review.

```text
                    Resume PDF
                         |
                         v
                 Text Extraction
                         |
              +----------+----------+
              |                     |
              v                     v
    Deterministic Scoring       AI Review
              |                     |
              v                     v
       Rule-Based Score       AI Review Score
              |                     |
              +----------+----------+
                         |
                         v
                 Score Gap Insight
```

If a job description is supplied:

```text
                Job Description
                       |
                       v
              AI Requirement Extraction
                       |
                       v
             Requirement Normalization
                       |
                       v
          Deterministic Matching Engine
                       |
                       v
                Job Match Score
```

The AI does not directly generate the numeric deterministic rule score or the final deterministic job-match score.

---

## Deterministic Rule Score

The Deterministic Rule Score evaluates ATS-oriented and structural resume characteristics through reproducible Python rules.

The scoring engine first parses the extracted resume text into typed evidence.

Recognized resume sections include:

- Professional Summary
- Experience
- Projects
- Education
- Skills
- Achievements
- Certifications
- Languages

The rule engine evaluates categories such as:

### Machine Readability

Checks whether the PDF produced sufficiently clean and meaningful extracted text.

Signals include:

- extracted character count
- recognizable word count
- replacement characters
- control character corruption
- meaningful character ratio

### Standard ATS Structure

Evaluates whether standard resume sections can be recognized and separated into clear boundaries.

### Contact Parseability

Looks for common candidate header signals including:

- candidate name
- email address
- phone number
- location
- professional profile URLs

### Section Recognition

Checks for populated standard resume sections and a recognizable experience or project pathway.

### Date Consistency

Detects date patterns and evaluates formatting consistency across the resume.

### Layout Safety Signals

Looks for extraction patterns that may indicate unsafe or fragmented document layouts.

### Skills Extractability

Parses the skills section, normalizes skill names, and checks for duplicate skill entries.

### Content Structure

Examines experience and project bullet segmentation.

### Keyword Hygiene

Detects disproportionately repeated technical terms and possible keyword stuffing patterns.

Each category returns:

```text
score
maximum score
evidence
reason
```

This makes deterministic analysis inspectable instead of returning only a final number.

---

## AI Review Score

The AI Review Score evaluates resume qualities that are difficult to measure using fixed parsing rules alone.

The AI reviewer may consider:

- clarity
- professional positioning
- content strength
- demonstrated impact
- technical communication
- overall resume effectiveness

The AI receives the deterministic score as context but does not replace or modify it.

This allows ResumeForge to distinguish between:

> A resume that is structurally ATS-friendly

and

> A resume that communicates strong professional value

Those are related, but they are not the same thing.

---

## Score Gap Analysis

ResumeForge compares the Deterministic Rule Score and AI Review Score.

The difference between the scores can reveal useful patterns.

For example:

- a high deterministic score with a lower AI review may indicate strong structure but weaker professional impact
- a stronger AI review with a lower deterministic score may indicate good content with ATS readability or completeness issues
- similar scores may indicate broadly consistent structural and qualitative resume quality

The analyzer surfaces this difference through a score-gap insight.

---

## Job Description Matching Engine

When a job description is provided, ResumeForge switches to job-match analysis mode.

The AI is used to understand the job description and extract structured requirements.

These may include:

```json
{
  "target_title": "AI Engineer",
  "required_skills": [],
  "preferred_skills": [],
  "domain_keywords": [],
  "responsibilities": []
}
```

The extracted requirements are then processed by deterministic matching logic.

The matching engine evaluates signals such as:

- target title alignment
- required skill coverage
- preferred skill coverage
- job terminology alignment
- responsibility alignment
- project and experience relevance
- keyword coverage hygiene

The final Job Match Score is calculated by deterministic Python code.

AI assists with understanding the job description.

AI does not directly decide the final numeric match score.

---

## Skill Normalization

ResumeForge includes a centralized skill normalization layer.

Different representations of the same technology can be mapped to a canonical skill.

Examples include:

```text
JS              -> javascript
TS              -> typescript
React.js        -> react
Next.js         -> nextjs
Node.js         -> nodejs
Fast API        -> fastapi
Postgres        -> postgresql
Mongo           -> mongodb
ML              -> machine learning
LLM             -> large language models
RAG             -> retrieval augmented generation
sklearn         -> scikit-learn
```

This improves consistency when comparing resume content with job requirements.

---

## AI-Assisted Resume Improvements

ResumeForge includes contextual AI improvement actions inside the resume builder.

Supported improvement types include:

- professional summaries
- experience bullets
- project bullets
- achievements

The AI is instructed to improve wording while preserving the candidate's original claims.

ResumeForge applies additional validation to generated improvements.

The backend checks for unsupported numeric claims and technologies that were not present in the supplied evidence.

If an AI-generated improvement introduces unsupported claims, the result can be rejected or retried.

The goal is to improve communication without quietly inventing experience.

---

## AI Safety and Claim Validation

Generative resume tools can easily introduce fabricated metrics such as:

```text
Improved performance by 40%
Increased efficiency by 60%
Served 10,000 users
Reduced latency by 35%
```

These numbers may sound impressive while having no basis in the candidate's actual experience.

ResumeForge includes claim validation logic to reduce this risk.

Generated resume improvements are checked against the original text and supplied context.

The validation pipeline checks for:

- unsupported numeric claims
- unsupported measurable results
- technologies absent from the supplied evidence

Unsafe generated improvements can be rejected.

ResumeForge is designed to improve wording, not manufacture achievements.

---

## Privacy-Oriented Processing

Resume PDFs are processed in memory by the analysis API.

The analyzer extracts text from the uploaded PDF and uses the extracted content during the active analysis request.

ResumeForge does not require users to create an account to build a resume.

Builder state is designed around client-side resume editing and local persistence.

> ResumeForge is a portfolio and educational project. Users should review deployment configuration and third-party AI provider policies before processing sensitive personal information.

---

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Zustand
- Framer Motion
- Lucide React
- React Icons
- `@react-pdf/renderer`

### Backend

- Python
- FastAPI
- Uvicorn
- Pydantic
- PyPDF
- HTTPX
- python-dotenv

### AI

- OpenRouter API
- configurable OpenRouter model
- structured JSON AI responses
- AI resume review
- job requirement extraction
- contextual resume rewriting

---

## Project Architecture

```text
ResumeForge-Resume-Analyzer/
|
+-- frontend/
|   |
|   +-- app/
|   |   +-- analyzer/
|   |   +-- builder/
|   |
|   +-- components/
|   |   +-- builder/
|   |   |   +-- editor/
|   |   |   +-- preview/
|   |   |
|   |   +-- landing/
|   |
|   +-- lib/
|   |
|   +-- store/
|
+-- backend/
|   |
|   +-- main.py
|   |
|   +-- services/
|   |   +-- scoring_service.py
|   |   +-- jd_service.py
|   |
|   +-- tests/
|
+-- README.md
```

---

## Backend API

### Health Check

```http
GET /api/health
```

Returns backend health information and AI provider configuration status.

---

### Analyze Resume

```http
POST /api/analyze
```

Accepts multipart form data.

#### Required

```text
resume: PDF file
```

#### Optional

```text
job_description: string
```

Without a job description, the analyzer runs in general analysis mode.

With a meaningful job description, the analyzer runs in job-match mode.

A simplified response structure looks like:

```json
{
  "analysis_mode": "job_match",
  "scores": {
    "deterministic_rule_score": 85,
    "ai_review_score": 78,
    "job_match_score": 72
  },
  "score_gap_insight": "...",
  "rule_breakdown": {},
  "job_match_breakdown": {},
  "matched_keywords": [],
  "missing_keywords": [],
  "summary": "...",
  "strengths": [],
  "weaknesses": [],
  "suggestions": [],
  "improved_bullets": [],
  "interview_focus": []
}
```

---

### Improve Resume Text

```http
POST /api/improve
```

Supports contextual resume text improvement.

Supported request types include:

```text
summary
bullet
project_bullet
experience_bullet
achievement
```

Example request:

```json
{
  "type": "experience_bullet",
  "text": "Built a resume analyzer using FastAPI",
  "context": "Software engineering project"
}
```

Generated improvements are validated before being returned.

---

## Getting Started

### Prerequisites

Install:

- Node.js
- npm
- Python 3
- Git

An OpenRouter API key is required for AI-powered analysis and improvement features.

---

## Clone the Repository

```bash
git clone <repository-url>
cd ResumeForge-Resume-Analyzer
```

---

## Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create a virtual environment:

### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

### macOS / Linux

```bash
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file inside the `backend` directory:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=your_preferred_model
```

Start the FastAPI server:

```bash
uvicorn main:app --reload
```

The backend runs locally on port `8000` by default.

---

## Frontend Setup

Open another terminal and navigate to the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

The frontend runs locally on port `3000` by default.

---

## Available Frontend Commands

```bash
npm run dev
```

Starts the Next.js development server.

```bash
npm run build
```

Creates a production build.

```bash
npm run start
```

Starts the production Next.js server.

```bash
npm run lint
```

Runs ESLint.

---

## Typical User Flow

```text
Open ResumeForge
        |
        +--> Build Resume
        |       |
        |       +--> Edit structured resume sections
        |       +--> Preview changes
        |       +--> Improve selected content with AI
        |       +--> Download text-preserving PDF
        |
        +--> Analyze Resume
                |
                +--> Upload PDF
                |
                +--> Optional Job Description
                |
                +--> Deterministic Rule Scoring
                +--> AI Review
                |
                +--> If JD exists
                |       |
                |       +--> Extract job requirements
                |       +--> Normalize requirements
                |       +--> Run matching engine
                |
                +--> Display scores and feedback
```

---

## Design Decisions

### Why use deterministic scoring?

AI-generated numeric scores are difficult to reproduce.

The same resume may receive different scores across prompts, models, or requests.

Deterministic scoring provides a stable baseline for structural and ATS-oriented checks.

### Why still use AI?

Resume quality cannot be fully reduced to regular expressions and keyword counts.

Professional positioning, clarity, communication quality, and content strength require more contextual evaluation.

ResumeForge uses AI where semantic reasoning is useful.

### Why separate the scores?

Because ATS structure and content quality measure different things.

A beautifully written resume may still have parsing problems.

A perfectly structured resume may still communicate weak impact.

Displaying separate scores makes that distinction visible.

### Why use AI for JD extraction but deterministic matching?

Job descriptions are unstructured natural language.

AI is useful for converting that language into structured requirements.

Once requirements are structured, deterministic matching provides a more reproducible numeric result.

### Why generate PDFs separately from the HTML preview?

Browser HTML and PDF layout engines behave differently.

Trying to directly print the browser preview can introduce pagination, extraction, and font issues.

ResumeForge shares resume data between the preview and PDF renderer while allowing each renderer to handle its own layout.

---

## Current Limitations

ResumeForge is actively evolving.

Current limitations include:

- PDF resume uploads only
- scanned or image-only PDFs cannot be reliably analyzed
- AI features depend on the configured OpenRouter model and provider availability
- job requirement extraction quality may vary with the configured model
- deterministic scoring focuses on ATS-oriented signals and is not a simulation of every commercial ATS
- resume analysis does not guarantee interviews or hiring outcomes

---

## Roadmap

Potential future improvements include:

- additional resume templates
- DOCX resume support
- expanded skill alias normalization
- richer job requirement parsing
- improved semantic responsibility matching
- configurable resume section ordering
- enhanced PDF layout controls
- automated scoring regression tests
- analysis history
- side-by-side resume comparison
- deployment and observability improvements

---

## Testing

Backend scoring and matching logic can be validated through the backend test suite.

Run tests from the backend environment using the project's configured Python test workflow.

The deterministic scoring layer is intentionally separated from AI review so that structural scoring behavior can be tested independently of model responses.

---

## Disclaimer

ResumeForge provides resume analysis and improvement guidance.

Scores are internal evaluation signals designed to help identify potential structural, content, and job-alignment issues.

ResumeForge does not represent or reproduce the proprietary scoring logic of any specific Applicant Tracking System and does not guarantee interview selection or employment outcomes.

Users should review all AI-assisted resume changes before using them in a job application.

---

## Author

**Anirudh Kambampati**

Computer Science undergraduate interested in AI engineering, full-stack development, and building practical developer-focused products.

---

## Project Status

**Active Development**

ResumeForge is currently being improved and prepared for deployment.

Feedback, issues, and contributions are welcome.

---

If you found ResumeForge useful or interesting, consider starring the repository.

Built with a questionable amount of debugging and a very reasonable amount of FastAPI.
