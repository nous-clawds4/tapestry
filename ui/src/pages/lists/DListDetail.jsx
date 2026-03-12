import { useParams, NavLink, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { queryRelay } from '../../api/relay';
import Breadcrumbs from '../../components/Breadcrumbs';

/**
 * Helper: extract a tag value from an event's tags array.
 */
function getTag(event, name, index = 1) {
  const tag = event.tags?.find(t => t[0] === name);
  return tag ? tag[index] : null;
}

export default function DListDetail() {
  const { id } = useParams(); // event id or encoded a-tag
  const decodedId = decodeURIComponent(id);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvent() {
      try {
        setLoading(true);
        setError(null);

        let events;

        // Determine if this is an a-tag reference (39998:pubkey:d-tag) or event id
        if (decodedId.startsWith('39998:') || decodedId.startsWith('9998:')) {
          // a-tag format: kind:pubkey:d-tag
          const parts = decodedId.split(':');
          const kind = parseInt(parts[0], 10);
          const pubkey = parts[1];
          const dTag = parts.slice(2).join(':'); // d-tag may contain colons
          events = await queryRelay({ kinds: [kind], authors: [pubkey], '#d': [dTag] });
        } else {
          // Raw event id
          events = await queryRelay({ ids: [decodedId] });
        }

        if (!cancelled && events.length > 0) {
          setEvent(events[0]);
        } else if (!cancelled) {
          setError('Event not found');
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEvent();
    return () => { cancelled = true; };
  }, [decodedId]);

  if (loading) {
    return (
      <div className="page">
        <Breadcrumbs />
        <p>Loading DList…</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="page">
        <Breadcrumbs />
        <p className="error">Error: {error || 'Event not found'}</p>
      </div>
    );
  }

  const singular = getTag(event, 'names', 1) || getTag(event, 'name', 1) || '(unnamed)';
  const plural = getTag(event, 'names', 2) || singular;
  const description = getTag(event, 'description');

  const tabs = [
    { to: '', label: 'Overview', end: true },
    { to: 'items', label: 'Items' },
    { to: 'ratings', label: 'Ratings' },
    { to: 'raw', label: 'Raw Data' },
    { to: 'actions', label: 'Actions' },
  ];

  return (
    <div className="page">
      <Breadcrumbs />

      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.85rem', opacity: 0.45, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          a list of
        </div>
        <h1 style={{
          fontSize: '2.2rem',
          margin: '0.15rem 0 0.4rem',
          color: '#58a6ff',
          fontWeight: 700,
          letterSpacing: '0.02em',
        }}>
          {plural}
        </h1>
        {description && (
          <p style={{ fontSize: '0.95rem', opacity: 0.6, maxWidth: '600px', margin: '0 auto' }}>
            {description}
          </p>
        )}
      </div>

      <nav className="tab-nav">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="tab-content">
        <Outlet context={{ event }} />
      </div>
    </div>
  );
}
