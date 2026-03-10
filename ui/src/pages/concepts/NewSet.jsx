import { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';

const API = '/api/normalize/create-set';

export default function NewSet() {
  const { concept, uuid } = useOutletContext();
  const navigate = useNavigate();
  const encodedUuid = encodeURIComponent(uuid);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentUuid, setParentUuid] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all Sets/Supersets downstream from concept's Superset (same query as ConceptDag)
  const { data: setsData, loading: setsLoading } = useCypher(
    uuid ? `
      MATCH (h:NostrEvent {uuid: '${uuid}'})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
      OPTIONAL MATCH path = (sup)-[:IS_A_SUPERSET_OF*0..10]->(s)
      WITH s, length(path) AS depth, labels(s) AS nodeLabels
      RETURN s.uuid AS uuid, s.name AS name, nodeLabels, depth
      ORDER BY depth, name
    ` : null
  );

  // Auto-select the superset (first item, depth 0) if nothing selected
  const parentOptions = setsData || [];
  const effectiveParent = parentUuid || (parentOptions.length > 0 ? parentOptions[0].uuid : '');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!effectiveParent) { setError('No parent Set/Superset available'); return; }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          parentUuid: effectiveParent,
        }),
      });
      const data = await res.json();

      if (data.success) {
        navigate(`/kg/concepts/${encodedUuid}/dag`);
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h2>New Set</h2>
      <p style={{ opacity: 0.6, fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        Create a new Set under <strong>{concept?.name}</strong>.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Name */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 500 }}>
            Name <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., London coffee houses"
            required
            style={{
              width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.9rem',
              borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
              backgroundColor: 'rgba(255,255,255,0.05)', color: 'inherit',
            }}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 500 }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g., This is the set of all coffee houses in the city of London."
            rows={3}
            style={{
              width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.9rem',
              borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
              backgroundColor: 'rgba(255,255,255,0.05)', color: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Parent selector */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 500 }}>
            Parent Set/Superset <span style={{ color: '#ef4444' }}>*</span>
          </label>
          {setsLoading ? (
            <span style={{ opacity: 0.5, fontSize: '0.85rem' }}>Loading…</span>
          ) : parentOptions.length === 0 ? (
            <span style={{ opacity: 0.5, fontSize: '0.85rem' }}>No Sets/Supersets found. Has this concept been normalized?</span>
          ) : (
            <select
              value={effectiveParent}
              onChange={e => setParentUuid(e.target.value)}
              style={{
                width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.9rem',
                borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
                backgroundColor: 'rgba(255,255,255,0.05)', color: 'inherit',
              }}
            >
              {parentOptions.map(opt => {
                const labels = opt.nodeLabels || [];
                const typeLabel = labels.includes('Superset') ? 'Superset' : 'Set';
                const indent = '  '.repeat(opt.depth || 0);
                return (
                  <option key={opt.uuid} value={opt.uuid}>
                    {indent}{opt.depth > 0 ? '└ ' : ''}{opt.name || opt.uuid.slice(0, 20)} ({typeLabel})
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '0.5rem 0.7rem', marginBottom: '1rem', borderRadius: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171', fontSize: '0.85rem',
          }}>
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !name.trim() || !effectiveParent}
          >
            {submitting ? 'Creating…' : 'Create Set'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/kg/concepts/${encodedUuid}/dag`)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
