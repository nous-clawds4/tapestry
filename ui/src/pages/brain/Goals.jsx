import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import useBrainGoals from '../../hooks/useBrainGoals';
import {
  LABEL_ESTIMATE,
  LABEL_NEEDS_YOU,
  LABEL_TOO_BIG,
  estimateLine,
  flagWord,
  promptDisplay,
} from '../../utils/goalIntent';

/**
 * Goals view (second-brain #1, ADR 0001 decision 5; decomposition tree
 * second-brain #3, ADR 0003 d10). Owner-gated, read-only: capture and
 * decomposition happen in conversation, not here. Copy comes verbatim from
 * the style/design guides; standing and the tree attachment (parentUuid) are
 * derived server-side — this view groups and renders, it never interprets.
 * Disclosure identifiers are the disclose/expand family on purpose (story-1
 * S5b pins this file free of control vocabulary).
 */

const COLD_START =
  "Your brain is empty — that's the right place to start. Tell your assistant a goal in plain words and it will appear here.";
const PRIVACY_LINE = 'This brain stays on this machine — nothing here is published.';
const HINT_LINE = 'needs a deliverable and boundary before it can be proposed';
// Export affordance (second-brain #8, ADR 0008 d11/d12). The button label is
// the style guide's pinned verbatim; the confirmation and failure sentences
// are the gate-ratified d12 strings — verbatim, or the review blocks.
const EXPORT_LABEL = 'Export brain.';
const EXPORT_CONFIRM = 'Exported — saved to this machine.';
const EXPORT_FAIL = "Couldn't export — nothing was saved. Try again.";

export default function Goals() {
  const { user, loading: authLoading } = useAuth();
  const { goals, loading, error, refetch } = useBrainGoals();
  const navigate = useNavigate();
  const isOwner = user?.classification === 'owner' || user?.classification === 'admin';

  // Disclosure state: uuids whose children are hidden (default: all open).
  const [closedIds, setClosedIds] = useState(() => new Set());

  // Export state: null | 'busy' | 'done' | 'failed' (ADR 0008 d11 — quiet
  // footer affordance; no spinner theater, the button just disables).
  const [exportState, setExportState] = useState(null);
  const exportBrain = async () => {
    setExportState('busy');
    try {
      const res = await fetch('/api/brain/export');
      if (!res.ok) throw new Error('export failed');
      const text = await res.text();
      const artifact = JSON.parse(text);
      const takenOn = artifact && artifact.takenOn ? artifact.takenOn : new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `brain-export-${takenOn}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportState('done');
    } catch {
      setExportState('failed');
    }
  };
  const discloseRow = (uuid) => {
    setClosedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

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

  // Group by the server-resolved attachment. The server never emits a
  // parentUuid outside the set; if a race ever does, the row falls back to
  // the root — the tree never hides a goal.
  const { roots, childrenOf } = useMemo(() => {
    const list = Array.isArray(goals) ? goals : [];
    const uuids = new Set(list.map((g) => g.uuid));
    const childrenOf = new Map();
    const roots = [];
    for (const g of list) {
      if (g.parentUuid && uuids.has(g.parentUuid)) {
        if (!childrenOf.has(g.parentUuid)) childrenOf.set(g.parentUuid, []);
        childrenOf.get(g.parentUuid).push(g);
      } else {
        roots.push(g);
      }
    }
    return { roots, childrenOf };
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

  const openDetail = (g) => {
    if (g.slug) navigate(`/tapestry/goals/${g.slug}`);
  };

  const renderRow = (g, depth) => {
    const kids = childrenOf.get(g.uuid) || [];
    const isOpen = !closedIds.has(g.uuid);
    // Leaves still missing a deliverable or boundary carry the design guide's
    // hint; 'viable' leaves have both (server-derived — AC 2).
    const showHint = !g.hasChildren && g.standing !== 'viable';
    return (
      <li
        key={g.uuid}
        className={`brain-goal-row${freshUuids.has(g.uuid) ? ' brain-row-new' : ''}`}
        style={{ '--brain-depth': depth }}
        role="link"
        tabIndex={g.slug ? 0 : undefined}
        aria-label={`${g.name} — open goal detail`}
        onClick={() => openDetail(g)}
        onKeyDown={(e) => { if (e.key === 'Enter') openDetail(g); }}
      >
        {kids.length > 0 ? (
          <span
            className={`brain-disclose${isOpen ? ' brain-disclose-open' : ''}`}
            role="button"
            tabIndex={0}
            aria-expanded={isOpen}
            aria-label={isOpen ? `hide the pieces of ${g.name}` : `show the pieces of ${g.name}`}
            onClick={(e) => { e.stopPropagation(); discloseRow(g.uuid); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                discloseRow(g.uuid);
              }
            }}
          >▸</span>
        ) : (
          <span className="brain-disclose brain-leaf-dot" aria-hidden="true">·</span>
        )}
        <span className="brain-goal-main">
          <span className="brain-goal-name">{g.name}</span>
          {showHint && <span className="brain-goal-hint">{HINT_LINE}</span>}
          <span className="brain-goal-hint">
            {`${LABEL_ESTIMATE} ${estimateLine(g.chanceOfSuccess)} · ${LABEL_NEEDS_YOU} ${flagWord(g.needsHumanInput)} · ${LABEL_TOO_BIG} ${flagWord(g.needsBreakdown)}`}
          </span>
          <span className="brain-goal-hint">{promptDisplay(g.prompt).text}</span>
        </span>
        <span className="brain-goal-standing">{g.standing || 'captured'}</span>
        {g.pointerCount > 0 && (
          <span className="brain-goal-pointers">{g.pointerCount} pointer{g.pointerCount === 1 ? '' : 's'}</span>
        )}
      </li>
    );
  };

  const rows = [];
  const walkDown = (g, depth) => {
    rows.push(renderRow(g, depth));
    if (!closedIds.has(g.uuid)) {
      for (const child of childrenOf.get(g.uuid) || []) walkDown(child, depth + 1);
    }
  };
  roots.forEach((g) => walkDown(g, 0));

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
          Couldn't load your goals — <button type="button" className="brain-retry" onClick={refetch}>Retry</button>
        </p>
      )}

      {!loading && !error && Array.isArray(goals) && goals.length === 0 && (
        <p className="brain-empty">{COLD_START}</p>
      )}

      {!loading && !error && Array.isArray(goals) && goals.length > 0 && (
        <ul className="brain-goal-list">{rows}</ul>
      )}

      <p className="brain-privacy-line">{PRIVACY_LINE}</p>
      <div className="brain-export-row">
        <button
          type="button"
          className="brain-btn brain-export-btn"
          disabled={exportState === 'busy'}
          onClick={exportBrain}
        >{EXPORT_LABEL}</button>
        {exportState === 'done' && <span className="brain-export-note">{EXPORT_CONFIRM}</span>}
        {exportState === 'failed' && <span className="brain-export-note brain-export-note-failed">{EXPORT_FAIL}</span>}
      </div>
    </div>
  );
}
