/**
 * Pure author-display core for pubkey dropdowns and author labels.
 * ADR: engineering-team/decisions/graph-curation-ui/0002-shared-author-display-util.md
 *
 * PROFILES ARE A PLAIN OBJECT, not a Map. `useProfiles` holds its state as
 * useState({}) and returns that object — read it with `profiles?.[pubkey]`.
 * Reading it with `.get()` throws "TypeError: _?.get is not a function", and
 * optional chaining does not save you: `{}` is truthy, so `.get` is looked up
 * and invoked. That threw inside a render and took out the whole route
 * (OPEN.md row 222). This module exists so there is one place to get it right.
 *
 * Every identity is a PARAMETER, never a literal — the Tapestry Assistant
 * pubkey is per-deployment and callers resolve it at runtime (CLAUDE.md).
 *
 * No React, no fetch, no side effects — this module is executed directly by
 * the Node test runner.
 */

/**
 * Human-readable label for a pubkey, badged when it is a known identity.
 *
 * @param {Object}  args
 * @param {Object}  [args.profiles]     Plain object keyed by pubkey → profile (or null/absent).
 * @param {string}  args.pubkey         The pubkey to label.
 * @param {string}  [args.ownerPubkey]  This instance's owner.
 * @param {string}  [args.taPubkey]     This instance's Tapestry Assistant (runtime-resolved).
 * @param {string}  [args.davePubkey]   Dave's pubkey.
 * @returns {string} e.g. "👑 Nous", "🤖 Assistant (11f23fe4…)", "Alice (abcdef01…)", "abcdef01…"
 */
export function authorDisplayName({ profiles, pubkey, ownerPubkey, taPubkey, davePubkey } = {}) {
  // Guard first: without this, an undefined pubkey would compare equal to an
  // undefined ownerPubkey below and wrongly earn the owner's crown.
  if (!pubkey || typeof pubkey !== 'string') return '';

  const p = profiles?.[pubkey];
  const name = p?.name || p?.display_name;
  const short = pubkey.slice(0, 8) + '…';

  if (ownerPubkey && pubkey === ownerPubkey) return name ? `👑 ${name}` : `👑 Owner (${short})`;
  if (davePubkey && pubkey === davePubkey) return name ? `🧑‍💻 ${name}` : `🧑‍💻 Dave (${short})`;
  if (taPubkey && pubkey === taPubkey) return name ? `🤖 ${name}` : `🤖 Assistant (${short})`;
  return name ? `${name} (${short})` : short;
}
