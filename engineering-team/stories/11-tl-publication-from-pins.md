# Story 11: Periodic Trusted List publication from pinned tags

**Status:** Approved
**Created:** 2026-05-18
**Type:** Feature

> **Epic-internal label:** "Story 12" in `engineering-team/epics/pin-a-tag.md`.
> Global story numbering proceeds sequentially; the epic's internal numbers
> are illustrative. Epic-Story-11 ("Customize curation at pin time") is
> deferred — Story 10's default `curation-method` is the only configuration
> in scope here.

## Background

Story 10 (foundational Pin a tag) gave NIP-07 users the ability to pin a tag
and stored each pin as a kind-39999 list-element carrying a `curation-method`
JSON describing how the eventual Trusted List should be computed. **Nothing
downstream consumes those pin events yet** — a pin is currently a personal
bookmark, nothing more.

This story is the payoff that the epic exists for. It turns each pin into a
**signed, periodically-refreshed NIP-85 Trusted List event (kind-30392)** in
the local strfry relay, computed under the pin's `observer` POV using the
pin's `curation-method`. Once a pin has a TL published:

- Other Nostr apps reading from this relay can pull the TL and use it for
  content discovery, list curation, GrapeRank input, channel feeds, or
  ring-signature input — the five concrete consumers documented in the
  Pinning issue (#150).
- The TL is the bridge between this user's per-POV WoT scoring and the
  decentralized world: it materializes "what does observer X say about
  category Y, as of timestamp T" into a single signed event.

Per the epic's cross-story shape, **v1 supports only the default
`curation-method.method = "nip85:rank"`** — the rank-driven branch. Other
method values (`follows`, `trust-everyone`, `trusted-list`) appear in the
Story-10 schema as forward-compat stubs; meaningful execution of each is its
own future story.

Per the decentralized-first invariant: any user's pin produces a TL signed
under the **Tapestry Assistant** (this instance's TA), using the *observer
pubkey from the pin's curation-method* as the TL's perspective. The TA is
publishing a derivation; it is not the authority on what "counts." Multiple
users can pin the same tag and produce independent TLs with different
observers.

## User-facing description

As a NIP-07-authenticated user who has pinned one or more tags, I want my
local Brainstorm instance to periodically generate and publish a signed
NIP-85 Trusted List (kind-30392) for each pinned tag — computed under my
chosen observer POV using my pin's curation-method — and I want to be able
to force a refresh of a single pin's TL on demand from my `/pins` page; so
that downstream nostr clients reading my local relay can consume my pinned
tags as actionable trust signals without waiting for the next scheduled
refresh.

## Acceptance criteria

- [ ] **AC-1** — Given the periodic TL refresh is enabled in Settings →
  Scheduled Tasks, when the next scheduled tick fires, then for **every Pin
  event in local strfry whose `curation-method.method` is `nip85:rank`**, a
  fresh kind-30392 event is published to local strfry. The event's contents
  reflect the pin's current `observer`, `cutoff`, and `includeScoreInTL`
  fields.

- [ ] **AC-2** — Given a published TL exists for a pin, when the periodic
  refresh fires again, then the addressable replaceable kind-30392 slot
  for that `(observer, pinned-tag)` is replaced in place (one TL per pin
  at any time; no duplicate events accumulating).

- [ ] **AC-3** — Given I am on my `/pins` page and a pinned tag's TL is
  stale or has never been generated, when I click a **Refresh now** button
  on that row, then within a short time (target: < 10s) a fresh kind-30392
  event is published for that pin only, without affecting other pins or
  re-triggering the global cron.

- [ ] **AC-4** — Given I have multiple pinned tags, when I click a
  **Refresh all** button on `/pins`, then the system enqueues a refresh for
  every pinned tag with a supported `curation-method.method` and reports
  per-pin progress / completion in the UI.

- [ ] **AC-5** — Given the TL membership for a pinned tag is computed, when
  the system applies the v1 disputes function, then a candidate pubkey is
  included in the TL **only if** the number of WoT-trusted **endorsements**
  of that pubkey-as-member-of-this-tag-category is `≥ curation-method.cutoff`
  **AND** strictly greater than the number of WoT-trusted **disputes** of
  the same. (Endorsements / disputes are the existing `nostr-user-tag`
  polarity-bucket assertions surfaced by `/api/profile-tags/profiles-tagged`
  for this tag.)

- [ ] **AC-6** — Given I open Settings → Scheduled Tasks, when I look, then
  I see a new panel for "Pinned-tag Trusted List refresh" with an
  enable/disable toggle (default: **disabled**) and a cadence configurator
  (whole-number days + hours, mirroring the existing scheduled-task panels
  from Story #4 / ADR 0003).

- [ ] **AC-7** — Given a pin's `curation-method.method` is **not**
  `nip85:rank`, when the periodic refresh fires, then that pin is skipped
  (no TL generated, no error surfaced to the user) and the pin row on
  `/pins` shows a small "unsupported curation method (v1 supports
  nip85:rank only)" hint. Refresh-now on that row is disabled with the
  same explanation.

- [ ] **AC-8** — Given a refresh — periodic or on-demand — fails for one
  pin (Neo4j unreachable, observer pubkey unresolved into a POV suffix,
  strfry publish failed, etc.), when I look at the pin's row on `/pins`,
  then I see a per-row error indicator with a brief reason, and other
  pins' refreshes are not blocked.

- [ ] **AC-9** — Given a pinned tag was unpinned (kind-5 deletion of the
  Pin event) since the last TL was published, when the next refresh fires,
  then no new TL is generated for that pin AND the previously-published
  kind-30392 for that `(observer, pinned-tag)` slot is retracted (via the
  standard kind-30392 replaceable mechanism — either an empty-membership
  replacement OR a kind-5 deletion; the Architect picks). The intent: a
  client reading the relay must not see a "stale" TL for an unpinned tag.

- [ ] **AC-10** — Given a published TL exists, when I (or another nostr
  client) read it from local strfry, then the event matches the kind-30392
  shape this codebase already reads at `/tapestry/grapevine/trusted-lists/`
  (so the existing detail page can render TLs generated by this story
  without changes). Concretely: kind=30392, signed by the TA pubkey,
  addressable replaceable, with a `d` tag identifying the
  `(observer, pinned-tag)` slot and member rows in whatever tag layout the
  existing TL spec defines.

## TL output shape (v1 product constraints)

Beyond AC-10's compatibility requirement, the published kind-30392 must
carry the following enrichment so downstream consumers can interpret a TL
standalone (decided during planning; the Architect picks the exact wire
layout in Phase 2):

- **Source tag metadata** — tag event id, slug, name — so a reader knows
  what category the TL represents without a second lookup.
- **Observer pubkey** as an explicit event tag, distinct from the
  TA-signer's `pubkey` field. The TA signs; the observer is the
  *perspective* the TL was computed under.
- **Disputes-function params** used during generation — `cutoff` and the
  WoT min-rank threshold — so a downstream client can interpret what
  "membership" actually means here (a TL with `cutoff=2` and a TL with
  `cutoff=10` represent very different signals).
- **Per-member endorsement / dispute counts** — the WoT-trusted tallies
  that drove each inclusion decision. Already computed during the
  disputes-function pass; small extra bytes for high transparency.

Deferred to follow-up stories (not in v1):

- **WoT rank scores per member.** Gated on `curation-method.includeScoreInTL`,
  which Story 10's default writes as `false`. Epic-Story-11 will let
  users flip this; at that point the generator can include it.
- **Per-member rationale** ("Bob and Carol endorsed Alice; Dave
  disputed"). Auditability nice-to-have; significantly larger event;
  separate follow-up.

## Concepts touched

- `39998:<TA>:tag-pinning` — the Pin events generated by Story 10 are the
  input set for this story's cron.
- `39998:<TA>:tag` — each pin references a tag whose `slug`/`name`/etc. is
  the subject of the produced TL.
- `39998:<TA>:nostr-user-tag` — the endorsement/dispute assertions whose
  WoT-trusted aggregation drives membership selection.
- `39998:<TA>:web-of-trust` — the per-POV trust scoring (`wot_rank_<suffix>`)
  the rank-driven branch reads to pick members.
- **New domain object (not necessarily a new firmware concept — Architect's
  call):** the published kind-30392 **Trusted List** event itself. Existing
  UI under `/tapestry/grapevine/trusted-lists/` already reads kind-30392;
  this story is its first *write* path on this instance.

## Out of scope

- **Customizing `curation-method` at pin time.** Deferred — epic-Story-11.
  v1 only respects what Story 10's default writes.
- **Methods other than `nip85:rank`** (`follows`, `trust-everyone`,
  `trusted-list`). Forward-compat schema only; each gets its own story.
- **Per-pin cadence.** v1 uses one global cadence for all pins (mirrors
  Story #4). Per-pin schedules add UI/scheduler complexity disproportionate
  to v1 value.
- **External-relay broadcast of generated TLs.** v1 publishes to local
  strfry only. Cross-app discovery (kind-10040 Treasure Map integration)
  is epic-Story-14.
- **"Most pinned" tag-index sort/filter.** Epic-Story-13.
- **DM alerts on TL membership deltas.** Explicitly out-of-epic.
- **NIP-44 encryption of TL events or pin events.** Epic-Story-15.
- **TL versioning history / archival.** v1 simply replaces. Past TLs are
  not retained (addressable replaceable; the relay keeps only the latest
  per addressable coordinate).
- **`includeScoreInTL = true` branch.** Story-10's default writes `false`;
  Story 11 (epic-internal) would let users toggle it, at which point a
  follow-up story makes the generator honor it. Currently a no-op.
- **Editing or revoking individual TL members from the UI.** A TL is a
  *derivation* — to remove a member, the user disputes that pubkey for the
  tag (existing Story-3 surface).
- **Backfilling TLs at the moment a tag is pinned.** v1 waits for the next
  scheduled tick OR an explicit refresh-now click. (If this turns out to
  be a bad UX, follow-up.)

## Open questions

These belong to the Architect to resolve in Phase 2:

- **TL addressable coordinate.** What is the `d`-tag composition for a
  generated kind-30392? Some candidate shapes: `pinned-tag-<observer8>-<tagSlug>-<tagAuthor8>`,
  or `pinning-<pinEventId>`, etc. The shape determines what "replace in
  place" (AC-2) means and whether one observer can have multiple TLs for
  the same tag-slug across different tag-authors. — Architect.

- **Retraction mechanism for an unpinned tag's stale TL (AC-9).** Empty
  replacement (kind-30392 with no members) vs kind-5 deletion of the prior
  event id. Architect's call; both are legal nostr. — Architect.

- **Where does the cron live in the existing scheduler?** Story #4 added
  the "Update All Scores for Owner" + "Meilisearch profiles + House PoV
  WoT scores refresh" pattern under `src/api/customer-schedule/` (or
  equivalent — Architect to confirm). This story adds one more panel to
  the same surface. — Architect.

- **Trust-trusted endorsements/disputes lookup (AC-5).** Reuse
  `/api/profile-tags/profiles-tagged` server logic, or hit strfry +
  WoT-rank filter directly inside the cron job? — Architect.

- **"Refresh now" auth gate.** Must the user be NIP-07-authenticated to
  click it (since it operates on their own pinned tags), or can it be
  unauthenticated since the TA signs the output? Suggested:
  authenticated (defensive), but Architect to confirm. — Architect.

- **Per-tick scope when global refresh is disabled.** When the toggle is
  off, does the manual "Refresh now" button still work? Suggested:
  **yes** — the toggle controls only the *scheduled* path; manual refresh
  is always available. — Architect to confirm.

- **What does "Refresh all" do when ten pins exist?** Sequential or
  parallel? Throttled? UI shows running progress how? — Architect.

## Linked artifacts

- Epic: `engineering-team/epics/pin-a-tag.md`
- Predecessor story: `engineering-team/stories/10-pin-a-tag.md` (the Pin
  events this story consumes)
- Reference pattern: `engineering-team/stories/done/4-scheduled-search-and-house-scores-refresh.md`
  + `engineering-team/decisions/0003-scheduled-search-and-house-scores-refresh.md`
  (the scheduled-task panel shape this story extends)
- Reference for kind-30392 read surface: `ui/src/pages/grapevine/TrustedListDetail.jsx`
  (existing detail page that should render TLs this story publishes
  without modification — see AC-10).
- ADR: `engineering-team/decisions/0010-tl-publication-from-pins.md`
- Test plan: `engineering-team/stories/11-tl-publication-from-pins.test-plan.md`
- Review: (filled in after Review phase)
