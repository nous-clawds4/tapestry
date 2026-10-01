/**
 * Viewer author scope — "Me" and "My Local Tapestry Assistant" as Author-selector entries
 * (ADR list-headers-disposition/0001).
 *
 * Pure: no React, no fetch, no module state. `user` is useAuth().user —
 * { pubkey, assistantPubkey, … } or null when signed out — and nothing else. In particular the
 * Owner's Assistant is never an input: a person with no Assistant here resolves My Local Tapestry
 * Assistant to nothing, never to someone else's (the flaw OPEN.md rows
 * `2026-10-01-concept-headers-disposition-owner-signer` and `2026-10-01-new-dlist-assistant-signer`
 * record elsewhere).
 *
 * The two entries carry reserved values, not pubkeys, so a relative entry ("Me") never shares a
 * value with an absolute one ("👑 Owner") that picks the same rows.
 */

const HEX64 = /^[0-9a-f]{64}$/;

export const ME = '@me';
export const MY_ASSISTANT = '@my-assistant';

function isPubkey(value) {
  return typeof value === 'string' && HEX64.test(value);
}

/** The two entries for a signed-in person, in order; none for a visitor who isn't signed in. */
export function viewerAuthorOptions(user) {
  if (!user || !isPubkey(user.pubkey)) return [];
  const hasAssistant = isPubkey(user.assistantPubkey);
  return [
    { value: ME, label: 'Me', disabled: false },
    {
      value: MY_ASSISTANT,
      label: hasAssistant ? 'My Local Tapestry Assistant' : 'My Local Tapestry Assistant (none on this instance)',
      disabled: !hasAssistant,
    },
  ];
}

/**
 * The author pubkey a selector value filters by, or '' for no author filter. A reserved value the
 * current user can't resolve is ''. Any other value is one of today's literal entries and passes
 * through unchanged.
 */
export function resolveAuthorFilter(value, user) {
  const signedIn = Boolean(user) && isPubkey(user.pubkey);
  if (value === ME) return signedIn ? user.pubkey : '';
  if (value === MY_ASSISTANT) return signedIn && isPubkey(user.assistantPubkey) ? user.assistantPubkey : '';
  return value || '';
}
