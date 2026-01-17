import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { SESSION_COOKIE } from "@/lib/auth";

async function ensureUniqueSlug(base: string) {
  let slug = base;
  let counter = 1;

  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
}

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
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const baseSlug = slugify(slugInput || name);
  const slug = await ensureUniqueSlug(baseSlug);

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      createdById: session.userId,
      members: {
        create: {
          userId: session.userId,
          role: "admin"
        }
      }
    }
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: { activeWorkspaceId: workspace.id }
  });

  return NextResponse.redirect(toRedirectUrl(request, `/workspaces/${workspace.slug}`));
}


