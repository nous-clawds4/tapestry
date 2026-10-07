import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BrainstormDesignShell, { Eyebrow } from '../../components/BrainstormDesignShell';
import { useAuth } from '../../context/AuthContext';
import useTreasureMap from '../../hooks/useTreasureMap';
import { TREASURE_MAP_ADVANCED_PATH } from '../../config/avatarMenuLinks';
import { fetchProfilesChunked } from '../../utils/profileBatch';
import {
  COPY, FAQS, mapPanelPhase, rawMapText, categoryAssistants, categoryCards,
} from './manageTreasureMap';

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
 * Story 2 (ADR manage-treasure-map/0002) adds the Assistants by category cards between the FAQ and the raw Treasure
 * Map, from the same `map`: who the Map gives Scores, Lists and Concepts to, named through the profile lookup every page
 * shares. It also starts the raw viewer closed for each viewer, closes the FAQ's answer when the FAQ is hidden, and
 * lets the keyboard reach and scroll the raw box (story 1's review, non-blocking 1, 2 and 4).
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
      <button
        type="button"
        className="bsd-tm-text-btn"
        aria-expanded={shown ? 'true' : 'false'}
        onClick={() => { setOpen(null); setShown(!shown); }}
      >
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
  if (phase === 'found') {
    // Focusable and named, so a keyboard user can reach the box and scroll it sideways with the arrow keys.
    return <pre className="bsd-tm-raw-pre" tabIndex={0} role="region" aria-label={COPY.rawBoxLabel}>{rawMapText(map.event)}</pre>;
  }
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

/**
 * The raw Treasure Map, behind its button. It starts closed for each viewer because signing out replaces it with the
 * sign-in prompt, which unmounts it; on this page the viewer can't otherwise change, apart from one narrow top-bar path
 * (ADR 0002 Amendment 2 and its correction; ledger 2026-10-07-top-bar-sign-in-while-loading). So it has no key, and
 * sign-in settling, which isn't a new viewer, leaves a viewer opened meanwhile open.
 */
function RawViewer({ phase, map }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bsd-tm-card bsd-tm-raw">
      <button type="button" className="bsd-tm-raw-toggle" aria-expanded={open ? 'true' : 'false'} onClick={() => setOpen(!open)}>
        <CodeIcon />
        <span className="bsd-tm-raw-label">{open ? COPY.rawHide : COPY.rawShow}</span>
        <span className="bsd-tm-chip">{COPY.rawChip}</span>
      </button>
      {open && <RawPanel phase={phase} map={map} />}
    </div>
  );
}

function Avatar({ person }) {
  return <span className={`bsd-tm-cat-avatar${person.local ? ' is-local' : ''}`} aria-hidden="true">{person.initial}</span>;
}

/** One card: what the category is, and who the Map gives it to. */
function CategoryCard({ card }) {
  return (
    <li className="bsd-tm-cat-card">
      <div className="bsd-tm-cat-what">
        <span className="bsd-tm-cat-title">{card.title}</span>
        <span className="bsd-tm-cat-desc">{card.description}</span>
      </div>
      <div className="bsd-tm-cat-who">
        {card.state === 'none' ? (
          <span className="bsd-tm-cat-none">{COPY.notAssigned}</span>
        ) : (
          <>
            <span className="bsd-tm-cat-label">{COPY.assignedTo}</span>
            {card.state === 'single' ? (
              <span className="bsd-tm-cat-assignee">
                <Avatar person={card.people[0]} />
                <span className="bsd-tm-cat-name">{card.people[0].name}</span>
              </span>
            ) : (
              <div className="bsd-tm-cat-assignee">
                <span className="bsd-tm-cat-avatars">
                  {card.avatars.map((person) => <Avatar key={person.pubkey} person={person} />)}
                </span>
                <span className="bsd-tm-cat-name">{COPY.mixed}</span>
                <span className="bsd-tm-cat-count">{COPY.mixedCount(card.count)}</span>
                {/* Only initials show; every Assistant's name is here for screen readers. */}
                <ul className="bs-sr-only">
                  {card.people.map((person) => <li key={person.pubkey}>{person.name}</li>)}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/**
 * Assistants by category (story 2, ADR 0002 sub-decision 5): nothing is claimed until the Map has been read and its
 * Assistants' names have been looked up, so the cards appear once, already named. A failed name lookup falls back to
 * npubs; it never fails the section.
 */
function CategoryCards({ phase, map, localPubkey }) {
  const settled = phase === 'found' || phase === 'none';
  const event = phase === 'found' ? map.event : null;
  const assistants = useMemo(() => categoryAssistants(event), [event]);
  const wantedKey = useMemo(
    () => [...new Set([...assistants.scores, ...assistants.lists, ...assistants.concepts])].join(','),
    [assistants],
  );
  const [names, setNames] = useState({ key: null, profiles: {} });

  useEffect(() => {
    if (!settled || !wantedKey) return undefined;
    let cancelled = false;
    fetchProfilesChunked(wantedKey.split(','), { isCancelled: () => cancelled })
      .catch(() => ({}))
      .then((profiles) => { if (!cancelled) setNames({ key: wantedKey, profiles }); });
    return () => { cancelled = true; };
  }, [settled, wantedKey]);

  const namesReady = !wantedKey || names.key === wantedKey;
  let body;
  if (phase === 'error') {
    body = (
      <div className="bsd-ma-status is-error bsd-tm-cat-state" role="alert">
        <p>{COPY.error}</p>
        <button type="button" className="bsd-ma-btn" onClick={map.refresh}>{COPY.retry}</button>
      </div>
    );
  } else if (!settled || !namesReady) {
    body = <div className="bsd-ma-status bsd-tm-cat-state" role="status"><p>{COPY.loading}</p></div>;
  } else {
    const cards = categoryCards({ assistants, profiles: names.profiles, localPubkey });
    body = (
      <>
        <ul className="bsd-tm-cat-list">
          {cards.map((card) => <CategoryCard key={card.key} card={card} />)}
        </ul>
        <p className="bsd-tm-cat-mixed-line">
          {COPY.mixedLineBefore}
          <Link to={TREASURE_MAP_ADVANCED_PATH}>{COPY.mixedLineLink}</Link>
          {COPY.mixedLineAfter}
        </p>
      </>
    );
  }
  return (
    <section className="bsd-tm-cat" aria-labelledby="bsd-tm-cat-heading">
      <h2 id="bsd-tm-cat-heading" className="bsd-tm-cat-heading">{COPY.categoriesHeading}</h2>
      {body}
    </section>
  );
}

export default function ManageTreasureMapPage() {
  const { user, loading: authLoading, login } = useAuth();
  const viewer = user ? user.pubkey : null;
  const map = useTreasureMap(viewer, { strict: true });
  const phase = mapPanelPhase({ authLoading, user, status: map.status });
  // The viewer's own Assistant on this instance, from the session (never the instance owner's TA, never a literal).
  const localPubkey = (user && user.assistantPubkey) || null;

  return (
    <BrainstormDesignShell>
      <Eyebrow>{COPY.kicker}</Eyebrow>
      <h1 className="bsd-title">Manage your <span className="bsd-title-accent">Treasure Map</span>.</h1>
      <p className="bsd-lede">{COPY.intro}</p>

      <Faq />

      {phase !== 'signed-out' && <CategoryCards phase={phase} map={map} localPubkey={localPubkey} />}

      {phase === 'signed-out' ? (
        <div className="bsd-ma-status bsd-tm-signed-out">
          <p>{COPY.signedOut}</p>
          <button type="button" className="bsd-ma-btn is-primary" onClick={() => login().catch(() => {})}>{COPY.signInButton}</button>
        </div>
      ) : (
        <RawViewer phase={phase} map={map} />
      )}

      <div className="bsd-tm-advanced">
        <span>{COPY.advancedPrompt}</span>
        <Link to={TREASURE_MAP_ADVANCED_PATH} className="bsd-tm-text-btn">{COPY.advancedLink}<ArrowIcon /></Link>
      </div>
    </BrainstormDesignShell>
  );
}
