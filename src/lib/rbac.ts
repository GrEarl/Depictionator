import { prisma } from "@/lib/prisma";

const ROLE_ORDER = {
  viewer: 1,
  editor: 2,
  reviewer: 3,
  admin: 4
} as const;

type Role = keyof typeof ROLE_ORDER;

export function isRoleAtLeast(role: Role, minimum: Role) {
  return ROLE_ORDER[role] >= ROLE_ORDER[minimum];
}

export async function requireWorkspaceRole(userId: string, workspaceId: string, minimum: Role) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId }
  });

  if (!membership || !isRoleAtLeast(membership.role, minimum)) {
    throw new Error("FORBIDDEN");
  }

  return membership;
}
