import { requireWorkspaceMembership } from "@/lib/auth";
import Link from "next/link";
import { LlmContext } from "@/components/LlmContext";

type PageProps = { params: Promise<{ slug: string }> };

export default async function WorkspacePage({ params }: PageProps) {
  const { slug } = await params;
  const membership = await requireWorkspaceMembership(slug);

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
      <p className="muted">Role: {membership.role}</p>
      <div className="link-grid">
        <Link href="/articles">Articles</Link>
        <Link href="/maps">Maps</Link>
        <Link href="/timeline">Timeline</Link>
        <Link href="/reviews">Reviews</Link>
        <Link href="/settings">Settings</Link>
      </div>
    </div>
  );
}
