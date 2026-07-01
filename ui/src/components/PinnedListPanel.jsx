import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { nip19 } from 'nostr-tools';
import ExportModal from './ExportModal';
import CurationMethodDialog from './CurationMethodDialog';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import useTLDetail from '../hooks/useTLDetail';
import usePinnedNotes from '../hooks/usePinnedNotes';
import NoteCard from './NoteCard';
import {
  pinTag, unpinTag, computeTLDTag, publishNoteBookmarkSetForPin,
  syncPinnedExportsForTag, WELL_KNOWN_FALLBACK_RELAYS,
} from '../utils/publishTagPin';
import { copyText } from '../utils/clipboard';

/**
 * Story 20 / ADR 0018 — the "Pinned" tab body on the tag-detail page.
 * Story 21 / ADR 0019 — collapses the former Refresh / Share / Export
 * affordances into ONE "Export" action (see ExportModal), adds an naddr
 * copy row per published kind, and shows a two-line sync status.
 *
 * The pin context (pinEventId + curationMethod) arrives via the
 * `viewerPin` prop (from /api/profile-tags/by-id). A separate
 * /api/profile-tags/pins lookup supplies the NIP-51 export status
 * (currentTitle + state) and the kind-30392 freshness used by the
 * status lines.
 *
 * `exportSync` is a transient signal lifted from Tag.jsx: when an
 * Apply/Dispute on this tag triggers an auto-re-export, the parent
 * drives 'changed' → 'exporting' → 'idle'|'declined' so the status
 * lines reflect the in-flight state (AC-19).
 */
function shortNpub(pk) {
  if (!pk) return '—';
  try {
    const npub = nip19.npubEncode(pk);
    return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
  } catch {
    return `${pk.slice(0, 12)}…${pk.slice(-8)}`;
  }
}

function timeAgoShort(unixSeconds) {
  if (!unixSeconds) return null;
  const now = Date.now() / 1000;
  const diff = now - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

/** A naddr metadata row: a truncated id (first-5…last-4) that expands on
 *  click (showing "show all" on hover), a working copy control, and a help
 *  line. The copied value is always the full naddr (addressable; resolves
 *  the latest replaceable event in other clients) — never a raw id (AC-11). */
function NaddrRow({ label, naddr, help }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const short = naddr.length > 12 ? `${naddr.slice(0, 5)}…${naddr.slice(-4)}` : naddr;
  const copy = async (e) => {
    e.stopPropagation();
    try {
      await copyText(naddr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Every copy path failed — expand the full id so the user can
      // highlight-and-copy it manually.
      setExpanded(true);
    }
  };
  return (
    <>
      <dt>{label}</dt>
      <dd className="bs-pindetail-naddr">
        <div className="bs-pindetail-naddr-line">
          {expanded ? (
            // Full id as plain selectable text — so manual highlight-and-copy
            // works even if the Clipboard API is unavailable in the browser.
            <code className="bs-pindetail-naddr-full">{naddr}</code>
          ) : (
            <button
              type="button"
              className="bs-pindetail-naddr-toggle"
              onClick={() => setExpanded(true)}
              title="Click to show the full ID"
            >
              <code>{short}</code>
              <span className="bs-pindetail-naddr-showall">show all</span>
            </button>
          )}
          <button
            type="button"
            className="bs-pindetail-copy"
            onClick={copy}
            aria-label={`Copy ${label}`}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          {expanded && (
            <button
              type="button"
              className="bs-pindetail-naddr-hide"
              onClick={() => setExpanded(false)}
            >
              hide
            </button>
          )}
        </div>
        <p className="bs-pindetail-naddr-help">{help}</p>
      </dd>
    </>
  );
}

export default function PinnedListPanel({ tag, viewerPin, onChanged, exportSync = 'idle' }) {
  const { user } = useAuth();
  const { taPubkey } = useConfig();

  const observer = viewerPin?.curationMethod?.observer || user?.pubkey || null;
  const pinEventId = viewerPin?.pinEventId || null;

  const dTag = useMemo(() => {
    if (!tag || !observer) return null;
    try {
      return computeTLDTag({
        observer,
        tagAuthorPubkey: tag.authorPubkey,
        tagSlug: tag.slug,
      });
    } catch { return null; }
  }, [tag, observer]);

  const { tl, members, loading, error, refetch } = useTLDetail(dTag);

  const [editing, setEditing] = useState(false);
  // Local transient sync state for panel-initiated re-exports (curation
  // reconfig). Merged with the lifted `exportSync` prop below.
  const [localSync, setLocalSync] = useState('idle');
  const effectiveSync = exportSync !== 'idle' ? exportSync : localSync;

  // Story 19/21 — the viewer's matching pin row carries nip51ExportStatus
  // (currentTitle + state) and tlStatus, which the /by-id viewerPin lacks.
  const [pinRow, setPinRow] = useState(null);
  const loadPinRow = useCallback(async () => {
    if (!user || !pinEventId) { setPinRow(null); return; }
    try {
      const r = await fetch(`/api/profile-tags/pins?viewerPubkey=${encodeURIComponent(user.pubkey)}`);
      const j = await r.json();
      const row = (j?.pins || []).find((p) => p.pinEventId === pinEventId);
      setPinRow(row || null);
    } catch { setPinRow(null); }
  }, [user, pinEventId]);
  useEffect(() => { let on = true; (async () => { if (on) await loadPinRow(); })(); return () => { on = false; }; }, [loadPinRow]);

  // Story 12 item #3 — the viewer's pinned NOTE bookmark set (kind-30003) + its
  // drift vs the live curated set. Curated with the same method the pin used.
  const noteMethod = pinRow?.curationMethod?.noteMethod
    || viewerPin?.curationMethod?.noteMethod
    || 'notes:net-endorsed';
  const {
    pinned: pinnedNotes, notes: pinnedNoteItems, drift: noteDrift,
    loading: pinnedNotesLoading, refetch: refetchPinnedNotes,
  } = usePinnedNotes(tag, user?.pubkey, noteMethod);
  const [repinningNotes, setRepinningNotes] = useState(false);
  // Issue #2 — Profiles|Notes sub-switch inside the Pinned tab (mirrors the
  // tag-detail default tab), so a big profile list and the note list don't stack.
  const [pinnedView, setPinnedView] = useState('profiles');
  // Recompute the note drift each time the Notes sub-tab is opened, so a note
  // tagged since mount is reflected without a full page refresh.
  useEffect(() => { if (pinnedView === 'notes') refetchPinnedNotes(); }, [pinnedView, refetchPinnedNotes]);
  const handleRepinNotes = useCallback(async () => {
    if (!tag || !user || repinningNotes) return;
    setRepinningNotes(true);
    try {
      await publishNoteBookmarkSetForPin({
        tag: { authorPubkey: tag.authorPubkey, slug: tag.slug, name: tag.name },
        viewerPubkey: user.pubkey,
        noteMethod,
      });
      await refetchPinnedNotes();
    } catch { /* best-effort; drift line stays until it succeeds */ }
    finally { setRepinningNotes(false); }
  }, [tag, user, repinningNotes, noteMethod, refetchPinnedNotes]);
  const noteDriftStale = !!noteDrift && (noteDrift.added > 0 || noteDrift.removed > 0);

  // AC-19 — when a tag-page-driven re-export settles ('exporting' →
  // 'idle'/'declined'), refetch so the status line + naddr rows revert to
  // their true (in-sync / stale) state.
  const prevSyncRef = React.useRef(exportSync);
  useEffect(() => {
    const prev = prevSyncRef.current;
    prevSyncRef.current = exportSync;
    if ((prev === 'exporting' || prev === 'changed') &&
        (exportSync === 'idle' || exportSync === 'declined')) {
      refetch();
      loadPinRow();
    }
  }, [exportSync, refetch, loadPinRow]);

  // kind-30392 naddr (TA-signed). Always available once a TL exists.
  const naddr30392 = useMemo(() => {
    if (!dTag || !taPubkey) return null;
    try {
      return nip19.naddrEncode({
        kind: 30392, pubkey: taPubkey, identifier: dTag, relays: [],
      });
    } catch { return null; }
  }, [dTag, taPubkey]);

  // kind-30000 naddr (user-signed). Composed against the well-known
  // fallback relays so it resolves in other clients without an async
  // write-relay fetch on render.
  const naddr30000 = useMemo(() => {
    if (!dTag || !user?.pubkey) return null;
    try {
      return nip19.naddrEncode({
        kind: 30000, pubkey: user.pubkey, identifier: dTag,
        relays: WELL_KNOWN_FALLBACK_RELAYS,
      });
    } catch { return null; }
  }, [dTag, user?.pubkey]);

  // kind-39089 naddr (user-signed Follow Pack). Same coordinate as the
  // Follow Set but a distinct kind — Story 22 / ADR 0020.
  const naddr39089 = useMemo(() => {
    if (!dTag || !user?.pubkey) return null;
    try {
      return nip19.naddrEncode({
        kind: 39089, pubkey: user.pubkey, identifier: dTag,
        relays: WELL_KNOWN_FALLBACK_RELAYS,
      });
    } catch { return null; }
  }, [dTag, user?.pubkey]);

  const canManage = !!user && !!pinEventId;
  const nip51 = pinRow?.nip51ExportStatus;
  const hasFollowSet = !!nip51 && nip51.status !== 'never-exported';
  // Follow Pack (kind-39089) export status — shown only once exported.
  const followPack = pinRow?.followPackStatus;
  const hasFollowPack = !!followPack && followPack.status !== 'never-exported';
  const followPackBehind = hasFollowPack && followPack.status === 'stale'
    ? ((followPack.diffVsTL?.added || 0) + (followPack.diffVsTL?.removed || 0))
    : 0;

  const handleExported = useCallback(async () => {
    setLocalSync('idle');
    await refetch();
    await loadPinRow();
    onChanged?.();
  }, [refetch, loadPinRow, onChanged]);

  const handleEditSubmit = async (customCuration) => {
    const signed = await pinTag({ tag, curationMethod: customCuration });
    await refetch();
    onChanged?.();
    // AC-13 — a curation reconfig recomputes the kind-30392 and re-exports
    // the kind-30000 footprint, just like an Apply/Dispute does.
    if (user) {
      await syncPinnedExportsForTag({
        tag, viewerPubkey: user.pubkey, onProgress: setLocalSync,
      });
      await loadPinRow();
    } else {
      // No signer somehow — fall back to a bare TL refresh.
      fetch('/api/trusted-list/refresh-pinned-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinEventId: signed.id }),
      }).catch(() => { /* best-effort */ });
    }
  };

  const handleEditUnpin = async () => {
    if (!pinEventId) return;
    await unpinTag({ pinEventId });
    onChanged?.();
  };

  if (loading) {
    return <p className="bs-pindetail-loading">Loading Trusted List…</p>;
  }
  if (error) {
    return <p className="bs-pindetail-error" role="alert">⚠️ {error}</p>;
  }
  if (!tl) {
    return (
      <p className="bs-pindetail-empty">
        No Trusted List has been published for this pin yet — it will
        appear after your first Export.
      </p>
    );
  }

  // ── Two-line sync status (AC-17–20) ──────────────────────────────────
  // Line 1 = the "last exported" timestamp (or "Exporting…" while in flight).
  // Line 2 = the in-sync / out-of-sync status.
  const hasAnyExport = !!tl || hasFollowSet;
  const exportedAt = hasFollowSet ? nip51.exportedAt : tl?.createdAt;

  let timestampLine = null;
  if (effectiveSync === 'exporting') {
    timestampLine = 'Exporting…';
  } else if (hasAnyExport && exportedAt) {
    timestampLine = `Last exported ${timeAgoShort(exportedAt)}`;
  }

  let statusLine = null;
  let statusKind = 'ok';
  if (effectiveSync === 'changed' || effectiveSync === 'exporting') {
    statusLine = 'Pinned list changed, last export out of sync'; statusKind = 'pending';
  } else if (effectiveSync === 'declined') {
    statusLine = 'Last export out of sync — Export to update'; statusKind = 'stale';
  } else if (nip51?.status === 'stale') {
    statusLine = 'Last export out of sync (background list refresh coming soon!)'; statusKind = 'stale';
  } else if (hasAnyExport) {
    statusLine = 'Last export is in sync with current Pin'; statusKind = 'ok';
  }

  return (
    <div className="bs-pindetail-panel">
      <header className="bs-pindetail-header">
        {/* Tag title is already shown page-level (Tag.jsx <h1 bs-tag-name>);
            no duplicate heading here. */}
        <div className="bs-pindetail-actions">
          {canManage && (
            <ExportModal
              pinEventId={pinEventId}
              currentTitle={nip51?.currentTitle}
              defaultTitle={pinRow?.tag?.name || tag?.name || tl.title}
              followPackStatus={followPack}
              variant="full"
              onExported={handleExported}
            />
          )}
          {canManage && (
            <button
              type="button"
              className="bs-pindetail-edit"
              onClick={() => setEditing(true)}
            >
              ⚙️ Edit curation
            </button>
          )}
        </div>

        {(timestampLine || statusLine) && (
          <div className={`bs-pindetail-sync is-${statusKind}`}>
            {timestampLine && <p className="bs-pindetail-sync-when">{timestampLine}</p>}
            {statusLine && <p className="bs-pindetail-sync-status">{statusLine}</p>}
          </div>
        )}

        {tl.retracted && (
          <p className="bs-pindetail-retracted">
            This Trusted List has been retracted (the underlying tag was unpinned).
          </p>
        )}
      </header>

      <details className="bs-pindetail-details">
        <summary>Details and List IDs</summary>
      <dl className="bs-pindetail-meta">
        <dt>Observer</dt>
        <dd>
          <a href={`/user/${tl.observer}`} className="bs-pindetail-observer">
            {tl.observer === user?.pubkey ? 'You' : shortNpub(tl.observer)}
          </a>
        </dd>
        <dt>Cutoff</dt>
        <dd>{tl.cutoff} (members need ≥ {tl.cutoff} WoT-trusted endorsements)</dd>
        {tl.minRank > 0 && (
          <>
            <dt>Min rank</dt>
            <dd>{tl.minRank} (endorsement authors must have <code>wot_rank ≥ {tl.minRank}</code>)</dd>
          </>
        )}
        <dt>Last refreshed</dt>
        <dd>{timeAgoShort(tl.createdAt)}</dd>
        <dt>d-tag</dt>
        <dd className="bs-pindetail-id"><code>{tl.dTag}</code></dd>

        {/* AC-8/9/11 — one naddr copy row per published kind, with a help
            line. The Trusted List row appears once a TL exists; the Follow
            Set row once the kind-30000 has been exported. */}
        {naddr30392 && (
          <NaddrRow
            label="Trusted List (naddr)"
            naddr={naddr30392}
            help="The Trusted List includes ranks; useful in curation pipelines."
          />
        )}
        {hasFollowSet && naddr30000 && (
          <NaddrRow
            label="Follow Set (naddr)"
            naddr={naddr30000}
            help="Look for this list in your favorite client that supports Lists and Follow Sets."
          />
        )}
        {/* Story 22 / ADR 0020 — the Follow Pack row appears once a kind-39089
            has been exported (before that the naddr would point at nothing). */}
        {hasFollowPack && naddr39089 && (
          <NaddrRow
            label="Follow Pack (naddr)"
            naddr={naddr39089}
            help="Others can follow the whole set at once from this address."
          />
        )}
      </dl>
      </details>

      {/* Story 22 / ADR 0020 — honest staleness for a snapshot pack: the
          Follow Pack is not auto-re-published, so surface when it has drifted
          from the current membership and invite a deliberate re-export. */}
      {followPackBehind > 0 && (
        <p className="bs-pindetail-pack-drift" role="status">
          This Follow Pack is {followPackBehind} members behind your current
          list — re-export to update it.
        </p>
      )}

      {/* Issue #2 — Profiles|Notes sub-switch. Only shown once a note bookmark
          set exists; otherwise the panel is profiles-only as before. */}
      {pinnedNotes && (
        <div className="bs-tag-view-switch" role="tablist" aria-label="Pinned content">
          <button
            type="button" role="tab"
            aria-selected={pinnedView === 'profiles'}
            className={`bs-tag-view-switch-btn${pinnedView === 'profiles' ? ' is-active' : ''}`}
            onClick={() => setPinnedView('profiles')}
          >
            Profiles ({members.length})
          </button>
          <button
            type="button" role="tab"
            aria-selected={pinnedView === 'notes'}
            className={`bs-tag-view-switch-btn${pinnedView === 'notes' ? ' is-active' : ''}`}
            onClick={() => setPinnedView('notes')}
          >
            Notes ({pinnedNoteItems.length})
          </button>
        </div>
      )}

      <div hidden={!!pinnedNotes && pinnedView !== 'profiles'}>
      <h3 className="bs-pindetail-members-heading">
        Members ({members.length})
      </h3>
      {members.length === 0 ? (
        <p className="bs-pindetail-empty">
          No profiles qualified under the current cutoff and disputes function.
        </p>
      ) : (
        <ul className="bs-pindetail-members">
          {members.map((m) => (
            <li key={m.pubkey} className="bs-pindetail-member">
              <a href={`/user/${m.pubkey}`} className="bs-pindetail-member-link">
                {m.picture ? (
                  <img
                    src={m.picture}
                    alt=""
                    className="bs-pindetail-member-avatar"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="bs-pindetail-member-avatar bs-pindetail-member-avatar-placeholder">👤</div>
                )}
                <div className="bs-pindetail-member-info">
                  <span className="bs-pindetail-member-name">
                    {m.displayName || shortNpub(m.pubkey)}
                  </span>
                  {m.nip05 && (
                    <span className="bs-pindetail-member-nip05">{m.nip05}</span>
                  )}
                </div>
                <span className="bs-pindetail-member-counts">
                  {m.endorsements != null
                    ? <>+{m.endorsements}{m.disputes ? ` · −${m.disputes}` : ''}</>
                    : null}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      </div>

      {/* Story 12 item #3 — the viewer's pinned NOTE bookmark set (kind-30003),
          in the Notes sub-tab, with a drift indicator vs the live curated set
          (the note analog of the profile export's diffVsTL). */}
      {pinnedNotes && (
        <section className="bs-pinned-notes" hidden={pinnedView !== 'notes'}>
          <div className="bs-pinned-notes-head">
            <h4 className="bs-pinned-notes-title">Pinned notes</h4>
            {/* While (re)computing, show a loading chip rather than the stale
                verdict — otherwise a just-tagged note reads as "up to date" for
                the seconds for-tag takes to resolve. */}
            {pinnedNotesLoading ? (
              <span className="bs-pinned-notes-drift is-loading">Checking for changes…</span>
            ) : noteDrift ? (
              noteDriftStale ? (
                <span className="bs-pinned-notes-drift is-stale">
                  {noteDrift.added ? `${noteDrift.added} new` : ''}
                  {noteDrift.added && noteDrift.removed ? ' · ' : ''}
                  {noteDrift.removed ? `${noteDrift.removed} removed` : ''} since you pinned
                </span>
              ) : (
                <span className="bs-pinned-notes-drift is-fresh">✓ Up to date</span>
              )
            ) : null}
          </div>

          {!pinnedNotesLoading && noteDriftStale && (
            <button
              type="button"
              className="bs-pinned-notes-update"
              onClick={handleRepinNotes}
              disabled={repinningNotes}
            >
              {repinningNotes ? 'Updating…' : 'Update pinned notes'}
            </button>
          )}

          {pinnedNoteItems.length > 0 ? (
            <ul className="bs-pinned-notes-list">
              {pinnedNoteItems.map((n) => (
                <li key={n.id} className="bs-pinned-notes-item"><NoteCard item={n} /></li>
              ))}
            </ul>
          ) : pinnedNotesLoading ? (
            <p className="bs-pinned-notes-empty">Loading pinned notes…</p>
          ) : (
            <p className="bs-pinned-notes-empty">
              The notes in this pin are no longer resolvable{noteDrift?.removed ? ` (${noteDrift.removed} removed)` : ''}.
            </p>
          )}
        </section>
      )}

      {editing && user && (
        <CurationMethodDialog
          tag={tag}
          initialCuration={viewerPin.curationMethod}
          mode="edit"
          viewerPubkey={user.pubkey}
          onSubmit={handleEditSubmit}
          onCancel={() => setEditing(false)}
          onUnpin={handleEditUnpin}
        />
      )}
    </div>
  );
}
