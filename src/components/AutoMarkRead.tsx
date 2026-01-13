"use client";

import { useEffect } from "react";

type AutoMarkReadProps = {
  workspaceId: string;
  targetType: string;
  targetId: string;
  lastReadRevisionId?: string | null;
};

export function AutoMarkRead({
  workspaceId,
  targetType,
  targetId,
  lastReadRevisionId
}: AutoMarkReadProps) {
  useEffect(() => {
    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("targetType", targetType);
    form.append("targetId", targetId);
    if (lastReadRevisionId) {
      form.append("lastReadRevisionId", lastReadRevisionId);
    }
    fetch("/api/read-state/mark", { method: "POST", body: form }).catch(() => {});
  }, [workspaceId, targetType, targetId, lastReadRevisionId]);

  return null;
}
