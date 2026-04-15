import { useEffect, useState } from 'react';

const OUR_TA = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';

/**
 * Read-only summary of every ConceptHeader currently in Neo4j whose
 * d-tag matches `slug`. Used on PublishRelayForm and RelayTagPanel to
 * communicate that this instance may know about multiple concepts under
 * the same abstract idea — but currently publishes only to its own.
 *
 * No picker, no behavior change. Pure information.
 */
export default function KnownConceptsPanel({ slug }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`/api/concept-discovery/known-by-slug?slug=${encodeURIComponent(slug)}`);
        const body = await resp.json();
        if (cancelled) return;
        if (!body.success) throw new Error(body.error || `HTTP ${resp.status}`);
        setData(body);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (error) {
    return <div className="known-concepts-panel known-concepts-error">⚠️ {error}</div>;
  }
  if (!data) return null;

  const ours = data.concepts.find((c) => c.pubkey === OUR_TA);
  const others = data.concepts.filter((c) => c.pubkey !== OUR_TA);

  return (
    <div className="known-concepts-panel">
      <div className="known-concepts-row">
        <span className="known-concepts-label">Publishing to:</span>{' '}
        {ours ? (
          <code className="known-concepts-coord">{ours.coordinate}</code>
        ) : (
          <em>our <code>{slug}</code> concept (not yet installed)</em>
        )}
      </div>
      {others.length > 0 && (
        <>
          <div className="known-concepts-divider" />
          <div className="known-concepts-row">
            <span className="known-concepts-label">
              Other <code>{slug}</code> concepts you've imported:
            </span>
          </div>
          <ul className="known-concepts-list">
            {others.map((c) => (
              <li key={c.coordinate}>
                <code className="known-concepts-coord-small">{c.coordinate}</code>
              </li>
            ))}
          </ul>
          <div className="known-concepts-hint">
            Each defines &ldquo;what a <code>{slug}</code> is&rdquo; slightly differently.
            This instance publishes to its own concept for now; user-published events
            against any imported coordinate are surfaced in the aggregated discovery view.
          </div>
        </>
      )}
    </div>
  );
}
