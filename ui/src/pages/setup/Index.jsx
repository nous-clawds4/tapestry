import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { useAuth } from '../../context/AuthContext';
import { useSetupStatus } from '../../context/SetupStatusContext';
import {
  SETUP_STEPS, CREATE_ACCOUNT_STEP, FOLLOW_STEP, ACTIVATE_STEP, SETUP_COPY, followDoneText,
} from './steps';

/**
 * /setup — "Finish setting up your account", modelled on Brainstorm's checklist hub
 * (NosFabrica/Brainstorm-UI, client/src/pages/FinishSetupPage.tsx).
 *
 * Each step shows the signed-in viewer's real state (setup-status-and-alert #1). The answer is the
 * shared setup status (context/SetupStatusContext.jsx, ADR setup-status-and-alert/0001), the same
 * one the Setup Alert counts, so the page never fetches it itself. Three modes:
 *   - sign-in still resolving: the steps, unmarked — a signed-in viewer never sees the sign-in line;
 *   - signed out: the steps, unmarked, and a line asking the visitor to sign in;
 *   - signed in: each step done or not done, the progress line, and "You're all set!" at 3 of 3.
 * While the check runs, or when it has failed, every step shows as not done.
 */

// Which step of the shared answer each checklist step is.
const STEP_KEY = {
  [CREATE_ACCOUNT_STEP.path]: 'account',
  [FOLLOW_STEP.path]: 'follow',
  [ACTIVATE_STEP.path]: 'activate',
};

function doneSentence(key, status) {
  if (key === 'account') return CREATE_ACCOUNT_STEP.doneText;
  if (key === 'follow') return followDoneText(status.followCount ?? 0);
  return ACTIVATE_STEP.doneText;
}

/** A done step: a check, "Done" and its sentence. Not a link — there is nothing left to do there. */
function DoneStep({ step, sentence }) {
  return (
    <div className="bs-setup-step is-done">
      <span className="bs-setup-step-marker is-done" aria-hidden="true">✓</span>
      <span className="bs-setup-step-body">
        <span className="bs-setup-step-head">
          <span className="bs-sr-only">{SETUP_COPY.doneSrPrefix}</span>
          <span className="bs-setup-step-label">{step.label}</span>
          <span className="bs-setup-step-badge is-done">{SETUP_COPY.doneBadge}</span>
        </span>
        <span className="bs-setup-step-text">{sentence}</span>
      </span>
    </div>
  );
}

/** A step that is not done — or, when `marked` is false, a step shown with no state at all. */
function OpenStep({ step, number, marked, sentence }) {
  return (
    <Link to={step.path} className="bs-setup-step">
      <span className="bs-setup-step-marker" aria-hidden="true">{number}</span>
      <span className="bs-setup-step-body">
        <span className="bs-setup-step-head">
          {marked && <span className="bs-sr-only">{SETUP_COPY.notDoneSrPrefix}</span>}
          <span className="bs-setup-step-label">{step.label}</span>
          <span className="bs-setup-step-badge">{step.badge}</span>
        </span>
        <span className="bs-setup-step-text">{sentence}</span>
      </span>
      <span className="bs-setup-step-chevron" aria-hidden="true">›</span>
    </Link>
  );
}

export default function SetupIndex() {
  const { user, loading: authLoading, login } = useAuth();
  const { steps, doneCount } = useSetupStatus();
  const signedIn = !authLoading && !!user;
  const signedOut = !authLoading && !user;
  const total = SETUP_STEPS.length;

  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-setup-main">
        <p className="bs-setup-kicker">Finish setting up</p>
        <h1 className="bs-setup-title">
          Finish setting up <span className="bs-setup-title-accent">your account</span>.
        </h1>

        {signedIn && (
          <div className="bs-setup-progress">
            <span id="bs-setup-progress-label" className="bs-setup-progress-label">
              {doneCount} of {total} complete
            </span>
            <div
              className="bs-setup-progress-track"
              role="progressbar"
              aria-labelledby="bs-setup-progress-label"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={doneCount}
            >
              <div
                className="bs-setup-progress-fill"
                style={{ width: `${Math.round((doneCount / total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {signedOut && (
          <div className="bs-setup-signin">
            <p>{SETUP_COPY.signedOutLine}</p>
            <button type="button" className="bs-link-btn" onClick={() => login().catch(() => {})}>
              {SETUP_COPY.signInButton}
            </button>
          </div>
        )}

        <ol className="bs-setup-steps">
          {SETUP_STEPS.map((step, i) => {
            const key = STEP_KEY[step.path];
            const status = steps[key];
            if (signedIn && status.done) {
              return (
                <li key={step.path}>
                  <DoneStep step={step} sentence={doneSentence(key, status)} />
                </li>
              );
            }
            const sentence = signedIn && key === 'activate' && status.otherProvider
              ? ACTIVATE_STEP.otherProviderText
              : step.text;
            return (
              <li key={step.path}>
                <OpenStep step={step} number={i + 1} marked={signedIn} sentence={sentence} />
              </li>
            );
          })}
        </ol>

        {signedIn && doneCount === total && (
          <p className="bs-setup-all-set">{SETUP_COPY.allDone}</p>
        )}
      </main>
    </div>
  );
}
