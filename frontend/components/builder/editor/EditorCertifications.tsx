"use client";

import { useState } from "react";
import { Resume, Certification } from "@/types/resume";
import { Plus, Trash, ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  resume: Resume;
  setResume: (resume: Resume) => void;
};

export default function EditorCertifications({ resume, setResume }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const updateCertifications = (certifications: Certification[]) => {
    setResume({
      ...resume,
      certifications,
    });
  };

  const addCertification = () => {
    const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cert-${Date.now()}`;
    const newCert: Certification = {
      id: newId,
      enabled: true,
      title: "",
      issuer: "",
      date: "",
      credentialId: "",
    };
    updateCertifications([...resume.certifications, newCert]);
    setExpandedId(newId);
  };

  const removeCertification = (id: string) => {
    updateCertifications(resume.certifications.filter((cert) => cert.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const updateField = (id: string, field: keyof Certification, value: any) => {
    const updated = resume.certifications.map((cert) => {
      if (cert.id === id) {
        return { ...cert, [field]: value };
      }
      return cert;
    });
    updateCertifications(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Certifications</h2>
          <p className="mt-1 text-sm text-zinc-500">
            List professional licenses, certificates, and credentials.
          </p>
        </div>
        <button
          onClick={addCertification}
          className="
            flex
            items-center
            gap-1.5
            rounded-xl
            bg-blue-600
            px-4
            py-2
            text-sm
            font-medium
            text-white
            transition
            hover:bg-blue-500
          "
        >
          <Plus size={16} />
          Add Certification
        </button>
      </div>

      <div className="space-y-4">
        {resume.certifications ? (
          resume.certifications.map((cert) => {
            const isExpanded = expandedId === cert.id;
            return (
              <div
                key={cert.id}
                className="
                  rounded-xl
                  border
                  border-white/10
                  bg-[#141416]/40
                  overflow-hidden
                  transition-all
                  duration-200
                "
              >
                {/* Accordion Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : cert.id)}
                  className="
                    flex
                    items-center
                    justify-between
                    p-4
                    cursor-pointer
                    hover:bg-white/5
                    transition
                  "
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={cert.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateField(cert.id, "enabled", e.target.checked);
                      }}
                      className="
                        h-4
                        w-4
                        rounded
                        border-white/10
                        bg-[#0C0C0E]
                        text-blue-600
                        focus:ring-blue-500
                      "
                    />
                    <div>
                      <h3 className="font-semibold text-white">
                        {cert.title || "Untitled Certification"}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        {cert.issuer || "No Issuer"} &bull; {cert.date || "Date"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCertification(cert.id);
                      }}
                      className="
                        p-1.5
                        rounded-lg
                        text-zinc-500
                        hover:text-red-500
                        hover:bg-white/5
                        transition
                      "
                    >
                      <Trash size={16} />
                    </button>
                    {isExpanded ? <ChevronUp size={18} className="text-zinc-400" /> : <ChevronDown size={18} className="text-zinc-400" />}
                  </div>
                </div>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="border-t border-white/10 p-5 space-y-4 bg-black/20">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-400">Certification Title</label>
                        <input
                          type="text"
                          value={cert.title}
                          onChange={(e) => updateField(cert.id, "title", e.target.value)}
                          placeholder="e.g. AWS Certified Solutions Architect"
                          className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-400">Issuer</label>
                        <input
                          type="text"
                          value={cert.issuer}
                          onChange={(e) => updateField(cert.id, "issuer", e.target.value)}
                          placeholder="e.g. Amazon Web Services"
                          className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-400">Date Issued</label>
                        <input
                          type="text"
                          value={cert.date}
                          onChange={(e) => updateField(cert.id, "date", e.target.value)}
                          placeholder="e.g. 2024"
                          className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-400">Credential ID (Optional)</label>
                        <input
                          type="text"
                          value={cert.credentialId || ""}
                          onChange={(e) => updateField(cert.id, "credentialId", e.target.value)}
                          placeholder="e.g. AWS-12345"
                          className="w-full rounded-lg border border-white/10 bg-[#0C0C0E] px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-zinc-500 italic">No certifications listed.</p>
        )}
      </div>
    </div>
  );
}
