# Story 16: Surgical fix — restore historical data visibility while making pin TLs work

**Status:** Approved (redrafted 2026-05-26 — was originally a sweeping migration; rescoped after the d3a2640a incident plus a session-time discovery that Story 13 silently re-introduced part of the broken state)
**Created:** 2026-05-20
**Redrafted:** 2026-05-26
**Type:** Bug (surgical, server-side only)

> **Queue position:** Last story before the pin-a-tag epic's production
> deploy. Sequence: Story 17 (shipped) → **Story 16 (this story)** →
> final deploy chain.
>
> Story 14 (Treasure Map) and Story 15 (Encryption) remain paused.

## Background

### What the symptom is

On `tags.brainstorm.world`, pinned tags show "No TL yet" / "TL
unavailable" even after a manual refresh, despite the tag's
profile-tag activity meeting the pin's cutoff. The TL refresh cron
runs, generates a kind-30392, signs it with the on-disk TA private
key, publishes it to local strfry. The reader then asks strfry "give
me kind-30392 events authored by `<the hardcoded dev literal>`" and
finds nothing — because the events are authored by the real
production TA, not the literal. Result: TLs are invisible to their
own readers.

### What's currently in the branch (and why this matters)

The original Story 16 brief was to convert *all* hardcoded literal
references to runtime lookup across the four sites listed in the
incident intake. That was a wide, risky migration that — by design
in the original draft — accepted the orphaning of every historical
tag, apply/dispute, and pin event on every non-dev deployment.

A session-time audit on 2026-05-26 surfaced that the situation is
not what the original brief assumed. The relevant history:

| Commit | Effect |
|---|---|
| `d3a2640a` | Original "fix" — server-side switched to runtime; pushed to prod; orphaned every event on `tags.brainstorm.world`. |
| `4b82a739` | Revert. Server restored the literal. Tags visible again. |
| `cbc2b8f0` ("impl: most-pinned-tag-index") | **Silently re-introduced the runtime lookup** at `src/api/profile-tags/index.js:35`. |
| `738158bd` (Story 17) | Did not touch this. |

So the current branch state is: **server-side z-tag derivations
already use runtime lookup; client publishers still use the
literal**. On this dev machine the literal happens to equal the
runtime TA, so the mismatch is invisible. On every other deployment
(`tags.brainstorm.world` first and foremost) the mismatch is the
same shape as d3a2640a. Shipping this branch as-is would repeat the
d3a2640a incident.

### What the user actually wants

Captured in conversation 2026-05-26:

> "yes, i want pins to work (no hardcoded literal pubkey) and for
> the existing tags on tags.brainstorm.world to remain visible. i
> don't care if the tags there refer to a dev key in their tag
> name, that's kind of irrelevant. one day we can migrate
> taggings to a different parent or something. i just need
> existing user activity to remain intact AND for pins to work
> on tags.brainstorm.world (no 'TL unavailable' error)"

Two non-negotiable goals:

1. **No data loss.** Historical tag, apply, dispute, and pin
   events on `tags.brainstorm.world` (and any other non-dev
   deployment) MUST remain visible to all read endpoints after
   the deploy.
2. **Pins must work.** The "No TL yet" / "TL unavailable" symptom
   on production pins MUST be resolved — readers must find the
   TLs the cron signs.

The decision: **keep the literal in the wire** (z-tags) where it
sits today across both historical data and live client publishers,
and **change only the parts of the server that read TLs by
author**. Everything else stays bit-for-bit compatible with what
both this dev and `tags.brainstorm.world` already have on disk.

The user explicitly acknowledged that historical events on prod
referencing the dev literal in their z-tags is fine for now: "i
don't care if the tags there refer to a dev key in their tag
name, that's kind of irrelevant. one day we can migrate taggings
to a different parent or something." Re-parenting historical
events under a new concept handle is a future migration; not in
this story.

## User-facing description

As an operator of `tags.brainstorm.world` (and any other Brainstorm
deployment whose on-disk TA pubkey differs from the dev literal), I
want pinned-tag Trusted Lists to be discoverable by my instance's
own read endpoints, AND I want every historical tag, apply, dispute,
and pin event on my deployment to remain visible after this fix
ships, so that the pin-a-tag epic can be promoted to production
without losing accumulated user activity.

## Acceptance criteria

- [ ] **AC-1** — Given a deployment whose on-disk TA pubkey is the
  dev literal (the local dev machine), when the fix is applied and
  the server reloads, then EVERY tag, apply/dispute, and pin event
  that was visible before the fix remains visible after the fix —
  i.e., the test suite's existing pass count under the previously
  shipped Story 17 state continues to pass on this dev machine.

- [ ] **AC-2** — Given a deployment whose on-disk TA pubkey is
  NOT the dev literal (`tags.brainstorm.world`), when the fix
  ships there, then EVERY tag, apply/dispute, and pin event that
  was visible BEFORE the deploy remains visible AFTER. Verified
  post-deploy by walking the `/tags` page, opening a representative
  tag-detail page, opening `/pins`, and confirming previously-
  present rows are still present.

- [ ] **AC-3** — Given a deployment whose on-disk TA pubkey is
  NOT the dev literal (`tags.brainstorm.world`), when a user with
  a pinned tag visits `/pins` after the fix ships, then the
  pin's row reflects an `ok`/`never`/`retracted` status that
  reflects the **actually-published** kind-30392 events the cron
  produced (not a perpetual "No TL yet"). After a manual `Refresh
  now`, the row's status updates to `ok` with the correct member
  count within ~10 seconds, matching the existing Story-11
  behavior.

- [ ] **AC-4** — Given the post-fix source of
  `src/api/profile-tags/index.js`, when a grep is performed for
  any `authors: [...]` filter referencing kind-30392 events, then
  the pubkey passed is the **runtime-resolved** TA, not a literal.

- [ ] **AC-5** — Given the post-fix source of
  `src/api/profile-tags/index.js` and
  `src/api/trustedList/refreshPinnedTags.js`, when a grep is
  performed for the z-tag-derivation constants (`TAG_Z_TAG`,
  `NOSTR_USER_TAG_Z_TAG`, `TAG_PINNING_Z_TAG`), then their pubkey
  segment is a **hardcoded literal** (not a runtime call). The
  literal lives at exactly ONE source location per file (a
  module-level constant) and is named in a way that flags it as
  intentional legacy — e.g. `LEGACY_Z_TAG_PUBKEY`. A 2–4 line
  comment block at the literal's declaration explains why the
  literal is intentional and points at this story file plus the
  d3a2640a incident.

- [ ] **AC-6** — Given the client publish helpers
  (`ui/src/utils/publishProfileTag.js`,
  `ui/src/hooks/useProfileTags.js`,
  `ui/src/utils/publishTagPin.js`), when a diff is taken against
  the pre-fix state, then NONE of them have been modified. The
  client wire format is unchanged; new client-published events
  carry the literal in their z-tags exactly as they did before
  this story.

- [ ] **AC-7** — Given the existing test suite (`npm test`), when
  it runs after the fix, then EVERY previously-passing test still
  passes. The dev machine masks the bug (literal == runtime), so
  no test regresses on dev. (Tests that REQUIRE non-dev semantics
  to demonstrate the bug live in this story's new test suite.)

- [ ] **AC-8** — Given a new test fixture that simulates the
  non-dev case (TL events authored by a fixture TA pubkey whose
  value is NOT the literal), when the test runs against the
  post-fix server, then the TL-status enrichment correctly
  identifies the fixture TL by its real signing pubkey. The
  fixture's intent is to lock down the runtime-author-filter
  behavior on this dev machine without requiring access to
  `tags.brainstorm.world`.

## Concepts touched

- `39998:<dev-literal>:tag` — the z-tag namespace that historical
  tag events on every deployment reference today. Continues to be
  what new client-published tag events reference after this story
  (no change to clients).
- `39998:<dev-literal>:nostr-user-tag` — same pattern for
  apply/dispute events.
- `39998:<dev-literal>:tag-pinning` — same pattern for pin events.
- `kind-30392` (NIP-85 Trusted Lists) — events authored by the
  deployment's REAL TA pubkey. The runtime-author-filter change
  in this story is exclusively about finding these.
- **No new firmware concepts.** No reinstall.

## Out of scope

- **Migrating client publishers to runtime TA.** Explicit user
  decision (2026-05-26): leave the client wire alone. New events
  continue to carry the literal in z-tags. A future story may
  rebase the entire codebase off the literal as part of a
  re-parenting / concept-migration effort; not now.
- **Migrating historical events** by re-signing under a new TA
  pubkey or under a new concept parent. Future migration; the
  user explicitly punted this ("one day we can migrate taggings
  to a different parent or something").
- **Removing every hardcoded literal from the codebase.** The
  original Story 16 brief targeted four sites; this redraft
  shrinks scope to only the parts that block AC-2 + AC-3. The
  client publishers keep their literal.
- **Documentation updates beyond this story file + the new
  literal's comment.** CLAUDE.md's "Known violations" subsection
  may need an update to acknowledge the literal is now an
  intentional debt rather than a bug; that's a one-line edit, but
  belongs in this story's commit, not a separate one.
- **Restarting / deploying the local dev stack as part of the
  fix.** The Implementer cycles local; the operator promotes
  staging/prod themselves.
- **Touching any of the publish-suite test files that
  hardcode `TA_PUBKEY = '82b75e47…'` literals at their module
  top.** Those are pre-existing test fixtures whose dev-machine
  semantics work because literal == runtime; out of this story's
  scope.

## Implementation sketch (for the Architect / Implementer)

The fix is two files:

- `src/api/profile-tags/index.js`:
  - Introduce a new module-level constant
    `LEGACY_Z_TAG_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833'`
    with an explanatory comment block (per AC-5).
  - Rewrite the three z-tag constants:
    `TAG_Z_TAG = '39998:' + LEGACY_Z_TAG_PUBKEY + ':tag'`, and
    likewise for the other two.
  - Replace the literal in the `authors:` filter at line ~1394
    (inside `enrichRowsWithTLStatus`) with the runtime
    `getOwnerAssistantPubkey()` call. The current
    `const TA_PUBKEY = getOwnerAssistantPubkey()` at line 35
    stays; we just stop using it for z-tag derivation.
  - Keep the existing `module.exports.TA_PUBKEY` so
    `refreshPinnedTags.js`'s import (which uses it for the
    `retractStaleTLs` `authors:` filter) keeps working
    unchanged. (`profileTags.TA_PUBKEY` continues to point at
    the runtime value.)

- `src/api/trustedList/refreshPinnedTags.js`:
  - No code change needed if the consumed `profileTags.TA_PUBKEY`
    is the runtime value (it already is post-cbc2b8f0). The line
    244 author filter then transparently uses the runtime TA via
    the existing import.
  - But the test suite should still verify the post-fix author
    filter passes the runtime value (AC-4).

The naming change (`LEGACY_Z_TAG_PUBKEY`) is the safety latch
against the next refactor silently merging the two concepts back
together — same way d3a2640a slipped back in via cbc2b8f0. The
comment block at the declaration is the canonical place for any
future developer to read "why does this look weird" before they
"clean it up."

## Open questions

These belong to the Architect to resolve in Phase 2 (Architecture
is still light per Bug-class Standard rules, but the d3a2640a
history justifies a brief ADR):

- **Exact naming of the legacy constant.** `LEGACY_Z_TAG_PUBKEY`
  vs `Z_TAG_AUTHOR_LITERAL` vs `INSTANCE_LITERAL_PUBKEY` — pick
  the one that's hardest to misread.

- **Whether `module.exports.TA_PUBKEY` continues to export the
  runtime value** (current state on this branch via cbc2b8f0) or
  is renamed for clarity. If kept named `TA_PUBKEY`, the
  Implementer should NOT also export `LEGACY_Z_TAG_PUBKEY` —
  forcing every importer to either use the runtime or accept
  that they want the literal explicitly, the latter forces a
  comment justifying it.

- **Whether to update CLAUDE.md's "Per-deployment TA pubkey"
  subsection** to mention that z-tag derivations are an
  intentional accepted-debt exception, with cross-reference to
  this story. Likely yes; one sentence.

## Linked artifacts

- **Incident intake:** `engineering-team/stories/_intake.md`
  entry dated 2026-05-20 ("Bug: hardcoded TA pubkey in pinning +
  TL stack breaks every non-local deployment").
- **Reverted first attempt:** `d3a2640a`. Useful as the
  cautionary tale.
- **Silent re-introduction:** `cbc2b8f0`. The single change that
  brought the branch back into the broken state without anyone
  noticing.
- **Original story draft:** preserved in git history at
  `bc06404c`. Useful as the "what we used to think the right
  scope was" reference.
- **House rule:** `CLAUDE.md` "Per-deployment TA pubkey — NEVER
  hardcode" subsection. This story is the single named exception:
  the legacy literal stays in z-tag derivations because
  historical data binds us. The rule still applies to every
  OTHER use of the TA pubkey (author filters, signer reads,
  signing operations, etc.).
- **Existing helpers:**
  - Server: `src/utils/assistantKeys.js:49–82`
    (`getOwnerAssistantPubkey()`).
  - Client: `ui/src/context/ConfigContext.jsx:9–35`
    (`useConfig().taPubkey`).
- **Prior stories impacted:**
  - Story 11 (TL publication) — `refreshPinnedTags.js`'s author
    filter starts being correct on non-dev.
  - Story 13 (most-pinned-tag-index) — the commit that silently
    re-broke the runtime-vs-literal balance. Story 13's behavior
    itself is unaffected by this fix; only the underlying
    constants change shape.
- **Successor:**
  - The pin-a-tag epic's final deploy chain to staging and prod.
    Stories 14/15 remain paused; this is the last gate before
    promoting the pin epic to production.
- ADR: `engineering-team/decisions/0015-restore-historical-data-and-fix-tl-author-filter.md`
- Test plan: `engineering-team/stories/16-runtime-ta-pubkey-migration.test-plan.md`
- Review: `engineering-team/reviews/16-restore-historical-data-and-fix-tl-author-filter.md`
