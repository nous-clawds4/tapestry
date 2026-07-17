import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * contextual-pins ADR 0001 — "Pin to a community" picker.
 *
 * A standard modal (mirrors TagSomeoneModal's tsm-* skeleton: Escape +
 * backdrop-click + × dismiss, focus-on-open, mobile-friendly) that lets the
 * user pick one community CONTEXT to pin the current tag within. The list is
 * client-side-filtered by a typeahead so it scales when there are many
 * contexts. Contexts the tag is already pinned to are shown, disabled, with a
 * ✓ badge.
 *
 * Props:
 *   open               — boolean
 *   onClose            — () => void
 *   contexts           — [{ slug, name }]
 *   pinnedContextSlugs — Set<string> | string[] (already-pinned contexts)
 *   onPick             — (context) => void  (fires on selecting a context)
 *   busy               — boolean (a pin is in flight; disables selection)
 */
export default function PinToContextModal({
  open, onClose, contexts = [], pinnedContextSlugs, onPick, busy = false,
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const pinned = pinnedContextSlugs instanceof Set
    ? pinnedContextSlugs
    : new Set(pinnedContextSlugs || []);

  // Escape closes; focus the filter on open.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [open, onClose]);

  // Reset the filter when closed so a re-open starts clean.
  useEffect(() => { if (!open) setQ(''); }, [open]);

  const trimmed = q.trim();
  const filtered = useMemo(() => {
    const needle = trimmed.toLowerCase();
    if (!needle) return contexts;
    return contexts.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.slug.toLowerCase().includes(needle)
    );
  }, [trimmed, contexts]);

  if (!open) return null;

  return (
    <div
      className="tsm-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="tsm-dialog"
        role="dialog"
        aria-label="Pin to a community"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="tsm-head">
          <h3 className="tsm-title">Pin to a community</h3>
          <button type="button" className="tsm-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="tsm-body">
          <input
            ref={inputRef}
            type="text"
            className="tsm-search-input"
            placeholder="Filter communities…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Filter communities"
          />

          {filtered.length === 0 ? (
            <p className="tsm-status">
              {trimmed ? `No communities match "${trimmed}".` : 'No communities available.'}
            </p>
          ) : (
            <ul className="ptc-list">
              {filtered.map((c) => {
                const already = pinned.has(c.slug);
                return (
                  <li key={c.slug}>
                    <button
                      type="button"
                      className={`ptc-item${already ? ' is-pinned' : ''}`}
                      disabled={busy || already}
                      onClick={() => { if (!busy && !already) onPick(c); }}
                      aria-label={already ? `Already pinned to ${c.name}` : `Pin to ${c.name}`}
                    >
                      <span className="ptc-item-name">{c.name}</span>
                      {already && <span className="ptc-item-badge">✓ pinned</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
