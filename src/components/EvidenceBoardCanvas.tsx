"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import {
  Tldraw,
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
  createShapeId,
  getSnapshot,
  toRichText,
  useTldrawUser,
  type Editor,
  type TLCreateShapePartial,
  type TLUserPreferences
} from "tldraw";
import { toWikiPath } from "@/lib/wiki";

const NOTE_WIDTH = 220;
const NOTE_HEIGHT = 140;

type TldrawColor =
  | "blue"
  | "green"
  | "yellow"
  | "violet"
  | "orange"
  | "light-blue"
  | "grey"
  | "black"
  | "light-green"
  | "light-red"
  | "light-violet"
  | "red"
  | "white";

type TldrawDash = "solid" | "dashed" | "dotted" | "draw";

type BoardItem = {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  url: string | null;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  zIndex: number | null;
  entityId: string | null;
  entity: { id: string; title: string; type: string } | null;
  referenceId: string | null;
  reference: { id: string; title: string } | null;
};

type BoardLink = {
  id: string;
  fromItemId: string;
  toItemId: string;
  label: string | null;
  style: string;
};

type Board = {
  id: string;
  name: string;
  canvasState?: unknown | null;
  items: BoardItem[];
  links: BoardLink[];
};

type Entity = { id: string; title: string; type: string };

type Reference = { id: string; title: string; type: string };

type Props = {
  board: Board;
  workspaceId: string;
  entities: Entity[];
  references: Reference[];
};

const itemColorByType: Record<string, TldrawColor> = {
  entity: "blue",
  reference: "green",
  note: "yellow",
  url: "violet",
  quote: "orange",
  asset: "light-blue",
  frame: "grey"
};

const linkDashByStyle: Record<string, TldrawDash> = {
  line: "solid",
  arrow: "solid",
  dashed: "dashed",
  dotted: "dotted"
};

function getItemColor(item: BoardItem): TldrawColor {
  return itemColorByType[item.type] ?? "grey";
}

function getItemTitle(item: BoardItem) {
  if (item.entity?.title) return item.entity.title;
  if (item.reference?.title) return item.reference.title;
  return item.title || "Untitled";
}

function getItemSubtitle(item: BoardItem) {
  if (item.entity?.type) return item.entity.type;
  if (item.reference) return "Reference";
  if (item.type) return item.type;
  return "";
}

function buildItemText(item: BoardItem) {
  const lines: string[] = [];
  const title = getItemTitle(item);
  if (title) lines.push(title);
  const subtitle = getItemSubtitle(item);
  if (subtitle && subtitle !== title) lines.push(subtitle);
  if (item.content) lines.push(item.content);
  if (item.url) lines.push(item.url);
  return lines.join("\n");
}

function buildItemUrl(item: BoardItem) {
  if (item.entity?.title) return toWikiPath(item.entity.title);
  if (item.url) return item.url;
  return "";
}

function getItemCenter(item: BoardItem) {
  const w = item.width ?? NOTE_WIDTH;
  const h = item.height ?? NOTE_HEIGHT;
  return { x: item.x + w / 2, y: item.y + h / 2 };
}

function buildLegacyShapes(board: Board) {
  const shapes: TLCreateShapePartial[] = [];
  const itemIds = new Map<string, string>();

  for (const item of board.items) {
    const id = createShapeId(item.id);
    itemIds.set(item.id, id);
    const color = getItemColor(item);

    if (item.type === "frame") {
      const width = item.width ?? 420;
      const height = item.height ?? 300;
      shapes.push({
        id,
        type: "frame",
        x: item.x,
        y: item.y,
        props: {
          w: width,
          h: height,
          name: item.title || "Frame",
          color
        },
        meta: {
          source: "evidence",
          itemId: item.id,
          kind: item.type
        }
      });
      continue;
    }

    shapes.push({
      id,
      type: "note",
      x: item.x,
      y: item.y,
      props: {
        richText: toRichText(buildItemText(item)),
        color,
        url: buildItemUrl(item)
      },
      meta: {
        source: "evidence",
        itemId: item.id,
        kind: item.type,
        entityId: item.entityId ?? undefined,
        referenceId: item.referenceId ?? undefined
      }
    });
  }

  for (const link of board.links) {
    const fromItem = board.items.find((item) => item.id === link.fromItemId);
    const toItem = board.items.find((item) => item.id === link.toItemId);
    if (!fromItem || !toItem) continue;

    const from = getItemCenter(fromItem);
    const to = getItemCenter(toItem);
    const dash: TldrawDash = linkDashByStyle[link.style] ?? "solid";
      const arrowheadEnd = link.style === "arrow" ? "arrow" : "none";
      const arrowColor: TldrawColor = "grey";

    shapes.push({
      id: createShapeId(`link-${link.id}`),
      type: "arrow",
      x: 0,
      y: 0,
      props: {
        start: from,
        end: to,
        dash,
        arrowheadStart: "none",
        arrowheadEnd,
        richText: toRichText(link.label ?? ""),
        color: arrowColor
      },
      meta: {
        source: "evidence",
        linkId: link.id
      }
    });
  }

  return shapes;
}

export function EvidenceBoardCanvas({ board, workspaceId, entities, references }: Props) {
  const editorRef = useRef<Editor | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootstrappedRef = useRef(false);

  const store = useMemo(() => {
    const options: Parameters<typeof createTLStore>[0] = {
      shapeUtils: defaultShapeUtils,
      bindingUtils: defaultBindingUtils,
      defaultName: board.name
    };
    if (board.canvasState) {
      options.snapshot = board.canvasState as any;
    }
    return createTLStore(options);
  }, [board.id, board.name]);

  const userPreferences = useMemo<TLUserPreferences>(() => {
    return {
      id: `board-${board.id}`,
      name: "Board",
      color: "#ff0033",
      colorScheme: "dark"
    };
  }, [board.id]);

  const user = useTldrawUser({ userPreferences });

  const persistSnapshot = useCallback(
    async (autosave = true) => {
      const editor = editorRef.current;
      if (!editor) return;

      try {
        const snapshot = getSnapshot(editor.store);
        const serialized = JSON.stringify(snapshot);
        if (autosave && serialized === lastSavedRef.current) return;

        const response = await fetch("/api/evidence-boards/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            boardId: board.id,
            canvasState: snapshot,
            autosave
          })
        });

        if (response.ok) {
          lastSavedRef.current = serialized;
        }
      } catch (error) {
        console.warn("Failed to save board canvas", error);
      }
    },
    [workspaceId, board.id]
  );

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      void persistSnapshot(true);
    }, 900);
  }, [persistSnapshot]);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;

      if (!board.canvasState && !bootstrappedRef.current && board.items.length) {
        bootstrappedRef.current = true;
        const shapes = buildLegacyShapes(board);
        if (shapes.length) {
          editor.createShapes(shapes);
          editor.setCurrentTool("select");
          setTimeout(() => void persistSnapshot(true), 300);
        }
      }
    },
    [board, persistSnapshot]
  );

  useEffect(() => {
    const unsubscribe = store.listen(() => {
      scheduleSave();
    }, { source: "user", scope: "document" });

    return () => {
      unsubscribe();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [store, scheduleSave]);

  useEffect(() => {
    const handleDragStart = (event: DragEvent) => {
      const target = (event.target as HTMLElement | null)?.closest(".draggable-item") as HTMLElement | null;
      if (!target || !event.dataTransfer) return;
      const type = target.dataset.type;
      const id = target.dataset.id;
      const title = target.dataset.title;
      if (!type || !id) return;

      const payload = { type, id, title };
      event.dataTransfer.setData("application/x-depictionator", JSON.stringify(payload));
      event.dataTransfer.setData("type", type);
      event.dataTransfer.setData("id", id);
      if (title) event.dataTransfer.setData("title", title);
      event.dataTransfer.effectAllowed = "copy";
    };

    document.addEventListener("dragstart", handleDragStart);
    return () => document.removeEventListener("dragstart", handleDragStart);
  }, []);

  const handleDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;

    const hasCustom = Array.from(event.dataTransfer.types).includes("application/x-depictionator");
    if (!hasCustom) return;

    event.preventDefault();

    const raw = event.dataTransfer.getData("application/x-depictionator");
    if (!raw) return;

    try {
      const payload = JSON.parse(raw) as { type: string; id: string; title?: string };
      const pagePoint = editor.screenToPage({ x: event.clientX, y: event.clientY });
      const color: TldrawColor =
        payload.type === "entity" ? "blue" : payload.type === "reference" ? "green" : "grey";
      const title = payload.title || payload.id;

      editor.createShape({
        type: "note",
        x: pagePoint.x,
        y: pagePoint.y,
        props: {
          richText: toRichText(title),
          color,
          url: payload.type === "entity"
            ? toWikiPath(title)
            : ""
        },
        meta: {
          source: "evidence",
          kind: payload.type,
          entityId: payload.type === "entity" ? payload.id : undefined,
          referenceId: payload.type === "reference" ? payload.id : undefined
        }
      });
      editor.setCurrentTool("select");
    } catch (error) {
      console.warn("Failed to drop item", error);
    }
  }, []);

  const handleDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    const hasCustom = Array.from(event.dataTransfer.types).includes("application/x-depictionator");
    if (!hasCustom) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  return (
    <div className="evidence-board-surface" onDrop={handleDrop} onDragOver={handleDragOver}>
      <Tldraw
        key={board.id}
        store={store}
        user={user}
        onMount={handleMount}
        className="evidence-board-tldraw"
      />
      {board.items.length === 0 && !board.canvasState && (
        <div className="evidence-board-empty">
          <h4>Start building your evidence wall</h4>
          <p>Drag entities or references here, or use the toolbar to add notes, frames, and media.</p>
        </div>
      )}
    </div>
  );
}
