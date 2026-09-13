import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useListItems from '../../hooks/useListItems';
import useItemVotes from '../../hooks/useItemVotes';
import useTrustWeights from '../../hooks/useTrustWeights';
import useProfiles from '../../hooks/useProfiles';
import { useTrust, SCORING_METHODS } from '../../context/TrustContext';
import { curatedItemRows, itemsEmptySentence, itemRouteId, weightsState, candidateVerdicts, LIST_ITEMS_LIMIT } from '../../utils/treasureMap';
import { timeAgo } from '../../utils/timeAgo';

/*
 * The rest of a curated DList's detail page (my-curated-dlists #3, ADR 0003): the curation-method
 * panel, the Update list button — a placeholder that acts on nothing — and the list's items in a
 * table with the operator's three views. On my own lists the panel shows the method and the cutoff,
 * and each candidate carries its verdict (curated-dlist-update ADR 0004 §7). Read-only: nothing here
 * signs, publishes, or imports.
 * On another assistant's list (`curator` 'other' — curated-dlist-update ADR 0003 §3–§4) the items are
 * judged from that assistant's side, its list is read at the Map entry's relay (`listRelay`), and
 * Update says where it runs.
 */

const short = (pk) => (typeof pk === 'string' && pk.length > 12 ? `${pk.slice(0, 8)}…${pk.slice(-4)}` : String(pk || ''));
const muted = { fontSize: '0.85rem', opacity: 0.65 };
const warn = { fontSize: '0.85rem', color: '#f59e0b' };
const sectionBox = {
  padding: '0.9rem 1rem', marginTop: '1rem', border: '1px solid var(--border, #444)',
  borderRadius: '8px', backgroundColor: 'var(--bg-secondary, #1a1a2e)',
};
const sectionTitle = { margin: 0, fontSize: '0.95rem' };
const cell = { padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border, #333)', textAlign: 'left', fontSize: '0.85rem' };

const FROM_LABEL = { assistant: 'your assistant', other: 'someone else', candidate: 'candidate' };
// Another assistant's list, seen read-only (curated-dlist-update ADR 0003 §3).
const FROM_LABEL_OTHER = { ...FROM_LABEL, assistant: 'its assistant' };
const FROM_COLOR = { assistant: '#3fb950', other: '#8b949e', candidate: '#58a6ff' };

// Why the candidates box is off-limits, by `sharedListUnavailable`'s answer (ADR 0003 note 1).
const UNAVAILABLE_REASON = {
  checking: 'checking your assistant’s header…',
  failed: 'your assistant’s header couldn’t be checked',
  missing: 'your assistant’s header was not found',
  'no-pointer': 'your assistant’s header names no shared list',
  deferred: 'your assistant’s header is marked deliberately unaffiliated',
};
// The same reasons on another assistant's list (curated-dlist-update ADR 0003 §3).
const UNAVAILABLE_REASON_OTHER = {
  checking: 'checking its assistant’s header…',
  failed: 'its assistant’s header couldn’t be checked',
  missing: 'its assistant’s header was not found',
  'no-pointer': 'its assistant’s header names no shared list',
  deferred: 'its assistant’s header is marked deliberately unaffiliated',
};

// The method panel's link, a vote's words in a candidate's reason, and a number as a verdict shows it
// (curated-dlist-update ADR 0004 §7).
const TRUST_DETERMINATION_PATH = '/tapestry/grapevine/trust-determination';
const VOTE_LABEL = {
  'implicit-upvote': 'implicit upvote', 'implicit-upvote-cancelled': 'implicit upvote, cancelled',
  'explicit-downvote': 'downvote (author)', upvote: 'upvote', downvote: 'downvote', other: 'other',
};
const num = (n) => (typeof n === 'number' && Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : '—');

/** The panel's last line: the verdicts' summary, as the items section reports it (ADR 0004 §7). */
function summaryLine(summary) {
  if (!summary || summary.state === 'hidden') return 'Turn on “Also show candidates to copy” to see which qualify.';
  if (summary.state === 'checking') return '⏳ Checking…';
  if (summary.state === 'incomplete') return `Verdicts incomplete — couldn’t check ${summary.reason}.`;
  return `${summary.qualifying} of ${summary.total} candidates qualify`;
}

/**
 * How my assistant decides which candidates to copy (curated-dlist-update ADR 0004 §7): the Scoring Method
 * and point of view chosen on Trust Determination — only read here — and the cutoff, with the verdicts'
 * summary. Closed on every load; none of it is written onto the list.
 */
export function CurationMethodPanel({ cutoff, onCutoffChange, summary }) {
  const [open, setOpen] = useState(false);
  const { povPubkey, scoringMethod, trustedListId } = useTrust();
  const profiles = useProfiles(povPubkey ? [povPubkey] : []);
  const methodLabel = SCORING_METHODS.find((m) => m.id === scoringMethod)?.label || scoringMethod;
  const povName = (povPubkey && (profiles[povPubkey]?.name || profiles[povPubkey]?.display_name)) || null;
  return (
    <section style={sectionBox}>
      <button type="button" className="btn btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ fontSize: '0.85rem' }}>
        {open ? '▾' : '▸'} Curation method
      </button>
      {open && (
        <div style={{ marginTop: '0.6rem', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div>
            Scoring Method: <strong>{methodLabel}</strong>
            {scoringMethod === 'trusted-list' && <> · {trustedListId ? <code>{trustedListId}</code> : 'no list chosen'}</>}
          </div>
          <div>Point of view: {povPubkey ? <>{povName ? `${povName} · ` : ''}<code>{short(povPubkey)}</code></> : '—'}</div>
          <div><Link to={TRUST_DETERMINATION_PATH} style={{ color: '#58a6ff' }}>Change them on Trust Determination →</Link></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            Cutoff (≥)
            <input type="number" value={cutoff} step="0.1" onChange={(e) => onCutoffChange(parseFloat(e.target.value) || 0)} style={{ width: '80px' }} />
          </label>
          <p style={{ ...muted, margin: 0 }}>
            A candidate qualifies when its score reaches the cutoff: its author&apos;s implicit upvote plus the
            trust-weighted upvotes, minus the trust-weighted downvotes.
          </p>
          <p style={{ ...muted, margin: 0 }}>These apply in this browser and are not written onto the list.</p>
          <div>{summaryLine(summary)}</div>
        </div>
      )}
    </section>
  );
}

/**
 * Placeholder — present, disabled, and wired to nothing. On another assistant's list it says where
 * Update runs, and mentions curating here when that is offered (curated-dlist-update ADR 0003 §3).
 */
export function UpdateListButton({ curator = 'mine', canCurateHere = false } = {}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <button type="button" className="btn btn-sm" disabled>Update list</button>
      {curator === 'other'
        ? <span style={muted}>Update list runs only on the instance where this list&apos;s assistant lives.{canCurateHere ? ' You can curate it here instead.' : ''}</span>
        : <span style={muted}>Update list isn&apos;t built yet.</span>}
    </span>
  );
}

/** Source notes for one list read: a failed source, or the local cap (ADR 0003 sub-decision 7). */
function SourceNotes({ list, communityRelay, what }) {
  if (!list) return null;
  const notes = [];
  if (list.local === 'failed') notes.push(`Couldn’t check this instance’s strfry for ${what} — showing what ${communityRelay} returned.`);
  if (list.relay === 'failed') notes.push(`Couldn’t check ${communityRelay} for ${what} — showing this instance’s only.`);
  if (list.truncated) {
    notes.push(list.total !== null && list.total !== undefined
      ? `Showing the first ${LIST_ITEMS_LIMIT} of ${list.total} ${what} found in this instance’s strfry.`
      : `Showing the first ${LIST_ITEMS_LIMIT} ${what} in this instance’s strfry — there are more.`);
  }
  return notes.map((n) => <div key={n} style={{ ...warn, marginTop: '0.35rem' }}>⚠️ {n}</div>);
}

/** A candidate's verdict; a decided or unchecked one opens its reason (curated-dlist-update ADR 0004 §7). */
function VerdictCell({ verdict, cutoff, open, onToggle }) {
  const v = verdict && typeof verdict === 'object' ? verdict : { verdict: 'checking' };
  if (v.verdict === 'checking') return <span style={muted}>⏳ checking…</span>;
  const text = v.verdict === 'unchecked' ? '⚠️ couldn’t check'
    : v.verdict === 'qualifies' ? `✓ qualifies · ${num(v.score)} ≥ ${num(cutoff)}`
      : `✗ skipped · ${num(v.score)} < ${num(cutoff)}`;
  const color = v.verdict === 'qualifies' ? '#3fb950' : v.verdict === 'unchecked' ? '#f59e0b' : '#8b949e';
  return (
    <button type="button" aria-expanded={open} onClick={onToggle}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color, fontSize: '0.85rem', fontWeight: 600, textAlign: 'left' }}>
      {open ? '▾' : '▸'} {text}
    </button>
  );
}

/** Why a candidate got its verdict: what couldn't be read, or the votes that made its score (the breakdown). */
function VerdictReason({ verdict }) {
  if (!verdict || typeof verdict !== 'object') return null;
  if (verdict.verdict === 'checking') return <div style={muted}>⏳ checking…</div>;
  if (verdict.verdict === 'unchecked') return <div style={warn}>Couldn’t check {verdict.reason}.</div>;
  const head = { ...cell, fontWeight: 500, opacity: 0.7 };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={head}>Voter</th>
          <th style={head}>Vote</th>
          <th style={head}>Weight</th>
          <th style={head}>Contribution</th>
          <th style={head}>Note</th>
        </tr>
      </thead>
      <tbody>
        {(Array.isArray(verdict.breakdown) ? verdict.breakdown : []).map((b, i) => (
          <tr key={i}>
            <td style={cell}><code>{short(b.pubkey)}</code>{b.role === 'author' ? ' (author)' : ''}</td>
            <td style={cell}>{VOTE_LABEL[b.type] || b.type}</td>
            <td style={cell}>{num(b.weight)}</td>
            <td style={cell}>{b.contribution > 0 ? `+${num(b.contribution)}` : num(b.contribution)}</td>
            <td style={{ ...cell, opacity: 0.7 }}>{b.note || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The items on the curated list, with the two "also show" views, in a table — judged from its
 * curator's side (`assistantPubkey`: my assistant, or — read-only — the assistant my Map names). On my
 * own lists each candidate carries its verdict against `cutoff`, and the summary goes up through
 * `onVerdictSummary` (curated-dlist-update ADR 0004 §7).
 */
export function ItemsSection({ myCoord, sharedCoord, sharedUnavailable, assistantPubkey, communityRelay, curator = 'mine', listRelay = communityRelay, canCurateHere = false, cutoff, onVerdictSummary }) {
  const [showOthers, setShowOthers] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const [openReason, setOpenReason] = useState(null); // the candidate row whose reason is open
  // The curated list is read on mount at listRelay — for another assistant's list, its Map entry's relay
  // (curated-dlist-update ADR 0003 §4); the shared list only while "candidates" is on (ADR 0003
  // sub-decision 4), at the community relay.
  const mine = useListItems([myCoord], listRelay);
  const shared = useListItems(showCandidates && sharedCoord ? [sharedCoord] : [], communityRelay);
  const labels = curator === 'other' ? FROM_LABEL_OTHER : FROM_LABEL;
  const reasons = curator === 'other' ? UNAVAILABLE_REASON_OTHER : UNAVAILABLE_REASON;
  const myList = mine.lists[myCoord];
  const sharedList = showCandidates && sharedCoord ? shared.lists[sharedCoord] : undefined;
  const rows = curatedItemRows({
    mine: myList ? myList.items : [],
    shared: sharedList && !(sharedList.local === 'failed' && sharedList.relay === 'failed') ? sharedList.items : null,
    assistantPubkey, showOthers, showCandidates,
  });

  // The candidates' verdicts — my own lists only (curated-dlist-update ADR 0004 §7). While candidates are shown
  // and the shared list was read, their votes (both sources) and the trust weights of their authors and voters
  // are read and judged against the cutoff; a read-only list reads neither.
  const wanted = curator === 'mine' && showCandidates && !!sharedCoord;
  const sharedFailed = !!sharedList && sharedList.local === 'failed' && sharedList.relay === 'failed';
  const judging = wanted && !!sharedList && !sharedFailed;
  const candidateRoutes = new Set(rows.filter((r) => r.from === 'candidate').map((r) => r.routeId));
  const candidates = judging ? sharedList.items.map((x) => x.event).filter((e) => candidateRoutes.has(itemRouteId(e))) : [];
  const votes = useItemVotes(judging ? candidates.map((e) => e.id) : [], communityRelay);
  // The weights are read once the votes are in. useTrustWeights re-reads whenever its array changes identity,
  // so the array is keyed on its content (ADR §3).
  const pubkeyKey = judging && votes
    ? [...new Set([...candidates, ...votes.events].map((e) => e.pubkey).filter((pk) => typeof pk === 'string' && pk !== ''))].sort().join(',')
    : '';
  const pubkeys = useMemo(() => (pubkeyKey ? pubkeyKey.split(',') : []), [pubkeyKey]);
  const trust = useTrustWeights(pubkeys);
  const verdicts = candidateVerdicts({
    candidates,
    votes: judging ? votes : null,
    weights: { state: weightsState({ ...trust, pubkeys }), values: trust.weights, error: trust.error },
    cutoff,
  });
  // The panel's summary (ADR §7): hidden while candidates are off, and "couldn't check" when the shared list
  // couldn't be read. Reported up when its content changes, not on every render.
  const summary = !wanted ? { state: 'hidden' }
    : sharedFailed ? { state: 'incomplete', qualifying: 0, total: 0, reason: 'the shared list' }
      : verdicts.summary;
  const summaryKey = JSON.stringify(summary);
  useEffect(() => { if (onVerdictSummary) onVerdictSummary(summary); }, [summaryKey]); // its content is its identity

  let body;
  if (!myList) {
    body = <div style={{ ...muted, marginTop: '0.6rem' }}>⏳ Loading items…</div>;
  } else if (myList.local === 'failed' && myList.relay === 'failed') {
    body = <div style={{ ...warn, marginTop: '0.6rem' }}>⚠️ Couldn&apos;t check — looked in this instance&apos;s strfry and on {listRelay}.</div>;
  } else {
    body = (
      <>
        <SourceNotes list={myList} communityRelay={listRelay} what="items" />
        {showCandidates && sharedCoord && !sharedList && <div style={{ ...muted, marginTop: '0.35rem' }}>⏳ Loading candidates…</div>}
        {sharedList && sharedList.local === 'failed' && sharedList.relay === 'failed' && (
          <div style={{ ...warn, marginTop: '0.35rem' }}>⚠️ Couldn&apos;t check the shared list — looked in this instance&apos;s strfry and on {communityRelay}.</div>
        )}
        {sharedList && !(sharedList.local === 'failed' && sharedList.relay === 'failed') && (
          <SourceNotes list={sharedList} communityRelay={communityRelay} what="candidates" />
        )}
        {rows.length === 0 ? (
          <div style={{ ...muted, marginTop: '0.6rem' }}>{itemsEmptySentence({ showOthers, shared: sharedList, curator })}</div>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '0.6rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={cell}>Name</th>
                  <th style={cell}>Author</th>
                  <th style={cell}>From</th>
                  <th style={cell}>Added</th>
                  {judging && <th style={cell}>Verdict</th>}
                </tr>
              </thead>
              <tbody>
                {rows.flatMap((r) => [
                  <tr key={r.key}>
                    <td style={cell}>
                      {r.local
                        ? <Link to={`/tapestry/lists/items/${encodeURIComponent(r.routeId)}`} style={{ color: '#58a6ff' }}>{r.name}</Link>
                        : <>{r.name} <span style={muted}>(on {r.from === 'candidate' ? communityRelay : listRelay} only)</span></>}
                    </td>
                    <td style={cell}>{r.from === 'assistant' ? labels.assistant : <code>{short(r.author)}</code>}</td>
                    <td style={{ ...cell, color: FROM_COLOR[r.from], fontWeight: 600 }}>{labels[r.from]}</td>
                    <td style={{ ...cell, opacity: 0.75 }}>{timeAgo(r.createdAt)}</td>
                    {judging && (
                      <td style={cell}>
                        {r.from === 'candidate' && (
                          <VerdictCell verdict={verdicts.byRouteId[r.routeId]} cutoff={cutoff} open={openReason === r.key}
                            onToggle={() => setOpenReason((k) => (k === r.key ? null : r.key))} />
                        )}
                      </td>
                    )}
                  </tr>,
                  judging && r.from === 'candidate' && openReason === r.key && (
                    <tr key={`${r.key}:reason`}>
                      <td colSpan={5} style={cell}><VerdictReason verdict={verdicts.byRouteId[r.routeId]} /></td>
                    </tr>
                  ),
                ])}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  return (
    <section style={sectionBox}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h3 style={sectionTitle}>Items</h3>
        <UpdateListButton curator={curator} canCurateHere={canCurateHere} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.6rem', fontSize: '0.85rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <input type="checkbox" checked={showOthers} onChange={(e) => setShowOthers(e.target.checked)} />
          Also show items others added to this list
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: sharedUnavailable ? 0.6 : 1 }}>
          <input type="checkbox" checked={showCandidates} disabled={!!sharedUnavailable} onChange={(e) => setShowCandidates(e.target.checked)} />
          Also show candidates to copy
          {sharedUnavailable && <span style={muted}>— unavailable: {reasons[sharedUnavailable] || sharedUnavailable}</span>}
        </label>
      </div>
      {body}
    </section>
  );
}
