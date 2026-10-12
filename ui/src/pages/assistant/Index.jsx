import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { useAuth } from '../../context/AuthContext';
import { useAssistantAttention } from '../../context/AssistantAttentionContext';
import { MANAGE_TREASURE_MAP_PATH } from '../../config/avatarMenuLinks';
import ActionText from './ActionText';
import {
  ASSISTANT_SECTIONS, ASSISTANT_ACTIONS, ASSISTANT_FAQ, ASSISTANT_COPY, COMING_SOON_ACTIONS, assistantAttention,
  attentionCountText,
} from './actions';

/**
 * /assistant — the Assistant Management page (assistant-management #1, ADR 0001): everything a person's
 * Tapestry Assistant does for them, as cards under three headings, with a FAQ. Styled like /setup, whose
 * classes it shares for the parts the two pages have in common.
 *
 * Each card leads to its action's page (a placeholder until the action is built), and its mark comes from the
 * one answer the Assistant Alert counts too: assistantAttention(user, attention), the placeholders merged with the
 * server's real checks (GET /api/assistant/attention, shared through AssistantAttentionProvider — since
 * assistant-identification-tags #1, ADR 0001). A checked action stays marked until its answer says done. Four states:
 *   - sign-in still resolving: the cards, unmarked, and no line;
 *   - signed out: the cards, unmarked, and a line asking the visitor to sign in;
 *   - signed in with no assistant here: the cards, unmarked, and a line pointing to Account Setup;
 *   - signed in with an assistant: every card marked "Needs attention" until its answer says done, and the count; a
 *     checked action that is done shows a "Done" badge instead (ADR assistant-profile-checklist/0001 sub-decision 7,
 *     first built by assistant-outbox-relays #1). A done card whose category another Assistant holds too, or only,
 *     also shows a muted "Shared" pill and one line linking to /treasure-map to move it here; it is still done, and
 *     still not counted (assistant-shared-categories #1).
 * In all four, a card for an action that is not built yet (COMING_SOON_ACTIONS) shows a muted "Coming soon" pill and no
 * mark, and is never counted (assistant-coming-soon #1).
 */

/**
 * One action's card. The title is the card's link, stretched over the whole card (its ::after), so a click
 * anywhere opens the action's page; the description's NIP links sit above it (ADR 0001 sub-decision 4), and so does
 * a shared card's "Move it here →", which opens /treasure-map.
 * `shared` is 'partly', 'entirely' or nothing (assistant-shared-categories #1). A `comingSoon` card is never marked or
 * done, whatever it is passed: it has no marker and shows the muted Coming soon pill (assistant-coming-soon #1).
 */
function ActionCard({ action, marked: markedIn, done, shared, comingSoon }) {
  const marked = markedIn && !comingSoon;
  const isDone = done && !marked && !comingSoon;
  const isShared = isDone && (shared === 'partly' || shared === 'entirely');
  return (
    <div className={`bs-assistant-hub-card${marked ? ' needs-attention' : ''}${isDone ? ' is-done' : ''}`}>
      <span className="bs-assistant-hub-card-marker" aria-hidden="true">{marked ? '!' : isDone ? '✓' : ''}</span>
      <div className="bs-assistant-hub-card-body">
        <div className="bs-assistant-hub-card-head">
          <Link to={action.path} className="bs-assistant-hub-card-link">
            {marked && <span className="bs-sr-only">{ASSISTANT_COPY.needsAttentionSrPrefix}</span>}
            {isDone && <span className="bs-sr-only">{isShared ? ASSISTANT_COPY.doneSharedSrPrefix : ASSISTANT_COPY.doneSrPrefix}</span>}
            {comingSoon && <span className="bs-sr-only">{ASSISTANT_COPY.comingSoonSrPrefix}</span>}
            {action.title}
          </Link>
          {marked && <span className="bs-setup-step-badge" aria-hidden="true">{ASSISTANT_COPY.needsAttention}</span>}
          {isDone && <span className="bs-setup-step-badge is-done" aria-hidden="true">{ASSISTANT_COPY.done}</span>}
          {isShared && <span className="bs-setup-step-badge is-neutral" aria-hidden="true">{ASSISTANT_COPY.shared}</span>}
          {comingSoon && <span className="bs-setup-step-badge is-neutral" aria-hidden="true">{ASSISTANT_COPY.comingSoon}</span>}
        </div>
        <p className="bs-assistant-hub-card-text"><ActionText parts={action.description} /></p>
        {isShared && (
          <p className="bs-assistant-hub-card-shared">
            {ASSISTANT_COPY.sharedLine[shared]}{' '}
            {/* The "·" and the link stay together on a narrow screen; the line may break only before the "·" (the
                owner's Gate B verdict, 2026-10-11). */}
            <span className="bs-assistant-hub-card-shared-move">
              <span aria-hidden="true">· </span>
              <Link to={MANAGE_TREASURE_MAP_PATH} className="bs-assistant-hub-inline-link">{ASSISTANT_COPY.sharedMoveLink}</Link>
            </span>
          </p>
        )}
      </div>
      <span className="bs-assistant-hub-card-chevron" aria-hidden="true">›</span>
    </div>
  );
}

export default function AssistantManagementPage() {
  const { user, loading, login } = useAuth();
  const attention = useAssistantAttention();
  const { hasAssistant, needsAttention, done, shared, count } = assistantAttention(user, attention);
  const signedIn = !loading && !!user;
  const signedOut = !loading && !user;
  const marked = (action) => signedIn && needsAttention.includes(action.key);
  const isDone = (action) => signedIn && done.includes(action.key);

  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-setup-main">
        <p className="bs-setup-kicker">{ASSISTANT_COPY.kicker}</p>
        <h1 className="bs-setup-title">
          {ASSISTANT_COPY.headingLead}<span className="bs-setup-title-accent">{ASSISTANT_COPY.headingAccent}</span>
        </h1>

        {signedIn && hasAssistant && (
          <p className="bs-assistant-hub-count">{attentionCountText(count)}</p>
        )}

        {signedOut && (
          <div className="bs-setup-signin">
            <p>{ASSISTANT_COPY.signedOutLine}</p>
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

        {/* Closed on every load: no `open`, and no state to remember (ADR 0001 sub-decision 5). */}
        <details className="bs-assistant-hub-faq">
          <summary>{ASSISTANT_COPY.faqToggle}</summary>
          <dl>
            {ASSISTANT_FAQ.map((q) => (
              <Fragment key={q.question}>
                <dt>{q.question}</dt>
                <dd>{q.answer}</dd>
              </Fragment>
            ))}
          </dl>
        </details>

        {ASSISTANT_SECTIONS.map((section) => (
          <section
            key={section.key}
            className="bs-assistant-hub-section"
            aria-labelledby={`bs-assistant-hub-${section.key}`}
          >
            <h2 id={`bs-assistant-hub-${section.key}`} className="bs-assistant-hub-section-heading">{section.heading}</h2>
            <ul className="bs-assistant-hub-cards">
              {ASSISTANT_ACTIONS.filter((action) => action.section === section.key).map((action) => (
                <li key={action.key}>
                  <ActionCard
                    action={action}
                    marked={marked(action)}
                    done={isDone(action)}
                    shared={shared[action.key]}
                    comingSoon={COMING_SOON_ACTIONS.includes(action.key)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
