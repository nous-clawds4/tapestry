import { useState, useMemo, useRef, useEffect } from 'react';

export default function AddTagDialog({
  availableTags,
  appliedTagEventIds,
  applicableKeys,
  busy,
  onClose,
  onSelectExisting,
  onCreateNew,
}) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState('search'); // 'search' | 'create'
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const candidates = availableTags.filter((t) => !appliedTagEventIds.has(t.eventId));
    if (!q) {
      // BROWSE (no query): hard-filter to the current context's applicable tags, ordered by
      // the list (tag-applicability #2). Search (below) still spans EVERY tag — the escape that
      // lets a cross-context tag be picked instead of re-minted. Absent/empty applicableKeys ⇒
      // fall back to the full browse (never a blank picker).
      if (Array.isArray(applicableKeys) && applicableKeys.length > 0) {
        const order = new Map(applicableKeys.map((k, i) => [k, i]));
        return candidates
          .filter((t) => order.has(`${t.authorPubkey}:${t.slug}`))
          .sort((a, b) => order.get(`${a.authorPubkey}:${a.slug}`) - order.get(`${b.authorPubkey}:${b.slug}`))
          .slice(0, 20);
      }
      return candidates.slice(0, 20);
    }
    // SEARCH: the whole universe, never gated by the browse filter (anti-re-mint escape).
    return candidates
      .filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [availableTags, appliedTagEventIds, applicableKeys, query]);

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
                      {t.description && <span className="ptd-result-desc"> — {t.description}</span>}
                    </button>
                  </li>
                ))
              )}
            </ul>
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
