"use client";

import { useState } from "react";
import Link from "next/link";

type ExportItem = {
  id: string;
  type: "entity" | "map" | "board" | "timeline";
  title: string;
};

type PDFBuilderClientProps = {
  workspaceId: string;
  entities: { id: string; title: string; type: string }[];
  maps: { id: string; title: string }[];
  boards: { id: string; name: string }[];
};

export function PDFBuilderClient({
  workspaceId,
  entities,
  maps,
  boards,
}: PDFBuilderClientProps) {
  const [selectedItems, setSelectedItems] = useState<ExportItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [template, setTemplate] = useState("default");
  const [includeCredits, setIncludeCredits] = useState(true);
  const [includeToc, setIncludeToc] = useState(true);
  const [pageNumbers, setPageNumbers] = useState(true);

  const addItem = (item: ExportItem) => {
    if (!selectedItems.find((i) => i.id === item.id && i.type === item.type)) {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const removeItem = (id: string, type: string) => {
    setSelectedItems(selectedItems.filter((i) => !(i.id === id && i.type === type)));
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const newItems = [...selectedItems];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newItems.length) return;
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    setSelectedItems(newItems);
  };

  const handleExport = async () => {
    if (selectedItems.length === 0) {
      alert("Please select at least one item to export");
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch("/api/pdf/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          items: selectedItems,
          options: {
            template,
            includeCredits,
            includeToc,
            pageNumbers,
          },
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `export-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        const error = await response.text();
        alert(`Export failed: ${error}`);
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="pdf-builder-layout">
      {/* Left Panel: Available Items */}
      <aside className="pdf-builder-sidebar">
        <div className="sidebar-section">
          <h3>Entities ({entities.length})</h3>
          <div className="item-list">
            {entities.slice(0, 20).map((entity) => (
              <button
                key={entity.id}
                className="item-chip"
                onClick={() => addItem({ id: entity.id, type: "entity", title: entity.title })}
              >
                <span className="item-type">{entity.type.slice(0, 3)}</span>
                <span className="item-title">{entity.title}</span>
                <span className="item-add">+</span>
              </button>
            ))}
            {entities.length > 20 && (
              <div className="muted text-xs">...and {entities.length - 20} more</div>
            )}
          </div>
        </div>

        <div className="sidebar-section">
          <h3>Maps ({maps.length})</h3>
          <div className="item-list">
            {maps.map((map) => (
              <button
                key={map.id}
                className="item-chip"
                onClick={() => addItem({ id: map.id, type: "map", title: map.title })}
              >
                <span className="item-type">MAP</span>
                <span className="item-title">{map.title}</span>
                <span className="item-add">+</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-section">
          <h3>Boards ({boards.length})</h3>
          <div className="item-list">
            {boards.map((board) => (
              <button
                key={board.id}
                className="item-chip"
                onClick={() => addItem({ id: board.id, type: "board", title: board.name })}
              >
                <span className="item-type">BRD</span>
                <span className="item-title">{board.name}</span>
                <span className="item-add">+</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Center: Export Queue */}
      <main className="pdf-builder-main">
        <div className="export-queue-header">
          <h2>Export Queue ({selectedItems.length} items)</h2>
          {selectedItems.length > 0 && (
            <button
              className="btn-link text-xs"
              onClick={() => setSelectedItems([])}
            >
              Clear all
            </button>
          )}
        </div>

        {selectedItems.length === 0 ? (
          <div className="empty-queue">
            <div className="empty-icon">📄</div>
            <p>Drag items from the left panel to build your PDF</p>
            <p className="muted text-sm">
              Or click on items to add them to the queue
            </p>
          </div>
        ) : (
          <div className="export-queue">
            {selectedItems.map((item, index) => (
              <div key={`${item.type}-${item.id}`} className="queue-item">
                <span className="queue-order">{index + 1}</span>
                <span className={`queue-type type-${item.type}`}>{item.type}</span>
                <span className="queue-title">{item.title}</span>
                <div className="queue-actions">
                  <button
                    className="btn-icon"
                    onClick={() => moveItem(index, "up")}
                    disabled={index === 0}
                  >
                    ↑
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => moveItem(index, "down")}
                    disabled={index === selectedItems.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => removeItem(item.id, item.type)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Right Panel: Options */}
      <aside className="pdf-builder-options">
        <h3>Export Options</h3>

        <div className="option-group">
          <label>Template</label>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="option-select"
          >
            <option value="default">Standard Document</option>
            <option value="compact">Compact (Less spacing)</option>
            <option value="presentation">Presentation Style</option>
            <option value="wiki">Wiki Export</option>
          </select>
        </div>

        <div className="option-group">
          <label className="option-checkbox">
            <input
              type="checkbox"
              checked={includeToc}
              onChange={(e) => setIncludeToc(e.target.checked)}
            />
            Include Table of Contents
          </label>
        </div>

        <div className="option-group">
          <label className="option-checkbox">
            <input
              type="checkbox"
              checked={pageNumbers}
              onChange={(e) => setPageNumbers(e.target.checked)}
            />
            Include Page Numbers
          </label>
        </div>

        <div className="option-group">
          <label className="option-checkbox">
            <input
              type="checkbox"
              checked={includeCredits}
              onChange={(e) => setIncludeCredits(e.target.checked)}
            />
            Include Credits Page (TASL)
          </label>
          <span className="option-hint">
            Required for Wikipedia/Wikimedia content
          </span>
        </div>

        <button
          className="btn-primary btn-export"
          onClick={handleExport}
          disabled={isExporting || selectedItems.length === 0}
        >
          {isExporting ? "Generating PDF..." : `Export PDF (${selectedItems.length} items)`}
        </button>
      </aside>
    </div>
  );
}
