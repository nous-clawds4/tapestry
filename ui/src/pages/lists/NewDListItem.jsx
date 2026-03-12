import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import { childDTag, randomDTag } from '../../utils/dtag';

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

  // Build the unsigned event
  const unsignedEvent = useMemo(() => {
    const kind = replaceable ? 39999 : 9999;
    const tags = [];

    if (replaceable) {
      tags.push(['d', itemDTag]);
    }

    // Parent pointer
    tags.push(['z', parentRef]);

    // Name tag (always included)
    if (name) {
      tags.push(['name', name]);
    }

    // Property tags from the form
    for (const def of propertyDefs) {
      const val = propValues[def.name];
      // Skip 'name' since we handle it separately above
      if (def.name.toLowerCase() === 'name') continue;
      if (val) {
        tags.push([def.name.toLowerCase(), val]);
      }
    }

    // Custom tags
    for (const ct of customTags) {
      tags.push([ct.key, ct.value]);
    }

    return {
      kind,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: '',
    };
  }, [name, replaceable, propertyDefs, propValues, customTags, parentRef, itemDTag]);

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

  async function handlePublish() {
    if (missingRequired.length > 0) {
      setError(`Missing required fields: ${missingRequired.join(', ')}`);
      return;
    }

    try {
      setPublishing(true);
      setError(null);

      let body;

      if (signAs === 'client') {
        if (!window.nostr) {
          throw new Error('No NIP-07 extension found');
        }
        const pubkey = await window.nostr.getPublicKey();
        const eventToSign = { ...unsignedEvent, pubkey };
        const signedEvent = await window.nostr.signEvent(eventToSign);
        body = { event: signedEvent, signAs: 'client' };
      } else {
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

      // Navigate to the new item's detail page
      const ev = data.event;
      if (ev.kind === 39999) {
        const d = ev.tags.find(t => t[0] === 'd')?.[1];
        navigate(`/kg/lists/items/${encodeURIComponent(`39999:${ev.pubkey}:${d}`)}`);
      } else {
        navigate(`/kg/lists/items/${encodeURIComponent(ev.id)}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="new-dlist-item">
      <h2>Add Item to "{parentName}"</h2>

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
