import { useState } from 'react';

const RELAY_GROUPS = [
  { key: 'aProfileRelays', label: 'Profile Relays', hint: 'Kind 0 profiles (purplepag.es, etc.)', restart: false },
  { key: 'aPopularGeneralPurposeRelays', label: 'General Purpose Relays', hint: 'Popular relays for broad reach', restart: false },
  { key: 'aDListRelays', label: 'DList Relays', hint: 'Kinds 9998/9999/39998/39999', restart: false },
  { key: 'aWotRelays', label: 'Web of Trust Relays', hint: 'Kinds 3, 1984, 1000', restart: false },
  { key: 'aTrustedAssertionRelays', label: 'Trusted Assertion Relays', hint: 'Kinds 30382–30385', restart: false },
  { key: 'aTrustedListRelays', label: 'Trusted List Relays', hint: 'Kinds 30392–30396', restart: false },
  { key: 'safeModeRelays', label: 'Safe Mode Relays', hint: 'Minimal set for safe mode operation', restart: false },
  { key: 'aOutboxRelays', label: 'Outbox Relays', hint: 'For outbox model publishing', restart: false },
];

function isValidRelay(url) {
  return /^wss?:\/\/.+/.test(url);
}

export default function RelaySettings({ settings, defaults, overrides, onSave, onReset }) {
  const relays = settings?.aRelays || {};
  const defaultRelays = defaults?.aRelays || {};
  const overrideRelays = overrides?.aRelays || {};

  return (
    <div className="settings-section">
      <h2>📡 Relay Configuration</h2>
      <p className="settings-hint">
        Changes to relay lists take effect immediately — no restart needed.
      </p>
      {RELAY_GROUPS.map(group => (
        <RelayGroup
          key={group.key}
          groupKey={group.key}
          label={group.label}
          hint={group.hint}
          urls={relays[group.key] || []}
          defaultUrls={defaultRelays[group.key] || []}
          isOverridden={!!overrideRelays[group.key]}
          onSave={(urls) => onSave({ aRelays: { [group.key]: urls } })}
          onReset={() => onReset(`aRelays.${group.key}`)}
        />
      ))}
    </div>
  );
}

function RelayGroup({ groupKey, label, hint, urls, defaultUrls, isOverridden, onSave, onReset }) {
  const [editing, setEditing] = useState(false);
  const [editUrls, setEditUrls] = useState([]);
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState(null);

  function startEdit() {
    setEditUrls([...urls]);
    setNewUrl('');
    setError(null);
    setEditing(true);
  }

  function addUrl() {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    if (!isValidRelay(trimmed)) {
      setError(`Invalid relay URL: must start with wss:// or ws://`);
      return;
    }
    if (editUrls.includes(trimmed)) {
      setError('Relay already in list');
      return;
    }
    setEditUrls([...editUrls, trimmed]);
    setNewUrl('');
    setError(null);
  }

  function removeUrl(idx) {
    setEditUrls(editUrls.filter((_, i) => i !== idx));
  }

  function save() {
    onSave(editUrls);
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  return (
    <div className="settings-group">
      <div className="settings-group-header">
        <div>
          <h3>{label} {isOverridden && <span className="badge-override">customized</span>}</h3>
          <p className="settings-hint">{hint}</p>
        </div>
        <div className="settings-group-actions">
          {!editing && <button className="btn-small" onClick={startEdit}>Edit</button>}
          {isOverridden && !editing && (
            <button className="btn-small" onClick={onReset} title="Reset to default">↩ Reset</button>
          )}
        </div>
      </div>

      {!editing ? (
        <div className="relay-list">
          {urls.length === 0 ? (
            <span className="text-muted">(none)</span>
          ) : (
            urls.map((url, i) => (
              <span key={i} className="relay-chip">{url}</span>
            ))
          )}
        </div>
      ) : (
        <div className="relay-edit">
          {editUrls.map((url, i) => (
            <div key={i} className="relay-edit-row">
              <span className="relay-chip">{url}</span>
              <button className="btn-remove" onClick={() => removeUrl(i)} title="Remove">✕</button>
            </div>
          ))}
          <div className="relay-add-row">
            <input
              type="text"
              value={newUrl}
              onChange={(e) => { setNewUrl(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && addUrl()}
              placeholder="wss://relay.example.com"
              className="input-relay"
            />
            <button className="btn-small" onClick={addUrl}>Add</button>
          </div>
          {error && <p className="error" style={{ marginTop: 4 }}>{error}</p>}
          <div className="relay-edit-actions">
            <button className="btn-primary btn-small" onClick={save}>Save</button>
            <button className="btn-small" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
