import React, { useEffect, useRef, useState } from 'react';
import NoteCard from './NoteCard';
import useEventResolve from '../hooks/useEventResolve';
import { useEventTagging } from '../hooks/useEventTagging';
import { classifyEventInput, resolveEventParams } from '../utils/eventParam';
import { parseFieldDecls, parseItemRef, parseListRef } from '../utils/dlistFields';
import { queryRelay } from '../api/relay';
import DListItemsTable from './dlist/DListItemsTable';
import DListItemTags from './dlist/DListItemTags';

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
 *
 * dlist-item-tagging #3 adds one branch ahead of the note path: an `naddr` of
 * kind 39999 or a `39999:<pubkey>:<d>` coordinate is a DList ITEM — resolved
 * client-side from the local relay (the List.jsx pattern), rendered as a one-row
 * DListItemsTable, and tagged as an `a` target. Anything else falls through to
 * the note path unchanged.
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
  const [itemRef, setItemRef] = useState(null);         // { kind, pubkey, d, address } when the input is a DList item
  const [itemState, setItemState] = useState({ loading: false, item: null, fieldDecls: [], error: null });

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
      setItemRef(null); setItemState({ loading: false, item: null, fieldDecls: [], error: null });
    }
  }, [open]);

  // Item branch: resolve the kind-39999 item, then (best-effort) its header via
  // the item's `z` tag so the row renders by the list's own field declarations;
  // a missing header still renders (values via "other fields") and still tags.
  useEffect(() => {
    if (!itemRef) return undefined;
    let cancelled = false;
    setItemState({ loading: true, item: null, fieldDecls: [], error: null });
    (async () => {
      try {
        const found = await queryRelay({ kinds: [39999], authors: [itemRef.pubkey], '#d': [itemRef.d] });
        if (cancelled) return;
        const item = found[0] || null;
        if (!item) { setItemState({ loading: false, item: null, fieldDecls: [], error: 'not-found' }); return; }
        let fieldDecls = [];
        const zTag = (item.tags || []).find((t) => t[0] === 'z');
        const headerRef = zTag ? parseListRef(zTag[1]) : null;
        if (headerRef) {
          try {
            const headers = headerRef.id
              ? await queryRelay({ ids: [headerRef.id] })
              : await queryRelay({ kinds: [headerRef.kind], authors: [headerRef.pubkey], '#d': [headerRef.d] });
            if (headers[0]) fieldDecls = parseFieldDecls(headers[0]);
          } catch { /* best-effort — the target needs only the item */ }
        }
        if (!cancelled) setItemState({ loading: false, item, fieldDecls, error: null });
      } catch (err) {
        if (!cancelled) setItemState({ loading: false, item: null, fieldDecls: [], error: err?.message || String(err) });
      }
    })();
    return () => { cancelled = true; };
  }, [itemRef]);

  const { data, loading, error } = useEventResolve(resolveArg);

  const submit = (e) => {
    e.preventDefault();
    setStance(null); setActionError(null); setResultCount(null);
    // A DList item (naddr of kind 39999 / 39999:pubkey:d) is recognised first;
    // everything else is the note path exactly as before.
    const ir = parseItemRef(input);
    if (ir) { setReason(null); setResolveArg({}); setItemRef(ir); return; }
    setItemRef(null);
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
    const hasItem = !!(itemRef && itemState.item);
    if ((!resolveArg.id && !hasItem) || !tag || publishing) return;
    const which = polarity > 0 ? 'applied' : 'disputed';
    setPublishing(which); setActionError(null);
    try {
      const fn = polarity > 0 ? applyTag : disputeTag;
      // Forward the pasted nevent's relay hints so the tagging's e-tag carries a
      // NIP-01 hint — read paths (for-tag) can then fetch this external note
      // on-demand from where it lives, without persisting it locally.
      const result = await fn(
        { authorPubkey: tag.authorPubkey, slug: tag.slug },
        hasItem ? { address: itemRef.address } : { id: resolveArg.id, relays: resolveArg.relays },
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
          const params = new URLSearchParams(hasItem ? { address: itemRef.address } : { eventId: resolveArg.id });
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
  const itemOk = !!itemRef && !itemState.loading && !!itemState.item;
  const subject = itemRef ? 'list item' : 'note';

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
              placeholder="nevent1… · note1… · 64-hex id · naddr1… / 39999:…:d (list item)"
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

          {itemRef && itemState.loading && (
            <p className="tsm-status">Resolving list item…</p>
          )}
          {itemRef && !itemState.loading && !itemState.item && (
            <p className="tsm-status tsm-error" role="alert">
              ⚠️ Couldn’t load that list item{itemState.error && itemState.error !== 'not-found' ? ` (${itemState.error})` : ''}. Check the coordinate and try again.
            </p>
          )}

          {(resolvedOk || itemOk) && (
            <>
              {/* Dedicated, unambiguous action for THE CURRENT TAG — outside the
                  NoteCard, so it's distinct from the note's own chip affordance. */}
              <div className="tan-apply-row">
                <span className="tan-apply-label">
                  {stance ? (
                    <>
                      Published “{tag?.name || tag?.slug}”.
                      {resultCount
                        ? ` Now applied ${resultCount.app} · disputed ${resultCount.dis} on this ${subject}`
                        : ''}
                      {resultCount && (resultCount.app - resultCount.dis) <= 0
                        ? ' — its net score isn’t positive, so it may sit under “View options” in the list.'
                        : resultCount ? '.' : ''}
                    </>
                  ) : (
                    `Apply “${tag?.name || tag?.slug}” to this ${subject}:`
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
              {itemOk ? (
                <div className="tan-note" key={`${itemRef.address}:${refreshNonce}`}>
                  <DListItemsTable
                    items={[itemState.item]}
                    fieldDecls={itemState.fieldDecls}
                    renderExtra={(it) => <DListItemTags item={it} />}
                  />
                </div>
              ) : (
                <div className="tan-note">
                  <NoteCard key={`${resolveArg.id}:${refreshNonce}`} item={data.item} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
