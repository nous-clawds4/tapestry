import { useState, useMemo, useRef, useEffect } from 'react';

export default function AddTagDialog({
  availableTags,
  appliedTagKeys,
  applicableKeys,
  contextsByKey,
  busy,
  onClose,
  onSelectExisting,
  onCreateNew,
}) {
  // Consume-by-#a (ADR profile-tag-hardening/0001): "already applied" is tested
  // by the tag's STABLE coordinate (tagAddress), so a tag applied through a
  // prior version is correctly recognised as already-applied.
  const isApplied = (t) => appliedTagKeys.has(t.tagAddress || t.eventId);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('search'); // 'search' | 'create'
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showOther, setShowOther] = useState(false); // "Show other results" (cross-context) expander
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);

  const keyOf = (t) => `${t.authorPubkey}:${t.slug}`;
  const scoped = Array.isArray(applicableKeys) && applicableKeys.length > 0;
  const inScope = (t) => !scoped || applicableKeys.includes(keyOf(t));
  // Usage-context hint ("people" / "content" / "people & content") from list membership.
  const ctxLabel = (t) => {
    const c = contextsByKey && contextsByKey[keyOf(t)];
    if (!c) return null;
    const parts = [];
    if (c.people) parts.push('people');
    if (c.content) parts.push('content');
    return parts.length ? parts.join(' & ') : null;
  };

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const matchesQuery = (t, q) =>
    t.name.toLowerCase().includes(q) ||
    t.slug.toLowerCase().includes(q) ||
    (t.description || '').toLowerCase().includes(q);

  // The IN-CONTEXT results: browse = the scoped list (ordered); search = scoped list filtered by q.
  // Search is deliberately SCOPED to the context (David 2026-07-06) — cross-context matches are
  // surfaced separately via "Show other results" below, never mixed in.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const candidates = availableTags.filter((t) => !isApplied(t) && inScope(t));
    if (!q) {
      if (scoped) {
        const order = new Map(applicableKeys.map((k, i) => [k, i]));
        return candidates
          .sort((a, b) => (order.get(keyOf(a)) ?? 0) - (order.get(keyOf(b)) ?? 0))
          .slice(0, 20);
      }
      return candidates.slice(0, 20);
    }
    return candidates.filter((t) => matchesQuery(t, q)).slice(0, 20);
  }, [availableTags, appliedTagKeys, applicableKeys, contextsByKey, query]);

  // OTHER results: query-matching tags OUTSIDE the current context (the same-slug anti-fork escape;
  // folds Story 3). Exact same-slug matches first, so typing "LFO" for an event surfaces the
  // existing pubkey "LFO" to adopt instead of minting a duplicate.
  const otherHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !scoped) return [];
    return availableTags
      .filter((t) => !isApplied(t) && !inScope(t) && matchesQuery(t, q))
      .sort((a, b) => (b.slug.toLowerCase() === q ? 1 : 0) - (a.slug.toLowerCase() === q ? 1 : 0))
      .slice(0, 20);
  }, [availableTags, appliedTagKeys, applicableKeys, contextsByKey, query]);

  const exactMatchExists = useMemo(
    () => availableTags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase()),
    [availableTags, query]
  );

  const handleSelect = async (tag) => {
    setError(null);
    try {
      await onSelectExisting(tag);
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const handleCreate = async () => {
    setError(null);
    try {
      const name = (newName || query).trim();
      if (!name) {
        setError('Tag name is required.');
        return;
      }
      await onCreateNew({ name, description: newDesc.trim() });
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <div className="ptd-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="ptd"
        role="dialog"
        aria-label="Add tag"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ptd-head">
          <h3 className="ptd-title">Add a tag</h3>
          <button type="button" className="ptd-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="ptd-tabs">
          <button
            type="button"
            className={view === 'search' ? 'ptd-tab ptd-tab-active' : 'ptd-tab'}
            onClick={() => setView('search')}
          >
            Search existing
          </button>
          <button
            type="button"
            className={view === 'create' ? 'ptd-tab ptd-tab-active' : 'ptd-tab'}
            onClick={() => setView('create')}
          >
            Create new
          </button>
        </div>

        {error && <div className="ptd-error">⚠️ {error}</div>}

        {view === 'search' && (
          <>
            <input
              ref={inputRef}
              type="search"
              className="ptd-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tags by name…"
              aria-label="Search tags"
            />
            <ul className="ptd-results" role="listbox">
              {filtered.length === 0 ? (
                <li className="ptd-empty">
                  {query ? (
                    <>
                      No matching tag.{' '}
                      <button
                        type="button"
                        className="ptd-link"
                        onClick={() => {
                          setNewName(query);
                          setView('create');
                        }}
                      >
                        Create "{query}" instead
                      </button>
                    </>
                  ) : (
                    'No tags available yet.'
                  )}
                </li>
              ) : (
                filtered.map((t) => (
                  <li key={t.eventId} className="ptd-result" role="option">
                    <button
                      type="button"
                      className="ptd-result-btn"
                      disabled={busy}
                      onClick={() => handleSelect(t)}
                    >
                      <strong>{t.name}</strong>
                      {ctxLabel(t) && <span className="ptd-result-ctx"> · {ctxLabel(t)}</span>}
                      {t.description && <span className="ptd-result-desc"> — {t.description}</span>}
                    </button>
                  </li>
                ))
              )}
            </ul>
            {/* "Show other results" — cross-context (esp. same-slug) matches the scoped search
                hides. The anti-fork escape (folds Story 3): adopt an existing tag from the other
                context instead of minting a duplicate. */}
            {query && otherHits.length > 0 && (
              showOther ? (
                <>
                  <div className="ptd-other-head">Also used elsewhere</div>
                  <ul className="ptd-results ptd-results-other" role="listbox">
                    {otherHits.map((t) => (
                      <li key={t.eventId} className="ptd-result" role="option">
                        <button type="button" className="ptd-result-btn" disabled={busy} onClick={() => handleSelect(t)}>
                          <strong>{t.name}</strong>
                          {ctxLabel(t) && <span className="ptd-result-ctx"> · {ctxLabel(t)}</span>}
                          {t.description && <span className="ptd-result-desc"> — {t.description}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <button type="button" className="ptd-link ptd-show-other" onClick={() => setShowOther(true)}>
                  Show other results ({otherHits.length})
                </button>
              )
            )}
            {query && !exactMatchExists && filtered.length > 0 && (
              <div className="ptd-create-hint">
                Don't see what you want?{' '}
                <button
                  type="button"
                  className="ptd-link"
                  onClick={() => {
                    setNewName(query);
                    setView('create');
                  }}
                >
                  Create "{query}"
                </button>
              </div>
            )}
          </>
        )}

        {view === 'create' && (
          <div className="ptd-create">
            <label className="ptd-field">
              <span className="ptd-field-label">Name (required)</span>
              <input
                className="ptd-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Verified Human"
              />
            </label>
            <label className="ptd-field">
              <span className="ptd-field-label">Description (optional)</span>
              <textarea
                className="ptd-textarea"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                placeholder="What does this tag mean?"
              />
            </label>
            <button
              type="button"
              className="ptd-btn ptd-btn-create"
              disabled={busy || !newName.trim()}
              onClick={handleCreate}
            >
              Create and apply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
