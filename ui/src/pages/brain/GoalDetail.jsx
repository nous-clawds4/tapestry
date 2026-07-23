import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import useBrainGoals from '../../hooks/useBrainGoals';

/**
 * Minimal Goal detail (second-brain #3, ADR 0003 d11): the goal's intent —
 * name, statement, standing, capture metadata, parent context, and the two
 * labelled fields — read-only, owner-gated. Story 4 grows this page into the
 * one-spine view (pointers + record). No new read endpoint: the page selects
 * its goal from the same list read the tree uses; when duplicates exist it
 * shows the resolver's winning record (oldest capture, uuid tie-break) — the
 * same truth the tree renders.
 */

const HINT_LINE = 'needs a deliverable and boundary before it can be proposed';

export default function GoalDetail() {
  const { slug } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { goals, loading, error, refetch } = useBrainGoals();
  const isOwner = user?.classification === 'owner' || user?.classification === 'admin';

  const goal = useMemo(() => {
    if (!Array.isArray(goals)) return null;
    const matches = goals.filter((g) => g.slug === slug);
    if (matches.length === 0) return null;
    return [...matches].sort((a, b) => {
      const ca = typeof a.createdAt === 'number' ? a.createdAt : Infinity;
      const cb = typeof b.createdAt === 'number' ? b.createdAt : Infinity;
      if (ca !== cb) return ca - cb;
      return a.uuid < b.uuid ? -1 : 1;
    })[0];
  }, [goals, slug]);

  const parentGoal = useMemo(() => {
    if (!goal || !goal.parentUuid || !Array.isArray(goals)) return null;
    return goals.find((g) => g.uuid === goal.parentUuid) || null;
  }, [goals, goal]);

  if (authLoading) {
    return (
      <div className="page brain-goals">
        <Breadcrumbs />
        <h1>Goal</h1>
        <p className="brain-muted">Checking who you are…</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="page brain-goals">
        <Breadcrumbs />
        <h1>Goal</h1>
        <div className="brain-gate">
          <p>🔒 Goals are only available to the owner.</p>
          {!user && <p>Please sign in to continue.</p>}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page brain-goals">
        <Breadcrumbs />
        <div className="brain-goal-list" aria-hidden="true">
          <div className="bsp-skeleton-row" />
          <div className="bsp-skeleton-row" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page brain-goals">
        <Breadcrumbs />
        <Link to="/tapestry/goals" className="bsp-back-link">← Goals</Link>
        <p className="brain-error">
          Couldn't load this goal — <a className="brain-retry" onClick={refetch}>Retry</a>
        </p>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="page brain-goals">
        <Breadcrumbs />
        <Link to="/tapestry/goals" className="bsp-back-link">← Goals</Link>
        <p className="brain-empty">Couldn't find this goal — it may have been renamed or removed.</p>
      </div>
    );
  }

  // A leaf still missing a deliverable or boundary carries the hint; 'viable'
  // leaves have both. Goals with children show no hint (they are never
  // proposed as a whole — their pieces are).
  const showHint = !goal.hasChildren && goal.standing !== 'viable';

  return (
    <div className="page brain-goals">
      <Breadcrumbs />
      <Link to="/tapestry/goals" className="bsp-back-link">← Goals</Link>
      <h1>{goal.name}</h1>
      <p className="brain-detail-meta">
        <span className="brain-goal-standing">{goal.standing || 'captured'}</span>
        {parentGoal && parentGoal.slug && (
          <> · part of "<Link to={`/tapestry/goals/${parentGoal.slug}`}>{parentGoal.name}</Link>"</>
        )}
        {parentGoal && !parentGoal.slug && <> · part of "{parentGoal.name}"</>}
        {goal.captureDate && <> · captured {goal.captureDate}</>}
        {goal.origin && <> · {goal.origin}</>}
      </p>
      {goal.statement && <p className="brain-detail-statement">{goal.statement}</p>}
      {goal.deliverable && (
        <p className="brain-detail-field"><strong>Done means:</strong> {goal.deliverable}</p>
      )}
      {goal.boundary && (
        <p className="brain-detail-field"><strong>Stays inside:</strong> {goal.boundary}</p>
      )}
      {showHint && <p className="brain-goal-hint">{HINT_LINE}</p>}
    </div>
  );
}
