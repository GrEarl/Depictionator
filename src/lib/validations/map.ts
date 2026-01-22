import { z } from "zod";
import { cuid, optionalString, workspaceContext } from "./common";

// LocationType enum
const LocationType = z.enum([
  "capital", "city", "village", "fortress", "dungeon", "ruin",
  "landmark", "region", "outpost", "camp", "port", "temple",
  "mine", "gate", "road", "other"
]);

// MarkerShape enum
const MarkerShape = z.enum([
  "circle", "square", "diamond", "triangle", "hex", "star"
]);

// TruthFlag enum
const TruthFlag = z.enum([
  "canonical", "rumor", "mistaken", "propaganda", "unknown"
]);

// ArrowStyle enum
const ArrowStyle = z.enum(["arrow", "dashed", "dotted"]);

// Create map schema
export const createMapSchema = workspaceContext.extend({
  title: z.string().min(1, "Title is required").max(300, "Title too long"),
  description: optionalString,
  parentMapId: optionalString,
  crs: z.string().default("simple"),
});

// Update map schema
export const updateMapSchema = workspaceContext.extend({
  mapId: cuid,
  title: z.string().min(1, "Title is required").max(300, "Title too long"),
  description: optionalString,
  showPathOrder: z.coerce.boolean().optional(),
});

// Create pin schema
export const createPinSchema = workspaceContext.extend({
  mapId: cuid,
  x: z.coerce.number(),
  y: z.coerce.number(),
  label: optionalString,
  entityId: optionalString,
  entityQuery: optionalString,
  locationType: LocationType.default("other"),
  markerStyleId: optionalString,
  markerShape: MarkerShape.optional(),
  markerColor: optionalString,
  layerId: optionalString,
  worldFrom: optionalString,
  worldTo: optionalString,
  storyFromChapterId: optionalString,
  storyToChapterId: optionalString,
  viewpointId: optionalString,
  truthFlag: TruthFlag.default("canonical"),
});

// Update pin schema
export const updatePinSchema = workspaceContext.extend({
  pinId: cuid,
  x: z.coerce.number().optional(),
  y: z.coerce.number().optional(),
  label: optionalString,
  entityId: optionalString,
  locationType: LocationType.optional(),
  markerStyleId: optionalString,
  markerShape: MarkerShape.optional(),
  markerColor: optionalString,
  layerId: optionalString,
  worldFrom: optionalString,
  worldTo: optionalString,
  viewpointId: optionalString,
  truthFlag: TruthFlag.optional(),
});

// Delete pin schema
export const deletePinSchema = workspaceContext.extend({
  pinId: cuid,
});

// Create path schema
export const createPathSchema = workspaceContext.extend({
  mapId: cuid,
  polyline: z.string().transform((val) => {
    try {
      return JSON.parse(val) as { x: number; y: number }[];
    } catch {
      return [];
    }
  }),
  label: optionalString,
  arrowStyle: ArrowStyle.default("arrow"),
  strokeColor: optionalString,
  strokeWidth: z.coerce.number().optional(),
  markerStyleId: optionalString,
  layerId: optionalString,
  eventId: optionalString,
});

// Create map layer schema
export const createMapLayerSchema = workspaceContext.extend({
  mapId: cuid,
  name: z.string().min(1, "Name is required"),
  description: optionalString,
  isDefault: z.coerce.boolean().default(false),
  eraId: optionalString,
  viewpointId: optionalString,
});

// Create map scene schema
export const createMapSceneSchema = workspaceContext.extend({
  mapId: cuid,
  name: z.string().min(1, "Name is required"),
  description: optionalString,
  chapterId: optionalString,
  eraId: optionalString,
  viewpointId: optionalString,
  state: z.string().optional().transform((val) => {
    if (!val) return {};
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }),
});

export type CreateMapInput = z.infer<typeof createMapSchema>;
export type UpdateMapInput = z.infer<typeof updateMapSchema>;
export type CreatePinInput = z.infer<typeof createPinSchema>;
export type UpdatePinInput = z.infer<typeof updatePinSchema>;
export type DeletePinInput = z.infer<typeof deletePinSchema>;
export type CreatePathInput = z.infer<typeof createPathSchema>;
export type CreateMapLayerInput = z.infer<typeof createMapLayerSchema>;
export type CreateMapSceneInput = z.infer<typeof createMapSceneSchema>;
