import { useState, useEffect, useRef } from 'react';
import { nip19 } from 'nostr-tools';
import { copyText } from '../utils/clipboard';

/**
 * Per-tag actions menu for the tag detail page's subject: a "⋯" kebab button that
 * opens a dropdown of copy/inspect actions. A deliberate sibling of NoteActionsMenu
 * (tag-event-inspector ADR 0001 D2) — it emulates that menu's shell and reuses its
 * bsp-note-menu* classes verbatim, but acts on a kind-39999 tag element rather than
 * a kind-1 note, and carries a stateful item the feed menu has no analogue for.
 *
 * Actions:
 *  - Copy Note ID (event id) → the tag definition event's raw 32-byte hex id.
 *  - Copy Note Addr         → the bech32 naddr for `39999:<author>:<slug>`.
 *  - Show/Hide Raw Event    → toggles the page-level raw panel; the label flips in
 *                             place, so the viewer can toggle straight back.
 *
 * Inspection is a read over public data: this menu performs no authorship, trust,
 * POV or login check (ADR 0001 §Architecture invariants #2). It renders signed out,
 * and it renders for a tag authored by anyone — because anyone may publish one.
 * Renders nothing if the tag has not loaded (no dead affordance, AC-1).
 */
export default function TagActionsMenu({ tag, rawOpen, onToggleRaw }) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(null); // transient feedback line, e.g. "Addr copied"
  const menuRef = useRef(null);

  // Close on click outside (the emulated convention). Selecting an item does NOT
  // close the menu — see the item handlers below.
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // The tag's stable coordinate is `39999:${tag.authorPubkey}:${tag.slug}`
  // (publishProfileTag.js, ADR-0022). naddr encodes exactly that: kind + the TAG
  // ELEMENT'S OWN AUTHOR + the d-tag/slug. The author is an ordinary user, so the
  // instance's assistant is irrelevant here — substituting it would emit an address
  // for an event that does not exist.
  //
  // The guard mirrors publishProfileTag.js, which validates the identical field for
  // the identical coordinate: naddrEncode calls hexToBytes/utf8Encoder.encode, both
  // of which throw on malformed input. A null naddr degrades to "Addr unavailable"
  // via doCopy, rather than emitting a wrong or partial address (ADR 0001 D5).
  let naddr = null;
  if (/^[0-9a-f]{64}$/.test(tag?.authorPubkey || '') && tag?.slug) {
    try {
      naddr = nip19.naddrEncode({
        kind: 39999,
        pubkey: tag.authorPubkey,
        identifier: tag.slug,
      });
    } catch { naddr = null; }
  }

  // Tag not loaded ⇒ nothing to copy or inspect; don't render a dead menu.
  if (!tag?.eventId) return null;

  function flashMsg(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1600);
  }

  async function doCopy(value, label) {
    if (!value) { flashMsg(`${label} unavailable`); return; }
    try {
      await copyText(value);
      flashMsg(`${label} copied`);
    } catch {
      flashMsg('Copy failed');
    }
  }

  // The panel renders from data the page already has, so an absent rawEvent reports
  // rather than opening an empty panel that could read as "this tag has no
  // definition" (AC-6) — the emulated "<label> unavailable" convention.
  function toggleRaw() {
    if (!tag.rawEvent) { flashMsg('Raw Event unavailable'); return; }
    onToggleRaw();
  }

  return (
    <div className="bsp-note-menu" ref={menuRef}>
      <button
        type="button"
        className="bsp-note-menu-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="Tag actions"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Tag actions"
      >
        ⋯
      </button>
      {open && (
        <div className="bsp-note-menu-dropdown" role="menu">
          <button type="button" className="bsp-note-menu-item" role="menuitem" onClick={() => doCopy(tag.eventId, 'Event ID')}>
            Copy Note ID (event id)
          </button>
          <button type="button" className="bsp-note-menu-item" role="menuitem" onClick={() => doCopy(naddr, 'Addr')}>
            Copy Note Addr
          </button>
          <button type="button" className="bsp-note-menu-item" role="menuitem" onClick={toggleRaw}>
            {rawOpen ? 'Hide Raw Event' : 'Show Raw Event'}
          </button>
          {flash && <div className="bsp-note-menu-flash" role="status">{flash}</div>}
        </div>
      )}
    </div>
  );
}
