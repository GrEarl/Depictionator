import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { ReferenceForm } from "@/components/ReferenceForm";

/**
 * New Reference Page
 * Create a new reference entry for the library
 */
export default async function NewReferencePage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <div className="panel">Select a workspace first.</div>;
  }

  return (
    <div className="page-container max-w-2xl">
      <div className="page-header">
        <div>
          <Link href="/references" className="back-link">
            ← Back to Library
          </Link>
          <h1 className="page-title">Add Reference</h1>
          <p className="page-subtitle">
            Add a new source to your reference library
          </p>
        </div>
      </div>

      <ReferenceForm
        workspaceId={workspace.id}
        defaultRetrievedAt={new Date().toISOString().split("T")[0]}
      />
    </div>
  );
}
