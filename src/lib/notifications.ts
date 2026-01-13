import { prisma } from "@/lib/db";

type NotificationInput = {
  userId: string;
  workspaceId: string;
  type: string;
  payload: Record<string, unknown>;
};

export async function createNotification(input: NotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      workspaceId: input.workspaceId,
      type: input.type,
      payload: input.payload
    }
  });
}
