import { z } from "zod";
import { cuid, optionalString, workspaceContext } from "./common";

// EvidenceItemType enum
const EvidenceItemType = z.enum([
  "entity", "asset", "reference", "note", "url", "quote", "frame"
]);

// EvidenceLinkStyle enum
const EvidenceLinkStyle = z.enum(["line", "arrow", "dashed", "dotted"]);

// Create evidence board schema
export const createEvidenceBoardSchema = workspaceContext.extend({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  description: optionalString,
});

// Update evidence board schema
export const updateEvidenceBoardSchema = workspaceContext.extend({
  boardId: cuid,
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  description: optionalString,
});

// Create evidence item schema
export const createEvidenceItemSchema = workspaceContext.extend({
  boardId: cuid,
  type: EvidenceItemType.default("note"),
  title: optionalString,
  content: optionalString,
  url: optionalString,
  entityId: optionalString,
  assetId: optionalString,
  referenceId: optionalString,
  x: z.coerce.number(),
  y: z.coerce.number(),
  width: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  rotation: z.coerce.number().optional(),
  zIndex: z.coerce.number().optional(),
  data: z.string().optional().transform((val) => {
    if (!val) return undefined;
    try {
      return JSON.parse(val);
    } catch {
      return undefined;
    }
  }),
});

// Update evidence item schema
export const updateEvidenceItemSchema = workspaceContext.extend({
  itemId: cuid,
  x: z.coerce.number().optional(),
  y: z.coerce.number().optional(),
  width: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  rotation: z.coerce.number().optional(),
  zIndex: z.coerce.number().optional(),
  title: optionalString,
  content: optionalString,
});

// Create evidence link schema
export const createEvidenceLinkSchema = workspaceContext.extend({
  boardId: cuid,
  fromItemId: cuid,
  toItemId: cuid,
  label: optionalString,
  style: EvidenceLinkStyle.default("arrow"),
});

// Update evidence link schema
export const updateEvidenceLinkSchema = workspaceContext.extend({
  linkId: cuid,
  label: optionalString,
  style: EvidenceLinkStyle.optional(),
});

export type CreateEvidenceBoardInput = z.infer<typeof createEvidenceBoardSchema>;
export type UpdateEvidenceBoardInput = z.infer<typeof updateEvidenceBoardSchema>;
export type CreateEvidenceItemInput = z.infer<typeof createEvidenceItemSchema>;
export type UpdateEvidenceItemInput = z.infer<typeof updateEvidenceItemSchema>;
export type CreateEvidenceLinkInput = z.infer<typeof createEvidenceLinkSchema>;
export type UpdateEvidenceLinkInput = z.infer<typeof updateEvidenceLinkSchema>;
