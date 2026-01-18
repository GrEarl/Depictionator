"use client";

import { useState } from "react";

export function OnboardingModal({ hasMemberships }: { hasMemberships: boolean }) {
  const [isOpen, setIsOpen] = useState(!hasMemberships);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="panel-game max-w-2xl w-full p-8 animate-slide-in-right shadow-2xl border-2 border-accent">
        <div className="text-center space-y-6">
          {/* Icon */}
          <div className="w-24 h-24 bg-gradient-accent rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-12 h-12 text-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>

          {/* Title */}
          <h2 className="text-4xl font-black uppercase tracking-tight text-ink">
            Welcome to Depictionator
          </h2>

          {/* Description */}
          <p className="text-ink-secondary text-lg leading-relaxed font-semibold max-w-xl mx-auto">
            Your powerful worldbuilding toolkit is ready. Create your first workspace to organize characters, locations, timelines, and lore.
          </p>

          {/* Create Form */}
          <form action="/api/workspaces/create" method="post" className="mt-8 space-y-4 text-left max-w-md mx-auto">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-muted mb-2 block">Project Name</span>
              <input
                name="name"
                required
                autoFocus
                placeholder="e.g., Chronicles of Aetheria"
                className="w-full px-4 py-3 bg-bg-elevated border-2 border-accent/30 text-ink font-semibold rounded-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <span className="text-xs text-muted mt-1 block">Choose a memorable name for your world</span>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-muted mb-2 block">Custom URL (Optional)</span>
              <input
                name="slug"
                placeholder="e.g., aetheria (leave blank to auto-generate)"
                className="w-full px-4 py-3 bg-bg-elevated border border-border text-ink font-semibold rounded-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <span className="text-xs text-muted mt-1 block">Short link for your workspace. Auto-generated if empty.</span>
            </label>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                className="flex-1 px-6 py-4 bg-accent hover:bg-accent-hover text-white font-bold uppercase tracking-wide transition-all glow-on-hover"
                style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}
              >
                ▶ Create Workspace
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-6 py-4 border-2 border-accent/30 text-accent hover:bg-accent/10 font-bold uppercase tracking-wide transition-all"
              >
                Skip
              </button>
            </div>
          </form>

          {/* Quick Tips */}
          <div className="mt-8 pt-6 border-t border-border text-left max-w-md mx-auto">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">What you can do:</h4>
            <ul className="space-y-2 text-sm text-ink-secondary">
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">▶</span>
                <span>Create entities (characters, locations, factions, items)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">▶</span>
                <span>Build interactive maps with pins and paths</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">▶</span>
                <span>Organize timelines and chronicle events</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">▶</span>
                <span>Use evidence boards to connect ideas</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
