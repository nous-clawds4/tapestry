import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';

/**
 * Header Event (story #9) — the raw nostr event behind a queue row, kept
 * deliberately simple: the newest event at the coordinate, pretty-printed.
 * The seed of a future concept-header detail page.
 */
export default function HeaderEvent() {
  const { coord } = useParams();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setEvent(null); setError(null);
    (async () => {
      try {
        const decoded = decodeURIComponent(coord || '');
        const [kind, pubkey, ...rest] = decoded.split(':');
        const d = rest.join(':');
        if (!/^\d+$/.test(kind || '') || !/^[0-9a-f]{64}$/.test(pubkey || '') || !d) {
          throw new Error(`Not a concept coordinate: ${decoded || '(empty)'}`);
        }
        const filter = encodeURIComponent(JSON.stringify({ kinds: [Number(kind)], authors: [pubkey], '#d': [d] }));
        const resp = await fetch(`/api/strfry/scan?filter=${filter}`);
        const json = await resp.json();
        const events = json.events || json.data || [];
        const newest = events.reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
        if (!newest) throw new Error('No event found at this coordinate.');
        setEvent(newest);
      } catch (err) { setError(err.message); }
    })();
  }, [coord]);

  const name = event
    ? (event.tags?.find((t) => t[0] === 'names')?.[1] || event.tags?.find((t) => t[0] === 'name')?.[1] || null)
    : null;

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🧾 {name || 'Header Event'}</h1>
      <p className="subtitle">The raw nostr event at this coordinate — exactly what is on the wire.</p>
      <p className="text-muted" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
        {decodeURIComponent(coord || '')}
      </p>

      {error && <p className="text-muted">{error}</p>}
      {!error && event === null && <p>Fetching the event…</p>}
      {event && (
        <pre style={{
          fontSize: '0.8rem', lineHeight: 1.45, padding: '1rem', overflowX: 'auto',
          border: '1px solid var(--border, #444)', borderRadius: '8px',
          backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        }}>
          {JSON.stringify(event, null, 2)}
        </pre>
      )}
    </div>
  );
}
