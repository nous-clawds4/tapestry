import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { buildCompositeAvatar } from '../utils/compositeAvatar';

// Story 2's branded image, served from the instance root — for the in-app preview
// only. The picture VALUE the editor offers is always the server's absolute
// status.defaults.picture: a relative path in a published profile resolves against
// the reader's own machine (ADR assistant-profile/0003).
const BRANDED_FALLBACK_SRC = '/ta-avatar.png';

// NIP-05 is omitted on purpose — the server computes it deterministically
// from the caller's name + the Assistant's pubkey, and on a public instance only
// publishes it and writes the matching /.well-known/nostr.json entry (ADR
// assistant-profile/0003). Users don't get to set it.
const PROFILE_FIELDS = [
  { key: 'name', label: 'Name', placeholder: 'e.g. Alice\'s Tapestry Assistant' },
  { key: 'display_name', label: 'Display name', placeholder: 'Shown in nostr clients' },
  { key: 'about', label: 'About', placeholder: 'Short description of what this assistant does', multiline: true },
  { key: 'picture', label: 'Picture URL', placeholder: 'https://example.com/avatar.png' },
  { key: 'banner', label: 'Banner URL', placeholder: 'https://example.com/banner.png' },
  { key: 'website', label: 'Website', placeholder: 'https://example.com' },
  { key: 'lud16', label: 'Lightning address', placeholder: 'name@example.com' },
];

// What each relay did with the profile, in the words the story uses: the server's `refused` is what a
// reader calls rejected (ADR assistant-profile/0002).
const RELAY_WORDS = {
  accepted: 'accepted',
  refused: 'rejected',
  unreachable: 'unreachable',
  timeout: 'timed out',
  skipped: 'skipped',
};

function relayOutcomeText(row) {
  const word = RELAY_WORDS[row.status] || row.status;
  if (row.status === 'skipped') return `${word} (${row.reason || 'local-only publish mode'})`;
  return row.reason ? `${word}: ${row.reason}` : word;
}

/** A partial or empty result must never read as a clean success. */
function publishResultTone(result) {
  if (!result || !result.ok) return 'error';
  if (result.outcome === 'kept-local') return 'info';
  const tried = (result.rows || []).filter((row) => row.status !== 'skipped');
  return tried.length > 0 && tried.every((row) => row.status === 'accepted') ? 'success' : 'warning';
}

const TONE_ICON = { success: '✅ ', warning: '⚠️ ', info: 'ℹ️ ', error: '❌ ' };
const TONE_STYLE = {
  warning: { backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' },
  info: { backgroundColor: 'rgba(148, 163, 184, 0.1)', border: '1px solid rgba(148, 163, 184, 0.3)' },
};

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

/**
 * The one assistant profile editor, hosted by the Edit Assistant Profile page only (assistant-profile #4, ADR 0004;
 * that page moved to /assistant/profile/edit with assistant-management #1).
 *
 * @param {object} props
 * @param {string} props.customerPubkey - the signed-in person, whose own assistant this edits
 * @param {boolean} [props.canCreateAssistant=false] - may they create an assistant here if they have none
 *   (an Admin or a Customer; never the Owner, whose assistant is the instance TA)
 * @param {() => void} [props.onAssistantCreated] - called once a new assistant key exists
 */
export default function AssistantProfileEditor({ customerPubkey, canCreateAssistant = false, onAssistantCreated }) {
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState(null);
  // The stamped composite (ta-avatar #3). `composite` holds the preview until the
  // owner accepts it — generating publishes and stores nothing on its own.
  const [composite, setComposite] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [compositeNotice, setCompositeNotice] = useState(null);
  const [offerFallback, setOfferFallback] = useState(false);

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

  /**
   * Build the stamped avatar and show it. Deliberately stores nothing: the owner
   * sees the composite first and accepts it (AC1 — "before anything is published").
   */
  async function generateComposite() {
    setGenerating(true);
    setCompositeNotice(null);
    setOfferFallback(false);
    setComposite(null);
    try {
      // Same-origin proxy, so the canvas is not tainted. Its 404 with code 'no-picture' means the
      // owner has no picture — the fallback path, not an error. Any other failure (a refusal, a picture
      // host that failed) is reported in the server's own words (assistant-profile #4, AC4).
      const res = await fetch('/api/assistant/owner-avatar');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setOfferFallback(true);
        if (res.status === 404 && body?.code === 'no-picture') {
          setCompositeNotice(
            'You have no profile picture to stamp yet, so there is nothing to composite. '
            + 'You can use the branded Tapestry image instead, or set a picture on your own profile and try again.');
        } else {
          setCompositeNotice(
            `Could not get your profile picture to stamp: ${body?.error || `the server answered ${res.status}`}. `
            + 'You can use the branded Tapestry image instead.');
        }
        return;
      }
      const built = await buildCompositeAvatar(await res.blob());
      setComposite(built);
    } catch (err) {
      setOfferFallback(true);
      setCompositeNotice(`Could not build the composite (${err.message}). You can use the branded image instead.`);
    } finally {
      setGenerating(false);
    }
  }

  /** Store the accepted composite and point the picture field at it (AC2). */
  async function useComposite() {
    if (!composite) return;
    setGenerating(true);
    setCompositeNotice(null);
    try {
      const body = new FormData();
      body.append('avatar', composite.blob, 'ta-avatar.png');
      const res = await fetch('/api/assistant/avatar', { method: 'POST', body });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');
      // Only a publishable URL goes into the picture. With no public address the
      // instance returns none, and its relative path would be dead for everyone else.
      if (!data.url) {
        setComposite(null);
        setOfferFallback(true);
        setCompositeNotice('This instance has no public web address, so nostr clients elsewhere could not load '
          + 'an avatar stored here. Use the branded image instead.');
        return;
      }
      updateField('picture', data.url);
      setCompositeNotice('Saved. Publish the profile to point your assistant at it.');
      setComposite(null);
    } catch (err) {
      setCompositeNotice(`Could not save the composite: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }

  function useBrandedFallback() {
    // The server's default picture is always the branded avatar at an absolute URL —
    // this instance's copy, or the reference deployment's when it is not public.
    const offered = status?.defaults?.picture;
    setOfferFallback(false);
    if (typeof offered === 'string' && offered) {
      updateField('picture', offered);
      setCompositeNotice('Using the branded Tapestry image.');
    } else {
      setCompositeNotice('This instance offered no branded image, so the picture was left as it was.');
    }
  }

  function resetToDefaults() {
    if (!status?.defaults) return;
    setForm(pickFields(status.defaults));
    setComposite(null);
    setOfferFallback(false);
    setCompositeNotice(null);
    setPublishResult(null);
  }

  async function provisionKey() {
    setProvisioning(true);
    setProvisionError(null);
    try {
      const res = await fetch('/api/assistant/provision-key', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Provisioning failed');
      // Key created; reload status so the editor flips into the form view, then tell the host, so the
      // rest of the app (menus, the dashboard's check, the banner) learns about the new assistant.
      await loadStatus();
      if (onAssistantCreated) onAssistantCreated();
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
      setPublishResult({
        ok: true,
        outcome: data.outcome,
        message: data.message,
        rows: (data.relays && data.relays.results) || [],
      });
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
    // No key behind this person. Only what can succeed is offered (ADR assistant-profile/0004 sub-decision 4):
    // the Owner's assistant is the instance TA, which provisioning cannot restore, and only someone who may
    // create an assistant of their own is offered to.
    if (status?.isOwner) {
      return (
        <div className="settings-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ margin: '0 0 0.25rem' }}>🤖 Tapestry Assistant Profile</h3>
          <p style={{ margin: 0, opacity: 0.8 }}>
            This instance's Tapestry Assistant key is missing. It is created when the instance is first set up
            and can't be created from this page; it has to be restored on the server before this assistant's
            profile can be managed here.
          </p>
        </div>
      );
    }
    if (!canCreateAssistant) {
      return (
        <div className="settings-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ margin: '0 0 0.25rem' }}>🤖 Your Tapestry Assistant Profile</h3>
          <p style={{ margin: 0, opacity: 0.8 }}>
            You don't have a Tapestry Assistant on this instance, and your account can't create one here.
          </p>
        </div>
      );
    }
    return (
      <div className="settings-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ margin: '0 0 0.25rem' }}>🤖 Your Tapestry Assistant Profile</h3>
        <p style={{ margin: 0, opacity: 0.8 }}>
          You don't have a server-side Tapestry Assistant key yet. Create one to start publishing a kind 0
          profile and kind 30382 Trust Assertions from your Assistant.
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

  const tone = publishResult ? publishResultTone(publishResult) : null;

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

      <div style={{ fontSize: '0.8rem', opacity: 0.8, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div>
          <strong>Assistant pubkey:</strong>{' '}
          <code>{shortPk}</code>{' '}
          {/* The public profile — the page search results link to, on the page's own (Brainstorm) side. */}
          <Link
            to={`/user/${status.assistantPubkey}`}
            style={{ color: '#58a6ff', textDecoration: 'none', marginLeft: '0.25rem' }}
          >
            View public profile →
          </Link>
        </div>
        {status.computedNip05?.address && (
          <div>
            <strong>NIP-05:</strong> <code>{status.computedNip05.address}</code>{' '}
            <span style={{ opacity: 0.6 }}>(server-managed, updates on publish)</span>
          </div>
        )}
        {!status.computedNip05?.address && status.isPublicInstance === false && (
          <div>
            <strong>NIP-05:</strong> none — this instance has no public web address, so no NIP-05 is published.
          </div>
        )}
        <div>
          <strong>Currently published:</strong>{' '}
          {status.hasProfile
            ? <span style={{ color: '#22c55e' }}>✅ Yes</span>
            : <span style={{ color: '#f59e0b' }}>⚠️ Not yet</span>}
        </div>
      </div>

      {/* The stamped composite: your avatar, wearing the mark (ta-avatar #3). The Owner's only
          (assistant-profile #4, AC4): the proxy reads the OWNER's picture, so an Admin's assistant would
          wear the Owner's face, and a Customer is refused. */}
      {status.isOwner && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="settings-action-btn settings-action-btn-secondary"
              onClick={generateComposite}
              disabled={generating || publishing}
            >
              {generating ? 'Working…' : '🎨 Generate badged avatar'}
            </button>
            <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>
              Stamps your own profile picture with the Tapestry mark.
            </span>
          </div>

          {composite && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <img
                className="ta-composite-preview"
                src={composite.dataUrl}
                alt="Preview of the assistant avatar: your picture with the Tapestry mark"
                width={96}
                height={96}
                style={{ borderRadius: '50%', border: '1px solid var(--border, #444)' }}
              />
              <button className="settings-action-btn" onClick={useComposite} disabled={generating}>
                Use this avatar
              </button>
            </div>
          )}

          {offerFallback && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <img
                className="ta-composite-fallback"
                src={BRANDED_FALLBACK_SRC}
                alt="The branded Tapestry Assistant image"
                width={96}
                height={96}
                style={{ borderRadius: '50%', border: '1px solid var(--border, #444)' }}
              />
              <button className="settings-action-btn" onClick={useBrandedFallback} disabled={generating}>
                Use the branded image instead
              </button>
            </div>
          )}

          {compositeNotice && (
            <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>{compositeNotice}</div>
          )}
        </div>
      )}

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
          className={`settings-message${tone === 'success' ? ' settings-message-success' : ''}${tone === 'error' ? ' settings-message-error' : ''}`}
          style={{ marginTop: 0, ...(TONE_STYLE[tone] || null) }}
        >
          {TONE_ICON[tone] || ''}
          {publishResult.message}
          {publishResult.ok && (publishResult.rows || []).length > 0 && (
            <div style={{ fontSize: '0.75rem', marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {publishResult.rows.map(row => (
                <div key={row.relay}>
                  <code>{row.relay}</code> — {relayOutcomeText(row)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
