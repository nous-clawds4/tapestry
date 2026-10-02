import { useEffect, useRef, useState } from 'react';
import DictIcon from '../dictionaries/DictIcon';
import { ALL, ALL_LABEL } from '../dictionaries/managedDictionary';

/**
 * "Managed by" beside the Dictionary's title (the design's Dictionary screen): which of the reader's
 * Assistants' Dictionaries the list shows, or all of them. Signed out it is a plain label, since the
 * list of Assistants is the signed-in reader's own.
 *
 * Keyboard: opening moves focus to the chosen option; Arrow keys, Home and End move between options;
 * Escape (from the menu or the trigger), a pick, or tabbing away closes the menu, and Escape and a
 * pick return focus to the trigger. Focus leaving for nowhere (Safari blurs a pressed button without
 * focusing it) is not leaving the menu, or a mouse or touch pick would close it before it lands.
 */
export default function ManagedBy({ person, status, options, choice, onPick }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);

  const close = (refocus) => {
    setOpen(false);
    if (refocus && trigger.current) trigger.current.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', outside);
    const items = menu.current ? [...menu.current.querySelectorAll('[role="menuitemradio"]')] : [];
    (items.find((el) => el.getAttribute('aria-checked') === 'true') || items[0])?.focus();
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  if (person.loading) return null;
  if (!person.signedIn) {
    return <span className="bsd-managed">Managed by <span className="bsd-managed-name">The owner’s Assistant</span></span>;
  }
  if (status !== 'ready' || options.length === 0) {
    return (
      <span className="bsd-managed">
        Managed by <span className="bsd-managed-name">{status === 'loading' ? '…' : 'your Assistant'}</span>
      </span>
    );
  }

  const all = choice === ALL;
  const current = all ? null : options.find((o) => o.key === choice) || options.find((o) => o.local) || options[0];
  const rows = options.length > 1
    ? [...options, { key: ALL, name: ALL_LABEL, initial: '∪', detail: 'Union of their Dictionaries, with support counts', union: true }]
    : options;

  const onMenuKey = (e) => {
    const items = [...menu.current.querySelectorAll('[role="menuitemradio"]')];
    const at = items.indexOf(document.activeElement);
    const go = (i) => { e.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(items.length - 1);
  };

  return (
    <div
      className="bsd-managed-wrap" ref={wrap}
      onBlur={(e) => { if (open && e.relatedTarget && !wrap.current.contains(e.relatedTarget)) setOpen(false); }}
      onKeyDown={(e) => { if (open && e.key === 'Escape') { e.preventDefault(); close(true); } }}
    >
      <button
        type="button" ref={trigger} className="bsd-managed bsd-managed-btn" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Managed by <span className="bsd-managed-name">{all ? ALL_LABEL : current.name}</span>
        <span className={`dict-chev${open ? ' is-open' : ''}`}><DictIcon name="chevron" size={12} /></span>
      </button>
      {open && (
        <div className="bsd-managed-menu" role="menu" aria-label="Whose Dictionary to show" ref={menu} onKeyDown={onMenuKey}>
          {rows.map((o) => {
            const on = o.key === (all ? ALL : current.key);
            return (
              <button
                key={o.key} type="button" role="menuitemradio" aria-checked={on}
                className={`bsd-managed-option${on ? ' is-on' : ''}${o.union ? ' is-union' : ''}`}
                onClick={() => { close(true); onPick(o.key); }}
              >
                <span className={`bsd-managed-avatar${o.local ? ' is-local' : ''}${o.union ? ' is-union' : ''}`} aria-hidden="true">{o.initial}</span>
                <span className="bsd-managed-text">
                  <span className="bsd-managed-line">
                    <span className="bsd-managed-option-name">{o.name}</span>
                    {o.local && !o.self && <span className="bsd-managed-local">Local</span>}
                  </span>
                  <span className="bsd-managed-detail">{o.detail}</span>
                </span>
                {on && <span className="bsd-managed-check"><DictIcon name="check" /></span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
