import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import Bolt12Setup from '../../components/Bolt12Setup';
import { useAuth } from '../../context/AuthContext';
import { getPaymentsToMe } from '../../api/bounties';

function short(pk) { return pk ? pk.slice(0, 8) + '…' : '—'; }
function age(ts) {
  if (!ts) return '—';
  const d = Date.now() / 1000 - ts;
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}
function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

const TAG_BASE = {
  display: 'inline-block',
  padding: '0.1rem 0.5rem',
  borderRadius: 3,
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.03em',
};
const TAG_PAST_DUE = { ...TAG_BASE, background: '#5a1d1d', color: '#ffb4b4', border: '1px solid #8a2a2a' };
const TAG_PAID = { ...TAG_BASE, background: '#0f3a1d', color: '#7ee2a8', border: '1px solid #1c5a31' };
const TAG_CLOSED = { ...TAG_BASE, background: '#2a2a2a', color: '#9aa0a6', border: '1px solid #444' };

function PaidReceiptCopy({ eventId }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(eventId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable; fail silently
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        padding: '0.2rem 0.55rem',
        background: 'transparent',
        color: '#9aa0a6',
        border: '1px solid #30363d',
        borderRadius: 4,
        fontSize: '0.7rem',
        fontFamily: 'monospace',
        cursor: 'pointer',
      }}
      title="Copy zap receipt event id"
    >
      {copied ? 'copied' : `copy receipt id`}
    </button>
  );
}

function Row({ entry, kind }) {
  const { bounty, claim } = entry;
  const detailHref = `/tapestry/bounties/${bounty.id}`;

  return (
    <div style={{ padding: '0.75rem', background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, marginBottom: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '0.25rem' }}>
            <Link to={detailHref} title={bounty.criteria} style={{ fontWeight: 700, color: '#58a6ff' }}>
              {bounty.criteria.slice(0, 80)}
            </Link>
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.55, fontFamily: 'monospace', marginBottom: '0.25rem' }}>
            {bounty.list_coordinate}
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
            from <code>{short(bounty.issuer_pubkey)}</code>
            <span style={{ marginLeft: '0.5rem' }}>· claimed {age(claim.event.created_at)}</span>
            {kind === 'pastDue' && bounty.expiration && (
              <span style={{ marginLeft: '0.5rem' }}>· expired {fmtDate(bounty.expiration)}</span>
            )}
          </div>
          <div style={{ marginTop: '0.4rem' }}>
            {kind === 'pastDue' && <span style={TAG_PAST_DUE}>expired without payment</span>}
            {kind === 'paid' && <span style={TAG_PAID}>paid</span>}
            {kind === 'closed' && <span style={TAG_CLOSED}>bounty paid to another contributor</span>}
            {kind === 'paid' && claim.zapReceipt?.id && (
              <span style={{ marginLeft: '0.5rem' }}>
                <PaidReceiptCopy eventId={claim.zapReceipt.id} />
              </span>
            )}
          </div>
        </div>
        <div style={{ color: '#f2a134', fontWeight: 700, whiteSpace: 'nowrap' }}>
          {bounty.amount_sats.toLocaleString()} sats
        </div>
      </div>
    </div>
  );
}

function Section({ title, description, kind, items, emptyText }) {
  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>
        {title} <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.85rem' }}>({items.length})</span>
      </h2>
      {description && <p style={{ opacity: 0.6, fontSize: '0.85rem', marginTop: 0, marginBottom: '0.5rem' }}>{description}</p>}
      {items.length === 0
        ? <p style={{ opacity: 0.5, fontSize: '0.85rem', fontStyle: 'italic' }}>{emptyText}</p>
        : items.map((entry, i) => <Row key={`${entry.bounty.id}:${entry.claim.event.id}:${i}`} entry={entry} kind={kind} />)
      }
    </section>
  );
}

export default function PaymentsToMe() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState({ pastDue: [], pending: [], paid: [], closed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    getPaymentsToMe()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading || !user?.pubkey) return;
    refresh();
  }, [authLoading, user?.pubkey, refresh]);

  if (authLoading) return <div className="page"><Breadcrumbs /><p>Loading…</p></div>;
  if (!user?.pubkey) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>Payments to Me</h1>
        <p style={{ opacity: 0.7 }}>Sign in to see bounties owed to you.</p>
      </div>
    );
  }

  const { pastDue, pending, paid, closed } = data;

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>Payments to Me</h1>
      <p style={{ opacity: 0.7 }}>
        Bounty claims you've submitted, grouped by payment status.
      </p>
      <Bolt12Setup pubkey={user.pubkey} />

      {loading && <p>Loading…</p>}
      {error && <p className="error" style={{ color: '#f85149' }}>Error: {error}</p>}

      {!loading && !error && (
        <>
          <Section
            title="Past-Due"
            description="Bounties whose deadline passed without payment to you."
            kind="pastDue"
            items={pastDue}
            emptyText="No past-due payments — issuers have either paid or the bounties haven't expired."
          />
          <Section
            title="Pending"
            description="Claims awaiting payment from the issuer."
            kind="pending"
            items={pending}
            emptyText="No pending claims. Submit a claim from the Eligibility page to start earning."
          />
          <Section
            title="Paid"
            description="Claims the issuer has zapped."
            kind="paid"
            items={paid}
            emptyText="No payments yet."
          />
          <Section
            title="Closed (paid to someone else)"
            description="Bounties that were paid to a different contributor; your claim wasn't selected."
            kind="closed"
            items={closed}
            emptyText="No closed bounties."
          />
        </>
      )}
    </div>
  );
}
