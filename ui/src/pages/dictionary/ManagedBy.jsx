import { useEffect, useRef, useState } from 'react';
import DictIcon from '../dictionaries/DictIcon';
import { ALL, ALL_LABEL } from '../dictionaries/managedDictionary';

/**
 * "Managed by" beside the Dictionary's title (the design's Dictionary screen): which of the reader's
 * Assistants' Dictionaries the list shows, or all of them. Signed out it is a plain label, since the
 * list of Assistants is the signed-in reader's own.
 */
export default function ManagedBy({ person, status, options, choice, onPick }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (person.loading) return null;
  if (!person.signedIn) {
    return <span className="bsd-managed">Managed by <span className="bsd-managed-name">The owner’s Assistant</span></span>;
  }
  if (status !== 'ready' || options.length === 0) {
    return (
      <span className="bsd-managed" title={status === 'error' ? 'Couldn’t load your Assistants' : undefined}>
        Managed by <span className="bsd-managed-name">{status === 'loading' ? '…' : 'your Assistant'}</span>
      </span>
    );
  }

  const all = choice === ALL;
  const current = all ? null : options.find((o) => o.key === choice) || options.find((o) => o.local) || options[0];
  const rows = options.length > 1
    ? [...options, { key: ALL, name: ALL_LABEL, initial: '∪', detail: 'Union of their Dictionaries, with support counts', union: true }]
    : options;

  return (
    <div className="bsd-managed-wrap" ref={wrap}>
      <button
        type="button" className="bsd-managed bsd-managed-btn" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Managed by <span className="bsd-managed-name">{all ? ALL_LABEL : current.name}</span>
        <span className={`dict-chev${open ? ' is-open' : ''}`}><DictIcon name="chevron" size={12} /></span>
      </button>
      {open && (
        <div className="bsd-managed-menu" role="menu" aria-label="Whose Dictionary to show">
          {rows.map((o) => {
            const on = o.key === (all ? ALL : current.key);
            return (
              <button
                key={o.key} type="button" role="menuitemradio" aria-checked={on}
                className={`bsd-managed-option${on ? ' is-on' : ''}${o.union ? ' is-union' : ''}`}
                onClick={() => { setOpen(false); onPick(o.key); }}
              >
                <span className={`bsd-managed-avatar${o.local ? ' is-local' : ''}${o.union ? ' is-union' : ''}`} aria-hidden="true">{o.initial}</span>
                <span className="bsd-managed-text">
                  <span className="bsd-managed-line">
                    <span className="bsd-managed-option-name">{o.name}</span>
                    {o.local && <span className="bsd-managed-local">Local</span>}
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
