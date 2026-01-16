"use client";

import { useEffect } from "react";

export function DraggableItemsInit() {
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains("draggable-item")) return;

      const type = target.dataset.type || "";
      const id = target.dataset.id || "";
      const title = target.dataset.title || "";

      e.dataTransfer?.setData("type", type);
      e.dataTransfer?.setData("id", id);
      e.dataTransfer?.setData("title", title);

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "copy";
      }
    };

    document.addEventListener("dragstart", handleDragStart);
    return () => document.removeEventListener("dragstart", handleDragStart);
  }, []);

  return null;
}
