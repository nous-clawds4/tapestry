import { useState, useEffect, useCallback } from 'react';

const PROFILE_FIELDS = [
  { key: 'name', label: 'Name', placeholder: 'e.g. Alice\'s Tapestry Assistant' },
  { key: 'display_name', label: 'Display name', placeholder: 'Shown in nostr clients' },
  { key: 'about', label: 'About', placeholder: 'Short description of what this assistant does', multiline: true },
  { key: 'picture', label: 'Picture URL', placeholder: 'https://example.com/avatar.png' },
  { key: 'banner', label: 'Banner URL', placeholder: 'https://example.com/banner.png' },
  { key: 'website', label: 'Website', placeholder: 'https://example.com' },
  { key: 'nip05', label: 'NIP-05', placeholder: 'name@example.com' },
  { key: 'lud16', label: 'Lightning address', placeholder: 'name@example.com' },
];

const labelStyle = { fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' };
const inputStyle = {
  padding: '0.4rem 0.6rem',
  fontSize: '0.85rem',
  backgroundColor: 'var(--bg-primary, #0f0f23)',
  color: 'var(--text-primary, #e0e0e0)',
  border: '1px solid var(--border, #444)',
  borderRadius: '4px',
  width: '100%',
  boxSizing: 'border-box',
};

function emptyForm() {
  return PROFILE_FIELDS.reduce((acc, f) => { acc[f.key] = ''; return acc; }, {});
}

function pickFields(source) {
  if (!source || typeof source !== 'object') return emptyForm();
  return PROFILE_FIELDS.reduce((acc, f) => {
    acc[f.key] = typeof source[f.key] === 'string' ? source[f.key] : '';
    return acc;
  }, {});
}

export default function AssistantProfileEditor({ customerPubkey }) {
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState(null);

  const loadStatus = useCallback(async () => {
    if (!customerPubkey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assistant/status?customerPubkey=${customerPubkey}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load assistant status');
      setStatus(data);
      // Prefer existing published profile if present, else use server-provided defaults
      const source = data.hasProfile ? data.profile : data.defaults;
      setForm(pickFields(source));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [customerPubkey]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  function updateField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
    setPublishResult(null);
  }

  function resetToDefaults() {
    if (!status?.defaults) return;
    setForm(pickFields(status.defaults));
    setPublishResult(null);
  }

  async function provisionKey() {
    setProvisioning(true);
    setProvisionError(null);
    try {
      const res = await fetch('/api/assistant/provision-key', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Provisioning failed');
      // Key created; reload status so the editor flips into the form view.
      await loadStatus();
    } catch (err) {
      setProvisionError(err.message);
    } finally {
      setProvisioning(false);
    }
  }

  async function publish() {
    if (!customerPubkey) return;
    setPublishing(true);
    setPublishResult(null);
    try {
      const res = await fetch('/api/assistant/publish-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerPubkey, content: form }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Publish failed');
      setPublishResult({ ok: true, message: data.message, relays: data.relays });
      // Reload status so the "currently published" section refreshes
      await loadStatus();
    } catch (err) {
      setPublishResult({ ok: false, message: err.message });
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return <div className="settings-group"><p>Loading assistant profile…</p></div>;
  }

  if (error) {
    return (
      <div className="settings-group">
        <p style={{ color: '#ef4444' }}>Error: {error}</p>
        <button className="settings-action-btn" onClick={loadStatus}>Retry</button>
      </div>
    );
  }

  if (!status?.hasRelayKey) {
    return (
      <div className="settings-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ margin: '0 0 0.25rem' }}>
          {status?.isOwner ? '🤖 Tapestry Assistant Profile' : '🤖 Your Tapestry Assistant Profile'}
        </h3>
        <p style={{ margin: 0, opacity: 0.8 }}>
          You don't have a server-side Tapestry Assistant key yet. Create one to start publishing
          {status?.isOwner ? ' automated events' : ' a kind 0 profile and kind 30382 Trust Assertions'} from your Assistant.
        </p>
        <div>
          <button
            className="settings-action-btn"
            onClick={provisionKey}
            disabled={provisioning}
          >
            {provisioning ? 'Creating…' : 'Create my Tapestry Assistant key'}
          </button>
        </div>
        {provisionError && (
          <div className="settings-message settings-message-error" style={{ marginTop: 0 }}>
            ❌ {provisionError}
          </div>
        )}
      </div>
    );
  }

  const shortPk = status.assistantPubkey
    ? `${status.assistantPubkey.slice(0, 12)}…${status.assistantPubkey.slice(-8)}`
    : '';

  return (
    <div className="settings-group" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h3 style={{ margin: '0 0 0.25rem' }}>
          {status.isOwner ? '🤖 Tapestry Assistant Profile' : '🤖 Your Tapestry Assistant Profile'}
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75 }}>
          {status.isOwner
            ? 'The kind 0 profile published by this instance\'s Tapestry Assistant — the server-side identity that signs automated events.'
            : 'The kind 0 profile published by your server-side Tapestry Assistant — the identity that signs your kind 30382 Trust Assertions.'}
        </p>
      </div>

      <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
        <div><strong>Assistant pubkey:</strong> <code>{shortPk}</code></div>
        <div>
          <strong>Currently published:</strong>{' '}
          {status.hasProfile
            ? <span style={{ color: '#22c55e' }}>✅ Yes</span>
            : <span style={{ color: '#f59e0b' }}>⚠️ Not yet</span>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {PROFILE_FIELDS.map(field => (
          <div key={field.key}>
            <label style={labelStyle}>{field.label}</label>
            {field.multiline ? (
              <textarea
                value={form[field.key]}
                onChange={e => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={4}
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              />
            ) : (
              <input
                type="text"
                value={form[field.key]}
                onChange={e => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
                style={inputStyle}
              />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className="settings-action-btn"
          onClick={publish}
          disabled={publishing}
        >
          {publishing ? 'Publishing…' : status.hasProfile ? 'Re-publish profile' : 'Publish profile'}
        </button>
        <button
          className="settings-action-btn settings-action-btn-secondary"
          onClick={resetToDefaults}
          disabled={publishing}
          type="button"
        >
          Reset to defaults
        </button>
      </div>

      {publishResult && (
        <div
          className={`settings-message settings-message-${publishResult.ok ? 'success' : 'error'}`}
          style={{ marginTop: 0 }}
        >
          {publishResult.ok ? '✅ ' : '❌ '}
          {publishResult.message}
          {publishResult.ok && publishResult.relays && (
            <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>
              Pushed to local strfry + {publishResult.relays.success}/{publishResult.relays.total} external relays.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
