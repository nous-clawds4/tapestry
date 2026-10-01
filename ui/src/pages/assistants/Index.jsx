import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BrainstormDesignShell, { Eyebrow } from '../../components/BrainstormDesignShell';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import useTreasureMap from '../../hooks/useTreasureMap';
import { fetchProfilesChunked } from '../../utils/profileBatch';
import { PUBLISH_RELAYS } from '../../utils/nostrPublish';
import { CONCEPT_PUBLISH_RELAYS } from '../../utils/dispositionActions';
import { publishProfileTagAssertionWithReport, publishTaggingWithdrawalWithReport } from '../../utils/publishProfileTag';
import { relayLine, publishTone } from '../../utils/taggingPublishReport';
import {
  COPY, LIST_LABEL, TREASURE_MAP_PATH, buildRows, countText, rowActions,
  treasureMapDuties, dutiesOf, mapOnlyAssistants, dutyRows,
} from './myAssistants';
import { tagProfile, changeTag, removeTags } from './assistantActions';
import AssistantRow from './AssistantRow';
import AssistantSearch from './AssistantSearch';
import MapOnlySection from './MapOnlySection';
import DutiesTab from './DutiesTab';

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
 *
 * Story 3 adds the viewer's Treasure Map, read strictly through the hook every page shares (useTreasureMap, ADR
 * my-assistants/0003): each row's status and duties, the count of rows on it, the Assistants it gives duties to that
 * aren't in the list (MapOnlySection, whose Tag buttons use the same press), and a Duties tab (DutiesTab). Nothing is
 * claimed about the Map until it has been read, and a failed read says so with Try again.
 */

/**
 * Where a withdrawal goes: the outside relays an apply goes to, plus the community relay, so the deletion reaches
 * every instance's router and every reader of dcosl (ADR my-assistants/0002 Amendment 1, sub-decision 11). It is handed
 * to assistantActions, which sends the withdrawal to it and reports against it (ADR my-assistants/0003 sub-decision 6).
 */
const WITHDRAW_RELAYS = [...new Set([...PUBLISH_RELAYS, ...CONCEPT_PUBLISH_RELAYS])];

export default function MyAssistantsPage() {
  const { user, loading: authLoading, login } = useAuth();
  const { taPubkey } = useConfig();
  // phase: 'loading' | 'signed-out' | 'error' | 'ready'
  const [view, setView] = useState({ phase: 'loading', rows: [], definitions: null });
  const [openKey, setOpenKey] = useState(null);
  const [busy, setBusy] = useState(null); // { kind: 'tag'|'change'|'remove', pubkey, key? } while a press publishes
  const [outcome, setOutcome] = useState(null); // { reports, refused?, refreshFailed? } of the last press
  const latest = useRef(0);
  const outcomeRef = useRef(null);

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

  // A row that leaves the list is no longer open, so a profile tagged again comes back closed (Amendment 1, 13).
  useEffect(() => {
    if (openKey && !view.rows.some((row) => row.pubkey === openKey)) setOpenKey(null);
  }, [view.rows, openKey]);

  // After a press, focus moves to the result area, which says what happened (the pressed button may be disabled).
  useEffect(() => {
    if (outcome && outcomeRef.current) outcomeRef.current.focus();
  }, [outcome]);

  const viewer = user ? user.pubkey : null;
  useEffect(() => {
    if (authLoading) return;
    if (!viewer) { latest.current++; setView({ phase: 'signed-out', rows: [], definitions: null }); return; }
    load();
  }, [authLoading, viewer, load]);

  // ── The Treasure Map (my-assistants #3) ──
  const map = useTreasureMap(viewer, { strict: true });
  const mapKnown = map.status === 'found' || map.status === 'none';
  const duties = useMemo(() => (map.status === 'found' ? treasureMapDuties(map.event) : []), [map.status, map.event]);
  const mapOnly = useMemo(() => mapOnlyAssistants(duties, view.rows), [duties, view.rows]);
  const mapOnlyKey = mapOnly.map((m) => m.pubkey).join(',');
  const [mapOnlyProfiles, setMapOnlyProfiles] = useState({});
  useEffect(() => {
    if (!mapOnlyKey) return undefined;
    let cancelled = false;
    fetchProfilesChunked(mapOnlyKey.split(','))
      .then((profiles) => { if (!cancelled) setMapOnlyProfiles((known) => ({ ...known, ...profiles })); })
      .catch(() => { /* unnamed: each shows its short npub */ });
    return () => { cancelled = true; };
  }, [mapOnlyKey]);
  // The section's cards: buildRows' fields (name, URL, NIP-05, with their fallbacks), in the Map's order.
  const mapOnlyItems = useMemo(() => {
    const cards = new Map(buildRows({ rows: mapOnly.map((m) => ({ pubkey: m.pubkey, tags: [] })), profiles: mapOnlyProfiles })
      .map((card) => [card.pubkey, card]));
    return mapOnly.map((m) => ({ ...cards.get(m.pubkey), count: m.count }));
  }, [mapOnly, mapOnlyProfiles]);
  const names = useMemo(() => {
    const out = {};
    for (const item of mapOnlyItems) out[item.pubkey] = item.name;
    for (const row of view.rows) out[row.pubkey] = row.name;
    return out;
  }, [mapOnlyItems, view.rows]);
  const onMapCount = view.rows.filter((row) => dutiesOf(row.pubkey, duties).count > 0).length;

  // ── The tabs (AC-5): Assistants | Duties, arrow keys moving the selection and the focus ──
  const [tab, setTab] = useState('assistants');
  const tabRefs = useRef({});
  function onTabKey(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = tab === 'assistants' ? 'duties' : 'assistants';
    setTab(next);
    if (tabRefs.current[next]) tabRefs.current[next].focus();
  }

  /** The real publishers, handed to the actions (assistantActions takes them as dependencies). */
  const deps = {
    relays: PUBLISH_RELAYS,
    withdrawRelays: WITHDRAW_RELAYS,
    applyTagging: (args) => publishProfileTagAssertionWithReport({ ...args, localTaPubkey: taPubkey }),
    withdrawTaggings: ({ ids, addresses, relays }) => publishTaggingWithdrawalWithReport({ ids, addresses, relays }),
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
        <div className="bsd-ma-tabs" role="tablist" aria-label={COPY.tabsLabel} onKeyDown={onTabKey}>
          {['assistants', 'duties'].map((key) => (
            <button
              key={key}
              ref={(el) => { tabRefs.current[key] = el; }}
              type="button"
              role="tab"
              id={`bsd-ma-tab-${key}`}
              aria-selected={tab === key ? 'true' : 'false'}
              aria-controls={`bsd-ma-tabpanel-${key}`}
              tabIndex={tab === key ? 0 : -1}
              className={`bsd-ma-tab${tab === key ? ' is-selected' : ''}`}
              onClick={() => setTab(key)}
            >
              {COPY.tabs[key]}
            </button>
          ))}
        </div>
      )}

      {phase === 'ready' && tab === 'duties' && (
        <div role="tabpanel" id="bsd-ma-tabpanel-duties" aria-labelledby="bsd-ma-tab-duties">
          <DutiesTab status={map.status} rows={dutyRows(duties, names, view.rows)} onRetry={map.refresh} />
        </div>
      )}

      {phase === 'ready' && tab === 'assistants' && (
        <div role="tabpanel" id="bsd-ma-tabpanel-assistants" aria-labelledby="bsd-ma-tab-assistants">
          <AssistantSearch rows={view.rows} definitions={definitions} viewer={viewer} busy={busy} onTag={onTag} />

          {/* Always present while the page is ready, so a screen reader announces what a press did (Amendment 1, 13). */}
          <div className="bsd-ma-outcome" role="status" tabIndex={-1} ref={outcomeRef}>
            {outcome && (
              <>
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
              </>
            )}
          </div>

          <div className="bsd-ma-count-row">
            <span className="bsd-ma-count">{countText(view.rows.length)}</span>
            {mapKnown && <span className="bsd-ma-count-aside">{COPY.onMapCount(onMapCount)}</span>}
          </div>
          {map.status === 'error' && (
            <div className="bsd-ma-status is-error" role="alert">
              <p>{COPY.mapError}</p>
              <button type="button" className="bsd-ma-btn" onClick={map.refresh}>{COPY.retry}</button>
            </div>
          )}
          <div className="bsd-ma-card">
            {view.rows.length > 0 ? (
              <ul className="bsd-ma-list" aria-label={LIST_LABEL}>
                {view.rows.map((row) => (
                  <AssistantRow
                    key={row.pubkey}
                    row={row}
                    open={openKey === row.pubkey}
                    onToggle={() => setOpenKey(openKey === row.pubkey ? null : row.pubkey)}
                    actions={rowActions(row, definitions)}
                    busy={busy}
                    onChange={(toKey) => press({ kind: 'change', pubkey: row.pubkey },
                      () => changeTag({ row, toKey, definitions, deps }))}
                    onRemove={() => press({ kind: 'remove', pubkey: row.pubkey },
                      () => removeTags({ row, deps }))}
                    mapStatus={map.status}
                    duties={dutiesOf(row.pubkey, duties)}
                  />
                ))}
              </ul>
            ) : (
              <p className="bsd-ma-note">{COPY.empty}</p>
            )}
          </div>

          <MapOnlySection items={mapOnlyItems} definitions={definitions} busy={busy} onTag={onTag} />
        </div>
      )}
    </BrainstormDesignShell>
  );
}
