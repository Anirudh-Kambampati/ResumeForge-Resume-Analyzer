"use client";

import { X } from "lucide-react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  onClear?: () => void;
};

export default function ClearableInput({
  value,
  onChange,
  onClear,
  className = "",
  ...props
}: Props) {
  const hasValue = typeof value === "string" && value.trim().length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={onChange}
        className={`w-full rounded-lg border border-white/10 bg-[#0C0C0E] py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
          hasValue ? "pr-8 px-3" : "px-3"
        } ${className}`}
        {...props}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear"
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
          <X size={14} />
        </button>
      )}
    </div>
  );
}
