"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarLabels = {
  dashboard: string;
  articles: string;
  maps: string;
  timeline: string;
  reviews: string;
  settings: string;
  signOut: string;
  workspaceFallback: string;
};

export function Sidebar({
  workspaceName,
  userName,
  labels
}: {
  workspaceName?: string;
  userName?: string;
  labels: SidebarLabels;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/", label: labels.dashboard },
    { href: "/ai", label: "AI Assistant" },
    { href: "/articles", label: labels.articles },
    { href: "/maps", label: labels.maps },
    { href: "/boards", label: "Boards" },
    { href: "/timeline", label: labels.timeline },
    { href: "/reviews", label: labels.reviews },
    { href: "/settings", label: labels.settings }
  ];

  return (
    <>
      <button 
        className="lg:hidden fixed top-3 left-4 z-50 p-2 bg-panel border border-border rounded-md shadow-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-ink">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <Link href="/" className="brand-link">
            Depictionator
          </Link>
          <div className="workspace-badge">{workspaceName ?? labels.workspaceFallback}</div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`nav-item ${isActive ? "active" : ""}`}
              >
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{userName?.[0]?.toUpperCase() ?? "U"}</div>
            <div className="user-name">{userName ?? "User"}</div>
          </div>
          <form action="/api/auth/logout" method="post" className="logout-form">
            <button type="submit" className="logout-button" title="Logout">
              &times;
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
