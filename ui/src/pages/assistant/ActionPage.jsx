import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import ActionText from './ActionText';
import { ASSISTANT_COPY } from './actions';
import { ASSISTANT_MANAGEMENT_PATH } from '../../config/avatarMenuLinks';

/**
 * The placeholder page behind each action on /assistant (assistant-management #1, ADR 0001 sub-decision 7).
 *
 * It says plainly that it is a placeholder, shows the action's description, and carries what the owner has
 * said so far about the page to come — its alert criteria and planning notes — for the session that builds
 * it. One component serves all ten actions; App.jsx routes each action's address here with its entry from
 * ASSISTANT_ACTIONS. When an action is built, its route points at its own page instead.
 */
export default function AssistantActionPage({ action }) {
  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-setup-main">
        <Link to={ASSISTANT_MANAGEMENT_PATH} className="bs-setup-back">{ASSISTANT_COPY.backToHub}</Link>
        <h1 className="bs-setup-title">{action.title}</h1>
        <div className="bs-setup-placeholder">
          <p><strong>{ASSISTANT_COPY.placeholder}</strong></p>
          <p><ActionText parts={action.description} /></p>
          <h2 className="bs-assistant-hub-notes-heading">{ASSISTANT_COPY.alertCriteriaHeading}</h2>
          <p>{action.alertCriteria || ASSISTANT_COPY.notYetDefined}</p>
          {action.planningNotes && (
            <>
              <h2 className="bs-assistant-hub-notes-heading">{ASSISTANT_COPY.planningNotesHeading}</h2>
              <p>{action.planningNotes}</p>
            </>
          )}
          {action.editLink && (
            <p><Link to={action.editLink.to} className="bs-assistant-hub-edit-link">{action.editLink.text}</Link></p>
          )}
        </div>
      </main>
    </div>
  );
}
