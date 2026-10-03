import { useState } from 'react';
import { Link } from 'react-router-dom';
import useProfiles from '../../hooks/useProfiles';
import { publishToRelays } from '../../utils/nostrPublish';
import { CONCEPT_PUBLISH_RELAYS } from '../../utils/dispositionActions';
import { classifyBroadcast, outcomeMessage } from '@tapestry/broadcast-outcome';
import { resyncedHeaderTags, tagDiff, wiredTarget } from '@tapestry/concept-header-copy';
import { checkEditFields } from '@tapestry/concept-header-edit';
import { useFirmware, useSharedHeader } from './sharedHeader';
import { dictionaryEntryPath } from './conceptsDictionary';

/** Re-Syncs with the signed-in person's own Assistant (src/api/adoption/resyncConcept.js). */
export const RESYNC_CONCEPT_API = '/api/dictionaries/concepts/resync';

const firstValue = (ev, name) => (ev?.tags || []).find((t) => Array.isArray(t) && t[0] === name)?.[1];

function TagList({ tags, label }) {
  return (
    <div className="dict-resync-list">
      <span className="dict-field-label">{label} ({tags.length})</span>
      {tags.length ? (
        <ul aria-label={label}>
          {tags.map((t, i) => <li key={`${i}-${JSON.stringify(t)}`}><code>{JSON.stringify(t)}</code></li>)}
        </ul>
      ) : <p className="dict-entry-note text-muted">None.</p>}
    </div>
  );
}

/**
 * Re-Sync, on an entry's page (the owner's request of 2026-10-02): rebuild this concept's header, from
 * scratch, from the shared concept it is wired to, e.g. after the shared concept was edited. The panel
 * warns that the header is completely overwritten, and summarises the change as the tags removed and
 * the tags added (a changed tag, such as a different b, is the old one removed and the new one added),
 * from the same rule the server signs with (src/lib/conceptHeaderCopy.js resyncedHeaderTags); the raw
 * headers are at the bottom of the page. Kept from the local header: its address and its own json,
 * concept-graph and z (the owner's choice). The person's own Assistant signs; the page then broadcasts it
 * and says what the broadcast did.
 *
 * Props: coord (the header's address), header (its version the page shows), assistant (the reader's
 * Assistant's pubkey), note (what the page says above the summary, e.g. after the header changed),
 * onCancel, onDone(message) when saved or already in sync, onStale() when the header changed meanwhile
 * (the page reads it again and keeps the panel open with a note).
 */
export default function ResyncPanel({ coord, header, assistant, note, onCancel, onDone, onStale }) {
  const target = wiredTarget(header);
  const shared = useSharedHeader(target);
  const firmware = useFirmware(coord);
  const sharedAuthor = target ? target.split(':')[1] : null;
  const profiles = useProfiles(sharedAuthor ? [sharedAuthor] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [taken, setTaken] = useState(null);
  const [undelivered, setUndelivered] = useState(null); // { event, message } when the broadcast didn't land

  const proposed = shared.event && target ? resyncedHeaderTags({ local: header, source: shared.event, target }) : null;
  const diff = proposed ? tagDiff(header.tags, proposed) : null;
  const contentCleared = Boolean(header.content);
  const unchanged = Boolean(diff) && diff.removed.length === 0 && diff.added.length === 0 && !contentCleared;
  // The shared header's names and description must pass the checks Edit applies, as the server requires.
  const named = proposed ? (proposed.find((t) => t[0] === 'names') || []) : [];
  const described = proposed ? (proposed.find((t) => t[0] === 'description') || []) : [];
  const invalid = proposed ? checkEditFields({ singular: named[1], plural: named[2], description: described[1] }).error : null;
  const canResync = Boolean(proposed) && !invalid && !unchanged && !busy && !undelivered && shared.done && !shared.unreadable;

  const p = sharedAuthor ? profiles?.[sharedAuthor] : null;
  const sharedBy = p && typeof p === 'object' ? (p.display_name || p.name) : null;
  const sharedName = firstValue(shared.event, 'names') || (target ? target.split(':').slice(2).join(':') : '');

  const finish = async (signed, graph) => {
    let result = null;
    try { result = await publishToRelays(signed, CONCEPT_PUBLISH_RELAYS); } catch { result = null; }
    const outcome = classifyBroadcast(result);
    let message = `Re-synced from ${sharedName}. ${outcomeMessage({ outcome, verb: 'save' })}`;
    if (graph === 'failed') message += ' This instance’s graph wasn’t fully updated, so the control panel may show the old version, or an incomplete one.';
    if (outcome === 'not-delivered') {
      // Left without a retry (Done, Cancel), the entry page can't resend it: it says so, without "try again".
      const leftAs = `Re-synced from ${sharedName}. Saved on this instance, but it didn’t reach the community relay.`;
      setUndelivered({ event: signed, message, graph, leftAs });
      return;
    }
    onDone(message);
  };

  const resync = async () => {
    if (!canResync) return;
    setBusy(true);
    setError(null);
    setTaken(null);
    try {
      const resp = await fetch(RESYNC_CONCEPT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coord, basedOn: header.id, copyFrom: shared.event.id }),
      });
      let data = {};
      try { data = await resp.json(); } catch { data = {}; }
      if (resp.status === 409 && data.code === 'changed') {
        // The page reads the header again and keeps this panel open with its note; this panel starts afresh.
        onStale('This concept changed after this page read it, so nothing was saved. The summary below is what a Re-Sync would change now.');
        return;
      }
      if (resp.status === 409 && data.code === 'source-missing') {
        shared.reload();
        throw new Error('The shared concept’s header changed after this page read it, so the page is reading it again: check the changes, then Re-Sync.');
      }
      if (resp.status === 409 && data.code === 'name-taken' && data.coord) { setTaken({ coord: data.coord, name: firstValue(shared.event, 'names') }); return; }
      if (!resp.ok || !data.success) throw new Error(data.error || `HTTP ${resp.status}`);
      if (data.unchanged) { onDone('Already in sync: nothing changed.'); return; }
      const signed = data.event;
      // Broadcast only what was signed as the Assistant this page names.
      if (!signed || signed.pubkey !== assistant) {
        throw new Error('The server signed with a different key from your Assistant’s. The new version is stored on this instance, but it was not shared onward.');
      }
      await finish(signed, data.graph);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    if (!undelivered) return;
    setBusy(true);
    try { await finish(undelivered.event, undelivered.graph); } finally { setBusy(false); }
  };

  return (
    <section className="dict-card dict-resync" aria-label="Re-Sync">
      <h2 className="dict-resync-title">Re-Sync from the shared concept</h2>
      <p className="dict-notice dict-edit-warning" role="note">
        Re-Sync completely overwrites this concept’s header: your Assistant publishes a new version that is a copy of
        the shared concept’s current header ({sharedName}{sharedBy ? `, shared by ${sharedBy}` : ''}), with its names,
        description and tags. Only this concept’s address and its own json, concept-graph and z tags are kept. The raw
        headers are at the bottom of this page.
      </p>
      {firmware && (
        <p className="dict-notice dict-edit-warning" role="note">
          This is a firmware concept. A firmware reinstall rebuilds its header from the built-in definition, which will
          undo a Re-Sync.
        </p>
      )}
      {note && <p className="dict-notice" role="status">{note}</p>}
      {!shared.done && <p className="text-muted">Reading the shared concept’s header…</p>}
      {shared.unreadable && (
        <p className="dict-notice" role="alert">
          Couldn’t reach the community relay to read the shared concept’s header, so there’s nothing to compare yet.{' '}
          <button type="button" className="dict-link-btn" onClick={shared.reload}>Try again</button>
        </p>
      )}
      {shared.done && !shared.event && !shared.unreadable && (
        <p className="dict-notice">
          The shared concept’s header wasn’t found on this instance’s relay or the community relay, so there’s nothing
          to re-sync from.
        </p>
      )}
      {invalid && (
        <p className="dict-notice" role="alert">
          The names and description a Re-Sync would write can’t be used as they are: {invalid}. The shared concept’s author would have to correct them first.
        </p>
      )}
      {diff && unchanged && <p className="dict-entry-note" role="status">Already in sync: a Re-Sync would change nothing.</p>}
      {diff && !unchanged && (
        <div className="dict-resync-diff">
          <TagList tags={diff.removed} label="Tags removed" />
          <TagList tags={diff.added} label="Tags added" />
          {contentCleared && <p className="dict-entry-note text-muted">Its content is cleared, as a copy’s is.</p>}
        </div>
      )}
      {taken && (
        <p className="dict-notice" role="alert">
          Your Assistant already has a concept named “{taken.name}”, and this instance finds concepts by name, so two
          would be ambiguous. <Link to={dictionaryEntryPath(taken.coord)}>Open that concept</Link>
        </p>
      )}
      {error && <p className="error" role="alert">Couldn’t Re-Sync: {error}</p>}
      {undelivered && (
        <p className="dict-notice" role="status">
          {undelivered.message}{' '}
          <button type="button" className="dict-link-btn" onClick={retry} disabled={busy}>Try again</button>{' '}
          <button type="button" className="dict-link-btn" onClick={() => onDone(undelivered.leftAs)}>Done</button>
        </p>
      )}
      <div className="dict-new-actions">
        <button type="button" className="dict-add-btn" onClick={resync} disabled={!canResync}>{busy ? 'Re-Syncing…' : 'Re-Sync'}</button>
        {/* Once a new version is saved, closing the panel must show it, as Done does. */}
        <button type="button" className="dict-pill-btn dict-pill-btn--quiet" onClick={undelivered ? () => onDone(undelivered.leftAs) : onCancel} disabled={busy}>Cancel</button>
      </div>
    </section>
  );
}
