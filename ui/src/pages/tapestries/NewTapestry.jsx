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

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return concepts;
    return concepts.filter((c) => c.name.toLowerCase().includes(q) || c.shortSlug.includes(q));
  }, [concepts, filter]);

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

  function toggle(handle) {
    setSelected((prev) => (prev.includes(handle) ? prev.filter((h) => h !== handle) : [...prev, handle]));
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
              <input
                type="text"
                className="tapestry-concept-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter concepts…"
                aria-label="Filter concepts"
              />
              <div className="tapestry-concept-picker" role="group" aria-label="Member concepts">
                {filtered.map((c) => (
                  <label key={c.handle} className="tapestry-concept-option">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.handle)}
                      onChange={() => toggle(c.handle)}
                    />
                    <span>{c.name}</span>
                  </label>
                ))}
                {filtered.length === 0 && (
                  <p className="placeholder" style={{ margin: '0.25rem' }}>No concepts match “{filter}”.</p>
                )}
              </div>
              <p className="tapestry-selected-count">{selected.length} selected</p>
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
