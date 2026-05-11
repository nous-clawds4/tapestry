import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import PaymentCode from '../../components/PaymentCode';
import { useAuth } from '../../context/AuthContext';
import { getPaymentsDue } from '../../api/bounties';
import { zapContributor } from '../../utils/zap';
import { capText, formatSats, maxRewardsText, rewardScopeLabel } from '../../utils/bountyTerms';

function short(pk) { return pk ? pk.slice(0, 8) + '…' : '—'; }

function PendingClaimRow({ claim, bountyAmount }) {
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState(null);

  async function handleZap() {
    setBusy(true);
    setError(null);
    try {
      const result = await zapContributor({
        recipientPubkeyHex: claim.event.pubkey,
        amountSats: bountyAmount,
        claimEventId: claim.event.id,
      });
      setPayment(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '0.75rem', background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, marginBottom: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}>
          <div><code>{short(claim.event.pubkey)}</code></div>
          <div style={{ opacity: 0.8 }}>{claim.event.content?.slice(0, 80) || claim.event.id?.slice(0, 16)}</div>
        </div>
        <button
          onClick={handleZap}
          disabled={busy}
          style={{ padding: '0.35rem 0.8rem', background: '#f2a134', color: '#0d1117', border: 'none', borderRadius: 4, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? 'Loading…' : `Zap ${formatSats(bountyAmount)} sats`}
        </button>
      </div>
      {payment && <PaymentCode payment={payment} />}
      {error && <div style={{ color: '#f85149', fontSize: '0.8rem', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export default function PaymentsDue() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    getPaymentsDue()
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading || !user?.pubkey) return;
    refresh();
  }, [authLoading, user?.pubkey, refresh]);

  if (authLoading) return <div className="page"><Breadcrumbs /><p>Loading…</p></div>;
  if (!user?.pubkey) {
    return <div className="page"><Breadcrumbs /><h1>Payments Due</h1><p style={{ opacity: 0.7 }}>Sign in to see claims on your bounties.</p></div>;
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>Payments Due</h1>
      <p style={{ opacity: 0.7 }}>Claims on your bounties that haven't been zapped yet. Click Zap to pay.</p>

      {loading && <p>Loading…</p>}
      {error && <p className="error" style={{ color: '#f85149' }}>Error: {error}</p>}
      {!loading && !error && items.length === 0 && (
        <p style={{ opacity: 0.6 }}>All caught up. No pending claims on your bounties.</p>
      )}

      {items.map(({ bounty, pendingClaims }) => (
        <div key={bounty.id} style={{ marginBottom: '1.25rem', padding: '0.9rem', background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
            <div>
              <Link to={`/tapestry/bounties/${bounty.id}`} style={{ fontWeight: 700, color: '#58a6ff' }}>
                {bounty.criteria.slice(0, 60)}
              </Link>
              <div style={{ fontSize: '0.8rem', opacity: 0.6, fontFamily: 'monospace' }}>{bounty.list_coordinate}</div>
            </div>
            <div style={{ color: '#f2a134', fontWeight: 700, textAlign: 'right' }}>
              <div>{formatSats(bounty.amount_sats)} sats</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{rewardScopeLabel(bounty)}</div>
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>
            {capText(bounty)}
            {maxRewardsText(bounty) && <span> / {maxRewardsText(bounty)}</span>}
          </div>
          {pendingClaims.map(c => (
            <PendingClaimRow key={c.event.id} claim={c} bountyAmount={bounty.amount_sats} />
          ))}
        </div>
      ))}
    </div>
  );
}
