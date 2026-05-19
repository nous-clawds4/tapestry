import React from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { useAuth } from '../context/AuthContext';
import usePins from '../hooks/usePins';

/**
 * Story 10 / ADR 0009 — viewer's pinned-tag list page.
 *
 *   - Logged-out: sign-in empty state (AC-8).
 *   - Logged-in empty: "You haven't pinned any tags yet." with a link to /tags.
 *   - Logged-in populated: one row per pinned tag (name + description + link
 *     to /tag/:slug/:eventId) (AC-5).
 *
 * Per-row unpin / curation-method editing is intentionally deferred to
 * Story 11 (see ADR 0009 "Out of scope").
 */
export default function Pins() {
  const { user, login } = useAuth();
  const { pins, loading, error } = usePins(user?.pubkey);

  if (!user) {
    return (
      <div className="bsp-page">
        <TopBar />
        <div className="bsp-content bs-pins-page">
          <h1 className="bs-pins-heading">Your pinned tags</h1>
          <p className="bs-pins-empty">
            Sign in with a NIP-07 extension to manage your pinned tags.
          </p>
          <button
            type="button"
            className="bs-pins-signin-btn"
            onClick={() => { login().catch(() => {}); }}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bsp-page">
      <TopBar />
      <div className="bsp-content bs-pins-page">
        <h1 className="bs-pins-heading">Your pinned tags</h1>
        {loading && <p className="bs-pins-loading">Loading your pins…</p>}
        {error && <p className="bs-pins-error" role="alert">⚠️ {error}</p>}
        {!loading && !error && pins.length === 0 && (
          <p className="bs-pins-empty">
            You haven't pinned any tags yet.{' '}
            <Link to="/tags" className="bs-pins-browse-link">Browse tags →</Link>
          </p>
        )}
        {!loading && !error && pins.length > 0 && (
          <ul className="bs-pins-list">
            {pins.map((row) => (
              <li key={row.pinEventId} className="bs-pins-row">
                <Link
                  to={`/tag/${encodeURIComponent(row.tag.slug)}/${row.tag.eventId}`}
                  className="bs-pins-row-link"
                >
                  <span className="bs-pins-row-name">{row.tag.name}</span>
                  {row.tag.description && (
                    <span className="bs-pins-row-desc">{row.tag.description}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
