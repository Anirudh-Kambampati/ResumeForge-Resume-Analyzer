"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  ArrowLeft,
  Info
} from "lucide-react";
import { normalizeError } from "@/lib/errorHelper";

interface Suggestion {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

interface AnalysisScores {
  deterministic_rule_score: number;
  ai_review_score: number;
  job_match_score: number | null;
}

interface BreakdownItem {
  score: number;
  max_score: number;
  evidence: any;
}

interface AnalysisData {
  analysis_mode: "general" | "job_match";
  scores: AnalysisScores;
  score_gap_insight: string;
  rule_breakdown: Record<string, BreakdownItem>;
  job_match_breakdown?: Record<string, BreakdownItem>;
  matched_keywords: string[];
  missing_keywords: string[];
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: Suggestion[];
  improved_bullets: ImprovedBullet[];
  interview_focus: string[];
}

export default function AnalyzerPage() {
  // Input states
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisData | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF resume files are supported.");
      setFile(null);
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("Resume file size must be less than 5MB.");
      setFile(null);
      return;
    }
    setFile(selectedFile);
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("resume", file);
    if (jobDescription.trim()) {
      formData.append("job_description", jobDescription.trim());
    }

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiBase}/api/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Analysis failed with status ${response.status}.`;
        if (errorText) {
          try {
            const errorData: unknown = JSON.parse(errorText);
            errorMessage = normalizeError(errorData);
          } catch {
            errorMessage = errorText;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setResult(data);
    } catch (e: unknown) {
      console.error(e);
      let errMsg = "An unexpected error occurred during analysis.";
      if (e instanceof Error) {
        if (e.name === "TypeError" && (e.message.toLowerCase().includes("fetch") || e.message.toLowerCase().includes("network"))) {
          errMsg = "Could not connect to the ResumeForge analysis server. Make sure the backend is running.";
        } else {
          errMsg = e.message;
        }
      } else {
        errMsg = normalizeError(e);
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setJobDescription("");
    setResult(null);
    setError(null);
  };

  return (
    <main id="analyzer-workspace" className="min-h-screen bg-[#09090B] text-zinc-100 pb-20">
      
      {/* Header Bar */}
      <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#09090B]/80 backdrop-blur px-8 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 -ml-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Resume Analyzer</h2>
            <p className="text-xs text-zinc-500">Scan compliance against job details</p>
          </div>
        </div>
        <Link
          href="/builder"
          className="
            flex
            items-center
            gap-1.5
            rounded-xl
            border
            border-white/10
            bg-white/[0.03]
            px-4
            py-2
            text-sm
            font-medium
            transition
            hover:bg-white/[0.06]
          "
        >
          Resume Builder
          <ArrowRight size={14} />
        </Link>
      </header>

      {/* Main Workspace Container */}
      <div className="max-w-6xl mx-auto px-6 mt-8">
        
        {/* Upload Form view */}
        {!result && (
          <div className="grid md:grid-cols-2 gap-8 items-start">
            
            {/* Left side inputs */}
            <div className="space-y-6">
              
              {/* File Upload Block */}
              <div className="bg-[#0C0C0E] border border-white/10 rounded-2xl p-6">
                <h3 className="text-md font-semibold text-white mb-4">1. Upload Resume PDF</h3>
                
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    border-2
                    border-dashed
                    rounded-xl
                    p-8
                    text-center
                    cursor-pointer
                    transition-all
                    duration-200
                    flex
                    flex-col
                    items-center
                    justify-center
                    gap-3
                    ${
                      isDragActive
                        ? "border-blue-500 bg-blue-500/5"
                        : "border-white/10 hover:border-blue-500/50 hover:bg-white/[0.01]"
                    }
                  `}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf"
                    className="hidden"
                  />
                  <Upload size={32} className={file ? "text-blue-500" : "text-zinc-500"} />
                  {file ? (
                    <div>
                      <p className="text-sm font-semibold text-white">{file.name}</p>
                      <p className="text-xs text-zinc-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-zinc-300">Drag and drop resume here, or click to browse</p>
                      <p className="text-xs text-zinc-600 mt-1">Supports PDF (Max 5MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Job Description Block */}
              <div className="bg-[#0C0C0E] border border-white/10 rounded-2xl p-6">
                <h3 className="text-md font-semibold text-white mb-4">2. Paste Job Description</h3>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the target role description, key qualifications, responsibilities, or tech stack requirements here..."
                  rows={8}
                  className="
                    w-full
                    rounded-xl
                    border
                    border-white/10
                    bg-[#09090B]
                    px-4
                    py-3
                    text-sm
                    text-white
                    outline-none
                    transition
                    focus:border-blue-500
                    focus:ring-2
                    focus:ring-blue-500/20
                    resize-none
                  "
                />
                <div className="flex justify-between text-xs text-zinc-600 mt-2">
                  <span>Input keywords for best compliance checks</span>
                  <span>{jobDescription.length} characters</span>
                </div>
              </div>

              {/* Action Button */}
              <div>
                <button
                  onClick={handleAnalyze}
                  disabled={loading || !file}
                  className="
                    w-full
                    flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-blue-600
                    py-3.5
                    font-semibold
                    text-white
                    transition
                    hover:bg-blue-500
                    disabled:opacity-40
                    disabled:cursor-not-allowed
                    shadow-lg
                    shadow-blue-600/10
                  "
                >
                  {loading ? (
                    <>
                      <RefreshCw className="animate-spin" size={18} />
                      Analyzing compliance...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Analyze Resume
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-red-300">Analysis Error</p>
                    <p className="mt-1 text-xs text-red-400/80 leading-normal">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right side instruction panel */}
            <div className="rounded-2xl border border-white/10 bg-[#0C0C0E]/50 p-6 space-y-6">
              <h3 className="text-lg font-bold text-white">How it works</h3>
              <div className="space-y-4">
                <Step
                  num={1}
                  title="Upload Resume PDF"
                  desc="We extract selectable content page-by-page from your ATS-friendly resume file."
                />
                <Step
                  num={2}
                  title="Input target job description (optional)"
                  desc="Paste text listing tech stack requirements, engineering frameworks, and keywords."
                />
                <Step
                  num={3}
                  title="Run deterministic and AI-powered resume scoring, with job-description matching when a JD is provided."
                  desc="The AI-powered engine conducts semantic checks, computes scores, and outputs feedback."
                />
              </div>

              <div className="border-t border-white/10 pt-5 rounded-xl bg-blue-500/5 border border-blue-500/20 p-4 space-y-2">
                <h4 className="text-xs uppercase tracking-wider text-blue-300 font-bold flex items-center gap-1">
                  <Info size={12} />
                  Privacy Note
                </h4>
                <p className="text-xs text-zinc-400 leading-normal">
                  All analysis runs instantly. Your documents and inputs are processed in-memory and are never stored on cloud servers.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* Results view */}
        {result && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Top Score Banner */}
            <div className="grid md:grid-cols-[1fr_2fr] items-center gap-6 bg-[#0C0C0E] border border-white/10 rounded-2xl p-6">
              
              {/* Score displays */}
              <div className="flex flex-col gap-4 items-center justify-center border-r border-white/10 pr-6">
                
                <div className="text-center">
                  <div className="text-4xl font-extrabold text-white">
                    {result.scores.deterministic_rule_score} <span className="text-xl text-zinc-500">/ 100</span>
                  </div>
                  <span className="mt-1 text-xs uppercase tracking-wider font-semibold text-blue-500">
                    Deterministic Rule Score
                  </span>
                </div>
                
                <div className="w-full h-px bg-white/10 my-2"></div>
                
                <div className="text-center">
                  <div className="text-3xl font-extrabold text-white">
                    {result.scores.ai_review_score} <span className="text-lg text-zinc-500">/ 100</span>
                  </div>
                  <span className="mt-1 text-[10px] uppercase tracking-wider font-semibold text-purple-400">
                    AI Review Score
                  </span>
                </div>

                {result.analysis_mode === "job_match" && result.scores.job_match_score !== null && (
                  <>
                    <div className="w-full h-px bg-white/10 my-2"></div>
                    <div className="text-center">
                      <div className="text-3xl font-extrabold text-green-400">
                        {result.scores.job_match_score} <span className="text-lg text-green-400/50">/ 100</span>
                      </div>
                      <span className="mt-1 text-[10px] uppercase tracking-wider font-semibold text-green-500">
                        Job Match Score
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Summary details */}
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-bold text-white">Resume Analysis</h3>
                  <button
                    onClick={handleReset}
                    className="
                      flex
                      items-center
                      gap-1
                      rounded-lg
                      border
                      border-white/10
                      bg-white/[0.03]
                      px-3
                      py-1.5
                      text-xs
                      text-zinc-400
                      hover:text-white
                      hover:bg-white/[0.06]
                      transition
                    "
                  >
                    <RefreshCw size={12} />
                    Analyze Another
                  </button>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed font-sans">{result.summary}</p>
                <div className="grid gap-2 text-xs text-zinc-400 md:grid-cols-3">
                  <p><span className="text-blue-400">Deterministic Rule Score:</span> Calculated using fixed ATS-oriented structure, parseability, and machine-readability checks.</p>
                  <p><span className="text-purple-400">AI Review Score:</span> AI evaluation of clarity, impact, positioning, and overall resume content strength.</p>
                  {result.analysis_mode === "job_match" && <p><span className="text-green-400">Job Match Score:</span> Deterministic alignment between resume evidence and the supplied job description.</p>}
                </div>
                
                <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl">
                  <h4 className="text-xs uppercase tracking-wider text-blue-400 font-bold mb-2">
                    Score Gap Insight
                  </h4>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                    {result.score_gap_insight}
                  </p>
                </div>
                
                {/* Score indicators */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                  {Object.entries(result.rule_breakdown).map(([key, breakdown]) => (
                    <SectionScore 
                      key={key} 
                      label={RULE_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} 
                      score={breakdown.score} 
                      maxScore={breakdown.max_score} 
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Keyword Matching Grid */}
            {((result.matched_keywords && result.matched_keywords.length > 0) || 
              (result.missing_keywords && result.missing_keywords.length > 0)) && (
              <div className={`grid gap-6 ${
                (result.matched_keywords && result.matched_keywords.length > 0) && (result.missing_keywords && result.missing_keywords.length > 0)
                  ? "md:grid-cols-2"
                  : "grid-cols-1"
              }`}>
                
                {/* Matched Keywords */}
                {result.matched_keywords && result.matched_keywords.length > 0 && (
                  <div className="bg-[#0C0C0E] border border-white/10 rounded-2xl p-6 space-y-4">
                    <h4 className="text-sm font-bold text-green-400 flex items-center gap-1.5">
                      <CheckCircle2 size={16} />
                      Matched Keywords ({result.matched_keywords.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {result.matched_keywords.map((kw) => (
                        <span key={kw} className="bg-green-500/10 border border-green-500/20 text-green-400 px-2.5 py-1 rounded-lg text-xs font-semibold">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Keywords */}
                {result.missing_keywords && result.missing_keywords.length > 0 && (
                  <div className="bg-[#0C0C0E] border border-white/10 rounded-2xl p-6 space-y-4">
                    <h4 className="text-sm font-bold text-red-400 flex items-center gap-1.5">
                      <AlertTriangle size={16} />
                      Missing Job Keywords ({result.missing_keywords.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {result.missing_keywords.map((kw) => (
                        <span key={kw} className="bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-1 rounded-lg text-xs font-semibold">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* Strengths & Weaknesses */}
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Strengths list */}
              <div className="bg-[#0C0C0E] border border-white/10 rounded-2xl p-6 space-y-3">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Core Strengths</h4>
                <ul className="space-y-2 text-sm">
                  {result.strengths.map((str, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-zinc-300">
                      <span className="text-green-500 font-bold mt-0.5">&bull;</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Weaknesses list */}
              <div className="bg-[#0C0C0E] border border-white/10 rounded-2xl p-6 space-y-3">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Gaps & Weaknesses</h4>
                <ul className="space-y-2 text-sm">
                  {result.weaknesses.map((weak, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-zinc-300">
                      <span className="text-red-500 font-bold mt-0.5">&bull;</span>
                      <span>{weak}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* Suggestions & Action Plan */}
            <div className="bg-[#0C0C0E] border border-white/10 rounded-2xl p-6 space-y-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Priority Suggestions</h4>
              <div className="grid md:grid-cols-3 gap-4">
                {result.suggestions.map((sug, idx) => (
                  <div key={idx} className="bg-[#141416] border border-white/5 rounded-xl p-4 space-y-2 relative overflow-hidden">
                    <span
                      className={`
                        absolute top-0 right-0 px-2 py-0.5 text-[9px] uppercase tracking-wider font-semibold rounded-bl-lg
                        ${
                          sug.priority === "high"
                            ? "bg-red-500/20 text-red-400"
                            : sug.priority === "medium"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-blue-500/20 text-blue-400"
                        }
                      `}
                    >
                      {sug.priority}
                    </span>
                    <h5 className="text-sm font-bold text-white pr-10">{sug.title}</h5>
                    <p className="text-xs text-zinc-400 leading-relaxed pr-2 font-sans">{sug.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Bullet points improvements */}
            {result.improved_bullets && result.improved_bullets.length > 0 && (
              <div className="bg-[#0C0C0E] border border-white/10 rounded-2xl p-6 space-y-4">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Improved Bullet Recommendations</h4>
                <div className="space-y-3">
                  {result.improved_bullets.map((bullet, idx) => (
                    <div key={idx} className="grid md:grid-cols-2 gap-4 bg-[#141416]/50 p-4 rounded-xl border border-white/5">
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Original</span>
                        <p className="text-xs text-zinc-400 italic">"{bullet.original}"</p>
                      </div>
                      <div className="space-y-1 border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-4">
                        <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Sparkles size={10} /> Improved
                        </span>
                        <p className="text-xs text-zinc-200">"{bullet.improved}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interview focus suggestions */}
            {result.interview_focus && result.interview_focus.length > 0 && (
              <div className="bg-[#0C0C0E] border border-white/10 rounded-2xl p-6 space-y-3">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Technical Interview Focus</h4>
                <p className="text-xs text-zinc-500 font-sans">Prepare for these engineering topics based on requirements and gaps.</p>
                <ul className="space-y-2 text-sm mt-3">
                  {result.interview_focus.map((focus, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-zinc-300">
                      <Sparkles size={14} className="text-blue-500 shrink-0 mt-0.5" />
                      <span>{focus}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        )}

      </div>
    </main>
  );
}

// Helpers
function Step({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-500/20 text-sm font-bold shrink-0">
        {num}
      </div>
      <div>
        <h4 className="text-sm font-bold text-white">{title}</h4>
        <p className="text-xs text-zinc-400 mt-1 leading-normal font-sans">{desc}</p>
      </div>
    </div>
  );
}

function SectionScore({ label, score, maxScore }: { label: string; score: number; maxScore: number }) {
  const percentage = (score / maxScore) * 100;
  return (
    <div className="bg-[#141416] p-3 rounded-xl border border-white/5 flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-xs font-semibold">
        <span className="text-zinc-500">{label}</span>
        <span className="text-zinc-300">{score}/{maxScore}</span>
      </div>
      <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${
            percentage >= 80 ? "bg-green-500" : percentage >= 60 ? "bg-yellow-500" : "bg-red-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface ImprovedBullet {
  original: string;
  improved: string;
}

const RULE_LABELS: Record<string, string> = {
  machine_readability: "Machine Readability",
  standard_ats_structure: "Standard ATS Structure",
  contact_parseability: "Contact Parseability",
  section_recognition: "Section Recognition",
  date_consistency: "Date Consistency",
  layout_safety_signals: "Layout Safety Signals",
  skills_extractability: "Skills Extractability",
  content_structure: "Content Structure",
  keyword_hygiene: "Keyword Hygiene",
};

