"use client";

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

  const navItems = [
    { href: "/", label: labels.dashboard, icon: "D" },
    { href: "/articles", label: labels.articles, icon: "A" },
    { href: "/maps", label: labels.maps, icon: "M" },
    { href: "/boards", label: "Boards", icon: "B" },
    { href: "/timeline", label: labels.timeline, icon: "T" },
    { href: "/reviews", label: labels.reviews, icon: "R" },
    { href: "/settings", label: labels.settings, icon: "S" }
  ];

  return (
    <aside className="app-sidebar">
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
              className={`nav-item ${isActive ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
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
  );
}
