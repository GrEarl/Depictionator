import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type MemberSummary = { userId: string };

const MENTION_REGEX = /@([A-Za-z0-9._-]+)/g;

export function extractMentions(text: string) {
  const matches = Array.from(text.matchAll(MENTION_REGEX)).map((match) =>
    match[1].toLowerCase()
  );
  return Array.from(new Set(matches));
}

export async function notifyMentions(input: {
  workspaceId: string;
  actorUserId: string;
  text: string;
  context: Record<string, unknown>;
}) {
  const mentions = extractMentions(input.text);
  if (mentions.length === 0) return;

  const members: MemberSummary[] = await prisma.workspaceMember.findMany({
    where: {
      workspaceId: input.workspaceId,
      user: {
        OR: mentions.flatMap((mention) => [
          { email: { equals: mention, mode: "insensitive" } },
          { name: { equals: mention, mode: "insensitive" } }
        ])
      }
    },
    select: { userId: true }
  });

  const userIds = Array.from(
    new Set(members.map((member) => member.userId))
  ).filter((userId) => userId !== input.actorUserId);

  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      workspaceId: input.workspaceId,
      type: "mention",
      payload: input.context as Prisma.InputJsonValue
    }))
  });
}
