import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { EvidenceItemType, EvidenceLinkStyle } from "@prisma/client";

type ImportPayload = {
  meta?: { version?: string };
  board?: { name?: string; description?: string };
  name?: string;
  description?: string;
  items?: any[];
  links?: any[];
};

const ITEM_TYPES = new Set(Object.values(EvidenceItemType));
const LINK_STYLES = new Set(Object.values(EvidenceLinkStyle));

const toStringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const toOptionalString = (value: unknown) => {
  const trimmed = toStringValue(value);
  return trimmed ? trimmed : null;
};
const toNumberValue = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

async function getValidIds(workspaceId: string, items: any[]) {
  const entityIds = Array.from(new Set(items.map((i) => toStringValue(i?.entityId)).filter(Boolean)));
  const assetIds = Array.from(new Set(items.map((i) => toStringValue(i?.assetId)).filter(Boolean)));
  const referenceIds = Array.from(new Set(items.map((i) => toStringValue(i?.referenceId)).filter(Boolean)));

  const [entities, assets, references] = await Promise.all([
    entityIds.length
      ? prisma.entity.findMany({ where: { workspaceId, id: { in: entityIds }, softDeletedAt: null }, select: { id: true } })
      : Promise.resolve([]),
    assetIds.length
      ? prisma.asset.findMany({ where: { workspaceId, id: { in: assetIds }, softDeletedAt: null }, select: { id: true } })
      : Promise.resolve([]),
    referenceIds.length
      ? prisma.reference.findMany({ where: { workspaceId, id: { in: referenceIds }, softDeletedAt: null }, select: { id: true } })
      : Promise.resolve([])
  ]);

  return {
    entityIds: new Set(entities.map((e) => e.id)),
    assetIds: new Set(assets.map((a) => a.id)),
    referenceIds: new Set(references.map((r) => r.id))
  };
}

async function createItemsAndLinks({
  workspaceId,
  boardId,
  items,
  links,
  validateReferences
}: {
  workspaceId: string;
  boardId: string;
  items: any[];
  links: any[];
  validateReferences: boolean;
}) {
  const safeItems = Array.isArray(items) ? items : [];
  const safeLinks = Array.isArray(links) ? links : [];

  const referenceSets = validateReferences
    ? await getValidIds(workspaceId, safeItems)
    : { entityIds: new Set<string>(), assetIds: new Set<string>(), referenceIds: new Set<string>() };

  const idMap = new Map<string, string>();
  let itemsCreated = 0;
  let skippedItems = 0;
  let linksCreated = 0;
  let skippedLinks = 0;
  let coercedTypes = 0;
  let coercedLinkStyles = 0;
  let skippedEntityRefs = 0;
  let skippedAssetRefs = 0;
  let skippedReferenceRefs = 0;

  for (let idx = 0; idx < safeItems.length; idx += 1) {
    const raw = safeItems[idx];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      skippedItems += 1;
      continue;
    }
    const tempId = toStringValue((raw as any).id) || toStringValue((raw as any).tempId) || `item-${idx}`;
    const typeValue = toStringValue((raw as any).type).toLowerCase();
    const type = ITEM_TYPES.has(typeValue as EvidenceItemType) ? (typeValue as EvidenceItemType) : EvidenceItemType.note;
    if (typeValue && type === EvidenceItemType.note && typeValue !== "note") {
      coercedTypes += 1;
    }

    const x = toNumberValue((raw as any).x, 80 + (idx % 4) * 220);
    const y = toNumberValue((raw as any).y, 80 + Math.floor(idx / 4) * 140);

    const entityId = toStringValue((raw as any).entityId);
    const assetId = toStringValue((raw as any).assetId);
    const referenceId = toStringValue((raw as any).referenceId);

    const entityValid = validateReferences && entityId && referenceSets.entityIds.has(entityId);
    const assetValid = validateReferences && assetId && referenceSets.assetIds.has(assetId);
    const referenceValid = validateReferences && referenceId && referenceSets.referenceIds.has(referenceId);

    if (validateReferences && entityId && !entityValid) skippedEntityRefs += 1;
    if (validateReferences && assetId && !assetValid) skippedAssetRefs += 1;
    if (validateReferences && referenceId && !referenceValid) skippedReferenceRefs += 1;

    const item = await prisma.evidenceItem.create({
      data: {
        workspaceId,
        boardId,
        type,
        title: toOptionalString((raw as any).title),
        content: toOptionalString((raw as any).content),
        url: toOptionalString((raw as any).url),
        entityId: entityValid ? entityId : null,
        assetId: assetValid ? assetId : null,
        referenceId: referenceValid ? referenceId : null,
        x,
        y,
        width: Number.isFinite(Number((raw as any).width)) ? Number((raw as any).width) : null,
        height: Number.isFinite(Number((raw as any).height)) ? Number((raw as any).height) : null,
        rotation: Number.isFinite(Number((raw as any).rotation)) ? Number((raw as any).rotation) : null,
        zIndex: Number.isFinite(Number((raw as any).zIndex)) ? Number((raw as any).zIndex) : null,
        data: (raw as any).data ?? undefined
      }
    });

    idMap.set(tempId, item.id);
    itemsCreated += 1;
  }

  for (const raw of safeLinks) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      skippedLinks += 1;
      continue;
    }
    const fromKey = toStringValue((raw as any).from) || toStringValue((raw as any).fromItemId) || toStringValue((raw as any).source);
    const toKey = toStringValue((raw as any).to) || toStringValue((raw as any).toItemId) || toStringValue((raw as any).target);
    const fromItemId = idMap.get(fromKey);
    const toItemId = idMap.get(toKey);
    if (!fromItemId || !toItemId) {
      skippedLinks += 1;
      continue;
    }

    const styleValue = toStringValue((raw as any).style).toLowerCase();
    const style = LINK_STYLES.has(styleValue as EvidenceLinkStyle)
      ? (styleValue as EvidenceLinkStyle)
      : EvidenceLinkStyle.line;
    if (styleValue && style === EvidenceLinkStyle.line && styleValue !== "line") {
      coercedLinkStyles += 1;
    }

    await prisma.evidenceLink.create({
      data: {
        workspaceId,
        boardId,
        fromItemId,
        toItemId,
        label: toOptionalString((raw as any).label),
        style,
        data: (raw as any).data ?? undefined
      }
    });
    linksCreated += 1;
  }

  return {
    itemsCreated,
    skippedItems,
    linksCreated,
    skippedLinks,
    coercedTypes,
    coercedLinkStyles,
    skippedEntityRefs,
    skippedAssetRefs,
    skippedReferenceRefs
  };
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const mode = String(form.get("mode") ?? "json").trim();

  if (!workspaceId) return apiError("Missing workspace", 400);

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  if (mode === "duplicate") {
    const sourceBoardId = String(form.get("sourceBoardId") ?? "").trim();
    const nameOverride = String(form.get("name") ?? "").trim();
    if (!sourceBoardId) return apiError("Missing source board", 400);

    const sourceBoard = await prisma.evidenceBoard.findFirst({
      where: { id: sourceBoardId, workspaceId, softDeletedAt: null },
      include: {
        items: { where: { softDeletedAt: null } },
        links: { where: { softDeletedAt: null } }
      }
    });

    if (!sourceBoard) return apiError("Board not found", 404);

    const newBoard = await prisma.evidenceBoard.create({
      data: {
        workspaceId,
        name: nameOverride || `${sourceBoard.name}（コピー）`,
        description: sourceBoard.description ?? null
      }
    });

    const idMap = new Map<string, string>();
    let itemsCreated = 0;
    let linksCreated = 0;
    for (const item of sourceBoard.items) {
      const created = await prisma.evidenceItem.create({
        data: {
          workspaceId,
          boardId: newBoard.id,
          type: item.type,
          title: item.title,
          content: item.content,
          url: item.url,
          entityId: item.entityId,
          assetId: item.assetId,
          referenceId: item.referenceId,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          rotation: item.rotation,
          zIndex: item.zIndex,
          data: item.data ?? undefined
        }
      });
      idMap.set(item.id, created.id);
      itemsCreated += 1;
    }

    for (const link of sourceBoard.links) {
      const fromItemId = idMap.get(link.fromItemId);
      const toItemId = idMap.get(link.toItemId);
      if (!fromItemId || !toItemId) continue;
      await prisma.evidenceLink.create({
        data: {
          workspaceId,
          boardId: newBoard.id,
          fromItemId,
          toItemId,
          label: link.label,
          style: link.style,
          data: link.data ?? undefined
        }
      });
      linksCreated += 1;
    }

    await logAudit({
      workspaceId,
      actorUserId: session.userId,
      action: "import",
      targetType: "evidence_board",
      targetId: newBoard.id,
      meta: { mode: "duplicate", sourceBoardId }
    });

    const params = new URLSearchParams({
      imported: "1",
      boardId: newBoard.id,
      items: String(itemsCreated),
      skippedItems: "0",
      links: String(linksCreated),
      skippedLinks: "0",
      coercedTypes: "0",
      coercedLinkStyles: "0",
      skippedEntityRefs: "0",
      skippedAssetRefs: "0",
      skippedReferenceRefs: "0",
      mode: "duplicate"
    });
    return NextResponse.redirect(toRedirectUrl(request, `/boards/import?${params.toString()}`));
  }

  let jsonText = String(form.get("json") ?? "").trim();
  if (!jsonText) {
    const file = form.get("jsonFile");
    if (file && typeof (file as File).text === "function") {
      jsonText = (await (file as File).text()).trim();
    }
  }

  if (!jsonText) return apiError("Missing JSON", 400);

  let payload: ImportPayload;
  try {
    payload = JSON.parse(jsonText) as ImportPayload;
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const version = toStringValue(payload.meta?.version);
  if (version && version !== "1") {
    return apiError("Unsupported import version", 400);
  }

  if (payload.items && !Array.isArray(payload.items)) {
    return apiError("Items must be an array", 400);
  }
  if (payload.links && !Array.isArray(payload.links)) {
    return apiError("Links must be an array", 400);
  }

  const boardNameOverride = String(form.get("name") ?? "").trim();
  const boardName = boardNameOverride || toStringValue(payload.board?.name ?? payload.name);
  if (!boardName) return apiError("Board name required", 400);

  const description = toOptionalString(payload.board?.description ?? payload.description);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const links = Array.isArray(payload.links) ? payload.links : [];

  const board = await prisma.evidenceBoard.create({
    data: {
      workspaceId,
      name: boardName,
      description
    }
  });

  const stats = await createItemsAndLinks({
    workspaceId,
    boardId: board.id,
    items,
    links,
    validateReferences: true
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "import",
    targetType: "evidence_board",
    targetId: board.id,
    meta: { mode: "json" }
  });

  const params = new URLSearchParams({
    imported: "1",
    boardId: board.id,
    items: String(stats.itemsCreated),
    skippedItems: String(stats.skippedItems),
    links: String(stats.linksCreated),
    skippedLinks: String(stats.skippedLinks),
    coercedTypes: String(stats.coercedTypes),
    coercedLinkStyles: String(stats.coercedLinkStyles),
    skippedEntityRefs: String(stats.skippedEntityRefs),
    skippedAssetRefs: String(stats.skippedAssetRefs),
    skippedReferenceRefs: String(stats.skippedReferenceRefs),
    mode: "json"
  });
  return NextResponse.redirect(toRedirectUrl(request, `/boards/import?${params.toString()}`));
}
