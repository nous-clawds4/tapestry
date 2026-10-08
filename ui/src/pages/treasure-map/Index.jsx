import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BrainstormDesignShell, { Eyebrow } from '../../components/BrainstormDesignShell';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import useTreasureMap from '../../hooks/useTreasureMap';
import { MY_ASSISTANTS_PATH, TREASURE_MAP_ADVANCED_PATH } from '../../config/avatarMenuLinks';
import { fetchProfilesChunked } from '../../utils/profileBatch';
import { cardFields } from '../assistants/myAssistants';
import {
  COPY, FAQS, mapPanelPhase, rawMapText, categoryAssistants, categoryCards,
} from './manageTreasureMap';
import {
  editedDraft, makeRelayFor, saveNote, currentOf, currentAll, pickerRows,
} from './editTreasureMap';
import useMapEdit from './useMapEdit';

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
 * treasure-map-edit #3 (ADR treasure-map-edit/0003) adds the design's Edit mode without Save: Edit beside the section's
 * heading, a list of the person's Assistants per card and for All duties, Undo, the save note, the cards previewing the
 * edited Map, and "View the raw Treasure Map — edited" under the raw viewer. The rules are the pure edit model
 * (editTreasureMap.js); the state is useMapEdit. This page still signs, publishes and stores nothing.
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

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="bsd-tm-edit-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SmallChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
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

// Ids the Edit controls point at, so a screen reader hears which card a button belongs to (story 3 review round 1).
const titleId = (key) => `bsd-tm-cat-title-${key}`;
const willId = (key) => `bsd-tm-edit-will-${key}`;
const ALL_TITLE_ID = 'bsd-tm-edit-all-title';

/** One card: what the category is, and who the Map gives it to; in Edit mode, its picker row under it. */
function CategoryCard({ card, pending, children }) {
  return (
    <li className={`bsd-tm-cat-card${pending ? ' is-pending' : ''}`}>
      <div className="bsd-tm-cat-what">
        <span id={titleId(card.key)} className="bsd-tm-cat-title">{card.title}</span>
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
      {children}
    </li>
  );
}

/**
 * A list of the person's Assistants behind a button (story 3 AC-2, AC-3): its loading, error and empty states, or the
 * rows, Local first, with Local, Current and a check on the selected one. Picking a row calls onPick.
 *
 * An open list closes on Escape, on a press outside it, and when focus moves to something outside it, so it never
 * covers the control focus lands on. A pick, Try again and Escape put focus back on the button (story 3 review round 1).
 * The button names its list in aria-controls only while the list exists.
 */
function Picker({ id, label, filled, open, onToggle, onClose, assistants, onRetry, rows, onPick, align, buttonRef, describedBy }) {
  const wrapper = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      onClose();
      if (buttonRef.current) buttonRef.current.focus();
    };
    const onPress = (e) => { if (wrapper.current && !wrapper.current.contains(e.target)) onClose(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPress);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPress);
    };
  }, [open, onClose, buttonRef]);

  // A blur with no new target (a click on nothing focusable, or a row removed) is left to the press-outside rule.
  const onBlur = (e) => {
    if (open && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) onClose();
  };
  const andFocus = (action) => () => {
    action();
    if (buttonRef.current) buttonRef.current.focus();
  };

  let body;
  if (assistants.phase === 'ready') {
    body = rows.length === 0 ? (
      <div className="bsd-ma-status bsd-tm-edit-list-state">
        <p>
          {COPY.edit.emptyBefore}
          <Link to={MY_ASSISTANTS_PATH}>{COPY.edit.emptyLink}</Link>
          {COPY.edit.emptyAfter}
        </p>
      </div>
    ) : (
      <ul className="bsd-tm-edit-rows">
        {rows.map((row) => (
          <li key={row.pubkey}>
            <button
              type="button"
              className={`bsd-tm-edit-row${row.selected ? ' is-on' : ''}`}
              aria-pressed={row.selected ? 'true' : 'false'}
              onClick={andFocus(() => onPick(row.pubkey))}
            >
              <span className={`bsd-tm-cat-avatar bsd-tm-edit-avatar${row.local ? ' is-local' : ''}`} aria-hidden="true">{row.initial}</span>
              <span className="bsd-tm-edit-row-text">
                <span className="bsd-tm-edit-row-name">
                  <span className="bsd-tm-edit-name">{row.name}</span>
                  {row.local && <span className="bsd-tm-edit-badge is-local">{COPY.edit.local}</span>}
                  {row.current && <span className="bsd-tm-edit-badge">{COPY.edit.current}</span>}
                </span>
                <span className="bsd-tm-edit-row-detail">{row.detail}</span>
              </span>
              {row.selected && <CheckIcon />}
            </button>
          </li>
        ))}
      </ul>
    );
  } else if (assistants.phase === 'error') {
    body = (
      <div className="bsd-ma-status is-error bsd-tm-edit-list-state" role="alert">
        <p>{COPY.edit.error}</p>
        <button type="button" className="bsd-ma-btn" onClick={andFocus(onRetry)}>{COPY.retry}</button>
      </div>
    );
  } else {
    body = <div className="bsd-ma-status bsd-tm-edit-list-state" role="status"><p>{COPY.edit.loading}</p></div>;
  }
  return (
    <div className="bsd-tm-edit-picker" ref={wrapper} onBlur={onBlur}>
      <button
        type="button"
        ref={buttonRef}
        className={`bsd-tm-edit-pick${filled ? ' is-filled' : ''}`}
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={open ? id : undefined}
        aria-describedby={describedBy}
        onClick={onToggle}
      >
        {label}
        <SmallChevron />
      </button>
      {open && <div id={id} className={`bsd-tm-edit-list${align === 'end' ? ' is-end' : ''}`}>{body}</div>}
    </div>
  );
}

/** Pending: the Unsaved chip, who the change goes to, and Undo, described by its card's title. */
function PendingNote({ cardKey, name, onUndo }) {
  return (
    <>
      <span className="bsd-tm-edit-chip">{COPY.edit.unsaved}</span>
      <span id={willId(cardKey)} className="bsd-tm-edit-will">{COPY.edit.assignedTo(name)}</span>
      <button type="button" className="bsd-tm-edit-undo" aria-describedby={titleId(cardKey)} onClick={onUndo}>{COPY.edit.undo}</button>
    </>
  );
}

/**
 * Assistants by category (story 2, ADR 0002 sub-decision 5): nothing is claimed until the Map has been read and its
 * Assistants' names have been looked up, so the cards appear once, already named. A failed name lookup falls back to
 * npubs; it never fails the section.
 *
 * Edit mode (treasure-map-edit #3, ADR 0003 sub-decision 4): once the cards are shown, Edit sits beside the heading.
 * On, the section shows the no-Map warning (no Map read), the All duties row, a picker row on each card and the save
 * note, and the cards preview the edited Map. Names come from the published Map's lookup and the person's Assistants'
 * profiles, so a preview never goes back to the loading line.
 */
function CategoryCards({ phase, map, localPubkey, edit, draft }) {
  const settled = phase === 'found' || phase === 'none';
  const event = phase === 'found' ? map.event : null;
  const assistants = useMemo(() => categoryAssistants(event), [event]);
  const wantedKey = useMemo(
    () => [...new Set([...assistants.scores, ...assistants.lists, ...assistants.concepts])].join(','),
    [assistants],
  );
  const [names, setNames] = useState({ key: null, profiles: {} });
  // Each list's button, for focus after an Undo, which removes the focused button.
  const buttons = { all: useRef(null), scores: useRef(null), lists: useRef(null), concepts: useRef(null) };
  const focusButton = (key) => { if (buttons[key].current) buttons[key].current.focus(); };

  useEffect(() => {
    if (!settled || !wantedKey) return undefined;
    let cancelled = false;
    fetchProfilesChunked(wantedKey.split(','), { isCancelled: () => cancelled })
      .catch(() => ({}))
      .then((profiles) => { if (!cancelled) setNames({ key: wantedKey, profiles }); });
    return () => { cancelled = true; };
  }, [settled, wantedKey]);

  const editing = edit.editing && Boolean(draft);
  const profiles = useMemo(() => ({ ...edit.assistants.profiles, ...names.profiles }), [edit.assistants.profiles, names.profiles]);
  const draftAssistants = useMemo(() => (draft ? categoryAssistants(draft) : null), [draft]);

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
    const published = categoryCards({ assistants, profiles, localPubkey });
    const cards = editing ? categoryCards({ assistants: draftAssistants, profiles, localPubkey }) : published;
    const nameOf = (pubkey) => {
      const row = edit.assistants.rows.find((r) => r.pubkey === pubkey);
      return row ? row.name : cardFields(pubkey, profiles[pubkey]).name;
    };
    const allCurrent = currentAll(published);
    const { pending } = edit;
    body = (
      <>
        {editing && phase === 'none' && (
          <div className="bsd-tm-edit-warning" role="note"><p>{COPY.edit.noMap}</p></div>
        )}
        {editing && (
          <div className="bsd-tm-edit-all">
            <div className="bsd-tm-edit-all-text">
              <span id={ALL_TITLE_ID} className="bsd-tm-edit-all-title">{COPY.edit.allDuties}</span>
              <span className="bsd-tm-edit-all-line">{COPY.edit.allDutiesLine}</span>
            </div>
            <div className="bsd-tm-edit-all-actions">
              {pending.everything && (
                <>
                  <span className="bsd-tm-edit-will">{nameOf(pending.everything)}</span>
                  <button
                    type="button"
                    className="bsd-tm-edit-undo"
                    aria-describedby={ALL_TITLE_ID}
                    onClick={() => { edit.undoEveryone(); focusButton('all'); }}
                  >
                    {COPY.edit.undo}
                  </button>
                </>
              )}
              <Picker
                id="bsd-tm-edit-list-all"
                label={COPY.edit.assignAll}
                filled
                align="end"
                open={edit.openPicker === 'all'}
                onToggle={() => edit.togglePicker('all')}
                onClose={edit.closePicker}
                buttonRef={buttons.all}
                assistants={edit.assistants}
                onRetry={edit.retryAssistants}
                rows={pickerRows(edit.assistants.rows, { current: allCurrent, selected: pending.everything })}
                onPick={(pubkey) => edit.pickEveryone(pubkey, allCurrent)}
              />
            </div>
          </div>
        )}
        <ul className="bsd-tm-cat-list">
          {cards.map((card, i) => {
            if (!editing) return <CategoryCard key={card.key} card={card} />;
            const current = currentOf(published[i]);
            const chosen = pending[card.key];
            return (
              <CategoryCard key={card.key} card={card} pending={Boolean(chosen)}>
                <div className="bsd-tm-edit-cardrow">
                  <Picker
                    id={`bsd-tm-edit-list-${card.key}`}
                    label={chosen ? COPY.edit.change : COPY.edit.choose}
                    open={edit.openPicker === card.key}
                    onToggle={() => edit.togglePicker(card.key)}
                    onClose={edit.closePicker}
                    buttonRef={buttons[card.key]}
                    describedBy={chosen ? `${titleId(card.key)} ${willId(card.key)}` : titleId(card.key)}
                    assistants={edit.assistants}
                    onRetry={edit.retryAssistants}
                    rows={pickerRows(edit.assistants.rows, { current, selected: chosen })}
                    onPick={(pubkey) => edit.pick(card.key, pubkey, current)}
                  />
                  {chosen && (
                    <PendingNote
                      cardKey={card.key}
                      name={nameOf(chosen)}
                      onUndo={() => { edit.undo(card.key); focusButton(card.key); }}
                    />
                  )}
                </div>
              </CategoryCard>
            );
          })}
        </ul>
        {editing && <p className="bsd-tm-edit-note" aria-live="polite">{saveNote(pending, nameOf)}</p>}
        <p className="bsd-tm-cat-mixed-line">
          {COPY.mixedLineBefore}
          <Link to={TREASURE_MAP_ADVANCED_PATH}>{COPY.mixedLineLink}</Link>
          {COPY.mixedLineAfter}
        </p>
      </>
    );
  }
  const showEdit = settled && namesReady;
  return (
    <section className="bsd-tm-cat" aria-labelledby="bsd-tm-cat-heading">
      <div className="bsd-tm-cat-head">
        <h2 id="bsd-tm-cat-heading" className="bsd-tm-cat-heading">{COPY.categoriesHeading}</h2>
        {showEdit && (
          <button
            type="button"
            className={`bsd-tm-edit-toggle${edit.editing ? ' is-on' : ''}`}
            aria-pressed={edit.editing ? 'true' : 'false'}
            onClick={edit.toggleEditing}
          >
            <PencilIcon />
            {edit.editing ? COPY.edit.buttonOn : COPY.edit.button}
          </button>
        )}
      </div>
      {body}
    </section>
  );
}

/**
 * The edited Map, behind its own button under the raw viewer (story 3 AC-6). Rendered only in Edit mode, so it starts
 * closed each time Edit turns on. It shows the Map exactly as Save would sign it, with no id or signature yet.
 */
function EditedRawViewer({ draft }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bsd-tm-card bsd-tm-raw bsd-tm-edit-raw">
      <button type="button" className="bsd-tm-raw-toggle" aria-expanded={open ? 'true' : 'false'} onClick={() => setOpen(!open)}>
        <CodeIcon />
        <span className="bsd-tm-raw-label">{open ? COPY.edit.rawHide : COPY.edit.rawShow}</span>
        <span className="bsd-tm-edit-chip">{COPY.edit.draftChip}</span>
      </button>
      {open && (
        <pre className="bsd-tm-raw-pre" tabIndex={0} role="region" aria-label={COPY.edit.draftBoxLabel}>{rawMapText(draft)}</pre>
      )}
    </div>
  );
}

export default function ManageTreasureMapPage() {
  const { user, loading: authLoading, login } = useAuth();
  const { aRelays } = useConfig();
  const viewer = user ? user.pubkey : null;
  const map = useTreasureMap(viewer, { strict: true });
  const phase = mapPanelPhase({ authLoading, user, status: map.status });
  // The viewer's own Assistant on this instance, from the session (never the instance owner's TA, never a literal).
  const localPubkey = (user && user.assistantPubkey) || null;
  const edit = useMapEdit({ viewer });
  const relayFor = useMemo(() => makeRelayFor({ localPubkey, aRelays }), [localPubkey, aRelays]);
  // The edited Map, while Edit is on and the Map has been read (found, or none: then a new Map).
  const editable = phase === 'found' || phase === 'none';
  const event = phase === 'found' ? map.event : null;
  const draft = useMemo(
    () => (edit.editing && editable && viewer ? editedDraft({ event, viewer, pending: edit.pending, relayFor }) : null),
    [edit.editing, editable, viewer, event, edit.pending, relayFor],
  );

  return (
    <BrainstormDesignShell>
      <Eyebrow>{COPY.kicker}</Eyebrow>
      <h1 className="bsd-title">Manage your <span className="bsd-title-accent">Treasure Map</span>.</h1>
      <p className="bsd-lede">{COPY.intro}</p>

      <Faq />

      {phase !== 'signed-out' && <CategoryCards phase={phase} map={map} localPubkey={localPubkey} edit={edit} draft={draft} />}

      {phase === 'signed-out' ? (
        <div className="bsd-ma-status bsd-tm-signed-out">
          <p>{COPY.signedOut}</p>
          <button type="button" className="bsd-ma-btn is-primary" onClick={() => login().catch(() => {})}>{COPY.signInButton}</button>
        </div>
      ) : (
        <RawViewer phase={phase} map={map} />
      )}

      {draft && <EditedRawViewer draft={draft} />}

      <div className="bsd-tm-advanced">
        <span>{COPY.advancedPrompt}</span>
        <Link to={TREASURE_MAP_ADVANCED_PATH} className="bsd-tm-text-btn">{COPY.advancedLink}<ArrowIcon /></Link>
      </div>
    </BrainstormDesignShell>
  );
}
