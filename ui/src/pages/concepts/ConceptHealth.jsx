import { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { auditConcept } from '../../api/audit';
import { normalizeSkeleton, normalizeJson } from '../../api/normalize';
import { useAuth } from '../../context/AuthContext';

const statusIcon = (s) => s === 'pass' ? '✅' : s === 'warn' ? '⚠️' : s === 'fail' ? '❌' : 'ℹ️';

const ROLE_TO_NODE = {
  'ListHeader (CTH)': 'header',
  'Superset': 'superset',
  'JSON Schema': 'schema',
  'Core Nodes Graph': 'core-graph',
  'Class Threads Graph': 'class-graph',
  'Property Tree Graph': 'property-graph',
};

export default function ConceptHealth() {
  const { concept, uuid } = useOutletContext();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canFix = user?.classification === 'owner';
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fixing, setFixing] = useState(null); // null | 'all' | node role string

  const runAudit = useCallback(() => {
    if (!concept?.name) return;
    setLoading(true);
    auditConcept(concept.name)
      .then(data => { setAudit(data); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [concept?.name]);

  useEffect(() => { runAudit(); }, [runAudit]);

  async function handleFix(node) {
    if (!canFix) return;
    setFixing(node || 'all');
    try {
      await normalizeSkeleton({ concept: concept.name, node });
      runAudit();
      setFixing(null);
    } catch (e) {
      setError(`Fix failed: ${e.message}`);
      setFixing(null);
    }
  }

  async function handleFixJson(node) {
    if (!canFix) return;
    setFixing(`json-${node || 'all'}`);
    try {
      await normalizeJson({ concept: concept.name, node: node || undefined });
      runAudit();
      setFixing(null);
    } catch (e) {
      setError(`Fix JSON failed: ${e.message}`);
      setFixing(null);
    }
  }

  if (loading) return <div className="loading">Running health audit…</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!audit?.found) return <div className="error">Concept not found in audit system.</div>;

  const { status, checks, skeleton, elements, sets, wiring } = audit;
  const hasMissingNodes = skeleton?.nodes?.some(n => !n.exists);
  const hasMissingJson = skeleton?.nodes?.some(n => n.exists && !n.json);

  return (
    <div className="concept-health">
      {/* Banner */}
      <div className={`health-banner health-${status}`}>
        <span className="health-banner-icon">{statusIcon(status)}</span>
        <span className="health-banner-label">
          {status === 'pass' ? 'HEALTHY' : status === 'warn' ? 'WARNINGS' : 'ISSUES FOUND'}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <button className="btn btn-small" onClick={runAudit} disabled={loading}>🔄 Re-run</button>
        </span>
      </div>

      {/* Checks summary */}
      <section className="health-section">
        <h3>Checks</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Check</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c, i) => (
              <tr key={i}>
                <td>{statusIcon(c.status)}</td>
                <td><strong>{c.name}</strong></td>
                <td>{c.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Skeleton nodes */}
      {skeleton?.nodes && (
        <section className="health-section">
          <h3>
            Skeleton Nodes
            {hasMissingNodes && (
              <button
                className="btn btn-small btn-primary"
                style={{ marginLeft: '1rem' }}
                onClick={() => handleFix(null)}
                disabled={fixing !== null || !canFix}
                title={!canFix ? 'Sign in as owner to fix' : ''}
              >
                {fixing === 'all' ? '⏳ Creating…' : '🔧 Fix All Missing'}
              </button>
            )}
            {hasMissingJson && (
              <button
                className="btn btn-small"
                style={{ marginLeft: '0.5rem' }}
                onClick={() => handleFixJson(null)}
                disabled={fixing !== null || !canFix}
                title={!canFix ? 'Sign in as owner to fix' : 'Regenerate JSON for all nodes missing it'}
              >
                {fixing === 'json-all' ? '⏳ Generating…' : '📝 Fix All JSON'}
              </button>
            )}
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Name</th>
                <th>Exists</th>
                <th>JSON</th>
                <th>UUID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {skeleton.nodes.map((n, i) => {
                const nodeKey = ROLE_TO_NODE[n.role];
                const isMissing = !n.exists && nodeKey;
                return (
                  <tr key={i}>
                    <td>{n.role}</td>
                    <td>{n.name || '—'}</td>
                    <td>{n.exists ? '✅' : '❌'}</td>
                    <td>{n.exists ? (n.json ? '✅' : '❌') : '—'}</td>
                    <td><code className="uuid-short" title={n.uuid}>{n.uuid?.slice(-12) || '—'}</code></td>
                    <td>
                      {isMissing && (
                        <button
                          className="btn btn-small"
                          onClick={() => handleFix(nodeKey)}
                          disabled={fixing !== null || !canFix}
                          title={!canFix ? 'Sign in as owner to fix' : ''}
                        >
                          {fixing === nodeKey ? '⏳' : '🔧 Create'}
                        </button>
                      )}
                      {n.exists && !n.json && nodeKey && (
                        <button
                          className="btn btn-small"
                          onClick={() => handleFixJson(nodeKey)}
                          disabled={fixing !== null || !canFix}
                          title={!canFix ? 'Sign in as owner to fix' : 'Regenerate JSON tag'}
                        >
                          {fixing === `json-${nodeKey}` ? '⏳' : '📝 Fix JSON'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Elements */}
      {elements && (
        <section className="health-section">
          <h3>Elements ({elements.total ?? 0})</h3>
          {elements.total > 0 ? (
            <>
              <p>
                {elements.withJson ?? 0} with JSON tags, {elements.withoutJson ?? 0} without.
                {elements.orphans > 0 && <span style={{ color: 'var(--color-danger, #ef4444)' }}> {elements.orphans} orphaned.</span>}
              </p>
              {elements.items && elements.items.length > 0 && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>JSON</th>
                      <th>Orphan</th>
                      <th>UUID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elements.items.map((el, i) => (
                      <tr key={i}>
                        <td>{el.name || '—'}</td>
                        <td>{el.hasJson ? '✅' : '❌'}</td>
                        <td>{el.orphan ? '⚠️' : '—'}</td>
                        <td><code className="uuid-short" title={el.uuid}>{el.uuid?.slice(-12) || '—'}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <p style={{ opacity: 0.6 }}>
              No elements found.{' '}
              <button
                className="btn btn-small btn-primary"
                onClick={() => navigate(`/kg/concepts/${encodeURIComponent(uuid)}/elements/new`)}
              >
                + Add Element
              </button>
            </p>
          )}
        </section>
      )}

      {/* Sets */}
      {sets && sets.length > 0 && (
        <section className="health-section">
          <h3>Intermediate Sets ({sets.length})</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>UUID</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((s, i) => (
                <tr key={i}>
                  <td>{s.name || '—'}</td>
                  <td><code className="uuid-short" title={s.uuid}>{s.uuid?.slice(-12) || '—'}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Wiring */}
      {wiring && wiring.length > 0 && (
        <section className="health-section">
          <h3>Wiring Issues ({wiring.length})</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>From</th>
                <th>Rel</th>
                <th>To</th>
                <th>Issue</th>
              </tr>
            </thead>
            <tbody>
              {wiring.map((w, i) => (
                <tr key={i}>
                  <td>{statusIcon(w.status || 'fail')}</td>
                  <td>{w.from || '—'}</td>
                  <td><code>{w.type || '—'}</code></td>
                  <td>{w.to || '—'}</td>
                  <td>{w.issue || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* CLI hint */}
      <section className="health-section" style={{ opacity: 0.6, marginTop: '2rem' }}>
        <p>CLI: <code>tapestry audit concept "{concept.name}"</code> · <code>tapestry normalize skeleton "{concept.name}"</code></p>
      </section>
    </div>
  );
}
