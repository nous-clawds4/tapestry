# Test Plan: Story 2 — Pin-stack integration (contextual pins × TL membership methods)

**Story:** `engineering-team/stories/feat-tags-modernization/2-pin-stack-integration.md`
**ADR:** `engineering-team/decisions/feat-tags-modernization/0001-pin-stack-composition.md` (Accepted)
**Date:** 2026-09-17
**Worktree / branch:** `/home/vcavallo/src/tapestry-tags` @ `integrate/staging-into-tags-2026-09`, commit `9356226e`

## The situation: most of the failing tests already existed

The step-1 bulk merge left ten red assertions that ARE this story's acceptance list (AC-1, AC-2,
and the pinning half of AC-7). They are **not rewritten** by this phase — they stay exactly as the
merge found them and go green at implementation. This plan's new work is the **delta**: one new
suite, `test/pin-stack-composition.test.js`, covering what those suites do not (the published
context `z`, neutral byte-identity, client/server parity, the ADR flip, the ordering rule, the two
interim hazards, and the AC-7 server-recompute switch).

**Pre-implementation counts (measured, this commit):**

| Suite | Pre-impl | Target at implementation |
|---|---|---|
| `test/context-scoped-pins.test.js` | **23 pass / 9 fail** | 32 / 0 (AC-1) |
| `test/restore-historical-data-and-fix-tl-author-filter.test.js` | **21 pass / 1 fail** | 22 / 0 (AC-2) — see carve-out R1 below |
| `test/pin-stack-composition.test.js` *(new)* | **2 pass / 18 fail / 0 skipped** | 20 / 0 |

The 2 pre-existing greens in the new suite are deliberate: they are AC-4/AC-7 *baseline pins*
(the note-TL byte fixture and the Export-modal survival check) whose job is to stay green.

## Coverage map

Handles are the **printed test titles**. `[R]` = pre-existing red (frozen, not authored here);
`[N]` = new in `test/pin-stack-composition.test.js`; `[G]` = pre-existing green kept as a guard.

| Criterion | Test name (as printed) | Test file | Level |
|---|---|---|---|
| AC-1 (pin identity) | `[R] publishTagPin: computePinEventDTag threads pinVariantKey (context in pin identity)` | `test/context-scoped-pins.test.js` | source contract |
| AC-1 (TL + bookmark d-tags) | `[R] publishTagPin: computeTLDTag + computeNoteBookmarkDTag thread pinVariantKey` | same | source contract |
| AC-1 (runtime-TA stamp) | `[R] publishTagPin: pinTag stamps the context via contextHandle (runtime TA), not the legacy literal` | same | source contract |
| AC-1 (server threading + recovery) | `[R] refreshPinnedTags: TL d-tags thread pinVariantKey and context is recovered from the pin` | same | source contract |
| AC-1 (client note-TL d-tag) | `[R] Story 2: a client note-TL d-tag helper composes tl-pin-notes-… with the discriminator` | same | source contract |
| AC-1 (panel read + AC-7 write) | `[R] Story 2: the Pinned panel reads notes under the pin's observer + context, and updates via server refresh` | same | source contract |
| AC-1 (stale comment) | `[R] Story 2: the stale "no TA-signed note-TL yet" comment is retired` | same | source contract |
| AC-1 (cutoff threading) | `[R] Server note curation threads the pin cutoff` | same | source contract |
| AC-1 (single-pin refresh) | `[R] A single-pin refresh recomputes BOTH the profile and note TLs` | same | source contract |
| AC-2 (caller guard) | `[R] Caller: ui/src/pages/Tag.jsx pinTag(...) call no longer passes taPubkey` | `test/restore-historical-data-and-fix-tl-author-filter.test.js` | source contract — **needs re-aim R1** |
| AC-2 (legacy handle preserved) | `[G] R-4/R-5 literal hardcode untouched` + `[G] CLAUDE.md carries a "Named exception (ADR 0015)" note…` | same | source contract |
| **AC-3** | `[N] AC-3: a contextual pin publishes a profile TL (30392) carrying the context concept as a z tag` | `test/pin-stack-composition.test.js` | **executed runner, injected deps** |
| **AC-3** | `[N] AC-3: a contextual pin publishes a note TL (30393) carrying the same context z tag` | same | executed runner |
| **AC-3** | `[N] AC-3: the context z handle is exactly 39998:<runtime TA>:<contextSlug> — never the legacy literal` | same | executed runner |
| **AC-3** | `[N] AC-3: a neutral pin publishes no context z on either list (the asymmetry is the feature)` | same | executed runner |
| **AC-3** | `[N] AC-3: the contextual lists keep the -in-<context> d suffix as their replaceability key` | same | executed runner |
| **AC-3** (edge) | `[N] AC-3: the runner recovers the context from the pin z stamp, not from an unstamped pin (malformed pin ⇒ neutral)` | same | executed runner |
| **AC-4** | `[N] AC-4: a neutral pin under the count method publishes exactly the pre-change 30392 event` | same | **literal fixture** |
| **AC-4** | `[N] AC-4: a neutral pin under the certainty method publishes exactly the pre-change 30392 event (scores, rigor, order)` | same | literal fixture |
| **AC-4** | `[N] AC-4: a neutral pin publishes exactly the pre-change 30393 note event` | same | literal fixture (green today) |
| **AC-4** | `[N] AC-4: the membership method never sees the context (scoring is independent of identity)` | same | executed runner |
| AC-4 (ladder, live) | `tl-membership-method-selector`, `tl-certainty-method`, `tl-publication-from-pins`, `customize-pin-curation-publish` | those suites | **reviewer-run against the stack** (see below) |
| **AC-5** | `[N] AC-5: the contextual-pins ADR 0001 is marked Accepted` | `test/pin-stack-composition.test.js` | artifact check |
| **AC-6** | `[N] AC-6: the shared composer in pins.js builds both TL d-tags, with and without a context` | same | unit |
| **AC-6** | `[N] AC-6: the client computeNoteTLDTag and the server note runner compose the identical string for every fixture row` | same | **parity fixture table** (client ESM loaded via `import()`) |
| **AC-6** | `[N] AC-6: the contextual d-tag the client computes is the one the server publishes (end-to-end, not just helper-to-helper)` | same | executed runner + client |
| **AC-6** | `[N] AC-6: neither the client nor the server hand-formats the tl-pin-notes- prefix (both delegate to the shared composer)` | same | source sentinel |
| **AC-7** | `[N] AC-7: the Pinned panel updates the note list via the server refresh endpoint, not a client bookmark publish` | same | source sentinel |
| **AC-7** | `[N] AC-7: the client bookmark export survives as a separate Export-modal action` | same | source sentinel (green today) |
| ADR §1 ordering | `[N] ADR ordering rule: runOnePin resolves the context before it dispatches the membership method` | same | source sentinel |
| ADR hazard 1 | `[N] Hazard 1: a contextual pin and its neutral twin publish to different TL coordinates (no mutual overwrite)` | same | executed runner |
| ADR hazard 2 | `[N] Hazard 2: a contextual refresh returns its -in-<context> d-tag, and retraction still diffs on the full current set` | same | executed runner + source sentinel |

## Edge cases covered explicitly

- [x] **Malformed pin** — a `['z']` with no value, a `39998:<TA>:not-a-known-context` stamp, and a
      bare `'garbage'` `z` all coexist on one pin; the runner must resolve it as **neutral**
      (no suffix, no context `z`). `contextSlugOfPin`'s known-slug gate is what makes this safe.
- [x] **Legacy `tag-pinning` `z` is never misread as a context** — every fixture pin carries
      `39998:<LEGACY_TA>:tag-pinning`; the neutral cases assert zero context `z` on output.
      (The unit-level version of this is a frozen green in `context-scoped-pins`.)
- [x] **`contextSlug: null` explicitly passed** (not merely omitted) — a parity-table row.
- [x] **Both known contexts** — `lfo` and `tapestry-web-of-trust` (multi-segment slug).
- [x] **The degrade-to-count path** — `wotFiltering` is an injectable so the `certainty`→`count`
      degrade can be exercised without a live GrapeRank; the count fixture pins its output.
- [x] **Context does not perturb scoring** — the same aggregation is run with and without a
      context and the `items` arrays must be identical.
- [x] **TA pubkey unresolved in-process** — the suite provisions `process.env.TA_PUBKEY` at load
      time (this host has no `/etc/brainstorm.conf`; the stack is in Docker) and every
      context test `SKIP`s rather than silently passing if the TA still resolves `null`.

## Error paths (explicit table)

| Situation | Required behavior | Where asserted |
|---|---|---|
| `contextSlugOfPin` gets a malformed pin (`['z']` with no value, `'garbage'`, unknown slug) | returns `null` ⇒ neutral identity, no context `z`, no throw | `[N] AC-3: the runner recovers the context from the pin z stamp…` |
| `contextSlugOfPin` gets `pinEvent === null/undefined` or no `tags` | returns `null` (existing guard `(pinEvent && pinEvent.tags) \|\| []`) | frozen green `contextSlugOfPin returns null for a neutral pin` (unit) |
| The context **concept handle is absent from the graph** (firmware not installed on a fresh deployment) | the context `z` is still emitted and still relay-filterable; publication MUST NOT be gated on the concept resolving as a graph node (ADR: "discovery does not depend on it") | `[N] AC-3: the context z handle is exactly 39998:<runtime TA>:<contextSlug>…` — the runner's only input is `taPubkey` + slug; no lookup exists to fail. **No graph precondition is asserted anywhere in this suite — that is the point.** |
| The pin has **no `e`/`a`** (no referenced tag event id) | `runOnePin`/`runOneNotePin` return `{status:'error', errorReason:'pin event has no referenced tag event id'}` before any context work | pre-existing coverage in `note-trusted-list.test.js`; unchanged by this story. **Not re-asserted here** (see Not covered) |
| Referenced tag event missing from strfry | `{status:'error'}`, no publish | pre-existing (`note-trusted-list.test.js`) |
| Publish throws for a contextual pin | the returned `dTag` must still be the `-in-<context>` one, so `retractStaleTLs` cannot sweep the healthy TL | `[N] Hazard 2:…` asserts the returned d-tag; the publish-failure branch itself is pre-existing (`tag-stack-merge-hardening/0001` B4a) |
| Pin targets profiles only (`targetTypes: ['profile']`) | `runOneNotePin` returns `{status:'skipped'}` — no note TL, contextual or not | pre-existing (`note-trusted-list.test.js`) |
| `resolveMembershipMethod` returns an unimplemented id | fail-safe to `count` (unchanged) | pre-existing (`tl-membership-method-selector`, live) |

## Guard-suite carve-out (read this before implementing)

Three **currently-passing or frozen** grep-style assertions read the *source text* of the two files
whose string literals the ADR moves into the shared composer. They are guards against the ADR-0015
/ Story-11 regressions and I have deliberately **not** rewritten them. They constrain the diff:

1. **`[G] R-2: refreshPinnedTags.js computeTLDTag is unchanged (TL d-tag is wire-binding)`**
   (`restore-historical…`, green today) requires the literal template
   `` tl-pin-${…slice(0, 8)}-${…slice(0, 8)}-${…} `` to remain **textually present in
   `refreshPinnedTags.js`**, and `function computeTLDTag` to still be defined there.
2. **`[R] Story 2: a client note-TL d-tag helper composes tl-pin-notes-… with the discriminator`**
   (`context-scoped-pins`, red today) requires `tl-pin-notes-` and `pinVariantKey` to appear
   within 120 chars of each other in **`publishTagPin.js`**.
3. **`[R] publishTagPin: computeTLDTag + computeNoteBookmarkDTag thread pinVariantKey`** requires
   `pinVariantKey` within 400 chars **after** each helper name in `publishTagPin.js`
   (`computeNoteBookmarkDTag` keeps `pinVariantKey` inline per the ADR, so this is satisfiable).
   
   **Consequence:** under strict delegation (ADR §5) #1 and #2 can only be satisfied by keeping the
   composed shape visible as a **documentation comment** next to the delegating wrapper (e.g.
   `` // → tl-pin-notes-${obs8}-${author8}-${slug} + pinVariantKey(...) — composed by noteTlDTag `` ).
   That is grep-satisfaction-by-comment, and I am recording it as a known weakness rather than
   hiding it: the *behavior* those two guards used to cover is now covered **executably** by
   `[N] AC-6: the shared composer in pins.js builds both TL d-tags…` and the parity table, which
   assert the produced strings rather than the source text. My negative sentinel is deliberately
   narrow — it bans **template interpolation** (`` `tl-pin-notes-${ ``), not a mention in prose —
   so both can hold at once.

**R1 — the one existing assertion that cannot go green as written (operator decision needed).**
`[R] Caller: ui/src/pages/Tag.jsx pinTag(...) call no longer passes taPubkey` asserts that **no**
`pinTag({…})` call carries a `taPubkey` **key**. AC-2 and ADR §4 require exactly the opposite for
the contextual path (`taPubkey` admissible **iff** `context` is present). The assertion is
therefore unsatisfiable under the ratified design, and `restore-historical…` cannot reach 22/0
until it is re-aimed. I have **not** edited it (the ten reds were frozen for this phase). The
one-line re-aim, ready to apply on approval — inside the existing `while` loop, replacing the
`!keys.includes('taPubkey')` assert:

```js
    assert(
      !keys.includes('taPubkey') || keys.includes('context'),
      'Caller: Tag.jsx pinTag(...) may pass `taPubkey` ONLY alongside `context` (ADR ' +
        'feat-tags-modernization/0001 §4: the runtime TA is admissible solely to compose the ' +
        'greenfield context handle). A bare `taPubkey` on a neutral pin is still forbidden ' +
        `(ADR 0015). Found call with args: "${args.trim()}".`
    );
```

The ADR-0015 intent it used to proxy is asserted directly and is already green elsewhere in that
same suite (`TAG_PINNING_HANDLE` composed from `LEGACY_TA_PUBKEY`; the `useProfileTags.js` /
`publishProfileTag.js` literal-hardcode guards). **Alternatives:** leave it red (AC-2 unmeetable),
or have the PO re-scope AC-2. Recommend applying the patch above.

## Not covered (and why)

- **Live-stack AC-4 ladder suites.** `tl-membership-method-selector`, `tl-certainty-method`,
  `tl-publication-from-pins`, `customize-pin-curation-publish` **hang without a live stack**
  (pre-existing on this branch — they were not run here, by instruction). AC-4's story text
  assigns them to the **reviewer**, to run against the stack or to record the hang as pre-existing
  with evidence. The stack-free half of AC-4 is covered by the literal fixtures above.
- **The `input` membership method** has no literal fixture (only `count` and `certainty`, the
  method in practical use). `input` is covered by the live ladder suites and by
  `[N] AC-4: the membership method never sees the context`.
- **Pin-level error paths already covered** (`no e/a tag`, `tag missing from strfry`,
  `targetTypes: ['profile']`, publish-failure d-tag retention) live in `note-trusted-list.test.js`
  and are unchanged by this story; re-asserting them here would only duplicate.
- **The three-`z` `dlist-item-tagging` convention.** On this branch a contextual TL carries **one**
  `z` and a neutral one **none**. Per the ADR, any test asserting "exactly three `z`" here would be
  wrong; the suite asserts only "the context `z` is present / absent".
- **A context `z` on the kind-30000/30003 client exports** — out of scope (ADR).
- **Browser behavior of the Pinned tab** (the actual click → server refresh → refetch) — AC-7 is
  asserted at the source level only; no Playwright spec was added. The user-facing pinned-panel
  work is story 3, and the operator's live-testing pass on the subdomain is the real check.
- **Republishing existing contextual TLs with the new `z`** — out of scope (they re-derive).

## Test infrastructure

- Node built-in runner. New suite registered in `test/registry.js` (one line,
  `{ file: 'pin-stack-composition.test.js' }`, immediately after `context-scoped-pins.test.js`) —
  required by `test/stack-free-npm-test.test.js` **G5**: every `test/*.test.js` must be registered
  or excluded-with-a-reason or the gate fails.
- **Stack-free.** No strfry, neo4j, Meilisearch, Redis or control panel. The runners are exercised
  through injected deps; everything else reads source text or artifacts.
- **Firmware / graph state: none required.** Deliberately — see the error-path table: the context
  `z` must be emitted whether or not `39998:<TA>:lfo` resolves as a graph node.
- **`TA_PUBKEY`**: the suite sets `process.env.TA_PUBKEY` at load time if unset (Docker host has no
  `/etc/brainstorm.conf`), then reads back the value the runner itself uses
  (`require('src/api/profile-tags').TA_PUBKEY`) so expectations are always composed from the TA in
  force. Never hardcoded (CLAUDE.md).
- **Client-ESM loader.** `ui/src/utils/publishTagPin.js` uses the vite-only `@tapestry/event-tagging`
  alias and extensionless relative imports, so a plain `import()` fails. The suite writes a
  rewritten copy (`ui/src/utils/__pin_stack_probe_<pid>.mjs`) next to the original — alias pointed
  at `src/lib/event-tagging/index.js` (default-import + destructure, because that module's exports
  are spreads and have no ESM named exports), transport/signer imports stubbed as `undefined` since
  the pure d-tag helpers never touch them — dynamic-imports it, and **unlinks it in a `finally`**.
- **Fixtures:** `observer` `a×64`, tag author `b×64`, tag event `c×64`, members `1×64`/`2×64`,
  notes `3×64`/`4×64`, tag `funny`/"Funny", `povSuffix 'deadbeef'`, `minRank 0.25`, cutoff 1.
  `certainty` scores are exact by construction (`weightedSum/weightedInput` = 1/1 → 50, 2/2 → 75).

### Testability contract this plan introduces (ADR gap — flag for the Implementer)

The ADR does not say how AC-3's *published* `z` or AC-4's byte-identity are to be verified, and
`runOnePin(pinEvent)` today takes no deps — so neither is checkable without a live stack. This
suite therefore requires `runOnePin` to gain the injection shape `runOneNotePin` **already** has:

```js
runOnePin(pinEvent, { deps: { lookupTag, aggregateProfilesTagged, resolvePov,
                              resolveMembershipMethod, publishTL } })
```

with `options.deps || options` and the real implementations as defaults (no behavior change on any
call path). This is a test-visibility requirement, not a design change; 13 of the 18 new reds
report it as their failure reason today.

## How to run

From the worktree root (`/home/vcavallo/src/tapestry-tags`), hard-capped and stack-free:

```
timeout 90 env BRAINSTORM_BASE_URL=http://localhost:8778 direnv exec . node -e \
  "require('./test/pin-stack-composition.test.js').run().then(r=>{console.log(r);process.exit(r.fail?1:0)})"
```

Same form for `context-scoped-pins` and `restore-historical-data-and-fix-tl-author-filter`.
Do **not** run `tl-membership-method-selector`, `tl-certainty-method`, `tl-publication-from-pins`,
`customize-pin-curation-publish` without a live stack — they hang (pre-existing). Full gate:
`npm test` (result read per the README's test-gate section).

## Verification

Confirmed 2026-09-17 at commit `9356226e` on `integrate/staging-into-tags-2026-09`.

`test/pin-stack-composition.test.js` — **2 passed, 18 failed, 0 skipped** (both passes are
intentional AC-4/AC-7 baseline pins). Failure output, abridged to one line per test:

```
  ✗ AC-3: a contextual pin publishes a profile TL (30392) carrying the context concept as a z tag
      runOnePin must accept INJECTED DEPS ({ lookupTag, aggregateProfilesTagged, resolvePov,
      resolveMembershipMethod, publishTL }) the way runOneNotePin already does — otherwise AC-3
      (the published context z) and AC-4 (byte-identity) are not checkable without a live stack.
      It ignored them and reached the real stack instead: Command failed: strfry scan '{"kinds":[39999],…}'
  ✗ AC-3: a contextual pin publishes a note TL (30393) carrying the same context z tag
      the contextual NOTE TL must carry the context z too (both 3039x lists are discoverable by context); z tags were [].
  ✗ AC-3: the context z handle is exactly 39998:<runtime TA>:<contextSlug> — never the legacy literal
      runOnePin must accept INJECTED DEPS (…)
  ✗ AC-3: a neutral pin publishes no context z on either list (the asymmetry is the feature)
      runOnePin must accept INJECTED DEPS (…)
  ✗ AC-3: the contextual lists keep the -in-<context> d suffix as their replaceability key
      runOnePin must accept INJECTED DEPS (…)
  ✗ AC-3: the runner recovers the context from the pin z stamp, not from an unstamped pin (malformed pin ⇒ neutral)
      runOnePin must accept INJECTED DEPS (…)
  ✗ AC-4: a neutral pin under the count method publishes exactly the pre-change 30392 event
      runOnePin must accept INJECTED DEPS (…)
  ✗ AC-4: a neutral pin under the certainty method publishes exactly the pre-change 30392 event (scores, rigor, order)
      runOnePin must accept INJECTED DEPS (…)
  ✓ AC-4: a neutral pin publishes exactly the pre-change 30393 note event
  ✗ AC-4: the membership method never sees the context (scoring is independent of identity)
      runOnePin must accept INJECTED DEPS (…)
  ✗ AC-6: the shared composer in pins.js builds both TL d-tags, with and without a context
      src/lib/event-tagging/pins.js must export tlDTag + noteTlDTag (the single source of both strings, ADR §2/§5). Load error: none.
  ✗ AC-6: the client computeNoteTLDTag and the server note runner compose the identical string for every fixture row
      pins.js must export noteTlDTag (the server side of the parity).
  ✗ AC-6: the contextual d-tag the client computes is the one the server publishes (end-to-end, not just helper-to-helper)
      runOnePin must accept INJECTED DEPS (…)
  ✗ AC-6: neither the client nor the server hand-formats the tl-pin-notes- prefix (both delegate to the shared composer)
      publishTagPin.js must not build a tl-pin… d-tag by template interpolation — it must call the shared tlDTag/noteTlDTag (ADR §5).
  ✗ AC-5: the contextual-pins ADR 0001 is marked Accepted
      contextual-pins/0001 must read "**Status:** Accepted" (it shipped and passed review — AC-5).
  ✗ ADR ordering rule: runOnePin resolves the context before it dispatches the membership method
      runOnePin must recover the context with contextSlugOfPin( (ADR §1).
  ✗ Hazard 1: a contextual pin and its neutral twin publish to different TL coordinates (no mutual overwrite)
      runOnePin must accept INJECTED DEPS (…)
  ✗ Hazard 2: a contextual refresh returns its -in-<context> d-tag, and retraction still diffs on the full current set
      runOnePin must accept INJECTED DEPS (…)
  ✗ AC-7: the Pinned panel updates the note list via the server refresh endpoint, not a client bookmark publish
      handleRepinNotes must POST /api/trusted-list/refresh-pinned-tag (server recompute of the assistant-signed 30393, context-aware via the pin event id) — D2 / AC-7.
  ✓ AC-7: the client bookmark export survives as a separate Export-modal action

pin-stack-composition: 2 passed, 18 failed, 0 skipped
```

`test/context-scoped-pins.test.js` — **23 passed, 9 failed** (unchanged by this phase):

```
  FAIL  publishTagPin: computePinEventDTag threads pinVariantKey (context in pin identity)
  FAIL  publishTagPin: computeTLDTag + computeNoteBookmarkDTag thread pinVariantKey
  FAIL  publishTagPin: pinTag stamps the context via contextHandle (runtime TA), not the legacy literal
  FAIL  refreshPinnedTags: TL d-tags thread pinVariantKey and context is recovered from the pin
  FAIL  Story 2: a client note-TL d-tag helper composes tl-pin-notes-… with the discriminator
  FAIL  Story 2: the Pinned panel reads notes under the pin's observer + context, and updates via server refresh
  FAIL  Story 2: the stale "no TA-signed note-TL yet" comment is retired
  FAIL  Server note curation threads the pin cutoff
  FAIL  A single-pin refresh recomputes BOTH the profile and note TLs

context-scoped-pins: 23 passed, 9 failed
```

`test/restore-historical-data-and-fix-tl-author-filter.test.js` — **21 passed, 1 failed**:

```
  FAIL  Caller: ui/src/pages/Tag.jsx pinTag(...) call no longer passes taPubkey
        … must NOT pass a `taPubkey` PARAMETER (per ADR 0015 …). Found call with args:
        "tag, curationMethod: defaultCurationMethod(user.pubkey), context, taPubkey,".

restore-historical-data-and-fix-tl-author-filter: 21 passed, 1 failed
```

Every new failure is a missing-feature failure (absent export, absent deps contract, absent `z`,
absent endpoint call, `Proposed` status) — no import errors, no typos: the suite loads cleanly and
2 of its assertions already pass.

## Untestable / under-specified in the ADR as written

1. **`runOnePin` has no dependency seam.** AC-3 and AC-4 are the ADR's two strongest wire claims
   and neither is verifiable stack-free today. Addressed by the testability contract above; the
   Implementer must add it (mirroring `runOneNotePin`), or AC-3/AC-4 verification moves to a
   live-stack-only reviewer step.
2. **"Byte-identical" is not a checkable phrase.** `buildAndPublishTL` signs and publishes, so the
   true bytes can't be compared offline. This plan reads "byte-identical" as *the arguments handed
   to the publisher are identical* (kind, d-tag, title, metric, items, extraTags, and the exact
   `content` string) — pinned as literal fixtures. Anything downstream of `buildAndPublishTL` is
   out of reach without the stack.
3. **AC-1's 32/32 vs AC-2's guard, and AC-1's 32/32 vs ADR §5's single composer** — the two
   collisions recorded in the carve-out above (R1, and the two grep guards over relocated
   literals). Both are Phase-3/PO calls, exactly as the ADR's "Boundary note" anticipated.
4. **The ADR's "test re-aims … the Tester's lane" instruction conflicts with this phase's freeze
   on the ten reds.** Resolution taken: no red was edited; the re-aimed intent is expressed as new
   executable tests instead, and the two relocated-literal greps are documented as satisfiable
   only via a doc comment.
5. **The `-in-<context>` suffix "that no reader parses"** is unfalsifiable as stated — a test
   cannot prove the absence of future parsing. Partially covered by asserting that recovery goes
   through `contextSlugOfPin` (the `z` stamp) and that a malformed/unstamped pin resolves neutral.
6. **"The context `z` is relay-filterable regardless"** of firmware install is asserted only
   negatively (no graph precondition exists in the suite). A true end-to-end `#z` filter check
   needs a live strfry and belongs to the reviewer's stack pass.
