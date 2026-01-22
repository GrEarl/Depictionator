import { z } from "zod";
import { cuid, optionalString, workspaceContext } from "./common";

// ReferenceType enum
const ReferenceType = z.enum([
  "url", "book", "pdf", "image", "file", "internal", "other"
]);

// CitationTargetType enum
const CitationTargetType = z.enum([
  "article_revision", "overlay_revision", "entity", "map",
  "event", "timeline", "board_item", "evidence_board"
]);

// Create reference schema
export const createReferenceSchema = workspaceContext.extend({
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
  type: ReferenceType.default("url"),
  url: optionalString,
  author: optionalString,
  publishedYear: z.coerce.number().optional(),
  publisher: optionalString,
  isbn: optionalString,
  doi: optionalString,
  notes: optionalString,
  licenseId: optionalString,
  licenseUrl: optionalString,
});

// Update reference schema
export const updateReferenceSchema = workspaceContext.extend({
  referenceId: cuid,
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
  type: ReferenceType.optional(),
  url: optionalString,
  author: optionalString,
  publishedYear: z.coerce.number().optional(),
  publisher: optionalString,
  notes: optionalString,
});

// Create citation schema
export const createCitationSchema = workspaceContext.extend({
  referenceId: cuid,
  targetType: CitationTargetType,
  targetId: cuid,
  page: optionalString,
  quote: optionalString,
  notes: optionalString,
});

// Update citation schema
export const updateCitationSchema = workspaceContext.extend({
  citationId: cuid,
  page: optionalString,
  quote: optionalString,
  notes: optionalString,
});

export type CreateReferenceInput = z.infer<typeof createReferenceSchema>;
export type UpdateReferenceInput = z.infer<typeof updateReferenceSchema>;
export type CreateCitationInput = z.infer<typeof createCitationSchema>;
export type UpdateCitationInput = z.infer<typeof updateCitationSchema>;
