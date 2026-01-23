"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import Link from "next/link";

type SearchResult = {
  id: string;
  type: "entity" | "map" | "board" | "event" | "timeline";
  title: string;
  excerpt?: string;
  url: string;
  entityType?: string;
  tags?: string[];
  updatedAt?: string;
  score?: number;
};

type SearchResponse = {
  results: SearchResult[];
  total: number;
};

type Props = {
  workspaceId?: string;
  placeholder?: string;
};

export function GlobalSearch({ workspaceId, placeholder = "Search everything... (⌘K)" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [useSemanticSearch, setUseSemanticSearch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useKeyboardShortcut("k", () => {
    setIsOpen(true);
  }, { ctrl: true });

  // ESC to close
  useKeyboardShortcut("Escape", () => {
    if (isOpen) {
      setIsOpen(false);
      setQuery("");
      setResults([]);
    }
  }, { allowInInput: true });

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search with debounce
  useEffect(() => {
    if (!query.trim() || !workspaceId) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        if (useSemanticSearch) {
          // Use semantic search API
          const res = await fetch("/api/ai/semantic-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId,
              query: query.trim(),
              limit: 20
            })
          });
          if (res.ok) {
            const data = await res.json();
            setResults(data.results || []);
            setSelectedIndex(0);
          } else {
            setResults([]);
          }
        } else {
          // Use regular keyword search
          const params = new URLSearchParams({
            workspaceId,
            q: query.trim(),
            limit: "20"
          });
          const res = await fetch(`/api/search/global?${params}`);
          if (res.ok) {
            const data: SearchResponse = await res.json();
            setResults(data.results);
            setSelectedIndex(0);
          }
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, workspaceId, useSemanticSearch]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      router.push(results[selectedIndex].url);
      setIsOpen(false);
      setQuery("");
    }
  }, [results, selectedIndex, router]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="search-trigger"
        aria-label="Open search"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="search-hint">Search (⌘K)</span>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="search-backdrop"
        onClick={() => {
          setIsOpen(false);
          setQuery("");
        }}
      />

      {/* Search modal */}
      <div className="search-modal">
        <div className="search-input-container">
          <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={useSemanticSearch ? "Semantic search... (meaning-based)" : placeholder}
            className="search-input"
          />
          {isLoading && (
            <div className="search-spinner">
              <div className="spinner" />
            </div>
          )}
          <button
            type="button"
            onClick={() => setUseSemanticSearch(!useSemanticSearch)}
            className={`search-mode-toggle ${useSemanticSearch ? "active" : ""}`}
            title={useSemanticSearch ? "Switch to keyword search" : "Switch to semantic search (AI)"}
          >
            {useSemanticSearch ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M12 2a10 10 0 1010 10A10 10 0 0012 2z" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
              </svg>
            )}
            <span className="toggle-label">{useSemanticSearch ? "AI" : "Keyword"}</span>
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="search-results">
            {results.map((result, index) => (
              <Link
                key={result.id}
                href={result.url}
                className={`search-result-item ${index === selectedIndex ? "selected" : ""}`}
                onClick={() => {
                  setIsOpen(false);
                  setQuery("");
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="result-icon">
                  {result.type === "entity" && "📄"}
                  {result.type === "map" && "🗺️"}
                  {result.type === "board" && "📋"}
                  {result.type === "event" && "📅"}
                  {result.type === "timeline" && "⏱️"}
                </div>
                <div className="result-content">
                  <div className="result-title">
                    {result.title}
                    {result.entityType && (
                      <span className={`entity-type-badge type-${result.entityType}`}>
                        {result.entityType}
                      </span>
                    )}
                  </div>
                  {result.excerpt && (
                    <div className="result-excerpt">{result.excerpt}</div>
                  )}
                  {result.tags && result.tags.length > 0 && (
                    <div className="result-tags">
                      {result.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="tag-badge">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="result-meta">
                  <span className="result-type">{result.type}</span>
                  {result.score !== undefined && useSemanticSearch && (
                    <span className="result-score" title="Similarity score">
                      {Math.round(result.score * 100)}%
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty state */}
        {query.trim() && !isLoading && results.length === 0 && (
          <div className="search-empty">
            <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="empty-text">No results found for "{query}"</p>
            <p className="empty-hint">Try different keywords or filters</p>
          </div>
        )}

        {/* Help text */}
        {!query.trim() && (
          <div className="search-help">
            <div className="help-section">
              <h4>Quick tips</h4>
              <ul>
                <li><kbd>↑</kbd> <kbd>↓</kbd> to navigate</li>
                <li><kbd>Enter</kbd> to select</li>
                <li><kbd>Esc</kbd> to close</li>
              </ul>
            </div>
            <div className="help-section">
              <h4>Search across</h4>
              <div className="help-types">
                <span>📄 Entities</span>
                <span>🗺️ Maps</span>
                <span>📋 Boards</span>
                <span>📅 Events</span>
                <span>⏱️ Timelines</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
