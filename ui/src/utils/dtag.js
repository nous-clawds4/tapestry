/**
 * Deterministic d-tag generation for Tapestry events (client-side).
 *
 * Mirrors src/lib/dtag.js on the server. Must produce identical output.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

/**
 * Canonical slug derivation. Must match the server-side version exactly.
 */
export function slug(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * 8-character hash of a string (first 8 hex of SHA-256). Byte-identical to the
 * server's `src/lib/dtag.js` hash8.
 *
 * Uses @noble/hashes rather than SubtleCrypto **on purpose**: `crypto.subtle` is
 * only defined in a secure context, so a plain-HTTP origin (a LAN or Tailscale IP
 * on the dev box, e.g. http://100.x.x.x:8778) has it undefined and every caller
 * threw 'undefined is not an object (evaluating crypto.subtle.digest)'. localhost
 * is a secure context, which is why this only ever failed off-box. @noble/hashes
 * is already in the bundle (nostr-tools depends on it), so this adds no dependency
 * and works in every context.
 */
export function hash8Sync(str) {
  return bytesToHex(sha256(new TextEncoder().encode(str))).slice(0, 8);
}

/**
 * Async wrapper kept for call sites that already await it (signature unchanged).
 */
export async function hash8(str) {
  return hash8Sync(str);
}

/**
 * Synchronous 8-character hash using a simple FNV-like approach.
 * Use hash8() (async) for exact parity with the server. This is for
 * synchronous contexts where exact server match isn't critical (e.g. previews).
 * NOTE: For d-tag generation, always use hash8() to match the server.
 */

/**
 * Deterministic d-tag for a standalone event (e.g. List Header).
 */
export function headerDTag(name, nonce) {
  const base = slug(name);
  return nonce != null ? `${base}~${nonce}` : base;
}

/**
 * Deterministic d-tag for a child event (e.g. List Item, Set).
 * Async because hash8 uses SubtleCrypto.
 */
export async function childDTag(name, parentUuid, nonce) {
  const h = await hash8(parentUuid);
  const base = `${slug(name)}-${h}`;
  return nonce != null ? `${base}~${nonce}` : base;
}

/**
 * Random d-tag (fallback).
 */
export function randomDTag() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse a d-tag to extract base and nonce.
 */
export function parseDTag(dTag) {
  const match = dTag.match(/^(.+)~(\d+)$/);
  if (match) return { base: match[1], nonce: parseInt(match[2], 10) };
  return { base: dTag, nonce: null };
}
