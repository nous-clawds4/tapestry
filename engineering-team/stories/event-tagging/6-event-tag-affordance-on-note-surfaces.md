# Story 6: Event-tag affordance on note surfaces

**Status:** Approved — **UNBLOCKED** (Story 7 shipped; resuming at Test Design)
**Created:** 2026-06-30
**Type:** Feature
**Epic:** event-tagging

> **Story 7 dependency RESOLVED (2026-06-30).** The POV-first gap (a logged-in viewer the house POV doesn't trust would see their own just-applied tag **vanish on reload**) is fixed: Story 7 added the durable, trust-unfiltered **`mine`** channel to `for-event` (impl `db752c9c`, review PASS `ce413761`). `GET /api/event-tags/for-event?eventId=…&viewerPubkey=<hex>` now returns `mine: [{ tag:{authorPubkey,slug}, stance:'apply'|'dispute', eventId, createdAt }]` alongside the POV-counted `tags`. This story consumes it.

## Background

Stories 1–5 built the whole machine behind event-tagging but nothing a person can see or click: the protocol core (1), the publish guard (2), the seeded concepts (3), the read API that returns a note's tags POV-filtered (4), and the client publish hook that creates taggings in the right order (5). This story is the **face** of the epic — it puts the tagging affordance onto the surfaces where people actually read kind-1 notes, turning the plumbing into a feature. It is the event analog of the existing profile (pubkey) tagging UI; that surface is the interaction precedent to mirror.

Because every note in the app is rendered through one shared note unit, the affordance can be added once and appear everywhere a note appears: the feed/search results, the single-note (event) page, a user's notes list, and the most-recent-note shown on a profile.

> **⚠️ Build-time invariant — LOCAL DEV RELAY ONLY (non-negotiable).** Per the epic, every publish this affordance triggers — in automated tests and in operator manual testing — must reach **only** the local dev strfry relay, never an external/production relay, until the operator explicitly lifts it for a named step. Manual testing stays on the local dev stack. Any path that can reach the external fan-out is a defect.

## User-facing description

As a logged-in viewer reading a note anywhere in the app, I want to see what tags trusted people have put on it and to weigh in myself — apply or dispute a tag that's already there, add a tag that exists elsewhere but isn't on this note yet, or coin a brand-new tag — so that notes carry the same community-curated, point-of-view-aware labels that profiles already do, without me needing to understand the underlying event graph.

A logged-out viewer (or one without a signer) can still **see** a note's tags, but the actions that would publish are unavailable and nothing is published.

## Acceptance criteria

Testable from the outside (what the viewer sees / what gets published, given a starting state and an action).

- [ ] **Tags are shown on a note.** Given a kind-1 note that has counted event-taggings, when it renders on any note surface, then the viewer sees that note's applied tags, each with the apply/dispute weight computed **from the viewer's point of view** (trusted asserters only) — sourced from the read API, not a global tally.
- [ ] **Apply / dispute an existing tag.** Given a tag already shown on the note, when the logged-in viewer applies (or disputes) it, then exactly the publishes needed for that starting state happen (local-only), and the displayed state reflects the viewer's new stance. Re-clicking or flipping apply↔dispute updates the viewer's stance rather than stacking duplicates.
- [ ] **Add an existing tag not yet on this note.** Given a tag that exists elsewhere but is not on this note, when the viewer searches for it and applies it, then the tagging is created and the tag now appears on the note. (The viewer never has to know whether an intermediate tagging-header had to be created first.)
- [ ] **Create a brand-new tag.** Given a tag name that does not exist at all, when the viewer creates it and applies it to the note, then the tag is created and applied, and it appears on the note.
- [ ] **Affordance is present on every note surface.** The same tagging affordance is available wherever a kind-1 note is rendered — the feed/search results, the single-note (event) page, a user's notes list, and the profile's note section — with consistent behavior across all of them.
- [ ] **Logged-out / no-signer is read-only.** Given a viewer with no signer available, when a note renders, then its tags are still visible but the apply/dispute/add/create actions are unavailable (or prompt to connect), and no event is published.
- [ ] **Partial-failure is surfaced, not silently wrong.** Given a multi-step tagging that partially fails (e.g. the header published but the assertion did not), when the failure occurs, then the viewer is told it didn't fully complete and can retry, and a retry does not create duplicates. The only states a viewer can be left in are reusable/harmless ones — never a tag that looks applied but isn't.
- [ ] **Local-only holds end to end.** With the publish guard on, no action taken through this affordance — in any sequence, on any surface — results in an event reaching an external relay.

## Concepts touched

- `39998:<TA>:nostr-event-tag` — the event-tagging being created/displayed.
- `39998:<TA>:tagging-with-specific-tag` — the per-tag header the affordance may need to create.
- `39998:<TA>:tag` — the tag (descriptor) applied; brand-new tags create one.
- `39998:<TA>:nostr-event` — the target kind-1 note.

> Handles use the **local** TA pubkey as a placeholder — the Architect must resolve against the target instance's **runtime** TA (never hardcode), per CLAUDE.md. The read API (Story 4) and the write hook (Story 5) already encapsulate the dual-z/authority handling; this story consumes them.

## Out of scope

- **Any change to the read API or the write hook** — Stories 4 and 5 are the data/publish layers; this story is presentation + interaction only. If a gap is found, kick back rather than widening here.
- **Pinning event-tags, ranking/scoring changes** — epic-level out of scope.
- **Tagging non-kind-1 events as a product surface** — the protocol is general, but this UI targets kind-1 notes only.
- **Revoke / hard delete (NIP-09)** of a tagging — flipping apply↔dispute covers "change my stance"; a hard delete is a later concern.
- **Changing the existing profile (pubkey) tagging feature** — it is only the visual/interaction precedent.
- **Lifting the local-only guard / any external publish** — the operator's separate, explicit release decision.

## Resolved decisions (PO, 2026-06-30)

- **Unverifiable taggings are deferred from v1.** This story displays only the *counted* set (counted = a tagging whose header resolves and whose authority the viewer honors, per the read API). Surfacing *unverifiable* taggings (header not locally resolvable) is a follow-up, **logged in `engineering-team/stories/_intake.md`** so it isn't lost.
- **No phasing — build the whole feature, then browser-test.** Display + the three write interactions (apply/dispute, add-existing, create-new) ship together across all surfaces. The profile (pubkey) tagging UI is a strong, proven precedent, so a read-only-first seam isn't needed. Single delivery is acceptable.

## Open questions

1. **Placement & density within the shared note unit.** Where the affordance sits on a note (an always-visible chip row, an expandable section, an action on the note's menu) and how it behaves when a note has many tags vs none. Mirror the profile-tagging precedent unless there's reason to diverge. *(Design)*
2. **Search-existing UX reuse.** How much of the profile-tag search-existing interaction is reused vs. note-specific. *(Design / Architecture)*

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0006-event-tag-affordance-on-note-surfaces.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
