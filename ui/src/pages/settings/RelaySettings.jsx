import { useState, useEffect } from 'react';

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

const DIR_OPTIONS = [
  { value: 'both', label: '↕️ Both (sync in both directions)' },
  { value: 'down', label: '⬇️ Download only' },
  { value: 'up', label: '⬆️ Upload only' },
];

const DIR_LABELS = {
  both: '↕️ Both',
  up: '⬆️ Upload',
  down: '⬇️ Download',
};

function emptyStream() {
  return { name: '', dir: 'both', filter: { kinds: [], limit: 5 }, urls: [], pluginDown: '', pluginUp: '' };
}

/* ── Stream Editor (used for both Add and Edit) ── */

function StreamEditor({ stream, plugins, onSave, onCancel, isNew }) {
  const [form, setForm] = useState({ ...stream });
  const [kindInput, setKindInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState(null);

  function update(key, val) {
    setForm(f => ({ ...f, [key]: val }));
    setError(null);
  }
  function updateFilter(key, val) {
    setForm(f => ({ ...f, filter: { ...f.filter, [key]: val } }));
  }

  function addKind() {
    const k = parseInt(kindInput.trim());
    if (isNaN(k)) { setError('Kind must be a number'); return; }
    if (form.filter.kinds.includes(k)) { setError('Kind already added'); return; }
    updateFilter('kinds', [...form.filter.kinds, k]);
    setKindInput('');
    setError(null);
  }
  function removeKind(k) { updateFilter('kinds', form.filter.kinds.filter(x => x !== k)); }

  function addUrl() {
    const u = urlInput.trim();
    if (!u) return;
    if (!/^wss?:\/\/.+/.test(u)) { setError('URL must start with wss:// or ws://'); return; }
    if (form.urls.includes(u)) { setError('URL already added'); return; }
    update('urls', [...form.urls, u]);
    setUrlInput('');
    setError(null);
  }
  function removeUrl(u) { update('urls', form.urls.filter(x => x !== u)); }

  function handleSave() {
    if (!form.name || !/^\w+$/.test(form.name)) {
      setError('Name required (alphanumeric + underscore only)');
      return;
    }
    if (form.urls.length === 0) {
      setError('At least one relay URL is required');
      return;
    }
    onSave(form);
  }

  const inputStyle = {
    padding: '0.4rem 0.6rem', fontSize: '0.85rem',
    backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
    border: '1px solid var(--border, #444)', borderRadius: '4px', flex: 1,
  };

  return (
    <div className="settings-group" style={{ padding: '1rem', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
      <h4 style={{ margin: '0 0 0.75rem' }}>{isNew ? '➕ New Stream' : `✏️ Edit: ${stream.name}`}</h4>

      {/* Name */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Name</label>
        <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
          placeholder="e.g. myRelay" disabled={!isNew} style={{ ...inputStyle, width: '100%' }} />
        {!isNew && <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>(name cannot be changed)</span>}
      </div>

      {/* Direction */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Direction</label>
        <select value={form.dir} onChange={e => update('dir', e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer', width: '100%' }}>
          {DIR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Kind filter */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
          Event Kinds
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
          {form.filter.kinds.map(k => (
            <span key={k} className="relay-chip" style={{ cursor: 'pointer' }} onClick={() => removeKind(k)}>
              {k} ✕
            </span>
          ))}
          {form.filter.kinds.length === 0 && <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>(none — all kinds)</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input type="text" value={kindInput} onChange={e => setKindInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addKind()}
            placeholder="Kind number" style={inputStyle} />
          <button className="btn-small" onClick={addKind}>Add</button>
        </div>
      </div>

      {/* Limit */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Limit</label>
        <input type="number" value={form.filter.limit || ''} onChange={e => updateFilter('limit', parseInt(e.target.value) || 0)}
          placeholder="5" style={{ ...inputStyle, width: '100px' }} />
      </div>

      {/* Relay URLs */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Relay URLs</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.4rem' }}>
          {form.urls.map(u => (
            <div key={u} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="relay-chip" style={{ flex: 1 }}>{u}</span>
              <button className="btn-remove" onClick={() => removeUrl(u)} title="Remove">✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addUrl()}
            placeholder="wss://relay.example.com" style={inputStyle} />
          <button className="btn-small" onClick={addUrl}>Add</button>
        </div>
      </div>

      {/* Plugins */}
      {plugins.length > 0 && (
        <>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
              Plugin (Download)
            </label>
            <select value={form.pluginDown || ''} onChange={e => update('pluginDown', e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer', width: '100%' }}>
              <option value="">None</option>
              {plugins.map(p => <option key={p.path} value={p.path}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
              Plugin (Upload)
            </label>
            <select value={form.pluginUp || ''} onChange={e => update('pluginUp', e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer', width: '100%' }}>
              <option value="">None</option>
              {plugins.map(p => <option key={p.path} value={p.path}>{p.name}</option>)}
            </select>
          </div>
        </>
      )}

      {error && <p className="error" style={{ marginBottom: '0.5rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn-primary btn-small" onClick={handleSave}>
          {isNew ? '➕ Add Stream' : '💾 Save'}
        </button>
        <button className="btn-small" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Router Management ── */

function RouterStatus() {
  const [data, setData] = useState(null);
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null); // index or 'new'
  const [message, setMessage] = useState(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [defaultStreams, setDefaultStreams] = useState(null);

  function fetchStatus() {
    return fetch('/api/strfry/router-status')
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d.router);
        else setError(d.error);
      })
      .catch(e => setError(e.message));
  }

  function fetchPlugins() {
    return fetch('/api/strfry/router-plugins')
      .then(r => r.json())
      .then(d => { if (d.success) setPlugins(d.plugins); })
      .catch(() => {});
  }

  useEffect(() => {
    Promise.all([fetchStatus(), fetchPlugins()]).finally(() => setLoading(false));
  }, []);

  function flash(msg) {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  }

  async function saveStreams(streams) {
    setSaving(true);
    try {
      const res = await fetch('/api/strfry/router-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streams }),
      });
      const d = await res.json();
      if (!d.success) { setError(d.error); return false; }
      await fetchStatus();
      setEditingIdx(null);
      flash(d.message);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handleAddStream(stream) {
    const updated = [...data.streams, stream];
    saveStreams(updated);
  }

  function handleEditStream(idx, stream) {
    const updated = [...data.streams];
    updated[idx] = stream;
    saveStreams(updated);
  }

  function handleDeleteStream(idx) {
    const name = data.streams[idx].name;
    if (!confirm(`Delete stream "${name}"? This will restart the router.`)) return;
    const updated = data.streams.filter((_, i) => i !== idx);
    saveStreams(updated);
  }

  async function handleToggleDefaults() {
    if (showDefaults) {
      setShowDefaults(false);
      return;
    }
    // Fetch defaults if not loaded yet
    if (!defaultStreams) {
      try {
        const res = await fetch('/api/strfry/router-defaults');
        const d = await res.json();
        if (d.success) setDefaultStreams(d.streams);
        else { setError(d.error); return; }
      } catch (e) { setError(e.message); return; }
    }
    setShowDefaults(true);
  }

  async function handleImportDefault(defStream) {
    // Check if stream with same name already exists
    if (data.streams.some(s => s.name === defStream.name)) {
      if (!confirm(`Stream "${defStream.name}" already exists. Replace it?`)) return;
      const updated = data.streams.map(s => s.name === defStream.name ? defStream : s);
      await saveStreams(updated);
    } else {
      await saveStreams([...data.streams, defStream]);
    }
  }

  async function handleImportAllDefaults() {
    if (!defaultStreams) return;
    if (!confirm('Import all default streams? Existing streams with the same name will be replaced.')) return;
    // Merge: replace existing by name, add new ones
    const merged = [...data.streams];
    for (const def of defaultStreams) {
      const idx = merged.findIndex(s => s.name === def.name);
      if (idx >= 0) merged[idx] = def;
      else merged.push(def);
    }
    await saveStreams(merged);
  }

  async function handleRestart() {
    setSaving(true);
    try {
      const res = await fetch('/api/strfry/router-restart', { method: 'POST' });
      const d = await res.json();
      if (d.success) {
        await fetchStatus();
        flash('Router restarted.');
      } else {
        setError(d.error);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="settings-section"><p className="text-muted">Loading router status…</p></div>;
  if (!data) return <div className="settings-section"><p className="error">Error: {error}</p></div>;

  const statusColor = data.process.status === 'running' ? '#22c55e'
    : data.process.status === 'stopped' ? '#f59e0b'
    : '#ef4444';

  return (
    <div className="settings-section">
      <h2>🔄 Router Management</h2>
      <p className="settings-hint">
        The strfry router syncs events between your local relay and external relays.
      </p>

      {message && (
        <div style={{
          padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '6px',
          backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
          color: '#22c55e', fontSize: '0.85rem',
        }}>
          ✅ {message}
        </div>
      )}
      {error && (
        <div style={{
          padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '6px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444', fontSize: '0.85rem',
        }}>
          ❌ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>dismiss</button>
        </div>
      )}

      {/* Status bar */}
      <div className="settings-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10,
              borderRadius: '50%', backgroundColor: statusColor,
            }} />
            <div>
              <h3 style={{ margin: 0 }}>
                Router: {data.process.status}
                {data.process.uptime && (
                  <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    (uptime: {data.process.uptime})
                  </span>
                )}
              </h3>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-small" onClick={handleRestart} disabled={saving}>🔄 Restart</button>
            <button className="btn-small" onClick={handleToggleDefaults} disabled={saving}>
              {showDefaults ? '🔼 Hide Defaults' : '📋 Show Defaults'}
            </button>
          </div>
        </div>
      </div>

      {/* Defaults panel */}
      {showDefaults && defaultStreams && (
        <div style={{
          marginTop: '0.75rem', padding: '1rem', borderRadius: '8px',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          backgroundColor: 'rgba(245, 158, 11, 0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.9rem', margin: 0 }}>📋 Default Streams ({defaultStreams.length})</h3>
            <button className="btn-small btn-primary" onClick={handleImportAllDefaults} disabled={saving}>
              Import All
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {defaultStreams.map(ds => {
              const exists = data.streams.some(s => s.name === ds.name);
              return (
                <div key={ds.name} className="settings-group" style={{ padding: '0.6rem 0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{ds.name}</strong>
                        <span style={{
                          fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                          backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8',
                        }}>
                          {DIR_LABELS[ds.dir] || ds.dir}
                        </span>
                        {exists && (
                          <span style={{
                            fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
                          }}>
                            exists
                          </span>
                        )}
                      </div>
                      {ds.filter?.kinds?.length > 0 && (
                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                          kinds: {ds.filter.kinds.join(', ')}
                        </div>
                      )}
                      <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                        {ds.urls.join(', ')}
                      </div>
                    </div>
                    <button className="btn-small" onClick={() => handleImportDefault(ds)} disabled={saving}>
                      {exists ? '🔄 Replace' : '📥 Import'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Streams */}
      <div style={{ marginTop: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', margin: 0 }}>Streams ({data.streams.length})</h3>
          {editingIdx === null && (
            <button className="btn-small btn-primary" onClick={() => setEditingIdx('new')} disabled={saving}>
              ➕ Add Stream
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {data.streams.map((stream, idx) => (
            editingIdx === idx ? (
              <StreamEditor
                key={stream.name}
                stream={stream}
                plugins={plugins}
                isNew={false}
                onSave={(s) => handleEditStream(idx, s)}
                onCancel={() => setEditingIdx(null)}
              />
            ) : (
              <div key={stream.name} className="settings-group" style={{ padding: '0.75rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{stream.name}</h4>
                    <span style={{
                      fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
                      backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontWeight: 500,
                    }}>
                      {DIR_LABELS[stream.dir] || stream.dir}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn-small" onClick={() => setEditingIdx(idx)} disabled={saving || editingIdx !== null}>
                      ✏️
                    </button>
                    <button className="btn-small" onClick={() => handleDeleteStream(idx)} disabled={saving || editingIdx !== null}
                      style={{ color: '#ef4444' }}>
                      🗑️
                    </button>
                  </div>
                </div>
                {stream.filter && stream.filter.kinds?.length > 0 && (
                  <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.4rem' }}>
                    Filter: kinds {stream.filter.kinds.join(', ')}
                    {stream.filter.limit ? ` (limit: ${stream.filter.limit})` : ''}
                  </div>
                )}
                {(stream.pluginDown || stream.pluginUp) && (
                  <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.4rem' }}>
                    {stream.pluginDown && <span>Plugin ⬇️: {stream.pluginDown.split('/').pop()} </span>}
                    {stream.pluginUp && <span>Plugin ⬆️: {stream.pluginUp.split('/').pop()}</span>}
                  </div>
                )}
                <div className="relay-list">
                  {stream.urls.map((url, i) => (
                    <span key={i} className="relay-chip">{url}</span>
                  ))}
                </div>
              </div>
            )
          ))}

          {editingIdx === 'new' && (
            <StreamEditor
              stream={emptyStream()}
              plugins={plugins}
              isNew={true}
              onSave={handleAddStream}
              onCancel={() => setEditingIdx(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function RelaySettings({ settings, defaults, overrides, onSave, onReset }) {
  const relays = settings?.aRelays || {};
  const defaultRelays = defaults?.aRelays || {};
  const overrideRelays = overrides?.aRelays || {};

  return (
    <>
    <RouterStatus />
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
    </>
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
