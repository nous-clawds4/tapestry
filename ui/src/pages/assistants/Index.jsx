import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BrainstormDesignShell, { Eyebrow } from '../../components/BrainstormDesignShell';
import { useAuth } from '../../context/AuthContext';
import { fetchProfilesChunked } from '../../utils/profileBatch';
import {
  COPY, LIST_LABEL, TREASURE_MAP_PATH, IDENTIFICATION_TAGS_PATH, buildRows, countText,
} from './myAssistants';

/**
 * /assistants — My Assistants (my-assistants #1, ADR my-assistants/0001): every profile the signed-in person has
 * tagged My Brainstorm Assistant or My Tapestry Assistant, and their Assistant on this instance, in the styling of
 * the owner's Claude Design blueprint (engineering-team/audits/my-assistants/blueprint/).
 *
 * The rows are GET /api/assistant/my-assistants's answer (the session's viewer, the server's rule); their names, URLs
 * and NIP-05s come from the profile lookup every page shares (fetchProfilesChunked). The page stays on its loading
 * line until both have settled, so the rows appear once, already in order, and "none" is never said before the read
 * has answered or after it failed. It reads; it publishes, signs and stores nothing.
 *
 * Stories 2 and 3 open the rows (tagging actions; Treasure Map duties). The introduction's and the empty line's
 * words already promise them; the book ships the three stories together (book decision 6).
 */

/** The blueprint's house mark on the Local badge. */
function HomeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function AssistantRow({ row }) {
  return (
    <li className={row.local ? 'bsd-ma-row is-local' : 'bsd-ma-row'}>
      <div className="bsd-ma-line">
        <span className="bsd-ma-avatar" aria-hidden="true">{row.initial}</span>
        <span className="bsd-ma-who">
          <span className="bsd-ma-name-line">
            <span className="bsd-ma-name">{row.name}</span>
            {row.local && (
              <span className="bsd-ma-local" title={COPY.localTooltip}><HomeIcon />{COPY.localBadge}</span>
            )}
          </span>
          <span className="bsd-ma-npub">{row.npubShort}</span>
        </span>
        <span className="bsd-ma-field is-url">
          <span className="bsd-ma-label">{COPY.fieldUrl}</span>
          <span className="bsd-ma-value">{row.url}</span>
        </span>
        <span className="bsd-ma-field is-nip05">
          <span className="bsd-ma-label">{COPY.fieldNip05}</span>
          <span className="bsd-ma-value">{row.nip05}</span>
        </span>
        <span className="bsd-ma-tags">
          {row.untagged
            ? <span className="bsd-ma-untagged" title={COPY.notTaggedTooltip}>{COPY.notTagged}</span>
            : row.tags.map((tag) => <span key={tag.key} className={`bsd-ma-chip is-${tag.key}`}>{tag.name}</span>)}
        </span>
      </div>
      {row.untagged && (
        <p className="bsd-ma-prompt">
          {COPY.tagPrompt} <Link to={IDENTIFICATION_TAGS_PATH}>{COPY.tagPromptLink}</Link>
        </p>
      )}
    </li>
  );
}

export default function MyAssistantsPage() {
  const { user, loading: authLoading, login } = useAuth();
  // phase: 'loading' | 'signed-out' | 'error' | 'ready'
  const [view, setView] = useState({ phase: 'loading', rows: [] });
  const latest = useRef(0);

  const load = useCallback(async () => {
    const mine = ++latest.current;
    const settle = (next) => { if (mine === latest.current) setView(next); };
    setView({ phase: 'loading', rows: [] });
    try {
      const res = await fetch('/api/assistant/my-assistants');
      const body = await res.json();
      if (!res.ok || !body || body.success !== true) throw new Error(body && body.error ? body.error : `HTTP ${res.status}`);
      if (body.signedIn !== true) { settle({ phase: 'signed-out', rows: [] }); return; }
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const profiles = rows.length > 0 ? await fetchProfilesChunked(rows.map((r) => r.pubkey)) : {};
      settle({ phase: 'ready', rows: buildRows({ rows, profiles }) });
    } catch {
      settle({ phase: 'error', rows: [] });
    }
  }, []);

  const viewer = user ? user.pubkey : null;
  useEffect(() => {
    if (authLoading) return;
    if (!viewer) { latest.current++; setView({ phase: 'signed-out', rows: [] }); return; }
    load();
  }, [authLoading, viewer, load]);

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
          <button type="button" className="bsd-ma-btn" onClick={load}>{COPY.retry}</button>
        </div>
      )}

      {phase === 'ready' && (
        <>
          <div className="bsd-ma-count-row">
            <span className="bsd-ma-count">{countText(view.rows.length)}</span>
          </div>
          <div className="bsd-ma-card">
            {view.rows.length > 0 ? (
              <ul className="bsd-ma-list" aria-label={LIST_LABEL}>
                {view.rows.map((row) => <AssistantRow key={row.pubkey} row={row} />)}
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
