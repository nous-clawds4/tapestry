# PRD Seed: Event Page

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/event-page/audit.md`
**Anchor:** acceptance frame in `book.md` (operator's confirmed kickoff frame)
**Confidence:** medium — the *as-built* and *scope* are high-confidence (frame-grounded, verified on staging); the *problem/vision* and *personas* are inferred and need product validation.
**Date:** 2026-06-19

> Reverse-engineered baseline in PRD shape, built from what shipped. A **strawman for the product team**, not a ratified spec. Sections tagged `[FROM FRAME]` / `[INFERRED]` / `[UNKNOWN — product input needed]`. Adopt as the `/discover` starting point for the next phase and validate each section.

## 1. Product vision
`[FROM FRAME]` Turn the placeholder `/event` page into a working **single-event view** for **kind-1 notes**: open a note by one of six nostr identifiers (or paste one into a search field) and see it rendered like the `/feed` page — or a precise message about why it can't be shown.
`[INFERRED]` The opportunity: an instance already renders kind-1 notes in the feed (`live-feed`) and on author pages (`note-surfaces`) via the shared `NoteCard` + `enrichNotes` seam; `/event` is the natural **per-event surface** that note `nostr:` links (`nevent`/`id`/`naddr`) can point at, completing the "click a note, see the note" loop and giving every note a bookmarkable home.
`[UNKNOWN — product input needed]` Who the event view is *primarily for* (people following `nostr:` links from elsewhere? people pasting identifiers they found off-instance? a step toward an event-centric feature like tagging/threading?) and what success looks like beyond "it renders the right thing."

## 2. Personas
`[INFERRED — flag as guesses]`
- **Link follower** — clicks a `nostr:nevent…` / `?id=` / `?naddr=` link (from a note, a chat, elsewhere) and lands on `/event` expecting to see that exact event.
- **Identifier paster** — has a raw `nevent`/`npub`/etc. from somewhere off-instance and pastes it into the search field to look it up.
- **Author-lookup visitor** — opens `/event?npub=…` (or pastes an `npub`/`nprofile`) to see an author's most-recent note.
- `[UNKNOWN]` Whether any of these is the *primary* audience, and whether the view is meant as a destination or mostly a transient resolver for links.

## 3. Scope (as-built)
`[FROM FRAME]` In scope and shipped:
- Public, bookmarkable `/event`, no login (anonymous 200), additive & read-only, no 1280px overflow.
- Six URL params with precedence **`nevent` › `id` › `naddr` › `pubkey` › `npub` › `nprofile`**; first-valid wins; malformed supported param → flagged invalid; unknown names ignored.
- `nevent`/`id` → fetch + verify + kind-gate the event: kind-1 → render like the feed; other kind → "kind ‹N› not yet supported"; bad signature → "does not validate"; absent → "not found".
- `naddr` → "kind ‹N› not yet supported" from the coordinate, **no fetch** (addressable, never kind-1).
- `pubkey`/`npub`/`nprofile` → author's most-recent kind-1, or "no kind-1 note found".
- **Relay union** per fetch: embedded hints + author NIP-65 (kind-10002) outbox write relays + well-known general-purpose set (slug-from-TA, else fixed fallback).
- **Search field** when no valid param: paste one of the six → resolves as the equivalent URL param; none-of-six → "not a recognized format".

`[FROM FRAME]` Explicitly **out of scope** (deferred): rendering any non-kind-1 event (long-form/kind 30023, reposts, reactions — reported as "not yet supported"); threads/replies/reactions on the shown event; "load more"/navigation between events; NIP-05 / free-text / autocomplete in the search; any write/publish or change to the feed, profiles, search, ranking, or firmware.

## 4. Domain model
`[INFERRED]` from the six params, the read-path contract, and concepts touched (by handle):
- **Event reference** — `nevent` (id + optional author + relay hints) or a bare `id` (64-hex); resolves a specific event.
- **Author reference** — `pubkey` / `npub` / `nprofile` (the latter carrying relay hints); resolves that author's latest kind-1.
- **Addressable reference** — `naddr`, carrying a `kind` in its coordinate → reported as unsupported (never kind-1), never fetched.
- **Note** — kind-1, fetched from the relay union, `verifyEvent`-gated, enriched into the shared feed item shape (id, author pubkey, timestamp, text, author `{display name, avatar}`, resolved `nostr:` mentions).
- **Outbox** — the author's NIP-65 (kind-10002) write-eligible relays, bootstrapped from hints + well-known.
- **Well-known relay set** — `39999:<TA>:the-set-of-general-purpose-relays` (slug-from-TA), else the fixed fallback.
- **Resolution outcome** — a discriminated state: `OK` / `UNSUPPORTED_KIND` (+kind) / `INVALID_EVENT` / `NOT_FOUND` / `NO_AUTHOR_NOTE` / `INVALID`, plus a `relaySource` (`set`/`fallback`) marker.

## 5. Design rules (as-built)
`[INFERRED]` from the shipped UI + ADR 0002 + review notes:
- Standard public-page shell (top bar with logo + user menu, single capped-width centered column); no horizontal overflow at 1280px (capped `bsp-content` + wrapping note text).
- Heading "Event"; one resolved note rendered via the shared `NoteCard` (identical to `/feed`); every non-OK outcome renders a single clear `bsp-empty` message, never a blank page or raw error; a defensive "couldn't load" branch covers transport failure / unknown status.
- An invalid-params notice ("Ignoring invalid parameter(s): …") appears when a supported param was malformed; unknown param names produce nothing.
- The search field (shown only with no valid param) is a labelled input + Enter that navigates to the canonical `/event?<type>=<value>` on a match (so the result is shareable and the param path renders it), and shows a "not recognized" notice otherwise.
- `[INFERRED]` Hex ambiguity: a bare 64-hex pasted into the search field is treated as an event **id** (precedence `id` before `pubkey`); to look up an author by raw key, paste an `npub`/`nprofile` or use `?pubkey=`. Documented, deterministic.
- `[UNKNOWN]` No visual/brand guide was authored beyond reuse of the existing `bsp-*` / `bsp-note-card-*` tokens + minimal `bsp-event-*`; product/design may want to specify the search-field affordance, media-in-note handling (inherited from `NoteCard`), and the "not yet supported"/empty-state visuals.

## 6. Carry-forward & open questions
Promoted from `audit.md` §6:
- [ ] **Relay-sourcing consolidation** — re-point `feedReadPath.js` / `userNotesReadPath.js` to `_shared/relaySource.js` (behavior-preserving; do **not** unify the verifying vs. no-verify `querySync` variants).
- [ ] **Rendering non-kind-1 events** — long-form (kind 30023, the `naddr` case), reposts, reactions; currently "not yet supported".
- [ ] **Threads / replies / reactions / navigation** on the shown event — a future event-centric extension of this read path.
- [ ] Whether to **surface the `set`/`fallback` relay-source** on the page (endpoint returns it; page ignores it today).

## 7. What product must validate
- [ ] **The problem & audience** (§1/§2) — who the event view is primarily for, and what underlying need it serves beyond resolving `nostr:` links.
- [ ] **Success metrics** — none were defined; the frame is purely behavioral. What outcome makes `/event` "working" (link-follow resolution rate? a step toward event-centric features?).
- [ ] **Kind coverage** — the frame fixes kind-1 only; is rendering long-form/reposts/reactions a roadmap goal, or is kind-1 the intended product?
- [ ] **Event richness** — should the view show replies/threads/reactions/an author header, or stay a single isolated note?
- [ ] **Search depth** — the frame limited the search to the six exact formats; is NIP-05 / free-text / autocomplete a future goal or a permanent boundary?
- [ ] **Author-lookup semantics** — "most-recent kind-1" is the as-built; is "the author's profile / a list of their notes" (overlaps `note-surfaces`) the eventual intent for author identifiers?
