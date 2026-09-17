import { useState } from 'react';
import { Link } from 'react-router-dom';
import useListItems from '../../hooks/useListItems';
import { curatedItemRows, itemsEmptySentence, LIST_ITEMS_LIMIT } from '../../utils/treasureMap';
import { timeAgo } from '../../utils/timeAgo';

/*
 * The rest of a curated DList's detail page (my-curated-dlists #3, ADR 0003): the curation-method
 * panel and the Update list button — placeholders that act on nothing — and the list's items in a
 * table with the operator's three views. Read-only: nothing here signs, publishes, or imports.
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
const FROM_COLOR = { assistant: '#3fb950', other: '#8b949e', candidate: '#58a6ff' };

// Why the candidates box is off-limits, by `sharedListUnavailable`'s answer (ADR 0003 note 1).
const UNAVAILABLE_REASON = {
  checking: 'checking your assistant’s header…',
  failed: 'your assistant’s header couldn’t be checked',
  missing: 'your assistant’s header was not found',
  'no-pointer': 'your assistant’s header names no shared list',
  deferred: 'your assistant’s header is marked deliberately unaffiliated',
};

/** Placeholder — how the assistant will curate this list. Closed on every load; text only. */
export function CurationMethodPanel() {
  const [open, setOpen] = useState(false);
  return (
    <section style={sectionBox}>
      <button type="button" className="btn btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ fontSize: '0.85rem' }}>
        {open ? '▾' : '▸'} Curation method
      </button>
      {open && (
        <div style={{ marginTop: '0.6rem', fontSize: '0.9rem' }}>
          <p style={{ margin: '0 0 0.4rem' }}>The curation method isn&apos;t built yet.</p>
          <p style={{ ...muted, margin: 0 }}>
            It will set how your assistant decides which candidates to inherit — for example, skipping an
            item that has more downvotes than upvotes.
          </p>
        </div>
      )}
    </section>
  );
}

/** Placeholder — present, disabled, and wired to nothing. */
export function UpdateListButton() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <button type="button" className="btn btn-sm" disabled>Update list</button>
      <span style={muted}>Update list isn&apos;t built yet.</span>
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

/** The items on my local DList, with the two "also show" views, in a table. */
export function ItemsSection({ myCoord, sharedCoord, sharedUnavailable, assistantPubkey, communityRelay }) {
  const [showOthers, setShowOthers] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  // My list is read on mount; the shared list only while "candidates" is on (ADR 0003 sub-decision 4).
  const mine = useListItems([myCoord], communityRelay);
  const shared = useListItems(showCandidates && sharedCoord ? [sharedCoord] : [], communityRelay);
  const myList = mine.lists[myCoord];
  const sharedList = showCandidates && sharedCoord ? shared.lists[sharedCoord] : undefined;
  const rows = curatedItemRows({
    mine: myList ? myList.items : [],
    shared: sharedList && !(sharedList.local === 'failed' && sharedList.relay === 'failed') ? sharedList.items : null,
    assistantPubkey, showOthers, showCandidates,
  });

  let body;
  if (!myList) {
    body = <div style={{ ...muted, marginTop: '0.6rem' }}>⏳ Loading items…</div>;
  } else if (myList.local === 'failed' && myList.relay === 'failed') {
    body = <div style={{ ...warn, marginTop: '0.6rem' }}>⚠️ Couldn&apos;t check — looked in this instance&apos;s strfry and on {communityRelay}.</div>;
  } else {
    body = (
      <>
        <SourceNotes list={myList} communityRelay={communityRelay} what="items" />
        {showCandidates && sharedCoord && !sharedList && <div style={{ ...muted, marginTop: '0.35rem' }}>⏳ Loading candidates…</div>}
        {sharedList && sharedList.local === 'failed' && sharedList.relay === 'failed' && (
          <div style={{ ...warn, marginTop: '0.35rem' }}>⚠️ Couldn&apos;t check the shared list — looked in this instance&apos;s strfry and on {communityRelay}.</div>
        )}
        {sharedList && !(sharedList.local === 'failed' && sharedList.relay === 'failed') && (
          <SourceNotes list={sharedList} communityRelay={communityRelay} what="candidates" />
        )}
        {rows.length === 0 ? (
          <div style={{ ...muted, marginTop: '0.6rem' }}>{itemsEmptySentence({ showOthers, shared: sharedList })}</div>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '0.6rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={cell}>Name</th>
                  <th style={cell}>Author</th>
                  <th style={cell}>From</th>
                  <th style={cell}>Added</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td style={cell}>
                      {r.local
                        ? <Link to={`/tapestry/lists/items/${encodeURIComponent(r.routeId)}`} style={{ color: '#58a6ff' }}>{r.name}</Link>
                        : <>{r.name} <span style={muted}>(on {communityRelay} only)</span></>}
                    </td>
                    <td style={cell}>{r.from === 'assistant' ? 'your assistant' : <code>{short(r.author)}</code>}</td>
                    <td style={{ ...cell, color: FROM_COLOR[r.from], fontWeight: 600 }}>{FROM_LABEL[r.from]}</td>
                    <td style={{ ...cell, opacity: 0.75 }}>{timeAgo(r.createdAt)}</td>
                  </tr>
                ))}
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
        <UpdateListButton />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.6rem', fontSize: '0.85rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <input type="checkbox" checked={showOthers} onChange={(e) => setShowOthers(e.target.checked)} />
          Also show items others added to this list
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: sharedUnavailable ? 0.6 : 1 }}>
          <input type="checkbox" checked={showCandidates} disabled={!!sharedUnavailable} onChange={(e) => setShowCandidates(e.target.checked)} />
          Also show candidates to inherit
          {sharedUnavailable && <span style={muted}>— unavailable: {UNAVAILABLE_REASON[sharedUnavailable] || sharedUnavailable}</span>}
        </label>
      </div>
      {body}
    </section>
  );
}
