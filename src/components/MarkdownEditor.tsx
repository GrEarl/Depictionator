"use client";

import { useEffect, useState } from "react";
import { MarkdownView } from "@/components/MarkdownView";
import { cn } from "@/lib/utils";

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
  rows = 15,
  placeholder
}: MarkdownEditorProps) {
  const [value, setValue] = useState(defaultValue);
  const [mode, setMode] = useState<"split" | "write" | "preview">("split");

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

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

      <div className={cn(
        "grid gap-4 transition-all duration-300 ease-in-out",
        mode === "split" ? "grid-cols-2" : "grid-cols-1"
      )}>
        {/* Hidden input for form submission */}
        <input type="hidden" name={name} value={value} />

        {(mode === "write" || mode === "split") && (
          <div className="relative">
            <textarea
              name={mode === 'write' ? name : undefined} // Avoid duplicate name attributes if split
              rows={rows}
              value={value}
              placeholder={placeholder}
              onChange={(event) => setValue(event.target.value)}
              className="w-full h-full p-4 rounded-xl bg-panel border border-border text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-sm placeholder:text-muted/50"
            />
            <div className="absolute bottom-3 right-4 text-[10px] text-muted opacity-50 pointer-events-none font-medium">
              Markdown Supported
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
              <MarkdownView value={value || "*(No content)*"} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}