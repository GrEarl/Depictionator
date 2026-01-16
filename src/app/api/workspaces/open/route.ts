import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api";
import { toRedirectUrl } from "@/lib/redirect";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return NextResponse.redirect(toRedirectUrl(request, "/login"));
  }

  const form = await request.formData();
  const slug = String(form.get("slug") ?? "").trim();
  const workspaceId = String(form.get("workspaceId") ?? "").trim();
  const redirectTo = String(form.get("redirectTo") ?? "").trim();

  const workspace = workspaceId
    ? await prisma.workspace.findFirst({
        where: { id: workspaceId, members: { some: { userId: session.userId } } }
      })
    : await prisma.workspace.findFirst({
        where: { slug, members: { some: { userId: session.userId } } }
      });

  if (!workspace) {
    return NextResponse.redirect(toRedirectUrl(request, "/"));
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { activeWorkspaceId: workspace.id }
  });

  const destination = redirectTo || `/workspaces/${workspace.slug}`;
  return NextResponse.redirect(toRedirectUrl(request, destination));
}
