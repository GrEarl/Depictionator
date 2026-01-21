import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";

type Payload = {
  workspaceId?: string;
  scope?: string;
  name?: string;
  prompt?: string;
};

function normalize(value?: string) {
  return String(value ?? "").trim();
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  let payload: Payload | null = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }
  if (!payload) {
    const form = await request.formData();
    payload = {
      workspaceId: String(form.get("workspaceId") ?? ""),
      scope: String(form.get("scope") ?? ""),
      name: String(form.get("name") ?? ""),
      prompt: String(form.get("prompt") ?? "")
    };
  }

  const workspaceId = normalize(payload.workspaceId);
  const scope = normalize(payload.scope);
  const name = normalize(payload.name);
  const prompt = String(payload.prompt ?? "").trim();

  if (!workspaceId || !scope || !name || !prompt) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const template = await prisma.llmPromptTemplate.upsert({
    where: {
      workspaceId_scope_name: {
        workspaceId,
        scope,
        name
      }
    },
    update: { prompt },
    create: { workspaceId, scope, name, prompt }
  });

  return NextResponse.json({ ok: true, id: template.id });
}
