import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";

export async function getActiveWorkspace(userId: string) {
  const session = await getCurrentSession();
  if (session?.workspace) return session.workspace;

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true }
  });

  return membership?.workspace ?? null;
}
