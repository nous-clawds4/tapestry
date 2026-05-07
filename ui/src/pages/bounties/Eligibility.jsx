import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import { useAuth } from '../../context/AuthContext';
import { getEligible } from '../../api/bounties';

function short(pk) { return pk ? pk.slice(0, 8) + '…' : '—'; }
function age(ts) {
  if (!ts) return '—';
  const d = Date.now() / 1000 - ts;
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export default function Eligibility() {
  const { user, loading: authLoading } = useAuth();
  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.pubkey) { setLoading(false); return; }
    let cancelled = false;
    getEligible(user.pubkey)
      .then(bs => { if (!cancelled) setBounties(bs); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authLoading, user?.pubkey]);

  if (authLoading) return <div className="page"><Breadcrumbs /><p>Loading…</p></div>;
  if (!user?.pubkey) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>Eligibility</h1>
        <p style={{ opacity: 0.7 }}>Sign in with a Nostr extension to see bounties you're eligible to claim.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>Eligibility</h1>
      <div style={{ padding: '0.5rem 0.75rem', background: '#161b22', border: '1px solid #30363d', borderRadius: 4, marginBottom: '0.75rem', fontSize: '0.85rem' }}>
        <Link to="/tapestry/bounties/payments-to-me" style={{ color: '#58a6ff' }}>
          View payments owed to you →
        </Link>
      </div>
      <p style={{ opacity: 0.7 }}>
        Bounties issued by people whose web of trust says you're trustworthy enough to contribute
        (Trusted Assertion rank ≥ 2).
      </p>

      {loading && <p>Checking eligibility…</p>}
      {error && <p className="error" style={{ color: '#f85149' }}>Error: {error}</p>}
      {!loading && !error && bounties.length === 0 && (
        <p style={{ opacity: 0.6 }}>
          No bounties are visible to you yet. This can mean (a) no open bounties exist, or
          (b) no bounty issuer has your pubkey at rank ≥ 2 in their WoT.
        </p>
      )}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {bounties.map(b => {
          const claimHref = `/tapestry/lists/${encodeURIComponent(b.list_coordinate)}/items/new?bounty=${encodeURIComponent(b.id)}`;
          return (
            <div key={b.id} style={{ padding: '1rem', background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', opacity: 0.55 }}>List</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '0.4rem' }}>{b.list_coordinate}</div>
                  <div style={{ marginBottom: '0.3rem' }}>{b.criteria}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                    issued by <code>{short(b.issuer_pubkey)}</code>
                    <span style={{ marginLeft: '0.6rem', background: '#1f6feb', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: 3 }}>
                      rank {b.issuerRank}
                    </span>
                    <span style={{ marginLeft: '0.5rem' }}>· {age(b.created_at)}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 140 }}>
                  <div style={{ color: '#f2a134', fontSize: '1.4rem', fontWeight: 700 }}>{b.amount_sats.toLocaleString()}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.6, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>SATS</div>
                  <Link
                    to={claimHref}
                    style={{ display: 'inline-block', padding: '0.4rem 0.9rem', background: '#2ea043', color: '#fff', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}
                  >
                    Claim →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
