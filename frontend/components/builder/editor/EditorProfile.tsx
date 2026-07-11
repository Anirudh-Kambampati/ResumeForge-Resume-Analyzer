"use client";

import { useState } from "react";
import { Resume } from "@/types/resume";
import { Plus, Trash, Link2 } from "lucide-react";

type Props = {
  resume: Resume;
  setResume: (resume: Resume) => void;
};

export default function EditorProfile({
  resume,
  setResume,
}: Props) {
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const updateProfile = (
    field: keyof Resume["profile"],
    value: any
  ) => {
    setResume({
      ...resume,
      profile: {
        ...resume.profile,
        [field]: value,
      },
    });
  };

  const addLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return;
    const updatedLinks = [
      ...resume.profile.links,
      { label: newLinkLabel.trim(), url: newLinkUrl.trim() },
    ];
    updateProfile("links", updatedLinks);
    setNewLinkLabel("");
    setNewLinkUrl("");
  };

  const removeLink = (index: number) => {
    const updatedLinks = resume.profile.links.filter((_, i) => i !== index);
    updateProfile("links", updatedLinks);
  };

  const updateLink = (index: number, field: "label" | "url", value: string) => {
    const updatedLinks = resume.profile.links.map((link, i) => {
      if (i === index) {
        return { ...link, [field]: value };
      }
      return link;
    });
    updateProfile("links", updatedLinks);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white">
          Profile
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          This information appears at the top of your resume.
        </p>
      </div>

      <div className="grid gap-5">
        <Input
          label="Full Name"
          value={resume.profile.fullName}
          onChange={(v) => updateProfile("fullName", v)}
        />

        <Input
          label="Professional Title"
          value={resume.profile.title}
          onChange={(v) => updateProfile("title", v)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Email"
            value={resume.profile.email}
            onChange={(v) => updateProfile("email", v)}
          />
          <Input
            label="Phone"
            value={resume.profile.phone}
            onChange={(v) => updateProfile("phone", v)}
          />
        </div>

        <Input
          label="Location"
          value={resume.profile.location}
          onChange={(v) => updateProfile("location", v)}
        />
      </div>

      {/* Links Section */}
      <div className="border-t border-white/10 pt-6">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <Link2 size={18} className="text-blue-500" />
          Links & Socials
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Add links to LinkedIn, GitHub, Portfolio, or your personal website.
        </p>

        {/* Existing Links */}
        <div className="mt-4 space-y-3">
          {resume.profile.links.map((link, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-[#141416] p-3 rounded-xl border border-white/5">
              <input
                type="text"
                placeholder="Label"
                value={link.label}
                onChange={(e) => updateLink(idx, "label", e.target.value)}
                className="w-1/3 bg-[#0C0C0E] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
              />
              <input
                type="text"
                placeholder="URL"
                value={link.url}
                onChange={(e) => updateLink(idx, "url", e.target.value)}
                className="flex-1 bg-[#0C0C0E] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
              />
              <button
                onClick={() => removeLink(idx)}
                className="p-2 text-zinc-500 hover:text-red-500 hover:bg-white/5 rounded-lg transition"
              >
                <Trash size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Add Link Form */}
        <div className="mt-4 flex items-center gap-3 bg-[#141416]/50 p-3 rounded-xl border border-dashed border-white/10">
          <input
            type="text"
            placeholder="Label (e.g., GitHub)"
            value={newLinkLabel}
            onChange={(e) => setNewLinkLabel(e.target.value)}
            className="w-1/3 bg-[#0C0C0E] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
          />
          <input
            type="text"
            placeholder="URL (e.g., github.com/username)"
            value={newLinkUrl}
            onChange={(e) => setNewLinkUrl(e.target.value)}
            className="flex-1 bg-[#0C0C0E] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
          />
          <button
            onClick={addLink}
            disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
            className="flex items-center justify-center p-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition disabled:opacity-40 disabled:hover:bg-blue-600/20 disabled:hover:text-blue-400"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function Input({
  label,
  value,
  onChange,
}: InputProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-300">
        {label}
      </label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full
          rounded-xl
          border
          border-white/10
          bg-[#141416]
          px-4
          py-3
          text-white
          outline-none
          transition
          focus:border-blue-500
          focus:ring-2
          focus:ring-blue-500/20
        "
      />
    </div>
  );
}