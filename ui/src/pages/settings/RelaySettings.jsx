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
  return { name: '', dir: 'both', filter: { kinds: [], limit: 5 }, urls: [], pluginDown: '', pluginUp: '', enabled: true };
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

/* ── Toggle Switch ── */

function ToggleSwitch({ enabled, onChange, disabled }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      title={enabled ? 'Click to disable' : 'Click to enable'}
      style={{
        position: 'relative',
        width: 44, height: 24,
        borderRadius: 12,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: enabled ? '#22c55e' : '#444',
        transition: 'background-color 0.2s',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2, left: enabled ? 22 : 2,
        width: 20, height: 20,
        borderRadius: '50%',
        backgroundColor: '#fff',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

/* ── Router Management ── */

function RouterStatus() {
  const [data, setData] = useState(null);
  const [plugins, setPlugins] = useState([]);
  const [presets, setPresets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null); // index or 'new'
  const [message, setMessage] = useState(null);
  const [showPresets, setShowPresets] = useState(false);

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

  async function toggleStream(name, enabled) {
    setSaving(true);
    try {
      const res = await fetch('/api/strfry/router-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, enabled }),
      });
      const d = await res.json();
      if (!d.success) { setError(d.error); return; }
      await fetchStatus();
      flash(d.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
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
    const updated = [...data.streams, { ...stream, enabled: true }];
    saveStreams(updated);
  }

  function handleEditStream(idx, stream) {
    const updated = [...data.streams];
    updated[idx] = { ...stream, enabled: data.streams[idx].enabled };
    saveStreams(updated);
  }

  function handleDeleteStream(idx) {
    const name = data.streams[idx].name;
    if (!confirm(`Delete stream "${name}"? This will restart the router.`)) return;
    const updated = data.streams.filter((_, i) => i !== idx);
    saveStreams(updated);
  }

  async function handleTogglePresets() {
    if (showPresets) {
      setShowPresets(false);
      return;
    }
    if (!presets) {
      try {
        const res = await fetch('/api/strfry/router-presets');
        const d = await res.json();
        if (d.success) setPresets(d.presets);
        else { setError(d.error); return; }
      } catch (e) { setError(e.message); return; }
    }
    setShowPresets(true);
  }

  async function handleImportPreset(preset) {
    const newStream = {
      name: preset.name,
      description: preset.description || '',
      dir: preset.dir,
      filter: preset.filter,
      urls: preset.urls,
      pluginDown: preset.pluginDown || '',
      pluginUp: preset.pluginUp || '',
      enabled: !!preset.defaultEnabled,
      preset: true,
    };

    if (data.streams.some(s => s.name === preset.name)) {
      if (!confirm(`Stream "${preset.name}" already exists. Replace it?`)) return;
      const updated = data.streams.map(s => s.name === preset.name ? newStream : s);
      await saveStreams(updated);
    } else {
      await saveStreams([...data.streams, newStream]);
    }
  }

  async function handleRestoreDefaults() {
    if (!confirm('Restore all streams to presets? Custom streams will be removed. Preset streams will use their default enabled/disabled state.')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/strfry/router-restore-defaults', { method: 'POST' });
      const d = await res.json();
      if (d.success) {
        await fetchStatus();
        flash(d.message);
      } else {
        setError(d.error);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
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

  const enabledCount = data.streams.filter(s => s.enabled).length;

  return (
    <div className="settings-section">
      <h2>🔄 Router Management</h2>
      <p className="settings-hint">
        The strfry router syncs events between your local relay and external relays.
        Toggle streams on/off to control which relays are active.
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
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                {data.streams.length} stream{data.streams.length !== 1 ? 's' : ''} configured, {enabledCount} enabled
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-small" onClick={handleRestart} disabled={saving}>🔄 Restart</button>
            <button className="btn-small" onClick={handleTogglePresets} disabled={saving}>
              {showPresets ? '🔼 Hide Presets' : '📋 Presets'}
            </button>
            <button className="btn-small" onClick={handleRestoreDefaults} disabled={saving}
              title="Reset all streams to presets with their default enabled state">
              ↩ Restore Defaults
            </button>
          </div>
        </div>
      </div>

      {/* Presets panel */}
      {showPresets && presets && (
        <div style={{
          marginTop: '0.75rem', padding: '1rem', borderRadius: '8px',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          backgroundColor: 'rgba(245, 158, 11, 0.05)',
        }}>
          <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.75rem' }}>📋 Available Presets ({presets.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {presets.map(preset => {
              const exists = data.streams.some(s => s.name === preset.name);
              return (
                <div key={preset.name} className="settings-group" style={{ padding: '0.6rem 0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{preset.name}</strong>
                        <span style={{
                          fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                          backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8',
                        }}>
                          {DIR_LABELS[preset.dir] || preset.dir}
                        </span>
                        <span style={{
                          fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                          backgroundColor: preset.defaultEnabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                          color: preset.defaultEnabled ? '#22c55e' : '#9ca3af',
                        }}>
                          default: {preset.defaultEnabled ? 'ON' : 'OFF'}
                        </span>
                        {exists && (
                          <span style={{
                            fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
                          }}>
                            loaded
                          </span>
                        )}
                      </div>
                      {preset.description && (
                        <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.2rem' }}>{preset.description}</div>
                      )}
                      {preset.filter?.kinds?.length > 0 && (
                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                          kinds: {preset.filter.kinds.join(', ')}
                        </div>
                      )}
                      <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                        {preset.urls.join(', ')}
                      </div>
                    </div>
                    <button className="btn-small" onClick={() => handleImportPreset(preset)} disabled={saving}>
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
              <div key={stream.name} className="settings-group" style={{
                padding: '0.75rem 1rem',
                opacity: stream.enabled ? 1 : 0.6,
                transition: 'opacity 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ToggleSwitch
                      enabled={stream.enabled}
                      onChange={(val) => toggleStream(stream.name, val)}
                      disabled={saving || editingIdx !== null}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{stream.name}</h4>
                        <span style={{
                          fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
                          backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontWeight: 500,
                        }}>
                          {DIR_LABELS[stream.dir] || stream.dir}
                        </span>
                        {stream.preset && (
                          <span style={{
                            fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px',
                            backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#d97706',
                          }}>
                            preset
                          </span>
                        )}
                      </div>
                      {stream.description && (
                        <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.15rem' }}>{stream.description}</div>
                      )}
                    </div>
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
                  <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.4rem', marginLeft: '3.25rem' }}>
                    Filter: kinds {stream.filter.kinds.join(', ')}
                    {stream.filter.limit ? ` (limit: ${stream.filter.limit})` : ''}
                  </div>
                )}
                {(stream.pluginDown || stream.pluginUp) && (
                  <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.4rem', marginLeft: '3.25rem' }}>
                    {stream.pluginDown && <span>Plugin ⬇️: {stream.pluginDown.split('/').pop()} </span>}
                    {stream.pluginUp && <span>Plugin ⬆️: {stream.pluginUp.split('/').pop()}</span>}
                  </div>
                )}
                <div className="relay-list" style={{ marginLeft: '3.25rem' }}>
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

          {data.streams.length === 0 && editingIdx !== 'new' && (
            <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>
              No streams configured. Add a stream or restore presets.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Negentropy Sync Panel ── */

const TIME_UNITS = [
  { label: 'minutes', seconds: 60 },
  { label: 'hours', seconds: 3600 },
  { label: 'days', seconds: 86400 },
  { label: 'weeks', seconds: 604800 },
  { label: 'years', seconds: 31536000 },
];

function TimestampPicker({ label, value, onChange, disabled }) {
  // value is a unix timestamp (number) or null
  const [mode, setMode] = useState('off'); // 'off' | 'relative' | 'manual'
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState(2); // index into TIME_UNITS (default: days)
  const [manualTs, setManualTs] = useState('');

  // Sync internal state when value changes externally
  useEffect(() => {
    if (value == null) setMode('off');
  }, [value]);

  function handleModeChange(newMode) {
    setMode(newMode);
    if (newMode === 'off') {
      onChange(null);
    } else if (newMode === 'relative') {
      applyRelative(amount, unit);
    } else if (newMode === 'manual') {
      const ts = parseInt(manualTs);
      onChange(isNaN(ts) ? null : ts);
    }
  }

  function applyRelative(amt, unitIdx) {
    const secs = (parseFloat(amt) || 0) * TIME_UNITS[unitIdx].seconds;
    const ts = Math.floor(Date.now() / 1000 - secs);
    onChange(ts > 0 ? ts : null);
  }

  function handleAmountChange(val) {
    setAmount(val);
    if (mode === 'relative') applyRelative(val, unit);
  }

  function handleUnitChange(idx) {
    setUnit(idx);
    if (mode === 'relative') applyRelative(amount, idx);
  }

  function handleManualChange(val) {
    setManualTs(val);
    const ts = parseInt(val);
    onChange(isNaN(ts) ? null : ts);
  }

  const inputStyle = {
    padding: '0.35rem 0.5rem', fontSize: '0.85rem',
    backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
    border: '1px solid var(--border, #444)', borderRadius: '4px',
  };

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '40px' }}>{label}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', cursor: 'pointer' }}>
          <input type="radio" name={`ts-${label}`} checked={mode === 'off'} onChange={() => handleModeChange('off')} disabled={disabled} />
          Off
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', cursor: 'pointer' }}>
          <input type="radio" name={`ts-${label}`} checked={mode === 'relative'} onChange={() => handleModeChange('relative')} disabled={disabled} />
          Relative
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', cursor: 'pointer' }}>
          <input type="radio" name={`ts-${label}`} checked={mode === 'manual'} onChange={() => handleModeChange('manual')} disabled={disabled} />
          Timestamp
        </label>
      </div>
      {mode === 'relative' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '45px' }}>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={e => handleAmountChange(e.target.value)}
            disabled={disabled}
            style={{ ...inputStyle, width: '70px' }}
          />
          <select
            value={unit}
            onChange={e => handleUnitChange(parseInt(e.target.value))}
            disabled={disabled}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {TIME_UNITS.map((u, i) => <option key={u.label} value={i}>{u.label} ago</option>)}
          </select>
          {value != null && (
            <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
              = {new Date(value * 1000).toLocaleString()}
            </span>
          )}
        </div>
      )}
      {mode === 'manual' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '45px' }}>
          <input
            type="text"
            value={manualTs}
            onChange={e => handleManualChange(e.target.value)}
            placeholder="Unix timestamp (e.g. 1709856000)"
            disabled={disabled}
            style={{ ...inputStyle, width: '250px' }}
          />
          {value != null && (
            <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
              = {new Date(value * 1000).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const KIND_PRESETS = [
  { label: 'DCoSL (9998, 9999, 39998, 39999)', kinds: [9998, 9999, 39998, 39999] },
  { label: 'Profiles (0)', kinds: [0] },
  { label: 'WoT (3, 1984, 10000)', kinds: [3, 1984, 10000] },
  { label: 'All (no filter)', kinds: [] },
];

function NegentropySync({ settings }) {
  const allRelays = (() => {
    const relays = settings?.aRelays || {};
    const set = new Set();
    Object.values(relays).forEach(arr => {
      if (Array.isArray(arr)) arr.forEach(u => set.add(u));
    });
    return [...set].sort();
  })();

  const [relay, setRelay] = useState('');
  const [customRelay, setCustomRelay] = useState('');
  const [dir, setDir] = useState('down');
  const [kindPreset, setKindPreset] = useState(0); // index into KIND_PRESETS
  const [customKinds, setCustomKinds] = useState('');
  const [useCustomKinds, setUseCustomKinds] = useState(false);
  const [authors, setAuthors] = useState('');
  const [since, setSince] = useState(null);
  const [until, setUntil] = useState(null);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState([]);
  const [result, setResult] = useState(null); // { success, exitCode } or null
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [counting, setCounting] = useState(false);
  const [counts, setCounts] = useState(null); // { local, remote, localError, remoteError }

  // Check for active sync on mount
  useEffect(() => {
    setChecking(true);
    fetch('/api/strfry/negentropy-sync/status')
      .then(r => r.json())
      .then(d => {
        if (d.active) {
          setRunning(true);
          setOutput(d.recentLines?.map(text => ({ text })) || []);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const effectiveRelay = relay === '__custom__' ? customRelay.trim() : relay;

  const effectiveKinds = useCustomKinds
    ? customKinds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
    : KIND_PRESETS[kindPreset].kinds;

  const effectiveAuthors = authors.trim()
    ? authors.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // Build preview command
  const filterObj = {};
  if (effectiveKinds.length > 0) filterObj.kinds = effectiveKinds;
  if (effectiveAuthors.length > 0) filterObj.authors = effectiveAuthors;
  if (since != null) filterObj.since = since;
  if (until != null) filterObj.until = until;
  const filterStr = Object.keys(filterObj).length > 0 ? JSON.stringify(filterObj) : '{}';
  const dirFlag = dir !== 'both' ? ` --dir ${dir}` : '';
  const previewCmd = effectiveRelay
    ? `strfry sync ${effectiveRelay} --filter '${filterStr}'${dirFlag}`
    : '(select a relay to preview command)';

  function handleStart() {
    if (!effectiveRelay || !/^wss?:\/\/.+/.test(effectiveRelay)) {
      setError('Please select or enter a valid relay URL');
      return;
    }

    setRunning(true);
    setOutput([]);
    setResult(null);
    setError(null);

    const params = new URLSearchParams({
      relay: effectiveRelay,
      dir,
      filter: JSON.stringify(filterObj),
    });

    const evtSource = new EventSource(`/api/strfry/negentropy-sync/stream?${params}`);

    evtSource.addEventListener('start', (e) => {
      try {
        const data = JSON.parse(e.data);
        setOutput(prev => [...prev, { text: `▶ Started: ${data.command}`, type: 'info' }]);
      } catch {}
    });

    evtSource.addEventListener('line', (e) => {
      try {
        const data = JSON.parse(e.data);
        setOutput(prev => [...prev, { text: data.text, type: 'log' }]);
      } catch {}
    });

    evtSource.addEventListener('done', (e) => {
      try {
        const data = JSON.parse(e.data);
        setResult(data);
        setOutput(prev => [...prev, {
          text: data.success ? '✅ Sync completed successfully' : `❌ Sync failed (exit code ${data.exitCode})`,
          type: data.success ? 'success' : 'error',
        }]);
      } catch {}
      evtSource.close();
      setRunning(false);
    });

    evtSource.addEventListener('error', (e) => {
      // SSE error could be connection close (normal at end) or actual error
      if (evtSource.readyState === EventSource.CLOSED) {
        evtSource.close();
        setRunning(false);
        return;
      }
      try {
        const data = JSON.parse(e.data);
        setError(data.message);
        setOutput(prev => [...prev, { text: `❌ Error: ${data.message}`, type: 'error' }]);
      } catch {
        // Connection error
      }
      evtSource.close();
      setRunning(false);
    });

    evtSource.onerror = () => {
      if (evtSource.readyState === EventSource.CLOSED) return;
      evtSource.close();
      setRunning(false);
    };
  }

  async function handleCount() {
    if (!effectiveRelay || !/^wss?:\/\/.+/.test(effectiveRelay)) {
      setError('Please select or enter a valid relay URL');
      return;
    }
    setCounting(true);
    setCounts(null);
    setError(null);
    try {
      const params = new URLSearchParams({
        relay: effectiveRelay,
        filter: JSON.stringify(filterObj),
      });
      const res = await fetch(`/api/strfry/negentropy-sync/count?${params}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error);
      } else {
        setCounts(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCounting(false);
    }
  }

  const inputStyle = {
    padding: '0.4rem 0.6rem', fontSize: '0.85rem',
    backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
    border: '1px solid var(--border, #444)', borderRadius: '4px', width: '100%',
  };

  return (
    <div className="settings-section">
      <h2>🔃 Negentropy Sync</h2>
      <p className="settings-hint">
        Run a one-shot negentropy sync between your local strfry and an external relay.
      </p>

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

      {/* Relay selector */}
      <div className="settings-group" style={{ padding: '1rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Relay</label>
        <select
          value={relay}
          onChange={e => setRelay(e.target.value)}
          disabled={running}
          style={{ ...inputStyle, cursor: 'pointer', marginBottom: relay === '__custom__' ? '0.4rem' : 0 }}
        >
          <option value="">— Select a relay —</option>
          {allRelays.map(u => <option key={u} value={u}>{u}</option>)}
          <option value="__custom__">✏️ Enter relay URL manually…</option>
        </select>
        {relay === '__custom__' && (
          <input
            type="text"
            value={customRelay}
            onChange={e => setCustomRelay(e.target.value)}
            placeholder="wss://relay.example.com"
            disabled={running}
            style={inputStyle}
          />
        )}
      </div>

      {/* Direction */}
      <div className="settings-group" style={{ padding: '1rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Direction</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {DIR_OPTIONS.map(o => (
            <button
              key={o.value}
              className={`btn-small ${dir === o.value ? 'btn-primary' : ''}`}
              onClick={() => setDir(o.value)}
              disabled={running}
              style={{ flex: 1 }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kinds filter */}
      <div className="settings-group" style={{ padding: '1rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Event Kinds</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {KIND_PRESETS.map((preset, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="kindPreset"
                checked={!useCustomKinds && kindPreset === i}
                onChange={() => { setUseCustomKinds(false); setKindPreset(i); }}
                disabled={running}
              />
              {preset.label}
            </label>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="kindPreset"
              checked={useCustomKinds}
              onChange={() => setUseCustomKinds(true)}
              disabled={running}
            />
            Custom:
          </label>
          {useCustomKinds && (
            <input
              type="text"
              value={customKinds}
              onChange={e => setCustomKinds(e.target.value)}
              placeholder="e.g. 1, 7, 30023"
              disabled={running}
              style={{ ...inputStyle, marginLeft: '1.5rem', width: 'calc(100% - 1.5rem)' }}
            />
          )}
        </div>
      </div>

      {/* Authors filter */}
      <div className="settings-group" style={{ padding: '1rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
          Authors <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional — comma-separated hex pubkeys)</span>
        </label>
        <input
          type="text"
          value={authors}
          onChange={e => setAuthors(e.target.value)}
          placeholder="Leave empty to sync all authors"
          disabled={running}
          style={inputStyle}
        />
      </div>

      {/* Since / Until */}
      <div className="settings-group" style={{ padding: '1rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
          Time Range <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
        </label>
        <TimestampPicker label="Since" value={since} onChange={setSince} disabled={running} />
        <TimestampPicker label="Until" value={until} onChange={setUntil} disabled={running} />
      </div>

      {/* Command preview */}
      <div className="settings-group" style={{ padding: '1rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Command Preview</label>
        <code style={{
          display: 'block', padding: '0.6rem 0.8rem', borderRadius: '6px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)', fontSize: '0.8rem',
          wordBreak: 'break-all', lineHeight: '1.5',
          color: effectiveRelay ? '#a5f3fc' : 'var(--text-muted)',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        }}>
          {previewCmd}
        </code>
      </div>

      {/* Count + Start buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          className="btn-small"
          onClick={handleCount}
          disabled={running || counting || !effectiveRelay || checking}
          style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
        >
          {counting ? '⏳ Counting…' : '🔢 Count Events'}
        </button>
        <button
          className="btn-primary"
          onClick={handleStart}
          disabled={running || !effectiveRelay || checking}
          style={{ flex: 1, padding: '0.6rem', fontSize: '0.9rem' }}
        >
          {running ? '⏳ Sync in progress…' : checking ? 'Checking status…' : '▶️ Start Negentropy Sync'}
        </button>
      </div>

      {/* Count results */}
      {counts && (
        <div className="settings-group" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
            🔢 Event Counts (NIP-45)
          </label>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>Local (strfry)</div>
              {counts.localError
                ? <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>⚠️ {counts.localError}</span>
                : <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#60a5fa' }}>{counts.local?.toLocaleString()}</span>
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>Remote ({counts.relay?.replace(/^wss?:\/\//, '')})</div>
              {counts.remoteError
                ? <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>⚠️ {counts.remoteError}</span>
                : <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#a78bfa' }}>{counts.remote?.toLocaleString()}</span>
              }
            </div>
            {counts.local != null && counts.remote != null && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>Difference</div>
                <span style={{
                  fontSize: '1.4rem', fontWeight: 700,
                  color: counts.remote - counts.local > 0 ? '#fbbf24' : counts.remote - counts.local < 0 ? '#34d399' : '#22c55e',
                }}>
                  {counts.remote - counts.local > 0
                    ? `+${(counts.remote - counts.local).toLocaleString()} remote`
                    : counts.remote - counts.local < 0
                    ? `+${(counts.local - counts.remote).toLocaleString()} local`
                    : '✅ Equal'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Output log */}
      {output.length > 0 && (
        <div className="settings-group" style={{ padding: '1rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
            Output
            {running && <span style={{ fontWeight: 400, marginLeft: '0.5rem', color: '#22c55e' }}>● live</span>}
          </label>
          <div
            ref={el => { if (el) el.scrollTop = el.scrollHeight; }}
            style={{
              maxHeight: '300px', overflowY: 'auto', padding: '0.6rem 0.8rem',
              borderRadius: '6px', backgroundColor: 'rgba(0, 0, 0, 0.4)',
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontSize: '0.75rem', lineHeight: '1.6',
            }}
          >
            {output.map((line, i) => (
              <div key={i} style={{
                color: line.type === 'error' ? '#ef4444'
                  : line.type === 'success' ? '#22c55e'
                  : line.type === 'info' ? '#60a5fa'
                  : '#d4d4d8',
              }}>
                {line.text}
              </div>
            ))}
            {running && (
              <div style={{ color: '#60a5fa', opacity: 0.6 }}>▌</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const RELAY_TABS = [
  { key: 'router', label: '🔄 Router Management' },
  { key: 'sync', label: '🔃 Negentropy Sync' },
  { key: 'config', label: '📡 Relay Configuration' },
];

export default function RelaySettings({ settings, defaults, overrides, onSave, onReset }) {
  const relays = settings?.aRelays || {};
  const defaultRelays = defaults?.aRelays || {};
  const overrideRelays = overrides?.aRelays || {};

  const [activeTab, setActiveTab] = useState('router');

  return (
    <>
      <div className="tab-bar" style={{ marginBottom: '1rem' }}>
        {RELAY_TABS.map(tab => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'router' && <RouterStatus />}

      {activeTab === 'sync' && <NegentropySync settings={settings} />}

      {activeTab === 'config' && (
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
      )}
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
