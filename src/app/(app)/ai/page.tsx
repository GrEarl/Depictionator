import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import AIAssistantClient from "@/components/AIAssistantClient";

export default async function AIAssistantPage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return (
      <div className="panel max-w-2xl mx-auto mt-12 p-8 text-center">
        <div className="w-20 h-20 bg-gradient-accent rounded-full flex items-center justify-center mx-auto mb-6">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-10 h-10 text-white">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight mb-4">No Workspace Selected</h2>
        <p className="text-muted">Please select a workspace from the dashboard to use AI Assistant.</p>
      </div>
    );
  }

  return <AIAssistantClient workspaceId={workspace.id} />;
}
