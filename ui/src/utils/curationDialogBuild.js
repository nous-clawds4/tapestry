import { nip19 } from 'nostr-tools';

/**
 * search-index-selection #4 — the curation blob the pin dialog builds, as pure logic.
 *
 * This is the build rule that used to live inline in `CurationMethodDialog.jsx`
 * (`handleSubmit`). It moved here unchanged so the blob an untouched confirm-step
 * publishes can be compared, in plain node, against `defaultCurationMethod`
 * (the wire contract, `ui/src/utils/publishTagPin.js`). No JSX, no React.
 *
 * The dialog keeps its `useState` wiring and calls `buildCuration(state)`; there is
 * no second copy of this rule in the JSX.
 */

export function normalizeObserver(raw, viewerPubkey) {
  const trimmed = (raw || '').trim();
  if (trimmed === '') return { ok: true, value: viewerPubkey };
  if (/^[0-9a-f]{64}$/.test(trimmed)) return { ok: true, value: trimmed };
  if (trimmed.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'npub' && typeof decoded.data === 'string') {
        return { ok: true, value: decoded.data };
      }
    } catch { /* fall through */ }
  }
  return { ok: false, error: 'Must be a 64-char hex pubkey or a valid npub.' };
}

export function normalizeCutoff(raw) {
  const trimmed = (raw || '').trim();
  if (trimmed === '') return { ok: false, error: 'Cutoff must be a positive integer.' };
  if (!/^-?\d+$/.test(trimmed)) {
    return { ok: false, error: 'Cutoff must be a positive integer.' };
  }
  const n = parseInt(trimmed, 10);
  if (!Number.isInteger(n) || n < 1) {
    return { ok: false, error: 'Cutoff must be a positive integer.' };
  }
  return { ok: true, value: n };
}

/**
 * Build the curation blob from the dialog's form state.
 *
 *   returns { ok: true, curation }             on success
 *           { ok: false, fieldErrors }         on validation failure (nothing may be signed)
 */
export function buildCuration(state) {
  const {
    observer,
    viewerPubkey,
    cutoff,
    includeScoreInTL,
    method,
    includeProfiles,
    includeNotes,
    includeItems,
    noteMethod,
    authorConstraint,
    rawAuthorConstraint,
    authorConstraintTouched,
    membershipMethod,
    rawMembershipMethod,
    membershipMethodTouched,
  } = state || {};

  const errs = {};
  const cutoffR = normalizeCutoff(cutoff);
  if (!cutoffR.ok) errs.cutoff = cutoffR.error;
  const observerR = normalizeObserver(observer, viewerPubkey);
  if (!observerR.ok) errs.observer = observerR.error;
  // Method enum check (defensive; the picker prevents bad values).
  if (method !== 'nip85:rank') errs.method = 'Only nip85:rank is supported in v1.';
  const targetTypes = [];
  if (includeProfiles) targetTypes.push('profile');
  if (includeNotes) targetTypes.push('note');
  if (includeItems) targetTypes.push('item');
  if (targetTypes.length === 0) errs.targetTypes = 'Select at least one: profiles, notes, or items.';
  if (Object.keys(errs).length > 0) return { ok: false, fieldErrors: errs };

  const effectiveAuthorConstraint = authorConstraintTouched
    ? authorConstraint
    : (rawAuthorConstraint || '');
  const effectiveMembershipMethod = membershipMethodTouched
    ? membershipMethod
    : (rawMembershipMethod || '');

  return {
    ok: true,
    curation: {
      observer: observerR.value,
      method: 'nip85:rank',
      cutoff: cutoffR.value,
      includeScoreInTL: !!includeScoreInTL,
      // Story 12 / ADR 0015
      targetTypes,
      noteMethod,
      // search-index-selection ADR 0001 §3 — included ONLY when the scope is
      // narrowed, so editing a pre-story pin reproduces today's blob exactly
      // (E3). An untouched control re-emits whatever the pin already carried.
      ...(effectiveAuthorConstraint ? { authorConstraint: effectiveAuthorConstraint } : {}),
      // search-index-selection ADR 0002 §3 — included ONLY when the pin names a
      // method; absent stays absent, so a pre-story pin's blob round-trips
      // byte-identically and keeps following the instance dial.
      ...(effectiveMembershipMethod ? { membershipMethod: effectiveMembershipMethod } : {}),
    },
  };
}
