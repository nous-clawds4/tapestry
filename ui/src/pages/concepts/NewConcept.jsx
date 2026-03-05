import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import { useAuth } from '../../context/AuthContext';
import { createConcept } from '../../api/normalize';

export default function NewConcept() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.classification === 'owner';

  const [name, setName] = useState('');
  const [plural, setPlural] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const derivedPlural = plural || (name ? name + 's' : '');
  const derivedSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const derivedPrimaryProp = name.trim().split(/\s+/).map((w, i) =>
    i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    setResult(null);
    try {
      const res = await createConcept({
        name: name.trim(),
        plural: plural.trim() || undefined,
        description: description.trim() || undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🧩 New Concept</h1>
      <p className="page-description">
        Create a new concept with a full skeleton: ListHeader, Superset, JSON Schema,
        three canonical graphs, and all wiring relationships.
      </p>

      {!isOwner && (
        <div className="health-banner health-warn" style={{ marginBottom: '1.5rem' }}>
          <span className="health-banner-icon">🔒</span>
          <span>Sign in as owner to create concepts.</span>
        </div>
      )}

      {result ? (
        <div className="new-concept-result">
          <div className="health-banner health-pass" style={{ marginBottom: '1.5rem' }}>
            <span className="health-banner-icon">✅</span>
            <span className="health-banner-label">Concept Created!</span>
          </div>

          <table className="data-table">
            <tbody>
              <tr><td><strong>Name</strong></td><td>{result.concept.name}</td></tr>
              <tr><td><strong>Plural</strong></td><td>{result.concept.plural}</td></tr>
              <tr><td><strong>Slug</strong></td><td><code>{result.concept.slug}</code></td></tr>
              <tr><td><strong>Primary Property</strong></td><td><code>{result.concept.primaryProperty}</code></td></tr>
              <tr><td><strong>UUID</strong></td><td><code className="uuid-short">{result.concept.uuid}</code></td></tr>
              <tr><td><strong>Events</strong></td><td>{result.message}</td></tr>
            </tbody>
          </table>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/kg/concepts/${encodeURIComponent(result.concept.uuid)}/health`)}
            >
              🩺 View Health Audit
            </button>
            <button
              className="btn"
              onClick={() => navigate(`/kg/concepts/${encodeURIComponent(result.concept.uuid)}`)}
            >
              📄 View Concept
            </button>
            <button
              className="btn"
              onClick={() => { setResult(null); setName(''); setPlural(''); setDescription(''); }}
            >
              ➕ Create Another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="new-concept-form">
          <div className="form-field">
            <label htmlFor="concept-name">Name <span className="required">*</span></label>
            <input
              id="concept-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. planet"
              required
              autoFocus
              disabled={creating}
            />
          </div>

          <div className="form-field">
            <label htmlFor="concept-plural">Plural</label>
            <input
              id="concept-plural"
              type="text"
              value={plural}
              onChange={e => setPlural(e.target.value)}
              placeholder={derivedPlural || 'auto-derived from name'}
              disabled={creating}
            />
            <span className="form-hint">Defaults to "{derivedPlural}"</span>
          </div>

          <div className="form-field">
            <label htmlFor="concept-description">Description</label>
            <textarea
              id="concept-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description of this concept"
              rows={3}
              disabled={creating}
            />
          </div>

          {/* Preview */}
          {name.trim() && (
            <div className="form-preview">
              <h4>Preview</h4>
              <table className="data-table">
                <tbody>
                  <tr><td>Slug</td><td><code>{derivedSlug}</code></td></tr>
                  <tr><td>Superset</td><td>the superset of all {derivedPlural}</td></tr>
                  <tr><td>JSON Schema</td><td>JSON schema for {name.trim()}</td></tr>
                  <tr><td>Primary Property</td><td><code>{derivedPrimaryProp}</code></td></tr>
                  <tr><td>Events</td><td>13 (7 nodes + 6 relationships)</td></tr>
                </tbody>
              </table>
            </div>
          )}

          {error && (
            <div className="health-banner health-fail" style={{ marginTop: '1rem' }}>
              <span className="health-banner-icon">❌</span>
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || creating || !isOwner}
              title={!isOwner ? 'Sign in as owner to create concepts' : ''}
            >
              {creating ? '⏳ Creating concept…' : '🧩 Create Concept'}
            </button>
          </div>
        </form>
      )}

      <section style={{ opacity: 0.6, marginTop: '2rem' }}>
        <p>CLI: <code>tapestry concept add "{name || '<name>'}"</code></p>
      </section>
    </div>
  );
}
