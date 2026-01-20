import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { MOCK_WORKSPACE, isDevelopmentMode } from "@/lib/mock-data";

export async function getActiveWorkspace(userId: string) {
  const session = await getCurrentSession();
  if (session?.workspace) return session.workspace;

  // Mock mode for development
  if (isDevelopmentMode()) {
    return MOCK_WORKSPACE;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true }
  });

  return membership?.workspace ?? null;
}
