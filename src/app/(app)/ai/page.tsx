import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import AIAssistantClient from "@/components/AIAssistantClient";

export default async function AIAssistantPage() {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return (
      <div className="p-8 text-center">
        <p className="muted">ワークスペースを選択してください</p>
      </div>
    );
  }

  return <AIAssistantClient workspaceId={workspace.id} />;
}
