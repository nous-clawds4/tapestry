# Story 1: Event read path — resolve a kind-1 by event reference or by author, across the relay union

**Status:** Approved
**Created:** 2026-06-18
**Type:** Feature

## Background
The `/event` page (`event-page` #2/#3) needs a way to take a resolved target — **an event id** (from `nevent`/`id`, optionally carrying relay hints) **or an author pubkey** (from `pubkey`/`npub`/`nprofile`, optionally with hints) — and produce either a displayable kind-1 note or a precise reason it can't. This story builds **only that read path**, independent of the page.

It extends the by-author idea from `note-surfaces` #1 with a **richer relay union** and an **event-id** mode, plus **verification** and **kind-gating**. Author display name + avatar (and in-text mention names) come from the instance's **local profile data**, exactly as the feed does — only the *selection* of the raw event differs.

`naddr` is **not** handled here: an `naddr` carries its kind in the coordinate (always addressable, never kind-1), so the page reports "kind ‹N› not yet supported" without any fetch. This read path covers **by-id** and **by-author** only.

Affected: anyone opening `/event`. Additive, read-only.

## User-facing description
As a visitor opening `/event`, I want the system to locate the referenced event — or the referenced author's most-recent note — across the relays where it's likely to live, verify it, and hand back either a displayable kind-1 or a precise, distinct reason (wrong kind / fails verification / not found / author has no note).

## Acceptance criteria
Testable from the outside (input → observable outcome).

- [ ] **By event reference.** Given an **event id** (with any supplied relay hints), when the event is requested, the result is exactly one of: **found** (a kind-1 that verifies, as a displayable item); **unsupported-kind** (the located event verifies but is **not** kind-1 — the outcome carries the kind number); **does-not-validate** (an event with that id is located but fails signature/id verification); **not-found** (no event with that id in the relay union). The four are mutually distinct.

- [ ] **By author (latest note).** Given an **author pubkey** (with any supplied hints), when requested, the result is **found** with that author's **single most-recent kind-1** (newest-first, verified) when one exists in the relay union, else a distinct **no-author-note** outcome.

- [ ] **Relay union.** Every fetch consults the **union** of: (a) the **relay hints** supplied with the reference; (b) the author's **outbox** — their published NIP-65 (kind-10002) write relays — when those can be resolved; and (c) the instance's **well-known** relays — the general-purpose relay set resolved by slug relative to this instance's own Tapestry Assistant (never a hardcoded identifier) when locatable and non-empty, else the fixed fallback `relay.primal.net`, `nos.lol`, `relay.damus.io`. The well-known **set-vs-fallback** distinction is observable in the outcome (mirroring the feed).

- [ ] **Verification.** A returned event is always signature/id-verified; an event that fails verification is **never** returned as a found kind-1 (for a by-id request it is the distinct does-not-validate outcome).

- [ ] **Enriched, feed-shaped item.** A returned kind-1 carries the **same displayable item shape the feed serves** — id, author pubkey, timestamp, text, author `{ display name, avatar }`, and resolved `nostr:` mentions — with author/mention names drawn from the instance's **local profile data** (not the external relays the event came from), so the existing shared note card can render it unchanged.

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-kind` — kind-1 (target), kind-0 (author/mention display), kind-10002 (author outbox).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — the event author / looked-up author.
- `39999:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:the-set-of-general-purpose-relays` — the well-known set (else fallback).

## Out of scope
- The `/event` page itself — parameter parsing, the search field, the rendered states (`event-page` #2/#3).
- `naddr` / addressable-event resolution (handled at the page from the coordinate's kind; no fetch).
- Rendering / supporting any non-kind-1 kind (this path *classifies* the kind; it does not render).
- Multiple results, threads/replies, pagination; any write/publish; changes to the feed read path, search, ranking, or firmware. The shared `enrichNotes` is reused, not modified.

## Open questions
- **Source-of-fetch mechanism (relays vs anything local) and the outbox-resolution bootstrap are an Architecture concern**, not product intent. Product intent: look in the union above; return the distinct outcomes. (Local strfry is not a kind-1 archive — established in `note-surfaces` #1 — so events come from relays; enrichment stays local.) Not blocking story approval.

## Linked artifacts
- ADR: `engineering-team/decisions/event-page/0001-event-read-path.md`
- Test plan: `engineering-team/stories/event-page/1-event-read-path.test-plan.md`
- Review: `engineering-team/reviews/event-page/1-event-page-implementation.md` (CHANGES_REQUESTED — 2026-06-18)
