import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import Breadcrumbs from '../../components/Breadcrumbs';

/**
 * Goal Sets — the elements of the goal-set concept, each linking to the
 * Rationale page pre-loaded with its pair (parent/child goal SLUGS as query
 * params — the same instance-portable references the element itself stores).
 * Read-tolerant by construction: superset members without a parseable
 * goalSet json section (strays, malformed elements) are skipped, not errors.
 * Owner-gated like the other brain views.
 */
export default function GoalSets() {
  const { user, loading: authLoading } = useAuth();
  const { taPubkey } = useConfig();
  const isOwner = user?.classification === 'owner' || user?.classification === 'admin';

  const [sets, setSets] = useState(null); // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taPubkey) return undefined;
    const controller = new AbortController();
    const getJson = (handle) =>
      fetch(`/api/concept-graph/node/${encodeURIComponent(handle)}`, { signal: controller.signal })
        .then((r) => r.json());
    const getNeighbors = (handle) =>
      fetch(`/api/concept-graph/node/${encodeURIComponent(handle)}/neighbors`, { signal: controller.signal })
        .then((r) => r.json());

    (async () => {
      try {
        const header = await getNeighbors(`39998:${taPubkey}:goal-set`);
        const superset = (header?.neighbors?.IS_THE_CONCEPT_FOR || [])[0]?.handle;
        if (!superset) { setSets([]); return; }
        const supNeighbors = await getNeighbors(superset);
        const els = supNeighbors?.neighbors?.HAS_ELEMENT || [];
        const out = [];
        for (const el of els) {
          const node = await getJson(el.handle);
          const tag = node?.node?.tags?.find((t) => t.type === 'json');
          let section = null;
          try { section = tag ? JSON.parse(tag.value)?.goalSet : null; } catch { section = null; }
          if (section && typeof section === 'object' && !Array.isArray(section)) {
            out.push({
              uuid: el.handle,
              name: section.name || el.name || el.handle,
              description: section.description || null,
              parentGoal: section.parentGoal || null,
              childGoal: section.childGoal || null,
            });
          }
        }
        setSets(out);
        setError(null);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Could not load goal sets');
        setSets([]);
      }
    })();
    return () => controller.abort();
  }, [taPubkey]);

  if (authLoading) {
    return (
      <div className="page brain-goals">
        <Breadcrumbs />
        <h1>Goal Sets</h1>
        <p className="brain-muted">Checking who you are…</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="page brain-goals">
        <Breadcrumbs />
        <h1>Goal Sets</h1>
        <div className="brain-gate">
          <p>🔒 This page is only available to the owner.</p>
          {!user && <p>Please sign in to continue.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="page brain-goals">
      <Breadcrumbs />
      <h1>Goal Sets</h1>
      <p className="brain-muted">
        Each goal set is a parent/child pair — open one to view it on the Rationale page.
      </p>
      {error && <p className="error">Could not load goal sets: {error}</p>}
      {sets === null ? (
        <p className="brain-muted">Loading goal sets…</p>
      ) : sets.length === 0 ? (
        <p className="brain-muted">No goal sets yet — save one from the Rationale page.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem', maxWidth: '720px' }}>
          {sets.map((s) => (
            <li key={s.uuid} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              {s.parentGoal && s.childGoal ? (
                <Link
                  to={`/tapestry/goals/rationale?parent=${encodeURIComponent(s.parentGoal)}&child=${encodeURIComponent(s.childGoal)}`}
                  style={{ fontWeight: 600 }}
                >
                  {s.name}
                </Link>
              ) : (
                <>
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span className="brain-muted" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                    (pair incomplete — cannot open)
                  </span>
                </>
              )}
              {s.description && (
                <p className="brain-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>{s.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
