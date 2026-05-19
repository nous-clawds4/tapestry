import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import TopBar from '../components/TopBar';
import TagPageRow from '../components/TagPageRow';
import TagPageSearch from '../components/TagPageSearch';
import TagPinAffordance from '../components/TagPinAffordance';
import SortToggle from '../components/SortToggle';
import { useAuth } from '../context/AuthContext';
import { publishProfileTagAssertion } from '../utils/publishProfileTag';
import { pinTag, unpinTag } from '../utils/publishTagPin';
import useTagDetail from '../hooks/useTagDetail';

// Display fallback when we don't have a kind-0 profile for this pubkey: a
// shortened npub (NIP-19 bech32) is what users recognize and can paste into
// other Nostr clients. Falling back to raw hex pubkey would be opaque.
function shortNpub(pk) {
  if (!pk) return '—';
  try {
    const npub = nip19.npubEncode(pk);
    return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
  } catch {
    return `${pk.slice(0, 12)}…${pk.slice(-8)}`;
  }
}

const SORT_LABELS = [
  { key: 'applied', label: 'Most applied' },
  { key: 'disputed', label: 'Most disputed' },
  { key: 'divisive', label: 'Most divisive' },
];

export default function Tag() {
  const { tagId, slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    tag, author, viewerPin, rows, viewerAssertions, sort, setSort,
    headerLoading, rowsLoading, headerError, rowsError,
    refetchRows, refetchHeader,
  } = useTagDetail(tagId);

  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState(null);

  const handleApply = async (targetPubkey) => {
    if (!tag) return;
    await publishProfileTagAssertion({ tag, targetPubkey, polarity: 1 });
    refetchRows();
  };
  const handleDispute = async (targetPubkey) => {
    if (!tag) return;
    await publishProfileTagAssertion({ tag, targetPubkey, polarity: -1 });
    refetchRows();
  };

  const handlePin = async () => {
    if (!tag) return;
    setPinning(true); setPinError(null);
    try {
      await pinTag({ tag });
      await refetchHeader();
    } catch (e) { setPinError(e.message || 'Pin failed'); }
    finally { setPinning(false); }
  };
  const handleUnpin = async () => {
    if (!viewerPin) return;
    setPinning(true); setPinError(null);
    try {
      await unpinTag({ pinEventId: viewerPin.pinEventId });
      await refetchHeader();
    } catch (e) { setPinError(e.message || 'Unpin failed'); }
    finally { setPinning(false); }
  };

  // Canonicalize: bare /tag/:tagId → /tag/:slug/:tagId once the tag loads.
  useEffect(() => {
    if (tag?.slug && !slug) {
      navigate(`/tag/${encodeURIComponent(tag.slug)}/${tagId}`, { replace: true });
    }
  }, [tag, slug, tagId, navigate]);

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
              {tag && (
                <p className="bs-tag-author">
                  Created by{' '}
                  {author?.picture && (
                    <img
                      className="bs-tag-author-avatar"
                      src={author.picture}
                      alt=""
                    />
                  )}
                  <span className="bs-tag-author-name">
                    {author?.displayName || shortNpub(tag.authorPubkey)}
                  </span>
                </p>
              )}
              {user && tag && (
                <div className="bs-tag-pin-row">
                  <TagPinAffordance
                    user={user}
                    viewerPin={viewerPin}
                    onPin={handlePin}
                    onUnpin={handleUnpin}
                    loading={pinning}
                    error={pinError}
                  />
                  <Link to="/pins" className="bs-tag-pins-link">
                    View all my pinned tags →
                  </Link>
                </div>
              )}
              {headerError && headerError !== 'not-found' && (
                <p className="bs-tag-error">⚠️ {headerError}</p>
              )}
            </header>

            <section className="bs-tag-rows">
              <SortToggle
                options={SORT_LABELS}
                value={sort}
                onChange={setSort}
                ariaLabel="Sort tagged profiles"
                className="bs-tag-sort"
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
              {user && tag && (
                <TagPageSearch
                  user={user}
                  viewerAssertions={viewerAssertions}
                  onApply={handleApply}
                  onDispute={handleDispute}
                />
              )}

              {!rowsLoading && rows.length > 0 && (
                <ul className="bs-tag-row-list">
                  {rows.map((row) => (
                    <TagPageRow
                      key={row.pubkey}
                      row={row}
                      viewerState={viewerAssertions[row.pubkey] || null}
                      showActions={!!user}
                      onApply={handleApply}
                      onDispute={handleDispute}
                    />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
