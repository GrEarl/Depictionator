export function parseCsv(input: FormDataEntryValue | null) {
  if (!input) return [];
  const value = String(input)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(value));
}

export function parseOptionalString(input: FormDataEntryValue | null) {
  const value = String(input ?? "").trim();
  return value ? value : null;
}

export function parseOptionalInt(input: FormDataEntryValue | null) {
  const value = String(input ?? "").trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseOptionalFloat(input: FormDataEntryValue | null) {
  const value = String(input ?? "").trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
