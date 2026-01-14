import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

type AuditInput = {
  workspaceId: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  meta?: Prisma.InputJsonValue | null;
};

export async function logAudit(input: AuditInput) {
  const data: Prisma.AuditLogCreateInput = {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId
  };
  if (input.meta === null) {
    data.meta = Prisma.JsonNull;
  } else if (input.meta !== undefined) {
    data.meta = input.meta;
  }
  return prisma.auditLog.create({ data });
}
