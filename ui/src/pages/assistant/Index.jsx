import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { useAuth } from '../../context/AuthContext';
import ActionText from './ActionText';
import {
  ASSISTANT_SECTIONS, ASSISTANT_ACTIONS, ASSISTANT_FAQ, ASSISTANT_COPY, assistantAttention, attentionCountText,
} from './actions';

/**
 * /assistant — the Assistant Management page (assistant-management #1, ADR 0001): everything a person's
 * Tapestry Assistant does for them, as cards under three headings, with a FAQ. Styled like /setup, whose
 * classes it shares for the parts the two pages have in common.
 *
 * A scaffold for now: each card leads to a placeholder page, and every action needs attention for a viewer
 * who has an assistant — the one answer, assistantAttention(user), that the Assistant Alert counts too. The
 * page reads only the sign-in state the app already holds; it asks the server nothing. Four states:
 *   - sign-in still resolving: the cards, unmarked, and no line;
 *   - signed out: the cards, unmarked, and a line asking the visitor to sign in;
 *   - signed in with no assistant here: the cards, unmarked, and a line pointing to Account Setup;
 *   - signed in with an assistant: every card marked "Needs attention", and the count.
 */

/**
 * One action's card. The title is the card's link, stretched over the whole card (its ::after), so a click
 * anywhere opens the action's page; the description's NIP links sit above it (ADR 0001 sub-decision 4).
 */
function ActionCard({ action, marked }) {
  return (
    <div className={`bs-assistant-hub-card${marked ? ' needs-attention' : ''}`}>
      <span className="bs-assistant-hub-card-marker" aria-hidden="true">{marked ? '!' : ''}</span>
      <div className="bs-assistant-hub-card-body">
        <div className="bs-assistant-hub-card-head">
          <Link to={action.path} className="bs-assistant-hub-card-link">
            {marked && <span className="bs-sr-only">{ASSISTANT_COPY.needsAttentionSrPrefix}</span>}
            {action.title}
          </Link>
          {marked && <span className="bs-setup-step-badge" aria-hidden="true">{ASSISTANT_COPY.needsAttention}</span>}
        </div>
        <p className="bs-assistant-hub-card-text"><ActionText parts={action.description} /></p>
      </div>
      <span className="bs-assistant-hub-card-chevron" aria-hidden="true">›</span>
    </div>
  );
}

export default function AssistantManagementPage() {
  const { user, loading, login } = useAuth();
  const { hasAssistant, needsAttention, count } = assistantAttention(user);
  const signedIn = !loading && !!user;
  const signedOut = !loading && !user;
  const marked = (action) => signedIn && needsAttention.includes(action.key);

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
                  <ActionCard action={action} marked={marked(action)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
