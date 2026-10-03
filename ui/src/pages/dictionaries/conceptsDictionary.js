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
// Create New Concept in the design's styling (pages/dictionary/NewConcept.jsx).
export const DICTIONARY_NEW_PATH = `${DICTIONARY_PATH}/new`;
// Create New Concept for a shared concept the finder found: the new header is wired to it.
export const DICTIONARY_WIRE_PARAM = 'wire';
export const dictionaryWirePath = (coord) => `${DICTIONARY_NEW_PATH}?${DICTIONARY_WIRE_PARAM}=${encodeURIComponent(coord)}`;
// Edit a concept: a new version of a header the reader's own Assistant wrote (pages/dictionary/EditConcept.jsx).
export const dictionaryEditPath = (coord) => `${dictionaryEntryPath(coord)}/edit`;

// An entry's item: on /dictionary its own page (pages/dictionary/Item.jsx), by the item's address or
// event id; in the control panel the Simple Lists item page, which opens a kind-39999 item by address
// and anything else by id (utils/treasureMap itemRouteId).
export const dictionaryItemPath = (coord, item) => `${dictionaryEntryPath(coord)}/items/${encodeURIComponent(item.address || item.id)}`;
export const controlPanelItemPath = (coord, item) => `/tapestry/lists/items/${encodeURIComponent(item.kind === 39999 && item.address ? item.address : item.id)}`;

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

/**
 * A route param as the page should read it. React Router has already decoded it, so decoding again
 * would turn a d-tag's literal "%" into a crash (URIError) or a different value; this decodes only
 * what still decodes, so an older doubly-encoded link keeps working and nothing throws.
 */
export function safeDecode(raw) {
  try { return decodeURIComponent(raw || ''); } catch { return raw || ''; }
}

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
 * reader owns this instance; only they get the finder's twin picker (the
 * b-disposition writes are owner-only). Anyone signed in can create a concept
 * wired to a finder result, signed by their own Assistant.
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

/** One read of GET /api/dictionaries/concepts: the Dictionary of `authors` (one person, or one Assistant). */
export async function fetchConceptDictionary(authors, povParams) {
  if (!authors || !authors.length) throw new Error('This instance did not say whose Dictionary to show.');
  const params = new URLSearchParams({ authors: authors.join(',') });
  if (povParams?.wotPov) params.set('wotPov', povParams.wotPov);
  if (povParams?.userPubkey) params.set('userPubkey', povParams.userPubkey);
  const resp = await fetch(`/api/dictionaries/concepts?${params}`);
  const json = await resp.json();
  if (!resp.ok || json.success === false) throw new Error(json.error || `HTTP ${resp.status}`);
  return { entries: json.entries || [], metric: json.metric || 'gum1', pov: json.pov || {} };
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
        const out = await fetchConceptDictionary(authors ? authors.split(',') : [], { wotPov, userPubkey });
        if (!cancelled) { setError(null); setData(out); }
      } catch (err) {
        if (!cancelled) { setError(err.message); setData({ entries: [], metric: 'gum1', pov: {} }); }
      }
    })();
    return () => { cancelled = true; };
  }, [authors, settled, wotPov, userPubkey, enabled, version]);

  return { data, error, reload: () => setVersion((v) => v + 1) };
}

/**
 * The signed-in reader's Assistants (GET /api/assistant/my-assistants): their local Assistant and
 * every profile they tagged as one. { status: 'idle' | 'loading' | 'ready' | 'error', rows, reload }.
 * Signed out it stays idle: the list is the reader's own. It is read again for another account.
 */
export function useMyAssistants(person) {
  const [state, setState] = useState({ status: 'idle', rows: [] });
  const [version, setVersion] = useState(0);
  const signedIn = Boolean(person && !person.loading && person.signedIn);
  const account = signedIn ? person.account : null;
  useEffect(() => {
    if (!signedIn) { setState({ status: 'idle', rows: [] }); return undefined; }
    let cancelled = false;
    setState({ status: 'loading', rows: [] });
    (async () => {
      try {
        const resp = await fetch('/api/assistant/my-assistants');
        const json = await resp.json();
        if (!resp.ok || !json || json.success !== true) throw new Error(json?.error || `HTTP ${resp.status}`);
        if (!cancelled) setState({ status: 'ready', rows: json.signedIn === true && Array.isArray(json.rows) ? json.rows : [] });
      } catch {
        if (!cancelled) setState({ status: 'error', rows: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [signedIn, account, version]);
  return { ...state, reload: () => setVersion((v) => v + 1) };
}

/**
 * The Dictionaries of several Assistants (the picker's choice: one Assistant, or all of them), each a
 * read of GET /api/dictionaries/concepts from the active point of view. `sets` is [{ key, authors }].
 * Returns { data: { reads: [{ key, entries } | { key, error }], metric, pov } | null, reload }.
 */
export function useAssistantDictionaries(sets, povParams, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [version, setVersion] = useState(0);
  const signature = (sets || []).map((s) => `${s.key}=${(s.authors || []).join(',')}`).join(';');
  const wotPov = povParams?.wotPov;
  const userPubkey = povParams?.userPubkey;

  useEffect(() => {
    if (!enabled || !signature) return undefined;
    let cancelled = false;
    setData(null);
    const list = signature.split(';').map((part) => {
      const [key, authors] = part.split('=');
      return { key, authors: authors ? authors.split(',') : [] };
    });
    (async () => {
      const reads = await Promise.all(list.map(async ({ key, authors }) => {
        try { return { key, ...(await fetchConceptDictionary(authors, { wotPov, userPubkey })) }; } catch (err) { return { key, error: err.message }; }
      }));
      if (cancelled) return;
      const answered = reads.find((r) => !r.error);
      setData({ signature, reads, metric: answered?.metric || 'gum1', pov: answered?.pov || {} });
    })();
    return () => { cancelled = true; };
  }, [signature, wotPov, userPubkey, enabled, version]);

  // Reads for another choice are never shown with this one (a back/forward renders before the effect).
  return { data: data && data.signature === signature ? data : null, reload: () => setVersion((v) => v + 1) };
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
 * the person's own filings. Returns { data: { items, keptCount, truncated, filerCount, totalCount, pov } | null,
 * error }. Pass enabled:false until `shared` is known, so the page asks once.
 */
export function useConceptItems({ coord, shared, person, povParams, enabled = true }) {
  const [state, setState] = useState({ data: null, error: null });
  const authors = person?.loading ? '' : (person?.authors || []).join(',');
  const settled = Boolean(person) && !person.loading;
  const wotPov = povParams?.wotPov;
  const userPubkey = povParams?.userPubkey;

  useEffect(() => {
    if (!enabled || !settled || !coord) return undefined;
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
          const items = json.items || [];
          setState({
            data: {
              items,
              keptCount: Number.isFinite(json.keptCount) ? json.keptCount : items.length,
              truncated: Boolean(json.truncated),
              filerCount: json.filerCount || 0,
              totalCount: json.totalCount || 0,
              pov: json.pov || {},
            },
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) setState({ data: null, error: err.message });
      }
    })();
    return () => { cancelled = true; };
  }, [coord, shared, authors, settled, wotPov, userPubkey, enabled]);

  return state;
}
