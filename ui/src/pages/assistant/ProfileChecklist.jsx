import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PROFILE_ITEMS, PROFILE_CONTENT_FIELDS } from '@tapestry/assistant-profile-items';
import TopBar from '../../components/TopBar';
import { useAuth } from '../../context/AuthContext';
import { useAssistantAttention } from '../../context/AssistantAttentionContext';
import { ASSISTANT_MANAGEMENT_PATH } from '../../config/avatarMenuLinks';
import { relayLine, publishTone } from '../../utils/taggingPublishReport';
import { stampMyPicture, storeStampedAvatar } from '../../utils/stampedAvatar';
import ActionText from './ActionText';
import { ASSISTANT_ACTIONS, ASSISTANT_COPY } from './actions';
import {
  PROFILE_CHECKLIST_COPY as COPY, panelState, panelLine, fixFor, applyProfileFix, summaryText, describeProfilePublish, fill,
} from './profileChecklistCopy';

/**
 * /assistant/profile — Your Tapestry Assistant's Profile, as a checklist (assistant-profile-checklist #2, ADR 0002; the
 * avatar panel's fix from #3, ADR 0003 sub-decision 9).
 *
 * Seven panels, one per item of the shared list (@tapestry/assistant-profile-items), each a region named by its title.
 * Their states come from the one attention answer the hub and the Assistant Alert read (AssistantAttentionContext,
 * ADR 0001); the page fetches nothing to draw them. A panel that needs attention offers its one-click fix where one fits
 * (fixFor): the press reads the Assistant's current profile and the default from /api/assistant/status, changes only
 * what the fix is about (applyProfileFix), and publishes through the one writer of an Assistant's kind 0,
 * POST /api/assistant/publish-profile (ADR assistant-profile/0005), as the editor's Publish does. Each relay's answer is
 * shown in the editor's words, and the answer is asked again whatever happened. One fix at a time: while one is in
 * flight (`fixing`), every fix button waits.
 *
 * The avatar panel's fix stamps the person's own picture in the browser (ui/src/utils/stampedAvatar.js), shows it, and
 * only on "Publish this avatar" stores it and republishes with the picture changed.
 *
 * Results and the preview live until the next press or a navigation; nothing is stored in the browser.
 */

const ACTION = ASSISTANT_ACTIONS.find((a) => a.key === 'profile');
const TONE_ICON = { success: '✅ ', warning: '⚠️ ', info: 'ℹ️ ', error: '❌ ' };
const MARKED = ['needs-attention', 'checking', 'could-not-check'];

/** One publish result: the summary, then one line per relay. */
function Result({ report }) {
  const tone = publishTone(report);
  return (
    <div className={`bs-idtags-result is-${tone}`}>
      {TONE_ICON[tone] || ''}{report.message}
      {report.rows.length > 0 && (
        <div className="bs-idtags-result-relays">
          {report.rows.map((row) => (
            <div key={row.relay}><code>{row.relay}</code> — {relayLine(row)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** One panel: its marks, title, description, line, then whatever the page puts in it (a fix, a preview, a result). */
function Panel({ item, state, line, domain, children }) {
  const words = COPY.panels[item.key];
  const marked = MARKED.includes(state);
  const done = state === 'done';
  const headingId = `bs-profile-check-${item.key}`;
  return (
    <section className={`bs-idtags-card${marked ? ' is-marked' : ''}${done ? ' is-done' : ''}`} aria-labelledby={headingId}>
      <span className="bs-idtags-card-marker" aria-hidden="true">{done ? '✓' : marked ? '!' : ''}</span>
      <div className="bs-idtags-card-body">
        <div className="bs-idtags-card-head">
          {marked && <span className="bs-sr-only">{ASSISTANT_COPY.needsAttentionSrPrefix}</span>}
          {done && <span className="bs-sr-only">{ASSISTANT_COPY.doneSrPrefix}</span>}
          <h2 id={headingId} className="bs-idtags-card-title">{words.title}</h2>
          {marked && <span className="bs-setup-step-badge" aria-hidden="true">{ASSISTANT_COPY.needsAttention}</span>}
          {done && <span className="bs-setup-step-badge is-done" aria-hidden="true">{ASSISTANT_COPY.done}</span>}
          {state === 'coming-soon' && <span className="bs-setup-step-badge is-neutral">{COPY.comingSoon}</span>}
        </div>
        <p className="bs-profile-check-text">{fill(words.description, { domain: domain || 'This instance' })}</p>
        {line && <p className="bs-profile-check-line">{line}</p>}
        {children}
      </div>
    </section>
  );
}

export default function ProfileChecklistPage() {
  const { user, loading, login } = useAuth();
  const attention = useAssistantAttention();
  const signedIn = !loading && !!user;
  const signedOut = !loading && !user;
  const hasAssistant = signedIn && !!user.assistantPubkey;

  const phase = hasAssistant ? attention.phase : 'idle';
  const action = phase === 'answered' && attention.answered ? attention.actions.profile : undefined;
  const instance = action && action.instance ? action.instance : null;
  const rowOf = (key) => (action && Array.isArray(action.items) ? action.items.find((r) => r && r.key === key) : undefined);

  // The one fix in flight (an item's key, or 'notice'), the results by key, and the avatar panel's preview.
  const [fixing, setFixing] = useState(null);
  const [results, setResults] = useState({});
  const [avatar, setAvatar] = useState({ preview: null, notice: null, noPublicAddress: false });

  /**
   * One press (ADR 0002 sub-decision 6): read the current profile and the default, change only what `fix` is about,
   * publish through the one writer, report, and ask for the answer again.
   */
  async function runFix(key, fix, extra = {}) {
    setFixing(key);
    setResults((prev) => { const next = { ...prev }; delete next[key]; return next; });
    let report;
    try {
      const statusRes = await fetch(`/api/assistant/status?customerPubkey=${user.pubkey}`);
      const status = await statusRes.json().catch(() => null);
      // Publish only when this read agrees with what the page offered (ADR 0002 Amendment 1): its scan is not strict, so
      // a failed read also says "no profile", and the default would replace a real one everywhere.
      const agrees = status && (fix === 'publish-default' ? status.hasProfile === false : status.hasProfile === true);
      if (!status || status.success !== true || !agrees) {
        report = describeProfilePublish(null);
      } else {
        const content = applyProfileFix(fix, { status, instance, fields: PROFILE_CONTENT_FIELDS, ...extra });
        const res = await fetch('/api/assistant/publish-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerPubkey: user.pubkey, content }),
        });
        report = describeProfilePublish(await res.json().catch(() => null));
      }
    } catch {
      report = describeProfilePublish(null);
    }
    setResults((prev) => ({ ...prev, [key]: report }));
    setFixing(null);
    attention.refresh();
  }

  /** The avatar panel: stamp the person's own picture and show it. Nothing is stored or published (story 3 AC-2). */
  async function makeAvatar() {
    setFixing('avatar');
    setAvatar({ preview: null, notice: null, noPublicAddress: false });
    setResults((prev) => { const next = { ...prev }; delete next.avatar; return next; });
    const stamped = await stampMyPicture();
    setFixing(null);
    if (stamped.ok) setAvatar({ preview: stamped.composite, notice: null, noPublicAddress: false });
    else setAvatar({ preview: null, notice: COPY.avatar[stamped.reason] || stamped.message || COPY.requestFailed, noPublicAddress: false });
  }

  /** Store the accepted avatar, then publish it as the picture through the one writer (story 3 AC-3). */
  async function publishAvatar() {
    if (!avatar.preview) return;
    setFixing('avatar');
    const stored = await storeStampedAvatar(avatar.preview.blob);
    if (!stored.ok) {
      setFixing(null);
      if (stored.reason === 'no-public-address') setAvatar((prev) => ({ ...prev, noPublicAddress: true, notice: null }));
      else setAvatar((prev) => ({ ...prev, notice: stored.message || COPY.requestFailed }));
      return;
    }
    setAvatar({ preview: null, notice: null, noPublicAddress: false });
    await runFix('avatar', 'set-picture', { url: stored.url });
  }

  const busy = fixing !== null;
  const fixButton = (key, fix, label) => (
    <div className="bs-idtags-actions">
      <button type="button" className="bs-idtags-publish" disabled={fixing !== null} onClick={() => runFix(key, fix)}>
        {fixing === key ? COPY.publishing : label}
      </button>
    </div>
  );
  const resultOf = (key) => (results[key] ? <div className="bs-idtags-results" aria-live="polite"><Result report={results[key]} /></div> : null);

  /** What the avatar panel holds below its line: the fix, the preview and its two buttons, or what went wrong. */
  function avatarControls(row, state) {
    if (!hasAssistant || state !== 'needs-attention' || !row || row.reason === 'no-profile') return null;
    const stamping = fixing === 'avatar' && !avatar.preview;
    return (
      <>
        {!avatar.preview && (
          <div className="bs-idtags-actions">
            <button type="button" className="bs-idtags-publish" disabled={busy} onClick={makeAvatar}>
              {stamping ? COPY.avatar.making : COPY.avatar.fix}
            </button>
          </div>
        )}
        {avatar.preview && (
          <div className="bs-profile-check-preview">
            <img src={avatar.preview.dataUrl} alt={COPY.panels.avatar.title} width="128" height="128" />
            {/* With no public address the publish gives way to the reason — said once: on a dev box the panel's own
                line already says it (ADR 0003 sub-decision 9). */}
            {avatar.noPublicAddress && row.reason !== 'no-public-address' && (
              <p className="bs-profile-check-line">{COPY.noPublicAddress}</p>
            )}
            <div className="bs-idtags-actions bs-profile-check-buttons">
              {!avatar.noPublicAddress && (
                <button type="button" className="bs-idtags-publish" disabled={busy} onClick={publishAvatar}>
                  {fixing === 'avatar' ? COPY.publishing : COPY.avatar.accept}
                </button>
              )}
              <button
                type="button"
                className="bs-link-btn"
                disabled={busy}
                onClick={() => setAvatar({ preview: null, notice: null, noPublicAddress: false })}
              >
                {COPY.avatar.discard}
              </button>
            </div>
          </div>
        )}
        {avatar.notice && <p className="bs-profile-check-line" aria-live="polite">{avatar.notice}</p>}
      </>
    );
  }

  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-setup-main">
        <Link to={ASSISTANT_MANAGEMENT_PATH} className="bs-setup-back">{ASSISTANT_COPY.backToHub}</Link>
        <h1 className="bs-setup-title">{ACTION.title}</h1>
        <p className="bs-idtags-description"><ActionText parts={ACTION.description} /></p>

        {hasAssistant && <p className="bs-assistant-hub-count">{summaryText(action, phase)}</p>}

        {signedOut && (
          <div className="bs-setup-signin">
            <p>{COPY.signedOut}</p>
            {/* Failures are reported by the shared sign-in modal. */}
            <button type="button" className="bs-link-btn" onClick={() => login().catch(() => {})}>
              {ASSISTANT_COPY.signInButton}
            </button>
          </div>
        )}

        {signedIn && !hasAssistant && (
          <div className="bs-setup-signin">
            <p>{ASSISTANT_COPY.noAssistantLine}</p>
            <Link to="/setup" className="bs-assistant-hub-setup-link">{ASSISTANT_COPY.noAssistantLink}</Link>
          </div>
        )}

        {hasAssistant && action && action.hasProfile === false && (
          <div className="bs-setup-signin bs-profile-check-notice">
            <p>{COPY.noProfileNotice}</p>
            <button type="button" className="bs-idtags-publish" disabled={busy} onClick={() => runFix('notice', 'publish-default')}>
              {fixing === 'notice' ? COPY.publishing : COPY.noProfileFix}
            </button>
            {resultOf('notice')}
          </div>
        )}

        {PROFILE_ITEMS.map((item) => {
          const row = rowOf(item.key);
          const state = panelState(item, row, phase, action);
          const line = panelLine(item, row, phase, action);
          const fix = hasAssistant && state === 'needs-attention' ? fixFor(row, instance) : null;
          return (
            <Panel key={item.key} item={item} state={state} line={line} domain={instance && instance.domain}>
              {item.key === 'avatar' && avatarControls(row, state)}
              {fix && fixButton(item.key, fix.fix, fix.label)}
              {resultOf(item.key)}
            </Panel>
          );
        })}

        {ACTION.editLink && (
          <p className="bs-profile-check-editor">
            <Link to={ACTION.editLink.to} className="bs-assistant-hub-edit-link">{ACTION.editLink.text}</Link>
          </p>
        )}
      </main>
    </div>
  );
}
