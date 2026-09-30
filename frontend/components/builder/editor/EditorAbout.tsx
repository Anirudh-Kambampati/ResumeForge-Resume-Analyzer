"use client";

import { useState, useEffect } from "react";
import { Resume, ResumeLink } from "@/types/resume";
import {
  Plus,
  X,
  Link as LinkIcon,
  FileText,
  Sparkles,
  Check,
  AlertCircle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { normalizeError } from "@/lib/errorHelper";
import { apiPostJson } from "@/lib/api";
import { detectPlatform, extractUsername, normalizeUrl } from "@/lib/contactLinks";
import ClearableInput from "@/components/ui/ClearableInput";
import ClearableTextarea from "@/components/ui/ClearableTextarea";

type Props = {
  resume: Resume;
  setResume: (resume: Resume) => void;
};

const KNOWN_PLATFORMS = [
  { label: "GitHub", placeholder: "github.com/username" },
  { label: "LinkedIn", placeholder: "linkedin.com/in/username" },
  { label: "Portfolio", placeholder: "yourwebsite.dev" },
];

export default function EditorAbout({ resume, setResume }: Props) {
  const profile = resume.profile;
  const [showCustomLink, setShowCustomLink] = useState(false);
  const [customLinkLabel, setCustomLinkLabel] = useState("");

  // Split links into known platforms vs custom links
  const knownLabels = KNOWN_PLATFORMS.map((p) => p.label);

  // Per-field local raw input values — store whatever the user types,
  // without validation or normalization. This lets users freely clear a
  // field without it snapping back to the stored value.
  const [localLinkValues, setLocalLinkValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    const labels = KNOWN_PLATFORMS.map((p) => p.label);
    for (const label of labels) {
      const existing = profile.links?.find((l) => l.label === label);
      initial[label] = existing?.url || "";
    }
    return initial;
  });

  // On mount, extract usernames from any existing links that lack them
  useEffect(() => {
    const links = profile.links || [];
    let changed = false;
    const updated = links.map((link) => {
      if (!link.username && link.url) {
        const href = normalizeUrl(link.url);
        const platform = detectPlatform(href);
        const username = platform ? extractUsername(href, platform) : "";
        if (username) {
          changed = true;
          return { ...link, username };
        }
      }
      return link;
    });
    if (changed) {
      setLinks(updated);
    }
  }, []); // only run on mount

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

  function updateTitles(titles: string[]) {
    setResume({
      ...resume,
      profile: { ...profile, titles },
    });
  }

  function setLinks(links: ResumeLink[]) {
    setResume({
      ...resume,
      profile: { ...profile, links },
    });
  }

  const knownLinks = knownLabels.map((label) => {
    const existing = profile.links?.find((l) => l.label === label);
    return {
      label,
      url: existing?.url || "",
      username: existing?.username || "",
      platform: KNOWN_PLATFORMS.find((p) => p.label === label)!,
    };
  });
  const customLinks =
    profile.links?.filter((l) => !knownLabels.includes(l.label)) || [];

  function updateLink(label: string, url: string) {
    const others = (profile.links || []).filter((l) => l.label !== label);
    if (url.trim()) {
      // Store raw URL directly. No validation while typing.
      // Username extraction happens lazily in the preview rendering.
      const link: ResumeLink = { label, url: url.trim() };
      setLinks([...others, link]);
    } else {
      // Empty URL = remove the link entirely
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
      const data = await apiPostJson<{ improved_text: string }>("/api/improve", {
        type: "summary",
        text: summaryText,
      });
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

      <div className="space-y-4">
        <Field
          label="Full Name"
          value={profile.fullName || ""}
          onChange={(v) => updateProfile("fullName", v)}
          placeholder="John Doe"
          fullWidth
        />
        {/* Professional Titles */}
        <div className="space-y-3">
          <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Professional Titles
          </label>
          {profile.titles.length === 0 && (
            <p className="text-xs text-zinc-600">No titles added yet.</p>
          )}
          {profile.titles.map((title, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="flex flex-col items-center justify-center">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => {
                    const next = [...profile.titles];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    updateTitles(next);
                  }}
                  className="p-0.5 text-zinc-600 transition-colors hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed"
                  aria-label="Move title up"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  type="button"
                  disabled={idx === profile.titles.length - 1}
                  onClick={() => {
                    const next = [...profile.titles];
                    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                    updateTitles(next);
                  }}
                  className="p-0.5 text-zinc-600 transition-colors hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed"
                  aria-label="Move title down"
                >
                  <ChevronDown size={12} />
                </button>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    const next = [...profile.titles];
                    next[idx] = e.target.value;
                    updateTitles(next);
                  }}
                  placeholder="e.g. Software Engineer"
                  className="w-full rounded-lg border border-white/10 bg-card px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = profile.titles.filter((_, i) => i !== idx);
                  updateTitles(next);
                }}
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-red-400"
                aria-label={`Remove title: ${title}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              updateTitles([...profile.titles, ""]);
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <Plus size={12} />
            Add Title
          </button>
        </div>
        <Field
          label="Email"
          value={profile.email || ""}
          onChange={(v) => updateProfile("email", v)}
          placeholder="john@example.com"
          fullWidth
        />
        <Field
          label="Phone"
          value={profile.phone || ""}
          onChange={(v) => updateProfile("phone", v)}
          placeholder="+1 (555) 123-4567"
          fullWidth
        />
        <Field
          label="Location"
          value={profile.location || ""}
          onChange={(v) => updateProfile("location", v)}
          placeholder="San Francisco, CA"
          fullWidth
        />
      </div>

      {/* Links */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-300">Links</h3>
        </div>
        <div className="space-y-4">
          {knownLinks.map(({ label, url, platform }) => {
            const inputValue = localLinkValues[label] ?? url ?? "";
            const hasValue = inputValue.trim().length > 0;
            return (
              <div key={label} className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  {label}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocalLinkValues((prev) => ({ ...prev, [label]: val }));
                      updateLink(label, val);
                    }}
                    placeholder={platform.placeholder}
                    className={`w-full rounded-lg border border-white/10 bg-card py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                      hasValue ? "pr-8 px-3" : "px-3"
                    }`}
                  />
                  {hasValue && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocalLinkValues((prev) => ({ ...prev, [label]: "" }));
                        updateLink(label, "");
                      }}
                      aria-label="Clear link"
                      tabIndex={0}
                      className="
                        absolute right-1.5 top-1/2 -translate-y-1/2
                        flex items-center justify-center
                        w-5 h-5 rounded
                        text-zinc-500 hover:text-red-400
                        cursor-pointer
                        transition-colors
                      "
                    >
                      <span className="text-sm leading-none font-medium">&times;</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {customLinks.map((link) => {
          const hasValue = (link.url || "").trim().length > 0;
          return (
            <div key={link.label} className="flex items-center gap-2">
              <div className="flex-1 space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  {link.label}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={link.url || ""}
                    onChange={(e) => updateLink(link.label, e.target.value)}
                    placeholder="url..."
                    className={`w-full rounded-lg border border-white/10 bg-card py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                      hasValue ? "pr-8 px-3" : "px-3"
                    }`}
                  />
                  {hasValue && (
                    <button
                      type="button"
                      onClick={() => updateLink(link.label, "")}
                      aria-label="Clear link"
                      tabIndex={0}
                      className="
                        absolute right-1.5 top-1/2 -translate-y-1/2
                        flex items-center justify-center
                        w-5 h-5 rounded
                        text-zinc-500 hover:text-red-400
                        cursor-pointer
                        transition-colors
                      "
                    >
                      <span className="text-sm leading-none font-medium">&times;</span>
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeCustomLink(link.label)}
                className="mt-5 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}

        {showCustomLink ? (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <input
              type="text"
              value={customLinkLabel}
              onChange={(e) => setCustomLinkLabel(e.target.value)}
              placeholder="Platform name..."
              className="flex-1 rounded-lg border border-white/10 bg-card px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              onKeyDown={(e) => e.key === "Enter" && addCustomLink()}
            />
            <button
              onClick={addCustomLink}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-on-accent transition hover:bg-blue-500"
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
            <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:start-[1px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-paper"></div>
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
              <ClearableTextarea
                value={summaryText}
                onChange={(e) => updateSummary(e.target.value)}
                onClear={() => updateSummary("")}
                placeholder="e.g. Senior Software Engineer with 5+ years of experience..."
                rows={5}
                className="rounded-xl resize-y text-sm leading-relaxed px-4 py-3"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleImproveSummary}
                disabled={summaryLoading || !summaryText.trim()}
                className="flex items-center gap-2 rounded-xl bg-blue-600/10 border border-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400 transition hover:bg-blue-600 hover:text-on-accent disabled:opacity-40 disabled:hover:bg-blue-600/10 disabled:hover:text-blue-400"
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
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-on-accent transition hover:bg-blue-500"
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
  fullWidth,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  fullWidth?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      <ClearableInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClear={() => onChange("")}
        placeholder={placeholder}
      />
    </div>
  );
}
