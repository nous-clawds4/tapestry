# ADR 0014: "+ Tag a Note" — Event-ID search modal on the Notes tab

**Status:** Accepted
**Date:** 2026-07-01
**Story:** `engineering-team/stories/event-tagging/16-tag-a-note-modal.md`
**Builds on:** ADR 0013 (shared `TagViewControls` + Notes tab), ADR 0005 (`useEventTagging` write path), the `/event` resolver (`eventParam.js` + `useEventResolve` + `/api/event`), Story 6 (`NoteCard`/`NoteTags`).

## Context

The Profiles tab has "+ Tag someone" → `TagSomeoneModal` (a POV profile search whose rows carry Apply/Dispute). The Notes tab needs the analog: a "+ Tag a Note" button + modal whose search is an **Event-ID search** — paste an identifier, resolve the single kind-1 note in-modal, and Apply/Dispute the **current tag** on it. The single-note resolver already exists (the `/event` page): `classifyEventInput` / `resolveEventParams` (`ui/src/utils/eventParam.js`) → `useEventResolve` → `/api/event`, rendered via `NoteCard`.

## Decision (two operator calls, 2026-07-01)

**1. Identifier scope — nevent + note1 + 64-hex id.**
All three resolve to a kind-1 note id. `note1` (the bare note bech32) is added to the classifier (`decodeOne` case `'note'`, `classifyEventInput` prefix, `ORDER`) since it's the most common paste form. `npub`/`nprofile` (a profile → "Tag someone") and `naddr` (addressable, not a kind-1 note) are **rejected in-modal with a specific message**, not silently. The `/event` page inherits `note1` support for free (additive, precedence after `nevent`).

**2. Apply/Dispute UX — combination (full NoteCard + dedicated current-tag action).**
The resolved note renders via the **full `NoteCard`** (its normal `NoteTags` chip affordance intact) **so the tagger sees what's already on the note**, PLUS a **dedicated, unambiguous Apply/Dispute for the current tag OUTSIDE the card**. The dedicated control is the primary path for "apply *this* tag"; the card's own chips remain for context and secondary actions.

## Implementation

- **`eventParam.js`** — add `note1` (`note` param) to `decodeOne`/`classifyEventInput`/`ORDER`. `note1` → `{ mode: 'id', id }`.
- **`TagANoteModal.jsx`** (new) — mirrors `TagSomeoneModal`'s shell (`.tsm-*`, Escape/backdrop/× close, focus-on-open, reset-on-close). Body: an identifier input → `classifyEventInput` + `resolveEventParams` → `useEventResolve`. `mode:'author'` → "that's a profile" message; `mode:'naddrUnsupported'` → "not a kind-1 note"; unparseable → "not recognized". On `status:'OK'`: the dedicated current-tag Apply/Dispute row (`useEventTagging.applyTag/disputeTag({authorPubkey,slug},{id})`, guarded/local-only) with post-publish stance feedback, then `<NoteCard item={data.item}/>`. Logged-out disables the actions with a connect hint.
- **`TagViewControls.jsx`** — the primary (left) button is generalized: `onPrimaryClick` / `primaryLabel` / `primaryLabelSignedOut` / `primaryAriaLabel(SignedOut)`, all defaulting to the Profiles "Tag someone" copy + `onTagSomeoneClick`. Profiles is unchanged; the Notes tab passes the "+ Tag a Note" variants (replacing Story-15's `hidePrimary`).
- **`TagNotesView.jsx`** — `useAuth`; gate the button through `login()` when logged out; host `TagANoteModal`; pass `useNotesForTag`'s new `refetch` as `onTagged` so a freshly-tagged note appears on publish. Controls now render during load/error (parity with Profiles; keeps the button always present).
- **`useNotesForTag.js`** — expose `refetch()` (a nonce bump in the effect deps).

## Post-verify fixes (operator, 2026-07-01)

Manual test surfaced a confusing case: a modal apply reported success but the tag didn't appear. Root cause was **not** a publish failure — the assertion published fine but was signed by the extension's *active* account (`…987331`), which differed from the signed-in session identity (`…7ab6ca9`); under the session viewer it was neither `mine` nor (being net-0 with an existing dispute) above the curated threshold. Three fixes:

1. **Honest post-tag feedback (modal).** After a successful publish the modal re-keys the resolved `NoteCard` (`refreshNonce`) so its own chips refetch, and reads back the resulting count via `/api/event-tags/for-event` to show "Published … Now applied N · disputed M" (with a note that a net ≤ 0 tag may sit under "View options"). Replaces the over-promising "✓ You applied".
2. **Signer/session guard (cross-cutting).** New `ui/src/utils/signerGuard.js` (`assertSignerMatches(active, expected)` → `SignerMismatchError`). `useEventTagging` now reads the session identity (`useAuth`) and refuses to publish when `window.nostr.getPublicKey()` ≠ `user.pubkey`, with an actionable message. This is the standard NIP-07 "active account drifted from the login" defense (no reliable account-change event exists → guard at sign time). It covers **all** event-tagging writes (the modal + every note/profile chip affordance).
   - **Follow-up (recommended, separate):** extend the same guard to the profile-tag (`publishProfileTagAssertion`) and pin (`publishTagPin`) write paths — same footgun, different hooks/callers. Tracked in the book / OPEN ledger.

## Consequences

- One shared primary-button slot across both tabs; `TagSomeoneModal` and `TagANoteModal` stay separate (profile-search vs event-id-resolve are different interactions), but both reuse the `.tsm-*` shell.
- `note1` is now resolvable everywhere the `/event` resolver is used (including the `/event` page) — intended.
- The modal Apply/Dispute publishes exactly like the in-list chip affordance (`useEventTagging`), so local-only guard + dual-z + stance durability all carry over unchanged.
- naddr/profile identifiers are explicitly out of scope for "tag a note" — a future "tag an addressable event" is a separate concern (the write core already accepts `{ address }`).
