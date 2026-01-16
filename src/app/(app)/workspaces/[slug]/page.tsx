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
    <div className="panel">
      <LlmContext
        value={{
          type: "workspace",
          workspaceId: membership.workspace.id,
          workspaceSlug: membership.workspace.slug,
          role: membership.role
        }}
      />
      <h2>{membership.workspace.name}</h2>
      <p className="muted">
        {copy.workspace.role}: {membership.role}
      </p>
      <h3>{copy.workspace.quickLinks}</h3>
      <div className="link-grid">
        {[
          { href: "/articles", label: copy.nav.articles },
          { href: "/maps", label: copy.nav.maps },
          { href: "/timeline", label: copy.nav.timeline },
          { href: "/reviews", label: copy.nav.reviews },
          { href: "/settings", label: copy.nav.settings }
        ].map((item) => (
          <form key={item.href} action="/api/workspaces/open" method="post">
            <input type="hidden" name="slug" value={membership.workspace.slug} />
            <input type="hidden" name="redirectTo" value={item.href} />
            <button type="submit" className="link-card">
              {item.label}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
