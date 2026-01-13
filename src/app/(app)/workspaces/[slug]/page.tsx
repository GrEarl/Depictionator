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
        <Link href="/articles">Articles</Link>
        <Link href="/maps">Maps</Link>
        <Link href="/timeline">Timeline</Link>
        <Link href="/reviews">Reviews</Link>
        <Link href="/settings">Settings</Link>
      </div>
    </div>
  );
}
