import { useEffect, useMemo, useState } from 'react';
import { useAssistantRoster } from '../../context/AssistantRosterContext';
import { defaultPersonFor, personPubkeys, scopeRosterFor } from '../../utils/authorScope';

/**
 * Dictionary › Concepts — what the list and its entry page share (handoff
 * SPEC § 2, as corrected by the owner on 2026-09-29).
 *
 * The rows are one person's dictionary: their concept headers that carry a
 * real b-tag — exactly what Active b-tags lists under "Mine". The person is
 * resolved here as Active b-tags resolves it (utils/authorScope): the
 * signed-in reader, their account and the assistant this instance issued
 * them; signed out, the owner. The data source is GET /api/dictionaries/concepts.
 * The server assembles every number: each entry's `gum` is the value of the
 * metric the response names in `metric` ("gum1"), for the shared concept the
 * entry points to. Nothing here re-derives that arithmetic (SPEC § 4).
 */

export const CONCEPTS_DICTIONARY_PATH = '/tapestry/dictionaries/concepts';
export const NEW_CONCEPT_PATH = '/tapestry/concepts/new';
export const entryPath = (coord) => `${CONCEPTS_DICTIONARY_PATH}/${encodeURIComponent(coord)}`;

// The same list in the Brainstorm design's styling, outside the control panel (pages/dictionary/).
export const DICTIONARY_PATH = '/dictionary';
export const dictionaryEntryPath = (coord) => `${DICTIONARY_PATH}/${encodeURIComponent(coord)}`;

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

/** A readable author label: the person's own Assistant, a profile name, or a short pubkey. */
export function authorLabel(pubkey, { assistantPubkey, assistantLabel = 'your Assistant', profiles } = {}) {
  if (!pubkey) return '';
  if (assistantPubkey && pubkey === assistantPubkey) return assistantLabel;
  const p = profiles?.[pubkey];
  const name = p && typeof p === 'object' ? (p.display_name || p.name) : null;
  return name || `${pubkey.slice(0, 8)}…`;
}

/**
 * Whose Dictionary this is. `authors` is what the server reads: the person's
 * account and, when they have one, their assistant. `signedIn` false means
 * the page is showing the owner's. `isOwner` is true when the signed-in
 * reader owns this instance; only they can add from the finder in this
 * version (the b-disposition writes are owner-only).
 */
export function useDictionaryPerson() {
  const { assistants, viewer, loading } = useAssistantRoster();
  return useMemo(() => {
    if (loading) return { loading: true, account: null, assistant: null, authors: [], signedIn: false, isOwner: false };
    const account = defaultPersonFor(assistants, viewer);
    const authors = account ? personPubkeys(scopeRosterFor(assistants, viewer), account) : [];
    const ownerAccount = assistants.find((a) => a.role === 'owner')?.accountPubkey || null;
    return {
      loading: false,
      account,
      assistant: authors[1] || null,
      authors,
      signedIn: Boolean(viewer),
      isOwner: Boolean(viewer && ownerAccount && viewer.accountPubkey === ownerAccount),
    };
  }, [assistants, viewer, loading]);
}

/**
 * GET /api/dictionaries/concepts for the person, scored from the active point
 * of view (the usePov() read params). Returns
 * { data: { entries, metric, pov } | null, error, reload }. Pass enabled:false
 * to skip the read (the entry page already holds the row it was opened from).
 */
export function useConceptDictionary(person, povParams, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const authors = person?.loading ? '' : (person?.authors || []).join(',');
  const settled = Boolean(person) && !person.loading;
  const wotPov = povParams?.wotPov;
  const userPubkey = povParams?.userPubkey;

  useEffect(() => {
    if (!enabled || !settled) return undefined;
    let cancelled = false;
    (async () => {
      try {
        if (!authors) throw new Error('This instance did not say whose Dictionary to show.');
        const params = new URLSearchParams({ authors });
        if (wotPov) params.set('wotPov', wotPov);
        if (userPubkey) params.set('userPubkey', userPubkey);
        const resp = await fetch(`/api/dictionaries/concepts?${params}`);
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
  }, [authors, settled, wotPov, userPubkey, enabled, version]);

  return { data, error, reload: () => setVersion((v) => v + 1) };
}

/** One line on whose point of view filtered an entry's Items. */
export function itemsPovLine(pov) {
  if (!pov) return '';
  if (pov.branch === 'personalized') return 'Trusted from your point of view.';
  if (pov.fellBackToHouse) {
    return 'Your personalized scores are not computed on this instance, so trust is judged from the house point of view.';
  }
  return 'Trusted from the house point of view.';
}

/**
 * GET /api/dictionaries/concepts/items: an entry's Items, filed under its own header (`coord`) and
 * the shared concept it points to (`shared`), by people trusted from the active point of view, plus
 * the person's own filings. Returns { data: { items, filerCount, totalCount, pov } | null, error }.
 */
export function useConceptItems({ coord, shared, person, povParams }) {
  const [state, setState] = useState({ data: null, error: null });
  const authors = person?.loading ? '' : (person?.authors || []).join(',');
  const settled = Boolean(person) && !person.loading;
  const wotPov = povParams?.wotPov;
  const userPubkey = povParams?.userPubkey;

  useEffect(() => {
    if (!settled || !coord) return undefined;
    let cancelled = false;
    setState({ data: null, error: null });
    (async () => {
      try {
        if (!authors) throw new Error('This instance did not say whose Dictionary to show.');
        const params = new URLSearchParams({ coord, authors });
        if (shared && shared !== coord) params.set('shared', shared);
        if (wotPov) params.set('wotPov', wotPov);
        if (userPubkey) params.set('userPubkey', userPubkey);
        const resp = await fetch(`/api/dictionaries/concepts/items?${params}`);
        const json = await resp.json();
        if (!resp.ok || json.success === false) throw new Error(json.error || `HTTP ${resp.status}`);
        if (!cancelled) {
          setState({
            data: { items: json.items || [], filerCount: json.filerCount || 0, totalCount: json.totalCount || 0, pov: json.pov || {} },
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) setState({ data: null, error: err.message });
      }
    })();
    return () => { cancelled = true; };
  }, [coord, shared, authors, settled, wotPov, userPubkey]);

  return state;
}
