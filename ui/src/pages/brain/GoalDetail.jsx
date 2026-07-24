import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import useBrainGoalDetail from '../../hooks/useBrainGoalDetail';

/**
 * Goal detail — the one spine (second-brain #4, ADR 0004 d10; grows the minimal
 * detail from #3). Intent (name, standing, capture metadata, parent context,
 * "Done means" / "Stays inside") on top, then the goal's resource pointers, then
 * its append-only record. Read-only, owner-gated: attaching and verifying happen
 * in conversation, never here. Copy comes verbatim from the style/design guides.
 */

const HINT_LINE = 'needs a deliverable and boundary before it can be proposed';
const POINTER_EMPTY = 'Nothing attached yet — resources this goal needs will appear here.';

// Design-guide pointer-card kind markers (typography, not icons). These short
// markers are the design guide's own vocabulary — the sanctioned exception to
// the banned-jargon rule (ADR 0004 d11).
const KIND_MARKER = {
  'file': 'file',
  'vault-note': 'vault',
  'nostr-event': 'event',
  'repository': 'repo',
  'web-address': 'web',
};

function truncateMiddle(s, max = 48) {
  if (typeof s !== 'string' || s.length <= max) return s || '';
  const keep = Math.floor((max - 1) / 2);
  return `${s.slice(0, keep)}…${s.slice(s.length - keep)}`;
}

// The freshness line, worded verbatim per the style guide, colored by the
// server-derived standing word (the color only reinforces the word).
function freshnessLine(p) {
  const n = typeof p.freshnessDays === 'number' ? Math.max(0, p.freshnessDays) : null;
  if (p.freshness === 'unreachable') return 'unreachable at last check';
  if (p.freshness === 'stale') return n == null ? 'not verified recently' : `not verified in ${n} days`;
  // 'current' is only ever server-derived with a real day-count (OPEN.md row 87a).
  return `verified ${n} days ago`;
}

function PointerCard({ pointer }) {
  const marker = KIND_MARKER[pointer.locatorKind] || pointer.locatorKind;
  return (
    <li className="brain-pointer-card">
      <span className="brain-pointer-kind">{marker}</span>
      <span className="brain-pointer-main">
        {pointer.locator ? (
          <a
            className="brain-pointer-title"
            href={pointer.locator}
            target="_blank"
            rel="noopener noreferrer"
          >{pointer.title}</a>
        ) : (
          <span className="brain-pointer-title">{pointer.title}</span>
        )}
        <span className="brain-pointer-locator">{truncateMiddle(pointer.locator)}</span>
        <span className={`brain-freshness brain-fresh-${pointer.freshness || 'current'}`}>{freshnessLine(pointer)}</span>
        {pointer.whyKept && <span className="brain-pointer-why">{pointer.whyKept}</span>}
      </span>
    </li>
  );
}

function RecordEntry({ entry }) {
  // Append-only: a dated fact with a type word, a one-sentence summary, the
  // session that left it, any produced resources as pointer cards, and at most
  // two plain-language questions. No edit affordance exists on any entry, ever
  // (AC 6; the ledger is the ledger).
  return (
    <li className="brain-record-entry">
      <span className="brain-record-head">
        <span className="brain-record-date">{entry.date}</span>
        <span className="brain-record-type">{entry.type}</span>
        {entry.session && <span className="brain-record-session">{entry.session}</span>}
      </span>
      <span className="brain-record-summary">{entry.summary}</span>
      {Array.isArray(entry.produced) && entry.produced.length > 0 && (
        <ul className="brain-record-produced brain-pointer-list">
          {entry.produced.map((p, i) => <PointerCard key={p.locator || i} pointer={p} />)}
        </ul>
      )}
      {Array.isArray(entry.questions) && entry.questions.length > 0 && (
        <ul className="brain-record-questions">
          {entry.questions.map((q, i) => <li key={i} className="brain-record-question">{q}</li>)}
        </ul>
      )}
    </li>
  );
}

export default function GoalDetail() {
  const { slug } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { goal, pointers, records, loading, error, refetch } = useBrainGoalDetail(slug);
  const isOwner = user?.classification === 'owner' || user?.classification === 'admin';

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
          Couldn't load this goal — <button type="button" className="brain-retry" onClick={refetch}>Retry</button>
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
  // leaves have both. Goals with children show no hint (their pieces are).
  const showHint = !goal.hasChildren && goal.standing !== 'viable';

  return (
    <div className="page brain-goals">
      <Breadcrumbs />
      <Link to="/tapestry/goals" className="bsp-back-link">← Goals</Link>
      <h1>{goal.name}</h1>
      <p className="brain-detail-meta">
        <span className="brain-goal-standing">{goal.standing || 'captured'}</span>
        {goal.parentSlug && (
          <> · part of "<Link to={`/tapestry/goals/${goal.parentSlug}`}>{goal.parentName}</Link>"</>
        )}
        {!goal.parentSlug && goal.parentName && <> · part of "{goal.parentName}"</>}
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

      <section className="brain-pointers">
        <h2 className="brain-section-title">Resources</h2>
        {pointers.length === 0 ? (
          <p className="brain-empty">{POINTER_EMPTY}</p>
        ) : (
          <ul className="brain-pointer-list">
            {pointers.map((p, i) => <PointerCard key={p.locator || i} pointer={p} />)}
          </ul>
        )}
      </section>

      {records.length > 0 && (
        <section className="brain-record">
          <h2 className="brain-section-title">Record</h2>
          <ul className="brain-record-list">
            {records.map((entry, i) => <RecordEntry key={i} entry={entry} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
