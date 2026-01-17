import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.redirect(toRedirectUrl(request, "/login"));
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return NextResponse.redirect(toRedirectUrl(request, "/login"));
  }

  const formData = await request.formData();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();

  if (!slug) {
    return NextResponse.json({ error: "Slug required" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({ where: { slug } });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: session.userId
      }
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: session.userId,
      role: "viewer"
    }
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: { activeWorkspaceId: workspace.id }
  });

  return NextResponse.redirect(toRedirectUrl(request, `/workspaces/${workspace.slug}`));
}


