import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import { listBounties } from '../../api/bounties';
import { capText, formatSats, maxRewardsText, rewardScopeLabel } from '../../utils/bountyTerms';

function short(pk) { return pk ? pk.slice(0, 8) + '…' : '—'; }
function age(ts) {
  if (!ts) return '—';
  const d = Date.now() / 1000 - ts;
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function StatusBadge({ status }) {
  const color = status === 'open' ? '#2ea043' : status === 'fulfilled' ? '#58a6ff' : '#8b949e';
  return (
    <span style={{ background: color, color: '#fff', padding: '0.15rem 0.5rem', borderRadius: 3, fontSize: '0.75rem', textTransform: 'uppercase' }}>
      {status}
    </span>
  );
}

export default function BountyList() {
  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listBounties({ status: 'open' })
      .then(bs => { if (!cancelled) setBounties(bs); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page">
      <Breadcrumbs />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Bounties</h1>
        <Link to="new" className="button" style={{ background: '#1f6feb', color: '#fff', padding: '0.5rem 1rem', borderRadius: 4, textDecoration: 'none' }}>
          + New Bounty
        </Link>
      </div>

      {loading && <p>Loading bounties…</p>}
      {error && <p className="error">Error: {error}</p>}
      {!loading && !error && bounties.length === 0 && (
        <p style={{ opacity: 0.6 }}>No open bounties yet. Be the first to incentivize a list!</p>
      )}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {bounties.map(b => (
          <Link
            key={b.id}
            to={b.id}
            style={{ display: 'block', padding: '1rem', background: '#161b22', border: '1px solid #30363d', borderRadius: 6, textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.85rem', opacity: 0.55 }}>List</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '0.4rem' }}>{b.list_coordinate}</div>
                <div style={{ marginBottom: '0.2rem' }}>{b.criteria}</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                  issued by <code>{short(b.issuer_pubkey)}</code> · {age(b.created_at)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#f2a134', fontSize: '1.4rem', fontWeight: 700 }}>{formatSats(b.amount_sats)}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.6, letterSpacing: '0.05em' }}>{rewardScopeLabel(b).toUpperCase()}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.65, marginTop: '0.25rem' }}>{capText(b)}</div>
                {maxRewardsText(b) && <div style={{ fontSize: '0.75rem', opacity: 0.65 }}>{maxRewardsText(b)}</div>}
                <div style={{ marginTop: '0.4rem' }}>
                  <StatusBadge status={b.derivedStatus || b.status} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
