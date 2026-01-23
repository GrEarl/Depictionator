"use client";

import { useState } from "react";

type CopyCitationButtonProps = {
  text: string;
  className?: string;
  label?: string;
  copiedLabel?: string;
};

export function CopyCitationButton({
  text,
  className,
  label = "Copy Citation",
  copiedLabel = "Copied"
}: CopyCitationButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy citation", error);
    }
  };

  return (
    <button type="button" className={className} onClick={handleCopy}>
      {copied ? copiedLabel : label}
    </button>
  );
}
