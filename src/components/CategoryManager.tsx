"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

type CategoryRow = {
  name: string;
  count: number;
};

type EntityRow = {
  id: string;
  title: string;
  type: string;
};

type CategoryManagerProps = {
  workspaceId: string;
  categories: CategoryRow[];
};

export function CategoryManager({ workspaceId, categories }: CategoryManagerProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [entityQuery, setEntityQuery] = useState("");
  const [entityResults, setEntityResults] = useState<EntityRow[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<EntityRow[]>([]);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const callApi = async (path: string, payload: Record<string, unknown>) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, ...payload })
    });
    if (!res.ok) {
      let message = "";
      try {
        const data = await res.json();
        message = data?.error ? String(data.error) : JSON.stringify(data);
      } catch {
        message = await res.text();
      }
      throw new Error(message || "Request failed");
    }
    return res.json().catch(() => ({}));
  };

  useEffect(() => {
    if (!entityQuery.trim()) {
      setEntityResults([]);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch("/api/entities/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, query: entityQuery.trim(), limit: 8 })
        });
        const data = await res.json();
        if (!cancelled) {
          setEntityResults(Array.isArray(data.items) ? data.items : []);
        }
      } catch {
        if (!cancelled) setEntityResults([]);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [entityQuery, workspaceId]);

  const selectedIds = useMemo(() => new Set(selectedEntities.map((item) => item.id)), [selectedEntities]);

  const handleAddEntity = (entity: EntityRow) => {
    setSelectedEntities((prev) => (prev.some((item) => item.id === entity.id) ? prev : [...prev, entity]));
  };

  const handleRemoveEntity = (entityId: string) => {
    setSelectedEntities((prev) => prev.filter((item) => item.id !== entityId));
  };

  const handleCreateCategory = async () => {
    const trimmed = createName.trim();
    if (!trimmed) {
      setStatus("Category name is required.");
      return;
    }
    if (selectedEntities.length === 0) {
      setStatus("Select at least one entity to apply this category.");
      return;
    }
    setBusy("create");
    setStatus(null);
    try {
      await callApi("/api/categories/apply", {
        name: trimmed,
        entityIds: selectedEntities.map((item) => item.id)
      });
      window.location.reload();
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const startRename = (name: string) => {
    setRenameTarget(name);
    setRenameDraft(name);
    setDeleteTarget(null);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const next = renameDraft.trim();
    if (!next || next === renameTarget) {
      setRenameTarget(null);
      return;
    }
    setBusy(renameTarget);
    setStatus(null);
    try {
      await callApi("/api/categories/rename", { from: renameTarget, to: next });
      window.location.reload();
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (name: string) => {
    setBusy(name);
    setStatus(null);
    try {
      await callApi("/api/categories/delete", { name });
      window.location.reload();
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="panel">
        <h2 className="text-xl font-bold">Category Manager</h2>
        <p className="muted mt-2">Create, rename, or remove category tags across the workspace.</p>

        {status && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {status}
          </div>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-widest text-muted">Category name</label>
            <input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="e.g., Factions, Mythology"
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg outline-none focus:ring-2 focus:ring-accent text-sm"
            />
            <div className="text-xs text-muted">
              Categories are tags applied to entities. Pick entities to attach this category.
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-widest text-muted">Search entities</label>
            <input
              value={entityQuery}
              onChange={(event) => setEntityQuery(event.target.value)}
              placeholder="Search by title, alias, or tag"
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg outline-none focus:ring-2 focus:ring-accent text-sm"
            />
            <div className="grid gap-2 md:grid-cols-2">
              {entityResults.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleAddEntity(item)}
                  className={`text-left rounded-lg border px-3 py-2 text-sm transition ${
                    selectedIds.has(item.id)
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-bg hover:border-accent/40"
                  }`}
                >
                  <div className="font-semibold">{item.title}</div>
                  <div className="text-xs text-muted uppercase tracking-widest">{item.type}</div>
                </button>
              ))}
              {entityQuery && entityResults.length === 0 && (
                <div className="text-xs text-muted">No entities found.</div>
              )}
            </div>
          </div>
        </div>

        {selectedEntities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedEntities.map((entity) => (
              <button
                type="button"
                key={entity.id}
                onClick={() => handleRemoveEntity(entity.id)}
                className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold hover:border-accent/40"
                title="Remove"
              >
                {entity.title}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="primary"
            onClick={handleCreateCategory}
            disabled={busy === "create"}
          >
            Apply Category
          </Button>
          <span className="text-xs text-muted">Applies the category to the selected entities.</span>
        </div>
      </div>

      <div className="panel">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Existing Categories</h3>
            <p className="muted mt-1">Rename or delete categories across all articles.</p>
          </div>
          <div className="text-xs text-muted">{categories.length} total</div>
        </div>

        <div className="list-sm mt-4">
          {categories.length === 0 && <div className="muted">No categories yet.</div>}
          {categories.map((category) => (
            <div key={category.name} className="list-row-sm items-center gap-3">
              <div className="flex-1">
                {renameTarget === category.name ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      className="w-full px-2 py-1 rounded border border-border bg-bg text-sm"
                    />
                    <Button variant="outline" onClick={handleRename} disabled={busy === category.name}>
                      Save
                    </Button>
                    <Button variant="ghost" onClick={() => setRenameTarget(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="font-semibold">{category.name}</div>
                    <div className="text-xs muted">{category.count} articles</div>
                  </>
                )}
              </div>
              {renameTarget !== category.name && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => startRename(category.name)}
                    disabled={busy === category.name}
                  >
                    Rename
                  </Button>
                  {deleteTarget === category.name ? (
                    <>
                      <Button
                        variant="danger"
                        onClick={() => handleDelete(category.name)}
                        disabled={busy === category.name}
                      >
                        Confirm
                      </Button>
                      <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={() => setDeleteTarget(category.name)}
                      disabled={busy === category.name}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
