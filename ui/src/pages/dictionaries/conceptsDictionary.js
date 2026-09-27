import { useEffect, useState } from 'react';

/**
 * Dictionary › Concepts, version 1 — what the list and its entry page share
 * (handoff SPEC § 2). The data source is GET /api/trusted-dictionary
 * (ADR shared-concepts-adoption/0005). The server assembles every number:
 * each entry's `gum` is the value of the metric the response names in
 * `metric` ("gum1" in v1). Nothing here re-derives that arithmetic (SPEC § 4).
 */

export const CONCEPTS_DICTIONARY_PATH = '/tapestry/dictionaries/concepts';
export const NEW_CONCEPT_PATH = '/tapestry/concepts/new';
export const entryPath = (coord) => `${CONCEPTS_DICTIONARY_PATH}/${encodeURIComponent(coord)}`;

// The metrics the server can name. Version 1 ships GUM₁ only; GUM₂ and GUM₃
// (SPEC § 4) add their labels here when the server starts reporting them.
const METRICS = {
  gum1: { short: 'GUM₁', label: 'GUM₁ · trusted authors' },
};
export const metricShort = (metric) => METRICS[metric]?.short || 'Usage';
export const metricLabel = (metric) => METRICS[metric]?.label || 'Usage';

// The owner's override of the community (SPEC § 2.1). It arrives with Pins
// (version 2); until then the server returns override: null and no badge shows.
export const OVERRIDE_BADGES = {
  added: { label: 'Added by you +', className: 'dict-badge dict-badge--added' },
  vetoed: { label: 'Vetoed by you −', className: 'dict-badge dict-badge--vetoed' },
};
export const overrideBadge = (entry) => OVERRIDE_BADGES[entry?.override] || null;

/** "kind:pubkey:d" → parts; d may itself contain colons. */
export function coordParts(coord) {
  const [kind, pubkey, ...rest] = String(coord || '').split(':');
  return { kind, pubkey, d: rest.join(':') };
}

/** The singular name, else the header's d-tag. */
export const displayName = (entry) => entry?.name || coordParts(entry?.coord).d || entry?.coord || '';

export function itemCountText(n) {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${n.toLocaleString()} ${n === 1 ? 'item' : 'items'}`;
}

/** One line on whose point of view scored the list (the TrustedDictionary wording). */
export function povLine(pov) {
  if (!pov) return '';
  if (pov.branch === 'personalized') return 'Scored from your point of view.';
  if (pov.fellBackToHouse) {
    return 'Your personalized scores are not computed on this instance, so this shows the house point of view.';
  }
  return 'Scored from the house point of view.';
}

/** A readable author label: your Assistant, a profile name, or a short pubkey. */
export function authorLabel(pubkey, { taPubkey, profiles } = {}) {
  if (!pubkey) return '';
  if (taPubkey && pubkey === taPubkey) return 'your Assistant';
  const p = profiles?.[pubkey];
  const name = p && typeof p === 'object' ? (p.display_name || p.name) : null;
  return name || `${pubkey.slice(0, 8)}…`;
}

/**
 * GET /api/trusted-dictionary for the active point of view (the usePov()
 * read params, as TrustedDictionary passes them). Returns
 * { data: { entries, metric, pov } | null, error }. Pass enabled:false to skip
 * the read (the entry page already holds the row it was opened from).
 */
export function useTrustedDictionary(povParams, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const wotPov = povParams?.wotPov;
  const userPubkey = povParams?.userPubkey;

  useEffect(() => {
    if (!enabled) return undefined;
    const params = new URLSearchParams();
    if (wotPov) params.set('wotPov', wotPov);
    if (userPubkey) params.set('userPubkey', userPubkey);
    const query = params.toString() ? `?${params}` : '';
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`/api/trusted-dictionary${query}`);
        const json = await resp.json();
        if (!resp.ok || json.success === false) throw new Error(json.error || `HTTP ${resp.status}`);
        if (!cancelled) {
          setError(null);
          setData({ entries: json.entries || [], metric: json.metric || 'gum1', pov: json.pov || {} });
        }
      } catch (err) {
        if (!cancelled) { setError(err.message); setData({ entries: [], metric: 'gum1', pov: {} }); }
      }
    })();
    return () => { cancelled = true; };
  }, [wotPov, userPubkey, enabled]);

  return { data, error };
}

/**
 * The owner's shared concepts — GET /api/shared-by-me, the source of the
 * "Shared by you" marker and the Shared by me filter (SPEC § 1). coords is
 * null until it loads. A failed read sets `failed`: the filter must then say
 * "unknown" rather than 0, which would claim the owner has shared nothing.
 */
export function useSharedByMe() {
  const [state, setState] = useState({ coords: null, failed: false });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/shared-by-me');
        const json = await resp.json().catch(() => null);
        if (!resp.ok || !json?.success) throw new Error(json?.error || `HTTP ${resp.status}`);
        if (!cancelled) setState({ coords: new Set((json.concepts || []).map((c) => c.coord)), failed: false });
      } catch {
        if (!cancelled) setState({ coords: new Set(), failed: true });
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return state;
}
