import { requireWorkspaceMembership } from "@/lib/auth";
import Link from "next/link";

export default async function WorkspacePage({
  params
}: {
  params: { slug: string };
}) {
  const membership = await requireWorkspaceMembership(params.slug);

  return (
    <div className="panel">
      <h2>{membership.workspace.name}</h2>
      <p className="muted">Role: {membership.role}</p>
      <div className="link-grid">
        <Link href="/app/articles">Articles</Link>
        <Link href="/app/maps">Maps</Link>
        <Link href="/app/timeline">Timeline</Link>
        <Link href="/app/reviews">Reviews</Link>
        <Link href="/app/settings">Settings</Link>
      </div>
    </div>
  );
}
