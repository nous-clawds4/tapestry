/**
 * Author scope — who signed the event you are looking at (ADR author-scoped-inspection/0002).
 *
 * Pure: no React, no fetch, no module state. The rules live here once so the page, the selectors
 * and the tests all read the same definitions.
 *
 * Two independent axes, composed by intersection:
 *
 *   person     — an account and the assistant this instance issued them, together. Selecting a
 *                person is a VIEW over two identities, never a merge of them: each row still
 *                names its own signer, and the authorType axis separates them on demand.
 *                (BIBLE §31: the Owner is "a correspondent, not an alias".)
 *   authorType — 'anyone' | 'assistants' | 'people' | 'everyone-else'.
 *
 * `assistants` throughout is the roster from GET /api/assistant/roster: rows of
 * { accountPubkey, assistantPubkey, role, displayName }, assistantPubkey null when unprovisioned.
 * It lists only assistants this instance CONTROLS — absence means "not one of ours", never
 * "not an assistant".
 */

/** The pubkeys of assistants this instance controls. */
export function assistantPubkeys(assistants) {
  const out = new Set();
  for (const a of Array.isArray(assistants) ? assistants : []) {
    if (a && typeof a.assistantPubkey === 'string' && a.assistantPubkey) out.add(a.assistantPubkey);
  }
  return out;
}

/** The pubkeys of the accounts those assistants belong to. */
export function accountPubkeys(assistants) {
  const out = new Set();
  for (const a of Array.isArray(assistants) ? assistants : []) {
    if (a && typeof a.accountPubkey === 'string' && a.accountPubkey) out.add(a.accountPubkey);
  }
  return out;
}

/**
 * Classify one author: 'assistant' | 'person' | 'external'.
 *
 * An assistant pubkey is never also an account pubkey, so the two cannot collide — but if a roster
 * ever reported one, 'assistant' wins. Deterministic by decision, not by evaluation order.
 *
 * With an empty roster everyone is 'external'. That is the safe default: a classifier that fell
 * back to 'person' would report the whole relay as local.
 */
export function classifyAuthor(pubkey, assistants) {
  if (assistantPubkeys(assistants).has(pubkey)) return 'assistant';
  if (accountPubkeys(assistants).has(pubkey)) return 'person';
  return 'external';
}

/**
 * The pubkeys one person signs under: their account, plus their assistant when they have one.
 * A null assistant contributes nothing — it must never become a matchable author.
 */
export function personPubkeys(assistants, accountPubkey) {
  if (typeof accountPubkey !== 'string' || !accountPubkey) return [];
  const row = (Array.isArray(assistants) ? assistants : [])
    .find((a) => a && a.accountPubkey === accountPubkey);
  const out = [accountPubkey];
  if (row && typeof row.assistantPubkey === 'string' && row.assistantPubkey) out.push(row.assistantPubkey);
  return out;
}

/**
 * Does this author pass the current selection?
 *
 * `{ person: null, authorType: 'anyone' }` are the no-op values and narrow nothing. The two axes
 * intersect, so a combination can select nothing — one person together with 'everyone-else' always
 * does. That returns false for every author rather than falling back to a wider view; the page
 * reports the empty result and says why.
 */
export function matchesScope(eventPubkey, selection, assistants) {
  const { person = null, authorType = 'anyone' } = selection || {};

  if (person) {
    if (!personPubkeys(assistants, person).includes(eventPubkey)) return false;
  }

  if (authorType && authorType !== 'anyone') {
    const want = authorType === 'everyone-else' ? 'external'
      : authorType === 'assistants' ? 'assistant'
        : authorType === 'people' ? 'person'
          : null;
    if (want === null) return true; // an unknown option narrows nothing rather than hiding everything
    if (classifyAuthor(eventPubkey, assistants) !== want) return false;
  }

  return true;
}
