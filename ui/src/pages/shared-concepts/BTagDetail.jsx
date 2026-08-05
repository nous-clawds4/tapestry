import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import AuthorCell from '../../components/AuthorCell';
import useProfiles from '../../hooks/useProfiles';
import { queryRelay } from '../../api/relay';
import { fetchFromRelays } from '../../utils/nostrPublish';

// Where the b-tag target is looked up (same constant as the table page) —
// hardcoded for now; future source is the nostr-relays concept subset.
const COMMUNITY_RELAYS = ['wss://dcosl.brainstorm.world'];

const A_TAG_RE = /^(\d+):([0-9a-f]{64}):(.+)$/;
const EVENT_ID_RE = /^[0-9a-f]{64}$/;

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

const columnStyle = {
  flex: '1 1 320px',
  minWidth: 0,
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '1rem',
};

/**
 * One side of the pair: name (singular), description, author, and the raw
 * event json — hidden by default behind this column's own toggle.
 * `state`: 'loading' | 'missing' | 'ok'; `missingText` is what the column
 * says when its event could not be located.
 */
function EventColumn({ title, ev, state, missingText, profiles }) {
  const [showRaw, setShowRaw] = useState(false);
  return (
    <div style={columnStyle}>
      <div className="firmware-sidebar-header" style={{ padding: '0 0 0.5rem', borderBottom: 'none' }}>
        {title}
      </div>
      {state === 'loading' ? (
        <p className="text-muted" style={{ margin: 0 }}>Looking for the event…</p>
      ) : state === 'missing' ? (
        <p className="text-muted" style={{ margin: 0 }}>{missingText}</p>
      ) : (
        <>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem' }}>
            {singularName(ev) || <span className="text-muted">cannot locate name</span>}
          </h2>
          <p style={{ margin: '0 0 0.75rem' }}>
            {descriptionOf(ev) || <span className="text-muted">No description.</span>}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span className="text-muted">Author</span>
            <AuthorCell pubkey={ev.pubkey} profiles={profiles} />
          </div>
          <button className="btn" onClick={() => setShowRaw((v) => !v)}>
            {showRaw ? 'Hide raw event' : 'Show raw event'}
          </button>
          {showRaw && (
            <pre className="firmware-json-pre" style={{ marginTop: '0.5rem' }}>
              {JSON.stringify(ev, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

/**
 * b-tag pair view: the locally-authored event that carries the b-tag (left)
 * and the shared event the b-tag points to (right). Local side is read from
 * the local strfry by coordinate; shared side from the community relay by
 * the b-tag (a-tag or event id). ?b=<value> selects which of the local
 * event's b-tags to follow (default: its first).
 */
export default function BTagDetail() {
  const { uuid } = useParams();
  const [searchParams] = useSearchParams();

  const [kind, pubkey, dTag] = useMemo(() => {
    const parts = (uuid || '').split(':');
    return [Number(parts[0]) || 0, parts[1] || '', parts.slice(2).join(':')];
  }, [uuid]);

  const [localEvent, setLocalEvent] = useState(null);
  const [localLoading, setLocalLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!kind || !pubkey || !dTag) { setLocalLoading(false); setError('Malformed event coordinate'); return undefined; }
    let cancelled = false;

    (async () => {
      try {
        setLocalLoading(true);
        setError(null);
        const events = await queryRelay({ kinds: [kind], authors: [pubkey], '#d': [dTag] });
        if (cancelled) return;
        const newest = (events || []).reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
        setLocalEvent(newest);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLocalLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kind, pubkey, dTag]);

  // Which b-tag to follow: ?b= when given, else the local event's first.
  const bTag = useMemo(() => {
    const fromQuery = (searchParams.get('b') || '').trim();
    if (fromQuery) return fromQuery;
    const t = localEvent?.tags?.find((x) => x[0] === 'b' && typeof x[1] === 'string' && x[1].trim() !== '');
    return t ? t[1].trim() : '';
  }, [searchParams, localEvent]);

  const [sharedEvent, setSharedEvent] = useState(null);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedSearched, setSharedSearched] = useState(false);

  useEffect(() => {
    setSharedEvent(null);
    setSharedSearched(false);
    if (!bTag) return undefined;

    let filter = null;
    const m = bTag.match(A_TAG_RE);
    if (m) filter = { kinds: [Number(m[1])], authors: [m[2]], '#d': [m[3]] };
    else if (EVENT_ID_RE.test(bTag)) filter = { ids: [bTag] };
    if (!filter) { setSharedSearched(true); return undefined; } // unresolvable value

    let cancelled = false;
    (async () => {
      setSharedLoading(true);
      try {
        const events = await fetchFromRelays(filter, COMMUNITY_RELAYS);
        if (cancelled) return;
        const newest = (events || []).reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
        setSharedEvent(newest);
      } finally {
        if (!cancelled) {
          setSharedLoading(false);
          setSharedSearched(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [bTag]);

  const profilePubkeys = useMemo(
    () => [localEvent?.pubkey, sharedEvent?.pubkey].filter(Boolean),
    [localEvent, sharedEvent],
  );
  const profiles = useProfiles(profilePubkeys);

  if (localLoading) {
    return (
      <div className="page">
        <Breadcrumbs />
        <p>Loading b-tag detail…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>🤝 b-tag</h1>
        <p className="error">Error: {error}</p>
      </div>
    );
  }

  const sharedState = !localEvent || !bTag
    ? 'missing'
    : (sharedLoading || !sharedSearched) ? 'loading'
      : sharedEvent ? 'ok' : 'missing';

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🤝 {localEvent ? (singularName(localEvent) || dTag) : 'b-tag'}</h1>
      {bTag && (
        <p className="subtitle" style={{ overflowWrap: 'anywhere' }}>
          b-tag: <code>{bTag}</code>
        </p>
      )}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start', maxWidth: '1100px' }}>
        <EventColumn
          title="Local event"
          ev={localEvent}
          state={localEvent ? 'ok' : 'missing'}
          missingText="Local event not found."
          profiles={profiles}
        />
        <EventColumn
          title="Shared event"
          ev={sharedEvent}
          state={sharedState}
          missingText={!localEvent ? '—' : !bTag ? 'The local event carries no b-tag.' : 'cannot locate event'}
          profiles={profiles}
        />
      </div>
    </div>
  );
}
