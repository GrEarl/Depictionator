import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess } from "@/lib/api";
import { toRedirectUrl } from "@/lib/redirect";

const ALLOWED_ROLES = new Set(["admin", "editor", "reviewer", "viewer"]);

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
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const roleInput = String(form.get("role") ?? "viewer").trim();
  const workspaceIdInput = String(form.get("workspaceId") ?? "").trim();
  const workspaceId = workspaceIdInput || session.activeWorkspaceId || "";

  if (!email || !email.includes("@")) {
    return redirectWith(request, "error=invalid-email");
  }

  if (!workspaceId) {
    return redirectWith(request, "error=workspace-not-found");
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

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return redirectWith(request, "error=user-not-found");
  }

  const role = ALLOWED_ROLES.has(roleInput) ? roleInput : "viewer";

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id
      }
    },
    update: { role },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role
    }
  });

  return redirectWith(request, "notice=member-added");
}
