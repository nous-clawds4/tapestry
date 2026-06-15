import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import { childDTag, randomDTag } from '../../utils/dtag';
import { getBounty } from '../../api/bounties';
import { capText, maxRewardsText, rewardText } from '../../utils/bountyTerms';
import { parseItemToml, buildItemClaudePrompt, buildClaudeDeepLink } from '../../lib/listItemToml';

const dropInInputStyle = {
  width: '100%', padding: '0.5rem', background: '#0d1117',
  border: '1px solid #30363d', borderRadius: 4, color: '#c9d1d9',
};

function getTag(event, name, index = 1) {
  const tag = event.tags?.find(t => t[0] === name);
  return tag ? tag[index] : null;
}

function getAllTags(event, name) {
  return event.tags?.filter(t => t[0] === name).map(t => t[1]) || [];
}

export default function NewDListItem() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { event: parentEvent } = useOutletContext();
  const [searchParams] = useSearchParams();
  const bountyId = searchParams.get('bounty');
  const [bountyInfo, setBountyInfo] = useState(null);

  useEffect(() => {
    if (!bountyId) return;
    let cancelled = false;
    getBounty(bountyId)
      .then(payload => { if (!cancelled) setBountyInfo(payload); })
      .catch(() => { /* silent; banner just won't render */ });
    return () => { cancelled = true; };
  }, [bountyId]);

  // Derive parent list info
  const parentName = getTag(parentEvent, 'names', 1) || getTag(parentEvent, 'name', 1) || '(unnamed)';
  const dTag = getTag(parentEvent, 'd');
  const parentRef = parentEvent.kind === 39998
    ? `${parentEvent.kind}:${parentEvent.pubkey}:${dTag}`
    : parentEvent.id;

  // Extract property tag definitions from parent
  const requiredProps = getAllTags(parentEvent, 'required');
  const optionalProps = getAllTags(parentEvent, 'optional');
  const recommendedProps = getAllTags(parentEvent, 'recommended');

  // All defined properties with their requirement level
  const propertyDefs = useMemo(() => {
    const defs = [];
    for (const p of requiredProps) defs.push({ name: p, requirement: 'required' });
    for (const p of recommendedProps) defs.push({ name: p, requirement: 'recommended' });
    for (const p of optionalProps) defs.push({ name: p, requirement: 'optional' });
    return defs;
  }, [requiredProps, optionalProps, recommendedProps]);

  // Form state
  const [name, setName] = useState('');
  const [replaceable, setReplaceable] = useState(true); // true = 39999, false = 9999
  const [signAs, setSignAs] = useState('client');
  const [showPreview, setShowPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);

  // Dynamic property values keyed by property name — initialize once from propertyDefs
  const [propValues, setPropValues] = useState(() => {
    const initial = {};
    for (const p of [...getAllTags(parentEvent, 'required'), ...getAllTags(parentEvent, 'recommended'), ...getAllTags(parentEvent, 'optional')]) {
      initial[p] = '';
    }
    return initial;
  });

  // Additional custom tags: [{ key, value }]
  const [customTags, setCustomTags] = useState([]);
  const [newCustomKey, setNewCustomKey] = useState('');
  const [newCustomValue, setNewCustomValue] = useState('');

  // Claude/TOML drop-in state
  const [query, setQuery] = useState('');          // plain-English request baked into the deep link
  const [tomlText, setTomlText] = useState('');
  const [parsed, setParsed] = useState(null);       // { items, errors } from the last Load
  const [copied, setCopied] = useState(false);
  const [publishingAll, setPublishingAll] = useState(false);
  const [publishResults, setPublishResults] = useState(null); // [{ name, status, coord?/id?, error? }]

  // Deterministic d-tag: slug(name)-hash8(parentRef)
  const [itemDTag, setItemDTag] = useState(() => randomDTag());

  useEffect(() => {
    if (name.trim() && parentRef) {
      childDTag(name.trim(), parentRef).then(setItemDTag);
    }
  }, [name, parentRef]);

  function setPropValue(propName, value) {
    setPropValues(prev => ({ ...prev, [propName]: value }));
  }

  function addCustomTag() {
    const key = newCustomKey.trim();
    const value = newCustomValue.trim();
    if (!key) return;
    setCustomTags(prev => [...prev, { key, value }]);
    setNewCustomKey('');
    setNewCustomValue('');
  }

  function removeCustomTag(index) {
    setCustomTags(prev => prev.filter((_, i) => i !== index));
  }

  // Build an unsigned event from a descriptor: { name, replaceable, props, customTags, dTag }.
  // `props` maps canonical property names (def.name) to string values; `dTag` is only used
  // when replaceable. Shared by the live form and the multi-item publish-all path.
  function buildUnsignedEvent({ name: itemName, replaceable: rep, props, customTags: extra, dTag }) {
    const kind = rep ? 39999 : 9999;
    const tags = [];

    if (rep) tags.push(['d', dTag]);

    // Parent pointer
    tags.push(['z', parentRef]);

    // Name tag (always included)
    if (itemName) tags.push(['name', itemName]);

    // Property tags
    for (const def of propertyDefs) {
      if (def.name.toLowerCase() === 'name') continue; // handled above
      const val = props[def.name];
      if (val) tags.push([def.name.toLowerCase(), val]);
    }

    // Custom tags
    for (const ct of extra) tags.push([ct.key, ct.value]);

    return { kind, created_at: Math.floor(Date.now() / 1000), tags, content: '' };
  }

  // Live preview / single-publish event from the current form state.
  const unsignedEvent = useMemo(
    () => buildUnsignedEvent({ name, replaceable, props: propValues, customTags, dTag: itemDTag }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, replaceable, propertyDefs, propValues, customTags, parentRef, itemDTag]
  );

  // Validation
  const missingRequired = useMemo(() => {
    const missing = [];
    if (!name.trim()) missing.push('name');
    for (const def of propertyDefs) {
      if (def.requirement === 'required' && def.name.toLowerCase() !== 'name') {
        if (!propValues[def.name]?.trim()) {
          missing.push(def.name);
        }
      }
    }
    return missing;
  }, [name, propertyDefs, propValues]);

  // Sign (per the Author radio) and publish one unsigned event; returns the published event.
  async function publishEvent(unsigned) {
    let body;
    if (signAs === 'client') {
      if (!window.nostr) throw new Error('No NIP-07 extension found');
      const pubkey = await window.nostr.getPublicKey();
      const signedEvent = await window.nostr.signEvent({ ...unsigned, pubkey });
      body = { event: signedEvent, signAs: 'client' };
    } else {
      body = { event: unsigned, signAs: 'assistant' };
    }

    const res = await fetch('/api/strfry/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Publish failed');
    return data.event;
  }

  /** The route for a published item's detail page. */
  function itemDetailPath(ev) {
    if (ev.kind === 39999) {
      const d = ev.tags.find(t => t[0] === 'd')?.[1];
      return `/tapestry/lists/items/${encodeURIComponent(`39999:${ev.pubkey}:${d}`)}`;
    }
    return `/tapestry/lists/items/${encodeURIComponent(ev.id)}`;
  }

  async function handlePublish() {
    if (missingRequired.length > 0) {
      setError(`Missing required fields: ${missingRequired.join(', ')}`);
      return;
    }
    try {
      setPublishing(true);
      setError(null);
      const ev = await publishEvent(unsignedEvent);
      navigate(itemDetailPath(ev));
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  }

  // ── Claude/TOML drop-in ────────────────────────────────────────────────
  const prompt = buildItemClaudePrompt(parentName, propertyDefs, query);
  const deepLink = buildClaudeDeepLink(prompt);

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  // Prefill the manual form below from a single parsed item descriptor.
  async function prefillForm(item) {
    setName(item.name);
    setReplaceable(item.replaceable);
    setPropValues(() => {
      const next = {};
      for (const def of propertyDefs) next[def.name] = item.props[def.name] || '';
      return next;
    });
    setCustomTags(item.customTags);
    setError(null);
    if (item.replaceable) {
      setItemDTag(await childDTag(item.name, parentRef));
    }
  }

  function handleLoadToml() {
    setPublishResults(null);
    const result = parseItemToml(tomlText, propertyDefs);
    setParsed(result);
    // One clean item -> prefill the form below for review. Several -> review table.
    if (result.errors.length === 0 && result.items.length === 1) {
      prefillForm(result.items[0]);
    }
  }

  async function handlePublishAll() {
    if (!parsed?.items?.length) return;
    setPublishingAll(true);
    const results = [];
    for (const item of parsed.items) {
      try {
        const dTag = item.replaceable ? await childDTag(item.name, parentRef) : undefined;
        const unsigned = buildUnsignedEvent({ ...item, dTag });
        const ev = await publishEvent(unsigned);
        results.push({ name: item.name, status: 'ok', path: itemDetailPath(ev) });
      } catch (err) {
        results.push({ name: item.name, status: 'error', error: err.message });
      }
      setPublishResults([...results]);
    }
    setPublishingAll(false);
  }

  const single = parsed && parsed.errors.length === 0 && parsed.items.length === 1;
  const multi = parsed && parsed.errors.length === 0 && parsed.items.length > 1;

  return (
    <div className="new-dlist-item">
      {bountyInfo?.bounty && (
        <div style={{ padding: '0.9rem 1rem', background: '#1f3a55', border: '1px solid #1f6feb', borderRadius: 6, marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.85, marginBottom: '0.25rem' }}>
            💰 You're fulfilling a bounty
          </div>
          <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>
            {bountyInfo.bounty.criteria}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            Issuer: <code>{bountyInfo.bounty.issuer_pubkey.slice(0, 8)}…</code>
            {' · '}
            Reward: <strong style={{ color: '#f2a134' }}>{rewardText(bountyInfo.bounty)}</strong>
            {' · '}
            {capText(bountyInfo.bounty)}
            {maxRewardsText(bountyInfo.bounty) && ` / ${maxRewardsText(bountyInfo.bounty)}`}
            {' · '}
            The issuer (or anyone) may zap you if they approve your submission.
          </div>
        </div>
      )}
      <h2>Add Item to "{parentName}"</h2>

      {/* ── Set up with Claude (paste TOML) ───────────────────────────────── */}
      <details open style={{
        maxWidth: 640, marginBottom: '1.5rem', padding: '1rem',
        background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
      }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          ⚡ Set up with Claude — describe it, paste the TOML
        </summary>
        <p style={{ opacity: 0.7, fontSize: '0.9rem', marginTop: '0.75rem' }}>
          Describe the item you want, open Claude pre-loaded with this list’s fields and your
          request, then paste the <code>toml</code> it gives back and hit Load. Add several at
          once with multiple <code>[[item]]</code> tables.
        </p>

        {/* Step 1 — describe it, then send it to Claude */}
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.75rem' }}>1. Describe it</div>
        <textarea
          rows={2}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`e.g. add "Simple & Sinister", a beginner conditioning routine, ~30 min, one 24kg bell`}
          style={{ ...dropInInputStyle, marginTop: '0.35rem' }}
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
            {propertyDefs.filter(d => d.name.toLowerCase() !== 'name').length} field
            {propertyDefs.filter(d => d.name.toLowerCase() !== 'name').length === 1 ? '' : 's'} from this list included
          </span>
        </div>

        {/* Step 2 — paste back what Claude gives you */}
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.5rem' }}>2. Paste Claude’s TOML</div>
        <textarea
          rows={6}
          value={tomlText}
          onChange={e => setTomlText(e.target.value)}
          placeholder={'Paste the ```toml block Claude gives you here…'}
          style={{ ...dropInInputStyle, fontFamily: 'monospace', fontSize: '0.85rem', marginTop: '0.35rem' }}
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
            Loaded 1 item into the form below — review it and hit Publish Item.
          </p>
        )}

        {multi && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
              {parsed.items.length} items ready — review, then publish all (signs each with your
              selected Author below):
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', opacity: 0.7 }}>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Name</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Type</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Fields</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.items.map((item, i) => {
                    const result = publishResults?.[i];
                    const filled = Object.entries(item.props).filter(([, v]) => v).map(([k]) => k);
                    return (
                      <tr key={i} style={{ borderTop: '1px solid #30363d' }}>
                        <td style={{ padding: '0.3rem 0.5rem' }}>{item.name}</td>
                        <td style={{ padding: '0.3rem 0.5rem' }}>{item.replaceable ? '39999' : '9999'}</td>
                        <td style={{ padding: '0.3rem 0.5rem', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={filled.join(', ')}>
                          {filled.length ? filled.join(', ') : '—'}
                        </td>
                        <td style={{ padding: '0.3rem 0.5rem' }}>
                          {!result && '—'}
                          {result?.status === 'ok' && (
                            <Link to={result.path} style={{ color: '#3fb950' }}>published ✓</Link>
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
                disabled={publishingAll}
                style={{ padding: '0.6rem 1.2rem', background: publishingAll ? '#30363d' : '#1f6feb', color: '#fff', border: 'none', borderRadius: 4, cursor: publishingAll ? 'not-allowed' : 'pointer' }}
              >
                {publishingAll ? 'Publishing…' : `Publish all ${parsed.items.length}`}
              </button>
              {signAs === 'client' && (
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                  one signing prompt per item
                </span>
              )}
            </div>
            {publishResults && !publishingAll && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.8 }}>
                {publishResults.filter(r => r.status === 'ok').length} published,{' '}
                {publishResults.filter(r => r.status === 'error').length} failed.
              </p>
            )}
          </div>
        )}
      </details>

      <p style={{ maxWidth: 640, textAlign: 'center', opacity: 0.5, fontSize: '0.85rem', margin: '0 0 1rem' }}>
        — or fill it in manually —
      </p>

      <div className="form-section">
        <h3>Item Type</h3>
        <div className="form-row">
          <label className="radio-label">
            <input
              type="radio"
              checked={replaceable}
              onChange={() => setReplaceable(true)}
            />
            <span>
              <strong>Replaceable</strong> (kind 39999)
              <small> — can be edited after publication</small>
            </span>
          </label>
          <label className="radio-label">
            <input
              type="radio"
              checked={!replaceable}
              onChange={() => setReplaceable(false)}
            />
            <span>
              <strong>Non-replaceable</strong> (kind 9999)
              <small> — permanent once published</small>
            </span>
          </label>
        </div>
      </div>

      <div className="form-section">
        <h3>Name <span className="field-required">required</span></h3>
        <div className="form-field">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={`e.g. an item on the "${parentName}" list`}
          />
        </div>
      </div>

      {/* D-tag preview */}
      {replaceable && name.trim() && (
        <div style={{
          padding: '0.5rem 0.75rem',
          fontSize: '0.8rem',
          backgroundColor: 'var(--bg-secondary, #1a1a2e)',
          border: '1px solid var(--border, #444)',
          borderRadius: '6px',
          marginBottom: '1rem',
        }}>
          <span style={{ opacity: 0.5 }}>d-tag: </span>
          <code style={{ color: '#58a6ff' }}>{itemDTag}</code>
        </div>
      )}

      {/* Dynamic property fields from parent list definition */}
      {propertyDefs.filter(d => d.name.toLowerCase() !== 'name').length > 0 && (
        <div className="form-section">
          <h3>Properties</h3>
          <p className="form-help">
            Fields defined by the "{parentName}" list header.
          </p>
          {propertyDefs
            .filter(d => d.name.toLowerCase() !== 'name')
            .map(def => (
              <div className="form-field" key={def.name} style={{ marginBottom: 12 }}>
                <label>
                  {def.name}
                  <span className={`field-badge field-${def.requirement}`}>
                    {def.requirement}
                  </span>
                </label>
                <input
                  type="text"
                  value={propValues[def.name] || ''}
                  onChange={e => setPropValue(def.name, e.target.value)}
                  placeholder={`${def.name}…`}
                />
              </div>
            ))}
        </div>
      )}

      {/* Custom tags */}
      <div className="form-section">
        <h3>Additional Tags</h3>
        <p className="form-help">Add any extra tags not defined by the list header.</p>

        {customTags.length > 0 && (
          <div className="tag-list">
            {customTags.map((ct, i) => (
              <div key={i} className="tag-item">
                <span className="tag-value"><strong>{ct.key}</strong>: {ct.value}</span>
                <button className="tag-remove" onClick={() => removeCustomTag(i)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="tag-add-row">
          <input
            type="text"
            value={newCustomKey}
            onChange={e => setNewCustomKey(e.target.value)}
            placeholder="tag name"
            style={{ maxWidth: 150 }}
          />
          <input
            type="text"
            value={newCustomValue}
            onChange={e => setNewCustomValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
            placeholder="tag value"
          />
          <button className="btn-secondary" onClick={addCustomTag}>Add</button>
        </div>
      </div>

      <div className="form-section">
        <h3>Author</h3>
        <div className="form-row">
          <label className="radio-label">
            <input
              type="radio"
              checked={signAs === 'client'}
              onChange={() => setSignAs('client')}
            />
            <span>
              <strong>Me</strong> (sign with NIP-07 extension)
              {user && <small> — {user.profile?.display_name || user.profile?.name || user.pubkey?.slice(0, 12) + '…'}</small>}
            </span>
          </label>
          <label className="radio-label">
            <input
              type="radio"
              checked={signAs === 'assistant'}
              onChange={() => setSignAs('assistant')}
            />
            <span>
              <strong>Tapestry Assistant</strong> (server-side signing)
            </span>
          </label>
        </div>
      </div>

      <div className="form-section">
        <button
          className="btn-secondary"
          onClick={() => setShowPreview(p => !p)}
        >
          {showPreview ? 'Hide' : 'Show'} Raw Event Preview
        </button>

        {showPreview && (
          <pre className="json-block" style={{ marginTop: 12 }}>
            {JSON.stringify(unsignedEvent, null, 2)}
          </pre>
        )}
      </div>

      <div className="form-section form-actions">
        {error && <p className="error">{error}</p>}
        <div className="form-buttons">
          <button
            className="btn-secondary"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handlePublish}
            disabled={publishing || !name.trim()}
          >
            {publishing ? 'Publishing…' : 'Publish Item'}
          </button>
        </div>
      </div>
    </div>
  );
}
