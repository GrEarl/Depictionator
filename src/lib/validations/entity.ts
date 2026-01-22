import { z } from "zod";
import { cuid, optionalString, workspaceContext } from "./common";

// EntityType enum values
const EntityType = z.enum([
  "nation",
  "faction",
  "character",
  "location",
  "building",
  "item",
  "event",
  "map",
  "concept"
]);

// EntityStatus enum values
const EntityStatus = z.enum([
  "draft",
  "in_review",
  "approved",
  "deprecated"
]);

// Create entity schema
export const createEntitySchema = workspaceContext.extend({
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
  type: EntityType.default("character"),
  status: EntityStatus.default("draft"),
  aliases: z.string().optional().transform((val) =>
    val ? val.split(",").map(s => s.trim()).filter(Boolean) : []
  ),
  tags: z.string().optional().transform((val) =>
    val ? val.split(",").map(s => s.trim()).filter(Boolean) : []
  ),
  summaryMd: optionalString,
  worldExistFrom: optionalString,
  worldExistTo: optionalString,
  parentEntityId: optionalString,
  storyIntroChapterId: optionalString,
});

// Update entity schema
export const updateEntitySchema = workspaceContext.extend({
  entityId: cuid,
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
  status: EntityStatus.default("draft"),
  aliases: z.string().optional().transform((val) =>
    val ? val.split(",").map(s => s.trim()).filter(Boolean) : []
  ),
  tags: z.string().optional().transform((val) =>
    val ? val.split(",").map(s => s.trim()).filter(Boolean) : []
  ),
  worldExistFrom: optionalString,
  worldExistTo: optionalString,
  storyIntroChapterId: optionalString,
});

// Search entities schema
export const searchEntitiesSchema = workspaceContext.extend({
  query: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
export type SearchEntitiesInput = z.infer<typeof searchEntitiesSchema>;
