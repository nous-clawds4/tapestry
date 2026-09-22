import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSetupStatus } from '../context/SetupStatusContext';
import { useAssistantAttention } from '../context/AssistantAttentionContext';
import { ASSISTANT_MANAGEMENT_PATH } from '../config/avatarMenuLinks';
import { ASSISTANT_ALERT_COPY, assistantAttention, attentionCountText } from '../pages/assistant/actions';
import { pickTopBarPill } from '../utils/topBarAlert';

/**
 * The top bar's Assistant Alert slot (assistant-management #2, ADR 0002). Mounted beside every avatar menu —
 * BrainstormUserMenu, the landing page's UserMenu, the Tapestry Header — and where the menu would be on the
 * developer pages, each time just after the Setup Alert (setup-status-and-alert #2), which is its own component.
 * pickTopBarPill decides, setup first: while the Setup Alert counts a step this slot draws nothing, so the two
 * pills never show together (ADR 0002 Amendment 1).
 *
 * It reads only answers the app already shares: sign-in, the one setup status (ADR setup-status-and-alert/0001,
 * asked once per full page load), the page's address, and the Assistant Management page's own attention answer —
 * in its pill reading, alertCount, which counts a checked action only from a finished, missing answer (ADR
 * assistant-identification-tags/0001 sub-decision 6), and which waits for that answer before drawing anything
 * (sub-decision 8). It stores nothing and cannot be dismissed.
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
  const attention = useAssistantAttention();
  const { alertCount } = assistantAttention(user, attention);
  const { pill, count: n } = pickTopBarPill({
    signedIn: !loading && !!user,
    setupPhase: setup.phase,
    setupPendingCount: setup.pendingCount,
    assistantCount: alertCount,
    assistantPhase: attention.phase,
    pathname,
  });
  if (pill === 'assistant') return <AssistantPill count={n} />;
  // 'setup': give way. The Setup Alert, mounted beside this slot, shows its own pill (ADR 0002 Amendment 1).
  return null;
}
