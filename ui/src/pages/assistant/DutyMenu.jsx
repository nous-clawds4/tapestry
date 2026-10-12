import { useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { useAuth } from '../../context/AuthContext';
import { useAssistantAttention } from '../../context/AssistantAttentionContext';
import { ASSISTANT_MANAGEMENT_PATH } from '../../config/avatarMenuLinks';
import { publishAssistantDutyMenu } from '../../utils/publishAssistantDutyMenu';
// publishTone is the report's tone rule, not a publish: named apart so the page's only publish call is the helper's.
import { describeServerPublish, publishTone as reportTone, relayLine } from '../../utils/taggingPublishReport';
import ActionText from './ActionText';
import { ASSISTANT_ACTIONS, ASSISTANT_COPY, assistantAttention } from './actions';
import { DUTY_MENU_COPY, categoryOf, statusLine } from './dutyMenuCopy';

/**
 * /assistant/duty-menu — the Duty Menu page (assistant-duty-menu #1 and #2, ADRs 0001 and 0002).
 *
 * Two panels, in the Identification Tags page's frame and cards. The first shows the offer: one line per row that
 * this instance offers for the viewer's own Assistant, with its Treasure Map category, its key and its relay. The
 * second shows the menu found for that Assistant now, the same way, with the hub's mark for this action; while the
 * answer is on its way, or when the check did not finish, it shows that instead. Under them, one status line (only
 * for a finished check) and the line saying the menu is public.
 *
 * Everything the page shows comes from the one answer the hub and the Assistant Alert read too
 * (AssistantAttentionContext: actions['duty-menu']); the page fetches nothing itself. Its one button (story 2) has the
 * Assistant sign and publish its menu through one request (publishAssistantDutyMenu), which names nothing: the server
 * builds the menu from its own offer. The report is drawn as the Outbox Relays page draws its own, and once a menu was
 * written the answer is asked for again.
 */

const ACTION_KEY = 'duty-menu';
const ACTION = ASSISTANT_ACTIONS.find((a) => a.key === ACTION_KEY);
const TONE_ICON = { success: '✅ ', warning: '⚠️ ', info: 'ℹ️ ', error: '❌ ' };
const NONE = [];

/** The publish's report: the summary, the empty-menu line when it applies, then one line per relay. */
function Report({ report, empty }) {
  const tone = reportTone(report);
  return (
    <div className={`bs-idtags-result is-${tone}`}>
      {TONE_ICON[tone] || ''}{report.message}
      {empty && <div className="bs-outbox-note">{DUTY_MENU_COPY.publish.empty}</div>}
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

/** A menu's rows, one line each: the category, the key, and the relay or the exception's words. */
function Rows({ rows }) {
  return (
    <ul className="bs-outbox-relays">
      {rows.map((row) => {
        const category = categoryOf(row.key);
        return (
          <li key={`${row.tag}|${row.key}`} className="bs-dutymenu-row">
            {category && <span className="bs-dutymenu-row-category">{category}</span>}
            {category && ' · '}
            <code>{row.key}</code>
            {' · '}
            {row.tag === 'duty' ? <code>{row.relay}</code> : <span className="bs-dutymenu-row-exception">{DUTY_MENU_COPY.notOffered}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export default function DutyMenuPage() {
  const { user, loading, login } = useAuth();
  const attention = useAssistantAttention();
  const signedIn = !loading && !!user;
  const signedOut = !loading && !user;
  const hasAssistant = signedIn && !!user.assistantPubkey;

  const answer = attention.answered ? attention.actions[ACTION_KEY] || null : null;
  // A check that threw carries no offer worth showing: what this instance offers is then unknown, not empty.
  const offerKnown = !!answer && answer.reason !== 'check-failed';
  const offer = offerKnown && Array.isArray(answer.offer) ? answer.offer : NONE;
  const finished = !!answer && answer.finished === true;
  const published = finished && answer.published ? answer.published : null;
  const { needsAttention, done } = assistantAttention(user, attention);
  const marked = hasAssistant && needsAttention.includes(ACTION_KEY);
  const isDone = hasAssistant && done.includes(ACTION_KEY);
  const status = statusLine(answer);
  const current = !!answer && answer.current === true;

  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);

  /** The publish: one request (ADR 0002 sub-decision 8), as the Outbox Relays page publishes. */
  async function onPublish() {
    setResult(null);
    setNotice(null);
    setPublishing(true);
    let wrote = false;
    try {
      const data = await publishAssistantDutyMenu();
      if (data.success !== true) {
        setNotice(data.error || DUTY_MENU_COPY.publish.requestFailed);
      } else {
        const report = describeServerPublish({ name: DUTY_MENU_COPY.publish.subject, row: data.result });
        const empty = !!data.result && data.result.ok === true && data.result.duties === 0;
        setResult({ report, empty });
        wrote = !!data.result && data.result.ok === true;
      }
    } catch {
      setNotice(DUTY_MENU_COPY.publish.requestFailed);
    }
    setPublishing(false);
    // Ask for the answer again once a menu was written, so this page, the hub card and the pill show it. A refusal or a
    // failed local write changed nothing.
    if (wrote) attention.refresh();
  }

  // The published panel's line, when it shows no menu.
  const words = DUTY_MENU_COPY.couldNotCheck;
  let line = null;
  if (attention.phase === 'checking') line = DUTY_MENU_COPY.checking;
  else if (attention.phase === 'failed' || !answer) line = words['request-failed'];
  else if (!finished) line = words[answer.reason] || words['request-failed'];
  else if (!published) line = DUTY_MENU_COPY.none;

  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-setup-main">
        <Link to={ASSISTANT_MANAGEMENT_PATH} className="bs-setup-back">{ASSISTANT_COPY.backToHub}</Link>
        <h1 className="bs-setup-title">{ACTION.title}</h1>
        <p className="bs-idtags-description"><ActionText parts={ACTION.description} /></p>

        {signedOut && (
          <div className="bs-setup-signin">
            <p>{DUTY_MENU_COPY.signedOutLine}</p>
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

        {hasAssistant && (
          <>
            <section className="bs-idtags-card" aria-labelledby="bs-dutymenu-offer">
              <span className="bs-idtags-card-marker" aria-hidden="true" />
              <div className="bs-idtags-card-body">
                <div className="bs-idtags-card-head">
                  <h2 id="bs-dutymenu-offer" className="bs-idtags-card-title">{DUTY_MENU_COPY.offerHeading}</h2>
                </div>
                <p className="bs-outbox-note">{DUTY_MENU_COPY.offerExplainer}</p>
                {offerKnown && (offer.length > 0
                  ? <Rows rows={offer} />
                  : <p className="bs-outbox-note">{DUTY_MENU_COPY.offerEmpty}</p>)}
              </div>
            </section>

            <section className={`bs-idtags-card${marked ? ' is-marked' : ''}${isDone ? ' is-done' : ''}`} aria-labelledby="bs-dutymenu-published">
              <span className="bs-idtags-card-marker" aria-hidden="true">{isDone ? '✓' : marked ? '!' : ''}</span>
              <div className="bs-idtags-card-body">
                <div className="bs-idtags-card-head">
                  <h2 id="bs-dutymenu-published" className="bs-idtags-card-title">
                    {marked && <span className="bs-sr-only">{ASSISTANT_COPY.needsAttentionSrPrefix}</span>}
                    {isDone && <span className="bs-sr-only">{ASSISTANT_COPY.doneSrPrefix}</span>}
                    {DUTY_MENU_COPY.publishedHeading}
                  </h2>
                  {marked && <span className="bs-setup-step-badge" aria-hidden="true">{ASSISTANT_COPY.needsAttention}</span>}
                  {isDone && <span className="bs-setup-step-badge is-done" aria-hidden="true">{ASSISTANT_COPY.done}</span>}
                </div>
                {line && <p className="bs-outbox-note">{line}</p>}
                {published && Array.isArray(published.rows) && (published.rows.length === 0
                  ? <p className="bs-outbox-note">{DUTY_MENU_COPY.emptyMenu}</p>
                  : <Rows rows={published.rows} />)}

                <div className="bs-idtags-actions">
                  <button type="button" className="bs-idtags-publish" disabled={publishing || attention.phase === 'checking' || current} onClick={onPublish}>
                    {publishing ? DUTY_MENU_COPY.publish.publishing : DUTY_MENU_COPY.publish.button}
                  </button>
                </div>
                <div className="bs-idtags-results" aria-live="polite">
                  {notice && <div className="bs-idtags-result is-error">{TONE_ICON.error}{notice}</div>}
                  {result && <Report report={result.report} empty={result.empty} />}
                </div>
              </div>
            </section>

            {status && <p className="bs-idtags-description">{status}</p>}
            <p className="bs-outbox-note">{DUTY_MENU_COPY.publicLine}</p>
          </>
        )}
      </main>
    </div>
  );
}
