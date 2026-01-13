import Link from "next/link";
import { GlobalFilterProvider } from "@/components/GlobalFilterProvider";
import { GlobalFilters } from "@/components/GlobalFilters";
import { LlmPanel } from "@/components/LlmPanel";
import { getCurrentSession, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const session = await getCurrentSession();
  const workspaceId = session?.workspace?.id;

  const [eras, chapters, viewpoints] = workspaceId
    ? await Promise.all([
        prisma.era.findMany({ where: { workspaceId, softDeletedAt: null }, orderBy: { sortKey: "asc" } }),
        prisma.chapter.findMany({ where: { workspaceId, softDeletedAt: null }, orderBy: { orderIndex: "asc" } }),
        prisma.viewpoint.findMany({ where: { workspaceId, softDeletedAt: null }, orderBy: { createdAt: "asc" } })
      ])
    : [[], [], []];

  const eraOptions = [{ value: "all", label: "All Eras" }].concat(
    eras.map((era) => ({ value: era.id, label: era.name }))
  );
  const chapterOptions = [{ value: "all", label: "All Chapters" }].concat(
    chapters.map((chapter) => ({ value: chapter.id, label: chapter.name }))
  );
  const viewpointOptions = [{ value: "canon", label: "Omni (Canon)" }].concat(
    viewpoints.map((viewpoint) => ({ value: viewpoint.id, label: viewpoint.name }))
  );

  return (
    <GlobalFilterProvider>
      <div className="app-shell">
        <header className="app-header">
          <div className="brand">
            <Link href="/">WorldLore Atlas</Link>
            <span className="workspace-pill">
              {session?.workspace?.name ?? "No workspace selected"}
            </span>
          </div>
          <nav className="app-nav">
            <Link href="/">Dashboard</Link>
            <Link href="/articles">Articles</Link>
            <Link href="/maps">Maps</Link>
            <Link href="/timeline">Timeline</Link>
            <Link href="/reviews">Reviews</Link>
            <Link href="/settings">Settings</Link>
          </nav>
          <div className="user-actions">
            <span>{user.name ?? user.email}</span>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="link-button">Logout</button>
            </form>
          </div>
        </header>
        <GlobalFilters eras={eraOptions} chapters={chapterOptions} viewpoints={viewpointOptions} />
        <div className="app-body">{children}</div>
        <LlmPanel workspaceId={session?.workspace?.id} />
      </div>
    </GlobalFilterProvider>
  );
}
