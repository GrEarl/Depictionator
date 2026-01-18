"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MarkdownView } from "@/components/MarkdownView";
import { cn } from "@/lib/utils";
import { wikiTextToMarkdown } from "@/lib/wikitext";

type MarkdownEditorProps = {
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
  defaultMode?: "split" | "write" | "preview";
  defaultSyntax?: "markdown" | "wikitext";
  showToolbar?: boolean;
};

export function MarkdownEditor({
  name,
  label,
  defaultValue = "",
  rows = 15,
  placeholder,
  defaultMode = "split",
  defaultSyntax = "markdown",
  showToolbar = true
}: MarkdownEditorProps) {
  const [value, setValue] = useState(defaultValue);
  const [mode, setMode] = useState<"split" | "write" | "preview">(defaultMode);
  const [syntax, setSyntax] = useState<"markdown" | "wikitext">(defaultSyntax);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const normalizedValue = useMemo(() => {
    if (syntax !== "wikitext") return value;
    return wikiTextToMarkdown(value).markdown;
  }, [syntax, value]);

  const previewValue = normalizedValue;

  const withSelection = (updater: (args: { start: number; end: number; selected: string }) => { next: string; cursorStart: number; cursorEnd: number }) => {
    const target = textareaRef.current;
    const start = target?.selectionStart ?? value.length;
    const end = target?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const { next, cursorStart, cursorEnd } = updater({ start, end, selected });
    setValue(next);
    requestAnimationFrame(() => {
      if (!target) return;
      target.focus();
      target.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const wrapSelection = (prefix: string, suffix: string, placeholderText: string) => {
    withSelection(({ start, end, selected }) => {
      const inner = selected || placeholderText;
      const next = value.slice(0, start) + prefix + inner + suffix + value.slice(end);
      const cursorStart = start + prefix.length;
      const cursorEnd = cursorStart + inner.length;
      return { next, cursorStart, cursorEnd };
    });
  };

  const insertText = (text: string) => {
    withSelection(({ start, end }) => {
      const next = value.slice(0, start) + text + value.slice(end);
      const cursor = start + text.length;
      return { next, cursorStart: cursor, cursorEnd: cursor };
    });
  };

  const handleHeading = () => {
    const heading = window.prompt("Heading text", "Heading");
    if (!heading) return;
    if (syntax === "wikitext") {
      insertText(`\n== ${heading} ==\n\n`);
    } else {
      insertText(`\n## ${heading}\n\n`);
    }
  };

  const handleExternalLink = () => {
    const url = window.prompt("URL", "https://");
    if (!url) return;
    const text = window.prompt("Display text", url) || url;
    if (syntax === "wikitext") {
      insertText(`[${url} ${text}]`);
    } else {
      insertText(`[${text}](${url})`);
    }
  };

  const handleArticleLink = () => {
    const title = window.prompt("Article title", "");
    if (!title) return;
    if (syntax === "wikitext") {
      insertText(`[[${title}]]`);
    } else {
      insertText(`[${title}](/articles?q=${encodeURIComponent(title)})`);
    }
  };

  const handleImageInsert = () => {
    const source = window.prompt("Image URL or file name (e.g., File:example.jpg)", "");
    if (!source) return;
    const caption = window.prompt("Caption / alt text", "") || "Image";
    const isUrl = /^https?:\/\//i.test(source.trim());
    if (syntax === "wikitext" && !isUrl) {
      const normalized = source.startsWith("File:") ? source : `File:${source}`;
      insertText(`[[${normalized}|thumb|${caption}]]`);
    } else {
      insertText(`![${caption}](${source})`);
    }
  };

  return (
    <div className="flex flex-col gap-3 group">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-widest text-muted group-focus-within:text-accent transition-colors">
          {label}
        </label>
        
        <div className="flex items-center p-1 bg-bg border border-border rounded-lg shadow-sm">
          {(["write", "split", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                mode === m 
                  ? "bg-panel text-ink shadow-sm border border-border/50" 
                  : "text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {showToolbar && (
        <div className="editor-toolbar">
          <div className="editor-toolbar-group">
            <button type="button" onClick={handleHeading}>H2</button>
            <button type="button" onClick={() => wrapSelection(syntax === "wikitext" ? "'''" : "**", syntax === "wikitext" ? "'''" : "**", "bold text")}>Bold</button>
            <button type="button" onClick={() => wrapSelection(syntax === "wikitext" ? "''" : "*", syntax === "wikitext" ? "''" : "*", "italic text")}>Italic</button>
          </div>
          <div className="editor-toolbar-group">
            <button type="button" onClick={handleExternalLink}>Link</button>
            <button type="button" onClick={handleArticleLink}>Article</button>
            <button type="button" onClick={handleImageInsert}>Image</button>
          </div>
          <div className="editor-toolbar-group">
            <button type="button" onClick={() => insertText(syntax === "wikitext" ? "\n* Item\n* Item\n" : "\n- Item\n- Item\n")}>List</button>
            <button type="button" onClick={() => insertText(syntax === "wikitext" ? "\n> Quote\n" : "\n> Quote\n")}>Quote</button>
          </div>
          <div className="editor-toolbar-group editor-syntax-toggle">
            {(["markdown", "wikitext"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={cn("editor-toggle", syntax === s && "active")}
                onClick={() => setSyntax(s)}
              >
                {s === "markdown" ? "Markdown" : "Wiki"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={cn(
        "grid gap-4 transition-all duration-300 ease-in-out",
        mode === "split" ? "grid-cols-2" : "grid-cols-1"
      )}>
        {/* Hidden input for form submission */}
        <input type="hidden" name={name} value={normalizedValue} />

        {(mode === "write" || mode === "split") && (
          <div className="relative">
            <textarea
              ref={textareaRef}
              rows={rows}
              value={value}
              placeholder={placeholder}
              onChange={(event) => setValue(event.target.value)}
              className="w-full h-full p-4 rounded-xl bg-panel border border-border text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-sm placeholder:text-muted/50"
            />
            <div className="absolute bottom-3 right-4 text-[10px] text-muted opacity-50 pointer-events-none font-medium">
              {syntax === "wikitext" ? "Wiki Syntax Enabled" : "Markdown Enabled"}
            </div>
          </div>
        )}

        {(mode === "preview" || mode === "split") && (
          <div className={cn(
            "rounded-xl border border-border/50 bg-bg/50 p-6 overflow-y-auto",
            mode === "split" ? "max-h-[600px]" : "min-h-[300px]"
          )}>
            {mode === "preview" && (
              <div className="text-[10px] font-bold uppercase text-muted tracking-widest mb-4 border-b border-border pb-2">
                Preview Mode
              </div>
            )}
            <div className="prose dark:prose-invert prose-sm max-w-none">
              <MarkdownView value={previewValue || "*(No content)*"} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
