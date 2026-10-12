import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { useAuth } from '../../context/AuthContext';
import { useAssistantAttention } from '../../context/AssistantAttentionContext';
import { ASSISTANT_MANAGEMENT_PATH, MANAGE_TREASURE_MAP_PATH } from '../../config/avatarMenuLinks';
import ActionText from './ActionText';
import { ASSISTANT_ACTIONS, ASSISTANT_COPY, assistantAttention } from './actions';
import { categoryOf } from './dutyMenuCopy';
import { SELF_MAP_COPY, couldNotCheckLine, reasonLine, statusLine } from './assistantTreasureMapCopy';

/**
 * /assistant/treasure-map — the Your Assistant's Treasure Map page (assistant-self-map #1, ADR 0001 sub-decision 9).
 *
 * Three panels, in the Duty Menu page's frame and cards. The first shows the duties the viewer's Treasure Map gives
 * their Assistant, one line per part: its category, its key, and whether it is active (with its relay), offered but
 * not active (with the reason), not offered, or given to another Assistant; a part the found self-Map claims but that
 * is not live says so too. The second shows the self-entries the self-Map should hold now. The third shows the
 * self-entries found, with the hub's mark for this action; while the answer is on its way, or when the check did not
 * finish, it shows that instead. Under them: one status line (only for a finished check), the links to the Duty Menu
 * and to /treasure-map, the Owner's line (the TA's Map is also this instance's own) and the public line.
 *
 * Everything the page shows comes from the one answer the hub and the Assistant Alert read too
 * (AssistantAttentionContext: actions['treasure-map']); the page fetches, signs and publishes nothing (story AC-7).
 */

const ACTION_KEY = 'treasure-map';
const ACTION = ASSISTANT_ACTIONS.find((a) => a.key === ACTION_KEY);
const DUTY_MENU = ASSISTANT_ACTIONS.find((a) => a.key === 'duty-menu');
const DUTY_MENU_PATH = DUTY_MENU ? DUTY_MENU.path : `${ASSISTANT_MANAGEMENT_PATH}/duty-menu`;
const NONE = [];

/** What a duties line says after its key: the status word and its relay or reason, or that it is given elsewhere. */
function LineStatus({ line }) {
  if (line.status === 'elsewhere') return <span className="bs-dutymenu-row-exception">{SELF_MAP_COPY.elsewhere}</span>;
  const word = SELF_MAP_COPY.statusWords[line.status];
  const reason = line.status === 'active' ? null : reasonLine(line);
  return (
    <>
      {word && <span className="bs-dutymenu-row-exception">{word}</span>}
      {line.status === 'active' && line.relay && <>{' · '}<code>{line.relay}</code></>}
      {reason && <>{' · '}<span className="bs-dutymenu-row-exception">{reason}</span></>}
    </>
  );
}

/** The duties panel's lines, flattened in the answer's order (each duty's winning parts, most specific first). */
function DutyLines({ duties }) {
  const lines = duties.flatMap((duty) => (Array.isArray(duty.lines) ? duty.lines.map((line) => ({ duty: duty.key, line })) : NONE));
  return (
    <ul className="bs-outbox-relays">
      {lines.map(({ duty, line }, i) => {
        const category = SELF_MAP_COPY.categories[line.category] || categoryOf(line.key);
        return (
          <li key={`${duty}|${line.key}|${line.status}|${i}`} className="bs-dutymenu-row">
            {category && <span className="bs-dutymenu-row-category">{category}</span>}
            {category && ' · '}
            <code>{line.key}</code>
            {' · '}
            <LineStatus line={line} />
            {line.falseClaim === true && <>{' · '}<span className="bs-dutymenu-row-exception">{SELF_MAP_COPY.falseClaim}</span></>}
          </li>
        );
      })}
    </ul>
  );
}

/** Self-entries, one line each: the category, the key and the relay — for what the self-Map should say and what it says. */
function Entries({ entries }) {
  return (
    <ul className="bs-outbox-relays">
      {entries.map((entry, i) => {
        const category = categoryOf(entry.key);
        return (
          <li key={`${entry.key}|${entry.relay}|${i}`} className="bs-dutymenu-row">
            {category && <span className="bs-dutymenu-row-category">{category}</span>}
            {category && ' · '}
            <code>{entry.key}</code>
            {' · '}
            <code>{entry.relay}</code>
          </li>
        );
      })}
    </ul>
  );
}

export default function AssistantTreasureMapPage() {
  const { user, loading, login } = useAuth();
  const attention = useAssistantAttention();
  const signedIn = !loading && !!user;
  const signedOut = !loading && !user;
  const hasAssistant = signedIn && !!user.assistantPubkey;

  const answer = attention.answered ? attention.actions[ACTION_KEY] || null : null;
  // An unfinished check shows only its reason: its duties may be part-read, and an empty list would read as "no duties".
  const finished = !!answer && answer.finished === true;
  const duties = finished && Array.isArray(answer.duties) ? answer.duties : NONE;
  const shouldSay = finished && Array.isArray(answer.shouldSay) ? answer.shouldSay : NONE;
  const published = finished && answer.published ? answer.published : null;
  const selfEntries = published && Array.isArray(published.selfEntries) ? published.selfEntries : NONE;
  const { needsAttention, done } = assistantAttention(user, attention);
  const marked = hasAssistant && needsAttention.includes(ACTION_KEY);
  const isDone = hasAssistant && done.includes(ACTION_KEY);
  const status = statusLine(answer);
  const ownerLine = finished && answer.instanceMap === true && published && Number.isFinite(published.otherEntries)
    ? SELF_MAP_COPY.ownerLine(published.otherEntries)
    : null;

  // The published panel's line, when it shows no self-entries.
  let line = null;
  if (attention.phase === 'checking') line = SELF_MAP_COPY.checking;
  else if (attention.phase === 'failed' || !answer) line = couldNotCheckLine(null);
  else if (!finished) line = couldNotCheckLine(answer.reason);
  else if (selfEntries.length === 0) line = SELF_MAP_COPY.none;

  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-setup-main">
        <Link to={ASSISTANT_MANAGEMENT_PATH} className="bs-setup-back">{ASSISTANT_COPY.backToHub}</Link>
        <h1 className="bs-setup-title">{ACTION.title}</h1>
        <p className="bs-idtags-description"><ActionText parts={ACTION.description} /></p>

        {signedOut && (
          <div className="bs-setup-signin">
            <p>{SELF_MAP_COPY.signedOutLine}</p>
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
            <section className="bs-idtags-card" aria-labelledby="bs-selfmap-duties">
              <span className="bs-idtags-card-marker" aria-hidden="true" />
              <div className="bs-idtags-card-body">
                <div className="bs-idtags-card-head">
                  <h2 id="bs-selfmap-duties" className="bs-idtags-card-title">{SELF_MAP_COPY.dutiesHeading}</h2>
                </div>
                <p className="bs-outbox-note">{SELF_MAP_COPY.dutiesExplainer}</p>
                {finished && (duties.length > 0
                  ? <DutyLines duties={duties} />
                  : (
                    <p className="bs-outbox-note">
                      {SELF_MAP_COPY.noDuties}{' '}
                      <Link to={MANAGE_TREASURE_MAP_PATH}>{SELF_MAP_COPY.yourTreasureMap}</Link>
                    </p>
                  ))}
              </div>
            </section>

            <section className="bs-idtags-card" aria-labelledby="bs-selfmap-should">
              <span className="bs-idtags-card-marker" aria-hidden="true" />
              <div className="bs-idtags-card-body">
                <div className="bs-idtags-card-head">
                  <h2 id="bs-selfmap-should" className="bs-idtags-card-title">{SELF_MAP_COPY.shouldHeading}</h2>
                </div>
                <p className="bs-outbox-note">{SELF_MAP_COPY.shouldExplainer}</p>
                {finished && (shouldSay.length > 0
                  ? <Entries entries={shouldSay} />
                  : <p className="bs-outbox-note">{SELF_MAP_COPY.shouldEmpty}</p>)}
              </div>
            </section>

            <section className={`bs-idtags-card${marked ? ' is-marked' : ''}${isDone ? ' is-done' : ''}`} aria-labelledby="bs-selfmap-published">
              <span className="bs-idtags-card-marker" aria-hidden="true">{isDone ? '✓' : marked ? '!' : ''}</span>
              <div className="bs-idtags-card-body">
                <div className="bs-idtags-card-head">
                  <h2 id="bs-selfmap-published" className="bs-idtags-card-title">
                    {marked && <span className="bs-sr-only">{ASSISTANT_COPY.needsAttentionSrPrefix}</span>}
                    {isDone && <span className="bs-sr-only">{ASSISTANT_COPY.doneSrPrefix}</span>}
                    {SELF_MAP_COPY.publishedHeading}
                  </h2>
                  {marked && <span className="bs-setup-step-badge" aria-hidden="true">{ASSISTANT_COPY.needsAttention}</span>}
                  {isDone && <span className="bs-setup-step-badge is-done" aria-hidden="true">{ASSISTANT_COPY.done}</span>}
                </div>
                {line && <p className="bs-outbox-note">{line}</p>}
                {selfEntries.length > 0 && <Entries entries={selfEntries} />}
              </div>
            </section>

            {status && <p className="bs-idtags-description">{status}</p>}
            <p className="bs-outbox-note">
              {SELF_MAP_COPY.links.dutyMenuLead}{' '}
              <Link to={DUTY_MENU_PATH}>{SELF_MAP_COPY.links.dutyMenu}</Link>
            </p>
            <p className="bs-outbox-note">
              {SELF_MAP_COPY.links.treasureMapLead}{' '}
              <Link to={MANAGE_TREASURE_MAP_PATH}>{SELF_MAP_COPY.links.treasureMap}</Link>
            </p>
            {ownerLine && <p className="bs-outbox-note">{ownerLine}</p>}
            <p className="bs-outbox-note">{SELF_MAP_COPY.publicLine}</p>
          </>
        )}
      </main>
    </div>
  );
}
