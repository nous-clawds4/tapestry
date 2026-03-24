/**
 * LMDB resolution utilities for the UI.
 */

export function isLmdbRef(value) {
  return typeof value === 'string' && value.startsWith('lmdb:');
}

/**
 * Resolve a value that may be an LMDB ref or inline JSON.
 * Returns the parsed object, or null if resolution fails.
 */
export async function resolveJsonValue(raw) {
  if (!raw) return null;

  if (isLmdbRef(raw)) {
    const key = raw.replace('lmdb:', '');
    try {
      const resp = await fetch(`/api/tapestry-key/${key}`);
      const d = await resp.json();
      return d.success ? d.data?.data : null;
    } catch {
      return null;
    }
  }

  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch {}
  try { return JSON.parse(raw.replace(/""/g, '"')); } catch {}
  return null;
}
