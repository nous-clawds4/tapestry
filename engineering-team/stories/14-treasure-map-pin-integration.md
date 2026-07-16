# Story 14: Treasure Map (kind 10040) references to pinned-tag Trusted Lists

**Status:** Draft
**Created:** 2026-05-20
**Type:** Feature

> **Epic-internal label:** "Story 14" in `engineering-team/epics/pin-a-tag.md`.
> Global story numbering also #14.

## Background

Stories 10–13 made pinning a real, durable signal: the user picks a
tag (Story 10), tunes its curation method (Story 12), the TA
periodically publishes a kind-30392 Trusted List for it (Story 11),
and the tag index surfaces "Most pinned" rankings (Story 13). The
TLs themselves live on local strfry — signed by this instance's TA,
addressable replaceable, ready to be consumed.

What's missing is **the discovery handshake**. A cross-app reader
(nostria.app, other nostr clients, future Brainstorm-on-other-relays
queries) has no way to find out "this pubkey has pinned tags and
their TLs live over there." The convention NIP-85 already
establishes for cross-app discovery is the user's **kind-10040
Treasure Map**: an event the user signs that points consumers at
*where* to look for their NIP-85 metric events (currently
kind-30382 rows like `30382:rank`, `30382:followers`, etc., as in
`src/api/export/nip85/commands/create-unsigned-kind10040.js:71–127`).

This story extends that same Treasure Map with pointers to the
user's **pinned-tag Trusted Lists** — the kind-30392 events the TA
publishes on the user's behalf. After this story:

- A user who has pinned tags can update their kind-10040 to
  advertise where those TLs live (this instance's relay, signed
  under this instance's TA).
- Apps reading the user's kind-10040 see entries that say
  "pinned-tag Trusted Lists for this user are at this relay,
  authored by this pubkey" — and can fetch them without prior
  Brainstorm-specific knowledge.
- The user remains the sole signer of their own Treasure Map; the
  TA does not sign on the user's behalf. The TA *publishes* the
  TLs; the user *advertises* them.

Per POV-first: the Treasure Map is per-user — there is no instance-
wide "the Treasure Map." Every pinning user owns their own.

Per decentralized-first: the user chooses whether and when to
advertise; the system never publishes a kind-10040 on the user's
behalf without an explicit NIP-07 signature.

Per filter-at-view-time: the Treasure Map carries *pointers* — it
does not embed TL contents, does not duplicate trust data, and does
not need to be re-published every time a TL's membership changes.
Consumers follow the pointers and read the live TLs.

## User-facing description

As a NIP-07-authenticated user who has pinned one or more tags, I
want a single action that updates my Nostr Treasure Map (kind 10040)
to include pointers to my pinned-tag Trusted Lists — so that other
nostr apps and clients can discover my curated lists without needing
to know about Brainstorm specifically, and my existing NIP-85 metric
entries on the same Treasure Map are preserved.

## Acceptance criteria

- [ ] **AC-1** — Given I am NIP-07-authenticated and have pinned one
  or more tags, when I visit my `/pins` page (or the user-pins
  surface the Architect picks), then I see a clearly-labeled
  **"Advertise my pinned tags on my Treasure Map"** action (button,
  link, or panel — the Architect picks the affordance) explaining
  in one short sentence what it does.

- [ ] **AC-2** — Given I click that action, when the flow starts,
  then the app composes an updated kind-10040 event that:
    (a) preserves every existing tag entry already on my current
        kind-10040 (NIP-85 metric pointers, any other entries I had
        before),
    (b) adds one entry per currently-pinned tag pointing to its
        published kind-30392 TL (author = this instance's TA pubkey
        resolved at runtime per CLAUDE.md, relay = this instance's
        configured public relay URL),
    (c) is presented to me for NIP-07 signing — the app never
        publishes on my behalf without my signature.

- [ ] **AC-3** — Given I sign the proposed kind-10040 with NIP-07,
  when the publication succeeds, then the new event is published to
  local strfry **and** to the same outbox relays the existing
  kind-10040 publish path uses (matching the publish flow already
  established for `publish-signed-kind10040`); my Treasure Map on
  external relays now references my pinned-tag TLs.

- [ ] **AC-4** — Given I decline the NIP-07 signature prompt, when
  the flow ends, then no event is published and no client-side
  state pretends the update happened; an inline status conveys
  "not published."

- [ ] **AC-5** — Given I do NOT yet have a kind-10040 anywhere
  (neither local strfry nor my outbox relays return one for my
  pubkey), when I trigger the action, then the flow still succeeds:
  it composes a brand-new kind-10040 containing both the default
  NIP-85 metric entries (the same set today's
  `/api/create-unsigned-kind10040` produces) AND the pinned-tag
  entries; AC-3 publication semantics apply.

- [ ] **AC-6** — Given I have unpinned a previously-pinned tag
  (kind-5 deletion or replacement per Story 10) before triggering
  the action, when the proposed kind-10040 is composed, then no
  entry for the unpinned tag appears in the new event — even if the
  prior kind-10040 referenced it. (The advertised set always
  reflects the live pinned set at the moment of update.)

- [ ] **AC-7** — Given a published kind-30392 TL for one of my pins
  does not yet exist on local strfry (e.g., I just pinned a tag and
  the next TL refresh hasn't fired), when the proposed kind-10040
  is composed, then that pin is **still** included in the entries
  (the Treasure Map is a *pointer* — the reader resolves it at read
  time, not at publish time). The architect picks whether to also
  surface a passive "TL not yet published — pointer will go live
  after next refresh" hint on the row; no AC depends on the hint
  being present.

- [ ] **AC-8** — Given I am NOT NIP-07-authenticated, when I visit
  the user-pins surface, then the advertise-action affordance is
  not rendered (consistent with Story 10's auth-gated controls).

- [ ] **AC-9** — Given the action's publication fails (NIP-07 sign
  error, relay write rejected, local strfry unreachable), when I
  attempt the update, then an error surface tells me which step
  failed and my prior kind-10040 is unchanged on any relay
  (failures are atomic from the user's perspective — no partial
  state advertised).

- [ ] **AC-10** — Given my updated kind-10040 has been signed and
  published, when another nostr client reads it (e.g., a fresh
  Brainstorm session running the existing
  `fetchKind10040(myPubkey, popularRelays)` from
  `ui/src/pages/grapevine/SearchPreferences.jsx`, OR an external
  app like nostria.app following the same NIP-85 conventions),
  then the consumer can enumerate my pinned-tag TL pointers without
  Brainstorm-specific code paths — the entries follow whatever
  conventional kind-10040 tag-row shape the Architect commits to in
  Phase 2 and that shape is documented inline on the ADR.

- [ ] **AC-11** — Given my kind-10040 already contained pinned-tag
  entries from a previous run of this action AND I have pinned new
  tags since, when I trigger the action again, then the new
  kind-10040 contains entries for *all* currently-pinned tags
  (additions present, anything no longer pinned removed) without
  duplicating entries for tags that were already advertised.

- [ ] **AC-12** — Given I trigger the action while at least one of
  my pins uses a `curation-method.method` other than `nip85:rank`
  (Story 11 only generates TLs for `nip85:rank`; other methods
  produce no TL today), when the proposed kind-10040 is composed,
  then those pins are **excluded** from the advertised entries (the
  Treasure Map should not point readers at TLs that don't exist).
  The row, if shown in any preview UI, carries a brief explanation;
  the AC's hard requirement is the exclusion.

## Concepts touched

- `39998:<TA>:tag-pinning` — the source of "what is currently
  pinned by me" (Story 10 events).
- `39998:<TA>:tag` — each pin references a tag concept; the tag's
  identifiers (slug, event id, author) feed into the kind-10040
  entry shape the Architect picks.
- The published **kind-30392** TLs from Story 11 — the entities the
  new kind-10040 entries point at. (Not a firmware concept; just an
  event kind the Architect references.)
- The user's existing **kind-10040** event — the existing Treasure
  Map this story extends. (Pre-existing NIP-85 surface; no firmware
  concept introduced or changed by this story.)
- **No new firmware concepts.** No reinstall required.

## Out of scope

- **Periodic / automatic kind-10040 updates.** v1 is explicitly
  user-triggered. The TA does not silently update the user's
  Treasure Map; the user clicks "Advertise" when they want to
  re-publish. Any future "auto-refresh kind-10040 when my pin set
  changes" lives in a separate story (and would need consent UX).
- **Cross-instance Treasure Map reading** for pinned-tag discovery
  — i.e., a Brainstorm UI that crawls *other* users' kind-10040s
  to find their pinned tags. That's a discovery feature, not a
  publish feature; out of this story.
- **Editing individual entries** on the kind-10040 from a UI —
  this story's action is a full re-publish that mirrors the live
  pin set. No fine-grained editor.
- **DM alerts on Treasure Map change.** Treasure Map changes are
  user-initiated; no notification firehose to wire up.
- **NIP-44 encryption of the kind-10040 entries** — entry contents
  are intentionally public (the whole point is cross-app
  discoverability). Pin-event encryption is Story 15's scope.
- **Migrating users whose kind-10040 lives only on remote relays**
  back into local strfry — the existing `BrainstormSettings.jsx`
  flow already handles import; this story does NOT introduce a
  parallel import path.
- **Per-pin "do not advertise this one" toggle** — the v1 action
  advertises the full live pin set. A future privacy story may
  add per-pin opt-out.
- **Backfilling references to pre-Story-14 pins** beyond the
  current live set — a user who unpinned everything before
  triggering the action gets no pinned-tag entries (and no
  retroactive advertisement of historical pins).
- **Validating that the referenced kind-30392 TLs exist on the
  pointed-at relay at publish time** — AC-7 explicitly says the
  pointer can precede the TL.

## Open questions

These belong to the Architect to resolve in Phase 2:

- **Tag prefix / row shape.** Flagged in the epic as needing its
  own design pass: should the new entries look like
  `["30392:PinnedTag", <TA>, <relay>, <d-tag-or-identifier>]`,
  `["30392:TrustedList", <TA>, <relay>, ...]`, plain
  `["30392", <TA>, <relay>, <d-tag>]`, or per-TL one row each with
  a category label? The choice has to be consumable by external
  apps without Brainstorm-specific code paths (AC-10). Architect
  picks and documents the rationale on the ADR. — Architect.
- **Where the action lives.** Single button on `/pins`? Panel on
  `BrainstormSettings.jsx` next to the existing kind-10040
  controls? Inline in `/pins` AND linked from settings? — Architect.
- **Preview before signing.** Show the user a diff (entries to
  add, entries to remove, entries unchanged) before opening the
  NIP-07 sign prompt — yes or no? Suggested: yes, since this is
  an event the user is putting their name on. Architect to
  confirm the UX. — Architect.
- **Relay URL source.** Which configured value becomes the relay
  pointer in the new entries — `BRAINSTORM_RELAY_URL`,
  `BRAINSTORM_NIP85_HOME_RELAY`, or both? Today's
  `create-unsigned-kind10040.js` reads
  `BRAINSTORM_NIP85_HOME_RELAY` with a fallback to
  `BRAINSTORM_RELAY_URL`; reuse that, or pick differently? —
  Architect.
- **Server endpoint shape.** New `/api/create-unsigned-kind10040-with-pins`?
  Extend the existing `/api/create-unsigned-kind10040` with an
  optional `includePinnedTagTLs` flag? Two endpoints sharing a
  single composer module? — Architect.
- **Filtering "no TL yet" pins (AC-7 vs AC-12 boundary).** AC-7
  says still include if `nip85:rank` and TL hasn't fired yet; AC-12
  says exclude if curation-method isn't `nip85:rank`. The boundary
  is "supported method, awaiting first generation" vs "unsupported
  method, never will generate." Architect confirms the
  composer's filter and surfaces the rationale on the ADR. —
  Architect.

## Linked artifacts

- Epic: `engineering-team/epics/pin-a-tag.md`
- Predecessor stories:
  - `engineering-team/stories/10-pin-a-tag.md` — source of the
    live pin set this story reads.
  - `engineering-team/stories/done/11-tl-publication-from-pins.md`
    — the kind-30392 events the new kind-10040 entries point at.
  - `engineering-team/stories/done/12-customize-pin-curation.md`
    — determines which pins have generatable TLs (AC-12).
  - `engineering-team/stories/done/13-most-pinned-tag-index.md` —
    sibling read-side surface; no direct dependency, but the
    advertise action makes those WoT-scoped rankings reachable
    cross-app.
- Existing NIP-85 publish flow (reference for the
  sign-and-publish pattern):
  - `src/api/export/nip85/commands/create-unsigned-kind10040.js`
  - `src/api/export/nip85/commands/publish-signed-kind10040.js`
  - `src/api/export/nip85/commands/create-and-publish-kind10040.js`
- House rule on TA pubkey resolution at runtime:
  `CLAUDE.md` — "Per-deployment TA pubkey — NEVER hardcode" —
  applies to AC-2(b)'s `<TA>` lookup. Use
  `getOwnerAssistantPubkey()` server-side / `useConfig().taPubkey`
  client-side.
- Successor (queued): `engineering-team/stories/16-runtime-ta-pubkey-migration.md`
  — the final pin-epic story sweeps any TA-pubkey literals
  introduced or surfaced by Story 14. This story MUST itself use
  the runtime helpers from the start (do not introduce new
  literals — Story 16's success criterion includes "no new
  hardcoded TA pubkey literals in `src/` or `ui/src/`").
- ADR: `engineering-team/decisions/0013-treasure-map-pin-integration.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
