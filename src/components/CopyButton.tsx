"use client";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text)}
      className="px-4 py-2 bg-accent text-white font-bold rounded-lg hover:bg-accent-hover transition-colors"
    >
      {label}
    </button>
  );
}
