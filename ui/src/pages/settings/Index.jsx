import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import RelaySettings from './RelaySettings';
import UuidSettings from './UuidSettings';
import SystemSettings from './SystemSettings';

export default function SettingsIndex() {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [overrides, setOverrides] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('relays');
  const [needsRestart, setNeedsRestart] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  const isOwner = user?.classification === 'owner';

  useEffect(() => {
    if (!isOwner) return;
    fetchSettings();
  }, [isOwner]);

  async function fetchSettings() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSettings(data.settings);
      setDefaults(data.defaults);
      setOverrides(data.overrides);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(patch) {
    try {
      setSaveMessage(null);
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.details ? data.details.join('; ') : data.error);
      setSettings(data.settings);
      setOverrides(data.overrides);
      if (data.needsRestart) setNeedsRestart(true);
      setSaveMessage({ type: 'success', text: 'Settings saved' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.message });
    }
  }

  async function handleReset(keyPath) {
    try {
      setSaveMessage(null);
      const res = await fetch(`/api/settings/${keyPath}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSettings(data.settings);
      setOverrides(data.overrides);
      setSaveMessage({ type: 'success', text: `Reset ${keyPath} to default` });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.message });
    }
  }

  if (authLoading) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>⚙️ Settings</h1>
        <p>Checking authentication…</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>⚙️ Settings</h1>
        <div className="settings-auth-gate">
          <p>🔒 Settings are only available to the owner.</p>
          {!user && <p>Please sign in with NIP-07 to continue.</p>}
          {user && <p>You are signed in as <strong>{user.classification}</strong>. Owner access is required.</p>}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>⚙️ Settings</h1>
        <p>Loading settings…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>⚙️ Settings</h1>
        <p className="error">Error: {error}</p>
      </div>
    );
  }

  const tabs = [
    { key: 'relays', label: '📡 Relays' },
    { key: 'uuids', label: '🔑 Concept UUIDs' },
    { key: 'system', label: '🖥️ System' },
  ];

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>⚙️ Settings</h1>
      <p className="subtitle">
        Configure relays, concept UUIDs, and system parameters.
        Overrides are stored on the persistent volume and survive rebuilds.
      </p>

      {needsRestart && (
        <div className="settings-restart-banner">
          ⚠️ Some changes require a restart to take effect.
        </div>
      )}

      {saveMessage && (
        <div className={`settings-message settings-message-${saveMessage.type}`}>
          {saveMessage.text}
        </div>
      )}

      <div className="tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-content">
        {activeTab === 'relays' && (
          <RelaySettings
            settings={settings}
            defaults={defaults}
            overrides={overrides}
            onSave={handleSave}
            onReset={handleReset}
          />
        )}
        {activeTab === 'uuids' && (
          <UuidSettings
            settings={settings}
            defaults={defaults}
            overrides={overrides}
            onSave={handleSave}
            onReset={handleReset}
          />
        )}
        {activeTab === 'system' && (
          <SystemSettings
            settings={settings}
            defaults={defaults}
            overrides={overrides}
            onSave={handleSave}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
