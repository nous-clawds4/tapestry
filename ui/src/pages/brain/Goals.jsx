import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import useBrainGoals from '../../hooks/useBrainGoals';

/**
 * Goals view (second-brain #1, ADR 0001 decision 5). Owner-gated, read-only:
 * capture happens in conversation, not here. Copy comes verbatim from the
 * style guide; standing is derived server-side and rendered as a word.
 */

const COLD_START =
  "Your brain is empty — that's the right place to start. Tell your assistant a goal in plain words and it will appear here.";
const PRIVACY_LINE = 'This brain stays on this machine — nothing here is published.';

export default function Goals() {
  const { user, loading: authLoading } = useAuth();
  const { goals, loading, error, refetch } = useBrainGoals();
  const isOwner = user?.classification === 'owner' || user?.classification === 'admin';

  // New-row highlight: rows whose uuid wasn't in the previous result get a
  // 2-second fade (design guide: capture confirmation in an open view).
  const seenUuids = useRef(null);
  const [freshUuids, setFreshUuids] = useState(() => new Set());
  useEffect(() => {
    if (!Array.isArray(goals)) return;
    const current = new Set(goals.map((g) => g.uuid));
    if (seenUuids.current) {
      const fresh = new Set([...current].filter((u) => !seenUuids.current.has(u)));
      if (fresh.size > 0) {
        setFreshUuids(fresh);
        const t = setTimeout(() => setFreshUuids(new Set()), 2100);
        return () => clearTimeout(t);
      }
    }
    seenUuids.current = current;
  }, [goals]);
  useEffect(() => {
    if (Array.isArray(goals)) seenUuids.current = new Set(goals.map((g) => g.uuid));
  }, [goals]);

  if (authLoading) {
    return (
      <div className="page brain-goals">
        <Breadcrumbs />
        <h1>Goals</h1>
        <p className="brain-muted">Checking who you are…</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="page brain-goals">
        <Breadcrumbs />
        <h1>Goals</h1>
        <div className="brain-gate">
          <p>🔒 Goals are only available to the owner.</p>
          {!user && <p>Please sign in to continue.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="page brain-goals">
      <Breadcrumbs />
      <h1>Goals</h1>

      {loading && (
        <div className="brain-goal-list" aria-hidden="true">
          <div className="bsp-skeleton-row" />
          <div className="bsp-skeleton-row" />
          <div className="bsp-skeleton-row" />
        </div>
      )}

      {!loading && error && (
        <p className="brain-error">
          Couldn't load your goals — <a className="brain-retry" onClick={refetch}>Retry</a>
        </p>
      )}

      {!loading && !error && Array.isArray(goals) && goals.length === 0 && (
        <p className="brain-empty">{COLD_START}</p>
      )}

      {!loading && !error && Array.isArray(goals) && goals.length > 0 && (
        <ul className="brain-goal-list">
          {goals.map((g) => (
            <li
              key={g.uuid}
              className={`brain-goal-row${freshUuids.has(g.uuid) ? ' brain-row-new' : ''}`}
            >
              <span className="brain-goal-name">{g.name}</span>
              <span className="brain-goal-standing">{g.standing || 'captured'}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="brain-privacy-line">{PRIVACY_LINE}</p>
    </div>
  );
}
