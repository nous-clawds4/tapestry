import { useState, useEffect, useRef } from 'react';
import { nip19 } from 'nostr-tools';
import { copyText } from '../utils/clipboard';

/**
 * Per-note actions menu for a single kind-1 feed note: a "⋯" kebab button that
 * opens a dropdown of copy/share actions. Modeled on BrainstormUserMenu's
 * click-to-toggle + click-outside-close pattern.
 *
 * Actions:
 *  - Copy Note Link        → an absolute URL to this instance's /event page,
 *                            carrying the note's nevent (?nevent=<nevent>).
 *  - Copy Note ID (nevent) → the bech32 nevent (id + author), portable across clients.
 *  - Copy Note ID (event id) → the raw 32-byte hex event id.
 *  - Tag Event             → not yet wired; shows a transient "not yet supported" line.
 *
 * Self-contained: derives the nevent client-side from item.id (+ item.pubkey as the
 * author hint) and copies via the shared clipboard helper. Renders nothing if the
 * note has no id (defensive; OK feed items always carry one).
 */
export default function NoteActionsMenu({ item }) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(null); // transient feedback line, e.g. "Link copied"
  const menuRef = useRef(null);

  // Close on click outside (the BrainstormUserMenu convention).
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const eventId = item?.id || null;
  // nevent embeds the event id and (when known) the author, so the link/id resolve
  // even on clients that didn't index this note from our default relays.
  let nevent = null;
  if (eventId) {
    try {
      nevent = nip19.neventEncode(item.pubkey ? { id: eventId, author: item.pubkey } : { id: eventId });
    } catch { nevent = null; }
  }

  // No id ⇒ nothing to copy/share; don't render a dead menu.
  if (!eventId) return null;

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

  function copyLink() {
    if (!nevent) { flashMsg('Link unavailable'); return; }
    doCopy(`${window.location.origin}/event?nevent=${nevent}`, 'Link');
  }

  return (
    <div className="bsp-note-menu" ref={menuRef}>
      <button
        type="button"
        className="bsp-note-menu-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="Note actions"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Note actions"
      >
        ⋯
      </button>
      {open && (
        <div className="bsp-note-menu-dropdown" role="menu">
          <button type="button" className="bsp-note-menu-item" role="menuitem" onClick={copyLink}>
            Copy Note Link
          </button>
          <button type="button" className="bsp-note-menu-item" role="menuitem" onClick={() => doCopy(nevent, 'nevent')}>
            Copy Note ID (nevent)
          </button>
          <button type="button" className="bsp-note-menu-item" role="menuitem" onClick={() => doCopy(eventId, 'Event ID')}>
            Copy Note ID (event id)
          </button>
          <button type="button" className="bsp-note-menu-item" role="menuitem" onClick={() => flashMsg('Tag Event is not yet supported')}>
            Tag Event
          </button>
          {flash && <div className="bsp-note-menu-flash" role="status">{flash}</div>}
        </div>
      )}
    </div>
  );
}
