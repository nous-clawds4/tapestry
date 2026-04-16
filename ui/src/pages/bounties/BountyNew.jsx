import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import { useAuth } from '../../context/AuthContext';
import { createBounty } from '../../api/bounties';

const COORDINATE_RE = /^\d+:[0-9a-f]{64}:.+$/;

export default function BountyNew() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [listCoordinate, setListCoordinate] = useState(params.get('concept') || '');
  const [amountSats, setAmountSats] = useState(1000);
  const [criteria, setCriteria] = useState('');
  const [expiration, setExpiration] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !user?.pubkey) {
      navigate('/', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const valid = COORDINATE_RE.test(listCoordinate)
    && Number.isInteger(Number(amountSats)) && Number(amountSats) > 0
    && criteria.trim().length > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const row = await createBounty({
        listCoordinate,
        amountSats: Number(amountSats),
        criteria: criteria.trim(),
        expiration: expiration ? Math.floor(new Date(expiration).getTime() / 1000) : undefined,
      });
      navigate(`/tapestry/bounties/${row.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>New Bounty</h1>
      <p style={{ opacity: 0.7 }}>
        Attach a bounty to a list — anyone Alice trusts (rank ≥ 2) will see it on their eligibility dashboard
        and can submit items to earn sats.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', maxWidth: 600 }}>
        <label>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Target list coordinate</div>
          <input
            type="text"
            value={listCoordinate}
            onChange={e => setListCoordinate(e.target.value)}
            placeholder="39998:&lt;curator-pubkey&gt;:&lt;d-tag&gt;"
            required
            style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace', background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#c9d1d9' }}
          />
          <small style={{ opacity: 0.6 }}>a-tag format: kind:pubkey:d-tag</small>
        </label>

        <label>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Reward (sats)</div>
          <input
            type="number"
            min={1}
            step={1}
            value={amountSats}
            onChange={e => setAmountSats(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#c9d1d9' }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Criteria</div>
          <textarea
            rows={4}
            value={criteria}
            onChange={e => setCriteria(e.target.value)}
            placeholder="What kind of contributions earn the bounty? e.g. 'Names of sleepy dwarfs in English folklore.'"
            required
            style={{ width: '100%', padding: '0.5rem', background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#c9d1d9' }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Expiration (optional)</div>
          <input
            type="datetime-local"
            value={expiration}
            onChange={e => setExpiration(e.target.value)}
            style={{ padding: '0.5rem', background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#c9d1d9' }}
          />
        </label>

        {error && <div className="error" style={{ color: '#f85149' }}>{error}</div>}

        <div>
          <button
            type="submit"
            disabled={!valid || submitting}
            style={{ padding: '0.6rem 1.2rem', background: valid && !submitting ? '#1f6feb' : '#30363d', color: '#fff', border: 'none', borderRadius: 4, cursor: valid && !submitting ? 'pointer' : 'not-allowed' }}
          >
            {submitting ? 'Publishing…' : 'Publish Bounty'}
          </button>
        </div>
      </form>
    </div>
  );
}
