import { useState, useEffect, useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import ConceptPreview from './ConceptPreview';

/**
 * Concept Discovery page.
 *
 * Top: bootstrap "suggested concept authors" cards (config-driven today,
 * DList-driven tomorrow). Click a card to populate the search and fetch.
 *
 * Middle: free-form pubkey search.
 *
 * Bottom: results — one card per ConceptHeader the searched pubkey has
 * published. Click a card to open the preview/import drawer.
 */

function decodePubkey(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  try {
    const d = nip19.decode(trimmed);
    if (d.type === 'npub') return d.data;
    if (d.type === 'nprofile') return d.data.pubkey;
  } catch {}
  return null;
}

function shortPk(pk) {
  if (!pk) return '';
  return `${pk.slice(0, 8)}…${pk.slice(-4)}`;
}

export default function ConceptDiscovery() {
  const [suggested, setSuggested] = useState([]);
  const [input, setInput] = useState('');
  const [relayInput, setRelayInput] = useState('');
  const [pubkey, setPubkey] = useState(null);
  const [authorMeta, setAuthorMeta] = useState(null); // { name, description } when sourced from suggested cards
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(null); // { pubkey, slug, name } or null

  // Load bootstrap suggestions
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/concept-discovery/suggested-authors');
        const body = await resp.json();
        if (cancelled) return;
        if (body.success) setSuggested(body.authors || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const relays = useMemo(() => {
    return relayInput
      .split(',')
      .map((r) => r.trim())
      .filter((r) => r.startsWith('wss://') || r.startsWith('ws://'));
  }, [relayInput]);

  async function search(targetPubkey, targetRelays, meta) {
    setError(null);
    setResults(null);
    setLoading(true);
    setPubkey(targetPubkey);
    setAuthorMeta(meta || null);
    try {
      const params = new URLSearchParams({ pubkey: targetPubkey });
      if (targetRelays && targetRelays.length > 0) {
        params.set('relays', targetRelays.join(','));
      }
      const resp = await fetch(`/api/concept-discovery/concepts-by-pubkey?${params}`);
      const body = await resp.json();
      if (!body.success) throw new Error(body.error || `HTTP ${resp.status}`);
      setResults(body);
    } catch (err) {
      setError(err.message);
      setResults({ concepts: [], count: 0 });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e?.preventDefault();
    const hex = decodePubkey(input);
    if (!hex) {
      setError('Enter a 64-char hex pubkey, npub, or nprofile.');
      return;
    }
    search(hex, relays);
  }

  function handleSuggestedClick(author) {
    setInput(author.pubkey);
    setRelayInput((author.relays || []).join(', '));
    search(author.pubkey, author.relays || [], { name: author.name, description: author.description });
  }

  function handleImported() {
    // Re-run the current search so `alreadyImported` flips on the
    // freshly-imported concept.
    if (pubkey) search(pubkey, relays, authorMeta);
  }

  return (
    <div className="cdisc-page">
      <div className="page-header">
        <h1>🔭 Concept Discovery</h1>
        <p className="page-description">
          Different Brainstorm instances may define the same abstract idea
          (a nostr relay, a tag taxonomy, anything else) with slightly
          different schemas. To <em>interoperate</em> with another instance
          you need to recognize the coordinate they author concepts under
          — that's what an import does. Schema only; their elements remain
          decentralized and flow in via shared coordinate matching.
        </p>
      </div>

      {suggested.length > 0 && (
        <section className="cdisc-section">
          <div className="cdisc-section-title">Suggested concept authors</div>
          <div className="cdisc-suggestions">
            {suggested.map((a) => (
              <button
                key={a.pubkey}
                type="button"
                className="cdisc-suggestion"
                onClick={() => handleSuggestedClick(a)}
                title={a.pubkey}
              >
                <div className="cdisc-suggestion-name">{a.name}</div>
                <div className="cdisc-suggestion-pk"><code>{shortPk(a.pubkey)}</code></div>
                {a.description && <div className="cdisc-suggestion-desc">{a.description}</div>}
              </button>
            ))}
          </div>
          <div className="cdisc-section-hint">
            These come from <code>tapestry/config/suggested-concept-authors.json</code>.
            In a future revision we'll source them from a community-curated
            DList on nostr — same UX, different backing store.
          </div>
        </section>
      )}

      <section className="cdisc-section">
        <div className="cdisc-section-title">Search by pubkey</div>
        <form onSubmit={handleSubmit} className="cdisc-search-form">
          <input
            type="text"
            placeholder="npub1… / nprofile1… / 64-char hex pubkey"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="cdisc-search-input"
          />
          <input
            type="text"
            placeholder="wss://relay1, wss://relay2 (optional)"
            value={relayInput}
            onChange={(e) => setRelayInput(e.target.value)}
            className="cdisc-relay-input"
          />
          <button type="submit" disabled={loading} className="cdisc-search-btn">
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>
        {error && <div className="rtp-error" style={{ marginTop: '0.5rem' }}>⚠️ {error}</div>}
      </section>

      {pubkey && results && (
        <section className="cdisc-section">
          <div className="cdisc-section-title">
            {results.count} concept{results.count === 1 ? '' : 's'}
            {' '}published by{' '}
            <code>{shortPk(pubkey)}</code>
            {authorMeta && <em style={{ marginLeft: '0.5rem', opacity: 0.7 }}>({authorMeta.name})</em>}
          </div>
          {results.count === 0 ? (
            <div className="rtp-empty">
              No kind-39998 ConceptHeader events found for this pubkey on the queried relays.
            </div>
          ) : (
            <div className="cdisc-results">
              {results.concepts.map((c) => (
                <button
                  key={c.coordinate}
                  type="button"
                  className={`cdisc-concept ${c.alreadyImported ? 'cdisc-concept-imported' : ''}`}
                  onClick={() => setPreviewOpen({ pubkey: c.pubkey, slug: c.slug, name: c.name })}
                >
                  <div className="cdisc-concept-header">
                    <span className="cdisc-concept-slug">{c.slug}</span>
                    {c.alreadyImported && (
                      <span className="cdisc-concept-badge">✓ imported</span>
                    )}
                  </div>
                  <div className="cdisc-concept-name">{c.name}</div>
                  {c.description && <div className="cdisc-concept-desc">{c.description}</div>}
                  <div className="cdisc-concept-coordinate"><code>{c.coordinate}</code></div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {previewOpen && (
        <ConceptPreview
          pubkey={previewOpen.pubkey}
          slug={previewOpen.slug}
          relays={relays}
          onClose={() => setPreviewOpen(null)}
          onImported={() => { setPreviewOpen(null); handleImported(); }}
        />
      )}
    </div>
  );
}
