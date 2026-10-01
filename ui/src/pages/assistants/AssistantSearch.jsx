import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchProfilesChunked } from '../../utils/profileBatch';
import {
  COPY, TAG_KEYS, TAG_NAMES, parseExactKey, searchCandidates, tagAvailability,
} from './myAssistants';

/**
 * The My Assistants search card (my-assistants #2 AC-1, ADR my-assistants/0002 sub-decision 7): find a profile and
 * tag it as either kind of Assistant.
 *
 * The profile search is the one the Tag-someone modal asks (TagSomeoneModal.jsx): /api/search/profiles/meili,
 * debounced, from 2 characters, 10 results, in the viewer's POV, with a sequence guard so a slow answer never
 * overwrites a newer one. A query that names one key exactly (an npub, or 64-hex) is also looked up directly, so a
 * new Assistant that does not rank yet is still found. Everyone already in the list is left out (searchCandidates).
 *
 * Props: rows (the list), definitions (the read's), viewer (pubkey), busy ({ kind, pubkey, key } while a press
 * publishes), onTag(pubkey, tagKey).
 */

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const RESULTS_LIMIT = 10;

export default function AssistantSearch({ rows, definitions, viewer, busy, onTag }) {
  const [query, setQuery] = useState('');
  // `forQuery`: the query these results answer. Results show only while it is the current query, so an earlier
  // query's results never show beside a new one — not even for the render before the new search starts.
  const [found, setFound] = useState({ forQuery: '', hits: [], exact: null, failed: false });
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const mine = ++seq.current;
    if (q.length < MIN_QUERY_LENGTH) return undefined;
    const timer = setTimeout(async () => {
      const key = parseExactKey(q);
      const params = new URLSearchParams({ q, limit: String(RESULTS_LIMIT), offset: '0' });
      if (viewer) { params.set('wotPov', 'user'); params.set('userPubkey', viewer); } else params.set('wotPov', 'house');
      const [exact, search] = await Promise.all([
        key ? fetchProfilesChunked([key]).then((profiles) => ({ pubkey: key, profile: profiles[key] })) : null,
        fetch(`/api/search/profiles/meili?${params}`)
          .then(async (r) => { const data = await r.json().catch(() => null); return r.ok && data && Array.isArray(data.hits) ? { hits: data.hits } : { failed: true }; })
          .catch(() => ({ failed: true })),
      ]);
      if (mine !== seq.current) return;
      setFound({ forQuery: q, hits: search.hits || [], exact, failed: !!search.failed && !exact });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, viewer]);

  const current = query.trim();
  const pending = current.length >= MIN_QUERY_LENGTH && found.forQuery !== current;
  const candidates = useMemo(
    () => (pending ? [] : searchCandidates({ query, hits: found.hits, exact: found.exact, rows })),
    [pending, query, found, rows],
  );
  const availability = tagAvailability(definitions);
  const searching = query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div className="bsd-ma-search">
      <label className="bsd-ma-search-label" htmlFor="bsd-ma-search-input">{COPY.searchHeading}</label>
      <input
        id="bsd-ma-search-input"
        type="search"
        className="bsd-ma-search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={COPY.searchPlaceholder}
        autoComplete="off"
        spellCheck="false"
      />
      {searching && (
        <>
          <div className="bsd-ma-found">
            {pending ? COPY.searching
              : found.failed ? COPY.searchFailed
                : candidates.length > 0 ? COPY.resultCount(candidates.length) : COPY.noMatch}
          </div>
          {!pending && candidates.length > 0 && TAG_KEYS.filter((key) => !availability[key].enabled).map((key) => (
            <p key={key} className="bsd-ma-reason" id={`bsd-ma-search-reason-${key}`}>{availability[key].reason}</p>
          ))}
          {!pending && candidates.length > 0 && (
            <ul className="bsd-ma-results" aria-label={COPY.resultsLabel}>
              {candidates.map((card) => (
                <li key={card.pubkey} className="bsd-ma-result">
                  <span className="bsd-ma-avatar is-small" aria-hidden="true">{card.initial}</span>
                  <span className="bsd-ma-result-who">
                    <span className="bsd-ma-name">{card.name}</span>
                    <span className="bsd-ma-result-meta">{card.nip05} · {card.url}</span>
                  </span>
                  <span className="bsd-ma-result-actions">
                    {TAG_KEYS.map((key) => {
                      const pressed = busy && busy.kind === 'tag' && busy.pubkey === card.pubkey && busy.key === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`bsd-ma-btn${key === 'brainstorm' ? ' is-primary' : ''}`}
                          disabled={!!busy || !availability[key].enabled}
                          aria-describedby={availability[key].enabled ? undefined : `bsd-ma-search-reason-${key}`}
                          onClick={() => onTag(card.pubkey, key)}
                        >
                          {pressed ? COPY.busy.tag : COPY.tagButton(TAG_NAMES[key])}
                        </button>
                      );
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
