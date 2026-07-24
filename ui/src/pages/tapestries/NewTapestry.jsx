import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import { useAuth } from '../../context/AuthContext';
import { hasAdminAccess } from '../../utils/auth';
import useCreateTapestry from './useCreateTapestry';

/**
 * Create a Tapestry (members-only authoring) — tapestries #3 / ADR tapestries/0003.
 * Owner-gated. The owner titles the tapestry, picks existing member concepts, chooses a
 * signing identity (Tapestry Assistant | their own key), and publishes a real, explorable
 * kind-39999 element. Cross-concept integration authoring is a deferred fast-follow.
 */
export default function NewTapestry() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = hasAdminAccess(user);
  const { concepts, conceptsLoading, conceptsError, create } = useCreateTapestry();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState([]);          // selected concept handles
  const [filter, setFilter] = useState('');
  const [signAs, setSignAs] = useState('assistant');     // default: Tapestry Assistant (ADR)
  const [submitting, setSubmitting] = useState(false);
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState(null);

  // The compact, always-visible list of concepts the owner has added (chips).
  const selectedConcepts = useMemo(
    () => selected.map((h) => concepts.find((c) => c.handle === h)).filter(Boolean),
    [selected, concepts],
  );

  // Typeahead results: matches for the current query, excluding already-added concepts.
  // Empty when the search box is empty — so the panel only appears while searching.
  const results = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return [];
    // Match the full searchText blob (names/slugs/keys/titles/labels + description), not just the name.
    return concepts.filter(
      (c) => !selected.includes(c.handle) && (c.searchText || '').includes(q),
    );
  }, [concepts, filter, selected]);

  // Owner gate: non-owner/admin visitors get an explanation, never a working form.
  if (!isOwner) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>🧵 Create New Tapestry</h1>
        <p className="placeholder">
          Creating a Tapestry is owner-only. Sign in as the instance owner to author one.
        </p>
      </div>
    );
  }

  function add(handle) {
    setSelected((prev) => (prev.includes(handle) ? prev : [...prev, handle]));
  }
  function remove(handle) {
    setSelected((prev) => prev.filter((h) => h !== handle));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return; // re-entry guard — defense beyond the disabled button
    setValidation(null);
    setError(null);
    if (!title.trim()) { setValidation('Please enter a title.'); return; }
    if (selected.length === 0) { setValidation('Please select at least one member concept.'); return; }

    setSubmitting(true);
    try {
      const { uuid } = await create({ title, description, selectedHandles: selected, signAs });
      navigate(`/tapestry/tapestries/${encodeURIComponent(uuid)}`);
    } catch (err) {
      setError(err.message || 'Failed to create the tapestry.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🧵 Create New Tapestry</h1>
      <p className="subtitle">Group existing concepts into a curated, explorable Tapestry.</p>

      <form className="tapestry-new-form" onSubmit={onSubmit}>
        <label className="form-field">
          <span>Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Tapestry for Dog"
          />
        </label>

        <label className="form-field">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this tapestry groups together…"
          />
        </label>

        <div className="form-field">
          <span>Member concepts</span>
          {conceptsLoading && <p className="placeholder">Loading concepts…</p>}
          {conceptsError && <p className="error">Could not load concepts: {conceptsError}</p>}
          {!conceptsLoading && !conceptsError && concepts.length === 0 && (
            <p className="placeholder">No concepts found on this instance.</p>
          )}
          {!conceptsLoading && !conceptsError && concepts.length > 0 && (
            <>
              {/* The persistent, compact list of what will be included. */}
              {selectedConcepts.length === 0 ? (
                <p className="placeholder">No concepts added yet — search below to add some.</p>
              ) : (
                <ul className="tapestry-selected-list" aria-label="Selected member concepts">
                  {selectedConcepts.map((c) => (
                    <li key={c.handle} className="tapestry-selected-chip">
                      <span>{c.name}</span>
                      <button
                        type="button"
                        className="tapestry-chip-remove"
                        aria-label={`Remove ${c.name}`}
                        onClick={() => remove(c.handle)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Typeahead: the results panel only appears while the search box has text. */}
              <input
                type="text"
                className="tapestry-concept-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search concepts to add…"
                aria-label="Search concepts"
              />
              {filter.trim() && (
                <div className="tapestry-concept-picker" role="listbox" aria-label="Matching concepts">
                  {results.length === 0 ? (
                    <p className="placeholder" style={{ margin: '0.25rem' }}>No concepts match “{filter}”.</p>
                  ) : (
                    results.map((c) => (
                      <button
                        key={c.handle}
                        type="button"
                        className="tapestry-concept-option"
                        aria-label={`Add ${c.name}`}
                        onClick={() => add(c.handle)}
                      >
                        <span>{c.name}</span>
                        <span className="tapestry-concept-add">+ Add</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <label className="form-field tapestry-signing">
          <span>Sign as</span>
          <select value={signAs} onChange={(e) => setSignAs(e.target.value)}>
            <option value="assistant">Tapestry Assistant</option>
            <option value="client">My own key</option>
          </select>
        </label>

        {validation && <p className="error tapestry-validation">{validation}</p>}
        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Tapestry'}
        </button>
      </form>
    </div>
  );
}
