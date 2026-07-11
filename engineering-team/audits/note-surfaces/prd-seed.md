# PRD Seed: Note Surfaces

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/note-surfaces/audit.md`
**Anchor:** acceptance frame in `book.md` (operator's confirmed kickoff scope)
**Confidence:** medium — the *as-built* and *scope* are high-confidence (frame-grounded, verified on staging); the *problem/vision* and *personas* are inferred and need product validation.
**Date:** 2026-06-19

> Reverse-engineered baseline in PRD shape, built from what shipped. A **strawman for the product team**, not a ratified spec. Sections tagged `[FROM FRAME]` / `[INFERRED]` / `[UNKNOWN — product input needed]`. Adopt as the `/discover` starting point for the next phase and validate each section.

## 1. Product vision
`[FROM FRAME]` Let anyone viewing a specific user see **what that user has actually posted** — their own recent kind-1 notes — in two places: a "Content" preview at the bottom of the profile (the single latest note) and a full `/user/:pubkey/notes` page (the 50 most-recent). It complements the `live-feed` epic: the feed shows notes from the accounts a *source identity follows*; these surfaces show **one named user's own** posts, with **no follow list and no point-of-view** in play.
`[FROM FRAME]` It is built **atop the shared note seam** the live feed introduced — the same `NoteCard` and `enrichNotes` — so per-note presentation lands once and is reused.
`[INFERRED]` The opportunity: a web-of-trust search instance already shows a user's identity, reputation, and follow graph; surfacing their actual posts makes the profile a fuller picture of the person and gives a natural place to later act on (e.g. tag) real notes.
`[UNKNOWN — product input needed]` Who these surfaces are *primarily* for and what success looks like beyond "the notes render" — is this for evaluating a user's trustworthiness, reading their content, or feeding a later tagging/curation workflow?

## 2. Personas
`[INFERRED — flag as guesses]`
- **Profile visitor / evaluator** — lands on `/user/:pubkey` to assess a user; the Content section gives a one-glance sense of "what they post," with a link to read more.
- **Reader** — opens `/user/:pubkey/notes` to read a specific user's recent posts directly.
- `[UNKNOWN]` **Tagger / curator** — would act on these notes in a later tagging book (as with the feed); their needs are not yet modeled here.

## 3. Scope (as-built)
`[FROM FRAME]` In scope and shipped:
- A **"Content" section** at the bottom of `/user/:pubkey` — the viewed user's single most-recent kind-1 note as a card, an explicit empty state, and an always-present link to the notes page.
- A public **`/user/:pubkey/notes` page** — that user's 50 most-recent kind-1 notes, newest-first, naming whose notes they are, with the same empty state and no 1280px overflow.
- **kind-1 only**; reposts (kind-6) and reactions (kind-7) excluded; only the viewed user's own posts (no follow list, no PoV).
- One **shared by-author read path** (`GET /api/user/:pubkey/notes?limit=`) feeding both surfaces via a shared hook; the **shared `NoteCard` + `enrichNotes`** reused, not forked.
- Additive & read-only (no writes; the existing `/feed`, search, ranking, and the profile's other sections unaffected); **no firmware change**.

`[FROM FRAME]` Explicitly **out of scope** (deferred): content kinds other than kind-1 (the "Content" label is future-proofed but kind-1-only now); pagination beyond the per-surface cap (1 / 50), infinite scroll, full history; replies/threading, reactions/repost display; **tagging notes**; any PoV/source selector; any write/publish or change to search/feed/ranking/firmware.

## 4. Domain model
`[INFERRED]` from concepts touched (by handle) and the shipped contract:
- **Viewed user** — a `nostr-user` (the pubkey in the URL); both the profile subject and the note author. No source identity is resolved.
- **Note** — kind-1 authored **by that pubkey**, fetched from the **general-purpose relay set** (`39999:<TA>:the-set-of-general-purpose-relays`, slug-from-TA, hardcoded fallback); rendered fields: id, author pubkey, timestamp, text.
- **Author / mention profile** — kind-0 (local), supplying display name + avatar and resolving `nostr:` mentions, via the shared `enrichNotes`.
- **Notes outcome** — a discriminated state: `OK` / `EMPTY` / `INVALID` (simpler than the feed's four — no `NO_SOURCE`/`FOLLOW_LIST_UNAVAILABLE`, since there is no source/follow-list step), plus a `relaySource` (`set`/`fallback`) marker on `OK`/`EMPTY`.

## 5. Design rules (as-built)
`[INFERRED]` from the shipped UI + review notes:
- **Content section:** a `bsp-section` appended as the **last** section of the profile, heading "Content", body = loading / one `NoteCard` (the single latest, never a list) / empty message, plus an always-present "View all notes →" link to `/user/:pubkey/notes`. Rendered as a `<div className="bsp-section">` to match the existing profile-section convention.
- **Notes page:** modeled on the `/user/:pubkey/follows` shell — top bar, "← Back to profile", "Notes" heading, a subtitle naming whose notes (from a `/api/profiles?pubkeys=` lookup, with a short-npub fallback so it names the user even when empty), a "Showing the most recent 50 notes." indicator, then one `NoteCard` per note in array order (never re-sorted — newest-first is owned by the read path).
- **Empty / defensive:** both surfaces collapse EMPTY, transport failure, and `INVALID` to the same operator-delegated message — "No kind-1 events could be located for this user." (punctuation non-binding) — never a blank page or raw error. A future "couldn't load — retry" distinction is a deferred enhancement.
- **Width:** the notes column is width-bounded and note text wraps (`overflow-wrap`) so the page never exceeds 1280px.
- `[INFERRED]` Untrusted relay content is rendered through the shared `NoteCard`/`NoteContent` (React-escaped text + resolved mentions), inheriting the feed's safety posture.
- `[UNKNOWN]` No visual/brand guide was authored beyond reuse of the existing `bsp-*` tokens and `NoteCard` — product/design may want to specify a compact card for the profile preview (a `NoteCard` variant was deliberately deferred), media handling (images/embeds currently inherit the feed's treatment), and empty-state visuals.

## 6. Carry-forward & open questions
Promoted from `audit.md` §6:
- [ ] **Source-relay consolidation** — re-point the feed + user-notes read paths to the shared `_shared/relaySource.js` (engineering cleanup; tracked in `follow-ups.md`).
- [ ] **`NoteCard` compact variant** — if the profile preview should use a stripped card, add the variant prop to `NoteCard` (deferred; would land once for all consumers).
- [ ] **`useFeed`/`useUserNotes` generalization** — collapse the near-duplicate hooks if a third notes consumer appears.
- [ ] **Graceful handler 500 → empty** — optionally degrade the read path's thrown-dep 500 to the empty outcome (mirrors the feed's accepted edge).
- [ ] **Tagging notes** — the later cross-cutting capability (depends on the `nostr-event-tag` wire spec); applies to these surfaces as it does to the feed.

## 7. What product must validate
- [ ] **The problem & audience** (§1/§2) — who are these surfaces primarily for (profile evaluation? reading? feeding tagging?), and what is the underlying user need?
- [ ] **Success metrics** — none were defined; the frame is purely behavioral. What outcome makes these surfaces "working" (do visitors read notes? does it improve trust evaluation? is it a step toward tagging)?
- [ ] **Content scope** — kind-1 only today; should the "Content" section / notes page later include long-form (kind-30023), reposts, or other kinds — and in what order?
- [ ] **Preview shape** — is "single latest full card" the right profile preview, or should it be a compact card, a few notes, or a richer summary?
- [ ] **Depth & richness** — pagination / infinite scroll beyond 50, replies/threads, media/embeds — deliberately plain v1, or a future goal?
- [ ] **Notes vs feed relationship** — should "a user's own notes" and "the follows feed" eventually converge into one notes experience, or stay distinct surfaces?
