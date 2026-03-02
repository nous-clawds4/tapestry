import { NavLink, Outlet } from 'react-router-dom';

export default function EventsIndex() {
  return (
    <div className="page">
      <h1>📡 Nostr Events</h1>
      <p className="subtitle">Browse raw nostr events stored in the local strfry relay.</p>

      <div className="event-type-cards">
        <NavLink to="dlist-items" className="event-type-card">
          <h3>📋 DList Items</h3>
          <p>Kind 9999 &amp; 39999 — items on Decentralized Lists</p>
        </NavLink>

        <div className="event-type-card disabled">
          <h3>📄 DList Headers</h3>
          <p>Kind 9998 &amp; 39998 — see Simple Lists</p>
        </div>

        <div className="event-type-card disabled">
          <h3>👤 Profiles</h3>
          <p>Kind 0 — coming soon</p>
        </div>

        <div className="event-type-card disabled">
          <h3>⚡ Reactions</h3>
          <p>Kind 7 — coming soon</p>
        </div>
      </div>
    </div>
  );
}
