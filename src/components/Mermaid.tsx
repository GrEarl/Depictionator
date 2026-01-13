"use client";

import { useEffect, useMemo, useState } from "react";
import mermaid from "mermaid";

let initialized = false;

export function Mermaid({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>("");
  const id = useMemo(
    () => `mermaid-${Math.random().toString(36).slice(2)}`,
    []
  );

  useEffect(() => {
    if (!initialized) {
      mermaid.initialize({ startOnLoad: false, theme: "default" });
      initialized = true;
    }
    let cancelled = false;
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setSvg("");
      });
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (!svg) {
    return (
      <pre className="code-block" aria-label="Mermaid error">
        {code}
      </pre>
    );
  }

  return (
    <div
      className="mermaid-block"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
