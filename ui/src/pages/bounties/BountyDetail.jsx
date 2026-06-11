import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import PaymentCode from '../../components/PaymentCode';
import { getBounty } from '../../api/bounties';
import { zapContributor } from '../../utils/zap';
import { capText, closedReasonText, formatSats, maxRewardsText, remainingRewardsText, rewardScopeLabel } from '../../utils/bountyTerms';

function short(pk) { return pk ? pk.slice(0, 8) + '…' : '—'; }
function age(ts) {
  if (!ts) return '—';
  const d = Date.now() / 1000 - ts;
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function getTag(event, name) {
  const tag = event.tags?.find(t => t[0] === name);
  return tag ? tag[1] : null;
}

function titleFromClaim(event) {
  const names = event.tags?.find(t => t[0] === 'names');
  if (names && names[1]) return names[1];
  return getTag(event, 'name') || event.id?.slice(0, 12) || '(untitled)';
}

function ClaimRow({ claim, bounty, onZap }) {
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState(null);

  const paymentStatus = claim.paymentStatus || (claim.zapReceipt ? 'paid' : 'payable');
  const paid = paymentStatus === 'paid' || !!claim.zapReceipt;
  const payable = paymentStatus === 'payable';
  const reconciliation = paymentStatus === 'paid_unreceipted';
  const bountyAmount = claim.paymentAmountSats ?? bounty.amount_sats;

  async function handleZap() {
    if (!payable || paid) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onZap(claim.event.pubkey, claim.event.id, bountyAmount);
      setPayment(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '0.9rem', background: '#161b22', border: '1px solid #30363d', borderRadius: 6, marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{titleFromClaim(claim.event)}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
            by <code>{short(claim.event.pubkey)}</code> · {age(claim.event.created_at)}
          </div>
          {claim.event.content && (
            <div style={{ marginTop: '0.4rem', fontSize: '0.9rem', opacity: 0.85 }}>{claim.event.content}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {paid ? (
            <span style={{ background: '#2ea043', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: 3, fontSize: '0.75rem' }}>
              Paid
            </span>
          ) : reconciliation ? (
            <span style={{ background: '#8b6f2a', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: 3, fontSize: '0.75rem' }}>
              Reconciliation
            </span>
          ) : payable ? (
            <button
              onClick={handleZap}
              disabled={busy}
              style={{ padding: '0.4rem 0.9rem', background: '#f2a134', color: '#0d1117', border: 'none', borderRadius: 4, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
            >
              {busy ? 'Zapping…' : `Zap ${formatSats(bountyAmount)} sats`}
            </button>
          ) : (
            <span style={{ background: '#30363d', color: '#c9d1d9', padding: '0.2rem 0.5rem', borderRadius: 3, fontSize: '0.75rem' }}>
              {closedReasonText(claim.closedReason)}
            </span>
          )}
        </div>
      </div>
      {reconciliation && (
        <div style={{ color: '#d29922', marginTop: '0.4rem', fontSize: '0.85rem' }}>
          Auto-pay paid this invoice, but no zap receipt has landed yet. Normal zapping is hidden to prevent a duplicate payment.
        </div>
      )}
      {claim.autoPayBlockedReason === 'daily_cap_exceeded' && (
        <div style={{ color: '#d29922', marginTop: '0.4rem', fontSize: '0.85rem' }}>
          Auto-pay daily cap reached; manual Zap is still available.
        </div>
      )}
      {payment && <PaymentCode payment={payment} />}
      {error && <div style={{ color: '#f85149', marginTop: '0.4rem', fontSize: '0.85rem' }}>{error}</div>}
    </div>
  );
}

export default function BountyDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = await getBounty(id);
      setData(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) return <div className="page"><Breadcrumbs /><p>Loading bounty…</p></div>;
  if (error) return <div className="page"><Breadcrumbs /><p className="error">Error: {error}</p></div>;
  if (!data?.bounty) return <div className="page"><Breadcrumbs /><p>Bounty not found.</p></div>;

  const { bounty, claims = [] } = data;
  const derived = bounty.derivedStatus || bounty.status;

  async function onZap(recipientPubkeyHex, claimEventId, amountSats) {
    return zapContributor({
      recipientPubkeyHex,
      amountSats,
      claimEventId,
      listCoordinate: bounty.list_coordinate,
    });
  }

  const listHref = `/tapestry/lists/${encodeURIComponent(bounty.list_coordinate)}`;
  const addItemHref = `${listHref}/items/new`;
  const isOpen = derived === 'open';

  return (
    <div className="page">
      <Breadcrumbs />
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.8rem', opacity: 0.55, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Bounty</div>
        <h1 style={{ margin: '0.2rem 0 0.4rem', color: '#f2a134' }}>
          {formatSats(bounty.amount_sats)} sats
          <span style={{ fontSize: '0.8rem', marginLeft: '0.8rem', padding: '0.2rem 0.5rem', background: derived === 'open' ? '#2ea043' : '#8b949e', color: '#fff', borderRadius: 3, verticalAlign: 'middle' }}>
            {derived}
          </span>
        </h1>
        <div style={{ fontSize: '0.85rem', opacity: 0.75, marginBottom: '0.35rem' }}>
          {rewardScopeLabel(bounty)} / {capText(bounty)}
          {remainingRewardsText(bounty) && <span> / {remainingRewardsText(bounty)}</span>}
          {maxRewardsText(bounty) && <span> / {maxRewardsText(bounty)}</span>}
        </div>
        <div style={{ fontSize: '0.9rem', opacity: 0.85 }}>{bounty.criteria}</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.4rem' }}>
          issued by <code>{short(bounty.issuer_pubkey)}</code> · {age(bounty.created_at)}
        </div>
        <div style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
          target list: <Link to={listHref} style={{ fontFamily: 'monospace' }}>{bounty.list_coordinate}</Link>
        </div>

        {isOpen && (
          <div style={{ marginTop: '0.9rem' }}>
            <Link
              to={addItemHref}
              style={{ display: 'inline-block', padding: '0.5rem 1rem', background: '#1f6feb', color: '#fff', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}
            >
              + Submit an item to this list →
            </Link>
            <div style={{ fontSize: '0.78rem', opacity: 0.55, marginTop: '0.35rem' }}>
              Add a list item to claim this bounty. It appears below once you’re trusted by the issuer at rank ≥ 2.
            </div>
          </div>
        )}
      </div>

      <h2 style={{ fontSize: '1.2rem', marginTop: '1.5rem' }}>Claims ({claims.length})</h2>
      {claims.length === 0 && (
        <p style={{ opacity: 0.6 }}>
          No claims yet. Trusted contributors submitting list items will appear here.{' '}
          <Link to={addItemHref}>Add an item →</Link>
        </p>
      )}
      {claims.map(c => (
        <ClaimRow key={c.event.id} claim={c} bounty={bounty} onZap={onZap} />
      ))}
    </div>
  );
}
