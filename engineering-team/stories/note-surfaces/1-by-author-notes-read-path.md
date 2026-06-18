# Story 1: By-author notes read path — a user's own recent kind-1 notes

**Status:** Approved
**Created:** 2026-06-18
**Type:** Feature

## Background
Both new surfaces in the `note-surfaces` epic — the profile "Content" section (`note-surfaces` #2) and the `/user/:pubkey/notes` page (`note-surfaces` #3) — need the same thing: the **N most-recent kind-1 notes authored by a given pubkey**, newest-first, profile-enriched into the shared note item shape. This story builds **only that read path**, independent of any page.

It is deliberately simpler than the `live-feed` read path (`live-feed` #1). There is **no source-identity resolution, no kind-3 follow list, and no point-of-view**: the selection is "kind-1 authored by *this* pubkey." The author display name + avatar (and any in-text mention names) come from the instance's **existing local profile data** (kind-0), exactly as the feed does — only the *selection* of the raw notes differs.

Affected: anyone viewing a user (logged in or anonymous). The work is **additive and read-only** — no writes/publishes, and no change to the existing feed, search, ranking/scoring, or firmware.

## User-facing description
As a visitor viewing a specific user, I want the system to assemble that user's own most-recent notes (newest-first, bounded by a requested count) with each note's author display info — so the profile surfaces can show "what this user has posted," and so they can distinguish "this user has no notes" from a malformed request.

## Acceptance criteria
Testable from the outside (input → observable behavior).

- [ ] **Selection & content.** Given a valid pubkey that has posted kind-1 notes and a requested count N, when that user's notes are requested, then the result is the kind-1 notes **authored by that pubkey**, ordered **newest-first**, capped at **N**; each item carries the note's **id, author pubkey, timestamp, and text**, plus the author's **display name and avatar from local profile data** (kind-0). Kind-6 (reposts) and kind-7 (reactions) are **excluded**; notes authored by anyone else are excluded. The item shape is **identical to the existing feed item shape**, so the same shared note card can render it unchanged.

- [ ] **Count parameterization & cap.** Given count = 1, exactly the **single** most-recent qualifying note is returned (when one exists). Given count = 50, **up to 50** are returned. Given an **absent, non-numeric, or above-maximum** count, the read path applies a **defined default and a hard maximum** rather than returning an unbounded result.

- [ ] **Empty outcome.** Given a valid pubkey with **no locatable kind-1 notes**, when that user's notes are requested, then the result is an explicit **empty outcome** (an empty set for a valid request) — distinct from the invalid-input outcome below — so a surface can show "no kind-1 events could be located."

- [ ] **Invalid-input outcome.** Given a **malformed pubkey**, when notes are requested, then the result is an explicit **invalid-input outcome** — not a crash, and not silently an empty list.

- [ ] **Mentions resolved like the feed.** Given a returned note whose text references other users via `nostr:` mentions resolvable from local profile data, then those mentions are resolved to display names in the item (the **same enrichment the feed already performs**); unresolved references are left for the surface to fall back on.

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-kind` — kind-1 (the selected notes), kind-0 (author + mention display data).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — the viewed user (note author, by pubkey).
- `39999:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:the-set-of-general-purpose-relays` — general-purpose relays, the likely note source (Architecture confirms relays-vs-local — see Open questions).

## Out of scope
- The two surfaces that consume this — the Content section (`note-surfaces` #2) and the notes page (`note-surfaces` #3). This story produces the assembled data + outcomes, not their presentation.
- Source-identity / follow-list / PoV logic — there is none here; this is one named author's own posts.
- Content kinds other than kind-1; replies/threading; reactions/reposts; pagination beyond the requested count; full history.
- Any write/publish; any change to the existing `/feed` read path, search, ranking, or firmware. The existing `enrichNotes` enrichment is **reused, not modified**.

## Open questions
- **Note source: relays vs local strfry — deferred to Architecture (a *how*, not a *what*).** The product intent is the user's *actual* recent notes as published to the network. The existing feed fetches kind-1 from the instance's general-purpose relays (local strfry on these instances is not a full kind-1 archive), so relays is the expected source — but whether local strfry holds enough kind-1 to serve locally is an **Architecture** determination (the feed precedent plus a quick local-coverage check settle it). If relays are used, the resolved-set-with-fallback behavior should mirror the feed's. This is a sourcing mechanism, not a blocking product question, so it does not gate story approval.

## Linked artifacts
- ADR: (filled in after Architecture)
- Test plan: (filled in after Test Design)
- Review: (filled in after Review)
