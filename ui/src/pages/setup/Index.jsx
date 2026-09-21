import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { SETUP_STEPS } from './steps';

/**
 * /setup — "Finish setting up your account", modelled on Brainstorm's checklist hub
 * (NosFabrica/Brainstorm-UI, client/src/pages/FinishSetupPage.tsx).
 *
 * A scaffold for now (setup-page-scaffold #1): every step shows as not done, for every viewer,
 * and nothing here reads or writes the viewer's data. Checking each step's real state, the
 * Setup Alert that will point here, and the steps themselves are queued for a later session
 * (engineering-team/stories/_intake.md, entry dated 2026-09-20).
 */
export default function SetupIndex() {
  // Deliberately constant until the real checks exist: no step's state is looked up yet.
  const doneCount = 0;
  const total = SETUP_STEPS.length;

  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-setup-main">
        <p className="bs-setup-kicker">Finish setting up</p>
        <h1 className="bs-setup-title">
          Finish setting up <span className="bs-setup-title-accent">your account</span>.
        </h1>

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

        <ol className="bs-setup-steps">
          {SETUP_STEPS.map((step, i) => (
            <li key={step.path}>
              <Link to={step.path} className="bs-setup-step">
                <span className="bs-setup-step-marker" aria-hidden="true">{i + 1}</span>
                <span className="bs-setup-step-body">
                  <span className="bs-setup-step-head">
                    <span className="bs-sr-only">Not done: </span>
                    <span className="bs-setup-step-label">{step.label}</span>
                    <span className="bs-setup-step-badge">{step.badge}</span>
                  </span>
                  <span className="bs-setup-step-text">{step.text}</span>
                </span>
                <span className="bs-setup-step-chevron" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
