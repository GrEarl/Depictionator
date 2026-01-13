import { prisma } from "@/lib/db";

type AuditInput = {
  workspaceId: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  meta?: Record<string, unknown> | null;
};

export async function logAudit(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      meta: input.meta ?? undefined
    }
  });
}
