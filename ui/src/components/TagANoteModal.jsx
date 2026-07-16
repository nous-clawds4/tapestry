import React, { useEffect, useRef, useState } from 'react';
import NoteCard from './NoteCard';
import useEventResolve from '../hooks/useEventResolve';
import { useEventTagging } from '../hooks/useEventTagging';
import { classifyEventInput, resolveEventParams } from '../utils/eventParam';

/**
 * Story 16 (book: unified-tagging-ui) — the Notes-tab analog of TagSomeoneModal.
 * A "+ Tag a Note" modal whose search is an EVENT-ID search: paste an nevent /
 * note1 / 64-hex id, resolve the single kind-1 note in-modal (reusing the /event
 * resolver — classifyEventInput + resolveEventParams → useEventResolve → /api/event),
 * render it via the shared NoteCard (full affordance — so the tagger sees what's
 * already on the note), and offer a dedicated Apply/Dispute for THE CURRENT TAG
 * (outside the card) via the Story-5 useEventTagging (guarded/local-only).
 *
 * Identifier scope (operator, Story 16): nevent + note1 + 64-hex id → a kind-1 note.
 * npub/nprofile (a profile → use "Tag someone") and naddr (addressable, not kind-1)
 * are rejected with a specific message. Mirrors TagSomeoneModal's shell/UX.
 */
export default function TagANoteModal({ open, onClose, tag, viewerPubkey, onTagged }) {
  const { applyTag, disputeTag } = useEventTagging();

  const [input, setInput] = useState('');
  const [reason, setReason] = useState(null);          // 'invalid' | 'profile' | 'naddr' | null
  const [resolveArg, setResolveArg] = useState({});    // { id, author?, relays? } | {}
  const [stance, setStance] = useState(null);          // 'applied' | 'disputed' | null
  const [publishing, setPublishing] = useState(null);  // 'applied' | 'disputed' | null
  const [actionError, setActionError] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0); // #1 — re-key NoteCard to refetch its chips post-tag
  const [resultCount, setResultCount] = useState(null); // #2 — { app, dis } for THIS tag on the note, post-tag

  const inputRef = useRef(null);

  // Escape closes; focus the input on open.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(focusTimer); };
  }, [open, onClose]);

  // Reset transient state when closed so a re-open starts clean.
  useEffect(() => {
    if (!open) {
      setInput(''); setReason(null); setResolveArg({});
      setStance(null); setPublishing(null); setActionError(null);
      setRefreshNonce(0); setResultCount(null);
    }
  }, [open]);

  const { data, loading, error } = useEventResolve(resolveArg);

  const submit = (e) => {
    e.preventDefault();
    setStance(null); setActionError(null); setResultCount(null);
    const c = classifyEventInput(input);
    if (!c) { setReason('invalid'); setResolveArg({}); return; }
    const { target } = resolveEventParams(new URLSearchParams({ [c.paramName]: c.value }));
    if (!target) { setReason('invalid'); setResolveArg({}); return; }
    if (target.mode === 'author') { setReason('profile'); setResolveArg({}); return; }
    if (target.mode === 'naddrUnsupported') { setReason('naddr'); setResolveArg({}); return; }
    // mode 'id' — a resolvable kind-1 note.
    setReason(null);
    setResolveArg({ id: target.id, author: target.author || undefined, relays: target.relays || undefined });
  };

  const runTag = async (polarity) => {
    if (!resolveArg.id || !tag || publishing) return;
    const which = polarity > 0 ? 'applied' : 'disputed';
    setPublishing(which); setActionError(null);
    try {
      const fn = polarity > 0 ? applyTag : disputeTag;
      // Forward the pasted nevent's relay hints so the tagging's e-tag carries a
      // NIP-01 hint — read paths (for-tag) can then fetch this external note
      // on-demand from where it lives, without persisting it locally.
      const result = await fn(
        { authorPubkey: tag.authorPubkey, slug: tag.slug },
        { id: resolveArg.id, relays: resolveArg.relays },
      );
      if (result && result.failedAt) {
        setActionError(`Tagging didn't fully complete (stopped at kind ${result.failedAt.kind}). Replaceable — safe to retry.`);
      } else {
        setStance(which);
        setRefreshNonce((n) => n + 1);   // #1 — remount NoteCard so its chips refetch
        if (onTagged) onTagged();
        // #2 — read back the resulting count for THIS tag on the note (viewer's
        // POV), so the confirmation reflects reality instead of over-promising.
        try {
          const params = new URLSearchParams({ eventId: resolveArg.id });
          if (viewerPubkey) params.set('viewerPubkey', viewerPubkey);
          const r = await fetch(`/api/event-tags/for-event?${params}`);
          const j = await r.json().catch(() => ({}));
          const entry = (j.tags || []).find((t) => t.tag?.slug === tag.slug && t.tag?.authorPubkey === tag.authorPubkey);
          if (entry) setResultCount({ app: (entry.applications || []).length, dis: (entry.disputes || []).length });
        } catch { /* best-effort — the publish already succeeded */ }
      }
    } catch (err) {
      setActionError(err?.message || String(err));
    } finally {
      setPublishing(null);
    }
  };

  if (!open) return null;

  const REASON_COPY = {
    invalid: 'That isn’t a recognized note. Paste an nevent, note1, or 64-char hex id.',
    profile: 'That’s a profile, not a note — use “+ Tag someone” on the Profiles tab.',
    naddr: 'That’s an addressable event (naddr), not a kind-1 note.',
  };
  const status = data && data.status;
  const resolvedOk = !!resolveArg.id && !reason && !error && status === 'OK';

  return (
    <div
      className="tsm-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="tsm-dialog"
        role="dialog"
        aria-label="Tag a note"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="tsm-head">
          <h3 className="tsm-title">
            Tag a note{tag?.name ? ` with "${tag.name}"` : ''}
          </h3>
          <button type="button" className="tsm-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="tsm-body">
          <form className="tan-search-form" onSubmit={submit}>
            <input
              ref={inputRef}
              type="text"
              className="tsm-search-input"
              placeholder="nevent1… · note1… · 64-hex id"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Paste a note identifier to tag"
            />
            <button type="submit" className="tan-resolve-btn">Find</button>
          </form>

          {reason && <p className="tsm-status tsm-error" role="alert">⚠️ {REASON_COPY[reason]}</p>}

          {!reason && resolveArg.id && loading && (
            <p className="tsm-status">Resolving note…</p>
          )}
          {!reason && resolveArg.id && !loading && (error || status !== 'OK') && (
            <p className="tsm-status tsm-error" role="alert">
              ⚠️ Couldn’t load that note{status && status !== 'OK' ? ` (${status})` : ''}. Check the identifier and try again.
            </p>
          )}

          {resolvedOk && (
            <>
              {/* Dedicated, unambiguous action for THE CURRENT TAG — outside the
                  NoteCard, so it's distinct from the note's own chip affordance. */}
              <div className="tan-apply-row">
                <span className="tan-apply-label">
                  {stance ? (
                    <>
                      Published “{tag?.name || tag?.slug}”.
                      {resultCount
                        ? ` Now applied ${resultCount.app} · disputed ${resultCount.dis} on this note`
                        : ''}
                      {resultCount && (resultCount.app - resultCount.dis) <= 0
                        ? ' — its net score isn’t positive, so it may sit under “View options” in the list.'
                        : resultCount ? '.' : ''}
                    </>
                  ) : (
                    `Apply “${tag?.name || tag?.slug}” to this note:`
                  )}
                </span>
                {!stance && (
                  <span className="tan-apply-actions">
                    <button
                      type="button"
                      className="tan-apply"
                      disabled={!viewerPubkey || publishing !== null}
                      onClick={() => runTag(1)}
                    >
                      {publishing === 'applied' ? '…' : '+ Apply'}
                    </button>
                    <button
                      type="button"
                      className="tan-dispute"
                      disabled={!viewerPubkey || publishing !== null}
                      onClick={() => runTag(-1)}
                    >
                      {publishing === 'disputed' ? '…' : '− Dispute'}
                    </button>
                  </span>
                )}
              </div>
              {!viewerPubkey && (
                <p className="tsm-status">Connect via NIP-07 to apply or dispute.</p>
              )}
              {actionError && <p className="tsm-status tsm-error" role="alert">⚠️ {actionError}</p>}

              {/* The full note, with its existing tag chips — so the tagger sees
                  what's already on it before adding this tag. */}
              <div className="tan-note">
                <NoteCard key={`${resolveArg.id}:${refreshNonce}`} item={data.item} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
