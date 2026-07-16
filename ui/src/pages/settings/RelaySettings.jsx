import { useState, useEffect, useCallback } from 'react';
import AddOrEditEntryModal from './scheduledTasks/AddOrEditEntryModal.jsx';
import { validateTagLetter, parseTagValues, mergeTagFilter } from '../../utils/tagFilterValidation';

const RELAY_GROUPS = [
  { key: 'aProfileRelays', label: 'Profile Relays', hint: 'Kind 0 profiles (purplepag.es, etc.)', restart: false },
  { key: 'aPopularGeneralPurposeRelays', label: 'General Purpose Relays', hint: 'Popular relays for broad reach', restart: false },
  { key: 'aDListRelays', label: 'DList Relays', hint: 'Kinds 9998/9999/39998/39999', restart: false },
  { key: 'aWotRelays', label: 'Web of Trust Relays', hint: 'Kinds 3, 1984, 1000', restart: false },
  { key: 'aTrustedAssertionRelays', label: 'Trusted Assertion Relays', hint: 'Kinds 30382–30385', restart: false },
  { key: 'aTrustedListRelays', label: 'Trusted List Relays', hint: 'Kinds 30392–30396', restart: false },
  { key: 'safeModeRelays', label: 'Safe Mode Relays', hint: 'Minimal set for safe mode operation', restart: false },
  { key: 'aOutboxRelays', label: 'Outbox Relays', hint: 'For outbox model publishing', restart: false },
  { key: 'aTagFederationRelays', label: 'Tag Federation Relays (read-union)', hint: 'Tag reads (the /tags index and profile tag chips) union events from these relays at read time. Empty = local-only (federation OFF). Add trusted relays to surface tags from across the network.', restart: false },
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

/**
 * Single-letter tag filters for the sync filter, e.g. #x: foo1, foo2
 * (story relay-management #1, ADR relay-management/0001). Validation and
 * merging live in ui/src/utils/tagFilterValidation.js; the parent owns the
 * canonical tagFilters list ([{ letter, values }]).
 */
function TagFilterEditor({ tagFilters, onChange, disabled }) {
  const [letterInput, setLetterInput] = useState('');
  const [valuesInput, setValuesInput] = useState('');
  const [inlineError, setInlineError] = useState(null);

  const inputStyle = {
    padding: '0.4rem 0.6rem', fontSize: '0.85rem',
    backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
    border: '1px solid var(--border, #444)', borderRadius: '4px',
  };

  function handleAdd() {
    const letterResult = validateTagLetter(letterInput);
    if (!letterResult.ok) {
      setInlineError(letterResult.error);
      return;
    }
    const valuesResult = parseTagValues(letterResult.letter, valuesInput);
    if (!valuesResult.ok) {
      setInlineError(valuesResult.error);
      return;
    }
    onChange(mergeTagFilter(tagFilters, letterResult.letter, valuesResult.values));
    setLetterInput('');
    setValuesInput('');
    setInlineError(null);
  }

  function handleRemove(letter) {
    onChange(tagFilters.filter(f => f.letter !== letter));
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span style={{ fontSize: '0.9rem', opacity: 0.7, fontFamily: 'monospace' }}>#</span>
        <input
          type="text"
          value={letterInput}
          onChange={e => { setLetterInput(e.target.value); setInlineError(null); }}
          placeholder="x"
          maxLength={1}
          disabled={disabled}
          aria-label="Tag letter"
          style={{ ...inputStyle, width: '48px', textAlign: 'center', fontFamily: 'monospace' }}
        />
        <input
          type="text"
          value={valuesInput}
          onChange={e => { setValuesInput(e.target.value); setInlineError(null); }}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="value1, value2, …"
          disabled={disabled}
          aria-label="Tag values (comma-separated)"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button className="btn-small" onClick={handleAdd} disabled={disabled}>
          Add
        </button>
      </div>
      {inlineError && (
        <div style={{
          marginTop: '0.4rem', padding: '0.4rem 0.6rem', borderRadius: '4px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444', fontSize: '0.8rem',
        }}>
          ❌ {inlineError}
        </div>
      )}
      {tagFilters.length > 0 && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {tagFilters.map(f => (
            <div key={f.letter} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', fontSize: '0.85rem' }}>
              <code style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace', color: '#a5f3fc' }}>#{f.letter}</code>
              <span style={{ flex: 1, wordBreak: 'break-all', opacity: 0.85 }}>{f.values.join(', ')}</span>
              <button
                className="btn-small"
                onClick={() => handleRemove(f.letter)}
                disabled={disabled}
                title={`Remove #${f.letter} filter`}
                style={{ lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const KIND_PRESETS = [
  { label: 'DCoSL (9998, 9999, 39998, 39999)', kinds: [9998, 9999, 39998, 39999] },
  { label: 'Profiles (0)', kinds: [0] },
  { label: 'Treasure Maps (10040)', kinds: [10040] },
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
  const [tagFilters, setTagFilters] = useState([]); // [{ letter, values }] — ADR relay-management/0001
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
  for (const { letter, values } of tagFilters) filterObj['#' + letter] = values;
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

      {/* Tag filters */}
      <div className="settings-group" style={{ padding: '1rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
          Tag Filters <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional — single-letter tags; p/e/a values are format-checked)</span>
        </label>
        <TagFilterEditor tagFilters={tagFilters} onChange={setTagFilters} disabled={running} />
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

/* ── Streaming ETL Control Panel ── */

function StreamingETLPanel() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [controlling, setControlling] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  function flash(msg) { setMessage(msg); setTimeout(() => setMessage(null), 5000); }

  async function fetchStatus() {
    try {
      const resp = await fetch('/api/streaming-etl/status');
      const data = await resp.json();
      if (data.success) setStatus(data);
      else setError(data.error);
    } catch (err) { setError(err.message); }
  }

  async function fetchLogs() {
    try {
      const resp = await fetch('/api/streaming-etl/logs?lines=15');
      const data = await resp.json();
      if (data.success) setLogs(data.lines);
    } catch {}
  }

  async function controlConsumer(action) {
    setControlling(true);
    setError(null);
    try {
      const resp = await fetch('/api/streaming-etl/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await resp.json();
      if (data.success) {
        flash(`Consumer ${action}: ${data.message}`);
        await fetchStatus();
        await fetchLogs();
      } else {
        setError(data.error);
      }
    } catch (err) { setError(err.message); }
    finally { setControlling(false); }
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStatus(), fetchLogs()]).finally(() => setLoading(false));
    const interval = setInterval(() => { fetchStatus(); fetchLogs(); }, 10000);
    return () => clearInterval(interval);
  }, []);

  const isRunning = status?.consumer?.status === 'running';
  const statusColor = isRunning ? '#22c55e' : status?.consumer?.status === 'fatal' ? '#ef4444' : '#f59e0b';

  if (loading) {
    return <div className="settings-section"><h2>⚡ Streaming ETL</h2><p className="text-muted">Loading...</p></div>;
  }

  return (
    <div className="settings-section">
      <h2>⚡ Streaming ETL</h2>
      <p className="settings-hint">
        Real-time pipeline: strfry → Redis → Neo4j. Processes kind 3 (follows), 10000 (mutes), and 1984 (reports) events as they arrive.
      </p>

      {message && (
        <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '6px',
          backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
          color: '#22c55e', fontSize: '0.85rem' }}>
          ✅ {message}
        </div>
      )}
      {error && (
        <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '6px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444', fontSize: '0.85rem' }}>
          ❌ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>dismiss</button>
        </div>
      )}

      {/* Status + Controls */}
      <div className="settings-group" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: statusColor }} />
            <div>
              <strong style={{ textTransform: 'capitalize' }}>{status?.consumer?.status || 'Unknown'}</strong>
              {status?.consumer?.uptime && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', marginLeft: '0.5rem' }}>
                  uptime: {status.consumer.uptime}
                </span>
              )}
              {status?.consumer?.pid && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', marginLeft: '0.5rem' }}>
                  PID: {status.consumer.pid}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isRunning ? (
              <button className="btn-small" onClick={() => controlConsumer('stop')} disabled={controlling}
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                ⏹ Stop
              </button>
            ) : (
              <button className="btn-small" onClick={() => controlConsumer('start')} disabled={controlling}
                style={{ color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.4)' }}>
                ▶ Start
              </button>
            )}
            <button className="btn-small" onClick={() => controlConsumer('restart')} disabled={controlling}>
              🔄 Restart
            </button>
          </div>
        </div>

        {/* Metrics row */}
        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted, #888)' }}>Redis Queue: </span>
            <strong>{status?.queue?.depth != null ? status.queue.depth.toLocaleString() : '—'}</strong>
            <span style={{ color: 'var(--text-muted, #888)' }}> events</span>
          </div>
          {status?.counts && (
            <>
              <div>
                <span style={{ color: 'var(--text-muted, #888)' }}>Processed: </span>
                <strong>{status.counts.processed.toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted, #888)' }}>Errors: </span>
                <strong style={{ color: status.counts.errors > 0 ? '#ef4444' : 'inherit' }}>
                  {status.counts.errors.toLocaleString()}
                </strong>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Log viewer */}
      <div className="settings-group" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Consumer Log</h3>
          <button className="btn-small" onClick={fetchLogs}>🔄</button>
        </div>
        <div style={{
          backgroundColor: 'var(--bg-primary, #0f0f23)',
          border: '1px solid var(--border, #333)',
          borderRadius: '6px',
          padding: '0.75rem',
          maxHeight: '300px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          {logs.length > 0 ? logs.map((line, i) => (
            <div key={i} style={{ color: line.includes('ERROR') ? '#ef4444' : line.includes('Processed') ? '#22c55e' : 'var(--text-muted, #aaa)' }}>
              {line}
            </div>
          )) : (
            <div style={{ color: 'var(--text-muted, #666)' }}>No log output yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Scheduled Tasks Panel ────────────────────────────────────

// Banner shown inside the refreshSearchIndex card when House PoV is not configured.
// Reads /api/grapevine/preferences and renders only when povPubkey is falsy.
function HousePovUnconfiguredBanner() {
  const [povPubkey, setPovPubkey] = useState(undefined); // undefined = loading, null = unset, string = set

  useEffect(() => {
    fetch('/api/grapevine/preferences')
      .then(r => r.json())
      .then(d => setPovPubkey(d.preferences?.povPubkey || null))
      .catch(() => setPovPubkey(null));
  }, []);

  if (povPubkey === undefined) return null;
  if (povPubkey) return null;

  return (
    <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '6px',
      backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontSize: '0.85rem' }}>
      ⚠️ House PoV is not configured — the score-refresh half will be skipped until you set it in{' '}
      <a href="/tapestry/grapevine/search-preferences"
        style={{ color: '#f59e0b', textDecoration: 'underline' }}>
        Search Preferences
      </a>.
    </div>
  );
}

// Per-entry card (story #24 / ADR 0021): renames from ScheduledTaskCard
// and takes the full `entry` object instead of just a taskId. Multi-entry-
// per-task UX — Alice and Bob each get their own card on the processCustomer
// queue.
function ScheduledEntryCard({ entry, displayTitle, onEdit, onDelete, banner = null }) {
  const taskId = entry.taskId;
  const title = displayTitle || entry.label || taskId;
  const [runs, setRuns] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [enabled, setEnabled] = useState(entry.enabled);
  const [days, setDays] = useState(entry.intervalDays || 0);
  const [hours, setHours] = useState(entry.intervalHours || 0);
  const [minutes, setMinutes] = useState(entry.intervalMinutes || 0);
  const [cron, setCron] = useState(entry.cron || '');
  const [timer, setTimer] = useState(entry.timer || { active: false, nextRunAt: null, lastRunAt: null });

  function flash(msg) { setMessage(msg); setTimeout(() => setMessage(null), 4000); }
  function flashError(msg) { setError(msg); setTimeout(() => setError(null), 5000); }

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/scheduled-tasks/history?entryId=${encodeURIComponent(entry.id)}`);
      const data = await res.json();
      if (data.success) setRuns(data.runs);
    } catch (err) { console.error('Error fetching history:', err); }
  }, [entry.id]);

  useEffect(() => {
    fetchHistory().finally(() => setLoadingHistory(false));
  }, [fetchHistory]);

  // Refresh local form state when the parent passes in a refreshed entry
  // (e.g., after a successful modal save → list refetch).
  useEffect(() => {
    setEnabled(entry.enabled);
    setDays(entry.intervalDays || 0);
    setHours(entry.intervalHours || 0);
    setMinutes(entry.intervalMinutes || 0);
    setCron(entry.cron || '');
    setTimer(entry.timer || { active: false, nextRunAt: null, lastRunAt: null });
  }, [entry]);

  async function handleSave() {
    const totalMin = (parseInt(days) || 0) * 1440 + (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
    if (enabled && !cron.trim() && totalMin <= 0) {
      flashError('Enabled schedule needs a cron expression or a positive interval');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/scheduled-tasks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: entry.id, enabled,
          intervalDays: parseInt(days) || 0,
          intervalHours: parseInt(hours) || 0,
          intervalMinutes: parseInt(minutes) || 0,
          cron: cron.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        flash(data.message);
        if (data.timer) setTimer(data.timer);
      } else {
        flashError(data.error || 'Failed to update');
      }
    } catch (err) { flashError(err.message); }
    finally { setSaving(false); }
  }

  function formatDuration(ms) {
    if (!ms) return '—';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rs = s % 60;
    if (m < 60) return `${m}m ${rs}s`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }

  function formatTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }

  return (
    <>
      {message && (
        <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '6px',
          backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontSize: '0.85rem' }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '6px',
          backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Schedule Control */}
      <div className="settings-group" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {onEdit && (
              <button className="btn-small" onClick={() => onEdit(entry)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
                Edit
              </button>
            )}
            {onDelete && (
              <button className="btn-small" onClick={() => onDelete(entry)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Args summary — story #24 AC-5 "Each entry has a recognizable label that exposes its arguments". */}
        {entry.args && Object.keys(entry.args).length > 0 && (
          <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '0.5rem' }}>
            <strong>Args:</strong>{' '}
            {Object.entries(entry.args).map(([k, v]) => {
              if (k === 'customer' && typeof v === 'string' && v.length === 64) {
                return `${k}=${v.slice(0, 8)}…${v.slice(-4)}`;
              }
              return `${k}=${v}`;
            }).join(', ')}
          </div>
        )}

        {/* lastError banner — story #24 AC-10 "Deleted-customer warning". Surfaces
            entry.lastError set by entryResolver.disableEntryWithError on auto-disable. */}
        {entry.lastError && (
          <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.5rem', borderRadius: '4px',
            backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '0.8rem' }}>
            ⚠️ <strong>{entry.lastError.code}</strong>: {entry.lastError.message}
            {entry.lastError.code === 'CUSTOMER_NOT_FOUND' && <> — Customer no longer exists. Edit this entry to pick a new customer, or delete it.</>}
          </div>
        )}

        {banner}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <ToggleSwitch enabled={enabled} onChange={(val) => setEnabled(val)} />
            <span style={{ fontSize: '0.9rem' }}>{enabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Run every:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <input type="number" min="0" max="30" value={days}
              onChange={e => setDays(e.target.value)}
              style={{ width: '3.5rem', padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)',
                backgroundColor: 'rgba(0,0,0,0.3)', color: '#e0e0e0', fontSize: '0.85rem', textAlign: 'center' }} />
            <span style={{ fontSize: '0.85rem', color: '#aaa' }}>days</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <input type="number" min="0" max="23" value={hours}
              onChange={e => setHours(e.target.value)}
              style={{ width: '3.5rem', padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)',
                backgroundColor: 'rgba(0,0,0,0.3)', color: '#e0e0e0', fontSize: '0.85rem', textAlign: 'center' }} />
            <span style={{ fontSize: '0.85rem', color: '#aaa' }}>hours</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <input type="number" min="0" max="59" value={minutes}
              onChange={e => setMinutes(e.target.value)}
              style={{ width: '3.5rem', padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)',
                backgroundColor: 'rgba(0,0,0,0.3)', color: '#e0e0e0', fontSize: '0.85rem', textAlign: 'center' }} />
            <span style={{ fontSize: '0.85rem', color: '#aaa' }}>min</span>
          </label>
          <button className="btn-small" onClick={handleSave} disabled={saving}
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Cron (overrides the interval when set) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: '#aaa' }}>or cron:</span>
          <input type="text" value={cron} placeholder="e.g. 0 4 * * 0"
            onChange={e => setCron(e.target.value)}
            style={{ width: '12rem', padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)',
              backgroundColor: 'rgba(0,0,0,0.3)', color: '#e0e0e0', fontSize: '0.85rem' }} />
          <span style={{ fontSize: '0.75rem', color: '#777' }}>(cron overrides the interval)</span>
        </div>

        {/* Timer status — per-entry (story #24 AC-13). */}
        <div style={{ fontSize: '0.85rem', color: '#888', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div>
            <span style={{ width: 10, height: 10, borderRadius: '50%', display: 'inline-block', marginRight: '0.4rem',
              backgroundColor: timer.active ? '#22c55e' : '#666' }} />
            {timer.active
              ? <>Scheduler active — next run: <strong style={{ color: '#e0e0e0' }}>{formatTime(timer.nextRunAt)}</strong></>
              : 'Scheduler not active'}
          </div>
          {timer.lastRunAt && (
            <div style={{ marginLeft: '1.1rem' }}>
              Last triggered: <strong style={{ color: '#e0e0e0' }}>{formatTime(timer.lastRunAt)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Execution History — task-keyed; multi-entry-per-task entries share this list (ADR 0021 documented constraint). */}
      <div className="settings-group" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Recent Runs ({title})</h3>
          <button className="btn-small" onClick={fetchHistory} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
            Refresh
          </button>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem', fontStyle: 'italic' }}>
          Note: history is reported per task, not per entry. Entries sharing a taskId share this list.
        </div>

        {runs.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>
            No execution history found.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: '#888', fontWeight: 500 }}>Started</th>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: '#888', fontWeight: 500 }}>Duration</th>
                <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem', color: '#888', fontWeight: 500 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.4rem 0.5rem', color: '#ccc' }}>{formatTime(run.startedAt)}</td>
                  <td style={{ padding: '0.4rem 0.5rem', color: '#ccc' }}>{formatDuration(run.durationMs)}</td>
                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                    {run.status === 'success' && <span title="Success" style={{ color: '#22c55e' }}>&#x2705;</span>}
                    {run.status === 'failed' && <span title="Failed" style={{ color: '#ef4444' }}>&#x274C;</span>}
                    {run.status === 'running' && <span title="Running" style={{ color: '#f59e0b' }}>&#x23F3;</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
          <a href={`/legacy/task.html?taskName=${encodeURIComponent(taskId)}`} target="_blank"
            style={{ color: '#60a5fa', textDecoration: 'none' }}>
            View full history &rarr;
          </a>
        </div>
      </div>
    </>
  );
}

// Story #4 continuity: preserve the exact UI titles for the two migrated
// legacy entries. The auto-generated label from registry.tasks[taskId].name
// would otherwise drift from the established operator-facing copy.
const LEGACY_TITLE_OVERRIDES = {
  'legacy:updateAllScoresForOwner': 'Update All Scores for Owner',
  'legacy:refreshSearchIndex':      'Refresh Meilisearch profiles & House PoV scores',
};

// Per-entry panel (story #24 / ADR 0021). Lists every scheduled entry from
// /api/scheduled-tasks/list, with the option to add new ones via the
// AddOrEditEntryModal. Cross-references /api/get-customers at render time
// to (a) derive fresh display labels for customer-task entries when the
// operator hasn't customized the label (Q4), and (b) flag orphan entries
// whose customer was deleted (Q2 — render-time UI badge, complementing
// the fire-time auto-disable in entryResolver).
function ScheduledTasksPanel() {
  const [entries, setEntries] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null); // null | 'new' | <entry object>

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduled-tasks/list');
      const data = await res.json();
      if (data.success) setEntries(data.entries || []);
      else setError(data.error || 'Failed to load scheduled entries');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // Fetch the customer list for client-side display-label derivation +
  // deleted-customer badge cross-check (story #24 AC-5 + AC-10; T33).
  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/get-customers');
      const data = await res.json();
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
    } catch (e) {
      console.error('ScheduledTasksPanel: /api/get-customers failed:', e);
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchCustomers();
  }, [fetchList, fetchCustomers]);

  // Build a pubkey → customer lookup for fast cross-checks.
  const customerByPubkey = customers.reduce((acc, c) => {
    if (c && c.pubkey) acc[c.pubkey] = c;
    return acc;
  }, {});

  // Display-label derivation per ADR 0021 §Q4. Order of precedence:
  //   1. LEGACY_TITLE_OVERRIDES (story #4 continuity for the two migrated entries)
  //   2. Operator-customized entry.label — anything different from the
  //      auto-default task name (which is what handleCreate stores when the
  //      operator didn't type a label). ADR §Q4: "the stored entry.label
  //      is only used when the operator explicitly set it."
  //   3. Auto-derived "<task name> — <current customer name>" from the live
  //      customer list — so renames surface on next refresh.
  //   4. entry.label fallback (the auto-default task name) when the customer
  //      isn't in the customer list (orphan / not-yet-loaded — the orphan
  //      badge surfaces this case separately).
  //   5. entry.taskId as last resort.
  function computeDisplayTitle(entry) {
    if (LEGACY_TITLE_OVERRIDES[entry.id]) return LEGACY_TITLE_OVERRIDES[entry.id];
    const taskName = entry.taskName || entry.taskId;
    // Operator-customized: entry.label exists AND doesn't match the default
    // auto-fill that handleCreate writes (which is registry.tasks[taskId].name).
    const isCustomLabel = entry.label && entry.label !== taskName;
    if (isCustomLabel) return entry.label;
    if (entry.args && entry.args.customer && customerByPubkey[entry.args.customer]) {
      return `${taskName} — ${customerByPubkey[entry.args.customer].name}`;
    }
    return entry.label || entry.taskId;
  }

  // Render-time orphan check (T33). True when a customer-task entry's
  // pubkey doesn't appear in the live customer list.
  function isOrphanCustomer(entry) {
    return !!(entry.args && entry.args.customer && customers.length > 0 && !customerByPubkey[entry.args.customer]);
  }

  function renderBannerFor(entry) {
    const banners = [];
    if (entry.taskId === 'refreshSearchIndex') {
      banners.push(<HousePovUnconfiguredBanner key="house-pov" />);
    }
    if (isOrphanCustomer(entry) && !entry.lastError) {
      banners.push(
        <div key="orphan" style={{
          padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '6px',
          backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
          color: '#f59e0b', fontSize: '0.85rem',
        }}>
          ⚠️ Customer no longer exists in /api/get-customers — this entry will auto-disable on its next fire. Edit to pick a new customer or delete it.
        </div>
      );
    }
    return banners.length > 0 ? <>{banners}</> : null;
  }

  async function handleDelete(entry) {
    const force = !!entry.enabled;
    const msg = force
      ? `Entry "${entry.label || entry.taskId}" is enabled — force-delete anyway?`
      : `Delete entry "${entry.label || entry.taskId}"?`;
    if (typeof window !== 'undefined' && !window.confirm(msg)) return;
    try {
      const res = await fetch('/api/scheduled-tasks/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: entry.id, force }),
      });
      const data = await res.json();
      if (data.success) {
        fetchList();
      } else if (typeof window !== 'undefined') {
        window.alert(data.error || 'Failed to delete');
      }
    } catch (e) {
      if (typeof window !== 'undefined') window.alert(e.message);
    }
  }

  if (error) {
    return <div className="settings-section"><h2>📅 Scheduled Tasks</h2>
      <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{error}</div></div>;
  }
  if (entries === null) {
    return <div className="settings-section"><h2>📅 Scheduled Tasks</h2>
      <div style={{ color: '#888', padding: '1rem' }}>Loading scheduled entries…</div></div>;
  }

  return (
    <div className="settings-section">
      <h2>📅 Scheduled Tasks</h2>
      <p className="settings-hint">
        Schedule any parameterized task — including <code>processCustomer</code> per customer on independent cadences.
        Each entry has its own enable toggle, schedule (interval or cron, down to minutes), and arguments.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <button className="btn-small" onClick={() => setEditingEntry('new')}
          style={{ padding: '0.4rem 0.75rem', fontSize: '0.9rem' }}>
          + Add Scheduled Entry
        </button>
      </div>

      {entries.length === 0 ? (
        <p style={{ color: '#888', fontSize: '0.85rem' }}>
          No scheduled entries yet — use “Add Scheduled Entry” above to create one.
        </p>
      ) : (
        entries.map((entry) => (
          <ScheduledEntryCard
            key={entry.id}
            entry={entry}
            displayTitle={computeDisplayTitle(entry)}
            onEdit={() => setEditingEntry(entry)}
            onDelete={() => handleDelete(entry)}
            banner={renderBannerFor(entry)}
          />
        ))
      )}

      {editingEntry && (
        <AddOrEditEntryModal
          entry={editingEntry === 'new' ? null : editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={() => { setEditingEntry(null); fetchList(); }}
        />
      )}
    </div>
  );
}

const RELAY_TABS = [
  { key: 'router', label: '🔄 Router Management' },
  { key: 'sync', label: '🔃 Negentropy Sync' },
  { key: 'config', label: '📡 Relay Configuration' },
  { key: 'etl', label: '⚡ Streaming ETL' },
  { key: 'schedule', label: '📅 Scheduled Tasks' },
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

      {activeTab === 'etl' && <StreamingETLPanel />}

      {activeTab === 'schedule' && <ScheduledTasksPanel />}
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
