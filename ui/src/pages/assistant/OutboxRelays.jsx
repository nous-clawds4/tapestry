import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { addRelay, removeRelay, visibleSuggestions, addAll, sameRelayList } from '@tapestry/relay-list';
import TopBar from '../../components/TopBar';
import { useAuth } from '../../context/AuthContext';
import { useAssistantAttention } from '../../context/AssistantAttentionContext';
import { ASSISTANT_MANAGEMENT_PATH } from '../../config/avatarMenuLinks';
import { publishAssistantRelayList } from '../../utils/publishAssistantRelayList';
import { describeServerPublish, publishTone, relayLine } from '../../utils/taggingPublishReport';
import ActionText from './ActionText';
import { ASSISTANT_ACTIONS, ASSISTANT_COPY, assistantAttention } from './actions';
import { OUTBOX_RELAYS_COPY, checkLine, inboxLine } from './outboxRelaysCopy';

/**
 * /assistant/outbox-relays — the Outbox Relays page (assistant-outbox-relays #2 and #3, ADRs 0002 and 0003).
 *
 * Two panels, in the Identification Tags page's frame and cards. The first shows the outbox relays the viewer's own
 * Assistant's newest NIP-65 relay list names, with the hub's mark for this action, and holds the on-screen draft: a
 * Remove button per relay, a field to add one by hand, and the publish button. The second lists the suggested relays —
 * where the Assistant already publishes — each with its own Add, and Add all.
 *
 * Everything the page shows comes from the one answer the hub and the Assistant Alert read too
 * (AssistantAttentionContext: actions['outbox-relays'], with its suggestions); the page fetches nothing itself. The
 * draft is component state, rebuilt from each new answer, and edited only through the library's rules
 * (@tapestry/relay-list), so it always holds each relay in its one spelling. Nothing is published, signed or stored
 * until the button: one request (publishAssistantRelayList) has this instance sign the whole list as the viewer's
 * Assistant, and the report is drawn in the Identification Tags page's words.
 */

const ACTION_KEY = 'outbox-relays';
const ACTION = ASSISTANT_ACTIONS.find((a) => a.key === ACTION_KEY);
const TONE_ICON = { success: '✅ ', warning: '⚠️ ', info: 'ℹ️ ', error: '❌ ' };
const NONE = [];

/** The publish's report: the summary, the empty-outbox line when it applies, then one line per relay. */
function Report({ report, emptyOutbox }) {
  const tone = publishTone(report);
  return (
    <div className={`bs-idtags-result is-${tone}`}>
      {TONE_ICON[tone] || ''}{report.message}
      {emptyOutbox && <div className="bs-outbox-note">{OUTBOX_RELAYS_COPY.publish.emptyOutbox}</div>}
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

export default function OutboxRelaysPage() {
  const { user, loading, login } = useAuth();
  const attention = useAssistantAttention();
  const signedIn = !loading && !!user;
  const signedOut = !loading && !user;
  const hasAssistant = signedIn && !!user.assistantPubkey;

  const answer = attention.answered ? attention.actions[ACTION_KEY] || null : null;
  const finished = !!answer && answer.finished === true;
  const published = finished && Array.isArray(answer.outbox) ? answer.outbox : NONE;
  const suggestions = answer && Array.isArray(answer.suggestions) ? answer.suggestions : NONE;
  const { needsAttention, done } = assistantAttention(user, attention);
  const marked = hasAssistant && needsAttention.includes(ACTION_KEY);
  const isDone = hasAssistant && done.includes(ACTION_KEY);

  // The draft: the published outbox relays, rebuilt from each new answer (ADR 0002 sub-decision 3).
  const [draft, setDraft] = useState(NONE);
  useEffect(() => {
    setDraft(published);
  }, [answer]); // eslint-disable-line react-hooks/exhaustive-deps

  const [field, setField] = useState('');
  const [refusal, setRefusal] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);

  const visible = visibleSuggestions(suggestions, draft);
  // When the check did not finish, the published list is unknown: anything on the list is worth publishing.
  const changed = finished ? !sameRelayList(draft, published) : draft.length > 0;
  const line = hasAssistant ? checkLine(attention.phase, answer) : null;
  const inbox = finished ? inboxLine(answer.inboxOnlyCount) : null;

  function applyAdd(input) {
    const next = addRelay(draft, input);
    if (next.error) { setRefusal(next.error); return false; }
    setDraft(next.draft);
    setRefusal(null);
    return true;
  }
  function onAddByHand(event) {
    event.preventDefault();
    if (applyAdd(field)) setField('');
  }
  function onRemove(relay) {
    setDraft(removeRelay(draft, relay));
    setRefusal(null);
  }
  function onAddAll() {
    setDraft(addAll(draft, suggestions));
    setRefusal(null);
  }

  /** The publish: one request with the draft as it stands (ADR 0003 sub-decision 7). */
  async function onPublish() {
    setResult(null);
    setNotice(null);
    setPublishing(true);
    let wrote = false;
    try {
      const data = await publishAssistantRelayList(draft);
      if (data.success !== true) {
        setNotice(data.error || OUTBOX_RELAYS_COPY.publish.requestFailed);
      } else {
        const report = describeServerPublish({ name: OUTBOX_RELAYS_COPY.publish.subject, row: data.result });
        const emptyOutbox = !!data.result && data.result.ok === true && Array.isArray(data.result.outbox) && data.result.outbox.length === 0;
        setResult({ report, emptyOutbox });
        wrote = !!data.result && data.result.ok === true;
      }
    } catch {
      setNotice(OUTBOX_RELAYS_COPY.publish.requestFailed);
    }
    setPublishing(false);
    // Ask for the answer again once a list was written, so this page, the hub card and the pill show it. A refusal or a
    // failed local write changed nothing, so the draft stays for another try.
    if (wrote) attention.refresh();
  }

  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-setup-main">
        <Link to={ASSISTANT_MANAGEMENT_PATH} className="bs-setup-back">{ASSISTANT_COPY.backToHub}</Link>
        <h1 className="bs-setup-title">{ACTION.title}</h1>
        <p className="bs-idtags-description"><ActionText parts={ACTION.description} /></p>

        {signedOut && (
          <div className="bs-setup-signin">
            <p>{OUTBOX_RELAYS_COPY.signedOutLine}</p>
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
            <section className={`bs-idtags-card${marked ? ' is-marked' : ''}${isDone ? ' is-done' : ''}`} aria-labelledby="bs-outbox-list">
              <span className="bs-idtags-card-marker" aria-hidden="true">{isDone ? '✓' : marked ? '!' : ''}</span>
              <div className="bs-idtags-card-body">
                <div className="bs-idtags-card-head">
                  <h2 id="bs-outbox-list" className="bs-idtags-card-title">
                    {marked && <span className="bs-sr-only">{ASSISTANT_COPY.needsAttentionSrPrefix}</span>}
                    {isDone && <span className="bs-sr-only">{ASSISTANT_COPY.doneSrPrefix}</span>}
                    {OUTBOX_RELAYS_COPY.panelHeading}
                  </h2>
                  {marked && <span className="bs-setup-step-badge" aria-hidden="true">{ASSISTANT_COPY.needsAttention}</span>}
                  {isDone && <span className="bs-setup-step-badge is-done" aria-hidden="true">{ASSISTANT_COPY.done}</span>}
                </div>

                {line && <p className="bs-outbox-note">{line}</p>}
                {draft.length > 0 ? (
                  <ul className="bs-outbox-relays">
                    {draft.map((relay) => (
                      <li key={relay} className="bs-outbox-relay">
                        <code>{relay}</code>
                        <button
                          type="button"
                          className="bs-outbox-relay-remove"
                          aria-label={OUTBOX_RELAYS_COPY.srRemove(relay)}
                          onClick={() => onRemove(relay)}
                          disabled={publishing}
                        >
                          {OUTBOX_RELAYS_COPY.remove}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  finished && <p className="bs-outbox-note">{OUTBOX_RELAYS_COPY.noneYet}</p>
                )}
                {inbox && <p className="bs-outbox-note">{inbox}</p>}
                {changed && <p className="bs-outbox-note is-unpublished">{OUTBOX_RELAYS_COPY.unpublished}</p>}

                <form className="bs-outbox-add" onSubmit={onAddByHand}>
                  <label htmlFor="bs-outbox-field" className="bs-outbox-add-label">{OUTBOX_RELAYS_COPY.fieldLabel}</label>
                  <div className="bs-outbox-add-row">
                    <input
                      id="bs-outbox-field"
                      type="text"
                      inputMode="url"
                      autoComplete="off"
                      spellCheck={false}
                      value={field}
                      placeholder={OUTBOX_RELAYS_COPY.placeholder}
                      onChange={(e) => { setField(e.target.value); setRefusal(null); }}
                      disabled={publishing}
                    />
                    <button type="submit" className="bs-outbox-add-button" disabled={publishing}>{OUTBOX_RELAYS_COPY.add}</button>
                  </div>
                  {refusal && <p className="bs-outbox-refusal" role="alert">{OUTBOX_RELAYS_COPY.refusals[refusal]}</p>}
                </form>

                <div className="bs-idtags-actions">
                  <button type="button" className="bs-idtags-publish" onClick={onPublish} disabled={publishing || !changed}>
                    {publishing ? OUTBOX_RELAYS_COPY.publish.publishing : OUTBOX_RELAYS_COPY.publish.button}
                  </button>
                </div>
                <div className="bs-idtags-results" aria-live="polite">
                  {notice && <div className="bs-idtags-result is-error">{TONE_ICON.error}{notice}</div>}
                  {result && <Report report={result.report} emptyOutbox={result.emptyOutbox} />}
                </div>
              </div>
            </section>

            <section className="bs-idtags-card" aria-labelledby="bs-outbox-suggestions">
              <span className="bs-idtags-card-marker" aria-hidden="true" />
              <div className="bs-idtags-card-body">
                <div className="bs-idtags-card-head">
                  <h2 id="bs-outbox-suggestions" className="bs-idtags-card-title">{OUTBOX_RELAYS_COPY.suggestionsHeading}</h2>
                </div>
                <p className="bs-outbox-note">{OUTBOX_RELAYS_COPY.suggestionsExplainer}</p>
                {!answer ? (
                  attention.phase === 'checking' && <p className="bs-outbox-note">{OUTBOX_RELAYS_COPY.checking}</p>
                ) : visible.length > 0 ? (
                  <>
                    <ul className="bs-outbox-relays">
                      {visible.map((relay) => (
                        <li key={relay} className="bs-outbox-relay">
                          <code>{relay}</code>
                          <button
                            type="button"
                            className="bs-outbox-relay-add"
                            aria-label={OUTBOX_RELAYS_COPY.srAdd(relay)}
                            onClick={() => applyAdd(relay)}
                            disabled={publishing}
                          >
                            {OUTBOX_RELAYS_COPY.add}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="bs-idtags-actions">
                      <button type="button" className="bs-outbox-add-all" onClick={onAddAll} disabled={publishing}>{OUTBOX_RELAYS_COPY.addAll}</button>
                    </div>
                  </>
                ) : (
                  <p className="bs-outbox-note">{suggestions.length > 0 ? OUTBOX_RELAYS_COPY.allListed : OUTBOX_RELAYS_COPY.noneToSuggest}</p>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
