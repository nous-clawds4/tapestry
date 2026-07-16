import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import TagPageRow from '../components/TagPageRow';
import TagPinAffordance from '../components/TagPinAffordance';
import TagViewControls from '../components/TagViewControls';
import TagSomeoneModal from '../components/TagSomeoneModal';
import TagNotesView from '../components/TagNotesView';
import PinnedListPanel from '../components/PinnedListPanel';
import PovStatusNotice from '../components/PovStatusNotice';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { publishProfileTagAssertion } from '../utils/publishProfileTag';
import { pinTag, defaultCurationMethod, publishNip51ExportForPin, publishNoteBookmarkSetForPin, syncPinnedExportsForTag } from '../utils/publishTagPin';
import useTagDetail from '../hooks/useTagDetail';

/**
 * Story 17 / ADR 0014: tag-detail page reshape.
 *
 * Curated default view (View options collapsed): rows are filtered to
 * `applications > disputes` (Net >= 1) and per-row action buttons are
 * hover-only. Expanded view: all WoT-filtered rows shown, buttons always-on,
 * sort chips + client-side filter input visible.
 *
 * "Tag someone" replaces the old inline page-search with a clearly-
 * separated modal (TagSomeoneModal).
 */

function rowMatchesFilter(row, text) {
  if (!text) return true;
  const needle = text.trim().toLowerCase();
  if (!needle) return true;
  const fields = [row.displayName, row.nip05, row.about, row.website];
  for (const f of fields) {
    if (f && String(f).toLowerCase().includes(needle)) return true;
  }
  return false;
}

export default function Tag() {
  const { tagId, slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, login } = useAuth();
  // W11 / tag-federation ADR 0003 — the runtime instance TA for the local z.
  const { taPubkey } = useConfig();
  const {
    tag, viewerPin, rows, viewerAssertions, povSuffix, povResolution, sort, setSort,
    headerLoading, rowsLoading, headerError, rowsError,
    refetchRows, refetchHeader,
  } = useTagDetail(tagId);

  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState(null);
  // Story 21 / ADR 0019 — transient re-export state driven by Apply/Dispute
  // on a pinned tag; read by the Pinned tab's sync-status lines (AC-19).
  const [exportSync, setExportSync] = useState('idle');

  // Story 17 new state.
  const [viewOptionsExpanded, setViewOptionsExpanded] = useState(false);
  const [filterText, setFilterText] = useState('');
  // Story 8 — Profiles | Notes content switch on the tag page. `notesOpened`
  // keeps the Notes view mounted after first open so toggling back doesn't re-fetch.
  const [notesMode, setNotesMode] = useState('profiles');
  const [notesOpened, setNotesOpened] = useState(false);
  const [tagSomeoneOpen, setTagSomeoneOpen] = useState(false);

  // Story 20 / ADR 0018 — the "Pinned" tab. It exists only when the
  // viewer has pinned this tag. Default selection: the Pinned tab when
  // pinned (AC-3), unless a ?tab= param says otherwise. A stale
  // ?tab=pinned on an un-pinned tag falls back to the default tab.
  const isPinned = !!viewerPin;
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState('default');
  useEffect(() => {
    const desired = (tabParam === 'pinned' && isPinned) ? 'pinned'
      : (tabParam === 'default') ? 'default'
        : (isPinned ? 'pinned' : 'default');
    setActiveTab(desired);
  }, [tabParam, isPinned]);

  const switchTab = (t) => {
    setActiveTab(t);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('tab', t);
      return p;
    }, { replace: true });
  };

  // Story 21 / ADR 0019 — after an assertion on a tag the viewer has
  // pinned, keep its exports current: recompute the kind-30392 and
  // re-publish the kind-30000 footprint (debounced, NIP-07 prompt).
  // No-op when the viewer hasn't pinned this tag (AC-16).
  const reexportAfterAssertion = () => {
    if (!isPinned || !user) return;
    syncPinnedExportsForTag({
      tag, viewerPubkey: user.pubkey, onProgress: setExportSync,
    }).catch(() => { /* best-effort; status surfaces the result */ });
  };

  const handleApply = async (targetPubkey) => {
    if (!tag) return;
    await publishProfileTagAssertion({ tag, targetPubkey, polarity: 1, localTaPubkey: taPubkey });
    refetchRows();
    reexportAfterAssertion();
  };
  const handleDispute = async (targetPubkey) => {
    if (!tag) return;
    await publishProfileTagAssertion({ tag, targetPubkey, polarity: -1, localTaPubkey: taPubkey });
    refetchRows();
    reexportAfterAssertion();
  };

  // Story 18 / ADR 0016 — first pin publishes immediately with defaults
  // (WYSIWYG with Curated view). The curation dialog stays in the file
  // but is no longer auto-opened here; it remains reachable from the
  // `/pins` edit affordance.
  const publishWithCuration = async (customCuration) => {
    if (!tag) return;
    setPinning(true); setPinError(null);
    try {
      const signed = await pinTag({ tag, curationMethod: customCuration });
      await refetchHeader();
      // AC-4 — first pin auto-switches to the Pinned tab.
      setActiveTab('pinned');
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('tab', 'pinned');
        return p;
      }, { replace: true });
      // ADR tag-stack-merge-hardening/0001 (B2): AWAIT the refresh so the
      // kind-30392 TL exists before the export reads it. Previously this was
      // fire-and-forget, racing the export against a not-yet-created list →
      // on a first pin the export read 0 members and published an EMPTY
      // kind-30000 under the user's key to public relays.
      await fetch('/api/trusted-list/refresh-pinned-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinEventId: signed.id }),
      }).catch(() => { /* swallow — user can manually refresh from /pins */ });
      // Story 19 / ADR 0017 AC-1: publish a parallel kind-30000 NIP-51
      // follow-set export under the user's key so the pinned list is
      // discoverable in any nostr client. Fire-and-forget; failure
      // (user rejects the second NIP-07 prompt, no kind-10002, etc.)
      // is recoverable via the /pins Export button later — the pin
      // itself already landed. publishNip51ExportForPin itself skips
      // publishing when the prepared list has zero members (B2).
      const curation = customCuration || defaultCurationMethod(user.pubkey);
      const targetTypes = curation.targetTypes || ['profile', 'note'];
      if (targetTypes.includes('profile')) {
        publishNip51ExportForPin({ pinEventId: signed.id })
          .catch(() => { /* swallow — user can re-export from /pins */ });
      }
      // Story 12 / ADR 0015 — also materialize the note bookmark set (kind-30003)
      // when notes are selected. Export-only: computes membership from for-tag at
      // pin time. Skips itself when the tag has no curated notes. Fire-and-forget.
      if (targetTypes.includes('note')) {
        publishNoteBookmarkSetForPin({
          tag: { authorPubkey: tag.authorPubkey, slug: tag.slug, name: tag.name },
          viewerPubkey: user.pubkey,
          noteMethod: curation.noteMethod,
        }).catch(() => { /* swallow — user can re-export from /pins */ });
      }
    } catch (e) {
      setPinError(e.message || 'Pin failed');
      throw e;
    } finally {
      setPinning(false);
    }
  };

  const handlePin = async () => {
    if (!tag || !user) return;
    setPinError(null);
    try {
      await publishWithCuration(defaultCurationMethod(user.pubkey));
    } catch { /* error already surfaced via setPinError */ }
  };

  const handleTagSomeoneClick = async () => {
    if (!user) {
      try { await login(); } catch { return; }
      return;
    }
    setTagSomeoneOpen(true);
  };

  // Canonicalize: bare /tag/:tagId → /tag/:slug/:tagId once the tag loads.
  useEffect(() => {
    if (tag?.slug && !slug) {
      navigate(`/tag/${encodeURIComponent(tag.slug)}/${tagId}`, { replace: true });
    }
  }, [tag, slug, tagId, navigate]);

  // AC-10: text filter → Curated filter (when collapsed) → displayed rows.
  const displayedRows = useMemo(() => {
    const byText = filterText ? rows.filter((r) => rowMatchesFilter(r, filterText)) : rows;
    if (viewOptionsExpanded) return byText;
    return byText.filter((r) => (r.applications || 0) > (r.disputes || 0));
  }, [rows, filterText, viewOptionsExpanded]);

  // For TagSomeoneModal: a pubkey→row lookup so search hits that already
  // appear in the page list render with their +N/-M counts instead of a
  // Verification Score.
  const rowsByPubkey = useMemo(() => {
    const m = new Map();
    for (const r of rows) m.set(r.pubkey, r);
    return m;
  }, [rows]);

  return (
    <div className="bsp-page">
      <TopBar />

      <div className="bsp-content">
        <Link to="/tags" className="bs-tag-breadcrumb">← All tags</Link>

        {headerError === 'not-found' ? (
          <div className="bs-tag-notfound">
            <h1>Tag not found</h1>
            <p>We couldn't find a tag with that id.</p>
            <p><Link to="/" className="bs-tag-link">Back to search</Link></p>
          </div>
        ) : (
          <>
            <header className="bs-tag-header">
              <h1 className="bs-tag-name">
                {tag?.name || (headerLoading ? '…' : 'Tag')}
              </h1>
              {tag?.description && (
                <p className="bs-tag-desc">{tag.description}</p>
              )}
              {user && tag && (
                <div className="bs-tag-pin-row">
                  <TagPinAffordance
                    user={user}
                    viewerPin={viewerPin}
                    onPin={handlePin}
                    loading={pinning}
                    error={pinError}
                    activeTab={activeTab}
                    onSwitchTab={switchTab}
                  />
                </div>
              )}
              {headerError && headerError !== 'not-found' && (
                <p className="bs-tag-error">⚠️ {headerError}</p>
              )}
            </header>

            <PovStatusNotice status={povResolution} variant="banner" />

            {/* Story 20 / ADR 0018 — tab strip only when the viewer has pinned. */}
            {isPinned && (
              <div className="bs-tag-tablist" role="tablist" aria-label="Tag views">
                <button
                  type="button"
                  role="tab"
                  id="bs-tag-tab-default"
                  aria-selected={activeTab === 'default'}
                  aria-controls="bs-tag-panel-default"
                  className={`bs-tag-tab${activeTab === 'default' ? ' is-active' : ''}`}
                  onClick={() => switchTab('default')}
                >
                  {/* Story 15 — this tab holds the Profiles|Notes switch, so it
                      spans all taggings, not just profiles. (Pins: later.) */}
                  Taggings
                </button>
                <button
                  type="button"
                  role="tab"
                  id="bs-tag-tab-pinned"
                  aria-selected={activeTab === 'pinned'}
                  aria-controls="bs-tag-panel-pinned"
                  className={`bs-tag-tab${activeTab === 'pinned' ? ' is-active' : ''}`}
                  onClick={() => switchTab('pinned')}
                >
                  Pinned
                </button>
              </div>
            )}

            {/* Default tab — kept mounted (hidden when inactive) so sort /
                View options / filter / scroll survive tab switches (AC-7). */}
            <section
              className="bs-tag-rows"
              role="tabpanel"
              id="bs-tag-panel-default"
              aria-labelledby="bs-tag-tab-default"
              hidden={activeTab !== 'default'}
            >
              {/* Story 8 — Profiles | Notes content switch. */}
              <div className="bs-tag-view-switch" role="tablist" aria-label="Tag content">
                <button
                  type="button"
                  role="tab"
                  aria-selected={notesMode === 'profiles'}
                  className={`bs-tag-view-switch-btn${notesMode === 'profiles' ? ' is-active' : ''}`}
                  onClick={() => setNotesMode('profiles')}
                >
                  Profiles
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={notesMode === 'notes'}
                  className={`bs-tag-view-switch-btn${notesMode === 'notes' ? ' is-active' : ''}`}
                  onClick={() => { setNotesMode('notes'); setNotesOpened(true); }}
                >
                  Notes
                </button>
              </div>

              {/* Notes view — lazily mounted on first open, then kept mounted
                  (hidden) so re-toggling doesn't re-fetch. */}
              {notesOpened && (
                <div hidden={notesMode !== 'notes'}>
                  <TagNotesView tag={tag} viewerPubkey={user?.pubkey} />
                </div>
              )}

              <div hidden={notesMode !== 'profiles'}>
                  <TagViewControls
                    sort={sort}
                    onSortChange={setSort}
                    expanded={viewOptionsExpanded}
                    onToggleExpand={setViewOptionsExpanded}
                    filterText={filterText}
                    onFilterChange={setFilterText}
                    onTagSomeoneClick={handleTagSomeoneClick}
                    signedIn={!!user}
                  />

                  {rowsLoading && (
                    <p className="bs-tag-loading">Loading profiles…</p>
                  )}
                  {rowsError && (
                    <p className="bs-tag-error">⚠️ {rowsError}</p>
                  )}
                  {!rowsLoading && !rowsError && rows.length === 0 && tag && (
                    <p className="bs-tag-empty">
                      No profiles in your active POV's WoT have been tagged with{' '}
                      <strong>{tag.name}</strong> yet.
                    </p>
                  )}
                  {!rowsLoading && !rowsError && rows.length > 0 && displayedRows.length === 0 && (
                    <p className="bs-tag-empty">
                      {filterText
                        ? `No tagged profiles match "${filterText}".`
                        : 'No profiles meet the Curated threshold yet. Open View options to see all rows.'}
                    </p>
                  )}

                  {!rowsLoading && displayedRows.length > 0 && (
                    <ul className="bs-tag-row-list">
                      {displayedRows.map((row) => (
                        <TagPageRow
                          key={row.pubkey}
                          row={row}
                          viewerState={viewerAssertions[row.pubkey] || null}
                          showActions={!!user}
                          showActionsOnHover={!viewOptionsExpanded}
                          onApply={handleApply}
                          onDispute={handleDispute}
                        />
                      ))}
                    </ul>
                  )}
              </div>
            </section>

            {/* Pinned tab — the viewer's kind-30392 Trusted List view. */}
            {isPinned && (
              <section
                role="tabpanel"
                id="bs-tag-panel-pinned"
                aria-labelledby="bs-tag-tab-pinned"
                hidden={activeTab !== 'pinned'}
              >
                <PinnedListPanel
                  tag={tag}
                  viewerPin={viewerPin}
                  onChanged={refetchHeader}
                  exportSync={exportSync}
                />
              </section>
            )}

            <TagSomeoneModal
              open={tagSomeoneOpen}
              onClose={() => setTagSomeoneOpen(false)}
              tag={tag}
              viewerPubkey={user?.pubkey || null}
              viewerAssertions={viewerAssertions}
              rowsByPubkey={rowsByPubkey}
              povSuffix={povSuffix}
              onApply={handleApply}
              onDispute={handleDispute}
            />
          </>
        )}
      </div>
    </div>
  );
}
