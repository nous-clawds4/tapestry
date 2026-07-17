import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import TagPageRow from '../components/TagPageRow';
import TagPinAffordance from '../components/TagPinAffordance';
import TagViewControls from '../components/TagViewControls';
import TagSomeoneModal from '../components/TagSomeoneModal';
import TagNotesView from '../components/TagNotesView';
import TagActionsMenu from '../components/TagActionsMenu';
import PinnedListPanel from '../components/PinnedListPanel';
import PinToContextModal from '../components/PinToContextModal';
import PovStatusNotice from '../components/PovStatusNotice';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { publishProfileTagAssertion } from '../utils/publishProfileTag';
import { pinTag, defaultCurationMethod, publishNip51ExportForPin, publishNoteBookmarkSetForPin, syncPinnedExportsForTag } from '../utils/publishTagPin';
import { KNOWN_CONTEXTS } from '@tapestry/event-tagging';
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
    tag, viewerPin, viewerPins, rows, viewerAssertions, povSuffix, povResolution, sort, setSort,
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
  // tag-event-inspector #1 / ADR 0001 D4 — the raw-event panel's visibility. The
  // menu (in the header) and the panel (page-level) are siblings, so this page is
  // their only common ancestor that can hold it. Default hidden (AC-5).
  const [rawOpen, setRawOpen] = useState(false);

  // Story 20 / ADR 0018 — the "Pinned" tab. It exists only when the
  // viewer has pinned this tag. Default selection: the Pinned tab when
  // pinned (AC-3), unless a ?tab= param says otherwise. A stale
  // ?tab=pinned on an un-pinned tag falls back to the default tab.
  const isPinned = !!viewerPin;
  // contextual-pins ADR 0001 — the Pinned tab exists whenever the viewer holds
  // ANY pin of this tag (neutral OR context), not just the neutral one.
  const hasAnyPin = (viewerPins?.length || 0) > 0;
  const pinnedContextSlugs = new Set(
    (viewerPins || []).filter((p) => p && p.context).map((p) => p.context)
  );
  const [contextPickerOpen, setContextPickerOpen] = useState(false);
  // Which pin the Pinned tab is currently showing (by pin event id).
  const [selectedPinId, setSelectedPinId] = useState(null);
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState('default');
  useEffect(() => {
    const desired = (tabParam === 'pinned' && hasAnyPin) ? 'pinned'
      : (tabParam === 'default') ? 'default'
        : (hasAnyPin ? 'pinned' : 'default');
    setActiveTab(desired);
  }, [tabParam, hasAnyPin]);

  // Keep the selected pin valid as viewerPins changes: default to the neutral
  // pin, else the most recent.
  useEffect(() => {
    if (!viewerPins || viewerPins.length === 0) { setSelectedPinId(null); return; }
    setSelectedPinId((cur) => {
      if (cur && viewerPins.some((p) => p.pinEventId === cur)) return cur;
      const neutral = viewerPins.find((p) => !p.context);
      return (neutral || viewerPins[0]).pinEventId;
    });
  }, [viewerPins]);
  const selectedPin = (viewerPins || []).find((p) => p.pinEventId === selectedPinId)
    || viewerPin || null;
  // Stable display order for the pin switcher: Personal (neutral) always first,
  // then contexts alphabetically by name. NOT by recency — re-pinning on a
  // curation edit bumps created_at, which would make the chips jump around.
  const contextNameOf = (p) => (p.context
    ? (KNOWN_CONTEXTS.find((c) => c.slug === p.context)?.name || p.context)
    : '');
  const orderedViewerPins = [...(viewerPins || [])].sort((a, b) => {
    if (!a.context && b.context) return -1;
    if (a.context && !b.context) return 1;
    return contextNameOf(a).localeCompare(contextNameOf(b));
  });

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

  // contextual-pins ADR 0001 — pin this tag WITHIN a community context. Publishes
  // a distinct, first-class pin (its own d-tag + trusted list) that coexists with
  // the neutral pin; stamps the runtime-TA context concept (explicit affiliation).
  const handlePinToContext = async (context) => {
    if (!tag || !user || !context) return;
    setPinning(true); setPinError(null);
    try {
      const signed = await pinTag({
        tag, curationMethod: defaultCurationMethod(user.pubkey), context, taPubkey,
      });
      setContextPickerOpen(false);
      // Materialize this pin's TA-signed kind-30392 so the Pinned tab has a
      // Trusted List to show. The server refresh is context-aware (runOnePin
      // reads the context from the pin's z stamp). AWAITed (per ADR
      // tag-stack-merge-hardening/0001 B2) so the TL exists before the panel
      // reads it.
      if (signed?.id) {
        await fetch('/api/trusted-list/refresh-pinned-tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pinEventId: signed.id }),
        }).catch(() => { /* best-effort; user can refresh from the Pinned tab */ });
      }
      await refetchHeader();
      // Show the new pin: reveal the Pinned tab and select this pin.
      if (signed?.id) setSelectedPinId(signed.id);
      switchTab('pinned');
    } catch (e) {
      setPinError(e.message || 'Pin failed');
    } finally {
      setPinning(false);
    }
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
              <div className="bs-tag-name-row">
                <h1 className="bs-tag-name">
                  {tag?.name || (headerLoading ? '…' : 'Tag')}
                </h1>
                <TagActionsMenu
                  tag={tag}
                  rawOpen={rawOpen}
                  onToggleRaw={() => setRawOpen(o => !o)}
                />
              </div>
              {tag?.description && (
                <p className="bs-tag-desc">{tag.description}</p>
              )}
              {user && tag && (
                <div className="bs-tag-pin-row">
                  <TagPinAffordance
                    user={user}
                    viewerPin={viewerPin}
                    onPin={handlePin}
                    onOpenContextPicker={() => setContextPickerOpen(true)}
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

            {/* tag-event-inspector #1 / ADR 0001 D3 — the raw definition event.
                PAGE-LEVEL on purpose: a sibling of the tab strip, never inside the
                bs-tag-rows tabpanel below, which is hidden={activeTab !== 'default'}
                and would vanish the panel on the Pinned tab while the header menu
                still read "Hide Raw Event" (the state AC-5 forbids). Below the POV
                banner so a tall blob can't push a page-level notice out of view. */}
            {rawOpen && tag?.rawEvent && (
              <section className="bs-tag-raw" aria-label="Raw tag definition event">
                <p className="bs-tag-raw-title">Raw event — kind 39999 tag definition</p>
                <pre className="bs-tag-raw-pre">{JSON.stringify(tag.rawEvent, null, 2)}</pre>
              </section>
            )}

            {/* Story 20 / ADR 0018 — tab strip only when the viewer has pinned. */}
            {hasAnyPin && (
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
                          // tag-event-inspector #2 / ADR 0002 D5 — the tag detail
                          // page is the one surface that offers raw-event
                          // inspection. TagSomeoneModal renders the same component
                          // and deliberately does NOT pass this.
                          showRawEvent
                          onApply={handleApply}
                          onDispute={handleDispute}
                        />
                      ))}
                    </ul>
                  )}
              </div>
            </section>

            {/* Pinned tab — the viewer's kind-30392 Trusted List view. */}
            {hasAnyPin && (
              <section
                role="tabpanel"
                id="bs-tag-panel-pinned"
                aria-labelledby="bs-tag-tab-pinned"
                hidden={activeTab !== 'pinned'}
              >
                {/* contextual-pins ADR 0001 — pin switcher: navigate between
                    the viewer's coexisting pins of this tag (Personal + one
                    per community context). Hidden when there's only one pin. */}
                {orderedViewerPins.length > 1 && (
                  <div className="bs-pin-switcher" role="tablist" aria-label="Your pins of this tag">
                    {orderedViewerPins.map((p) => {
                      const label = p.context ? contextNameOf(p) : 'Personal';
                      const active = p.pinEventId === selectedPinId;
                      return (
                        <button
                          key={p.pinEventId}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          className={`bs-pin-switcher-chip${active ? ' is-active' : ''}`}
                          onClick={() => setSelectedPinId(p.pinEventId)}
                        >
                          📌 {label}
                        </button>
                      );
                    })}
                  </div>
                )}
                <PinnedListPanel
                  key={selectedPin?.pinEventId || 'none'}
                  tag={tag}
                  pin={selectedPin}
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

            <PinToContextModal
              open={contextPickerOpen}
              onClose={() => setContextPickerOpen(false)}
              contexts={KNOWN_CONTEXTS}
              pinnedContextSlugs={pinnedContextSlugs}
              onPick={handlePinToContext}
              busy={pinning}
            />
          </>
        )}
      </div>
    </div>
  );
}
