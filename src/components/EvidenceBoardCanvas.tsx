"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type MouseEvent, type DragEvent } from "react";

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

export function EvidenceBoardCanvas({ board, workspaceId, entities, references }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<BoardItem[]>(board.items);
  const [links] = useState<BoardLink[]>(board.links);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Handle card drag start
  const handleCardMouseDown = useCallback((e: MouseEvent, item: BoardItem) => {
    e.preventDefault();
    const rect = (e.target as HTMLElement).closest(".board-card")?.getBoundingClientRect();
    if (!rect) return;
    setDraggingId(item.id);
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setSelectedId(item.id);
  }, []);

  // Handle card drag
  const handleCanvasMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingId || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = e.clientX - canvasRect.left - dragOffset.x;
    const newY = e.clientY - canvasRect.top - dragOffset.y;
    setItems((prev) =>
      prev.map((item) =>
        item.id === draggingId ? { ...item, x: Math.max(0, newX), y: Math.max(0, newY) } : item
      )
    );
  }, [draggingId, dragOffset]);

  // Handle card drag end - save to server
  const handleCanvasMouseUp = useCallback(async () => {
    if (!draggingId) return;
    const item = items.find((i) => i.id === draggingId);
    if (item) {
      const form = new FormData();
      form.append("workspaceId", workspaceId);
      form.append("itemId", item.id);
      form.append("x", String(Math.round(item.x)));
      form.append("y", String(Math.round(item.y)));
      await fetch("/api/evidence-items/update", { method: "POST", body: form });
    }
    setDraggingId(null);
  }, [draggingId, items, workspaceId]);

  // Handle drop from sidebar
  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("type");
    const id = e.dataTransfer.getData("id");
    const title = e.dataTransfer.getData("title");

    if (!type || !id || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;

    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("boardId", board.id);
    form.append("type", type);
    form.append("title", title);
    form.append("x", String(Math.round(x)));
    form.append("y", String(Math.round(y)));

    if (type === "entity") {
      form.append("entityId", id);
    } else if (type === "reference") {
      form.append("referenceId", id);
    }

    const response = await fetch("/api/evidence-items/create", { method: "POST", body: form });
    if (response.ok) {
      router.refresh();
    }
  }, [workspaceId, board.id, router]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // Start connection mode
  const startConnection = useCallback((itemId: string) => {
    setConnectingFrom(itemId);
  }, []);

  // Complete connection
  const completeConnection = useCallback(async (toItemId: string) => {
    if (!connectingFrom || connectingFrom === toItemId) {
      setConnectingFrom(null);
      return;
    }

    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("boardId", board.id);
    form.append("fromItemId", connectingFrom);
    form.append("toItemId", toItemId);
    form.append("style", "arrow");

    await fetch("/api/evidence-links/create", { method: "POST", body: form });
    setConnectingFrom(null);
    router.refresh();
  }, [connectingFrom, workspaceId, board.id, router]);

  // Get card display info
  const getCardDisplay = (item: BoardItem) => {
    if (item.entity) {
      return { title: item.entity.title, subtitle: item.entity.type, className: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" };
    }
    if (item.reference) {
      return { title: item.reference.title, subtitle: "Reference", className: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" };
    }
    if (item.type === "note") {
      return { title: item.title || "Note", subtitle: item.content?.slice(0, 50), className: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" };
    }
    if (item.type === "url") {
      return { title: item.title || item.url || "Link", subtitle: item.url, className: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800" };
    }
    return { title: item.title || "Item", subtitle: item.type, className: "bg-panel border-border" };
  };

  // Calculate link line positions
  const getLinkPath = (link: BoardLink) => {
    const fromItem = items.find((i) => i.id === link.fromItemId);
    const toItem = items.find((i) => i.id === link.toItemId);
    if (!fromItem || !toItem) return null;

    const fromX = fromItem.x + 100; // card center
    const fromY = fromItem.y + 40;
    const toX = toItem.x + 100;
    const toY = toItem.y + 40;

    return { fromX, fromY, toX, toY };
  };

  return (
    <div
      ref={canvasRef}
      className="evidence-canvas"
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Connection Lines (SVG) */}
      <svg className="evidence-links-layer">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#888" />
          </marker>
        </defs>
        {links.map((link) => {
          const path = getLinkPath(link);
          if (!path) return null;
          return (
            <line
              key={link.id}
              x1={path.fromX}
              y1={path.fromY}
              x2={path.toX}
              y2={path.toY}
              stroke="#888"
              strokeWidth={2}
              markerEnd={link.style === "arrow" ? "url(#arrowhead)" : undefined}
              strokeDasharray={link.style === "dashed" ? "6 4" : undefined}
            />
          );
        })}
      </svg>

      {/* Cards */}
      {items.map((item) => {
        const display = getCardDisplay(item);
        const isSelected = selectedId === item.id;
        const isConnecting = connectingFrom === item.id;

        return (
          <div
            key={item.id}
            className={`board-card border shadow-sm transition-all hover:shadow-md ${display.className} ${isSelected ? "ring-2 ring-accent border-accent shadow-lg" : ""} ${isConnecting ? "ring-2 ring-amber-500 animate-pulse" : ""}`}
            style={{
              left: item.x,
              top: item.y,
              zIndex: item.zIndex || 1
            }}
            onMouseDown={(e) => handleCardMouseDown(e, item)}
            onClick={() => connectingFrom ? completeConnection(item.id) : setSelectedId(item.id)}
          >
            <div className="card-title font-bold text-sm text-ink mb-1">{display.title}</div>
            {display.subtitle && <div className="card-subtitle text-[10px] uppercase font-semibold text-muted opacity-80">{display.subtitle}</div>}
            <div className="card-actions">
              <button
                className="card-action-btn w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-border shadow-sm flex items-center justify-center hover:bg-accent hover:text-white transition-colors"
                title="Connect to another card"
                onClick={(e) => { e.stopPropagation(); startConnection(item.id); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}

      {/* Empty State */}
      {items.length === 0 && (
        <div className="canvas-empty-hint">
          Drag entities and references here, or add notes using the panel on the right.
        </div>
      )}

      {/* Connection Mode Indicator */}
      {connectingFrom && (
        <div className="connection-hint">
          Click another card to connect, or click canvas to cancel
        </div>
      )}
    </div>
  );
}
