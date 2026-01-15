"use client";

import { useEffect, useState } from "react";
import { MarkdownView } from "@/components/MarkdownView";

type MarkdownEditorProps = {
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
};

export function MarkdownEditor({
  name,
  label,
  defaultValue = "",
  rows = 8,
  placeholder
}: MarkdownEditorProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  return (
    <div className="markdown-editor">
      <div className="markdown-editor-input">
        <label>
          {label}
          <textarea
            name={name}
            rows={rows}
            value={value}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
      </div>
      <div className="panel markdown-preview">
        <div className="muted" style={{ fontSize: "12px" }}>Preview</div>
        <MarkdownView value={value || "_(empty)_" } />
      </div>
    </div>
  );
}
