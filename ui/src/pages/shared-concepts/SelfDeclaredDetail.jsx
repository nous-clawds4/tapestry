import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import AuthorCell from '../../components/AuthorCell';
import useProfiles from '../../hooks/useProfiles';
import { fetchFromRelays } from '../../utils/nostrPublish';

// The public relay Shared with the community searches — its detail reads
// from the same place. Hardcoded for now (future: nostr-relays concept).
const COMMUNITY_RELAYS = ['wss://dcosl.brainstorm.world'];

/** The singular name: `names` tag = ["names", singular, plural, …]. */
function singularName(ev) {
  const t = ev?.tags?.find((x) => x[0] === 'names');
  return t && typeof t[1] === 'string' && t[1].trim() !== '' ? t[1] : null;
}

/** The event's description tag value, if any. */
function descriptionOf(ev) {
  const t = ev?.tags?.find((x) => x[0] === 'description');
  return t && typeof t[1] === 'string' && t[1].trim() !== '' ? t[1] : null;
}

/**
 * Shared-concept detail: the event behind one row of Shared with the community,
 * fetched from the community relay by its own coordinate (the same value its
 * self-pointing b-tag carries). Shows name, description, author, and the raw
 * event — hidden by default behind a toggle.
 *
 * "Self-declared" survives below only where it names the WIRE FACT (a b-tag
 * pointing at its own event), never as a surface name — the naming rule from
 * the 2026-08-09 vocabulary pass.
 */
export default function SelfDeclaredDetail() {
  const { uuid } = useParams();

  const [kind, pubkey, dTag] = useMemo(() => {
    const parts = (uuid || '').split(':');
    return [Number(parts[0]) || 0, parts[1] || '', parts.slice(2).join(':')];
  }, [uuid]);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!kind || !pubkey || !dTag) { setLoading(false); setError('Malformed event coordinate'); return undefined; }
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      const events = await fetchFromRelays(
        { kinds: [kind], authors: [pubkey], '#d': [dTag] },
        COMMUNITY_RELAYS,
      );
      if (cancelled) return;
      const newest = (events || []).reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
      setEvent(newest);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [kind, pubkey, dTag]);

  const profiles = useProfiles(useMemo(() => (event ? [event.pubkey] : []), [event]));

  if (loading) {
    return (
      <div className="page">
        <Breadcrumbs />
        <p>Loading shared concept…</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>🤝 Shared concept</h1>
        {error
          ? <p className="error">Error: {error}</p>
          : <p className="text-muted">Cannot locate the event on the community relay.</p>}
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🤝 {singularName(event) || dTag}</h1>

      <section style={{ maxWidth: '760px' }}>
        <p style={{ margin: '0 0 1rem' }}>
          {descriptionOf(event) || <span className="text-muted">No description.</span>}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span className="text-muted">Author</span>
          <AuthorCell pubkey={event.pubkey} profiles={profiles} />
        </div>

        <button className="btn" onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? 'Hide raw event' : 'Show raw event'}
        </button>
        {showRaw && (
          <pre className="firmware-json-pre" style={{ marginTop: '0.5rem' }}>
            {JSON.stringify(event, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
