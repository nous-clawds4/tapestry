import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import AuthorCell from '../../components/AuthorCell';
import useProfiles from '../../hooks/useProfiles';
import { queryRelay } from '../../api/relay';
import { fetchFromRelays } from '../../utils/nostrPublish';

const SHARED_CONCEPT_KIND = 39999;

// Where to look for the referenced event besides the local strfry. Hardcoded
// for now — the future source is the appropriate subset of the nostr-relays
// concept (same relay the concept-publish flow already targets).
const COMMUNITY_RELAYS = ['wss://dcosl.brainstorm.world'];

/**
 * Shared Concept detail: name, description, author, the element's
 * identifiers, and the REFERENCED nostr event those identifiers point at.
 *
 * Identifier rules (per spec): show the a-tag when present; show the
 * event-id when it's the only one present; when BOTH are present the a-tag
 * shows and the event-id hides behind a visibility toggle. "Present" means a
 * non-empty string — the authoring flow stores '' for an unset identifier.
 *
 * Referenced event: fetched by a-tag when available, else by event-id, from
 * the local strfry AND the community relay(s); newest wins (a-tags are
 * replaceable coordinates). Shown as author (standard avatar+name cell) plus
 * a raw-event view that is hidden by default behind a toggle — nothing else.
 */
export default function SharedConceptDetail() {
  const { uuid } = useParams();

  // uuid is the a-tag coordinate kind:pubkey:d-tag; the d-tag keeps any
  // further colons it might contain.
  const [kind, pubkey, dTag] = useMemo(() => {
    const parts = (uuid || '').split(':');
    return [Number(parts[0]) || SHARED_CONCEPT_KIND, parts[1] || '', parts.slice(2).join(':')];
  }, [uuid]);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEventId, setShowEventId] = useState(false);

  useEffect(() => {
    if (!pubkey || !dTag) { setLoading(false); setError('Malformed shared-concept id'); return undefined; }
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const events = await queryRelay({ kinds: [kind], authors: [pubkey], '#d': [dTag] });
        if (cancelled) return;
        // Addressable events replace by coordinate — the newest is the live one.
        const newest = (events || []).reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
        setEvent(newest);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [kind, pubkey, dTag]);

  // The element's sharedConcept section and its identifiers, derived once per
  // fetched event (the referenced-event effect keys on these).
  const { section, aTag, eventId } = useMemo(() => {
    let sec = {};
    try {
      const raw = event?.tags?.find((t) => t[0] === 'json')?.[1];
      if (raw) sec = JSON.parse(raw).sharedConcept || {};
    } catch {
      sec = {};
    }
    const ids = sec.identifiers || {};
    return {
      section: sec,
      aTag: typeof ids['a-tag'] === 'string' ? ids['a-tag'].trim() : '',
      eventId: typeof ids['event-id'] === 'string' ? ids['event-id'].trim() : '',
    };
  }, [event]);

  // ── Referenced event (by a-tag, else event-id; local strfry + community) ──
  const [refEvent, setRefEvent] = useState(null);
  const [refLoading, setRefLoading] = useState(false);
  const [refSearched, setRefSearched] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    setRefEvent(null);
    setShowRaw(false);
    setRefSearched(false);
    if (!aTag && !eventId) return undefined;

    // Prefer the a-tag; fall back to the event-id when the a-tag is absent
    // (or too malformed to build a filter from).
    let filter = null;
    if (aTag) {
      const parts = aTag.split(':');
      const k = Number(parts[0]);
      if (parts.length >= 3 && Number.isFinite(k) && parts[1]) {
        filter = { kinds: [k], authors: [parts[1]], '#d': [parts.slice(2).join(':')] };
      }
    }
    if (!filter && eventId) filter = { ids: [eventId] };
    if (!filter) return undefined;

    let cancelled = false;
    (async () => {
      setRefLoading(true);
      try {
        const [localEvents, remoteEvents] = await Promise.all([
          queryRelay(filter).catch(() => []),
          fetchFromRelays(filter, COMMUNITY_RELAYS),
        ]);
        if (cancelled) return;
        const all = [...(localEvents || []), ...(remoteEvents || [])];
        const newest = all.reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
        setRefEvent(newest);
      } finally {
        if (!cancelled) {
          setRefLoading(false);
          setRefSearched(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [aTag, eventId]);

  const profilePubkeys = useMemo(
    () => [event?.pubkey, refEvent?.pubkey].filter(Boolean),
    [event, refEvent],
  );
  const profiles = useProfiles(profilePubkeys);

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
        <h1>Shared Concept</h1>
        {error
          ? <p className="error">Error: {error}</p>
          : <p className="text-muted">Shared concept not found.</p>}
      </div>
    );
  }

  const name = section.name || dTag;
  const description = section.description || '';

  const idRow = (label, value) => (
    <div style={{ marginBottom: '0.5rem' }}>
      <span className="text-muted" style={{ marginRight: '0.5rem' }}>{label}</span>
      <code style={{ overflowWrap: 'anywhere' }}>{value}</code>
    </div>
  );

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🤝 {name}</h1>

      <section style={{ maxWidth: '760px' }}>
        <p style={{ margin: '0 0 1rem' }}>
          {description || <span className="text-muted">No description.</span>}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span className="text-muted">Author</span>
          <AuthorCell pubkey={event.pubkey} profiles={profiles} />
        </div>

        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Identifiers</h2>
        {aTag && idRow('a-tag', aTag)}
        {eventId && !aTag && idRow('event-id', eventId)}
        {eventId && aTag && (
          <div style={{ marginBottom: '0.5rem' }}>
            <button className="btn" onClick={() => setShowEventId((v) => !v)}>
              {showEventId ? 'Hide event id' : 'Show event id'}
            </button>
            {showEventId && <div style={{ marginTop: '0.5rem' }}>{idRow('event-id', eventId)}</div>}
          </div>
        )}
        {!aTag && !eventId && <p className="text-muted" style={{ margin: 0 }}>No identifiers.</p>}

        {(aTag || eventId) && (
          <>
            <h2 style={{ fontSize: '1rem', margin: '1.5rem 0 0.5rem' }}>Referenced event</h2>
            {refLoading ? (
              <p className="text-muted" style={{ margin: 0 }}>Looking for the referenced event…</p>
            ) : refEvent ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span className="text-muted">Author</span>
                  <AuthorCell pubkey={refEvent.pubkey} profiles={profiles} />
                </div>
                <button className="btn" onClick={() => setShowRaw((v) => !v)}>
                  {showRaw ? 'Hide raw event' : 'Show raw event'}
                </button>
                {showRaw && (
                  <pre className="firmware-json-pre" style={{ marginTop: '0.5rem' }}>
                    {JSON.stringify(refEvent, null, 2)}
                  </pre>
                )}
              </>
            ) : refSearched ? (
              <p className="text-muted" style={{ margin: 0 }}>
                Referenced event not found on the local relay or the community relay.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
