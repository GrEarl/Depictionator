import { z } from "zod";

// Common validation helpers
export const cuid = z.string().min(1, "ID is required");
export const optionalCuid = z.string().optional();
export const requiredString = z.string().min(1, "This field is required");
export const optionalString = z.string().optional();
export const optionalNumber = z.coerce.number().optional();
export const optionalBoolean = z.coerce.boolean().optional();

// CSV string to array
export const csvToArray = z.string().transform((val) =>
  val.split(",").map(s => s.trim()).filter(Boolean)
);

// Workspace context (required for most operations)
export const workspaceContext = z.object({
  workspaceId: cuid,
});

// Pagination
export const pagination = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// Helper to validate FormData
export function validateFormData<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData
): z.infer<T> {
  const obj: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    obj[key] = value;
  });
  return schema.parse(obj);
}

// Helper for safe validation (returns result object)
export function safeValidateFormData<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData
): z.SafeParseReturnType<unknown, z.infer<T>> {
  const obj: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    obj[key] = value;
  });
  return schema.safeParse(obj);
}
