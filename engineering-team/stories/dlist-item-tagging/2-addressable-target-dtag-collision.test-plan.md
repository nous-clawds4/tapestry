# Test Plan: Story 2 — Addressable-target assertion `d`-tag collision (spec fix)

**Story:** `engineering-team/stories/dlist-item-tagging/2-addressable-target-dtag-collision.md`
**ADR:** `engineering-team/decisions/dlist-item-tagging/0001-addressable-target-dtag.md` (Accepted)
**Date:** 2026-09-10
**Branch / commit at verification:** `feat/dlist-item-tagging` @ `b864b6cd` (tests uncommitted at time of writing — see Verification)

> Location note: the house convention is `stories/<epic>/<n>-<slug>.test-plan.md` (roles/tester.md, workflows/3-test-design.md, and every existing plan); `engineering-team/tests/` holds a single outlier and was not followed.

## What is under test

The ADR's binding Decision, restated as the contract the tests pin:

```
a target:  d = event-tag-<slug>-<author8>-<d16>-<hash8>-<asserter8>
e target:  d = event-tag-<slug>-<id8>-<asserter8>          (byte-identical to today)
```

- `author8` = coord author segment `[0:8]` (decoration); `d16` = everything after the **second** colon, first 16 chars, verbatim (decoration); `hash8` = first 8 lowercase hex of SHA-256 over the **full coordinate string as carried in the `a` tag** — the only uniqueness segment.
- `hash8` is **injected**: `buildEventTaggingAssertion({ …, hash8 })` takes a **sync** `(str) => 8-hex`; `applyEventTagging` takes `deps.hash8` **sync or async**, resolves it once up front, and pins a sync closure for the builder.
- Fail loud: `a` target + non-function `hash8` → throw naming `hash8`; result not `/^[0-9a-f]{8}$/` → throw; `applyEventTagging` without `deps.hash8` → throw at entry, before `findHeaders`/`sign`/`publish`, even for `e`-only callers.
- Core stays dependency-free: no `crypto` token, no new hash module, sibling-only `require`.
- Readers never parse `d` (now normative in the spec).

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 | `AC-1: two addressable targets by the SAME author with different d yield DIFFERENT assertion d-tags` | `test/event-tagging-a-target-dtag.test.js` | unit (builder) |
| AC-1 | `AC-1 (worked example): d = event-tag-<slug>-<author8>-<d16>-<hash8>-<asserter8> with the ADR fixtures 086cb8ff / 878ce18a` | same | unit (builder) |
| AC-1 | `AC-1 (full tag shape): the rest of the assertion is unchanged — a, dual concept-z, header z, polarity` | same | unit (builder) |
| AC-1 | `orchestrator (AC-1 end-to-end): tagging two same-author DList items lands at two DIFFERENT addresses` | same | unit (orchestrator, injected deps) |
| AC-2 | `AC-2: the same (tag, target, asserter) built twice yields the SAME d (republishing still replaces)` | same | unit |
| AC-2 | `AC-2 (asserter isolation): a different asserter on the same target gets a different d that differs ONLY in asserter8` | same | unit |
| AC-3 | `AC-3: an e target keeps event-tag-<slug>-<id8>-<asserter8> — with or without a hash8 supplied` | same | unit |
| AC-3 | `AC-3: hash8 is NOT consulted for an e target (the dep is only touched on the a branch)` | same | unit |
| AC-3 | `orchestrator: an e target with deps.hash8 present does not call it, and its d is byte-identical to today` | same | unit (orchestrator) |
| AC-3 | existing `buildEventTaggingAssertion: kind-1 note target uses e, …` (untouched, must keep passing) | `test/event-tagging-core.test.js` | unit |
| AC-4 | `AC-4 (spec): the d-tag section states the five-segment a-target rule with hash8 = SHA-256 over the full coordinate` | `test/event-tagging-a-target-dtag.test.js` | source-contract (spec text) |
| AC-4 | `AC-4 (spec): readers MUST NOT parse d; the a/e tag is authoritative for the target` | same | source-contract |
| AC-4 | `AC-4 (spec): the old author-segment rule is recorded as superseded on 2026-09-10 with the compatibility posture` | same | source-contract |
| AC-4 | `AC-4 (spec): the worked github-accounts example values appear (086cb8ff / 878ce18a) and the spec still hardcodes no 64-hex pubkey` | same | source-contract |
| AC-4 | `AC-4 (protocols/README.md): the Event Taggings status row names dlist-item-tagging #2` | same | source-contract |
| AC-4 (invariants kept) | existing `spec: metadata header, title, normative d-tag + polarity, no // in JSON, …` and `spec: no literal 64-hex pubkey hardcoded` (untouched; must keep passing after the spec edit) | `test/event-tagging-spec.test.js` | source-contract |
| AC-5 | Not testable in code — the ADR is a document. Verified by reading: options A/B/C (+D/E) recorded; `maxTagValSize = 1024` discussed; read-side `#a` keying verified with file:line citations. Reviewer confirms at Phase 5. | — | — |
| AC-6 | pinned expectation updated: `buildEventTaggingAssertion: addressable target uses a; d = author8-d16-hash8 with hash8 injected` | `test/event-tagging-core.test.js` | unit |
| AC-6 | new AC-1 regression (rows above) | `test/event-tagging-a-target-dtag.test.js` | unit |
| Injection contract | `hash8 receives the FULL coordinate string exactly as placed in the a tag (no trimming/normalizing), exactly once` | same | unit |
| Injection contract | `hash8 segment in d equals the caller-supplied value verbatim (the core does not re-hash or post-process it)` | same | unit |
| Fail loud (ADR) | `fail loud: an a target with NO hash8 throws (never silently mints a collidable address)` | same | unit |
| Fail loud (ADR) | `fail loud: a non-function hash8 (string / object) on an a target throws` | same | unit |
| Fail loud (ADR) | `fail loud: hash8 returning anything other than exactly 8 lowercase hex chars throws` | same | unit |
| Fail loud (ADR) | `fail loud: a hash8 that throws propagates (the builder does not swallow it)` | same | unit |
| Fail loud (ADR) | `orchestrator: applyEventTagging WITHOUT deps.hash8 throws at entry — even for an e target — before findHeaders, sign, or publish` | same | unit (orchestrator) |
| Fail loud (ADR) | `orchestrator: a deps.hash8 that resolves to a non-8-hex value fails BEFORE signing (no orphan signed event)` | same | unit (orchestrator) |
| Sync/async dep (ADR) | `orchestrator: an ASYNC deps.hash8 (browser SubtleCrypto shape) is awaited and its value lands in the assertion d` | same | unit (orchestrator) |
| Sync/async dep (ADR) | `orchestrator: a SYNC deps.hash8 (server node:crypto shape) works identically` | same | unit (orchestrator) |
| Purity (ADR) | `purity: builders.js and apply.js still contain no "crypto" token and require only siblings (the hash is injected, not shipped)` | same | source-contract |
| Purity (ADR) | existing `purity: no app requires, no network, no Date.now, no crypto, CJS only` (untouched; must keep passing) | `test/event-tagging-core.test.js` | source-contract |
| Caller update (ADR) | `makeDeps` gains `hash8`; the addressable test now pins the five-segment `d` | `test/event-tagging-write-path.test.js` | unit (orchestrator) |
| Caller update (ADR) | E2's `applyEventTagging` deps gain `hash8` | `test/tag-applicability.test.js` | unit (orchestrator) |

## Edge cases

All in `test/event-tagging-a-target-dtag.test.js`:

- [x] `d` containing colons (live 30023 URL-ish example) — `d16` = first 16 chars of *everything after the second colon* (`https://tomgrube`); hash covers the whole string.
- [x] `d` shorter than 16 chars — verbatim, no padding (`good-tag` → `good-tag`).
- [x] `d` longer than 16 — truncated to exactly 16.
- [x] `d` empty (`30023:<author>:`) — empty `d16`, double hyphen `…-<author8>--<hash8>-…`; still distinct from a one-char `d`.
- [x] Two coords sharing author **and** the first 16 chars of `d` — identical decoration, distinct `hash8` (proves uniqueness lives in the hash, not the readable part).
- [x] Two coords differing only in **kind** — distinct (kind participates in the hash; the collision Option B had).
- [x] Tagging-a-tagging recursion — exact ADR string `event-tag-disputed-claim-22222222-event-tag-white--<hash8>-33333333`; length equals the depth-1 length for the same slug; equals `slug + 54`.
- [x] `hash8` missing / non-function (`'deadbeef'`, `{}`, `42`, `null`) → throws naming `hash8`.
- [x] `hash8` returning non-8-hex (`DEADBEEF`, 7 chars, 9 chars, non-hex, `''`, `undefined`, `null`, number) → throws.
- [x] `hash8` that throws → propagates.
- [x] Async `deps.hash8` in the orchestrator (resolved once, up front, over the full address).
- [x] Sync `deps.hash8` in the orchestrator.
- [x] `deps.hash8` resolving to garbage → fails before `sign`.
- [x] `e` target byte-identical with and without `hash8`; `hash8` never called for `e` (builder and orchestrator).
- [x] Different asserter, same target → differs only in the trailing `asserter8`.

## Not covered (and why)

- **`ui/src/hooks/useEventTagging.js` supplying `hash8` from `ui/src/utils/dtag.js`.** The ADR names it as the only production caller. No source-sentinel test was added: the existing write-path suite already regex-pins that hook, and a regex on an `import { hash8 }` line is exactly the "implementation detail the spec doesn't constrain" the role forbids. The orchestrator entry guard (tested) makes a hook that forgets the dep fail on first use in the browser, which is what the ADR relies on. Reviewer should confirm the hook change by reading.
- **Browser SubtleCrypto `hash8` parity with `node:crypto`.** `ui/src/utils/dtag.js` `hash8` already exists and is used for DList `d`-tags; parity is a pre-existing property, not this story's.
- **Live relay behavior** (`maxTagValSize`, replaceability at strfry). The length bound is asserted arithmetically (`slug + 54`); no live-stack suite was run (operator instruction: only the four suites).
- **Read-side latest-wins per `(asserter, descriptor, target)` in `classify.js`** — named follow-up in the ADR, out of scope.
- **The 7 old-rule events on tags.brainstorm.world** — no migrator by decision; nothing to test.
- **AC-5** — document review, not code.

## Test infrastructure

- Node built-in runner; new suite exports CJS `{ run }` → `{ pass, fail, skipped, failures }`, registered in `test/test.js` at all five sites (require, run, summary line, `overallOk`, skipped roll-up) mirroring `dlistBrowse`.
- Concept Graph API: **not used** — all tests are dependency-injected/pure or source-contract. No live suites were skipped because none were planned.
- Firmware state: none required (ADR: no concept-definition change; no reinstall).
- Fixtures: `node:crypto` `hash8` closure in each test file (the ADR's "direct caller" lane); `GH_AUTHOR = b83a28b7…` with `vcavallo-1i6dn0p` (16-char `d`) → `086cb8ff` and `aburra16-io3q45` (15-char `d`) → `878ce18a`, both re-verified against `src/lib/dtag.js` `hash8` on 2026-09-10; `JACK`/`ALICE`/`BOB`/`NOTE_ID` as in the sibling suites.

## How to run

Per the operator instruction for this phase — only the four suites, individually, from the repo root, through the dev shell:

```
direnv exec . node -e "require('./test/event-tagging-a-target-dtag.test.js').run().then(r=>{console.log(r);process.exit(r.fail?1:0)})"
direnv exec . node -e "require('./test/event-tagging-core.test.js').run().then(r=>{console.log(r);process.exit(r.fail?1:0)})"
direnv exec . node -e "require('./test/event-tagging-write-path.test.js').run().then(r=>{console.log(r);process.exit(r.fail?1:0)})"
direnv exec . node -e "require('./test/tag-applicability.test.js').run().then(r=>{console.log(r);process.exit(r.fail?1:0)})"
```

After implementation, also run `test/event-tagging-spec.test.js` the same way (the spec edit must keep its invariants), then the full `direnv exec . npm test`.

## Verification (pre-implementation, 2026-09-10, `feat/dlist-item-tagging` @ `b864b6cd` + uncommitted test edits)

| Suite | pass | fail | Expected post-implementation |
|---|---|---|---|
| `test/event-tagging-a-target-dtag.test.js` (new) | 6 | **26** | 32 / 0 |
| `test/event-tagging-core.test.js` | 14 | **1** (the updated pin) | 15 / 0 |
| `test/event-tagging-write-path.test.js` | 18 | **1** (the a-target `d` pin) | 19 / 0 |
| `test/tag-applicability.test.js` | 19 | 0 (dep added; `e` target so unaffected pre-impl) | 19 / 0 |

The 6 passing tests in the new suite are the **regression guards** that must hold on both sides of the change: AC-2 determinism (×2), AC-3 `e`-target byte-identity (×3 incl. orchestrator), and the core-purity check. They are not evidence of the feature.

Every failure is a missing-implementation failure, not a typo or import error — the actual old-rule value is visible in each message:

```
--- event-tagging a-target d-tag tests (epic dlist-item-tagging, Story 2) ---
  FAIL  AC-1: two addressable targets by the SAME author with different d yield DIFFERENT assertion d-tags
        same asserter + same tag on two same-author items must NOT share an address (old rule collapsed both to event-tag-white-hat-hacker-b83a28b7-22222222); got event-tag-white-hat-hacker-b83a28b7-22222222 for both
  FAIL  AC-1 (worked example): d = event-tag-<slug>-<author8>-<d16>-<hash8>-<asserter8> with the ADR fixtures 086cb8ff / 878ce18a
        expected: "event-tag-white-hat-hacker-b83a28b7-vcavallo-1i6dn0p-086cb8ff-22222222"
        actual:   "event-tag-white-hat-hacker-b83a28b7-22222222"
  FAIL  AC-1 (full tag shape): … (d differs; every other tag identical)
  PASS  AC-2: the same (tag, target, asserter) built twice yields the SAME d (republishing still replaces)
  PASS  AC-2 (asserter isolation): …
  PASS  AC-3: an e target keeps event-tag-<slug>-<id8>-<asserter8> — with or without a hash8 supplied
  PASS  AC-3: hash8 is NOT consulted for an e target (the dep is only touched on the a branch)
  FAIL  hash8 receives the FULL coordinate string exactly as placed in the a tag (no trimming/normalizing), exactly once
        expected: ["30023:b83a28b7…:https://tomgruber.org/writing/ontology-of-folksonomy.htm-1778765623"]   actual: []
  FAIL  hash8 segment in d equals the caller-supplied value verbatim …
        expected: "event-tag-white-hat-hacker-b83a28b7-vcavallo-1i6dn0p-deadbeef-22222222"   actual: "event-tag-white-hat-hacker-b83a28b7-22222222"
  FAIL  edge: a coordinate d containing colons — …
        expected: "event-tag-folksonomy-b83a28b7-https://tomgrube-614958e7-22222222"   actual: "event-tag-folksonomy-b83a28b7-22222222"
  FAIL  edge: a coordinate d shorter than 16 chars is used verbatim (no padding)
        expected: "event-tag-awesome-tag-b83a28b7-good-tag-61df2d39-22222222"   actual: "event-tag-awesome-tag-b83a28b7-22222222"
  FAIL  edge: a coordinate d longer than 16 chars is truncated to exactly the first 16 chars
        expected: "event-tag-awesome-tag-b83a28b7-a-really-long-it-d13aa779-22222222"   actual: "event-tag-awesome-tag-b83a28b7-22222222"
  FAIL  edge: an EMPTY coordinate d yields an empty d16 …
        expected: "event-tag-awesome-tag-b83a28b7--4f7df9d3-22222222"   actual: "event-tag-awesome-tag-b83a28b7-22222222"
  FAIL  edge: two coordinates sharing author AND the first 16 chars of d … got event-tag-white-hat-hacker-b83a28b7-22222222 for both
  FAIL  edge: two coordinates differing only in KIND … got event-tag-white-hat-hacker-b83a28b7-22222222 for both
  FAIL  recursion: tagging a tagging — …
        expected: "39999:2222…2222:event-tag-white-hat-hacker-b83a28b7-vcavallo-1i6dn0p-086cb8ff-22222222"   actual: "39999:2222…2222:event-tag-white-hat-hacker-b83a28b7-22222222"
  FAIL  fail loud: an a target with NO hash8 throws …                                   must throw
  FAIL  fail loud: a non-function hash8 (string / object) on an a target throws        hash8="deadbeef" must throw (not a function)
  FAIL  fail loud: hash8 returning anything other than exactly 8 lowercase hex chars throws   hash8 result "DEADBEEF" must be rejected
  FAIL  fail loud: a hash8 that throws propagates …                                     the supplier's error must surface, got: null
  FAIL  orchestrator: applyEventTagging WITHOUT deps.hash8 throws at entry …            must throw when deps.hash8 is missing
  FAIL  orchestrator: an ASYNC deps.hash8 … is awaited and its value lands in the assertion d
        expected: "event-tag-white-hat-hacker-b83a28b7-vcavallo-1i6dn0p-086cb8ff-22222222"   actual: "event-tag-white-hat-hacker-b83a28b7-22222222"
  FAIL  orchestrator: a SYNC deps.hash8 … works identically
        expected: "event-tag-white-hat-hacker-b83a28b7-aburra16-io3q45-878ce18a-22222222"   actual: "event-tag-white-hat-hacker-b83a28b7-22222222"
  FAIL  orchestrator (AC-1 end-to-end): tagging two same-author DList items lands at two DIFFERENT addresses
        second item must not replace the first: 39999:2222…:event-tag-white-hat-hacker-b83a28b7-22222222 === 39999:2222…:event-tag-white-hat-hacker-b83a28b7-22222222
  PASS  orchestrator: an e target with deps.hash8 present does not call it, and its d is byte-identical to today
  FAIL  orchestrator: a deps.hash8 that resolves to a non-8-hex value fails BEFORE signing   a bad hash8 result must throw
  PASS  purity: builders.js and apply.js still contain no "crypto" token …
  FAIL  AC-4 (spec): the d-tag section states the five-segment a-target rule …          section must name the author8 / d16 / hash8 segments
  FAIL  AC-4 (spec): readers MUST NOT parse d …                                         section must contain the normative "MUST NOT parse" sentence
  FAIL  AC-4 (spec): the old author-segment rule is recorded as superseded …            section must carry a dated "Superseded 2026-09-10" note
  FAIL  AC-4 (spec): the worked github-accounts example values appear …                 section should carry the two worked hash8 values
  FAIL  AC-4 (protocols/README.md): the Event Taggings status row names dlist-item-tagging #2
        … got: | Event Taggings (`nostr-event-tag`) | … | `event-tagging` #1 |

event-tagging-a-target-dtag: 6 passed, 26 failed

--- event-tagging core tests (epic event-tagging, Story 1) ---
  FAIL  buildEventTaggingAssertion: addressable target uses a; d = author8-d16-hash8 with hash8 injected
        expected: [["d","event-tag-awesome-tag-33333333-good-tag-tag-6bc63ba2-22222222"], …]
        actual:   [["d","event-tag-awesome-tag-33333333-22222222"], …]
  (14 others PASS, incl. `purity: no app requires, no network, no Date.now, no crypto, CJS only`)
event-tagging-core: 14 passed, 1 failed

--- event-tagging write-path tests (epic event-tagging, Story 5) ---
  FAIL  addressable target ({address}): the assertion references it via a, not e
        a-target assertion d must follow the five-segment rule, expected event-tag-existing-tag-33333333-some-addressable-4d2901f6-22222222, got event-tag-existing-tag-33333333-22222222
  (18 others PASS)
event-tagging-write-path: 18 passed, 1 failed

tag-applicability: 19 passed, 0 failed
```

## Notes for the Implementer (from writing the tests, not new requirements)

1. **Spec worked example must elide the author.** `test/event-tagging-spec.test.js` pins "no literal 64-hex pubkey in the spec". The ADR's worked-example rows carry the full `b83a28b7e4e5…` author. Write it as `39999:b83a28b7…:vcavallo-1i6dn0p` (or similar) in the spec; the `hash8` values `086cb8ff` / `878ce18a` still belong there — the new suite asserts both presence of those values and absence of any 64-hex literal.
2. The new suite extracts the section by its exact heading `## The assertion d-tag (normative)` up to the next `## `; keep the heading verbatim.
3. The old expression `` `<coord>.split(":")[1][0:8]` `` may only survive *inside* the superseded note (the test strips from the first "superseded" onward before checking).
4. `protocols/README.md` Event Taggings row: the test looks for `dlist-item-tagging` and `#2` on the same line.
