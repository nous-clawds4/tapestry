# Story 16: Runtime TA pubkey resolution — complete migration across publishers + readers

**Status:** Approved (QUEUED — see Background)
**Created:** 2026-05-20
**Type:** Bug (cross-cutting migration)

> **Queue position:** This story is deliberately deferred to be the
> LAST story before the final deploy of the pin-a-tag epic. The
> sequence is: Story 13 (in flight) → Story 14 (Treasure Map) →
> Story 15 (Encryption) → **Story 16 (this story)** → final deploy
> chain.
>
> Do not pick this up before Stories 13/14/15 ship. The reason for
> the deferral is that this migration causes orphaning of historical
> events on any deployment whose actual TA pubkey differs from the
> dev literal `82b75e47…973833`; the data loss should be timed once,
> deliberately, after the epic's user-facing features are in place
> so users have a clean re-creation surface.

## Background

The codebase hardcodes a single TA pubkey literal —
`82b75e47…973833`, which happens to be the value on the
local-dev instance — in four sites:

- `src/api/profile-tags/index.js:27–30` (server reader, derives
  `TAG_Z_TAG`, `NOSTR_USER_TAG_Z_TAG`, `TAG_PINNING_Z_TAG`).
- `ui/src/utils/publishProfileTag.js:15–16` (client publisher,
  Story-1 nostr-user-tag stack).
- `ui/src/hooks/useProfileTags.js:5–6` (client publisher, Story-1
  tag-creation stack).
- `ui/src/utils/publishTagPin.js` (client publisher, Story-10 pin
  stack).

On the dev instance the literal happens to equal the actual TA's
pubkey, so all four sites match each other and the system works. On
every other deployment — `tags.brainstorm.world`,
`staging.brainstorm.world`, `brainstorm.world`, and any fork — the
TA pubkey is different, but because all four sites still match
*each other* (all using the same wrong value), the system **appears
to work** on those deployments too. The signed events have the
wrong z-tag handles and the wrong author identities, but readers
filter under the same wrong values, so the matching pair stays
coherent.

The bug surfaces the moment any site is "fixed" without the others.
A partial fix (commit `d3a2640a`, reverted as `4b82a739`) updated
only the server reader in `src/api/profile-tags/index.js` —
breaking the matching pair on `tags.brainstorm.world` and
producing an empty tag index across every POV. The revert restored
service.

This story converts ALL four sites to runtime lookup in one
coherent change. After it ships:

- Each deployment publishes events using ITS OWN TA pubkey in z-tags.
- Each deployment's readers filter under ITS OWN TA pubkey.
- The matching pair is correct on every deployment, not just dev.
- The historical-event orphaning on non-dev deployments is the
  unavoidable cost of correctness.

The CLAUDE.md "Known violations" subsection added during the
incident lists the exact four sites; this story's success metric
is "that list is empty."

## User-facing description

As an operator of a Brainstorm/Tapestry deployment whose TA pubkey
is NOT the dev literal `82b75e47…`, I want the pin/TL/tag stack to
sign and read events under MY instance's actual TA pubkey — so
that the pin-a-tag features, Trusted List publication, profile
tagging, and tag index all work correctly on my deployment without
silent identity-mismatch failures.

As a developer reading the codebase, I want zero hardcoded TA
pubkey literals — so that any future feature that filters by TA
author or composes TA-prefixed concept handles is portable across
deployments by construction.

## Acceptance criteria

- [ ] **AC-1** — Given the server module
  `src/api/profile-tags/index.js` is loaded on any deployment, when
  it computes `TAG_Z_TAG` / `NOSTR_USER_TAG_Z_TAG` /
  `TAG_PINNING_Z_TAG`, then each constant uses the result of
  `getOwnerAssistantPubkey()` (from `src/utils/assistantKeys.js`)
  — not a hardcoded literal.

- [ ] **AC-2** — Given the client module
  `ui/src/utils/publishProfileTag.js` is used to build a
  nostr-user-tag assertion, when the event is constructed, then the
  `z`-tag references the deployment's actual TA pubkey (obtained
  from `useConfig().taPubkey` at the caller, threaded as a function
  argument) — not a hardcoded literal.

- [ ] **AC-3** — Given the client module
  `ui/src/hooks/useProfileTags.js` is used to publish a tag-concept
  event, when the event is constructed, then the `z`-tag references
  the deployment's actual TA pubkey — not a hardcoded literal.

- [ ] **AC-4** — Given the client module
  `ui/src/utils/publishTagPin.js` is used to publish a pin event,
  when the event is constructed, then the `z`-tag references the
  deployment's actual TA pubkey — not a hardcoded literal.

- [ ] **AC-5** — Given the codebase is searched for the literal
  string `82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833`
  (or any prefix > 16 chars of it), when the search runs, then no
  hits appear in `src/` or `ui/src/` (test fixtures and the dev
  TA's stored keystore may legitimately contain it; those are out
  of scope).

- [ ] **AC-6** — Given the dev / local deployment whose TA pubkey
  IS the literal, when the migrated code runs, then ALL existing
  functionality (tag publishing, tag index, profile tagging, pin
  publishing, TL refresh, /pins, PinDetail, Brainstorm Search chip
  filter) works identically to before — the runtime lookup happens
  to return the same value that was previously hardcoded, so the
  migration is transparent on this instance.

- [ ] **AC-7** — Given a non-dev deployment (TA pubkey differs from
  the dev literal), when the migrated code runs, then NEW events
  published from that instance carry z-tags referencing the
  instance's actual TA pubkey, and readers on that instance find
  those events correctly. (Tested directly on `tags.brainstorm.world`
  as part of the deploy.)

- [ ] **AC-8** — Given the CLAUDE.md "Known violations" list
  enumerates the four hardcoded sites, when this story ships, then
  the list is emptied (replaced with a sentence confirming the
  invariant is satisfied across the codebase, or the list is
  removed entirely).

- [ ] **AC-9** — Given the existing test gate (`npm test`), when
  the migration is applied, then every previously-passing suite
  continues to pass on the dev instance. The publish-flow tests'
  fixture publishes (which write events to local strfry) MUST use
  the runtime TA pubkey, not a hardcoded literal, to validate the
  end-to-end portability story.

- [ ] **AC-10** — Given the migration ships to
  `tags.brainstorm.world`, when an operator visits `/tags` after
  the deploy, then the page renders the documented data-loss
  empty-state for that instance (no tags found until re-created);
  visiting `/pins` shows the same empty state. The orphan condition
  is acknowledged in advance via a deploy note; it is NOT a
  regression that this story must avoid — it is the contracted
  consequence of correctness.

## Concepts touched

- `39998:<TA>:tag` — every tag-concept event on a non-dev
  deployment is orphaned by the migration.
- `39998:<TA>:nostr-user-tag` — every nostr-user-tag assertion is
  orphaned on a non-dev deployment.
- `39998:<TA>:tag-pinning` — every pin event is orphaned on a
  non-dev deployment.
- `39998:<TA>:web-of-trust` — unaffected; WoT rank lookups use POV
  pubkeys, not the TA pubkey, so no orphaning here.
- **No new concepts.** Pure code refactor + data-loss disclosure.

## Out of scope

- **Migration script that re-signs orphaned events** under the
  correct TA pubkey and re-publishes them. Significantly more
  complex (each orphan must be re-signed with the prod TA's
  private key; the script needs strfry write access; user-facing
  events authored by USERS can't be re-signed by the TA — only
  TA-authored events like kind-30392 TLs and the firmware ConceptHeaders
  could). Deferred until product feedback says historical content on
  some non-dev instance is too valuable to lose.

- **Versioning the migration.** This is a one-shot conversion —
  every site at once. No feature-flag gating, no staged rollout.
  Trying to do half is what produced the d3a2640a incident.

- **Updating the firmware ConceptHeaders** (which are signed by the
  prod TA at first install) — they already reference the correct
  prod TA pubkey because `firmware/install` uses the runtime TA.
  No change needed.

- **A startup check that warns on TA-pubkey resolution failure** —
  `getOwnerAssistantPubkey()` already returns null + logs a warning
  on failure; this story doesn't add a new diagnostic surface.

- **Cross-references to the TA pubkey in tests' hardcoded
  expectations** — test fixtures that compare to the literal value
  are a Tester concern; this story replaces them with runtime
  fetches from `/api/assistant/pubkey` (already the pattern in
  some publish-flow suites).

- **Other hardcoded pubkey literals** beyond the TA — e.g., the
  `DAVE_PUBKEY` cosmetic constant in `ui/src/config/pubkeys.js:6`
  is a NosFabrica-specific affordance, not a TA-pubkey violation;
  it's outside this story.

- **Documentation for non-Brainstorm forks** describing the
  re-creation flow on their deployment — left to whoever forks
  the codebase; not a blocker for this story.

## Open questions

These belong to the Architect to resolve in Phase 2:

- **Threading taPubkey into the Story-1 publishers**
  (`publishProfileTag.js`, `useProfileTags.js`): function argument
  (matches the `publishTagPin.js` pattern from the d3a2640a
  attempt) or read-from-context within the helper module? The
  former requires every caller to pass it; the latter ties the
  helper to React's context (it's used only from React components
  today, but conceptually it's a pure publish helper). — Architect.

- **Module-init vs lazy resolution on the server.** The d3a2640a
  attempt resolved at module init. If the keystore is briefly
  missing at module load (boot ordering on a fresh container), the
  fallback warning fires and the constants freeze on null. Lazy
  resolution per call (with `getOwnerAssistantPubkey()`'s internal
  cache absorbing the cost) is safer but uglier — every reference
  site becomes a function call. — Architect.

- **Deploy choreography.** Should the deploy be timed (e.g.,
  Tuesday off-peak), pre-announced, post-announced? The user-facing
  empty state on `/tags` and `/pins` will be alarming if it
  surprises operators. — Architect to coordinate with whoever owns
  the deploy comms.

- **Test fixture portability.** Some existing publish-flow tests
  build z-tags from a hardcoded literal in their fixtures (e.g.,
  `test/pin-a-tag-publish.test.js`, `test/tag-detail-write-publish.test.js`).
  After this migration the fixtures should fetch
  `/api/assistant/pubkey` once at setup and use the resolved value
  — same pattern Story 13's publish suite already adopted (per
  the bug-fix preamble). The Tester will catch any stragglers. —
  Architect to flag, Tester to enforce.

## Linked artifacts

- **Incident intake:** `engineering-team/stories/_intake.md`
  entry dated 2026-05-20 ("Bug: hardcoded TA pubkey in pinning +
  TL stack breaks every non-local deployment"). Documents the
  original symptom, the failed first-fix attempt (d3a2640a), and
  the revert.
- **Reverted fix:** commit `d3a2640a` (`fix: resolve TA pubkey at
  runtime in Pin/TL stack`) — the partial attempt that broke
  `tags.brainstorm.world`. Lives in history; reverted by
  `4b82a739`. Useful as a reference for the server-side
  conversion shape (the conversion was correct *in direction*;
  this story extends it to the publishers).
- **House rule:** `CLAUDE.md` "Per-deployment TA pubkey — NEVER
  hardcode" subsection. The "Known violations" sub-list inside
  it is the success-criterion checklist for this story.
- **Existing helper (server):** `src/utils/assistantKeys.js:49–82`
  (`getOwnerAssistantPubkey()`).
- **Existing helper (client):** `ui/src/context/ConfigContext.jsx:14–18`
  (`useConfig().taPubkey`, backed by `/api/assistant/pubkey`).
- **Prior stories impacted:** 1, 2, 3, 4, 7, 10, 11, 12 — every
  story whose code path touches one of the four hardcoded sites.
  The migration's correctness must preserve all their tests.
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
