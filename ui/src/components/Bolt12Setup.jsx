import { useEffect, useState } from 'react';

const HELP = (
  <span>
    Paste your BOLT12 offer to start receiving zaps without an LNURL/Lightning-address server.
    {' '}<a href="https://phoenix.acinq.co/" target="_blank" rel="noreferrer" style={{ color: '#58a6ff' }}>Phoenix wallet</a>{' '}
    is the easiest source — its receive screen exports a unified URI like
    {' '}<code>bitcoin:?lno=lno1...</code>{' '}
    which you can paste here as-is. Bare <code>lno1...</code> offers and
    {' '}<code>lightning:lno1...</code> URIs also work.
  </span>
);

async function fetchProfile(pubkey) {
  const resp = await fetch(`/api/profiles?pubkeys=${pubkey}`);
  if (!resp.ok) return null;
  const payload = await resp.json();
  const profiles = payload?.profiles ?? payload;
  return Array.isArray(profiles) ? profiles[0] : profiles?.[pubkey] ?? null;
}

async function publishKind0(content) {
  if (!window.nostr) throw new Error('No NIP-07 signer (nos2x / Alby) detected');
  const pubkey = await window.nostr.getPublicKey();
  const unsigned = {
    kind: 0,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify(content),
  };
  const signed = await window.nostr.signEvent(unsigned);
  const resp = await fetch('/api/strfry/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: signed, signAs: 'client' }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.success === false) throw new Error(data.error || `publish failed (${resp.status})`);
  return signed;
}

function looksLikeBolt12(value) {
  if (!value || typeof value !== 'string') return false;
  return /lno1[a-z0-9]{8,}/i.test(value.trim());
}

export default function Bolt12Setup({ pubkey }) {
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  const [profile, setProfile] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [savedJustNow, setSavedJustNow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchProfile(pubkey)
      .then(p => {
        if (cancelled) return;
        setProfile(p);
        const existing = p?.bolt12 ?? p?.lud12 ?? p?.lightning_offer ?? '';
        setDraft(existing);
        setCollapsed(!!existing);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pubkey]);

  async function handleSave() {
    setError(null);
    const trimmed = draft.trim();
    if (trimmed && !looksLikeBolt12(trimmed)) {
      setError('That doesn\'t contain a BOLT12 offer (expected lno1…, lightning:lno1…, or bitcoin:?lno=lno1…).');
      return;
    }
    setBusy(true);
    try {
      const merged = { ...(profile || {}) };
      if (trimmed) merged.bolt12 = trimmed;
      else delete merged.bolt12;
      // Strip server-derived metadata that we shouldn't republish
      delete merged.pubkey;
      delete merged.created_at;
      delete merged.id;
      await publishKind0(merged);
      setProfile(merged);
      setSavedJustNow(true);
      setCollapsed(true);
      setTimeout(() => setSavedJustNow(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  const existing = profile?.bolt12 ?? profile?.lud12 ?? profile?.lightning_offer ?? null;
  const lud16 = profile?.lud16 ?? profile?.lud06 ?? null;
  const hasMethod = !!(existing || lud16);

  if (collapsed && !error && !savedJustNow) {
    return (
      <div style={{ padding: '0.5rem 0.75rem', background: '#161b22', border: `1px solid ${hasMethod ? '#30363d' : '#5a3a1d'}`, borderRadius: 4, marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ opacity: 0.85 }}>
          {existing
            ? <>BOLT12 offer set ✓ <code style={{ opacity: 0.6, fontSize: '0.7rem', marginLeft: 6 }}>{existing.slice(0, 24)}…</code></>
            : lud16
              ? <>Lightning address: <code>{lud16}</code> · no BOLT12 offer set</>
              : <>No Lightning receiving configured. Issuers can\'t pay you.</>
          }
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          style={{ padding: '0.25rem 0.65rem', background: '#1f6feb', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' }}
        >
          {existing ? 'Update BOLT12' : 'Set BOLT12 offer'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '0.85rem', background: '#161b22', border: '1px solid #30363d', borderRadius: 4, marginBottom: '1rem' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Set your BOLT12 offer</div>
      <div style={{ fontSize: '0.8rem', opacity: 0.75, marginBottom: '0.6rem', lineHeight: 1.4 }}>{HELP}</div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={3}
        placeholder="bitcoin:?lno=lno1..."
        style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem', background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, padding: 6, resize: 'vertical' }}
      />
      <div style={{ marginTop: 6, display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          style={{ padding: '0.35rem 0.8rem', background: busy ? '#30363d' : '#2ea043', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.8rem', cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? 'Publishing…' : draft.trim() ? 'Save & publish' : 'Clear & publish'}
        </button>
        <button
          type="button"
          onClick={() => { setCollapsed(true); setError(null); }}
          disabled={busy}
          style={{ padding: '0.35rem 0.8rem', background: 'transparent', color: '#9aa0a6', border: '1px solid #30363d', borderRadius: 4, fontSize: '0.8rem', cursor: 'pointer' }}
        >
          Cancel
        </button>
        {savedJustNow && <span style={{ color: '#7ee2a8', fontSize: '0.8rem' }}>✓ Published</span>}
      </div>
      {error && <div style={{ color: '#f85149', fontSize: '0.8rem', marginTop: 6 }}>{error}</div>}
    </div>
  );
}
