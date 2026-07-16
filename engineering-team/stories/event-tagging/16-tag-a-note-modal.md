# Story 16: "+ Tag a Note" — Event-ID search modal on the Notes tab

**Status:** ✅ DONE (2026-07-01) — operator-verified (manual UI review found + directed the post-verify
fixes below; approved). ADR 0014. Post-verify: honest modal feedback (re-key NoteCard + read-back
count) and a NIP-07 signer/session guard (`signerGuard.js` in `useEventTagging`). Extending the guard
to the profile-tag + pin write paths is tracked in GitHub issue #335.
Operator decisions: (Q1) identifier scope = nevent + note1 + 64-hex id (reject npub/nprofile/naddr
with a message); (Q2) combination UX = full `NoteCard` (existing chips visible) **plus** a dedicated
Apply/Dispute for the current tag outside the card. New `TagANoteModal`; `TagViewControls` primary
button generalized (Profiles unchanged); `useNotesForTag` gains `refetch`; `eventParam` gains `note1`.
· **Created:** 2026-07-01 · **Type:** Feature · **Epic:** event-tagging · **Book:** unified-tagging-ui

## Background
The Profiles tab has a **"+ Tag someone"** button that opens `TagSomeoneModal`
(`ui/src/components/TagSomeoneModal.jsx`) — a POV-aware **profile search** whose result rows carry
**Apply/Dispute** for the current tag (via `TagPageRow`). The Notes tab needs the exact analog for
notes: a **"+ Tag a Note"** button + modal, where the search is an **Event-ID search** that resolves
a single note *inside the modal* and offers Apply/Dispute for this tag.

The single-note resolver already exists (David's Feeds work): the `/event` page
(`ui/src/pages/BrainstormEvent.jsx`) has a paste-an-identifier field that resolves
`nevent`/id/naddr/… via **`useEventResolve` → `/api/event`** and renders the kind-1 with `NoteCard`.
Reuse that resolver in the modal.

## Requirement
On the tag-detail **Notes** tab, add a **"+ Tag a Note"** button (same placement/UX as "+ Tag
someone" on Profiles). It opens a modal (mirror `TagSomeoneModal` UX carefully) that:
1. Takes an **Event-ID / identifier search** (nevent / hex id / naddr — reuse `useEventResolve`).
2. **Resolves and renders the note inside the modal** (via `NoteCard`), with a clear
   not-found/invalid state (mirror `BrainstormEvent`'s prompt/invalid copy).
3. Offers **Apply / Dispute** for the current tag on that note — publishing via the Story-5
   `useEventTagging` (`applyTag`/`disputeTag`) with `target = { id }`, guarded/local-only.
4. On success, reflects the viewer's stance (like `TagSomeoneModal`/`TagPageRow` do) and the note
   appears in the Notes tab list on refetch.

## Acceptance criteria
- [ ] **Button parity.** A "+ Tag a Note" button on the Notes tab, same placement/look/affordance as
  "+ Tag someone" on Profiles.
- [ ] **Event-ID search resolves a note in-modal.** Pasting a valid nevent/id/naddr resolves and
  renders the note inside the modal; invalid/not-found shows a clear message (mirror `/event`).
- [ ] **Apply/Dispute works** — tags the resolved note with the current tag via `useEventTagging`
  (local-only guard honored), and reflects the viewer's stance.
- [ ] **UX matches "+ Tag someone"** — modal open/close (Escape/backdrop/×), layout, and the
  apply/dispute row behavior modeled on `TagSomeoneModal` + `TagPageRow`.
- [ ] **Logged-out** is handled like the profiles flow (prompt to connect; nothing publishes).

## Key files / references
- Reference UX: `ui/src/components/TagSomeoneModal.jsx` (+ `TagPageRow.jsx`).
- Event resolver: `ui/src/pages/BrainstormEvent.jsx`, `ui/src/hooks/useEventResolve.js`, `/api/event`.
- Write: `ui/src/hooks/useEventTagging.js` (Story 5). Host: `ui/src/pages/Tag.jsx` /
  `ui/src/components/TagNotesView.jsx`.

## Open questions
1. Identifier scope — nevent + hex id + naddr (addressable)? At minimum nevent + hex id. *(Design/Arch)*
2. Where the button sits relative to the View-options row (mirror Profiles' "+ Tag someone"). *(Design)*

## Linked artifacts
- Built on Stories 5 (write hook), 8 (Notes tab), ADR 0009. Book: `engineering-team/audits/unified-tagging-ui/book.md`.
