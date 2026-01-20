"use client";

import { useState } from "react";

type CopyState = "idle" | "copied" | "error";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<CopyState>("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        setState(ok ? "copied" : "error");
      } catch {
        setState("error");
      }
    }

    window.setTimeout(() => setState("idle"), 2000);
  };

  const labelText =
    state === "copied" ? "Copied!" : state === "error" ? "Copy failed" : label;

  return (
    <button
      onClick={handleCopy}
      className="px-4 py-2 bg-accent text-white font-bold rounded-lg hover:bg-accent-hover transition-colors"
      aria-live="polite"
    >
      {labelText}
    </button>
  );
}
