import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import useBrainProposals from '../../hooks/useBrainProposals';

/**
 * Proposal queue — "What next?" (second-brain #6, ADR 0006 d12). The third
 * owner-gated view: open proposals render as emphasis cards with equal-weight
 * Approve / Skip-with-reason. Copy comes verbatim from the style/design guides.
 * The MAKING of proposals happens in conversation (make-proposal); this view is
 * where the owner DECIDES. Decisions are append-only facts — a decided proposal
 * leaves the queue and shows on its goal's spine. No numbers anywhere
 * (design principle 2): comparisons and words only, never a decimal.
 */

const VIEW_TITLE = 'What next?';
const EMPTY = 'No proposal right now — the next one appears when there are viable goals to choose between.';
const SKIP_PLACEHOLDER = 'why not this one, in a few words';
const SKIP_CONFIRM = 'Skipped — noted.';
const APPROVE_CONFIRM = "Approved — launch it when you're ready.";

export default function Proposals() {
  const { user, loading: authLoading } = useAuth();
  const { proposals, loading, error, approve, skip } = useBrainProposals();
  const isOwner = user?.classification === 'owner' || user?.classification === 'admin';

  const [skippingId, setSkippingId] = useState(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState(null); // { id, text }
  const [busy, setBusy] = useState(false);

  if (authLoading) {
    return (
      <div className="page brain-goals">
        <Breadcrumbs />
        <h1>{VIEW_TITLE}</h1>
        <p className="brain-muted">Checking who you are…</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="page brain-goals">
        <Breadcrumbs />
        <h1>{VIEW_TITLE}</h1>
        <div className="brain-gate">
          <p>🔒 Proposals are only available to the owner.</p>
          {!user && <p>Please sign in to continue.</p>}
        </div>
      </div>
    );
  }

  const onApprove = async (p) => {
    setBusy(true);
    const r = await approve(p.proposalId);
    setBusy(false);
    if (r?.success) setConfirmation({ id: p.proposalId, text: APPROVE_CONFIRM });
  };
  const beginSkip = (p) => { setSkippingId(p.proposalId); setReason(''); };
  const cancelSkip = () => { setSkippingId(null); setReason(''); };
  const submitSkip = async (p) => {
    if (!reason.trim()) return;
    setBusy(true);
    const r = await skip(p.proposalId, reason.trim());
    setBusy(false);
    if (r?.success) {
      setSkippingId(null);
      setReason('');
      setConfirmation({ id: p.proposalId, text: SKIP_CONFIRM });
    }
  };

  return (
    <div className="page brain-goals">
      <Breadcrumbs />
      <h1>{VIEW_TITLE}</h1>

      {loading && (
        <div className="brain-proposal-list" aria-hidden="true">
          <div className="bsp-skeleton-row" />
        </div>
      )}

      {!loading && error && (
        <p className="brain-error">
          The proposer couldn't run — its last message: {String(error)}. Nothing was decided for you.
        </p>
      )}

      {!loading && !error && Array.isArray(proposals) && proposals.length === 0 && (
        <p className="brain-empty">{EMPTY}</p>
      )}

      {!loading && !error && Array.isArray(proposals) && proposals.length > 0 && (
        <ul className="brain-proposal-list">
          {proposals.map((p) => (
            <li key={p.proposalId} className="brain-proposal-card" role="region" aria-label={`Proposal: ${p.goalName}`}>
              <div className="brain-proposal-next"><strong>Next:</strong> {p.goalName}</div>
              {p.whyNow && <p className="brain-proposal-whynow">{p.whyNow}</p>}
              {Array.isArray(p.passedOver) && p.passedOver.length > 0 && (
                <div className="brain-proposal-considered">
                  <span className="brain-proposal-considered-label">considered instead</span>
                  <ul className="brain-proposal-runners">
                    {p.passedOver.map((runnerUp, i) => (
                      <li key={runnerUp.goal || i} className="brain-proposal-runner">
                        <span className="brain-proposal-runner-name">{runnerUp.goalName}</span>
                        <span className="brain-proposal-runner-why"> — {runnerUp.whyNot}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {confirmation && confirmation.id === p.proposalId ? (
                <p className="brain-proposal-confirm">{confirmation.text}</p>
              ) : skippingId === p.proposalId ? (
                <div className="brain-proposal-skipfield">
                  <input
                    className="brain-proposal-reason"
                    type="text"
                    placeholder={SKIP_PLACEHOLDER}
                    value={reason}
                    autoFocus
                    onChange={(e) => setReason(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); submitSkip(p); }
                      else if (e.key === 'Escape') { e.preventDefault(); cancelSkip(); }
                    }}
                  />
                  <button
                    type="button"
                    className="brain-btn brain-btn-skip"
                    disabled={busy || !reason.trim()}
                    onClick={() => submitSkip(p)}
                  >Skip</button>
                  <button type="button" className="brain-btn-text" onClick={cancelSkip}>Cancel</button>
                </div>
              ) : (
                <div className="brain-proposal-actions">
                  <button
                    type="button"
                    className="brain-btn brain-btn-approve"
                    disabled={busy}
                    onClick={() => onApprove(p)}
                  >Approve</button>
                  <button
                    type="button"
                    className="brain-btn brain-btn-skip-open"
                    disabled={busy}
                    onClick={() => beginSkip(p)}
                  >Skip…</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
