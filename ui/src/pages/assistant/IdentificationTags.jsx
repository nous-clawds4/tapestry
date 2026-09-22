import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { REQUIRED_TAGGINGS, CANONICAL_TAG_AUTHOR } from '@tapestry/identification-tags';
import TopBar from '../../components/TopBar';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { useAssistantAttention } from '../../context/AssistantAttentionContext';
import { ASSISTANT_MANAGEMENT_PATH } from '../../config/avatarMenuLinks';
import { publishProfileTagAssertionWithReport } from '../../utils/publishProfileTag';
import { PUBLISH_RELAYS } from '../../utils/nostrPublish';
import { describeTaggingPublish, publishTone, relayLine } from '../../utils/taggingPublishReport';
import ActionText from './ActionText';
import { ASSISTANT_ACTIONS, ASSISTANT_COPY } from './actions';
import { IDENTIFICATION_TAGS_COPY as COPY, rowState, cardState } from './identificationTags';

/**
 * /assistant/identification-tags — the Identification Tags page (assistant-identification-tags #2, ADR 0002).
 *
 * Four taggings make the handshake between a person and their Tapestry Assistant: two the person signs about the
 * Assistant (My Tapestry Assistant, My Agent) and two the Assistant signs about the person (My Tapestry Owner,
 * My Human). Each is a row on one of two cards, one per signer. The rows' states come from the one answer the hub
 * and the Assistant Alert read too (AssistantAttentionContext, story 1), so the three cannot disagree; the page
 * fetches nothing itself.
 *
 * The first card's publish signs one tagging per checked row with the viewer's nostr extension, through the tagging
 * publisher every tagging goes through (publishProfileTagAssertionWithReport: the canonical tag, the viewer's own
 * Assistant as the target, an apply), and reports what each relay did in the words of taggingPublishReport.js. The
 * second card's publish — the Assistant's own key, through this instance — is story 3's.
 *
 * Checkboxes are component state, rebuilt from each new answer (an unchecked box is "not this time", nothing is
 * stored). Results live until the next press or a navigation.
 */

const ACTION_KEY = 'identification-tags';
const ACTION = ASSISTANT_ACTIONS.find((a) => a.key === ACTION_KEY);
const TONE_ICON = { success: '✅ ', warning: '⚠️ ', info: 'ℹ️ ', error: '❌ ' };

/** What a row says under its name, for its state. */
function rowText(row) {
  const { state, reason } = row;
  if (state === 'present') return COPY.states.present;
  if (state === 'missing') return row.definitionKnown ? COPY.states.missing : `${COPY.states.missing} ${COPY.definitionUnknown}`;
  if (state === 'checking') return COPY.states.checking;
  if (state === 'tag-not-found') return COPY.tagNotFound(row.entry.name);
  if (state === 'could-not-check') return COPY.couldNotCheck[reason] || COPY.couldNotCheck['request-failed'];
  return '';
}

/** One tagging's publish result: the summary, then one line per relay. */
function Result({ result }) {
  if (result.refusal) {
    return <div className="bs-idtags-result is-error">{TONE_ICON.error}{result.refusal}</div>;
  }
  const tone = publishTone(result.report);
  return (
    <div className={`bs-idtags-result is-${tone}`}>
      {TONE_ICON[tone] || ''}{result.report.message}
      {result.report.rows.length > 0 && (
        <div className="bs-idtags-result-relays">
          {result.report.rows.map((row) => (
            <div key={row.relay}><code>{row.relay}</code> — {relayLine(row)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One card: its rows, a checkbox per missing row, its publish button (only when given `onPublish` — the second card
 * gets none until story 3), and its results.
 */
function Card({ signer, title, rows, checked, onToggle, onPublish, publishing, results, notice }) {
  const state = cardState(rows);
  const marked = state === 'marked';
  const done = state === 'done';
  const headingId = `bs-idtags-${signer}`;
  const checkedCount = rows.filter((row) => checked.has(row.entry.key)).length;
  return (
    <section className={`bs-idtags-card${marked ? ' is-marked' : ''}${done ? ' is-done' : ''}`} aria-labelledby={headingId}>
      <span className="bs-idtags-card-marker" aria-hidden="true">{done ? '✓' : marked ? '!' : ''}</span>
      <div className="bs-idtags-card-body">
        <div className="bs-idtags-card-head">
          <h2 id={headingId} className="bs-idtags-card-title">
            {marked && <span className="bs-sr-only">{ASSISTANT_COPY.needsAttentionSrPrefix}</span>}
            {done && <span className="bs-sr-only">{COPY.doneSrPrefix}</span>}
            {title}
          </h2>
          {marked && <span className="bs-setup-step-badge" aria-hidden="true">{ASSISTANT_COPY.needsAttention}</span>}
          {done && <span className="bs-setup-step-badge is-done" aria-hidden="true">{COPY.doneBadge}</span>}
        </div>
        <ul className="bs-idtags-rows">
          {rows.map((row) => {
            const { entry, state: rowStateName, definitionKnown } = row;
            const hasBox = rowStateName === 'missing' || rowStateName === 'tag-not-found';
            const boxEnabled = rowStateName === 'missing' && definitionKnown && !publishing;
            const text = rowText(row);
            return (
              <li key={entry.key} className={`bs-idtags-row is-${rowStateName}`}>
                {hasBox ? (
                  <label className="bs-idtags-row-label">
                    <input
                      type="checkbox"
                      checked={checked.has(entry.key)}
                      disabled={!boxEnabled}
                      onChange={() => onToggle(entry.key)}
                    />
                    <span className="bs-idtags-row-name">{entry.name}</span>
                  </label>
                ) : (
                  <span className="bs-idtags-row-name">{entry.name}</span>
                )}
                {text && <span className="bs-idtags-row-state">{text}</span>}
              </li>
            );
          })}
        </ul>
        {onPublish && (
          <div className="bs-idtags-actions">
            <button
              type="button"
              className="bs-idtags-publish"
              onClick={onPublish}
              disabled={publishing || checkedCount === 0}
            >
              {publishing ? COPY.publishing : COPY.buttons[signer]}
            </button>
          </div>
        )}
        <div className="bs-idtags-results" aria-live="polite">
          {notice && <div className="bs-idtags-result is-error">{TONE_ICON.error}{notice}</div>}
          {rows.map((row) => (results[row.entry.key] ? <Result key={row.entry.key} result={results[row.entry.key]} /> : null))}
        </div>
      </div>
    </section>
  );
}

export default function IdentificationTagsPage() {
  const { user, loading, login } = useAuth();
  const { taPubkey } = useConfig();
  const attention = useAssistantAttention();
  const signedIn = !loading && !!user;
  const signedOut = !loading && !user;
  const hasAssistant = signedIn && !!user.assistantPubkey;

  const answer = attention.answered ? attention.actions[ACTION_KEY] : null;
  const answerRows = answer && Array.isArray(answer.taggings) ? answer.taggings : [];
  const phase = hasAssistant ? attention.phase : 'idle';

  const rows = useMemo(() => REQUIRED_TAGGINGS.map((entry) => {
    const answerRow = answerRows.find((r) => r && r.key === entry.key) || null;
    return { entry, answerRow, ...rowState(entry, answerRow, phase) };
  }), [answerRows, phase]);
  const personRows = rows.filter((row) => row.entry.signer === 'person');
  const assistantRows = rows.filter((row) => row.entry.signer === 'assistant');

  // The checkboxes: every publishable missing row, checked, rebuilt from each new answer (AC-3).
  const [checked, setChecked] = useState(() => new Set());
  useEffect(() => {
    setChecked(new Set(rows.filter((row) => row.state === 'missing' && row.definitionKnown).map((row) => row.entry.key)));
  }, [answer]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (key) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState({});
  const [notice, setNotice] = useState(null);

  /** The first card's publish: one tagging per checked row, in turn, each reported (ADR 0002 sub-decision 6). */
  async function publishPersonTaggings() {
    setNotice(null);
    if (!window.nostr) { setNotice(COPY.noExtension); return; }
    const toPublish = personRows.filter((row) => checked.has(row.entry.key) && row.state === 'missing' && row.definitionKnown);
    if (toPublish.length === 0) return;
    setPublishing(true);
    setResults({});
    for (const row of toPublish) {
      const { entry, answerRow } = row;
      try {
        const { result } = await publishProfileTagAssertionWithReport({
          tag: { eventId: answerRow.definition.eventId, slug: entry.slug, authorPubkey: CANONICAL_TAG_AUTHOR },
          targetPubkey: user.assistantPubkey,
          polarity: 1,
          localTaPubkey: taPubkey,
        });
        const report = describeTaggingPublish({ name: entry.name, local: result.local, external: result.external, relays: PUBLISH_RELAYS });
        setResults((prev) => ({ ...prev, [entry.key]: { report } }));
      } catch (err) {
        const reason = (err && err.message) || 'no reason given';
        setResults((prev) => ({ ...prev, [entry.key]: { refusal: COPY.signatureRefused(entry.name, reason) } }));
      }
    }
    setPublishing(false);
    // The chokepoint announced each local write and the answer re-checked; this covers a press whose local writes
    // all failed but a relay accepted.
    attention.refresh();
  }

  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-setup-main">
        <Link to={ASSISTANT_MANAGEMENT_PATH} className="bs-setup-back">{ASSISTANT_COPY.backToHub}</Link>
        <h1 className="bs-setup-title">{ACTION.title}</h1>
        <p className="bs-idtags-description"><ActionText parts={ACTION.description} /></p>
        <p className="bs-idtags-treasure-map">{COPY.treasureMap}</p>

        {signedOut && (
          <div className="bs-setup-signin">
            <p>{COPY.signedOutLine}</p>
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

        <Card
          signer="person"
          title={COPY.cards.person}
          rows={personRows}
          checked={checked}
          onToggle={toggle}
          onPublish={hasAssistant ? publishPersonTaggings : null}
          publishing={publishing}
          results={results}
          notice={notice}
        />
        <Card
          signer="assistant"
          title={COPY.cards.assistant}
          rows={assistantRows}
          checked={checked}
          onToggle={toggle}
          onPublish={null}
          publishing={false}
          results={{}}
          notice={null}
        />
      </main>
    </div>
  );
}
