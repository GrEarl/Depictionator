"use client";

import { useState } from "react";
import Link from "next/link";

type QuickAction = {
  id: string;
  title: string;
  icon: string;
  href: string;
  description: string;
  color: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "new-entity",
    title: "Create Entity",
    icon: "📄",
    href: "/articles?action=new",
    description: "Add a character, location, or item",
    color: "accent"
  },
  {
    id: "new-map",
    title: "Create Map",
    icon: "🗺️",
    href: "/maps/new",
    description: "Design a new geographic region",
    color: "secondary"
  },
  {
    id: "new-board",
    title: "Create Board",
    icon: "📋",
    href: "/boards/new",
    description: "Start an evidence board",
    color: "accent"
  },
  {
    id: "ai-assist",
    title: "AI Assistant",
    icon: "✨",
    href: "/ai",
    description: "Generate ideas and content",
    color: "secondary"
  }
];

export function QuickActions() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="quick-actions-grid">
      {QUICK_ACTIONS.map((action, index) => (
        <Link
          key={action.id}
          href={action.href}
          className={`quick-action-card color-${action.color}`}
          onMouseEnter={() => setHoveredId(action.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{
            animationDelay: `${index * 0.1}s`
          }}
        >
          <div className="quick-action-icon">{action.icon}</div>
          <div className="quick-action-content">
            <h3 className="quick-action-title">{action.title}</h3>
            <p className="quick-action-description">{action.description}</p>
          </div>
          <div className={`quick-action-arrow ${hoveredId === action.id ? "active" : ""}`}>
            →
          </div>
        </Link>
      ))}
    </div>
  );
}
