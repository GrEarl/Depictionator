"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type CategoryRow = {
  name: string;
  count: number;
};

type CategoryManagerProps = {
  workspaceId: string;
  categories: CategoryRow[];
};

export function CategoryManager({ workspaceId, categories }: CategoryManagerProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const callApi = async (path: string, payload: Record<string, string>) => {
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
  };

  const handleRename = async (name: string) => {
    const next = window.prompt("New category name", name) ?? "";
    const trimmed = next.trim();
    if (!trimmed || trimmed === name) return;
    setBusy(name);
    try {
      await callApi("/api/categories/rename", { from: name, to: trimmed });
      window.location.reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (name: string) => {
    const ok = window.confirm(`Delete category "${name}" from all articles?`);
    if (!ok) return;
    setBusy(name);
    try {
      await callApi("/api/categories/delete", { name });
      window.location.reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="panel">
      <h2 className="text-xl font-bold">Category Manager</h2>
      <p className="muted mt-2">Rename or remove categories across the workspace.</p>

      <div className="list-sm mt-4">
        {categories.length === 0 && <div className="muted">No categories yet.</div>}
        {categories.map((category) => (
          <div key={category.name} className="list-row-sm items-center">
            <div>
              <div className="font-semibold">{category.name}</div>
              <div className="text-xs muted">{category.count} articles</div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleRename(category.name)}
                disabled={busy === category.name}
              >
                Rename
              </Button>
              <Button
                variant="danger"
                onClick={() => handleDelete(category.name)}
                disabled={busy === category.name}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
