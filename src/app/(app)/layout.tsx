import Link from "next/link";
import { GlobalFilterProvider } from "@/components/GlobalFilterProvider";
import { GlobalFilters } from "@/components/GlobalFilters";
import { LlmPanel } from "@/components/LlmPanel";
import { getCurrentSession, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_PROVIDERS = ["gemini_ai", "gemini_vertex", "codex_cli"] as const;
type OptionSource = { id: string; name: string };

function normalizeProvider(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "gemini") return "gemini_ai";
  if (normalized === "vertex") return "gemini_vertex";
  if (normalized === "codex") return "codex_cli";
  if (DEFAULT_PROVIDERS.includes(normalized as (typeof DEFAULT_PROVIDERS)[number])) {
    return normalized;
  }
  return null;
}

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
    eras.map((era: OptionSource) => ({ value: era.id, label: era.name }))
  );
  const chapterOptions = [{ value: "all", label: "All Chapters" }].concat(
    chapters.map((chapter: OptionSource) => ({
      value: chapter.id,
      label: chapter.name
    }))
  );
  const viewpointOptions = [{ value: "canon", label: "Omni (Canon)" }].concat(
    viewpoints.map((viewpoint: OptionSource) => ({
      value: viewpoint.id,
      label: viewpoint.name
    }))
  );

  const enabledProviders = process.env.LLM_PROVIDERS_ENABLED
    ? process.env.LLM_PROVIDERS_ENABLED.split(",")
        .map((entry) => normalizeProvider(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [...DEFAULT_PROVIDERS];

  const defaultProvider = normalizeProvider(process.env.LLM_DEFAULT_PROVIDER ?? "") ?? enabledProviders[0];
  const defaultGeminiModel = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
  const defaultVertexModel = process.env.VERTEX_GEMINI_MODEL ?? defaultGeminiModel;

  return (
    <GlobalFilterProvider>
      <div className="app-shell">
        <header className="app-header">
          <div className="brand">
            <Link href="/">Depictionator</Link>
            <span className="workspace-pill">{session?.workspace?.name ?? "No workspace selected"}</span>
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
              <button type="submit" className="link-button">
                Logout
              </button>
            </form>
          </div>
        </header>
        <GlobalFilters eras={eraOptions} chapters={chapterOptions} viewpoints={viewpointOptions} />
        <div className="app-body">{children}</div>
        <LlmPanel
          workspaceId={session?.workspace?.id}
          enabledProviders={enabledProviders}
          defaultProvider={defaultProvider}
          defaultGeminiModel={defaultGeminiModel}
          defaultVertexModel={defaultVertexModel}
        />
      </div>
    </GlobalFilterProvider>
  );
}

