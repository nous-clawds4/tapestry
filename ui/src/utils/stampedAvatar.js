import { buildCompositeAvatar } from './compositeAvatar.js';

/**
 * The stamped avatar, as the browser makes it (assistant-profile-checklist #3, ADR 0003 sub-decision 7): the signed-in
 * person's own picture, fetched same-origin from /api/assistant/my-picture and stamped with the brand mark, then stored
 * on this instance. One flow for the Edit Assistant Profile page and the checklist's avatar panel, so both make the
 * same pixels by the same path. Nothing here publishes a profile; each caller does that its own way.
 *
 * Every failure comes back as a reason the callers word for themselves, with the server's own sentence in `message`:
 *   no-picture · unfetchable · not-stampable (the proxy's codes; a picture the browser cannot decode is not-stampable
 *   too, with stage 'build') · too-many (the store's daily limit) · refused (401/403) · no-public-address (stored, but
 *   this instance has no address a stranger could load it from) · failed (anything else).
 *
 * Loads in Node (relative imports with .js), so test/assistant-stamped-avatar-for-everyone.test.js can read reasonOf.
 */

const CODES = ['no-picture', 'unfetchable', 'not-stampable', 'too-many'];

/** The reason for a refused answer, from its status and body. */
export function reasonOf(status, body) {
  const code = body && typeof body === 'object' ? body.code : null;
  if (CODES.includes(code)) return code;
  if (status === 401 || status === 403) return 'refused';
  return 'failed';
}

/**
 * Fetch the person's own picture and stamp it. Stores nothing.
 * @returns {Promise<{ ok: true, composite: { blob: Blob, dataUrl: string } } | { ok: false, reason: string, message: string, stage?: 'build' }>}
 */
export async function stampMyPicture() {
  let res;
  try {
    res = await fetch('/api/assistant/my-picture');
  } catch (err) {
    return { ok: false, reason: 'failed', message: (err && err.message) || String(err) };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return { ok: false, reason: reasonOf(res.status, body), message: (body && body.error) || `the server answered ${res.status}` };
  }
  try {
    return { ok: true, composite: await buildCompositeAvatar(await res.blob()) };
  } catch (err) {
    return { ok: false, reason: 'not-stampable', stage: 'build', message: (err && err.message) || String(err) };
  }
}

/**
 * Store an accepted composite on this instance.
 * @returns {Promise<{ ok: true, url: string, path: string } | { ok: false, reason: string, message: string, path?: string }>}
 */
export async function storeStampedAvatar(blob) {
  try {
    const body = new FormData();
    body.append('avatar', blob, 'ta-avatar.png');
    const res = await fetch('/api/assistant/avatar', { method: 'POST', body });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.success !== true) {
      return { ok: false, reason: reasonOf(res.status, data), message: (data && data.error) || `the server answered ${res.status}` };
    }
    // Only a publishable URL may go into a profile: with no public address the instance returns none, and the
    // relative path would be dead for everyone else.
    if (!data.url) return { ok: false, reason: 'no-public-address', message: '', path: data.path };
    return { ok: true, url: data.url, path: data.path };
  } catch (err) {
    return { ok: false, reason: 'failed', message: (err && err.message) || String(err) };
  }
}
