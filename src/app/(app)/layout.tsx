import { GlobalFilterProvider } from "@/components/GlobalFilterProvider";
import { GlobalFilters } from "@/components/GlobalFilters";
import { GlobalSearch } from "@/components/GlobalSearch";
import { LlmPanel } from "@/components/LlmPanel";
import { Sidebar } from "@/components/Sidebar";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/workspaces";
import { getLocaleFromCookies } from "@/lib/locale";
import { getUiCopy } from "@/lib/i18n";

const DEFAULT_PROVIDERS = ["gemini_ai", "gemini_vertex", "codex_cli"] as const;
type OptionSource = { id: string; name: string };
type SelectOption = { value: string; label: string };

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
  const locale = await getLocaleFromCookies();
  const copy = getUiCopy(locale);
  const workspace = await getActiveWorkspace(user.id);
  const workspaceId = workspace?.id ?? null;

  const [eras, chapters, viewpoints] = workspaceId
    ? await Promise.all([
        prisma.era.findMany({ where: { workspaceId, softDeletedAt: null }, orderBy: { sortKey: "asc" } }),
        prisma.chapter.findMany({ where: { workspaceId, softDeletedAt: null }, orderBy: { orderIndex: "asc" } }),
        prisma.viewpoint.findMany({ where: { workspaceId, softDeletedAt: null }, orderBy: { createdAt: "asc" } })
      ])
    : [[], [], []];

  const eraOptions: SelectOption[] = [
    { value: "all", label: copy.filters.allEras },
    ...eras.map((era: OptionSource) => ({ value: era.id, label: era.name }))
  ];
  const chapterOptions: SelectOption[] = [
    { value: "all", label: copy.filters.allChapters },
    ...chapters.map((chapter: OptionSource) => ({
      value: chapter.id,
      label: chapter.name
    }))
  ];
  const viewpointOptions: SelectOption[] = [
    { value: "canon", label: copy.filters.omni },
    ...viewpoints.map((viewpoint: OptionSource) => ({
      value: viewpoint.id,
      label: viewpoint.name
    }))
  ];

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
        <Sidebar
          workspaceName={workspace?.name}
          userName={user.name ?? user.email}
          labels={{
            ...copy.nav,
            workspaceFallback: copy.workspace.none
          }}
        />
        <div className="app-main">
          <header className="app-topbar">
             <GlobalFilters
               eras={eraOptions}
               chapters={chapterOptions}
               viewpoints={viewpointOptions}
               labels={copy.filters}
             />
             <div className="topbar-actions">
               <GlobalSearch
                 workspaceId={workspaceId ?? undefined}
                 placeholder={copy.search?.placeholder || "Search everything... (⌘K)"}
               />
               <LocaleSwitcher
                 locale={locale}
                 workspaceId={workspaceId}
                 labels={copy.locale}
               />
             </div>
          </header>
          <div className="app-body">{children}</div>
        </div>
        <LlmPanel
          workspaceId={workspaceId ?? undefined}
          enabledProviders={enabledProviders}
          defaultProvider={defaultProvider}
          defaultGeminiModel={defaultGeminiModel}
          defaultVertexModel={defaultVertexModel}
        />
      </div>
    </GlobalFilterProvider>
  );
}
