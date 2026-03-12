import { useParams, NavLink, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { queryRelay } from '../../api/relay';
import Breadcrumbs from '../../components/Breadcrumbs';

function getTag(event, name, index = 1) {
  const tag = event.tags?.find(t => t[0] === name);
  return tag ? tag[index] : null;
}

export default function DListItemDetail() {
  const { id } = useParams();
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
        if (decodedId.startsWith('39999:') || decodedId.startsWith('9999:')) {
          const parts = decodedId.split(':');
          const kind = parseInt(parts[0], 10);
          const pubkey = parts[1];
          const dTag = parts.slice(2).join(':');
          events = await queryRelay({ kinds: [kind], authors: [pubkey], '#d': [dTag] });
        } else {
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
        <p>Loading DList item…</p>
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

  const isListHeader = event.kind === 9998 || event.kind === 39998;
  const name = getTag(event, 'name');
  const namesSingular = getTag(event, 'names');
  const namesPlural = getTag(event, 'names', 2);

  let heading;
  if (isListHeader && (namesSingular || namesPlural)) {
    const display = namesPlural || namesSingular;
    heading = `📄 DList: ${display}`;
  } else {
    heading = `📄 ${name || '(unnamed)'}`;
  }

  const tabs = [
    { to: '', label: 'Overview', end: true },
    { to: 'ratings', label: '⭐ Ratings' },
    { to: 'raw', label: 'Raw Nostr Event' },
    { to: 'neo4j', label: 'Neo4j' },
    { to: 'actions', label: 'Actions' },
  ];

  return (
    <div className="page">
      <Breadcrumbs />

      <h1>{heading}</h1>

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
