import { NextResponse } from "next/server";
import { WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess } from "@/lib/api";
import { toRedirectUrl } from "@/lib/redirect";

const ALLOWED_ROLES = new Set<WorkspaceRole>(["admin", "editor", "reviewer", "viewer"]);

function redirectWith(request: Request, query: string) {
  return NextResponse.redirect(toRedirectUrl(request, `/settings?tab=members&${query}`), 303);
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return NextResponse.redirect(toRedirectUrl(request, "/login"));
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "").trim();
  const memberId = String(form.get("memberId") ?? "").trim();
  const roleInput = String(form.get("role") ?? "").trim();

  if (!workspaceId || !memberId) {
    return redirectWith(request, "error=invalid-request");
  }

  const role = ALLOWED_ROLES.has(roleInput as WorkspaceRole)
    ? (roleInput as WorkspaceRole)
    : null;

  if (!role) {
    return redirectWith(request, "error=invalid-role");
  }

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) {
    return redirectWith(request, "error=workspace-not-found");
  }

  try {
    await requireWorkspaceAccess(session.userId, workspace.id, "admin");
  } catch {
    return redirectWith(request, "error=not-authorized");
  }

  const member = await prisma.workspaceMember.findUnique({ where: { id: memberId } });
  if (!member) {
    return redirectWith(request, "error=member-not-found");
  }

  if (member.workspaceId !== workspace.id) {
    return redirectWith(request, "error=invalid-request");
  }

  if (workspace.createdById && member.userId === workspace.createdById) {
    return redirectWith(request, "error=cannot-change-owner");
  }

  await prisma.workspaceMember.update({
    where: { id: member.id },
    data: { role }
  });

  return redirectWith(request, "notice=member-updated");
}
