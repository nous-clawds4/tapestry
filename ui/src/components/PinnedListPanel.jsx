import React, { useState, useMemo, useEffect } from 'react';
import { nip19 } from 'nostr-tools';
import TLShareButton from './TLShareButton';
import TLExportButton from './TLExportButton';
import CurationMethodDialog from './CurationMethodDialog';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import useTLDetail from '../hooks/useTLDetail';
import { pinTag, unpinTag, computeTLDTag } from '../utils/publishTagPin';

/**
 * Story 20 / ADR 0018 — the "Pinned" tab body on the tag-detail page.
 *
 * Extracted from the now-retired PinDetail page. Renders the viewer's
 * kind-30392 Trusted List for this tag: metadata (Observer / Cutoff /
 * Min rank / Last refreshed / d-tag / naddr — but NOT a "Tag" row,
 * which is redundant on the tag's own page), the owner actions
 * (Refresh now, Edit curation, Share, NIP-51 Export), and the member
 * list.
 *
 * Unlike PinDetail, the pin context (pinEventId + curationMethod)
 * arrives via the `viewerPin` prop (from /api/profile-tags/by-id), so
 * Refresh / Edit / Unpin need no separate /api/profile-tags/pins
 * lookup. That lookup survives only to obtain the NIP-51 export status
 * (currentTitle + status) for the Export section.
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

export default function PinnedListPanel({ tag, viewerPin, onChanged }) {
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

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [editing, setEditing] = useState(false);

  // Story 19 / ADR 0017 — fetch the viewer's matching pin row to surface
  // the NIP-51 export status (currentTitle + state) in the Export
  // section. The /by-id viewerPin does not carry it.
  const [pinRow, setPinRow] = useState(null);
  useEffect(() => {
    if (!user || !pinEventId) { setPinRow(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/profile-tags/pins?viewerPubkey=${encodeURIComponent(user.pubkey)}`);
        const j = await r.json();
        if (cancelled) return;
        const row = (j?.pins || []).find((p) => p.pinEventId === pinEventId);
        setPinRow(row || null);
      } catch { if (!cancelled) setPinRow(null); }
    })();
    return () => { cancelled = true; };
  }, [user, pinEventId]);

  const naddr = useMemo(() => {
    if (!dTag || !taPubkey) return null;
    try {
      return nip19.naddrEncode({
        kind: 30392, pubkey: taPubkey, identifier: dTag, relays: [],
      });
    } catch { return null; }
  }, [dTag, taPubkey]);

  const canManage = !!user && !!pinEventId;

  const handleRefresh = async () => {
    if (!canManage) return;
    setRefreshing(true); setRefreshError(null);
    try {
      const rr = await fetch('/api/trusted-list/refresh-pinned-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinEventId }),
      });
      const data = await rr.json().catch(() => null);
      if (!rr.ok || !data?.success) throw new Error(data?.error || `status ${rr.status}`);
      await refetch();
      onChanged?.();
    } catch (e) {
      setRefreshError(e.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleEditSubmit = async (customCuration) => {
    const signed = await pinTag({ tag, curationMethod: customCuration });
    await refetch();
    onChanged?.();
    // AC-5 (Story 12) — fire-and-forget refresh of this pin's TL.
    fetch('/api/trusted-list/refresh-pinned-tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinEventId: signed.id }),
    }).catch(() => { /* best-effort */ });
  };

  // Story 18 / ADR 0016 — Unpin from inside the edit dialog. Unpinning
  // makes the header refetch drop viewerPin, which removes the Pinned
  // tab (Tag.jsx falls back to the default tab).
  const handleEditUnpin = async () => {
    if (!pinEventId) return;
    await unpinTag({ pinEventId });
    onChanged?.();
  };

  if (loading) {
    return <p className="bs-pindetail-loading">Loading Trusted List…</p>;
  }
  if (error) {
    return (
      <p className="bs-pindetail-error" role="alert">⚠️ {error}</p>
    );
  }
  if (!tl) {
    return (
      <p className="bs-pindetail-empty">
        No Trusted List has been published for this pin yet — it will
        appear after the next refresh.
      </p>
    );
  }

  return (
    <div className="bs-pindetail-panel">
      <header className="bs-pindetail-header">
        <h2 className="bs-pindetail-title">{tl.title || tl.dTag}</h2>
        <div className="bs-pindetail-actions">
          {canManage && (
            <button
              type="button"
              className="bs-pindetail-refresh"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing…' : '🔄 Refresh now'}
            </button>
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
          <TLShareButton dTag={tl.dTag} variant="full" />
        </div>
        {refreshError && (
          <p className="bs-pindetail-error" role="alert">⚠️ {refreshError}</p>
        )}
        {tl.retracted && (
          <p className="bs-pindetail-retracted">
            This Trusted List has been retracted (the underlying tag was unpinned).
          </p>
        )}
      </header>

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
        {naddr && (
          <>
            <dt>Share ID (naddr)</dt>
            <dd className="bs-pindetail-id"><code>{naddr}</code></dd>
          </>
        )}
      </dl>

      {pinRow && (
        <section className="bs-pindetail-export">
          <h3 className="bs-pindetail-export-heading">
            Export for use in other clients
          </h3>
          <p className="bs-pindetail-export-help">
            Publish this list as a NIP-51 follow set under your key so
            others can subscribe to it in Damus, Amethyst, Iris, Coracle,
            and any other NIP-51-aware nostr client. The list will be sent
            to your NIP-65 write relays — re-export whenever you want to
            update the published membership.
          </p>
          <div className="bs-pindetail-export-row">
            <TLExportButton
              pinEventId={pinRow.pinEventId}
              dTag={dTag}
              currentTitle={pinRow.nip51ExportStatus?.currentTitle}
              defaultTitle={pinRow.tag?.name || tl.title}
              variant="full"
              onExported={() => { refetch(); onChanged?.(); }}
            />
            {pinRow.nip51ExportStatus && (
              <span className={`bs-pindetail-export-status is-${pinRow.nip51ExportStatus.status}`}>
                {pinRow.nip51ExportStatus.status === 'never-exported'
                  && 'Not yet exported for other clients.'}
                {pinRow.nip51ExportStatus.status === 'ok-fresh'
                  && `Last exported ${timeAgoShort(pinRow.nip51ExportStatus.exportedAt)} · in sync with the current list.`}
                {pinRow.nip51ExportStatus.status === 'stale'
                  && `Last exported ${timeAgoShort(pinRow.nip51ExportStatus.exportedAt)} · ${(pinRow.nip51ExportStatus.diffVsTL?.added || 0) + (pinRow.nip51ExportStatus.diffVsTL?.removed || 0)} changes since last export.`}
              </span>
            )}
          </div>
        </section>
      )}

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
