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

export async function notifyWatchers(input: {
  workspaceId: string;
  targetType: string;
  targetId: string;
  type: string;
  payload: Record<string, unknown>;
}) {
  const watchers = await prisma.watch.findMany({
    where: {
      workspaceId: input.workspaceId,
      targetType: input.targetType,
      targetId: input.targetId,
      notifyInApp: true
    }
  });

  await prisma.notification.createMany({
    data: watchers.map((watch) => ({
      userId: watch.userId,
      workspaceId: input.workspaceId,
      type: input.type,
      payload: input.payload
    }))
  });
}
