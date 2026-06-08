import { useEffect, useState, useCallback } from 'react';
import { getOptions, probe as probeReceiving, build as buildReceiving } from '../api/receiving';

/**
 * ReceivingSetup — pick how you get paid for bounty claims (LNURL-only).
 *
 * Catalog → optional probe ("is this tracked?") → Save & publish. The server
 * merges the chosen method into your own kind-0 with REPLACE semantics (clearing
 * any stale receiving field, including a legacy BOLT12 offer) and returns the
 * unsigned content; we sign it with window.nostr and publish to local strfry +
 * profile relays via /api/strfry/publish.
 *
 * Lives on /settings (BrainstormSettings). A compact read-only ReceivingStatusBanner
 * is exported for Payments-to-Me.
 */

/* ── shared helpers ─────────────────────────────────────── */

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

const LEGACY_BOLT12_FIELDS = ['bolt12', 'lud12', 'lightning_offer'];

/**
 * Describe the active receiving method from a kind-0 profile, LNURL-only:
 * a real lud16 address wins, then an LNURL code (lud06 / mis-placed lud16),
 * then a legacy bolt12 offer reported as unsupported.
 */
function describeActive(profile) {
  if (!profile) return { kind: 'none' };
  const looksLnurl = v => typeof v === 'string' && /^(lightning:)?lnurl1[0-9a-z]+$/i.test(v.trim());
  const lud16 = profile.lud16;
  if (lud16 && !looksLnurl(lud16) && /@/.test(lud16)) return { kind: 'address', value: lud16.trim() };
  const lnurl = [profile.lud06, profile.lud16].find(looksLnurl);
  if (lnurl) return { kind: 'lnurl', value: lnurl.trim() };
  const legacy = LEGACY_BOLT12_FIELDS.map(f => profile[f]).find(Boolean);
  if (legacy) return { kind: 'bolt12-legacy', value: String(legacy).slice(0, 28) + '…' };
  return { kind: 'none' };
}

function activeSummary(active) {
  switch (active.kind) {
    case 'address': return { text: `Lightning address: ${active.value}`, tone: 'ok' };
    case 'lnurl': return { text: `LNURL-pay code set (tracked only if it allows Nostr zaps)`, tone: 'warn' };
    case 'bolt12-legacy': return { text: `Legacy BOLT12 offer — no longer supported. Set a Lightning address below.`, tone: 'bad' };
    default: return { text: `No receiving method set — issuers can't pay you.`, tone: 'bad' };
  }
}

/* ── tracked badge ──────────────────────────────────────── */

function TrackedBadge({ tracked }) {
  let bg, border, color, label;
  if (tracked === true) { bg = '#0f3a1d'; border = '#1c5a31'; color = '#7ee2a8'; label = 'tracked'; }
  else if (tracked === 'depends') { bg = '#0d2f3a'; border = '#1c4a5a'; color = '#7ed0e2'; label = 'depends — probe it'; }
  else { bg = '#3a2d0f'; border = '#5a3a1d'; color = '#f2d08a'; label = 'untracked'; }
  return (
    <span style={{ padding: '0.05rem 0.4rem', borderRadius: 3, fontSize: '0.65rem', fontWeight: 600, background: bg, border: `1px solid ${border}`, color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

/* ── main editor ────────────────────────────────────────── */

export default function ReceivingSetup({ pubkey }) {
  const [options, setOptions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState(null);
  const [value, setValue] = useState('');

  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState(null); // { verdict, probe }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null); // { field, value, cleared }

  const reloadProfile = useCallback(() => {
    if (!pubkey) return;
    fetchProfile(pubkey).then(setProfile).catch(() => {});
  }, [pubkey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getOptions().catch(() => []), fetchProfile(pubkey).catch(() => null)])
      .then(([opts, prof]) => {
        if (cancelled) return;
        setOptions(opts);
        setProfile(prof);
        const def = opts.find(o => o.isDefault) || opts[0];
        if (def) setSelectedId(def.id);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pubkey]);

  const selected = options.find(o => o.id === selectedId) || null;
  const needsValue = !!selected?.needsValue;

  // Reset transient state when switching methods.
  function chooseMethod(id) {
    setSelectedId(id);
    setValue('');
    setProbeResult(null);
    setError(null);
    setSaved(null);
  }

  async function handleProbe() {
    setError(null);
    setProbeResult(null);
    const v = value.trim();
    if (!v) { setError('Enter your Lightning address or LNURL first.'); return; }
    setProbing(true);
    try {
      const r = await probeReceiving(v);
      setProbeResult(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setProbing(false);
    }
  }

  async function handleSave() {
    setError(null);
    setSaved(null);
    if (needsValue && !value.trim()) { setError('Enter a value for this method.'); return; }
    setSaving(true);
    try {
      const built = await buildReceiving({ method: selectedId, value: needsValue ? value.trim() : undefined });
      await publishKind0(built.content);
      setSaved({ field: built.field, value: built.value, cleared: built.cleared });
      setValue('');
      setProbeResult(null);
      reloadProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ opacity: 0.6, fontSize: '0.85rem' }}>Loading receiving options…</div>;

  const active = describeActive(profile);
  const summary = activeSummary(active);
  const summaryColor = summary.tone === 'ok' ? '#7ee2a8' : summary.tone === 'warn' ? '#f2d08a' : '#ffb4b4';

  return (
    <div style={{ fontSize: '0.9rem' }}>
      {/* Current status */}
      <div style={{ padding: '0.5rem 0.75rem', background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, marginBottom: '0.85rem', color: summaryColor, fontSize: '0.85rem' }}>
        {summary.text}
      </div>

      {/* Catalog */}
      <div style={{ display: 'grid', gap: '0.4rem', marginBottom: '0.85rem' }}>
        {options.map(o => {
          const isSel = o.id === selectedId;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => chooseMethod(o.id)}
              style={{
                textAlign: 'left', padding: '0.55rem 0.7rem', borderRadius: 4, cursor: 'pointer',
                background: isSel ? '#13233b' : '#161b22',
                border: `1px solid ${isSel ? '#1f6feb' : '#30363d'}`,
                color: '#c9d1d9', fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>
                  {o.label}{o.isDefault ? <span style={{ opacity: 0.55, fontWeight: 400 }}> · default</span> : null}
                </span>
                <TrackedBadge tracked={o.tracked} />
              </div>
              {o.note && <div style={{ fontSize: '0.72rem', opacity: 0.6, marginTop: 3, lineHeight: 1.35 }}>{o.note}</div>}
            </button>
          );
        })}
      </div>

      {/* Value input + probe (for value-bearing methods) */}
      {selected && needsValue && (
        <div style={{ marginBottom: '0.6rem' }}>
          <input
            type="text"
            value={value}
            onChange={e => { setValue(e.target.value); setProbeResult(null); }}
            placeholder={selected.field === 'lud06' ? 'lnurl1…' : 'name@domain.com'}
            spellCheck={false}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem', background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, padding: '0.45rem 0.55rem', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 6 }}>
            <button
              type="button"
              onClick={handleProbe}
              disabled={probing || !value.trim()}
              style={{ padding: '0.3rem 0.7rem', background: 'transparent', color: '#9aa0a6', border: '1px solid #30363d', borderRadius: 4, fontSize: '0.78rem', cursor: probing ? 'wait' : 'pointer' }}
            >
              {probing ? 'Checking…' : 'Check'}
            </button>
            {probeResult && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
                <TrackedBadge tracked={probeResult.verdict?.tracked === true ? true : (probeResult.verdict?.tracked === null ? 'depends' : false)} />
                <span style={{ opacity: 0.75 }}>{probeResult.verdict?.note}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {selected && !needsValue && (
        <div style={{ fontSize: '0.78rem', opacity: 0.7, marginBottom: '0.6rem' }}>
          Derived from your npub — no signup, nothing to type. Save to publish it to your profile.
        </div>
      )}

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !selected}
          style={{ padding: '0.4rem 0.9rem', background: saving ? '#30363d' : '#2ea043', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.82rem', fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}
        >
          {saving ? 'Publishing…' : 'Save & publish'}
        </button>
        {saved && <span style={{ color: '#7ee2a8', fontSize: '0.8rem' }}>✓ Published {saved.field} = {saved.value}</span>}
      </div>

      {saved?.cleared?.length > 0 && (
        <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 6 }}>
          cleared stale fields: {saved.cleared.join(', ')}
        </div>
      )}
      {error && <div style={{ color: '#f85149', fontSize: '0.8rem', marginTop: 8 }}>{error}</div>}
    </div>
  );
}

/* ── compact read-only banner (Payments-to-Me) ──────────── */

export function ReceivingStatusBanner({ pubkey }) {
  const [active, setActive] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!pubkey) return;
    fetchProfile(pubkey)
      .then(p => { if (!cancelled) setActive(describeActive(p)); })
      .catch(() => { if (!cancelled) setActive({ kind: 'none' }); });
    return () => { cancelled = true; };
  }, [pubkey]);

  if (!active) return null;
  const summary = activeSummary(active);
  const tone = summary.tone;
  const border = tone === 'ok' ? '#1c5a31' : tone === 'warn' ? '#5a3a1d' : '#8a2a2a';
  const color = tone === 'ok' ? '#7ee2a8' : tone === 'warn' ? '#f2d08a' : '#ffb4b4';

  return (
    <div style={{ padding: '0.5rem 0.75rem', background: '#161b22', border: `1px solid ${border}`, borderRadius: 4, marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
      <span style={{ color, opacity: 0.95 }}>{summary.text}</span>
      <a href="/settings" style={{ padding: '0.25rem 0.65rem', background: '#1f6feb', color: '#fff', borderRadius: 4, fontSize: '0.75rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
        {active.kind === 'address' ? 'Change in Settings' : 'Set up in Settings'}
      </a>
    </div>
  );
}
