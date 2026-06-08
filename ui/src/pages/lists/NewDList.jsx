import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import { headerDTag, randomDTag } from '../../utils/dtag';
import { buildListPrompt, buildClaudeDeepLink, parseListToml } from '../../lib/listToml';

const panelInput = {
  width: '100%', padding: '0.5rem', background: '#0d1117',
  border: '1px solid #30363d', borderRadius: 4, color: '#c9d1d9',
};

function listRoute(ev) {
  if (ev.kind === 39998) {
    const d = ev.tags.find(t => t[0] === 'd')?.[1];
    return `/tapestry/lists/${encodeURIComponent(`39998:${ev.pubkey}:${d}`)}`;
  }
  return `/tapestry/lists/${encodeURIComponent(ev.id)}`;
}

export default function NewDList() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Form state
  const [singular, setSingular] = useState('');
  const [plural, setPlural] = useState('');
  const [description, setDescription] = useState('');
  const [replaceable, setReplaceable] = useState(true); // true = kind 39998, false = kind 9998
  const [signAs, setSignAs] = useState('client'); // 'client' (NIP-07) or 'assistant'

  // Property tags: each is { requirement: 'required'|'optional'|'recommended', value: string }
  const [propertyTags, setPropertyTags] = useState([]);
  const [newTagReq, setNewTagReq] = useState('required');
  const [newTagValue, setNewTagValue] = useState('');

  // UI state
  const [showPreview, setShowPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);

  // Claude/TOML drop-in state
  const [query, setQuery] = useState('');
  const [tomlText, setTomlText] = useState('');
  const [parsed, setParsed] = useState(null);            // { lists, errors } from the last Load
  const [copied, setCopied] = useState(false);
  const [publishingAll, setPublishingAll] = useState(false);
  const [publishResults, setPublishResults] = useState(null); // [{ singular, status, route?, error? }]

  const prompt = buildListPrompt(query);
  const deepLink = buildClaudeDeepLink(prompt);

  // Deterministic d-tag derived from name; falls back to random if name is empty
  const dTag = useMemo(() => {
    if (singular.trim()) return headerDTag(singular.trim());
    return randomDTag();
  }, [singular]);

  function addPropertyTag() {
    const val = newTagValue.trim();
    if (!val) return;
    setPropertyTags(prev => [...prev, { requirement: newTagReq, value: val }]);
    setNewTagValue('');
  }

  function removePropertyTag(index) {
    setPropertyTags(prev => prev.filter((_, i) => i !== index));
  }

  // Build the unsigned event
  const unsignedEvent = useMemo(() => {
    const kind = replaceable ? 39998 : 9998;
    const tags = [];

    if (replaceable) {
      tags.push(['d', dTag]);
    }

    tags.push(['names', singular, plural || singular]);

    if (description) {
      tags.push(['description', description]);
    }

    for (const pt of propertyTags) {
      tags.push([pt.requirement, pt.value]);
    }

    return {
      kind,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: '',
    };
  }, [singular, plural, description, replaceable, propertyTags, dTag]);

  // Shared publish: sign (NIP-07 or Tapestry Assistant) then POST to strfry. Returns the event.
  async function publishUnsignedEvent(unsigned) {
    let body;
    if (signAs === 'client') {
      if (!window.nostr) throw new Error('No NIP-07 extension found');
      const pubkey = await window.nostr.getPublicKey();
      body = { event: await window.nostr.signEvent({ ...unsigned, pubkey }), signAs: 'client' };
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

  // Build an unsigned 39998/9998 event from a parsed list object (batch path).
  function unsignedFromList(list) {
    const kind = list.replaceable ? 39998 : 9998;
    const tags = [];
    if (list.replaceable) tags.push(['d', headerDTag(list.singular.trim())]);
    tags.push(['names', list.singular, list.plural || list.singular]);
    if (list.description) tags.push(['description', list.description]);
    for (const pt of list.propertyTags || []) tags.push([pt.requirement, pt.value]);
    return { kind, created_at: Math.floor(Date.now() / 1000), tags, content: '' };
  }

  async function handlePublish() {
    if (!singular.trim()) {
      setError('Name (singular) is required');
      return;
    }
    try {
      setPublishing(true);
      setError(null);
      const ev = await publishUnsignedEvent(unsignedEvent);
      navigate(listRoute(ev));
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  }

  function prefillForm(list) {
    setReplaceable(list.replaceable);
    setSingular(list.singular);
    setPlural(list.plural || '');
    setDescription(list.description || '');
    setPropertyTags(list.propertyTags || []);
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
    const result = parseListToml(tomlText);
    setParsed(result);
    if (result.errors.length === 0 && result.lists.length === 1) {
      prefillForm(result.lists[0]);
    }
  }

  async function handlePublishAll() {
    if (!parsed?.lists?.length) return;
    setPublishingAll(true);
    const results = [];
    for (const list of parsed.lists) {
      try {
        const ev = await publishUnsignedEvent(unsignedFromList(list));
        results.push({ singular: list.singular, status: 'ok', route: listRoute(ev) });
      } catch (err) {
        results.push({ singular: list.singular, status: 'error', error: err.message });
      }
      setPublishResults([...results]);
    }
    setPublishingAll(false);
  }

  const multi = parsed && parsed.errors.length === 0 && parsed.lists.length > 1;
  const single = parsed && parsed.errors.length === 0 && parsed.lists.length === 1;

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>📋 New DList</h1>

      {/* ── Set up with Claude (paste TOML) ─────────────────────────────── */}
      <details open style={{
        maxWidth: 700, marginBottom: '1.5rem', padding: '1rem',
        background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
      }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          ⚡ Set up with Claude — describe it, paste the TOML
        </summary>
        <p style={{ opacity: 0.7, fontSize: '0.9rem', marginTop: '0.75rem' }}>
          Describe the list you want, open Claude pre-loaded with your request, then paste the
          <code> toml</code> it gives back and hit Load. Create several at once with multiple
          <code> [[list]]</code> tables.
        </p>

        {/* Step 1 — describe it, then send it to Claude */}
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.75rem' }}>1. Describe it</div>
        <textarea
          rows={2}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. a list of kettlebell workout routines, each item has a name and a video url"
          style={{ ...panelInput, marginTop: '0.35rem' }}
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
        </div>

        {/* Step 2 — paste back what Claude gives you */}
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.5rem' }}>2. Paste Claude’s TOML</div>
        <textarea
          rows={6}
          value={tomlText}
          onChange={e => setTomlText(e.target.value)}
          placeholder={'Paste the ```toml block Claude gives you here…'}
          style={{ ...panelInput, fontFamily: 'monospace', fontSize: '0.85rem', marginTop: '0.35rem' }}
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
            Loaded 1 list into the form below — review it and hit Publish DList.
          </p>
        )}

        {multi && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
              {parsed.lists.length} lists ready — review, then publish all:
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', opacity: 0.7 }}>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Name</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Type</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Tags</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Description</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.lists.map((l, i) => {
                    const result = publishResults?.[i];
                    return (
                      <tr key={i} style={{ borderTop: '1px solid #30363d' }}>
                        <td style={{ padding: '0.3rem 0.5rem' }}>{l.singular}{l.plural ? ` / ${l.plural}` : ''}</td>
                        <td style={{ padding: '0.3rem 0.5rem' }}>{l.replaceable ? '39998' : '9998'}</td>
                        <td style={{ padding: '0.3rem 0.5rem' }} title={l.propertyTags.map(t => `${t.requirement}:${t.value}`).join(', ')}>
                          {l.propertyTags.length}
                        </td>
                        <td style={{ padding: '0.3rem 0.5rem', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.description}>
                          {l.description || '—'}
                        </td>
                        <td style={{ padding: '0.3rem 0.5rem' }}>
                          {!result && '—'}
                          {result?.status === 'ok' && <Link to={result.route} style={{ color: '#3fb950' }}>published ✓</Link>}
                          {result?.status === 'error' && <span style={{ color: '#f85149' }} title={result.error}>failed ✗</span>}
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
                {publishingAll ? 'Publishing…' : `Publish all ${parsed.lists.length}`}
              </button>
              {publishResults && !publishingAll && (
                <Link to="/tapestry/lists" style={{ color: '#58a6ff' }}>Go to Simple Lists →</Link>
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

      <p style={{ maxWidth: 700, textAlign: 'center', opacity: 0.5, fontSize: '0.85rem', margin: '0 0 1rem' }}>
        — or fill it in manually —
      </p>

      <div className="form-section">
        <h2>List Type</h2>
        <div className="form-row">
          <label className="radio-label">
            <input
              type="radio"
              checked={replaceable}
              onChange={() => setReplaceable(true)}
            />
            <span>
              <strong>Replaceable</strong> (kind 39998)
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
              <strong>Non-replaceable</strong> (kind 9998)
              <small> — permanent once published</small>
            </span>
          </label>
        </div>
      </div>

      <div className="form-section">
        <h2>Name</h2>
        <div className="form-row">
          <div className="form-field">
            <label>Singular</label>
            <input
              type="text"
              value={singular}
              onChange={e => setSingular(e.target.value)}
              placeholder="e.g. US President"
            />
          </div>
          <div className="form-field">
            <label>Plural</label>
            <input
              type="text"
              value={plural}
              onChange={e => setPlural(e.target.value)}
              placeholder="e.g. US Presidents"
            />
          </div>
        </div>
      </div>

      {/* D-tag preview */}
      {replaceable && singular.trim() && (
        <div style={{
          padding: '0.5rem 0.75rem',
          fontSize: '0.8rem',
          backgroundColor: 'var(--bg-secondary, #1a1a2e)',
          border: '1px solid var(--border, #444)',
          borderRadius: '6px',
          marginBottom: '1rem',
        }}>
          <span style={{ opacity: 0.5 }}>d-tag: </span>
          <code style={{ color: '#58a6ff' }}>{dTag}</code>
        </div>
      )}

      <div className="form-section">
        <h2>Description</h2>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe what this list is for..."
          rows={3}
          className="form-textarea"
        />
      </div>

      <div className="form-section">
        <h2>Item Property Tags</h2>
        <p className="form-help">
          Define what tags items on this list should have.
        </p>

        {propertyTags.length > 0 && (
          <div className="tag-list">
            {propertyTags.map((pt, i) => (
              <div key={i} className="tag-item">
                <span className={`tag-req tag-${pt.requirement}`}>{pt.requirement}</span>
                <span className="tag-value">{pt.value}</span>
                <button className="tag-remove" onClick={() => removePropertyTag(i)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="tag-add-row">
          <select value={newTagReq} onChange={e => setNewTagReq(e.target.value)}>
            <option value="required">required</option>
            <option value="optional">optional</option>
            <option value="recommended">recommended</option>
          </select>
          <input
            type="text"
            value={newTagValue}
            onChange={e => setNewTagValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPropertyTag())}
            placeholder="e.g. name, npub, description"
          />
          <button className="btn-secondary" onClick={addPropertyTag}>Add</button>
        </div>
      </div>

      <div className="form-section">
        <h2>Author</h2>
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

      {/* Preview toggle */}
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

      {/* Publish */}
      <div className="form-section form-actions">
        {error && <p className="error">{error}</p>}
        <div className="form-buttons">
          <button
            className="btn-secondary"
            onClick={() => navigate('/tapestry/lists')}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handlePublish}
            disabled={publishing || !singular.trim()}
          >
            {publishing ? 'Publishing…' : 'Publish DList'}
          </button>
        </div>
      </div>
    </div>
  );
}
