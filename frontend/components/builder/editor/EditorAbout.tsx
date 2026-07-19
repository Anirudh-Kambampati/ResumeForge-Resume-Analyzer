"use client";

import { useState } from "react";
import { Resume, ResumeLink } from "@/types/resume";
import {
  Plus,
  X,
  Link as LinkIcon,
  FileText,
  Sparkles,
  Check,
  AlertCircle,
} from "lucide-react";
import { normalizeError } from "@/lib/errorHelper";

type Props = {
  resume: Resume;
  setResume: (resume: Resume) => void;
};

const KNOWN_PLATFORMS = [
  { label: "LinkedIn", placeholder: "linkedin.com/in/username" },
  { label: "GitHub", placeholder: "github.com/username" },
  { label: "Portfolio", placeholder: "yourwebsite.dev" },
  { label: "X (Twitter)", placeholder: "x.com/username" },
  { label: "LeetCode", placeholder: "leetcode.com/u/username" },
  { label: "Codeforces", placeholder: "codeforces.com/profile/username" },
  { label: "HackerRank", placeholder: "hackerrank.com/profile/username" },
];

export default function EditorAbout({ resume, setResume }: Props) {
  const profile = resume.profile;
  const [showCustomLink, setShowCustomLink] = useState(false);
  const [customLinkLabel, setCustomLinkLabel] = useState("");

  // Summary AI improve state
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summarySuggestion, setSummarySuggestion] = useState<string | null>(
    null
  );

  function updateProfile(field: string, value: string) {
    setResume({
      ...resume,
      profile: { ...profile, [field]: value },
    });
  }

  function setLinks(links: ResumeLink[]) {
    setResume({
      ...resume,
      profile: { ...profile, links },
    });
  }

  // Split links into known platforms vs custom links
  const knownLabels = KNOWN_PLATFORMS.map((p) => p.label);
  const knownLinks = knownLabels.map((label) => {
    const existing = profile.links?.find((l) => l.label === label);
    return {
      label,
      url: existing?.url || "",
      platform: KNOWN_PLATFORMS.find((p) => p.label === label)!,
    };
  });
  const customLinks =
    profile.links?.filter((l) => !knownLabels.includes(l.label)) || [];

  function updateLink(label: string, url: string) {
    const others = (profile.links || []).filter((l) => l.label !== label);
    if (url.trim()) {
      setLinks([...others, { label, url: url.trim() }]);
    } else {
      setLinks(others);
    }
  }

  function addCustomLink() {
    if (!customLinkLabel.trim()) return;
    setLinks([
      ...(profile.links || []),
      { label: customLinkLabel.trim(), url: "" },
    ]);
    setCustomLinkLabel("");
    setShowCustomLink(false);
  }

  function removeCustomLink(label: string) {
    setLinks((profile.links || []).filter((l) => l.label !== label));
  }

  // Summary handlers
  const summaryText = resume.summary?.text || "";

  function updateSummary(text: string) {
    setResume({
      ...resume,
      summary: { ...resume.summary, text },
    });
  }

  function toggleSummary(enabled: boolean) {
    setResume({
      ...resume,
      summary: { ...resume.summary, enabled },
    });
  }

  const handleImproveSummary = async () => {
    if (!summaryText.trim()) return;
    setSummaryLoading(true);
    setSummaryError(null);
    setSummarySuggestion(null);
    try {
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "summary", text: summaryText }),
      });
      if (!res.ok) {
        let errText = await res.text();
        try {
          const errJson = JSON.parse(errText);
          errText = normalizeError(errJson);
        } catch {}
        throw new Error(errText || "Failed to improve text");
      }
      const data = await res.json();
      setSummarySuggestion(data.improved_text);
    } catch (e: unknown) {
      console.error(e);
      setSummaryError(normalizeError(e));
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ============================
          Personal Information
      ============================ */}
      <div>
        <h2 className="text-2xl font-semibold text-white">Profile</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Your personal information appears at the top of the resume. These
          fields are always visible.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Full Name"
          value={profile.fullName || ""}
          onChange={(v) => updateProfile("fullName", v)}
          placeholder="John Doe"
          colSpan={2}
        />
        <Field
          label="Professional Title"
          value={profile.title || ""}
          onChange={(v) => updateProfile("title", v)}
          placeholder="Software Engineer"
          colSpan={2}
        />
        <Field
          label="Email"
          value={profile.email || ""}
          onChange={(v) => updateProfile("email", v)}
          placeholder="john@example.com"
        />
        <Field
          label="Phone"
          value={profile.phone || ""}
          onChange={(v) => updateProfile("phone", v)}
          placeholder="+1 (555) 123-4567"
        />
        <Field
          label="Location"
          value={profile.location || ""}
          onChange={(v) => updateProfile("location", v)}
          placeholder="San Francisco, CA"
          colSpan={2}
        />
      </div>

      {/* Links */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-300">Links</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {knownLinks.map(({ label, url, platform }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                {label}
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => updateLink(label, e.target.value)}
                placeholder={platform.placeholder}
                className="w-full rounded-lg border border-white/10 bg-[#141416] px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          ))}
        </div>

        {customLinks.map((link) => (
          <div key={link.label} className="flex items-center gap-2">
            <div className="flex-1 space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                {link.label}
              </label>
              <input
                type="text"
                value={link.url || ""}
                onChange={(e) => updateLink(link.label, e.target.value)}
                placeholder="url..."
                className="w-full rounded-lg border border-white/10 bg-[#141416] px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              onClick={() => removeCustomLink(link.label)}
              className="mt-5 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {showCustomLink ? (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <input
              type="text"
              value={customLinkLabel}
              onChange={(e) => setCustomLinkLabel(e.target.value)}
              placeholder="Platform name..."
              className="flex-1 rounded-lg border border-white/10 bg-[#141416] px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              onKeyDown={(e) => e.key === "Enter" && addCustomLink()}
            />
            <button
              onClick={addCustomLink}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-500"
            >
              Add
            </button>
            <button
              onClick={() => setShowCustomLink(false)}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCustomLink(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <Plus size={12} />
            Add custom link
          </button>
        )}
      </div>

      {/* ============================
          Professional Summary
      ============================ */}
      <div className="border-t border-white/[0.06] pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-zinc-500" />
            <h3 className="text-sm font-medium text-zinc-300">
              Professional Summary
            </h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={resume.summary?.enabled ?? true}
              onChange={(e) => toggleSummary(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:start-[1px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
            <span className="ml-2.5 text-xs font-medium text-zinc-500">
              {resume.summary?.enabled ? "On" : "Off"}
            </span>
          </label>
        </div>

        {resume.summary?.enabled && (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-xs text-zinc-500">
                  A brief professional summary highlighting your career.
                </span>
                <span className="text-xs text-zinc-600">
                  {summaryText.length} characters
                </span>
              </div>
              <textarea
                value={summaryText}
                onChange={(e) => updateSummary(e.target.value)}
                placeholder="e.g. Senior Software Engineer with 5+ years of experience..."
                rows={5}
                className="w-full rounded-xl border border-white/10 bg-[#141416] px-4 py-3 text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-y text-sm leading-relaxed"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleImproveSummary}
                disabled={summaryLoading || !summaryText.trim()}
                className="flex items-center gap-2 rounded-xl bg-blue-600/10 border border-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400 transition hover:bg-blue-600 hover:text-white disabled:opacity-40 disabled:hover:bg-blue-600/10 disabled:hover:text-blue-400"
              >
                <Sparkles size={14} />
                {summaryLoading ? "Improving..." : "Improve with AI"}
              </button>
            </div>

            {summaryError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">AI Improvement Error</p>
                  <p className="mt-1 text-xs text-red-400/80">
                    {summaryError}
                  </p>
                </div>
              </div>
            )}

            {summarySuggestion && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-blue-400 flex items-center gap-1.5">
                    <Sparkles size={14} />
                    AI Suggested Improvement
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        updateSummary(summarySuggestion);
                        setSummarySuggestion(null);
                      }}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
                    >
                      <Check size={12} />
                      Apply
                    </button>
                    <button
                      onClick={() => setSummarySuggestion(null)}
                      className="p-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed italic bg-black/30 p-3 rounded-lg border border-white/5">
                  &ldquo;{summarySuggestion}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

        <p className="mt-3 text-xs text-zinc-600">
          When enabled, the Professional Summary appears right after the header
          in both the preview and PDF. Disabling preserves your text.
        </p>
      </div>

      {/* Preview hint */}
      <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <LinkIcon size={12} />
          <span>
            Changes update the resume header and summary instantly — preview to
            the right.
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Small field component
// ============================================================

function Field({
  label,
  value,
  onChange,
  placeholder,
  colSpan,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  colSpan?: number;
}) {
  return (
    <div className={`space-y-1.5 ${colSpan === 2 ? "col-span-2" : ""}`}>
      <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-[#141416] px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );
}
