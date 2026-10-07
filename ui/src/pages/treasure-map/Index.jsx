import { useState } from 'react';
import { Link } from 'react-router-dom';
import BrainstormDesignShell, { Eyebrow } from '../../components/BrainstormDesignShell';
import { useAuth } from '../../context/AuthContext';
import useTreasureMap from '../../hooks/useTreasureMap';
import { TREASURE_MAP_ADVANCED_PATH } from '../../config/avatarMenuLinks';
import { COPY, FAQS, mapPanelPhase, rawMapText } from './manageTreasureMap';

/**
 * /treasure-map — Manage your Treasure Map (manage-treasure-map #1, ADR manage-treasure-map/0001): the signed-in
 * person's Treasure Map, view-only, in the styling of the owner's Claude Design blueprint
 * (engineering-team/audits/manage-treasure-map/blueprint/). The Brainstorm menus' My Treasure Map opens it; the
 * Tapestry menu keeps the TA Treasure Map page.
 *
 * The Map is read through the hook every page shares, strictly, as /assistants reads it (useTreasureMap; ADR
 * my-assistants/0003): local strfry, then the general-purpose relays. "None" only after a relay was actually read and
 * held nothing; a read that reached no relay says it couldn't read, with Try again. The viewer is the session's user,
 * never a parameter, so nobody else's Map can be shown. Signed out, nothing is read.
 *
 * Story 2 adds the Assistants by category cards between the FAQ and the raw Treasure Map, from the same `map`.
 * The design's Edit mode is a later book: this page signs, publishes and stores nothing.
 */

function Chevron({ open }) {
  return (
    <svg className={`bsd-tm-chevron${open ? ' is-open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg className="bsd-tm-raw-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="bsd-tm-none-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/** The four questions; one answer open at a time. */
function Faq() {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(null);
  return (
    <div className="bsd-tm-faq">
      <button type="button" className="bsd-tm-text-btn" aria-expanded={shown ? 'true' : 'false'} onClick={() => setShown(!shown)}>
        {COPY.faqButton} <Chevron open={shown} />
      </button>
      {shown && (
        <ul className="bsd-tm-card bsd-tm-faq-list">
          {FAQS.map((faq, i) => (
            <li key={faq.q} className="bsd-tm-faq-item">
              <button type="button" className="bsd-tm-faq-q" aria-expanded={open === i ? 'true' : 'false'} onClick={() => setOpen(open === i ? null : i)}>
                <span>{faq.q}</span>
                <Chevron open={open === i} />
              </button>
              {open === i && <p className="bsd-tm-faq-a">{faq.a}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** What the open raw viewer shows, by the read's phase. */
function RawPanel({ phase, map }) {
  if (phase === 'found') return <pre className="bsd-tm-raw-pre">{rawMapText(map.event)}</pre>;
  if (phase === 'none') {
    return (
      <div className="bsd-tm-raw-none">
        <SearchIcon />
        <div>
          <span className="bsd-tm-raw-none-title">{COPY.noneTitle}</span>
          <span className="bsd-tm-raw-none-line">{COPY.noneLine}</span>
        </div>
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <div className="bsd-ma-status is-error bsd-tm-raw-state" role="alert">
        <p>{COPY.error}</p>
        <button type="button" className="bsd-ma-btn" onClick={map.refresh}>{COPY.retry}</button>
      </div>
    );
  }
  return <div className="bsd-ma-status bsd-tm-raw-state" role="status"><p>{COPY.loading}</p></div>;
}

export default function ManageTreasureMapPage() {
  const { user, loading: authLoading, login } = useAuth();
  const viewer = user ? user.pubkey : null;
  const map = useTreasureMap(viewer, { strict: true });
  const phase = mapPanelPhase({ authLoading, user, status: map.status });
  const [rawOpen, setRawOpen] = useState(false);

  return (
    <BrainstormDesignShell>
      <Eyebrow>{COPY.kicker}</Eyebrow>
      <h1 className="bsd-title">Manage your <span className="bsd-title-accent">Treasure Map</span>.</h1>
      <p className="bsd-lede">{COPY.intro}</p>

      <Faq />

      {phase === 'signed-out' ? (
        <div className="bsd-ma-status bsd-tm-signed-out">
          <p>{COPY.signedOut}</p>
          <button type="button" className="bsd-ma-btn is-primary" onClick={() => login().catch(() => {})}>{COPY.signInButton}</button>
        </div>
      ) : (
        <div className="bsd-tm-card bsd-tm-raw">
          <button type="button" className="bsd-tm-raw-toggle" aria-expanded={rawOpen ? 'true' : 'false'} onClick={() => setRawOpen(!rawOpen)}>
            <CodeIcon />
            <span className="bsd-tm-raw-label">{rawOpen ? COPY.rawHide : COPY.rawShow}</span>
            <span className="bsd-tm-chip">{COPY.rawChip}</span>
          </button>
          {rawOpen && <RawPanel phase={phase} map={map} />}
        </div>
      )}

      <div className="bsd-tm-advanced">
        <span>{COPY.advancedPrompt}</span>
        <Link to={TREASURE_MAP_ADVANCED_PATH} className="bsd-tm-text-btn">{COPY.advancedLink}<ArrowIcon /></Link>
      </div>
    </BrainstormDesignShell>
  );
}
