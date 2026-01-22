import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";
import { LlmContext } from "@/components/LlmContext";
import { AutoMarkRead } from "@/components/AutoMarkRead";
import { ArticleDetail } from "@/components/ArticleDetail";
import { toWikiPath } from "@/lib/wiki";
import { MarkdownView } from "@/components/MarkdownView";
import { findBacklinks } from "@/lib/links";

type SearchParams = { [key: string]: string | string[] | undefined };

type PageProps = {
  params: Promise<{ title: string }>;
  searchParams: Promise<SearchParams>;
};

export default async function WikiResolvePage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <div className="panel">Select a workspace.</div>;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, workspaceId: workspace.id },
    select: { role: true }
  });
  const userRole = membership?.role ?? "viewer";

  const { title: rawTitle } = await params;
  const decoded = decodeURIComponent(rawTitle);
  const normalized = decoded.replace(/_/g, " ").trim();

  if (!normalized) {
    return <div className="panel">No title provided.</div>;
  }

  const talkMatch = normalized.match(/^Talk:\s*(.+)$/i);
  if (talkMatch) {
    const baseTitle = talkMatch[1].trim();
    if (!baseTitle) {
      return <div className="panel">No title provided.</div>;
    }

    const entity = await prisma.entity.findFirst({
      where: {
        workspaceId: workspace.id,
        softDeletedAt: null,
        OR: [
          { title: { equals: baseTitle, mode: "insensitive" } },
          { aliases: { has: baseTitle } }
        ]
      },
      select: { id: true, title: true, updatedAt: true }
    });

    if (!entity) {
      return (
        <div className="panel">
          <h2 className="text-xl font-bold">Page not found</h2>
          <p className="muted mt-2">
            No article found for <strong>{baseTitle}</strong>.
          </p>
        </div>
      );
    }

    const threads = await prisma.talkThread.findMany({
      where: { workspaceId: workspace.id, entityId: entity.id, softDeletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: {
        createdBy: { select: { name: true, email: true } },
        comments: {
          where: { softDeletedAt: null },
          orderBy: { createdAt: "asc" },
          include: { createdBy: { select: { name: true, email: true } } }
        }
      }
    });

    return (
      <div className="panel talk-page">
        <div className="talk-header">
          <div>
            <h1>Talk: {entity.title}</h1>
            <p className="muted mt-2">Discussion for this article.</p>
          </div>
          <Link href={toWikiPath(entity.title)} className="btn-secondary">
            Back to article
          </Link>
        </div>

        <form action="/api/talk/threads/create" method="post" className="talk-form">
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <input type="hidden" name="entityId" value={entity.id} />
          <label>
            Thread title
            <input name="title" placeholder="Topic..." />
          </label>
          <label>
            Message
            <textarea name="bodyMd" placeholder="Start the discussion..." required />
          </label>
          <button type="submit" className="btn-primary">Start thread</button>
        </form>

        {threads.length === 0 ? (
          <p className="muted">No discussions yet.</p>
        ) : (
          threads.map((thread) => (
            <div key={thread.id} className="talk-thread">
              <div>
                <div className="talk-thread-title">{thread.title}</div>
                <div className="talk-meta">
                  Started by {thread.createdBy?.name ?? thread.createdBy?.email ?? "Unknown"} • {new Date(thread.createdAt).toLocaleString()}
                </div>
              </div>

              <div className="talk-comments">
                {thread.comments.length === 0 ? (
                  <div className="muted text-xs">No replies yet.</div>
                ) : (
                  thread.comments.map((comment) => (
                    <div key={comment.id} className="talk-comment">
                      <div className="talk-meta">
                        {comment.createdBy?.name ?? comment.createdBy?.email ?? "Unknown"} • {new Date(comment.createdAt).toLocaleString()}
                      </div>
                      <MarkdownView value={comment.bodyMd} />
                    </div>
                  ))
                )}
              </div>

              <form action="/api/talk/comments/create" method="post" className="talk-reply">
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <input type="hidden" name="threadId" value={thread.id} />
                <textarea name="bodyMd" placeholder="Reply..." required />
                <button type="submit" className="btn-secondary">Reply</button>
              </form>
            </div>
          ))
        )}
      </div>
    );
  }

  const exactMatches = await prisma.entity.findMany({
    where: {
      workspaceId: workspace.id,
      softDeletedAt: null,
      OR: [
        { title: { equals: normalized, mode: "insensitive" } },
        { aliases: { has: normalized } }
      ]
    },
    select: { id: true, title: true, type: true, updatedAt: true }
  });

  if (exactMatches.length === 1) {
    const resolvedSearchParams = await searchParams;
    const mode = String(resolvedSearchParams.mode ?? "canon");
    const viewpoint = String(resolvedSearchParams.viewpoint ?? "canon");
    const eraFilter = String(resolvedSearchParams.era ?? "all");
    const chapterFilter = String(resolvedSearchParams.chapter ?? "all");
    const query = String(resolvedSearchParams.q ?? "").trim();

    const entity = await prisma.entity.findUnique({
      where: { id: exactMatches[0].id },
      include: {
        article: {
          include: {
            revisions: { orderBy: { createdAt: "desc" } },
            baseRevision: true
          }
        },
        overlays: {
          where: { softDeletedAt: null },
          include: {
            revisions: { orderBy: { createdAt: "desc" } },
            activeRevision: true
          }
        },
        mainImage: true,
        parentEntity: { select: { id: true, title: true, type: true } },
        childEntities: {
          where: { softDeletedAt: null },
          select: { id: true, title: true, type: true },
          take: 20
        },
        relationsFrom: {
          where: { softDeletedAt: null },
          include: { toEntity: { select: { id: true, title: true, type: true } } },
          take: 50
        },
        relationsTo: {
          where: { softDeletedAt: null },
          include: { fromEntity: { select: { id: true, title: true, type: true } } },
          take: 50
        },
        pins: {
          where: { softDeletedAt: null },
          include: { map: { select: { id: true, title: true } } },
          take: 10
        }
      }
    });

    if (!entity) {
      return <div className="panel">Not found.</div>;
    }

    const watch = await prisma.watch.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: user.id,
        targetType: "entity",
        targetId: entity.id,
        notifyInApp: true
      }
    });

    const allRelated = [
      ...entity.relationsFrom.map(r => ({
        id: r.toEntity.id,
        title: r.toEntity.title,
        type: r.toEntity.type,
        relation: r.relationType,
        direction: 'to' as const
      })),
      ...entity.relationsTo.map(r => ({
        id: r.fromEntity.id,
        title: r.fromEntity.title,
        type: r.fromEntity.type,
        relation: r.relationType,
        direction: 'from' as const
      }))
    ];

    const linkTargetEntities = await prisma.entity.findMany({
      where: {
        workspaceId: workspace.id,
        softDeletedAt: null,
        status: "approved"
      },
      select: { id: true, title: true, aliases: true },
      take: 500
    });
    const linkTargets = linkTargetEntities
      .filter((target) => target.id !== entity.id)
      .flatMap((target) => {
        const entries = [{ title: target.title, url: toWikiPath(target.title) }];
        (target.aliases ?? []).forEach((alias) => {
          if (!alias || alias === target.title) return;
          entries.push({ title: alias, url: toWikiPath(target.title) });
        });
        return entries;
      });

    // Fetch backlinks (entities that link to this one)
    const backlinks = await findBacklinks(workspace.id, entity.title, entity.aliases ?? []);

    return (
      <div className="layout-3-pane">
        <LlmContext
          value={{
            type: "entity",
            entityId: entity.id,
            title: entity.title,
            mode,
            viewpoint,
            eraFilter,
            chapterFilter,
            baseRevisionId: entity.article?.baseRevisionId ?? null,
            overlayIds: entity.overlays.map((overlay: { id: string }) => overlay.id)
          }}
        />
        <AutoMarkRead
          workspaceId={workspace.id}
          targetType="entity"
          targetId={entity.id}
          lastReadRevisionId={entity.article?.baseRevisionId ?? null}
        />
        <ArticleDetail
          entity={entity}
          workspaceId={workspace.id}
          user={user}
          userRole={userRole}
          mainImage={entity.mainImage}
          parentEntity={entity.parentEntity}
          childEntities={entity.childEntities}
          relatedEntities={allRelated}
          locations={entity.pins}
          searchQuery={query}
          isWatching={Boolean(watch)}
          linkTargets={linkTargets}
          backlinks={backlinks}
        />
      </div>
    );
  }

  const suggestions = exactMatches.length
    ? exactMatches
    : await prisma.entity.findMany({
        where: {
          workspaceId: workspace.id,
          softDeletedAt: null,
          OR: [
            { title: { contains: normalized, mode: "insensitive" } },
            { aliases: { has: normalized } }
          ]
        },
        select: { id: true, title: true, type: true, updatedAt: true },
        take: 20
      });

  return (
    <div className="panel">
      <h2 className="text-xl font-bold">Page not found</h2>
      <p className="muted mt-2">
        No exact match for <strong>{normalized}</strong>. Choose a close match below.
      </p>
      {suggestions.length === 0 ? (
        <p className="muted mt-4">No suggestions available.</p>
      ) : (
        <div className="list-sm mt-4">
          {suggestions.map((item) => (
            <Link key={item.id} href={toWikiPath(item.title)} className="list-row-sm">
              <div>
                <div className="font-semibold">{item.title}</div>
                <div className="text-xs muted uppercase tracking-wider">{item.type}</div>
              </div>
              <span className="text-xs muted">
                {new Date(item.updatedAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
