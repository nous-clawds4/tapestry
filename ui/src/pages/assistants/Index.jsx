import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BrainstormDesignShell, { Eyebrow } from '../../components/BrainstormDesignShell';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { fetchProfilesChunked } from '../../utils/profileBatch';
import { PUBLISH_RELAYS } from '../../utils/nostrPublish';
import { publishProfileTagAssertionWithReport, publishTaggingWithdrawalWithReport } from '../../utils/publishProfileTag';
import { relayLine, publishTone } from '../../utils/taggingPublishReport';
import { COPY, LIST_LABEL, TREASURE_MAP_PATH, buildRows, countText, rowActions } from './myAssistants';
import { tagProfile, changeTag, removeTags } from './assistantActions';
import AssistantRow from './AssistantRow';
import AssistantSearch from './AssistantSearch';

/**
 * /assistants — My Assistants (my-assistants #1, ADR my-assistants/0001; the actions since #2, ADR my-assistants/0002):
 * every profile the signed-in person has tagged My Brainstorm Assistant or My Tapestry Assistant, and their Assistant on
 * this instance, in the styling of the owner's Claude Design blueprint (engineering-team/audits/my-assistants/blueprint/).
 *
 * The rows are GET /api/assistant/my-assistants's answer (the session's viewer, the server's rule); their names, URLs
 * and NIP-05s come from the profile lookup every page shares (fetchProfilesChunked). The first load stays on its
 * loading line until both have settled, so the rows appear once, already in order, and "none" is never said before the
 * read has answered or after it failed.
 *
 * Story 2 adds the search card (AssistantSearch), rows that open (AssistantRow), and the result area. Every press is
 * signed in the browser by the viewer's extension through the tagging publishers (assistantActions holds the order),
 * one press at a time; then the list is re-read with the rows kept on screen (a refresh: no loading line), and the
 * result area says what each relay did.
 */

export default function MyAssistantsPage() {
  const { user, loading: authLoading, login } = useAuth();
  const { taPubkey } = useConfig();
  // phase: 'loading' | 'signed-out' | 'error' | 'ready'
  const [view, setView] = useState({ phase: 'loading', rows: [], definitions: null });
  const [openKey, setOpenKey] = useState(null);
  const [busy, setBusy] = useState(null); // { kind: 'tag'|'change'|'remove', pubkey, key? } while a press publishes
  const [outcome, setOutcome] = useState(null); // { reports, refused?, refreshFailed? } of the last press
  const latest = useRef(0);

  /** Read the list. A refresh keeps the rows on screen and reports whether it succeeded (ADR 0002 sub-decision 5). */
  const load = useCallback(async ({ refresh = false } = {}) => {
    const mine = ++latest.current;
    const settle = (next) => { if (mine === latest.current) setView(next); };
    if (!refresh) setView({ phase: 'loading', rows: [], definitions: null });
    try {
      const res = await fetch('/api/assistant/my-assistants');
      const body = await res.json();
      if (!res.ok || !body || body.success !== true) throw new Error(body && body.error ? body.error : `HTTP ${res.status}`);
      if (body.signedIn !== true) { settle({ phase: 'signed-out', rows: [], definitions: null }); return true; }
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const profiles = rows.length > 0 ? await fetchProfilesChunked(rows.map((r) => r.pubkey)) : {};
      settle({ phase: 'ready', rows: buildRows({ rows, profiles }), definitions: body.definitions || null });
      return true;
    } catch {
      if (!refresh) settle({ phase: 'error', rows: [], definitions: null });
      return false;
    }
  }, []);

  const viewer = user ? user.pubkey : null;
  useEffect(() => {
    if (authLoading) return;
    if (!viewer) { latest.current++; setView({ phase: 'signed-out', rows: [], definitions: null }); return; }
    load();
  }, [authLoading, viewer, load]);

  /** The real publishers, handed to the actions (assistantActions takes them as dependencies). */
  const deps = {
    relays: PUBLISH_RELAYS,
    applyTagging: (args) => publishProfileTagAssertionWithReport({ ...args, localTaPubkey: taPubkey }),
    withdrawTaggings: ({ ids, addresses }) => publishTaggingWithdrawalWithReport({ ids, addresses }),
  };

  /** One press: publish, re-read the list, say what happened. Every action button is disabled meanwhile. */
  async function press(busyState, action) {
    if (busy) return;
    setBusy(busyState);
    setOutcome(null);
    let out;
    try {
      out = await action();
    } catch (err) {
      out = { reports: [], refused: (err && err.message) || 'Something went wrong.' };
    }
    const refreshed = await load({ refresh: true });
    setOutcome({ ...out, refreshFailed: !refreshed });
    setBusy(null);
  }

  const definitions = view.definitions;
  const onTag = (pubkey, tagKey) => press({ kind: 'tag', pubkey, key: tagKey },
    () => tagProfile({ target: pubkey, tagKey, definitions, deps }));
  const phase = authLoading ? 'loading' : view.phase;
  const listed = view.rows.some((row) => row.pubkey === openKey);

  return (
    <BrainstormDesignShell wide>
      <Eyebrow>{COPY.kicker}</Eyebrow>
      <h1 className="bsd-title">Your <span className="bsd-title-accent">Assistants</span>.</h1>
      <p className="bsd-lede">
        Every profile you’ve tagged <strong>My Brainstorm Assistant</strong> or <strong>My Tapestry Assistant</strong>.
        {' '}Open a row to see what that Assistant does according to your <Link to={TREASURE_MAP_PATH}>Treasure Map</Link>.
      </p>

      {phase === 'loading' && (
        <div className="bsd-ma-status" role="status"><p>{COPY.loading}</p></div>
      )}

      {phase === 'signed-out' && (
        <div className="bsd-ma-status">
          <p>{COPY.signedOut}</p>
          <button type="button" className="bsd-ma-btn is-primary" onClick={() => login().catch(() => {})}>{COPY.signInButton}</button>
        </div>
      )}

      {phase === 'error' && (
        <div className="bsd-ma-status is-error" role="alert">
          <p>{COPY.error}</p>
          <button type="button" className="bsd-ma-btn" onClick={() => load()}>{COPY.retry}</button>
        </div>
      )}

      {phase === 'ready' && (
        <>
          <AssistantSearch rows={view.rows} definitions={definitions} viewer={viewer} busy={busy} onTag={onTag} />

          {outcome && (
            <div className="bsd-ma-outcome" role="status">
              {outcome.refused && <p className="bsd-ma-outcome-line is-error">{outcome.refused}</p>}
              {(outcome.reports || []).map((report, i) => (
                <div key={i} className={`bsd-ma-outcome-report is-${publishTone(report)}`}>
                  <p className="bsd-ma-outcome-line">{report.message}</p>
                  {report.rows.length > 0 && (
                    <ul className="bsd-ma-relays">
                      {report.rows.map((r) => <li key={r.relay}><code>{r.relay}</code> {relayLine(r)}</li>)}
                    </ul>
                  )}
                </div>
              ))}
              {outcome.refreshFailed && <p className="bsd-ma-outcome-line">{COPY.refreshFailed}</p>}
            </div>
          )}

          <div className="bsd-ma-count-row">
            <span className="bsd-ma-count">{countText(view.rows.length)}</span>
          </div>
          <div className="bsd-ma-card">
            {view.rows.length > 0 ? (
              <ul className="bsd-ma-list" aria-label={LIST_LABEL}>
                {view.rows.map((row) => (
                  <AssistantRow
                    key={row.pubkey}
                    row={row}
                    open={listed && openKey === row.pubkey}
                    onToggle={() => setOpenKey(openKey === row.pubkey ? null : row.pubkey)}
                    actions={rowActions(row, definitions)}
                    busy={busy}
                    onChange={(toKey) => press({ kind: 'change', pubkey: row.pubkey },
                      () => changeTag({ row, toKey, definitions, deps }))}
                    onRemove={() => press({ kind: 'remove', pubkey: row.pubkey },
                      () => removeTags({ row, deps }))}
                  />
                ))}
              </ul>
            ) : (
              <p className="bsd-ma-note">{COPY.empty}</p>
            )}
          </div>
        </>
      )}
    </BrainstormDesignShell>
  );
}
