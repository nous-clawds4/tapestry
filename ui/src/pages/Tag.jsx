import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import TopBar from '../components/TopBar';
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
  const {
    tag, author, rows, sort, setSort,
    headerLoading, rowsLoading, headerError, rowsError,
  } = useTagDetail(tagId);

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
              {headerError && headerError !== 'not-found' && (
                <p className="bs-tag-error">⚠️ {headerError}</p>
              )}
            </header>

            <section className="bs-tag-rows">
              <div
                className="bs-tag-sort"
                role="group"
                aria-label="Sort tagged profiles"
              >
                {SORT_LABELS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={`bs-tag-sort-btn${sort === key ? ' is-active' : ''}`}
                    aria-pressed={sort === key}
                    onClick={() => setSort(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

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
              {!rowsLoading && rows.length > 0 && (
                <ul className="bs-tag-row-list">
                  {rows.map((row) => (
                    <li key={row.pubkey} className="bs-tag-row">
                      <Link
                        to={`/user/${row.pubkey}`}
                        className="bs-tag-row-link"
                      >
                        {row.picture ? (
                          <img
                            className="bs-tag-row-avatar"
                            src={row.picture}
                            alt=""
                          />
                        ) : (
                          <span
                            className="bs-tag-row-avatar bs-tag-row-avatar-placeholder"
                            aria-hidden="true"
                          />
                        )}
                        <span className="bs-tag-row-name">
                          {row.displayName || shortNpub(row.pubkey)}
                        </span>
                        <span className="bs-tag-row-counts">
                          <span
                            className="bs-tag-count bs-tag-count-apply"
                            title="Applications in your POV's WoT"
                          >
                            +{row.applications}
                          </span>
                          <span
                            className="bs-tag-count bs-tag-count-dispute"
                            title="Disputes in your POV's WoT"
                          >
                            −{row.disputes}
                          </span>
                        </span>
                      </Link>
                    </li>
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
