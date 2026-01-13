import Link from "next/link";
import { GlobalFilterProvider } from "@/components/GlobalFilterProvider";
import { GlobalFilters } from "@/components/GlobalFilters";
import { LlmPanel } from "@/components/LlmPanel";
import { getCurrentSession, requireUser } from "@/lib/auth";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const session = await getCurrentSession();

  return (
    <GlobalFilterProvider>
      <div className="app-shell">
        <header className="app-header">
          <div className="brand">
            <Link href="/app">WorldLore Atlas</Link>
            <span className="workspace-pill">
              {session?.workspace?.name ?? "No workspace selected"}
            </span>
          </div>
          <nav className="app-nav">
            <Link href="/app">Dashboard</Link>
            <Link href="/app/articles">Articles</Link>
            <Link href="/app/maps">Maps</Link>
            <Link href="/app/timeline">Timeline</Link>
            <Link href="/app/reviews">Reviews</Link>
            <Link href="/app/settings">Settings</Link>
          </nav>
          <div className="user-actions">
            <span>{user.name ?? user.email}</span>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="link-button">Logout</button>
            </form>
          </div>
        </header>
        <GlobalFilters />
        <div className="app-body">{children}</div>
        <LlmPanel workspaceId={session?.workspace?.id} />
      </div>
    </GlobalFilterProvider>
  );
}
