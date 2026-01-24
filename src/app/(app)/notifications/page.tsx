import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { toWikiPath } from "@/lib/wiki";

type SearchParams = { [key: string]: string | string[] | undefined };

type NotificationPayload = {
  entityId?: string;
  mapId?: string;
  referenceId?: string;
  boardId?: string;
  timelineId?: string;
  eventId?: string;
  reviewId?: string;
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);
  const resolvedSearchParams = await searchParams;
  const status = typeof resolvedSearchParams.status === "string" ? resolvedSearchParams.status : "unread";
  const typeFilter = typeof resolvedSearchParams.type === "string" ? resolvedSearchParams.type : "all";
  const query = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q.trim() : "";

  const where: Record<string, any> = { userId: user.id };
  if (workspace?.id) where.workspaceId = workspace.id;
  if (status === "unread") where.readAt = null;
  if (status === "read") where.readAt = { not: null };
  if (typeFilter && typeFilter !== "all") where.type = typeFilter;

  const [notifications, unreadCount, totalCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: { workspace: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 200
    }),
    prisma.notification.count({
      where: {
        userId: user.id,
        ...(workspace?.id ? { workspaceId: workspace.id } : {}),
        readAt: null
      }
    }),
    prisma.notification.count({
      where: { userId: user.id, ...(workspace?.id ? { workspaceId: workspace.id } : {}) }
    })
  ]);

  const readCount = Math.max(totalCount - unreadCount, 0);

  const entityIds = new Set<string>();
  const mapIds = new Set<string>();
  const referenceIds = new Set<string>();
  const boardIds = new Set<string>();
  const timelineIds = new Set<string>();
  const eventIds = new Set<string>();

  notifications.forEach((note) => {
    const payload = (note.payload ?? {}) as NotificationPayload;
    if (payload.entityId) entityIds.add(payload.entityId);
    if (payload.mapId) mapIds.add(payload.mapId);
    if (payload.referenceId) referenceIds.add(payload.referenceId);
    if (payload.boardId) boardIds.add(payload.boardId);
    if (payload.timelineId) timelineIds.add(payload.timelineId);
    if (payload.eventId) eventIds.add(payload.eventId);
  });

  const [entities, maps, references, boards, timelines, events] = await Promise.all([
    entityIds.size
      ? prisma.entity.findMany({ where: { id: { in: Array.from(entityIds) } }, select: { id: true, title: true } })
      : [],
    mapIds.size
      ? prisma.map.findMany({ where: { id: { in: Array.from(mapIds) } }, select: { id: true, title: true } })
      : [],
    referenceIds.size
      ? prisma.reference.findMany({ where: { id: { in: Array.from(referenceIds) } }, select: { id: true, title: true } })
      : [],
    boardIds.size
      ? prisma.evidenceBoard.findMany({ where: { id: { in: Array.from(boardIds) } }, select: { id: true, name: true } })
      : [],
    timelineIds.size
      ? prisma.timeline.findMany({ where: { id: { in: Array.from(timelineIds) } }, select: { id: true, name: true } })
      : [],
    eventIds.size
      ? prisma.event.findMany({ where: { id: { in: Array.from(eventIds) } }, select: { id: true, title: true } })
      : []
  ]);

  const entityMap = new Map(entities.map((item) => [item.id, item]));
  const mapMap = new Map(maps.map((item) => [item.id, item]));
  const referenceMap = new Map(references.map((item) => [item.id, item]));
  const boardMap = new Map(boards.map((item) => [item.id, item]));
  const timelineMap = new Map(timelines.map((item) => [item.id, item]));
  const eventMap = new Map(events.map((item) => [item.id, item]));

  const formatDate = (date: Date) =>
    date.toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });

  const buildNotification = (note: typeof notifications[number]) => {
    const payload = (note.payload ?? {}) as NotificationPayload;
    const typeLabel = note.type.replace(/_/g, " ");

    if (payload.entityId && entityMap.has(payload.entityId)) {
      const entity = entityMap.get(payload.entityId)!;
      return { title: entity.title, subtitle: "Entity", href: toWikiPath(entity.title) };
    }
    if (payload.mapId && mapMap.has(payload.mapId)) {
      const map = mapMap.get(payload.mapId)!;
      return { title: map.title, subtitle: "Map", href: `/maps?map=${map.id}` };
    }
    if (payload.referenceId && referenceMap.has(payload.referenceId)) {
      const ref = referenceMap.get(payload.referenceId)!;
      return { title: ref.title, subtitle: "Reference", href: `/references/${ref.id}` };
    }
    if (payload.boardId && boardMap.has(payload.boardId)) {
      const board = boardMap.get(payload.boardId)!;
      return { title: board.name, subtitle: "Evidence Board", href: `/boards?board=${board.id}` };
    }
    if (payload.timelineId && timelineMap.has(payload.timelineId)) {
      const timeline = timelineMap.get(payload.timelineId)!;
      return { title: timeline.name, subtitle: "Timeline", href: `/timeline?timeline=${timeline.id}` };
    }
    if (payload.eventId && eventMap.has(payload.eventId)) {
      const event = eventMap.get(payload.eventId)!;
      return { title: event.title, subtitle: "Event", href: `/timeline?event=${event.id}` };
    }

    return { title: typeLabel, subtitle: "Update", href: null };
  };

  const buildFilterLink = (nextStatus: string) =>
    `?status=${nextStatus}${typeFilter !== "all" ? `&type=${encodeURIComponent(typeFilter)}` : ""}${query ? `&q=${encodeURIComponent(query)}` : ""}`;

  const typeOptions = Array.from(new Set(notifications.map((note) => note.type))).sort();

  const enriched = notifications.map((note) => ({ note, info: buildNotification(note) }));
  const filtered = query
    ? enriched.filter(({ note, info }) => {
        const haystack = [
          note.type,
          info.title,
          info.subtitle,
          note.workspace?.name ?? ""
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query.toLowerCase());
      })
    : enriched;

  return (
    <div className="page-container max-w-4xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">Track updates across your workspace</p>
        </div>
        <div className="notification-actions">
          <form action="/api/notifications/read-all" method="post">
            {workspace?.id && <input type="hidden" name="workspaceId" value={workspace.id} />}
            <button type="submit" className="btn-secondary">Mark All Read</button>
          </form>
        </div>
      </div>

      <div className="notification-filters">
        <Link href={buildFilterLink("unread")} className={status === "unread" ? "active" : ""}>
          Unread <span className="notification-count">{unreadCount}</span>
        </Link>
        <Link href={buildFilterLink("all")} className={status === "all" ? "active" : ""}>
          All <span className="notification-count">{totalCount}</span>
        </Link>
        <Link href={buildFilterLink("read")} className={status === "read" ? "active" : ""}>
          Read <span className="notification-count">{readCount}</span>
        </Link>
      </div>

      <form method="get" className="notification-toolbar">
        <input type="hidden" name="status" value={status} />
        <div className="notification-toolbar-group">
          <label className="text-xs font-bold uppercase tracking-widest text-muted">Type</label>
          <select name="type" defaultValue={typeFilter} className="notification-select">
            <option value="all">All types</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="notification-toolbar-group flex-1">
          <label className="text-xs font-bold uppercase tracking-widest text-muted">Search</label>
          <input
            name="q"
            defaultValue={query}
            placeholder="Search notifications"
            className="notification-input"
          />
        </div>
        <div className="notification-toolbar-actions">
          <button type="submit" className="btn-secondary">Apply</button>
          {(typeFilter !== "all" || query) && (
            <Link href={`?status=${status}`} className="btn-link">Clear</Link>
          )}
        </div>
      </form>

      <div className="notification-list">
        {filtered.map(({ note, info }) => {
          return (
            <div key={note.id} className={`notification-item ${note.readAt ? "read" : "unread"}`}>
              <div className="notification-main">
                <div className="notification-title">
                  {info.href ? (
                    <Link href={info.href}>{info.title}</Link>
                  ) : (
                    <span>{info.title}</span>
                  )}
                </div>
                <div className="notification-meta">
                  <span className="notification-type">{note.type}</span>
                  <span>{info.subtitle}</span>
                  <span>{note.workspace?.name ?? "Workspace"}</span>
                </div>
              </div>
              <div className="notification-side">
                <span className="notification-date">{formatDate(note.createdAt)}</span>
                {!note.readAt && (
                  <form action="/api/notifications/read" method="post">
                    <input type="hidden" name="notificationId" value={note.id} />
                    <button type="submit" className="btn-link">Mark read</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="empty-state-centered">
            <h2>No notifications</h2>
            <p className="muted">You're all caught up.</p>
          </div>
        )}
      </div>
    </div>
  );
}
