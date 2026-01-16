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
  rows = 15,
  placeholder
}: MarkdownEditorProps) {
  const [value, setValue] = useState(defaultValue);
  const [mode, setMode] = useState<"split" | "write" | "preview">("split");

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  return (
    <div className="markdown-editor-container">
      <div className="editor-toolbar" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
        <label style={{ fontWeight: 600, fontSize: '14px' }}>{label}</label>
        <div className="view-toggles" style={{ display: 'flex', gap: '4px', background: '#eee', padding: '2px', borderRadius: '6px' }}>
          <button 
            type="button"
            onClick={() => setMode("write")}
            className={`toggle-btn ${mode === 'write' ? 'active' : ''}`}
            style={{ border: 'none', background: mode === 'write' ? 'white' : 'transparent', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', boxShadow: mode === 'write' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}
          >
            Write
          </button>
          <button 
            type="button"
            onClick={() => setMode("split")}
            className={`toggle-btn ${mode === 'split' ? 'active' : ''}`}
            style={{ border: 'none', background: mode === 'split' ? 'white' : 'transparent', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', boxShadow: mode === 'split' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}
          >
            Split
          </button>
          <button 
            type="button"
            onClick={() => setMode("preview")}
            className={`toggle-btn ${mode === 'preview' ? 'active' : ''}`}
            style={{ border: 'none', background: mode === 'preview' ? 'white' : 'transparent', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', boxShadow: mode === 'preview' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}
          >
            Preview
          </button>
        </div>
      </div>

      <div className={`markdown-editor mode-${mode}`} style={{ display: 'grid', gap: '16px', gridTemplateColumns: mode === 'split' ? '1fr 1fr' : '1fr' }}>
        
        {mode === 'preview' && (
          <input type="hidden" name={name} value={value} />
        )}

        {(mode === 'write' || mode === 'split') && (
          <div className="markdown-editor-input">
            <textarea
              name={name}
              rows={rows}
              value={value}
              placeholder={placeholder}
              onChange={(event) => setValue(event.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.5', resize: 'vertical' }}
            />
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', textAlign: 'right' }}>
              Markdown supported
            </div>
          </div>
        )}

        {(mode === 'preview' || mode === 'split') && (
          <div className="panel markdown-preview" style={{ padding: '24px', overflowY: 'auto', maxHeight: mode === 'split' ? '800px' : 'none', background: '#fafafa' }}>
            {mode === 'preview' && <div className="muted" style={{ fontSize: "12px", marginBottom: "16px", textTransform: "uppercase", fontWeight: "bold" }}>Preview</div>}
            <div className="read-view" style={{ fontSize: '14px' }}>
              <MarkdownView value={value || "_(empty)_" } />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}