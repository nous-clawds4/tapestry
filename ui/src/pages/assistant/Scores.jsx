import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { useAuth } from '../../context/AuthContext';
import { ASSISTANT_MANAGEMENT_PATH } from '../../config/avatarMenuLinks';
import { fetchAssistantScores, recalculateAssistantScores } from '../../utils/assistantScores';
import { npubShort } from '../assistants/myAssistants';
import ActionText from './ActionText';
import { ASSISTANT_ACTIONS, ASSISTANT_COPY } from './actions';
import { SCORES_COPY, buttonState, countLine, couldNotStartLine, lastPublishedLine, runLine } from './scoresCopy';

/**
 * /assistant/trusted-assertions — the Scores page (assistant-scores #1, ADR assistant-scores/0001 sub-decision 6).
 *
 * In the Duty Menu page's frame: the action's title and description, then one card with when the viewer's own
 * Assistant last published Trusted Assertions, how many, and whether a recalculation is queued or running; then the
 * Recalculate button for the Owner and active Customers, or one line saying why there is none. The card's Treasure Map
 * link stays at the foot, as on the placeholder this page replaces.
 *
 * It reads once per load, and again after a press (no polling: reload to see a run end). Both requests go through
 * ui/src/utils/assistantScores.js; every word comes from scoresCopy.js or the hub's ASSISTANT_COPY.
 */

const ACTION = ASSISTANT_ACTIONS.find((a) => a.key === 'trusted-assertions');

export default function ScoresPage() {
  const { user, loading, login } = useAuth();
  const signedIn = !loading && !!user;
  const signedOut = !loading && !user;
  const viewer = signedIn ? user.pubkey : null;
  const assistant = signedIn ? user.assistantPubkey || null : null;

  const [answer, setAnswer] = useState(null); // the read's answer; { success: false } when it failed
  const [attempt, setAttempt] = useState(0);
  const [pressing, setPressing] = useState(false);
  const [notice, setNotice] = useState(null); // { tone: 'success' | 'error', text }

  useEffect(() => {
    if (!viewer || !assistant) return undefined;
    let cancelled = false;
    fetchAssistantScores().then(
      (data) => { if (!cancelled) setAnswer(data); },
      () => { if (!cancelled) setAnswer({ success: false }); },
    );
    return () => { cancelled = true; };
  }, [viewer, assistant, attempt]);

  /** The press: one request, then the read asked again so the run shows. */
  async function onRecalculate() {
    setNotice(null);
    setPressing(true);
    try {
      const data = await recalculateAssistantScores();
      setNotice(data.success === true
        ? { tone: 'success', text: SCORES_COPY.started }
        : { tone: 'error', text: couldNotStartLine(data.code) });
    } catch {
      setNotice({ tone: 'error', text: couldNotStartLine('failed') });
    }
    setPressing(false);
    setAttempt((n) => n + 1);
  }

  const known = !!answer && answer.success === true;
  const noAssistant = (signedIn && !assistant) || (known && answer.signedIn === true && answer.hasAssistant === false);
  const showCard = signedIn && !!assistant && !noAssistant;
  const published = known ? answer.published : null;
  const count = countLine(published);
  const run = known ? runLine(answer.run) : null;
  const button = buttonState(answer, pressing);

  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-setup-main">
        <Link to={ASSISTANT_MANAGEMENT_PATH} className="bs-setup-back">{ASSISTANT_COPY.backToHub}</Link>
        <h1 className="bs-setup-title">{ACTION.title}</h1>
        <p className="bs-idtags-description"><ActionText parts={ACTION.description} /></p>

        {signedOut && (
          <div className="bs-setup-signin">
            <p>{ASSISTANT_COPY.signedOutLine}</p>
            {/* Failures are reported by the shared sign-in modal. */}
            <button type="button" className="bs-link-btn" onClick={() => login().catch(() => {})}>
              {ASSISTANT_COPY.signInButton}
            </button>
          </div>
        )}

        {noAssistant && (
          <div className="bs-setup-signin">
            <p>{ASSISTANT_COPY.noAssistantLine}</p>
            <Link to="/setup" className="bs-assistant-hub-setup-link">{ASSISTANT_COPY.noAssistantLink}</Link>
          </div>
        )}

        {showCard && (
          <section className="bs-idtags-card" aria-label={ACTION.title}>
            <span className="bs-idtags-card-marker" aria-hidden="true" />
            <div className="bs-idtags-card-body">
              {!answer && <p className="bs-outbox-note">{SCORES_COPY.checking}</p>}
              {answer && (
                <>
                  {known && answer.assistantPubkey && (
                    <p className="bs-outbox-note">
                      {SCORES_COPY.assistantPrefix}
                      <Link to={`/user/${answer.assistantPubkey}`}><code>{npubShort(answer.assistantPubkey)}</code></Link>
                    </p>
                  )}
                  <p className="bs-idtags-description">{lastPublishedLine(published)}</p>
                  {count && <p className="bs-idtags-description">{count}</p>}
                  {run && <p className="bs-idtags-description">{run}</p>}

                  {button.show && (
                    <>
                      <div className="bs-idtags-actions">
                        <button type="button" className="bs-idtags-publish" disabled={button.disabled} onClick={onRecalculate}>
                          {SCORES_COPY.button}
                        </button>
                      </div>
                      <p className="bs-outbox-note">{SCORES_COPY.takesAWhile}</p>
                    </>
                  )}
                  {known && answer.pipeline === null && <p className="bs-outbox-note">{SCORES_COPY.noPipeline}</p>}

                  <div className="bs-idtags-results" aria-live="polite">
                    {notice && <div className={`bs-idtags-result is-${notice.tone}`}>{notice.text}</div>}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {ACTION.editLink && (
          <p><Link to={ACTION.editLink.to} className="bs-assistant-hub-edit-link">{ACTION.editLink.text}</Link></p>
        )}
      </main>
    </div>
  );
}
