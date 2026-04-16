import { Link, useOutletContext } from 'react-router-dom';

function getTag(event, name, index = 1) {
  const tag = event.tags?.find(t => t[0] === name);
  return tag ? tag[index] : null;
}

export default function DListActions() {
  const { event } = useOutletContext() || {};
  const dTag = event && getTag(event, 'd');
  const coordinate = event && dTag ? `${event.kind}:${event.pubkey}:${dTag}` : null;

  return (
    <div className="dlist-actions">
      <h2>Actions</h2>

      {coordinate && (
        <div style={{ padding: '1rem', background: '#161b22', border: '1px solid #30363d', borderRadius: 6, marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '0.3rem' }}>Incentivize contributions</div>
          <div style={{ marginBottom: '0.6rem' }}>
            Attach a Lightning bounty to this list. People you trust (rank ≥ 2) will see it on their
            eligibility dashboard and can submit items to earn sats.
          </div>
          <Link
            to={`/tapestry/bounties/new?concept=${encodeURIComponent(coordinate)}`}
            style={{ display: 'inline-block', padding: '0.55rem 1.1rem', background: '#f2a134', color: '#0d1117', borderRadius: 4, textDecoration: 'none', fontWeight: 700 }}
          >
            💰 Incentivize — pay people to add items
          </Link>
        </div>
      )}

      <p className="placeholder">More actions coming soon — import to Neo4j, sync to remote relay, etc.</p>
    </div>
  );
}
