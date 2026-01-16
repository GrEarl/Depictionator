"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UiLocale } from "@/lib/locale";

type LocaleLabels = {
  label: string;
  english: string;
  japanese: string;
};

export function LocaleSwitcher({
  locale,
  workspaceId,
  labels
}: {
  locale: UiLocale;
  workspaceId?: string | null;
  labels: LocaleLabels;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState<UiLocale>(locale);

  useEffect(() => {
    setCurrentLocale(locale);
  }, [locale]);

  async function setLocale(nextLocale: UiLocale) {
    const params = new URLSearchParams({ locale: nextLocale });
    if (workspaceId) params.set("workspaceId", workspaceId);

    const res = await fetch("/api/i18n/set", {
      method: "POST",
      body: params
    });

    if (res.ok) {
      setCurrentLocale(nextLocale);
      router.refresh();
    }
    setIsOpen(false);
  }

  return (
    <div className="locale-switcher">
      <button
        type="button"
        className="locale-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {labels.label}: {currentLocale.toUpperCase()}
      </button>
      {isOpen && (
        <div className="locale-menu" role="menu">
          <button type="button" onClick={() => setLocale("en")} role="menuitem">
            {labels.english}
          </button>
          <button type="button" onClick={() => setLocale("ja")} role="menuitem">
            {labels.japanese}
          </button>
        </div>
      )}
    </div>
  );
}
