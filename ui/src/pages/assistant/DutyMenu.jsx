import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { useAuth } from '../../context/AuthContext';
import { useAssistantAttention } from '../../context/AssistantAttentionContext';
import { ASSISTANT_MANAGEMENT_PATH } from '../../config/avatarMenuLinks';
import ActionText from './ActionText';
import { ASSISTANT_ACTIONS, ASSISTANT_COPY, assistantAttention } from './actions';
import { DUTY_MENU_COPY, categoryOf, statusLine } from './dutyMenuCopy';

/**
 * /assistant/duty-menu — the Duty Menu page (assistant-duty-menu #1, ADR 0001 sub-decision 6). Read-only.
 *
 * Two panels, in the Identification Tags page's frame and cards. The first shows the offer: one line per row that
 * this instance offers for the viewer's own Assistant, with its Treasure Map category, its key and its relay. The
 * second shows the menu found for that Assistant now, the same way, with the hub's mark for this action; while the
 * answer is on its way, or when the check did not finish, it shows that instead. Under them, one status line (only
 * for a finished check) and the line saying the menu is public.
 *
 * Everything comes from the one answer the hub and the Assistant Alert read too (AssistantAttentionContext:
 * actions['duty-menu']); the page asks for nothing itself. Publishing the menu is story 2.
 */

const ACTION_KEY = 'duty-menu';
const ACTION = ASSISTANT_ACTIONS.find((a) => a.key === ACTION_KEY);
const NONE = [];

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
                {published && Array.isArray(published.rows) && published.rows.length > 0 && <Rows rows={published.rows} />}
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
