import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSetupStatus } from '../context/SetupStatusContext';
import { SETUP_ALERT_COPY, alertCountText } from '../pages/setup/steps';

/**
 * The Setup Alert (setup-status-and-alert #2, ADR 0002): an amber pill beside the avatar menu that
 * sends a signed-in viewer to /setup while a step is left. Modelled on Brainstorm's "Finish setting
 * up your account" pill (NosFabrica/Brainstorm-UI, client/src/components/FinishSetupBanner.tsx).
 *
 * It counts only the steps the shared setup answer is confident are not done (`pendingCount`), so
 * it shows nothing while the check runs or after it failed, and never counts a step whose check did
 * not finish or whose Treasure Map names another provider. It reads the same answer as /setup, so
 * the two cannot disagree, and it asks the server nothing itself: mounting it is what asks the
 * provider, which is why the hook runs on every render, signed in or not.
 *
 * It hides on /setup and on the three step pages, and it cannot be dismissed.
 */
export default function SetupAlert() {
  const { user, loading } = useAuth();
  const { pendingCount } = useSetupStatus();
  const { pathname } = useLocation();

  if (loading || !user || pendingCount < 1) return null;
  if (pathname === '/setup' || pathname.startsWith('/setup/')) return null;

  return (
    <Link to="/setup" className="bs-setup-alert" aria-label={SETUP_ALERT_COPY.name}>
      <span className="bs-setup-alert-icon" aria-hidden="true">⚠</span>
      <span className="bs-setup-alert-sentence">{SETUP_ALERT_COPY.sentence}</span>
      <span className="bs-setup-alert-count">{alertCountText(pendingCount)}</span>
      <span className="bs-setup-alert-button">{SETUP_ALERT_COPY.button}</span>
    </Link>
  );
}
