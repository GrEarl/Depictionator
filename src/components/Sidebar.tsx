"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar({ workspaceName, userName }: { workspaceName?: string; userName?: string }) {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Dashboard", icon: "D" },
    { href: "/articles", label: "Articles", icon: "A" },
    { href: "/maps", label: "Maps", icon: "M" },
    { href: "/timeline", label: "Timeline", icon: "T" },
    { href: "/reviews", label: "Reviews", icon: "R" },
    { href: "/settings", label: "Settings", icon: "S" }
  ];

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <Link href="/" className="brand-link">
          Depictionator
        </Link>
        <div className="workspace-badge">{workspaceName ?? "No Workspace"}</div>
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
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="logout-button" title="Logout">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
