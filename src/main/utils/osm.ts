/**
 * Parses a JSON-encoded OSM tags string into a key-value record.
 * Returns an empty object if the input is null, empty, or invalid JSON.
 */
export function parseOsmTags(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}
