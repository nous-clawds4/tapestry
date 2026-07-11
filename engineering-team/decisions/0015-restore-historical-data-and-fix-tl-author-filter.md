# ADR 0015: Restore historical data visibility while fixing the TL author filter

**Status:** Proposed
**Date:** 2026-05-26
**Story:** `engineering-team/stories/16-runtime-ta-pubkey-migration.md`

## Context

### What the user wants

From the planning conversation on 2026-05-26:

> "i want pins to work (no hardcoded literal pubkey) and for the
> existing tags on tags.brainstorm.world to remain visible. i don't
> care if the tags there refer to a dev key in their tag name, that's
> kind of irrelevant."

Two non-negotiables: **(a) historical user activity on production
must survive the deploy**, and **(b) the "No TL yet" symptom on
production pins must be fixed**. "No hardcoded literal pubkey" was
the user's framing of the bug-as-they-perceived-it (a literal causing
a mismatch); their explicit follow-up ("i don't care if the tags
there refer to a dev key in their tag name") is the actual
acceptance criterion — they're fine with the literal staying in
the wire so long as the symptoms are fixed and nothing is lost.

### What I expected to find on the branch, and what I actually found

The story's redraft assumed the branch was in a clean post-revert
(`4b82a739`) state — the server using the literal everywhere, only
the TL author filter needing to change. **This is not the case.**

A topology check during ADR orientation:

```
* 738158bd  Story 17 commit
* 156bc671  Story 13 review
* cbc2b8f0  Story 13 impl
* a4809d78  Story 13 tests
* bc06404c  Story 16 (queued)
* 10db509e  Story 13 story+adr   ← parent is d3a2640a, NOT 4b82a739
* 4b82a739  revert d3a2640a       ← effectively orphaned on this branch
* d3a2640a  first runtime fix
* …
```

The parent of `10db509e` (`git rev-parse 10db509e^`) is `d3a2640a`,
not `4b82a739`. The Story 13 chain branched off the **broken**
state, bypassing the revert entirely. The revert is recorded in
git history but its effects never propagated into the current
branch's actual file contents.

Consequence: every change `d3a2640a` made is present on this branch
today. Specifically:

- `src/api/profile-tags/index.js:35` —
  `const TA_PUBKEY = getOwnerAssistantPubkey();` (runtime), and the
  three z-tag constants at `:39–41` are derived from it.
- `ui/src/utils/publishTagPin.js:53` — `pinTag({ tag, taPubkey, … })`
  takes a runtime `taPubkey` parameter and uses it to compose the
  z-tag at `:60`: `const tagPinningHandle = \`39998:${taPubkey}:tag-pinning\``.
- `ui/src/utils/publishProfileTag.js:15` — still has the literal
  hardcoded (untouched by `d3a2640a`).
- `ui/src/hooks/useProfileTags.js:5` — still has the literal hardcoded
  (untouched by `d3a2640a`).

On this dev machine the literal happens to equal the on-disk TA
pubkey, so all writers and the server reader use the same value and
the system works. On `tags.brainstorm.world` the literal does not
equal the on-disk TA pubkey, and shipping this branch as-is would
produce a fresh repeat of the d3a2640a incident — with one extra
twist: tags and apply/dispute events written from the client would
also be invisible to the server, because the publishers still write
the literal but the server reader would filter by the runtime.

### What's on production today (best-current-understanding)

`4b82a739` was committed and presumably deployed. If so, production
is on the fully-literal state:

- Server: literal in z-tag derivations AND in the TL author filter.
- All three client publishers: literal in z-tags.
- TL signer: signs with the on-disk private key (the real production
  TA pubkey, NOT the literal).

This produces the symptom the intake captured: pin events are
visible (all the literals match), tags / applies / disputes are
visible (all the literals match), but TL events authored by the
real production TA never match `authors: [literal]` — hence
"No TL yet" forever.

### What the design has to satisfy

To meet (a) and (b) without re-triggering the d3a2640a incident, the
post-fix wire-format invariants are:

- Every kind-39999 event with a `tag` / `nostr-user-tag` / `tag-pinning`
  z-tag, **whether historical on prod or freshly published from any
  client**, must carry the dev literal `82b75e47…` in its z-tag.
  Server `#z` filters must use the same literal.
- The kind-30392 TL event, signed by whichever real TA private key
  is on disk for this deployment, must be found by the server's
  `authors:` filter — so that filter must use the runtime value
  from `getOwnerAssistantPubkey()`.

These two requirements together force the post-fix codebase to
expose **two different "TA pubkey" values** that have always been
the same in this codebase's source but have different semantics:

- A **wire-format literal**, used only in z-tag composition. Same
  on every deployment by accidental but now-load-bearing design.
- A **per-deployment runtime TA pubkey**, used only when reading
  events by signer (and, eventually, when re-parenting concepts in
  a future migration).

The naming difference is the safety latch. Story 13's silent
re-introduction of the broken state happened in part because both
roles were captured by one unmarked variable named `TA_PUBKEY`.
Distinguishing them in source makes the next refactor inspect each
use site instead of search-and-replacing through both.

### Concepts touched

- `39998:<dev-literal>:tag` — the z-tag namespace every historical
  tag-creation event references today. Continues to be the namespace
  new tag-creation events reference after this fix.
- `39998:<dev-literal>:nostr-user-tag` — same pattern for apply/dispute.
- `39998:<dev-literal>:tag-pinning` — same pattern for pin events.
- `kind-30392` Trusted Lists — authored by the deployment's real TA
  pubkey. The fix's `authors:` filter change targets these.
- **No new firmware concepts.** No reinstall.

### Constraints

- **CLAUDE.md POV-first and decentralized-first:** unaffected — this
  fix doesn't touch any POV logic.
- **CLAUDE.md "Per-deployment TA pubkey — NEVER hardcode":** this
  ADR creates one named exception. The legacy literal stays in
  z-tag composition (server-side via a named constant; client-side
  in the existing three publishers' literal hardcodes). Every other
  use of the TA pubkey — signing, author filtering, signer reads —
  must continue to use the runtime helper. The exception is
  load-bearing for not losing historical user activity. CLAUDE.md
  gains a one-paragraph note acknowledging this.
- **No new lint/typecheck/build tooling.**
- **No new TA pubkey literals beyond the one named constant.** The
  existing literals in `useProfileTags.js` and `publishProfileTag.js`
  stay where they are (this story doesn't touch them); the
  `publishTagPin.js` revert restores its prior literal. **Net new
  literals: zero in the client; one named constant on the server.**

## Options considered

### Option A — Revert + author-filter fix (minimal divergence from prod)

Three coordinated edits:

1. **Server** (`src/api/profile-tags/index.js`):
   - Introduce
     `const LEGACY_Z_TAG_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833'`
     at module top, with an explanatory comment block citing this
     ADR + the d3a2640a/4b82a739 incident.
   - Rewrite the three z-tag constants to derive from
     `LEGACY_Z_TAG_PUBKEY` instead of the runtime `TA_PUBKEY`.
   - Keep
     `const TA_PUBKEY = getOwnerAssistantPubkey()` in place — its
     only consumer post-fix is the `authors:` filter at
     `:1394` (and, transitively, `refreshPinnedTags.js:244` via the
     module export).
   - Update the inline comment above the `TA_PUBKEY` constant: it
     no longer documents "the constant used everywhere"; it now
     documents "the constant used for kind-30392 author filtering;
     for z-tag composition see LEGACY_Z_TAG_PUBKEY."

2. **Client pin publisher** (`ui/src/utils/publishTagPin.js`):
   - Revert to a literal-based z-tag composition, matching the
     post-`4b82a739` state. Remove the `taPubkey` parameter from
     `pinTag()`'s signature.
   - The literal lives at module top:
     `const LEGACY_TA_PUBKEY = '82b75e47…'` with a brief comment
     pointing at this ADR. Same pattern as the two sibling client
     files (`publishProfileTag.js`, `useProfileTags.js`).
   - **Preserve Story 17's `defaultCurationMethod` changes**
     (`cutoff: 1`, `includeScoreInTL: true`) — they're orthogonal
     to this fix.

3. **Pin callers** (`ui/src/pages/Tag.jsx`, `ui/src/pages/Pins.jsx`):
   - Drop the `taPubkey` argument from their `pinTag(...)` calls.
     Three call sites total.
   - Remove the now-unused `const { taPubkey } = useConfig()`
     destructure where it's no longer referenced. Leave it in place
     where it is still used for other purposes (in `Tag.jsx` and
     `Pins.jsx` the destructure may have other consumers — verify).

4. **Tests:** Story 17's tests for `publishTagPin.js` (AC-19, AC-21,
   R-3) assert behavior orthogonal to the publisher signature
   change and continue to pass. A new test under this ADR asserts:
   - `publishTagPin.js`'s z-tag composition uses the literal (regex
     check on source).
   - `pinTag` does not accept a `taPubkey` parameter (signature
     check).
   - Server-side: `enrichRowsWithTLStatus` and `retractStaleTLs`
     pass the runtime value to their `authors:` filters (regex
     check on source).

**Pros:** smallest net behavior change vs production; preserves all
historical user activity by construction; fixes the "No TL yet"
symptom; the named-constant safety latch prevents the next
search-and-replace from silently merging the two roles back together.

**Cons:** keeps a hardcoded literal in four source files (one
server + three client publishers) as named, documented legacy
debt. The "wire format is bound to a single literal forever" status
quo becomes explicit in the source instead of accidental — that's
a real trade. A future re-parenting effort (moving tag /
nostr-user-tag / tag-pinning concept handles under a non-literal
pubkey) is the natural follow-on; not this story.

### Option B — Read-side compat shim (accept both legacy and runtime z-tags)

Server's z-tag filters become `'#z': [legacyZTag, runtimeZTag]` —
matching events with either the literal or the runtime z-tag.
Client publishers all switch to runtime (so new events go on the
wire under the runtime z-tag). Historical events with the literal
z-tag remain visible because the filter accepts both. After enough
time (months), drop the legacy half of the filter.

**Pros:** lets the client wire move forward to runtime; offers a
deliberate retirement path for the legacy literal in the wire.

**Cons:** doubles the server filter on every read path that touches
the three z-tag constants — and there are many such paths
(`handleAvailableTags`, `handleMatch`, `aggregateProfilesTagged`,
`enumeratePinnedTags`, etc.). Every filter has to be audited and
extended. The retirement decision is a future load-bearing call
the team has to remember to make. And the test fixtures'
hardcoded `TA_PUBKEY = '82b75e47…'` literal at the top of every
publish-suite file would have to be updated to runtime — a wider
refactor.

This is closer to the original (now-superseded) Story 16 brief.

### Option C — Full re-parenting migration

Define new firmware concepts (`tag-v2`, `nostr-user-tag-v2`,
`tag-pinning-v2`) under a non-literal parent pubkey. Migrate
historical events forward by re-publishing them under the new
concept handles (where the original author's signature can be
preserved by, e.g., reusing the original event id and re-tagging
externally). Switch the codebase to read/write only the v2
namespaces.

**Pros:** finally retires the literal entirely.

**Cons:** substantially larger story than what the user asked for.
The user explicitly punted this: "one day we can migrate taggings
to a different parent or something." Not this story.

## Decision

We chose **Option A**.

The decision drivers:

1. **The user explicitly accepted the literal in the wire** ("i
   don't care if the tags there refer to a dev key in their tag
   name"). The cleanest design under that acceptance is to make
   the literal a named, documented exception rather than try to
   work around it.
2. **Minimum divergence from production.** Option A's diff against
   `4b82a739` (the last state presumed-deployed) is just ONE line:
   the `authors:` filter on line `:1394`. Everything else on this
   branch that diverged from prod was introduced via the d3a2640a
   chain and is being undone. That's the smallest possible
   change-shape for a production deploy, which is exactly what
   the user said matters: "i'm worried about the deploy."
3. **The named constant is the load-bearing safety device.** Story
   13 silently re-broke the codebase because `TA_PUBKEY` carried
   two roles in one name and a refactor merged them. Naming each
   role distinctly (`LEGACY_Z_TAG_PUBKEY` for wire composition;
   `TA_PUBKEY` for author filtering) makes the next refactor
   notice — or fail explicitly — instead of silently mixing them.
4. **Option B's surface area is wrong for this moment.** A
   dual-read shim across every z-tag filter is a meaningful piece
   of infrastructure, and the user's goal right now is "ship pins
   to production safely," not "retire the literal from the wire."
   Option B can come later as its own story when there's appetite
   for the retirement project.
5. **Option C is YAGNI right now.** When the team is ready to
   re-parent, that's its own epic — Story 16 is not the place
   for it.

### Implementation shape

Files to modify:

- **`src/api/profile-tags/index.js`**
  - **New** module-level constant `LEGACY_Z_TAG_PUBKEY` with an
    explanatory block above its declaration:
    ```js
    /**
     * Legacy z-tag-composition pubkey.
     *
     * Historical kind-39999 events on every Brainstorm/Tapestry
     * deployment have z-tags composed with this literal value,
     * including events that pre-date any deployment realizing the
     * literal didn't match the on-disk TA. The literal is wire-
     * binding: changing it orphans historical data.
     *
     * This constant is used ONLY for z-tag composition. For any
     * other use of "the TA pubkey" (signer reads, kind-30392
     * author filtering, signing operations), use the runtime
     * `TA_PUBKEY` constant below — it resolves via
     * `getOwnerAssistantPubkey()` per CLAUDE.md "Per-deployment
     * TA pubkey".
     *
     * See ADR 0015 and engineering-team/stories/16-* for the
     * incident history that produced this exception.
     */
    const LEGACY_Z_TAG_PUBKEY =
      '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
    ```
  - **Modified** z-tag constants:
    ```js
    const TAG_Z_TAG          = `39998:${LEGACY_Z_TAG_PUBKEY}:tag`;
    const NOSTR_USER_TAG_Z_TAG = `39998:${LEGACY_Z_TAG_PUBKEY}:nostr-user-tag`;
    const TAG_PINNING_Z_TAG  = `39998:${LEGACY_Z_TAG_PUBKEY}:tag-pinning`;
    ```
  - **Kept** runtime `TA_PUBKEY`:
    ```js
    const TA_PUBKEY = getOwnerAssistantPubkey();
    ```
    with the existing null-check warning preserved. The inline
    comment above it gets a brief revision pointing to
    `LEGACY_Z_TAG_PUBKEY` for the wire-composition role.
  - **No change** to the `authors: [TA_PUBKEY]` filter inside
    `enrichRowsWithTLStatus` — it's already using the runtime
    value (which is what we want).
  - The exported `TA_PUBKEY` (at `:1460`) stays as the runtime
    value — `refreshPinnedTags.js` imports it for the
    `retractStaleTLs` author filter and that path is already
    correct.

- **`ui/src/utils/publishTagPin.js`**
  - **New** module-level constants matching the pattern used by
    the two sibling client files:
    ```js
    /**
     * Legacy z-tag-composition pubkey. See ADR 0015 / Story 16.
     * Used for wire-format compatibility with historical pin
     * events; NOT to be confused with the runtime TA pubkey
     * (which would correctly resolve via useConfig().taPubkey
     * but, by deliberate design, is NOT used in z-tag
     * composition for the tag-pinning namespace).
     */
    const LEGACY_TA_PUBKEY =
      '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
    const TAG_PINNING_HANDLE = `39998:${LEGACY_TA_PUBKEY}:tag-pinning`;
    ```
    (Naming is `LEGACY_TA_PUBKEY` here, not `LEGACY_Z_TAG_PUBKEY`,
    to match the existing client-side convention of just having a
    `TA_PUBKEY` constant per file. The `LEGACY_` prefix is the
    safety latch; this file scopes its own.)
  - **Modified** `pinTag()` signature: remove the `taPubkey`
    parameter. The validation block at `:57–59` is removed too.
  - **Modified** z-tag composition at `:60`: use the module-level
    `TAG_PINNING_HANDLE` constant instead of the
    string-interpolated `\`39998:${taPubkey}:tag-pinning\``.
  - **Preserved** Story 17's `defaultCurationMethod` body
    (`cutoff: 1`, `includeScoreInTL: true`) — this ADR does not
    revert that.
  - **Updated** the JSDoc above `pinTag` to drop the `taPubkey`
    parameter description and the leading "IMPORTANT: the TA
    pubkey is PER-DEPLOYMENT" block (it's no longer accurate; the
    pin publisher uses the legacy literal by design).

- **`ui/src/pages/Tag.jsx`**
  - Drop the `taPubkey` argument from the `pinTag(...)` call at
    `:75`. The call becomes
    `await pinTag({ tag, curationMethod: customCuration })`.
  - Audit whether `taPubkey` from `useConfig()` is still used
    elsewhere in the file. If not, remove from the destructure
    at `:42`. (Quick check: the destructure currently reads
    `const { taPubkey } = useConfig()`; if the only use was the
    `pinTag` argument, remove. The Implementer verifies with a
    `grep taPubkey ui/src/pages/Tag.jsx` after the edit.)

- **`ui/src/pages/Pins.jsx`**
  - Drop the `taPubkey` argument from the `pinTag(...)` call at
    `:88` (Story-12 Edit-from-/pins path).
  - Same `useConfig().taPubkey` audit. If unused after the edit,
    remove from the destructure at `:79`.

Files explicitly **NOT** modified:

- `ui/src/hooks/useProfileTags.js` — already uses the literal for
  tag creation; matches historical wire and the server's
  `TAG_Z_TAG` filter post-fix. No change.
- `ui/src/utils/publishProfileTag.js` — already uses the literal
  for apply/dispute; matches historical wire and
  `NOSTR_USER_TAG_Z_TAG` post-fix. No change.
- `src/api/trustedList/refreshPinnedTags.js` — its
  `const TA_PUBKEY = profileTags.TA_PUBKEY` import already
  resolves to the runtime value (the server module exports
  runtime). The `authors: [TA_PUBKEY]` filter at `:244` is
  correctly using runtime. No change.
- The publish-suite test fixtures with hardcoded
  `TA_PUBKEY = '82b75e47…'` literals at module top
  (`test/customize-pin-curation-publish.test.js:35` etc.) — they
  continue to function on the dev machine because the literal
  equals the runtime TA pubkey. Out of scope per Story 16.

### Documentation

A one-paragraph addition to `CLAUDE.md`'s "Per-deployment TA pubkey
— NEVER hardcode" subsection acknowledging the named exception.
Sketch:

> **Named exception (ADR 0015):** the z-tag composition for the
> `tag`, `nostr-user-tag`, and `tag-pinning` concept handles is
> intentionally bound to a literal pubkey (`LEGACY_Z_TAG_PUBKEY`
> in the server, `LEGACY_TA_PUBKEY` in
> `ui/src/utils/publishTagPin.js`, plus the existing literal
> hardcodes in `ui/src/hooks/useProfileTags.js` and
> `ui/src/utils/publishProfileTag.js`). This preserves visibility
> of historical user activity across non-dev deployments. Every
> OTHER use of the TA pubkey — author filtering, signer reads,
> signing operations — must use the runtime helper. Future
> re-parenting of these concepts under a non-literal pubkey is a
> separate migration (out of Story 16).

### Open questions resolved

- **Naming the legacy constant** — `LEGACY_Z_TAG_PUBKEY` on the
  server (the server uses it for three different z-tags);
  `LEGACY_TA_PUBKEY` in `publishTagPin.js` (per-file scope,
  matches the existing single-constant idiom in the two sibling
  client files). The `LEGACY_` prefix is the load-bearing part;
  the suffix is style.
- **Whether `module.exports.TA_PUBKEY` continues to export the
  runtime value** — yes. Its only consumer
  (`refreshPinnedTags.js`) uses it for author filtering, which
  is the runtime-correct role. The exported name stays
  `TA_PUBKEY`; importers see the runtime value.
- **Whether to update CLAUDE.md** — yes, one paragraph in the
  same commit as the source changes.

## Consequences

**What this enables:**

- The pin-a-tag epic can be promoted to production without losing
  historical user activity. Every existing tag, apply/dispute, and
  pin event on `tags.brainstorm.world` remains visible to all read
  endpoints after the deploy.
- The "No TL yet" symptom on production pins is resolved. TL events
  authored by the real production TA are found by the (now
  runtime-correct) author filter.

**What this constrains or makes harder:**

- The codebase carries a documented, named exception to the
  "never hardcode the TA pubkey" rule. Future developers will see
  `LEGACY_Z_TAG_PUBKEY` / `LEGACY_TA_PUBKEY` in source and may be
  tempted to "clean it up" — the comment block and ADR reference
  are the load-bearing guard against that mistake. A reviewer
  who sees a diff removing those constants without an
  accompanying re-parenting migration MUST reject.
- The wire format is bound to the dev literal forever (until a
  future re-parenting story retires it). Forks running with a
  truly different TA setup will inherit the literal in their wire
  too. This is the user's explicit acceptance.

**New debt / follow-ups:**

- A future story to re-parent the three concept handles
  (`tag`, `nostr-user-tag`, `tag-pinning`) under a non-literal
  pubkey, with a migration of historical events under the new
  parents. Larger than Story 16; not pressing.
- The four existing client-side / server-side `LEGACY_*` literals
  share a value but live in four files. If a future deployment
  wants to fork the literal (very unlikely), it's a four-file
  change. Acceptable; consolidating into one shared module is a
  refactor outside this story's scope.
- The publish-suite test fixtures with their own hardcoded
  `TA_PUBKEY` literals continue to work on dev only. If a future
  CI matrix runs them against a non-dev deployment, those
  fixtures need to fetch the runtime TA the same way Story 13's
  publish suite does. Tracked in the "out of scope" of Story 16.

**Firmware reinstall required?** **No.** No concept schema changes;
no new concepts. The `tag-pinning` concept's wire shape is
unchanged.

## Eventual full retirement (future epic, not this story)

Option A leaves a hardcoded literal in four files as named,
documented legacy debt. To eventually retire it — get rid of every
trace, including the `LEGACY_*` constants and the wire-format
binding to the dev pubkey — requires a multi-story epic. Sketching
the path here so the next reader sees the whole arc, not just the
end of this story.

The retirement is **not** a one-shot edit. User-authored nostr
events (kind-39999 tag-creation, apply/dispute, pin events) are
signed by their original authors with the dev literal embedded in
the `z` tag. Re-publishing those events under a new z-tag would
change the event id and break the signature. The team can't
unilaterally migrate the wire of signed user content; only the
readers can shift over time, and only with the publishers shifting
in parallel.

### The retirement sequence (one possible shape)

1. **Define v2 concept handles** under the runtime TA pubkey:
   - `39998:<runtime-TA>:tag-v2`
   - `39998:<runtime-TA>:nostr-user-tag-v2`
   - `39998:<runtime-TA>:tag-pinning-v2`

   These are real, deployment-specific firmware concepts. Each
   deployment publishes its own copies of the v2 ConceptHeaders
   under its real TA pubkey (the publisher is the on-disk TA
   private key, so this works correctly per-deployment by
   construction). Firmware reinstall required.

2. **Client publishers gain a v2 mode.** Each of the three
   client publishers
   (`useProfileTags.js`, `publishProfileTag.js`,
   `publishTagPin.js`) gets a version that composes z-tags
   using `useConfig().taPubkey` + the `-v2` suffix. The legacy
   path stays in place during the transition.

3. **Server reader implements Option B's dual-read shim** across
   every filter that touches the three z-tag namespaces:
   - `'#z': [legacyZTag]` becomes
     `'#z': [legacyZTag, runtimeV2ZTag]`
   - Audit list (non-exhaustive):
     `handleAvailableTags`, `handleMatch`, `handleTagsForProfile`,
     `handleWotTags`, `handleAuthoredBy`, `handleTagIndex`,
     `handleProfilesTagged`, `aggregateProfilesTagged`,
     `aggregateTagPins`, `handlePins`, `enumeratePinnedTags`,
     `enrichRowsWithTLStatus`, plus `computeTagMatches` and any
     others surfaced during the audit pass.
   - Both event populations (v1-historical and v2-newly-published)
     stay visible side by side.

4. **Per-tag a/e references continue to reach the right events.**
   Tag-creation events under v2 produce a `39999:<runtime-TA>:<slug>`
   addressable coordinate; assertions / pins reference that
   coordinate via `e` / `a`. The Neo4j REFERENCES wiring stays
   correct because it's per-event, not per-z-tag.

5. **Switch the default publisher mode to v2.** All new events
   from this point on go on the wire under v2 z-tags. The legacy
   path is still present in source but is no longer exercised
   for new writes.

6. **Wait.** Months. The team monitors v1-z-tagged traffic
   organically dropping off as users retag / reapply / repin
   content they care about. The dual-read shim continues to
   surface v1 events for anyone who hasn't taken action.

7. **(Optional) Bulk-prompt users to migrate their own content.**
   A `/migrate-my-tags` style affordance that walks a logged-in
   user through re-publishing their own v1 assertions as v2
   assertions. This is the only way to preserve specific
   user-authored events under the v2 namespace, because only the
   original author can re-sign. UX-heavy; the team may decide it
   isn't worth the effort for low-volume historical content.

8. **Drop the dual-read shim.** When v1 traffic is judged
   negligible (the team's call, with data from a v1-vs-v2
   counter over the read endpoints), the server's `'#z':`
   filters drop the legacy half. Historical v1-z-tagged events
   become invisible. This is the moment the team formally
   accepts the data loss the user worried about during Story 16's
   planning — but at that point only events the team has watched
   decline to irrelevance.

9. **Remove the legacy publisher paths.** Each of the three
   client publishers drops its v1 code branch and its
   `LEGACY_*` literal constant. Source diff is mechanical.

10. **Remove `LEGACY_Z_TAG_PUBKEY` from the server.** The three
    z-tag constants now derive solely from the runtime TA. The
    CLAUDE.md "Named exception (ADR 0015)" paragraph is
    removed. The `LEGACY_*` constants disappear from the
    codebase.

11. **Firmware archive v1 concept handles.** The v1
    `tag` / `nostr-user-tag` / `tag-pinning` ConceptHeaders
    under the dev literal can be retired from the manifest, or
    moved to an `archived/` subdirectory of firmware. The
    Neo4j re-derivation passes stop touching them.

### What this means in story terms

The retirement is an **epic** — likely 4–6 stories at the
strictness this project uses:

- Story: define v2 concept handles + firmware reinstall.
- Story: dual-read shim on the server (Option B from this ADR).
- Story: client publishers write v2 by default; v1 path
  preserved.
- Story (optional, UX-heavy): per-user migration affordance.
- Story: drop the dual-read shim + the `LEGACY_*` constants
  after the agreed waiting period.
- Story: documentation cleanup — remove the exception paragraph
  from CLAUDE.md, update AGENTS.md, update this ADR's status to
  Superseded with a pointer to the retirement epic.

### When to start

Not before the pin-a-tag epic is shipped to production and
stable. The retirement epic depends on the dual-read
infrastructure (large server-side audit) and on appetite for a
multi-month parallel-wire period. Both are real costs that need
product-side justification — most plausibly: a fork that wants
to operate cleanly under a non-dev TA pubkey, or a privacy /
provenance change to the concept-handle scheme that's
incompatible with the legacy literal.

Until then, the `LEGACY_*` exception is **the right state**. It
preserves historical user activity, fixes the production
symptom, and binds the wire format to a clearly-named exception
that a reviewer will reject any unannounced removal of.

## Out of scope

- **Migrating historical events** to a new parent or new TA pubkey
  via re-signing or re-publishing. Future migration; explicitly
  punted by the user.
- **Removing the literal from `useProfileTags.js` or
  `publishProfileTag.js`.** Those files are already in the right
  state (literal in z-tags) and untouched by this fix.
- **Updating the publish-suite test fixtures' hardcoded
  literals.** Per Story 16.
- **A dual-read shim (Option B's approach).** Future story when
  the team is ready to retire the literal from the wire.
- **CI / Playwright / e2e changes.** Not required.
- **A redesign of the per-file legacy constant naming.** One
  constant per file matches the existing single-`TA_PUBKEY` idiom
  in the other client publishers; consolidation into a shared
  module is a separate refactor.
