import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useListItems from '../../hooks/useListItems';
import useItemVotes from '../../hooks/useItemVotes';
import useTrustWeights from '../../hooks/useTrustWeights';
import useProfiles from '../../hooks/useProfiles';
import { useTrust, SCORING_METHODS } from '../../context/TrustContext';
import { queryRelayBounded } from '../../api/relay';
import { curatedItemRows, itemsEmptySentence, itemRouteId, weightsState, candidateVerdicts, listReadGaps, updatePlan, planIntents, LIST_ITEMS_LIMIT } from '../../utils/treasureMap';
import { timeAgo } from '../../utils/timeAgo';
import UpdatePreview from './UpdatePreview';

/*
 * The rest of a curated DList's detail page (my-curated-dlists #3, ADR 0003): the curation-method
 * panel, the Update list button, and the list's items in a table with the operator's three views. On
 * my own lists the panel shows the method and the cutoff, each candidate carries its verdict
 * (curated-dlist-update ADR 0004 §7), and Update list opens a preview of what my assistant would do
 * (curated-dlist-update ADR 0005 §8). Publishing the preview sends its intents to the update endpoint, where my
 * assistant signs (curated-dlist-update ADR 0006 §7); nothing here signs or imports.
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

// Update list's publish (curated-dlist-update ADR 0006 §6–§7): the approved intents go to the update endpoint in calls
// of at most 50, copies and refreshes, then deletions, with the upgrade alone in the last call. The server re-reads and
// re-checks each call, and signs as my assistant; the first refused call stops the run.
const UPDATE_ENDPOINT = '/api/dlist-curation/update';
const INTENTS_PER_CALL = 50;

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
 * Update list (curated-dlist-update ADR 0005 §8). On my own lists it opens and closes the preview of what my
 * assistant would do (`onToggle`; `open` while it shows). On another assistant's list it stays disabled, says
 * where Update runs, and mentions curating here when that is offered (curated-dlist-update ADR 0003 §3).
 */
export function UpdateListButton({ curator = 'mine', canCurateHere = false, open = false, onToggle } = {}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      {curator === 'other' ? (
        <>
          <button type="button" className="btn btn-sm" disabled>Update list</button>
          <span style={muted}>Update list runs only on the instance where this list&apos;s assistant lives.{canCurateHere ? ' You can curate it here instead.' : ''}</span>
        </>
      ) : (
        <button type="button" className="btn btn-sm" aria-expanded={open} onClick={onToggle}>Update list</button>
      )}
    </span>
  );
}

/**
 * Source notes for one list read: a failed source, or a cap — the local scan's (ADR 0003 sub-decision 7) or the
 * relay's (curated-dlist-update ADR 0005 §4).
 */
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
  if (list.relayTruncated) notes.push(`Showing the first ${LIST_ITEMS_LIMIT} ${what} from ${communityRelay} — there may be more.`);
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

/** The request bodies for `intents` on my list `list`, in the order they are sent (ADR 0006 §6). */
function intentCalls(list, intents) {
  const items = [
    ...intents.copy.map((x) => ['copy', x]),
    ...intents.refresh.map((x) => ['refresh', x]),
    ...intents.delete.map((x) => ['delete', x]),
  ];
  const calls = [];
  for (let i = 0; i < items.length; i += INTENTS_PER_CALL) {
    const body = { list, copy: [], refresh: [], delete: [], upgrade: null };
    for (const [group, x] of items.slice(i, i + INTENTS_PER_CALL)) body[group].push(x);
    calls.push(body);
  }
  if (intents.upgrade) calls.push({ list, copy: [], refresh: [], delete: [], upgrade: intents.upgrade });
  return calls;
}

/**
 * Sends the calls one after another and stops at the first refused one (ADR 0006 §6) → `{ results, refusal }`. What the
 * earlier calls published is always kept. Nothing is retried (Planning decision 4).
 */
async function publishIntents(list, intents) {
  const results = [];
  for (const body of intentCalls(list, intents)) {
    let res;
    let data;
    try {
      res = await fetch(UPDATE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      data = (await res.json().catch(() => null)) || {};
    } catch (err) {
      return { results, refusal: { kind: 'error', message: err?.message || 'the request failed' } };
    }
    if (res.status === 409) return { results, refusal: { kind: 'stale' } };
    if (res.status === 503) return { results, refusal: { kind: 'couldnt-check', reasons: Array.isArray(data.couldntCheck) ? data.couldntCheck : [] } };
    if (!res.ok || !data.success) return { results, refusal: { kind: 'error', message: data.error || `the server answered ${res.status}` } };
    results.push(...(Array.isArray(data.results) ? data.results : []));
  }
  return { results, refusal: null };
}

/** One strict read of a relay through the external-relay endpoint (→ `{ success, events }`), as the list hooks read. */
async function fetchRelayStrict(filter, url) {
  const res = await fetch(`/api/relay/external?filter=${encodeURIComponent(JSON.stringify(filter))}&relays=${encodeURIComponent(url)}&strict=1`);
  return res.json();
}

/**
 * My assistant's deletion requests for its copies (ADR 0006 §7, AC-9): `{ kinds: [5], authors: [assistant], "#k":
 * ["39999"] }`, from this instance's strfry and the list's relay, strictly. A failed or capped source is named in `gaps`,
 * never read as "none". Keyed on the assistant, the relay and the section's epoch. → `{ events, gaps }`, or null while the
 * read is out.
 */
function useDeletionRequests(assistantPubkey, relay, epoch, enabled) {
  const key = enabled && assistantPubkey ? `${assistantPubkey}@${relay || ''}#${epoch}` : '';
  const [answer, setAnswer] = useState({ key: null, value: null });
  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    const filter = { kinds: [5], authors: [assistantPubkey], '#k': ['39999'], limit: LIST_ITEMS_LIMIT };
    const capped = 'every deletion request by your assistant (more than one read returns)';
    const local = queryRelayBounded(filter).then(
      (env) => {
        const events = Array.isArray(env?.events) ? env.events : [];
        return { events, gap: env?.truncated || events.length >= LIST_ITEMS_LIMIT ? capped : null };
      },
      () => ({ events: [], gap: 'your assistant’s deletion requests on this instance’s strfry' }),
    );
    const remote = typeof relay === 'string' && /^wss?:\/\//i.test(relay)
      ? fetchRelayStrict(filter, relay).then(
        (data) => {
          if (!data || !data.success) return { events: [], gap: `your assistant’s deletion requests on ${relay}` };
          const events = Array.isArray(data.events) ? data.events : [];
          return { events, gap: events.length >= LIST_ITEMS_LIMIT ? capped : null };
        },
        () => ({ events: [], gap: `your assistant’s deletion requests on ${relay}` }),
      )
      : Promise.resolve({ events: [], gap: null });
    Promise.all([local, remote]).then(([l, r]) => {
      if (!cancelled) setAnswer({ key, value: { events: [...l.events, ...r.events], gaps: [...new Set([l.gap, r.gap].filter(Boolean))] } });
    });
    return () => { cancelled = true; };
  }, [key]); // the assistant, the relay and the epoch are the identity
  return answer.key === key ? answer.value : null;
}

/**
 * The items on the curated list, with the two "also show" views, in a table — judged from its
 * curator's side (`assistantPubkey`: my assistant, or — read-only — the assistant my Map names). On my
 * own lists each candidate carries its verdict against `cutoff`, and the summary goes up through
 * `onVerdictSummary` (curated-dlist-update ADR 0004 §7); and Update list opens a preview of what my assistant
 * would do, planned from the same reads and my header's state, `headerState` (curated-dlist-update ADR 0005 §8).
 * Publishing it re-reads everything, my header included through `onHeaderRefresh`, and then sends the approved
 * intents (curated-dlist-update ADR 0006 §7).
 */
export function ItemsSection({ myCoord, sharedCoord, sharedUnavailable, assistantPubkey, communityRelay, curator = 'mine', listRelay = communityRelay, canCurateHere = false, cutoff, onVerdictSummary, headerState, onHeaderRefresh }) {
  const [showOthers, setShowOthers] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false); // Update list's preview (curated-dlist-update ADR 0005 §8)
  const [openReason, setOpenReason] = useState(null); // the candidate row whose reason is open
  // Publish (curated-dlist-update ADR 0006 §7): the run, and the epoch it bumps. Each bump re-reads every read below.
  const [run, setRun] = useState(null);
  const [epoch, setEpoch] = useState(0);
  // The curated list is read on mount at listRelay — for another assistant's list, its Map entry's relay
  // (curated-dlist-update ADR 0003 §4); the shared list only while "candidates" is on (ADR 0003
  // sub-decision 4) or Update's preview is open (ADR 0005 §8), at the community relay.
  const mine = useListItems([myCoord], listRelay, epoch);
  const shared = useListItems((showCandidates || previewOpen) && sharedCoord ? [sharedCoord] : [], communityRelay, epoch);
  const labels = curator === 'other' ? FROM_LABEL_OTHER : FROM_LABEL;
  const reasons = curator === 'other' ? UNAVAILABLE_REASON_OTHER : UNAVAILABLE_REASON;
  const myList = mine.lists[myCoord];
  const sharedList = showCandidates && sharedCoord ? shared.lists[sharedCoord] : undefined;
  const rows = curatedItemRows({
    mine: myList ? myList.items : [],
    shared: sharedList && !(sharedList.local === 'failed' && sharedList.relay === 'failed') ? sharedList.items : null,
    assistantPubkey, showOthers, showCandidates,
  });

  // The verdicts — my own lists only (curated-dlist-update ADR 0004 §7). While candidates are shown or Update's
  // preview is open (ADR 0005 §8), and the shared list was read, the votes on every shared item (both sources) and
  // the trust weights of their authors and voters are read once, and judged against the cutoff twice: the panel's
  // verdicts over the candidates, and the preview's over every shared item. A read-only list reads neither.
  const wanted = curator === 'mine' && showCandidates && !!sharedCoord;
  const previewing = curator === 'mine' && previewOpen;
  const planning = previewing && !!sharedCoord;
  const sharedRead = wanted || planning ? shared.lists[sharedCoord] : undefined;
  const sharedFailed = !!sharedRead && sharedRead.local === 'failed' && sharedRead.relay === 'failed';
  const reading = (wanted || planning) && !!sharedRead && !sharedFailed;
  // The panel's verdicts also wait for my list: which shared items are candidates depends on my copies (ADR 0005
  // Amendment 2).
  const judging = wanted && reading && !!myList;
  const sharedEvents = reading ? sharedRead.items.map((x) => x.event) : [];
  const candidateRoutes = new Set(rows.filter((r) => r.from === 'candidate').map((r) => r.routeId));
  const candidates = judging ? sharedEvents.filter((e) => candidateRoutes.has(itemRouteId(e))) : [];
  const votes = useItemVotes(sharedEvents.map((e) => e.id), communityRelay, epoch);
  // The weights are read once the votes are in. useTrustWeights re-reads whenever its array changes identity,
  // so the array is keyed on its content (ADR 0004 §3).
  const pubkeyKey = reading && votes
    ? [...new Set([...sharedEvents, ...votes.events].map((e) => e.pubkey).filter((pk) => typeof pk === 'string' && pk !== ''))].sort().join(',')
    : '';
  const pubkeys = useMemo(() => (pubkeyKey ? pubkeyKey.split(',') : []), [pubkeyKey]);
  const trust = useTrustWeights(pubkeys, epoch);
  const weights = { state: weightsState({ ...trust, pubkeys }), values: trust.weights, error: trust.error };
  // A partial read of the shared list is named in both summaries (ADR 0005 §6). The panel's also names my list's
  // gaps, after the shared list's (Amendment 2); the planner names them itself (§7).
  const incomplete = reading ? listReadGaps(sharedRead, 'the shared list') : [];
  const panelIncomplete = [...incomplete, ...listReadGaps(myList, 'your list')];
  const verdicts = candidateVerdicts({ candidates, votes: judging ? votes : null, weights, cutoff, incomplete: panelIncomplete });
  const planVerdicts = candidateVerdicts({ candidates: sharedEvents, votes: reading ? votes : null, weights, cutoff, incomplete });
  // The panel's summary (ADR 0004 §7): hidden while candidates are off, and "couldn't check" when the shared list
  // couldn't be read. Reported up when its content changes, not on every render.
  const summary = !wanted ? { state: 'hidden' }
    : sharedFailed ? { state: 'incomplete', qualifying: 0, total: 0, reason: 'the shared list' }
      : verdicts.summary;
  const summaryKey = JSON.stringify(summary);
  useEffect(() => { if (onVerdictSummary) onVerdictSummary(summary); }, [summaryKey]); // its content is its identity
  // Update's preview (ADR 0005 §7–§8): the plan, from the same reads and verdicts, and my header's state. Only reads
  // that are in for the current epoch count, so Publish's re-check never settles on an earlier answer (ADR 0006 §7).
  const plan = previewing
    ? updatePlan({ assistantPubkey, header: headerState, mine: mine.loading ? undefined : myList, shared: shared.loading ? undefined : sharedRead, verdicts: planVerdicts })
    : null;

  // Publish (ADR 0006 §7). Pressing it re-reads everything, my header included. Once the fresh plan settles, a blocked
  // plan shows its reasons, different intents show the new preview, and the same intents are sent. Afterwards
  // everything is read again, so the next preview proposes only what is still missing.
  const reReadAll = () => { setEpoch((n) => n + 1); if (onHeaderRefresh) onHeaderRefresh(); };
  const startPublish = () => { setRun({ phase: 'checking', approved: planIntents(plan) }); reReadAll(); };
  const planKey = plan ? `${plan.state}|${JSON.stringify(planIntents(plan))}` : '';
  useEffect(() => {
    if (!run || run.phase !== 'checking' || !plan || plan.state === 'checking') return;
    if (plan.state !== 'ready') { setRun({ phase: 'blocked' }); return; }
    if (JSON.stringify(planIntents(plan)) !== JSON.stringify(run.approved)) { setRun({ phase: 'changed' }); return; }
    setRun({ phase: 'sending' });
    publishIntents(myCoord, run.approved).then((outcome) => { setRun({ phase: 'done', ...outcome }); reReadAll(); });
  }, [run, planKey]); // the plan's state and intents are its identity

  // My assistant's deletion requests (ADR 0006 §7, AC-9). A copy on my list that one of them names — by its id, or by
  // its address up to the request's created_at (NIP-09) — is flagged with the place that still shows it, and a deletion
  // proposed again notes "(asked before)".
  const deletions = useDeletionRequests(assistantPubkey, listRelay, epoch, curator === 'mine');
  const stillShown = new Map();
  if (deletions && myList) {
    const me = typeof assistantPubkey === 'string' ? assistantPubkey.toLowerCase() : '';
    for (const x of myList.items) {
      const e = x && x.event;
      if (!e || typeof e.pubkey !== 'string' || e.pubkey.toLowerCase() !== me) continue;
      const route = itemRouteId(e);
      const named = deletions.events.some((r) => r && r.kind === 5 && r.pubkey === e.pubkey && Array.isArray(r.tags)
        && r.tags.some((t) => Array.isArray(t) && ((t[0] === 'e' && t[1] === e.id)
          || (t[0] === 'a' && t[1] === route && (r.created_at || 0) >= (e.created_at || 0)))));
      if (named) stillShown.set(route, x.local ? 'this instance' : listRelay);
    }
  }

  let body;
  if (!myList) {
    body = <div style={{ ...muted, marginTop: '0.6rem' }}>⏳ Loading items…</div>;
  } else if (myList.local === 'failed' && myList.relay === 'failed') {
    body = <div style={{ ...warn, marginTop: '0.6rem' }}>⚠️ Couldn&apos;t check — looked in this instance&apos;s strfry and on {listRelay}.</div>;
  } else {
    body = (
      <>
        <SourceNotes list={myList} communityRelay={listRelay} what="items" />
        {deletions && deletions.gaps.length > 0 && (
          <div style={{ ...warn, marginTop: '0.35rem' }}>⚠️ Couldn’t check {deletions.gaps.join('; ')}.</div>
        )}
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
                      {r.from === 'assistant' && stillShown.has(r.routeId) && (
                        <span style={{ ...warn, marginLeft: '0.4rem' }}>⚠️ deletion requested — still shown by {stillShown.get(r.routeId)}</span>
                      )}
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
        <UpdateListButton curator={curator} canCurateHere={canCurateHere} open={previewOpen}
          onToggle={() => { setPreviewOpen((v) => !v); setRun((x) => (x && x.phase === 'sending' ? x : null)); }} />
      </div>
      {previewing && <UpdatePreview plan={plan} cutoff={cutoff} run={run} onPublish={startPublish} askedBefore={[...stillShown.keys()]} />}
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
