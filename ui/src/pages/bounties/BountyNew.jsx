import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import { useAuth } from '../../context/AuthContext';
import { createBounty } from '../../api/bounties';
import { queryRelay } from '../../api/relay';
import { parseBountyToml, buildClaudePrompt, buildClaudeDeepLink } from '../../lib/bountyToml';

const COORDINATE_RE = /^\d+:[0-9a-f]{64}:.+$/;

const inputStyle = {
  width: '100%', padding: '0.5rem', background: '#0d1117',
  border: '1px solid #30363d', borderRadius: 4, color: '#c9d1d9',
};

function getTag(event, name, index = 1) {
  const tag = event.tags?.find(t => t[0] === name);
  return tag ? tag[index] : null;
}

/** Unix seconds -> a value the datetime-local input understands (local time). */
function unixToLocalInput(sec) {
  if (!sec) return '';
  const d = new Date(sec * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function shortCoordinate(coord) {
  const parts = coord.split(':');
  if (parts.length < 3) return coord;
  const [kind, pk, ...rest] = parts;
  return `${kind}:${pk.slice(0, 8)}…:${rest.join(':')}`;
}

export default function BountyNew() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [listCoordinate, setListCoordinate] = useState(params.get('concept') || '');
  const [amountSats, setAmountSats] = useState(1000);
  const [bountyCapSats, setBountyCapSats] = useState(1000);
  const [rewardPerItem, setRewardPerItem] = useState(false);
  const [maxRewardsPerNpub, setMaxRewardsPerNpub] = useState('');
  const [criteria, setCriteria] = useState('');
  const [expiration, setExpiration] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Claude/TOML drop-in state
  const [myLists, setMyLists] = useState([]);
  const [query, setQuery] = useState('');           // plain-English request baked into the deep link
  const [tomlText, setTomlText] = useState('');
  const [parsed, setParsed] = useState(null);        // { bounties, errors } from the last Load
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState(null); // [{ coordinate, status, id?, error? }]

  useEffect(() => {
    if (!authLoading && !user?.pubkey) {
      navigate('/', { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Load the signed-in user's addressable (kind 39998) lists for the Claude prompt.
  // Only 39998 lists have a kind:pubkey:d-tag coordinate a bounty can target.
  useEffect(() => {
    if (!user?.pubkey) return;
    let cancelled = false;
    (async () => {
      try {
        const events = await queryRelay({ kinds: [39998], authors: [user.pubkey] });
        if (cancelled) return;
        const lists = events
          .map(ev => {
            const dTag = getTag(ev, 'd');
            if (!dTag) return null;
            const name = getTag(ev, 'names', 1) || getTag(ev, 'name', 1) || '(unnamed)';
            return { coordinate: `39998:${ev.pubkey}:${dTag}`, name, created_at: ev.created_at || 0 };
          })
          .filter(Boolean)
          .sort((a, b) => b.created_at - a.created_at);
        setMyLists(lists);
      } catch {
        // Non-fatal: the prompt just won't list your coordinates.
        if (!cancelled) setMyLists([]);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const prompt = buildClaudePrompt(myLists, query);
  const deepLink = buildClaudeDeepLink(prompt);

  const amount = Number(amountSats);
  const cap = Number(bountyCapSats);
  const maxRewards = Number(maxRewardsPerNpub);
  const valid = COORDINATE_RE.test(listCoordinate)
    && Number.isInteger(amount) && amount > 0
    && Number.isInteger(cap) && cap >= amount
    && (!rewardPerItem || maxRewardsPerNpub === '' || (Number.isInteger(maxRewards) && maxRewards > 0))
    && criteria.trim().length > 0;

  function handleAmountChange(value) {
    setAmountSats(value);
    const nextAmount = Number(value);
    const currentCap = Number(bountyCapSats);
    if (Number.isInteger(nextAmount) && nextAmount > 0 && Number.isInteger(currentCap) && currentCap < nextAmount) {
      setBountyCapSats(value);
    }
  }

  function prefillForm(b) {
    setListCoordinate(b.listCoordinate);
    setAmountSats(b.amountSats);
    setBountyCapSats(b.bountyCapSats);
    setRewardPerItem(b.rewardPerItem);
    setMaxRewardsPerNpub(b.maxRewardsPerNpub ?? '');
    setCriteria(b.criteria);
    setExpiration(unixToLocalInput(b.expiration));
    setError(null);
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function handleLoadToml() {
    setPublishResults(null);
    const result = parseBountyToml(tomlText);
    setParsed(result);
    // One clean bounty -> prefill the form below for review. Several -> review table.
    if (result.errors.length === 0 && result.bounties.length === 1) {
      prefillForm(result.bounties[0]);
    }
  }

  async function handlePublishAll() {
    if (!parsed?.bounties?.length) return;
    setPublishing(true);
    const results = [];
    for (const b of parsed.bounties) {
      try {
        const row = await createBounty(b);
        results.push({ coordinate: b.listCoordinate, status: 'ok', id: row.id });
      } catch (err) {
        results.push({ coordinate: b.listCoordinate, status: 'error', error: err.message });
      }
      setPublishResults([...results]);
    }
    setPublishing(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const row = await createBounty({
        listCoordinate,
        amountSats: amount,
        bountyCapSats: cap,
        rewardPerItem,
        maxRewardsPerNpub: rewardPerItem && maxRewardsPerNpub !== '' ? maxRewards : undefined,
        criteria: criteria.trim(),
        expiration: expiration ? Math.floor(new Date(expiration).getTime() / 1000) : undefined,
      });
      navigate(`/tapestry/bounties/${row.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const listName = (coord) => myLists.find(l => l.coordinate === coord)?.name;
  const multi = parsed && parsed.errors.length === 0 && parsed.bounties.length > 1;
  const single = parsed && parsed.errors.length === 0 && parsed.bounties.length === 1;

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>New Bounty</h1>
      <p style={{ opacity: 0.7 }}>
        Attach a bounty to a list — anyone Alice trusts (rank ≥ 2) will see it on their eligibility dashboard
        and can submit items to earn sats.
      </p>

      {/* ── Set up with Claude (paste TOML) ─────────────────────────────── */}
      <details open style={{
        maxWidth: 600, marginBottom: '1.5rem', padding: '1rem',
        background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
      }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          ⚡ Set up with Claude — describe it, paste the TOML
        </summary>
        <p style={{ opacity: 0.7, fontSize: '0.9rem', marginTop: '0.75rem' }}>
          Describe the bounty you want, open Claude pre-loaded with your lists and your request,
          then paste the <code>toml</code> it gives back and hit Load. Set up several at once with
          multiple <code>[[bounty]]</code> tables.
        </p>

        {/* Step 1 — describe it, then send it to Claude */}
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.75rem' }}>1. Describe it</div>
        <textarea
          rows={2}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. a bounty on my kettlebell routines list, 500 sats each, cap 5000, max 3 per person"
          style={{ ...inputStyle, marginTop: '0.35rem' }}
        />
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', margin: '0.6rem 0' }}>
          <a
            href={deepLink}
            target="_blank"
            rel="noreferrer"
            style={{ padding: '0.5rem 1rem', background: '#1f6feb', color: '#fff', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}
          >
            Draft with Claude ↗
          </a>
          <button
            type="button"
            onClick={handleCopyPrompt}
            style={{ padding: '0.5rem 1rem', background: '#30363d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, cursor: 'pointer' }}
          >
            {copied ? 'Copied ✓' : 'Copy prompt'}
          </button>
          <span style={{ alignSelf: 'center', fontSize: '0.8rem', opacity: 0.6 }}>
            {myLists.length} of your lists included
          </span>
        </div>

        {/* Step 2 — paste back what Claude gives you */}
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.5rem' }}>2. Paste Claude’s TOML</div>
        <textarea
          rows={6}
          value={tomlText}
          onChange={e => setTomlText(e.target.value)}
          placeholder={'Paste the ```toml block Claude gives you here…'}
          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.85rem', marginTop: '0.35rem' }}
        />
        <div style={{ marginTop: '0.6rem' }}>
          <button
            type="button"
            onClick={handleLoadToml}
            disabled={!tomlText.trim()}
            style={{ padding: '0.5rem 1rem', background: tomlText.trim() ? '#238636' : '#30363d', color: '#fff', border: 'none', borderRadius: 4, cursor: tomlText.trim() ? 'pointer' : 'not-allowed' }}
          >
            Load
          </button>
        </div>

        {parsed?.errors?.length > 0 && (
          <ul style={{ color: '#f85149', marginTop: '0.75rem', fontSize: '0.9rem' }}>
            {parsed.errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        )}

        {single && (
          <p style={{ color: '#3fb950', marginTop: '0.75rem', fontSize: '0.9rem' }}>
            Loaded 1 bounty into the form below — review it and hit Publish Bounty.
          </p>
        )}

        {multi && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
              {parsed.bounties.length} bounties ready — review, then publish all:
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', opacity: 0.7 }}>
                    <th style={{ padding: '0.3rem 0.5rem' }}>List</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Reward</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Cap</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Per item</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Criteria</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.bounties.map((b, i) => {
                    const result = publishResults?.[i];
                    return (
                      <tr key={i} style={{ borderTop: '1px solid #30363d' }}>
                        <td style={{ padding: '0.3rem 0.5rem' }} title={b.listCoordinate}>
                          {listName(b.listCoordinate) || shortCoordinate(b.listCoordinate)}
                        </td>
                        <td style={{ padding: '0.3rem 0.5rem' }}>{b.amountSats}</td>
                        <td style={{ padding: '0.3rem 0.5rem' }}>{b.bountyCapSats}</td>
                        <td style={{ padding: '0.3rem 0.5rem' }}>
                          {b.rewardPerItem ? (b.maxRewardsPerNpub ? `≤${b.maxRewardsPerNpub}` : 'yes') : 'no'}
                        </td>
                        <td style={{ padding: '0.3rem 0.5rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.criteria}>
                          {b.criteria}
                        </td>
                        <td style={{ padding: '0.3rem 0.5rem' }}>
                          {!result && '—'}
                          {result?.status === 'ok' && (
                            <Link to={`/tapestry/bounties/${result.id}`} style={{ color: '#3fb950' }}>published ✓</Link>
                          )}
                          {result?.status === 'error' && (
                            <span style={{ color: '#f85149' }} title={result.error}>failed ✗</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handlePublishAll}
                disabled={publishing}
                style={{ padding: '0.6rem 1.2rem', background: publishing ? '#30363d' : '#1f6feb', color: '#fff', border: 'none', borderRadius: 4, cursor: publishing ? 'not-allowed' : 'pointer' }}
              >
                {publishing ? 'Publishing…' : `Publish all ${parsed.bounties.length}`}
              </button>
              {publishResults && !publishing && (
                <Link to="/tapestry/bounties" style={{ color: '#58a6ff' }}>Go to All Bounties →</Link>
              )}
            </div>
            {publishResults && !publishing && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.8 }}>
                {publishResults.filter(r => r.status === 'ok').length} published,{' '}
                {publishResults.filter(r => r.status === 'error').length} failed.
              </p>
            )}
          </div>
        )}
      </details>

      <p style={{ maxWidth: 600, textAlign: 'center', opacity: 0.5, fontSize: '0.85rem', margin: '0 0 1rem' }}>
        — or fill it in manually —
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
            style={{ ...inputStyle, fontFamily: 'monospace' }}
          />
          <small style={{ opacity: 0.6 }}>a-tag format: kind:pubkey:d-tag</small>
        </label>

        <label>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Base reward (sats)</div>
          <input
            type="number"
            min={1}
            step={1}
            value={amountSats}
            onChange={e => handleAmountChange(e.target.value)}
            required
            style={inputStyle}
          />
        </label>

        <label>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Bounty cap (sats)</div>
          <input
            type="number"
            min={amount || 1}
            step={1}
            value={bountyCapSats}
            onChange={e => setBountyCapSats(e.target.value)}
            required
            style={inputStyle}
          />
          <small style={{ opacity: 0.6 }}>Total sats available before this bounty closes.</small>
        </label>

        <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <input
            type="checkbox"
            checked={rewardPerItem}
            onChange={e => setRewardPerItem(e.target.checked)}
            style={{ marginTop: '0.2rem' }}
          />
          <span>
            <span style={{ display: 'block', fontWeight: 600 }}>Reward each item</span>
            <small style={{ opacity: 0.6 }}>Off means at most one base reward per contributor.</small>
          </span>
        </label>

        {rewardPerItem && (
          <label>
            <div style={{ marginBottom: 4, fontWeight: 600 }}>Max rewards per contributor (optional)</div>
            <input
              type="number"
              min={1}
              step={1}
              value={maxRewardsPerNpub}
              onChange={e => setMaxRewardsPerNpub(e.target.value)}
              style={inputStyle}
            />
          </label>
        )}

        <label>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Criteria</div>
          <textarea
            rows={4}
            value={criteria}
            onChange={e => setCriteria(e.target.value)}
            placeholder="What kind of contributions earn the bounty? e.g. 'Names of sleepy dwarfs in English folklore.'"
            required
            style={inputStyle}
          />
        </label>

        <label>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Expiration (optional)</div>
          <input
            type="datetime-local"
            value={expiration}
            onChange={e => setExpiration(e.target.value)}
            style={{ ...inputStyle, width: 'auto' }}
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
