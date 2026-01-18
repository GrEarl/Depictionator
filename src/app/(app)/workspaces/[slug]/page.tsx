import { requireWorkspaceMembership } from "@/lib/auth";
import { LlmContext } from "@/components/LlmContext";
import { getLocaleFromCookies } from "@/lib/locale";
import { getUiCopy } from "@/lib/i18n";

type PageProps = { params: Promise<{ slug: string }> };

export default async function WorkspacePage({ params }: PageProps) {
  const { slug } = await params;
  const membership = await requireWorkspaceMembership(slug);
  const locale = await getLocaleFromCookies();
  const copy = getUiCopy(locale);

  return (
    <div className="panel max-w-2xl mx-auto mt-12 p-8">
      <LlmContext
        value={{
          type: "workspace",
          workspaceId: membership.workspace.id,
          workspaceSlug: membership.workspace.slug,
          role: membership.role
        }}
      />
      <div className="text-center space-y-6">
        <div className="w-20 h-20 bg-gradient-accent rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl font-black text-white">{membership.workspace.name[0].toUpperCase()}</span>
        </div>
        <h2 className="text-3xl font-black uppercase tracking-tight">{membership.workspace.name}</h2>
        <p className="text-ink-secondary text-lg">
          {copy.workspace.role}: <span className="text-accent font-bold">{membership.role.toUpperCase()}</span>
        </p>
        <div className="pt-4">
          <p className="text-muted text-sm">
            Use the sidebar navigation to access different sections of this workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
