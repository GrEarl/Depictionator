import { z } from "zod";
import { cuid, optionalString, workspaceContext } from "./common";

// RevisionStatus enum values
const RevisionStatus = z.enum([
  "draft",
  "submitted",
  "approved",
  "rejected"
]);

// Create article schema
export const createArticleSchema = workspaceContext.extend({
  entityId: cuid,
  bodyMd: z.string().min(1, "Article body is required"),
  summary: optionalString,
});

// Update article schema
export const updateArticleSchema = workspaceContext.extend({
  entityId: cuid,
  bodyMd: z.string().min(1, "Article body is required"),
  summary: optionalString,
  wikiCategories: optionalString,
  wikiTemplates: optionalString,
});

// Create revision schema
export const createRevisionSchema = workspaceContext.extend({
  articleId: cuid,
  bodyMd: z.string().min(1, "Revision body is required"),
  summary: optionalString,
  status: RevisionStatus.default("draft"),
});

// Submit revision for review
export const submitRevisionSchema = workspaceContext.extend({
  revisionId: cuid,
});

// Rename article schema
export const renameArticleSchema = workspaceContext.extend({
  entityId: cuid,
  newTitle: z.string().min(1, "New title is required").max(500, "Title too long"),
  createRedirect: z.coerce.boolean().default(true),
});

// Delete article schema (soft delete)
export const deleteArticleSchema = workspaceContext.extend({
  entityId: cuid,
  reason: optionalString,
});

// Protect article schema
export const protectArticleSchema = workspaceContext.extend({
  entityId: cuid,
  level: z.enum(["none", "autoconfirmed", "admin"]).default("none"),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type CreateRevisionInput = z.infer<typeof createRevisionSchema>;
export type SubmitRevisionInput = z.infer<typeof submitRevisionSchema>;
export type RenameArticleInput = z.infer<typeof renameArticleSchema>;
export type DeleteArticleInput = z.infer<typeof deleteArticleSchema>;
export type ProtectArticleInput = z.infer<typeof protectArticleSchema>;
