"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LocaleSwitcher() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  async function setLocale(locale: string) {
    await fetch("/api/i18n/set", {
      method: "POST",
      body: new URLSearchParams({ locale })
    });
    router.refresh();
    setIsOpen(false);
  }

  return (
    <div className="locale-switcher">
      <button
        type="button"
        className="locale-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        Language
      </button>
      {isOpen && (
        <div className="locale-menu">
          <button type="button" onClick={() => setLocale("en")}>English</button>
          <button type="button" onClick={() => setLocale("ja")}>Japanese</button>
        </div>
      )}
    </div>
  );
}
