import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import { headerDTag, randomDTag } from '../../utils/dtag';

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

  async function handlePublish() {
    if (!singular.trim()) {
      setError('Name (singular) is required');
      return;
    }

    try {
      setPublishing(true);
      setError(null);

      let body;

      if (signAs === 'client') {
        // Sign with NIP-07
        if (!window.nostr) {
          throw new Error('No NIP-07 extension found');
        }

        const pubkey = await window.nostr.getPublicKey();
        const eventToSign = { ...unsignedEvent, pubkey };
        const signedEvent = await window.nostr.signEvent(eventToSign);

        body = { event: signedEvent, signAs: 'client' };
      } else {
        // Send unsigned to server for Tapestry Assistant signing
        body = { event: unsignedEvent, signAs: 'assistant' };
      }

      const res = await fetch('/api/strfry/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Publish failed');
      }

      // Navigate to the new list's detail page
      const ev = data.event;
      if (ev.kind === 39998) {
        const dTagVal = ev.tags.find(t => t[0] === 'd')?.[1];
        navigate(`/kg/lists/${encodeURIComponent(`39998:${ev.pubkey}:${dTagVal}`)}`);
      } else {
        navigate(`/kg/lists/${encodeURIComponent(ev.id)}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>📋 New DList</h1>

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
            onClick={() => navigate('/kg/lists')}
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
