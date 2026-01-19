"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MarkdownView } from "@/components/MarkdownView";
import { cn } from "@/lib/utils";
import { wikiTextToMarkdown } from "@/lib/wikitext";

type MarkdownEditorProps = {
  name: string;
  label: string;
  workspaceId?: string;
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
  workspaceId,
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
  const [pickerMode, setPickerMode] = useState<"article" | "image" | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerCaption, setPickerCaption] = useState("");
  const [pickerResults, setPickerResults] = useState<any[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
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
    if (workspaceId) {
      setPickerMode("article");
      setPickerQuery("");
      setPickerResults([]);
      return;
    }
    const title = window.prompt("Article title", "");
    if (!title) return;
    if (syntax === "wikitext") {
      insertText(`[[${title}]]`);
    } else {
      const slug = title.replace(/ /g, "_");
      insertText(`[${title}](/wiki/${encodeURIComponent(slug)})`);
    }
  };

  const handleImageInsert = () => {
    if (workspaceId) {
      setPickerMode("image");
      setPickerQuery("");
      setPickerCaption("");
      setPickerResults([]);
      return;
    }
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

  const handleTemplateInsert = () => {
    const name = window.prompt("Template name", "");
    if (!name) return;
    insertText(`{{${name}}}`);
  };

  const handleCategoryInsert = () => {
    const name = window.prompt("Category name", "");
    if (!name) return;
    insertText(`[[Category:${name}]]`);
  };

  const handleRedirectInsert = () => {
    const target = window.prompt("Redirect target", "");
    if (!target) return;
    insertText(`#REDIRECT [[${target}]]\n`);
  };

  useEffect(() => {
    if (!pickerMode || !workspaceId) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setPickerLoading(true);
        const endpoint = pickerMode === "article" ? "/api/entities/search" : "/api/assets/search";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, query: pickerQuery.trim(), limit: 20 }),
          signal: controller.signal
        });
        const data = await response.json();
        if (!cancelled) {
          setPickerResults(Array.isArray(data.items) ? data.items : []);
        }
      } catch {
        if (!cancelled) setPickerResults([]);
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [pickerMode, pickerQuery, workspaceId]);

  const insertArticleFromPicker = (title: string) => {
    if (!title) return;
    if (syntax === "wikitext") {
      insertText(`[[${title}]]`);
    } else {
      const slug = title.replace(/ /g, "_");
      insertText(`[${title}](/wiki/${encodeURIComponent(slug)})`);
    }
    setPickerMode(null);
  };

  const insertImageFromPicker = (assetId: string) => {
    if (!assetId) return;
    const caption = pickerCaption.trim() || "Image";
    if (syntax === "wikitext") {
      insertText(`[[File:asset:${assetId}|thumb|${caption}]]`);
    } else {
      insertText(`![${caption}](/api/assets/file/${assetId})`);
    }
    setPickerMode(null);
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
          {syntax === "wikitext" && (
            <div className="editor-toolbar-group">
              <button type="button" onClick={handleTemplateInsert}>Template</button>
              <button type="button" onClick={handleCategoryInsert}>Category</button>
              <button type="button" onClick={handleRedirectInsert}>Redirect</button>
            </div>
          )}
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

      {pickerMode && (
        <div className="editor-picker">
          <div className="editor-picker-header">
            <div className="text-xs font-bold uppercase tracking-widest text-muted">
              Insert {pickerMode === "article" ? "Article" : "Image"}
            </div>
            <button type="button" className="btn-link" onClick={() => setPickerMode(null)}>
              Close
            </button>
          </div>
          <div className="editor-picker-controls">
            <input
              value={pickerQuery}
              onChange={(event) => setPickerQuery(event.target.value)}
              placeholder={pickerMode === "article" ? "Search articles..." : "Search images..."}
            />
            {pickerMode === "image" && (
              <input
                value={pickerCaption}
                onChange={(event) => setPickerCaption(event.target.value)}
                placeholder="Caption (optional)"
              />
            )}
          </div>
          <div className="editor-picker-results">
            {pickerLoading && <div className="muted text-xs">Loading…</div>}
            {!pickerLoading && pickerResults.length === 0 && (
              <div className="muted text-xs">No results.</div>
            )}
            {pickerMode === "article" && pickerResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className="editor-picker-item"
                onClick={() => insertArticleFromPicker(item.title)}
              >
                <div className="editor-picker-title">{item.title}</div>
                <div className="editor-picker-meta">{item.type}</div>
              </button>
            ))}
            {pickerMode === "image" && pickerResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className="editor-picker-item editor-picker-image"
                onClick={() => insertImageFromPicker(item.id)}
              >
                <img
                  src={`/api/assets/file/${item.id}`}
                  alt={item.storageKey ?? "Image"}
                  className="editor-picker-thumb"
                />
                <div>
                  <div className="editor-picker-title">{item.displayName ?? item.storageKey ?? "Image"}</div>
                  <div className="editor-picker-meta">{item.mimeType}</div>
                </div>
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
