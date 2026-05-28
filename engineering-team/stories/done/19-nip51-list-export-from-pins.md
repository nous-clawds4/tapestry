# Story 19: NIP-51 kind-30000 list export from pinned tags

**Status:** Done
**Created:** 2026-05-28
**Type:** Feature

> **Why this story exists, in one paragraph:** Today, pinning a tag
> produces a kind-30392 Trusted List event (Stories 10–12, ADR 0010)
> signed by the TA, that Brainstorm's own UI can read but that
> virtually no other nostr client knows how to render. The pin's
> value as a curated, signed set of pubkeys therefore stops at the
> edges of this app. NIP-51 "follow set" (kind 30000) is a widely-
> implemented standard — every mainstream nostr client renders
> kind-30000 lists as feeds with one click. Each pin should *also*
> produce a kind-30000 event whose members match the TL's
> membership, so that the pinner can paste an `naddr` into Amethyst /
> Damus / Iris / Coracle / Primal and the list opens as a feed
> there.
>
> **Critical constraint discovered during planning:** kind-30000
> follow sets are by convention signed by the user whose list it is.
> A TA-signed kind-30000 would show up in cross-client UIs as one of
> the TA's follow sets, not the user's, which defeats the goal.
> Therefore the kind-30000 must be **user-signed (NIP-07)**, which
> in turn means **the TA cannot keep it refreshed in the background**
> — the cron model that auto-refreshes the kind-30392 cannot extend
> to the kind-30000. The user must re-export themselves whenever
> they want to update the published kind-30000 to reflect current
> membership. The UI must communicate this clearly.

## Background

Stories 10–12 shipped the Pin → Trusted List pipeline. A user's pin
event (`kind=39999`, `z=tag-pinning`, **user-signed**) triggers
periodic publication of a kind-30392 TL **signed by the TA**, computed
under the pinner's POV, whose `p`-tags are the pubkeys that pass the
WoT-trusted endorsement / dispute filter. The TL is auto-refreshed
on a schedule (cron) and on-pin (refresh-on-pin fire-and-forget),
and consumed by:

- Brainstorm's `/pin/:dTag` detail page.
- The `/pins` list row status indicator.
- Brainstorm Search's "Pinned tag" filter chips.
- The TL share button (NIP-19 `naddr` copy → paste-into-other-client),
  which today points at the kind-30392 event.

The last surface is the broken-by-design one. The kind-30392 share
`naddr` lands a recipient in a nostr client that has no UI for that
kind — they see (at best) raw JSON, more often nothing at all.
Kind-30000 (NIP-51 follow set) is the kind every mainstream nostr
client *does* know how to render as a feed.

### NIP-51 spec language — this is canonical usage, not a stretch

Per the NIP-51 "Sets" section (relevant excerpts):

> Sets are lists with well-defined meaning that can enhance the
> functionality and the UI of clients that rely on them. **Unlike
> standard lists, users are expected to have more than one set of
> each kind, therefore each of them must be assigned a different
> "d" identifier.** […] Aside from their main identifier, the "d"
> tag, sets can optionally have a "title", an "image" and a
> "description" tags that can be used to enhance their UI.
>
> name | kind | description | expected tag items
> Follow sets | 30000 | categorized groups of users a client may
> choose to check out in different circumstances | "p" (pubkeys)

Each pinned tag is one such "categorized group" of users, with a
"d" identifier distinguishing it from the user's other pinned-tag
exports and other follow sets. The user is, per spec, expected to
have many of these. **This story's usage pattern is the NIP-51
canonical pattern, not a creative reinterpretation.**

The PO-level discussion (`/discuss` session on 2026-05-27) walked
through three options:

- **Option 1 — Parallel publication.** Each pin produces BOTH a
  kind-30392 (TA-signed, auto-refreshed, internal) AND a kind-30000
  (user-signed, manually-refreshed, cross-client-portable).
- **Option 2 — Migrate and deprecate.** Refactor all Brainstorm-internal
  read paths off kind-30392 onto kind-30000; drop kind-30392.
- **Option 3 — Drop "Trusted List" as a concept** and rename the
  feature around kind-30000 follow sets only.

**This story picks Option 1.** It's the cheapest path to "user can
paste a pin into Damus and see a feed" without re-litigating internal
surfaces or naming.

### The user-signing constraint and its consequences

The original /discuss draft assumed the TA could sign both kinds on
a cron. **It cannot,** for the kind-30000:

- Kind-30000 is, by NIP-51 convention, a user's own categorized
  follow set. Other clients render it under the author's identity.
  A TA-signed kind-30000 surfaces in Amethyst / Damus etc. as the
  TA's follow set, not the user's — useless for the pinner's
  sharing use case.
- Therefore the kind-30000 must be signed with the user's key
  (NIP-07).
- Therefore the TA's background cron cannot refresh it. The user
  must re-sign every time they want the published list to reflect
  updated membership.
- Therefore the kind-30000 is **a snapshot, not a live view**. The
  kind-30392 remains the live, auto-refreshed view; the kind-30000
  is the user's exported snapshot of it at a chosen moment.

This cascades into UX consequences:

- Pin time signs both the kind-39999 pin event AND an initial
  kind-30000 export. (Whether that's one batched NIP-07 prompt or
  two sequential is the Architect's call.)
- A dedicated **"Export for use in other clients"** affordance,
  separate from the existing kind-30392 share, lets the user
  re-sign the kind-30000 with current membership whenever they
  want.
- The UI must surface that the kind-30000 is a snapshot — last
  exported when, possibly stale — and that re-export is on the
  user, not on a cron.
- Unpinning retracts the kind-30392 via the existing cron
  retraction path. The kind-30000 is the user's own; if they want
  to retract it they must re-export-empty (or delete via NIP-09).
  v1 handles retraction of the kind-30000 minimally — see
  Out of Scope.

### Membership-only export

A second scope decision: in v1 the kind-30000 export carries
membership only — no per-member endorsement / dispute counts, no
score on `p`-tags. NIP-51 spec is `["p", pubkey, relay]`; a third
positional `score` element is non-standard and would degrade
cross-client rendering. Scores and per-member counts are still
available on the kind-30392 internal surface and inside the
kind-30392 content JSON when `includeScoreInTL` is true.

### Scope summary

This story is **server + UI** but **not concept-graph**: it
introduces no new firmware concept (kind 30000 is an existing nostr
event-type, and the `z` tag binding it to a Brainstorm concept
reuses an existing concept). No firmware reinstall.

## User-facing description

As a Brainstorm user who has pinned a tag, I want the pin's curated
list of trusted-in-this-tag profiles to be readable as a feed in any
nostr client I or my followers use — Amethyst, Damus, Iris, Coracle,
Primal, Habla — not just inside Brainstorm. When I pin a tag, I want
the system to also publish a NIP-51 follow set under my own key, so
recipients see it as my list. I want a clear "Export for use in
other clients" action that I can use anytime to re-publish the list
with current membership and copy its share link. I want the UI to
be honest with me about which list updates automatically (the
Brainstorm-internal one) and which I have to re-publish myself (the
cross-client one), so I am not surprised when the published feed in
another client is stale. Inside Brainstorm, my existing pin
experience and surfaces should not regress.

## Acceptance criteria

### Wire-shape — at pin time

- [ ] **AC-1** — Given I am pinning a tag I have not previously
  pinned, when the pin action completes successfully, then **two
  nostr events have been published to local strfry under my key
  (the pinner's NIP-07 identity)**:
    - the existing kind-39999 pin event (unchanged from Story 10), AND
    - a new kind-30000 "follow set" export event for that pin.
  Whether the user is prompted to sign once or twice is the
  Architect's call (batched NIP-07 calls are not universally
  supported; sequential prompts are acceptable if the second prompt
  has clear copy).

- [ ] **AC-2** — Given the kind-30000 event from AC-1, it is
  **signed by the user's pubkey** (NOT the TA's) and carries:
    - A `d` tag whose composition mirrors the kind-30392 TL's d-tag
      shape for the same `(observer, tag-author, tag-slug)` (so that
      Brainstorm-aware tooling can correlate the two events). The
      exact d-tag is the Architect's call (see Replaceability ACs
      AC-5 / AC-6).
    - A `z` tag binding it to a Brainstorm concept that identifies
      it as a "user-exported pinned-tag list" so Brainstorm's own
      read paths can find these events. Concept choice (reuse vs
      new) is the Architect's call per Open Questions.
    - A `title` tag whose value is **the user-chosen name** for
      this list (see AC-9).
    - `p`-tags reflecting current TL membership at the time of
      publish — pubkey only (no relay, no score in v1). Member set
      should match the kind-30392's `p`-tag set as it stands at
      that moment, but exact byte-identical synchrony is not
      required across one pin action (a small race window is
      acceptable; see AC-4).

- [ ] **AC-3** — Given the kind-30000 event from AC-1, it may
  carry the **NIP-51 canonical optional metadata tags `description`
  and `image`** if the Architect chooses to populate them (e.g. the
  "via Brainstorm" hint could live in `description` instead of /
  in addition to `title` — see AC-9 / Open Questions; an `image`
  could carry the TA's or instance's branding). These are
  **optional** — the v1 hard requirement is only AC-2's
  identity-plus-membership fields. No Brainstorm-specific tag
  (`observer`, `source-tag`, `cutoff`, `min-rank`, `metric`) is
  required on the kind-30000; the Architect may add them (NIP-51
  unknown-tags are ignored by generic readers, making them harmless)
  but doing so is not an AC.

- [ ] **AC-4** — Given the kind-30392 TL refresh path (cron,
  refresh-on-pin, manual Refresh) and the kind-30000 export path
  introduced by this story, they share the **same membership
  computation primitive** (`aggregateProfilesTagged` from ADR
  0010 / Story 11) so that, at the moment of a coupled
  publish (e.g. first pin), the `p`-tag sets are derived from
  the same point-in-time POV-filtered scan. Subsequent
  drift between the two events is expected (the kind-30392
  auto-refreshes; the kind-30000 only changes when the user
  re-exports) and is not a bug.

### Replaceability — never fragment, never destroy

This block is hard-required by NIP-33 (parameterized-replaceable
events) and by the project's guiding principle of not destroying
user-signed content. **A user's pinned-tag list must occupy
exactly one logical slot per pin, forever — re-exports overwrite
the slot's contents, they do not multiply or delete.**

- [ ] **AC-5** — Given a single logical pinned-tag list for a
  given `(user, pin observer, pin tag-author, pin tag-slug)`
  tuple, the kind-30000 events that the user publishes for that
  list across time (initial publish at pin time per AC-1; every
  subsequent re-export per AC-11) ALL carry **the same `d`-tag
  value**. By NIP-33 parameterized-replaceable-event semantics,
  the relay therefore holds **exactly one active kind-30000
  event** for that addressable coordinate at any time (the
  latest `created_at` wins). **The user MUST NEVER see their
  re-export create a second, parallel kind-30000 slot for the
  same pin.**

- [ ] **AC-6** — Given AC-5's stable d-tag, its composition is
  **derived solely from the pin's immutable identity** — i.e.
  the same `(observer, tag-author, tag-slug)` triple that ADR
  0010 uses for the kind-30392's d-tag, with the user (the
  signer) implicit in the kind-30000's `pubkey` field. The
  d-tag MUST NOT vary with: the chosen `title` (per AC-9 —
  title can change between re-exports without orphaning prior
  events), membership content, timestamp, curation cutoff,
  min-rank, the pin event ID (which itself changes on
  unpin-then-re-pin per ADR 0010), or any other re-export-time
  state. **The Architect commits the exact composition in the
  ADR.**

- [ ] **AC-7** — Given the user has previously published one or
  more kind-30000 events for a pinned-tag list, when they
  re-export per AC-11, the implementation **MUST NOT** publish
  a NIP-09 (`kind: 5`) deletion event targeting their previous
  kind-30000 events, MUST NOT issue any analogous destructive
  request to local strfry, and MUST NOT modify or hide their
  previous events from the user. The re-export's only effect
  on previous events is the **passive supersession** that
  NIP-33's addressable-replaceable index applies when a new
  event with the same `(kind, pubkey, d)` arrives with a
  higher `created_at`. The user's signed history is not
  destroyed by this story.

- [ ] **AC-8** — Given a scenario in which the user unpins and
  later re-pins the same tag (so the underlying pin event ID
  changes per Story 10), when they re-export the kind-30000
  for the re-pinned list, **AC-5's stable-d-tag invariant
  still holds** — the same addressable slot is reused. (Same
  rationale as ADR 0010's d-tag composition choice for the
  kind-30392 retraction story.)

### Title customization

- [ ] **AC-9** — Given the kind-30000 publish flow (either at
  initial pin time or at re-export time per AC-11), the user is
  given the opportunity to **enter a custom title** for the
  published list. If the user does not enter a title or skips the
  affordance, the default fallback is **`"<tag display name>
  (Pinned via Brainstorm)"`** (or, if the Architect picks the
  alternative in the Open Question below, the fallback is
  `"<tag display name>"` with the "via Brainstorm" hint in
  `description`). **Changing the title between re-exports does
  NOT change the d-tag** (per AC-6) — the title is content of
  the slot, not identity of the slot. The exact UI shape
  (inline text input, modal, popover) is the Architect's call,
  with one constraint from the PO: the affordance MUST NOT
  block the first-pin flow with another mandatory dialog
  interstitial (Story 18 AC-10 / AC-12 — first pin is no-dialog).
  If a UX conflict forces a choice, default to the fallback name
  silently at first pin and only surface the title-input on
  the re-export action.

### Re-export action — wherever the existing 30392 share appears

- [ ] **AC-10** — Given an existing pin whose initial kind-30000
  export has already been published, when the user is on `/pins`
  or on `/pin/:dTag` or anywhere else the existing kind-30392
  share / configure affordances appear, they see a separate
  affordance labeled (or equivalent) **"Export for use in other
  clients"**. Visually and semantically it is **distinct from
  the existing kind-30392 share button** — the AC's rule is
  that a user reading the UI cannot mistake which list is being
  shared by which button.

- [ ] **AC-11** — Given the user clicks the "Export for use in
  other clients" affordance, they are prompted (NIP-07) to sign
  a new kind-30000 event with the current membership and (per
  AC-9) a chosen title. On successful publish, the new event's
  `naddr` is **copied to the clipboard** (matching the existing
  kind-30392 share-button copy pattern) and a brief confirmation
  is shown. The `naddr` encoding (kind=30000, pubkey=user,
  identifier=d-tag, relays=...) is the Architect's call;
  recipient relay list policy is an Open Question.

- [ ] **AC-12** — Given a pin for which no kind-30000 export has
  ever been published (e.g. an existing pin that pre-dates this
  story shipping), when the user views any surface that shows
  the export affordance, the same button is presented and
  performs the same first-publish action. There is no separate
  "create" vs "re-export" mode — the user clicks "Export" in
  either case and the system does the right thing.

- [ ] **AC-13** — Given the user is **not logged in** with NIP-07
  (no signer extension available, or the user has not authenticated),
  when the export affordance would otherwise appear, then either it
  is **hidden** or rendered in a clearly **disabled state** with a
  tooltip or inline hint explaining that the user must sign in to
  export. The user MUST NOT see an export action that, when clicked,
  silently fails or produces an inscrutable error.

### Two distinct share/copy affordances — separate visual treatment

- [ ] **AC-14** — Given a `/pins` row or `/pin/:dTag` detail page
  for a pin where both kinds have been published, the UI surfaces
  **two distinct share / copy affordances**:
    1. The existing kind-30392 share (`TLShareButton`) — labelled
       so it's clear it shares the Brainstorm-internal trusted
       list (exact copy is the Architect's call; the AC's rule is
       "not visually identical to #2 below; reading the labels
       makes the distinction clear").
    2. The new kind-30000 export — labelled with the "Export for
       use in other clients" semantic (or visually equivalent).
  Both affordances live in a logically connected area of the row
  / page (Architect picks layout); a user reading the surface can
  pick the one they want without guessing.

### Staleness — UI honesty about which list auto-updates

- [ ] **AC-15** — Given a pin for which a kind-30000 export was
  published at time T (per AC-11) and whose underlying
  kind-30392 TL has subsequently been refreshed with different
  membership, when the user views the pin's surface that hosts
  the export affordance, then the UI surfaces **the timestamp of
  the last kind-30000 export** (e.g. `"Last exported: X ago"`).
  Exact phrasing is the Architect's call.

- [ ] **AC-16** — Given the same pin context as AC-15, when the
  last-exported kind-30000's membership differs from the current
  kind-30392 TL's membership (any difference — added or removed
  members), the UI presents a **staleness hint** — either inline
  text (e.g. `"N changes since last export — re-export?"`), or a
  visual badge on the export button, or both. Exact phrasing /
  affordance is the Architect's call; the AC's rule is the user
  must be able to tell, without clicking, that their published
  kind-30000 list is no longer in sync with the live kind-30392.

- [ ] **AC-17** — Given AC-15 / AC-16 surface a staleness signal,
  when the user has NOT yet published any kind-30000 for the
  pin (first time on this surface after the pin), then the
  staleness UI is replaced with an inviting "Export this list to
  other clients" hint instead of a "stale" or "out-of-date"
  framing. The two states (never-exported vs exported-but-stale)
  are visually distinguishable.

### Brainstorm-internal surfaces — no regression

- [ ] **AC-18** — Given Story 11's `/pins` row status derivation
  and Story 17 / 18's Pin button behavior, when a user views
  `/pins` after this story ships, then each row's `tlStatus`,
  Refreshed-X-ago indicator, "Refresh now" button, and Pin /
  Pinned state continue to read and behave identically to today
  (data sourced from the kind-30392 event). The new kind-30000
  surfaces (AC-14–AC-17) are additive — they do not change any
  existing row data.

- [ ] **AC-19** — Given Story 11 amendment's `/pin/:dTag` detail
  page, when a user opens any pinned-tag detail page after this
  story ships, then the page renders identically to today (data
  sourced from the kind-30392 event, same title / observer /
  source-tag / members / per-member endorsement-dispute counts,
  same existing Refresh-now / kind-30392 Share / Apply / Dispute
  affordances). The new kind-30000 affordances (AC-14–AC-17) are
  additive.

- [ ] **AC-20** — Given Brainstorm Search's pinned-tag filter
  chips (Story 11 amendment), when a user activates a chip after
  this story ships, then the membership filter narrows results
  identically to today (sourced from the kind-30392 event). The
  chips remain a kind-30392-driven internal surface.

### Cross-client portability — proof point

- [ ] **AC-21** — Given a published kind-30000 event from AC-1 or
  AC-11, when its `naddr` is pasted into at least one widely-used
  NIP-51-aware nostr client (Amethyst on Android or any equivalent
  desktop / iOS client the verifier has on hand), then the list
  **opens as a follow-set / feed view** (not raw JSON, not a "kind
  unknown" error). The title is rendered, the members are listed,
  and the user can click into the list to see a feed of posts from
  those members. Verification is **manual** during the Reviewer's
  AC walkthrough and is recorded in the review report.

- [ ] **AC-22** — Given the recipient of a shared `naddr` from
  AC-21 is on a relay that does NOT mirror this Brainstorm
  instance's local strfry, **AC-21 is allowed to fail** for that
  recipient — multi-relay broadcast is out of scope (see Out of
  Scope, also Story 14 territory). The verifier's manual check is
  performed against a configuration where the local strfry is
  reachable (e.g. the verifier adds the local strfry as a relay in
  their target client).

### POV / decentralized / view-time-filter invariants

- [ ] **AC-23** — Given two distinct users with two distinct POVs
  who each pin the same tag, when both their kind-30000 exports
  publish, **two distinct kind-30000 events exist in local strfry**,
  each signed by its respective user, each carrying that user's
  POV-filtered membership in its `p`-tags at the moment of
  publication. No cross-POV conflation. This is the same invariant
  Story 11 / ADR 0010 established for kind-30392 and must hold
  for kind-30000 too.

- [ ] **AC-24** — Given AC-1's at-pin-time publication and AC-11's
  re-export action, when membership is computed, it is computed
  **per the existing `aggregateProfilesTagged` WoT-author filter**
  under the pin's observer POV — no precomputed "trusted set"
  table, no global truth, no write-time gating of who can be in
  the list. The kind-30000 reflects the current state of signed
  assertions filtered through the pin's POV at the moment of
  publish.

## Concepts touched

- `39998:<TA>:tag-pinning` — unchanged at the schema layer; the
  new publish paths take their inputs from existing pin events.
- `39998:<TA>:nostr-user-tag` — unchanged; still the input
  endorsement / dispute set whose WoT-trusted aggregation drives
  membership.
- `39998:<TA>:web-of-trust` — unchanged; per-POV scoring still
  drives the membership filter.
- `39998:<TA>:tag` — unchanged.
- **Possibly a new concept** to z-tag the kind-30000 exports
  (per AC-2 / Open Questions). PO preference is reuse if at all
  reasonable; introducing a new concept means a firmware
  reinstall.

(All concept handles use `<TA>` placeholders per the
runtime-TA-pubkey rule in CLAUDE.md; the Architect will resolve at
implementation time, not bake in literals.)

## Out of scope

- **Retiring kind-30392 / migrating Brainstorm-internal surfaces
  off it.** Parallel publication in v1 means the kind-30392
  surface stays exactly as today. Migration to a kind-30000-only
  world is a future epic. Reviewer should reject any diff that
  removes kind-30392 read or write code as part of this story.

- **Auto-refresh of the kind-30000.** Per Background, this is
  fundamentally not possible without TA-signing — which is
  unwanted for the cross-client UX. The user re-exports manually.
  Any "schedule a re-export" or "auto-re-sign" affordance is a
  separate story (likely tied to NIP-46 / remote-signer work or
  to a Brainstorm-hosted user signer, neither of which is in
  scope here).

- **Retraction of the kind-30000 on unpin.** v1 leaves the
  user's previously-published kind-30000 in place on local
  strfry (and on any relays it has been pushed to outside
  Brainstorm) when the user unpins. The kind-30392 still gets
  retracted by the existing cron (TA-signed, empty-replacement).
  The user is responsible for re-exporting an empty version (or
  publishing a NIP-09 delete) if they want to retract the
  kind-30000 too. **The UI MUST surface this clearly** on the
  unpin path — at minimum, a hint that "your exported list in
  other clients is not automatically retracted; you can
  re-export an empty version from the pin detail page" — but
  building a dedicated "retract export" button is a follow-up.
  Capture this constraint clearly in the unpin confirmation /
  feedback shown to the user.

- **Exposing scores on the kind-30000 `p`-tags.** Architect-flagged
  loss in the `/discuss` session; deliberately deferred. Membership
  only in v1.

- **Renaming "Trusted List" in the Brainstorm UI.** Internal
  vocabulary unchanged; only the cross-client export framing is
  NIP-51.

- ~~**Multi-relay publishing of the kind-30000.** Local strfry only
  in v1, matching the existing kind-30392 publish scope.
  Cross-client portability depends on the recipient's client
  having local strfry in its relay list (or on the share `naddr`
  including a relay hint — see Open Questions).~~
  **Superseded by Amendment 2026-05-28 below** — multi-relay
  broadcast to the user's NIP-65 write relays is now in scope.

- **Encrypted (NIP-44) lists.** Public only in v1.

- **Per-pin or per-user opt-out from the kind-30000 export at
  pin time.** Pinning publishes both kinds. A "skip the
  cross-client export" toggle is a follow-up if user feedback
  asks for it.

- **Surfacing arbitrary users' kind-30000 exports** (e.g.
  "browse all users who've exported a list for this tag").
  v1's read surfaces are still kind-30392-driven (AC-18 / AC-19 /
  AC-20); the kind-30000 is for the pinner to share outward, not
  for Brainstorm to aggregate.

- **Treasure Map integration (Story 14, paused).**

- **Runtime TA-pubkey migration (Story 16, pending).** This
  story MUST use runtime TA helpers everywhere — no new literals.

## Open questions

These belong to the Architect or to the PO/user to resolve before
or during Phase 2:

- **Pin-time signing UX (AC-1).** One batched NIP-07 prompt for
  both events, or two sequential prompts (pin → confirm sign of
  export)? NIP-07 compatibility varies. Architect picks. If two
  prompts are unavoidable, second-prompt copy is critical —
  must read clearly as "publish a shareable list of these
  members."

- **Z-tag concept for AC-2.** Reuse `tag-pinning`, reuse
  `web-of-trust`, or introduce a new concept (e.g.
  `pinned-tag-export` or `user-exported-trusted-list`)? PO
  preference is reuse if possible (no firmware reinstall);
  Architect commits in the ADR. If a new concept is introduced,
  the reinstall is a noted consequence in the ADR.

- **Share-`naddr` recipient relay list (AC-11).** Should the
  copied `naddr` include this Brainstorm instance's public-facing
  strfry relay URL (so a recipient's client can locate the
  event), or be relays-less? PO leans **yes, include the
  instance's public relay**; Architect to confirm and pick the
  exact URL source (config? a setting? hardcoded per
  deployment?).

- **Title-input UX timing (AC-9).** Inline title input at
  pin-time vs deferred-to-export-only-action; how the affordance
  composes with Story 18's no-interstitial first pin. PO
  fallback if conflict: default name silently at pin time,
  title-input only on the re-export action.

- **Where does the "via Brainstorm" hint live: `title` or
  `description`?** Per NIP-51 spec, `description` is the
  canonical place for descriptive metadata, leaving `title`
  pure for the user-chosen name (e.g. title = `"javascript
  hackers I trust"`, description = `"A Pinned-tag list from
  Brainstorm — members are trusted in this tag under the
  exporter's web-of-trust POV."`). Alternative is to bake the
  hint into the title-fallback default (`"<tag> (Pinned via
  Brainstorm)"`) and leave `description` for future use. PO
  leans toward **using `description` for the hint and letting
  `title` be purely the user's choice**, with the fallback
  default of `title = "<tag display name>"` (no parenthetical).
  Architect to confirm.

- **`/pins` row staleness display (AC-15 / AC-16 / AC-17).** How
  much room is on the existing row layout? Is the staleness
  badge inline-next-to-export-button or in a separate row? Does
  the same layout pattern work on the `/pin/:dTag` detail page?
  Architect's call.

- **Membership computation at re-export time (AC-11).** Does the
  re-export action fetch live membership from the current
  kind-30392 (one strfry scan), or does it trigger a fresh
  membership compute (full WoT-author scan + filter, like the
  cron) before signing? PO leans **read current kind-30392** —
  it's already POV-filtered, it's the canonical Brainstorm
  state, and it's faster. Architect to confirm.

- **What if the user's local kind-30392 is stale at re-export
  time** (e.g. they haven't been on the site, refresh hasn't run
  recently)? Do we re-trigger a refresh of kind-30392 first?
  Architect's call; PO leans toward "no — re-export reflects the
  kind-30392 as it exists right now; user can manually click
  Refresh-now first if they want a fresh compute."

- **Telling the user, at unpin time, that the kind-30000
  doesn't auto-retract** (Out of Scope item, but the UI hint is
  in scope per the "this should be mentioned in the UI
  somewhere" PO instruction). Exact unpin confirmation copy is
  the Architect's call.

## Linked artifacts

- **Pin-stack predecessors (do NOT modify their behavior):**
  - `engineering-team/stories/done/10-pin-a-tag.md`
  - `engineering-team/stories/done/11-tl-publication-from-pins.md`
  - `engineering-team/stories/done/12-customize-pin-curation.md`
  - `engineering-team/stories/done/13-most-pinned-tag-index.md`
  - `engineering-team/stories/17-tag-detail-curated-view-and-pin-polish.md`
  - `engineering-team/stories/18-curated-mobile-affordances-and-pin-state-polish.md`
  - `engineering-team/decisions/0010-tl-publication-from-pins.md`
  - `engineering-team/decisions/0014-tag-detail-curated-view-and-pin-polish.md`
- **CLAUDE.md invariants this story must honor:**
  - POV-first (AC-23 / AC-24).
  - Decentralized-first (the user signs their own export; the TA
    does not own or aggregate it).
  - Filter at view time, not write time (membership is recomputed
    on each publish from current signed assertions).
- **Discussion origin:** `/discuss` session on 2026-05-27 plus
  PO clarification on 2026-05-28 surfacing the user-signing
  constraint and the addressable-replaceability invariant
  (re-documented inline in this story's Background and
  Replaceability AC block).
- **Pending / paused dependencies (unchanged by this story):**
  - `engineering-team/stories/14-treasure-map-pin-integration.md` (paused)
  - `engineering-team/stories/16-runtime-ta-pubkey-migration.md` (pending)
- ADR: `engineering-team/decisions/0017-nip51-list-export-from-pins.md`
- Test plan: `engineering-team/stories/done/19-nip51-list-export-from-pins.test-plan.md`
- Review: `engineering-team/reviews/19-nip51-list-export-from-pins.md`

## Amendment 2026-05-28 — multi-relay broadcast to user's NIP-65 write relays

After the initial story was drafted and the ADR Q3 resolved the
`naddr` recipient relay list as "include the instance's
`BRAINSTORM_RELAY_URL`," the PO surfaced a load-bearing gap:

> When a user pastes their `naddr` into Damus / Amethyst / Iris,
> those clients look for the event on the *user's own write
> relays* (per NIP-65). If the kind-30000 only lives on the
> Brainstorm instance's local strfry, the recipient client won't
> find it unless they manually add the Brainstorm relay to their
> relay list. That defeats the cross-client UX promise of the
> story.

The fix is to also broadcast the kind-30000 to the user's NIP-65
(kind-10002) write relays at publish time, and to include those
write relays (not the instance relay) in the `naddr` so recipients
can find it on the user's own relay set.

This amendment:

- **Removes** "Multi-relay publishing of the kind-30000" from Out
  of Scope (struck through above).
- **Adds** the acceptance criteria below.
- **Triggers** an ADR amendment (`0017-nip51-list-export-from-pins.md`
  → "Amendment 2026-05-28 — multi-relay broadcast" section)
  that supersedes Q3 (naddr relay list) and resolves the new
  open questions below.

### New acceptance criteria

- [ ] **AC-25** — Given the kind-30000 publish flow (at pin time
  per AC-1 or at re-export time per AC-11), when the client
  publishes the signed event, then **the publish targets include
  the user's NIP-65 (kind-10002) write relays** — i.e. relays
  declared as `write` (or read+write — i.e. no explicit `read-only`
  marker) in the user's most recent kind-10002 event in local
  strfry. Local strfry MUST also receive a copy (so internal
  surfaces keep working). Failure on any individual external relay
  is tolerated; success of at least one relay (local strfry or
  external) is required for the action to be considered successful
  (the existing `publishOrThrow` policy).

- [ ] **AC-26** — Given the user clicks the "Export for use in
  other clients" affordance (or the at-pin-time export flow runs),
  when the export popover / dialog is rendered, **before publish**,
  it surfaces a **relay preview** stating in plain English where
  the list will go. Example wording (Architect's call):
  `"This will publish the NIP-51 list '<title>' to: wss://relay.damus.io, wss://nos.lol, … (3 of your write relays, from your NIP-65 relay list)."`
  The user can see the relay set before confirming the publish.

- [ ] **AC-27** — Given the user has **no kind-10002 event** in
  local strfry (no published relay list, or it hasn't been synced
  yet), when they invoke the export flow, then the UI **clearly
  communicates this** — e.g. `"You haven't published a NIP-65
  relay list, so this list will only be published to this
  Brainstorm instance's relay. To make it discoverable in other
  nostr clients, publish a relay list (NIP-65) first."` The user
  MAY still proceed (publishing to whatever fallback the
  Architect picks, e.g. local strfry only, or the existing
  `aRelays` from `ConfigContext`), but they MUST be informed of
  the limitation. The exact fallback policy is the Architect's
  decision per the ADR amendment.

- [ ] **AC-28** — Given the `naddr` copied to the clipboard
  (AC-11), it **includes the user's NIP-65 write relays** (a
  subset is acceptable — Architect's call on count, e.g. first 3
  by order or all of them) in its `relays` field. If the user
  has no kind-10002, the `naddr` includes whatever fallback the
  Architect chose for AC-27 (or is `relays`-less if no fallback
  is feasible). **The previously-resolved Q3 in the ADR (include
  `BRAINSTORM_RELAY_URL`) is superseded.**

### New open questions for the ADR amendment

These belong to the Architect to resolve in the ADR amendment:

- **Source of the user's NIP-65 list.** Local strfry only, or
  fetch from an external relay on demand if local is empty? PO
  leans local-strfry-only (consistent with how the rest of the
  pin stack reads strfry); if local doesn't have the user's
  kind-10002, fall back to UI warning per AC-27.

- **Does `syncWoT.sh` already pull kind-10002?** If not, this
  story's Implementer adds it to the synced-kinds list (a
  one-line addition to `src/manage/negentropySync/syncWoT.sh`).
  Architect to confirm and bundle.

- **Naddr relay count.** All write relays, top-N (e.g. 3), or
  some other policy? PO leans **all** (naddr size is not a
  practical issue with handfuls of relays).

- **Fallback when kind-10002 is absent (AC-27).** Three options:
  (a) publish to local strfry only with a clear UI warning;
  (b) publish to local strfry + `aRelays` (the instance's
  configured broadcast relays) with a different warning;
  (c) refuse to publish until the user sets up a relay list.
  PO leans (a) — least surprising, most respectful of the user's
  identity (don't publish to relays they haven't claimed).
  Architect to commit.

- **Refreshing the user's write-relay list.** If the user
  updates their kind-10002 between exports, when does this
  surface in the UI? Architect picks; PO leans "re-read on every
  Export action, no caching beyond a single click's flow."

- **The kind-30000 publish to external relays takes longer than
  local strfry alone.** UI must indicate "publishing…" while
  external publishes are in flight (the existing
  `<TLExportButton>` "exporting" state handles this; just confirm
  it covers the multi-relay timeout window).

## Amendment II 2026-05-28 — wrong-layer fix: client-side NIP-07 relay lookup

The first Amendment routed the user's NIP-65 (kind 10002) read
through local strfry, requiring a system-wide `syncWoT.sh` change
to make it reliable. After ship, the PO surfaced that this is at
the wrong layer:

> "shouldn't this just be a thing that happens when the user logs in?
> not a whole system-wide WoT sync anything?"
>
> "what does WoT or GR have to do with this?"

Correct: WoT-sync is a trust-graph concern (everyone's follow lists,
mutes, attestations). The logged-in user's own write-relay list is
identity data — the user is right there in the browser, holding a
NIP-07 extension that already knows the answer.

This amendment supersedes the relevant portions of Amendment I and
ADR 0017 Amendment A1/A2/A4/A7. The wire shape of the kind-30000
event, the d-tag composition, the replaceability invariants, the
pin-time two-prompt flow, and the Brainstorm-internal no-regression
ACs are all unchanged.

### ACs refined

The four Amendment-I ACs are refined as follows. AC numbers are
preserved (no renumbering, no AC silently dropped):

- [ ] **AC-25** — Given the kind-30000 publish flow, the publish
  targets include the user's NIP-65 write relays, **sourced
  client-side from `window.nostr.getRelays()`** (filtering to
  entries with `write !== false`). Local strfry also receives a
  copy. Failure on individual external relays is tolerated; the
  publish is considered successful if at least local strfry or
  any one external relay succeeded (matches existing
  `publishEverywhere` policy).

  - [ ] **AC-25a (deleted from AC-25 surface)** — the
    `nip51ExportStatus.writeRelays` field on /pins rows is
    **removed**. Relay listing is per-click, client-side, no
    longer surfaced on the row payload.

- [ ] **AC-26** — Given the user clicks Export, the popover renders
  the relay-preview block sourced from `window.nostr.getRelays()`
  fetched on popover open (not from a prop or pre-fetched row
  field).

- [ ] **AC-27** — Given `window.nostr.getRelays()` is undefined,
  rejects, or returns an empty / all-read-only set, the popover
  shows the no-NIP-65 warning copy. The user MAY still click
  Export to publish to local strfry only.

- [ ] **AC-28** — The naddr is composed **client-side** via
  `nip19.naddrEncode` after signing, using the `writeRelays`
  from the NIP-07 lookup. Same final shape; different source.

### Out of scope (deferred to future amendments / stories)

- **Direct-relay fallback when NIP-07 lacks `getRelays`.** A future
  fallback could fetch the user's kind-10002 from a small set of
  well-known relays via `fetchFromRelays` (already in
  `nostrPublish.js`). Deferred until user feedback shows the
  no-NIP-65 warning fires too often in practice.

- **Resurrecting `syncWoT.sh` kind-10002.** Reverted by this
  amendment. A future feature that genuinely needs kind-10002 in
  local strfry should add it back with its own justification.

### Tester changes

- Drop the three `nip51ExportStatus.writeRelays`-on-row tests.
- Drop the "strfry contains the viewer's kind-10002" precondition
  test.
- Drop the contract suite's `syncWoT.sh kinds list includes 10002`
  assertion.
- Keep naddr-encoding, wire-shape, replaceability, endpoint
  validation, and POV tests.
- The Playwright spec's `mockNip07TwoSign` helper gains a
  `window.nostr.getRelays` mock returning a known relay set; the
  AC-27 test variant mocks it returning `{}`.

### Implementer changes

- Delete `src/api/_shared/userRelays.js`.
- Remove `getViewerWriteRelays` imports + calls from
  `src/api/profile-tags/index.js` (drop `writeRelays` field from
  `nip51ExportStatus`) and `src/api/trustedList/index.js` (drop
  `writeRelays` + `naddr` from the prepare endpoint's response).
- Revert `src/manage/negentropySync/syncWoT.sh` kind-10002 addition.
- Add `fetchUserWriteRelays()` helper in
  `ui/src/utils/publishTagPin.js`.
- `publishNip51ExportForPin` accepts a `writeRelays` arg; if
  omitted, calls `fetchUserWriteRelays()` itself. Composes the
  naddr client-side after signing.
- `TLExportButton.jsx` fetches relays on popover open via
  `fetchUserWriteRelays`, renders the preview, passes them to
  `publishNip51ExportForPin` on confirm. The `writeRelays` prop
  is removed.
- `Pins.jsx` / `PinDetail.jsx` drop the `writeRelays` prop from
  `TLExportButton` (component manages it internally).

### CLAUDE.md invariants

Unchanged. POV-first, decentralized-first, filter-at-view-time
still hold; the user signing their own list with their own relay
list is the *most* decentralized layering.

### Firmware reinstall

Still **no**.
