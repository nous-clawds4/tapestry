import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSetupStatus } from '../context/SetupStatusContext';
import { ASSISTANT_MANAGEMENT_PATH } from '../config/avatarMenuLinks';
import { ASSISTANT_ALERT_COPY, assistantAttention, attentionCountText } from '../pages/assistant/actions';
import { pickTopBarPill } from '../utils/topBarAlert';

/**
 * The top bar's one alert slot (assistant-management #2, ADR 0002). Mounted beside every avatar menu —
 * BrainstormUserMenu, the landing page's UserMenu, the Tapestry Header — and where the menu would be on the
 * developer pages. It shows at most one pill, chosen by pickTopBarPill: setup first, then the Assistant Alert.
 *
 * It reads only answers the app already shares: sign-in, the one setup status (ADR setup-status-and-alert/0001,
 * asked once per full page load), the page's address, and the Assistant Management page's own attention answer,
 * so the pill's count is the page's count. It stores nothing and cannot be dismissed.
 */

/** The Assistant Alert: one link to /assistant, named by its sentence; its parts drop away as the bar narrows. */
function AssistantPill({ count }) {
  return (
    <Link to={ASSISTANT_MANAGEMENT_PATH} className="bs-topbar-pill is-assistant" aria-label={ASSISTANT_ALERT_COPY.name}>
      <span className="bs-topbar-pill-mark" aria-hidden="true">⚠</span>
      <span className="bs-topbar-pill-text" aria-hidden="true">{ASSISTANT_ALERT_COPY.sentence}</span>
      <span className="bs-topbar-pill-count" aria-hidden="true">· {attentionCountText(count)}</span>
      <span className="bs-topbar-pill-button" aria-hidden="true">{ASSISTANT_ALERT_COPY.button}</span>
    </Link>
  );
}

export default function TopBarAlert() {
  const { user, loading } = useAuth();
  const setup = useSetupStatus();
  const { pathname } = useLocation();
  const { count } = assistantAttention(user);
  const { pill, count: n } = pickTopBarPill({
    signedIn: !loading && !!user,
    setupPhase: setup.phase,
    setupPendingCount: setup.pendingCount,
    assistantCount: count,
    pathname,
  });
  if (pill === 'assistant') return <AssistantPill count={n} />;
  // 'setup': the Setup Alert (setup-status-and-alert #2) renders here once it is built (ADR 0002 § 5).
  return null;
}
