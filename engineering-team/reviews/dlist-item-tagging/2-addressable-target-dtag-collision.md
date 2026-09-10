# Review: Story 2 — Addressable-target assertion `d`-tag collision (spec fix)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-10
**Diff:** `git diff 0a083ff0~1 HEAD` — commits `0a083ff0` (Tester: failing tests) + `2417b807` (Implementer) on `feat/dlist-item-tagging`
**Story:** `engineering-team/stories/dlist-item-tagging/2-addressable-target-dtag-collision.md`
**ADR:** `engineering-team/decisions/dlist-item-tagging/0001-addressable-target-dtag.md` (Accepted)
**Test plan:** `engineering-team/stories/dlist-item-tagging/2-addressable-target-dtag-collision.test-plan.md`

Uncommitted working-tree changes (`.envrc`, `.gitignore`, `CLAUDE.md`, `docs/SHARED_CONCEPTS_*`) are outside this diff and were ignored per operator instruction.

## Quality gates (run by reviewer, not trusted)

Operator constraint for this phase: only the five named suites, each run individually via `direnv exec . node -e "require('./test/<s>.test.js').run()…"` from the repo root. Full `npm test` **not** run by instruction.

- [x] `test/event-tagging-a-target-dtag.test.js` — **32 passed, 0 failed** (EXIT=0)
- [x] `test/event-tagging-core.test.js` — **15 passed, 0 failed** (EXIT=0) — includes the untouched purity guard
- [x] `test/event-tagging-write-path.test.js` — **19 passed, 0 failed** (EXIT=0)
- [x] `test/tag-applicability.test.js` — **19 passed, 0 failed** (EXIT=0)
- [x] `test/event-tagging-spec.test.js` — **5 passed, 0 failed** (EXIT=0) — spec invariants (heading, `event-tag-` literal, no `//` in JSON, no 64-hex pubkey) hold after the edit
- [x] Playwright — not applicable (no UI surface; the hook change is one import + one dep key, verified by reading)
- [x] _Lint / typecheck / build not configured — skipped._

All five match the test plan's expected post-implementation counts exactly (32/15/19/19/5).

## Spec adherence

| AC | Claim | Evidence | Verdict |
|---|---|---|---|
| AC-1 | Same author, different `d` → different assertion `d` | `a-target-dtag` suite: AC-1 ×3 (builder) + orchestrator end-to-end; worked-example values `086cb8ff` / `878ce18a` pinned | PASS |
| AC-2 | Same (tag, target, asserter) built twice → same `d` | AC-2 ×2 (determinism + asserter isolation) | PASS |
| AC-3 | `e` target byte-identical to today | `builders.js:151–158` `e` branch diffed before/after: **unchanged** (`target8 = target.id.slice(0, 8)`); AC-3 ×3 tests incl. "hash8 never consulted for `e`" at builder and orchestrator level; core suite's kind-1 test untouched and green | PASS |
| AC-4 | Spec states new `a` rule, superseded note with date, compat posture | `protocols/drafts/event-taggings.md:198–224` read in full — see "Spec text" below; 5 AC-4 source-contract tests green; `protocols/README.md:60` row now `event-tagging #1, dlist-item-tagging #2` | PASS |
| AC-5 | ADR records options (hash of full coord; author8 + d-slug; full coord verbatim), consequences incl. relay `d` length limits, read-side non-dependence on `d` verified and stated | Document review — see "AC-5 audit" below | PASS |
| AC-6 | Core pinned expectation updated; new AC-1 regression | `test/event-tagging-core.test.js:116–131` updated to the five-segment value with `node:crypto` `hash8`; new suite `test/event-tagging-a-target-dtag.test.js` registered in `test/test.js` at all 5 sites | PASS |

- [x] Every acceptance criterion has a passing test (AC-5 is doc-review by design; test plan says so).
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story. The only diff outside the ADR's file list is the `test/test.js` registration and the one test-fixture fix (below), both expected.

### AC-5 audit (document review)

- **Options.** A (hash of full coordinate — chosen for uniqueness), B (`author8-<d>` readable), C (full coordinate verbatim), D (keep the rule), E (hash both branches), plus a "rejected in discussion" list. All three the story demanded are present with pros/cons. ✔
- **Relay `d` length limits.** Constraint 6 cites `setup/strfry.conf.template:39` `maxTagValSize = 1024` and a live 68-char URL-ish `d`; Consequences derive the worst-case bound `slug + 54` chars (≤ 64 extra bytes non-ASCII), flat at every recursion depth. Option B/C cons discuss the unbounded case. ✔
- **Read-side non-dependence on `d`, with evidence.** Constraint 1 cites `filters.js:28–36` (`#a`/`#e` filters), `classify.js:130–136` (`targetOfCandidate` reads `a`/`e`), `src/api/event-tags/index.js:79–86` (`dedupeReplaceable` keys on `(pubkey, d)` opaquely) and `:172/:471/:531/:604` (header `#d`, not assertion `d`), and a `grep` for producers. I re-ran the equivalent grep: the only producer of `event-tag-` is `builders.js`; `applicability.js:48` reads the *tag-element* `d`, `apply.js:77` reads the freshly built `d` to compose the address (write path). No reader parses assertion `d`. ✔
- **Compat posture.** "No migration, no migrator, no reader dedupe" stated in Decision + Consequences with the read-only census (7 old-rule events, one asserter, 0 collisions, all on `tags.brainstorm.world`; 0 on staging/prod/local). Story § Open questions records operator acceptance 2026-09-10. ✔
- **Supersession scope.** Explicitly supersedes only the single `target8` bullet in `event-tagging/0001`; the "no crypto in core" rationale is upheld via injection. ✔

### Spec text (`protocols/drafts/event-taggings.md` § "The assertion d-tag (normative)")

- One rule, two identifier forms: the `<target8>` bullet is now "a fixed-length fingerprint … one of two forms" with `e` (`id8`) and `a` (`<author8>-<d16>-<hash8>`) sub-bullets; `hash8` defined as first 8 lowercase hex of SHA-256 over UTF-8 bytes of the full coordinate "exactly as carried in the `a` tag", named as the only uniqueness segment; `author8`/`d16` marked decoration; empty-`d` double-hyphen case stated. ✔
- "Readers MUST NOT parse `d` back into its fields … The `a` (or `e`) tag is authoritative" — present (`:206`). ✔
- Superseded note dated 2026-09-10, old expression `<coord>.split(":")[1][0:8]` kept only inside that note, compat posture (valid, discovered by `#a`/`#e`, not migrated, not deduped, orphaned in place) — present (`:224`). ✔
- Worked example: author elided as `b83a28b7…`, `hash8` values `086cb8ff` / `878ce18a` present; `grep -E '[0-9a-f]{64}'` on the spec returns nothing. ✔
- Recursion example with the `--` explanation and "no prefix-stripping rule" — present. ✔
- `protocols/README.md:60` row reads naturally: `` `event-tagging` #1, `dlist-item-tagging` #2 ``. ✔

## ADR adherence

- [x] Files changed match the ADR's implementation notes exactly: `builders.js`, `apply.js`, `ui/src/hooks/useEventTagging.js`, `protocols/drafts/event-taggings.md`, `protocols/README.md`, plus the tests the ADR listed for the Tester's lane.
- [x] Layering: hash is **injected**, not shipped. Core `require`s are sibling-only (`./slug`, `./handles`, `./builders`, `./applicability`). My own grep for `crypto|http|fetch|window|Date.now|console.` over `builders.js`/`apply.js` returns only two comment lines: the `apply.js:11` JSDoc that lists the banned tokens by name, and the pre-existing `builders.js:153` relay-hint comment containing the word "fetch" (no paren — the guard bans `fetch(`). Neither is new to this story; the purity guard in the core suite is green.
- [x] No new dependencies. `node:crypto` appears only in test files; the browser uses the pre-existing `ui/src/utils/dtag.js` `hash8`.

### `builders.js` `d16` / `hash8` extraction (`:161–177`)

- `parts = address.split(':')`; `author8 = (parts[1] || '').slice(0, 8)`; `d16 = parts.slice(2).join(':').slice(0, 16)` — everything after the **second** colon, colons re-joined, verbatim, first 16 code units. Empty `d` → `parts.slice(2)` = `['']` → `''`. Edge tests (colons, short, long, empty, shared-prefix, kind-only difference) all green.
- `hash8(target.address)` is called on the exact string placed in `['a', target.address]`; result validated by `requireHex8` (`/^[0-9a-f]{8}$/`). Fail-loud guard for non-function `hash8` fires before the hash call.
- `e` branch and the final `event-tag-${slug}-${target8}-${asserter8}` composition unchanged.

### `apply.js` — `hash8` resolved once (`:158–170`)

- Entry guard now requires `deps.hash8` to be a function alongside `sign`/`publish`/`now`, message updated to `{ findHeaders, sign, publish, now, hash8 }`. Fires before `findHeaders`/`sign`/`publish` even for `e`-only callers (tested).
- `targetHash8 = target && typeof target.address === 'string' && typeof target.id !== 'string' ? await deps.hash8(target.address) : null` — awaited exactly once, only for a target the builder will treat as `a`. **The Implementer's deviation from the ADR sketch (adding `typeof target.id !== 'string'`) is sound:** the builder's documented precedence is `id` wins when both are supplied, so hashing an `{id, address}` target would have been a spurious (and, in the browser, an async SubtleCrypto) call for an `e` assertion. The pinned closure still throws if the builder asks for a different string. Recorded in the story's `## Deviations`. ✔
- Sync and async suppliers both covered by tests; a bad `hash8` result fails before `sign` (no orphan signed event).

### Browser/server `hash8` parity (`ui/src/hooks/useEventTagging.js` ↔ `ui/src/utils/dtag.js`)

- Hook: `import { hash8 } from '../utils/dtag'` + `hash8` added to `deps`. No other change; the orchestrator awaits it. ✔
- `ui/src/utils/dtag.js` `hash8`: `TextEncoder().encode(str)` (UTF-8) → `crypto.subtle.digest('SHA-256')` → lowercase hex `slice(0, 8)`. Tests use `createHash('sha256').update(str, 'utf8')`. I ran both in the dev shell on the ADR's `vcavallo-1i6dn0p` coordinate and on a non-ASCII `d` (`café ünïcode`): **MATCH** in both cases (`87ef2d2f`, `7bb3fb2e`). Same bytes, same digest, same truncation — browser and tests agree. ✔

## Concept-graph integrity

- [x] Handles untouched; `39998:<TA>:nostr-event-tag` / `39999:<author>:tagging:<slug>-tagging` still `kind:pubkey:slug`. No literal TA pubkey introduced anywhere (spec test confirms no 64-hex literal in the spec).
- [x] Firmware reinstall: **not required** — no concept definition changed (ADR states this; the `nostr-event-tag` description does not encode the `d` rule).
- [x] ADR oriented via the Concept Graph (port 8877 `/summaries`, "Concepts touched" section) before reading source.

## Things tests can't catch

- [x] No secrets. No new pubkey literals (test fixtures reuse the `b83a28b7…` author already in the existing suites).
- [x] No debug logging / `console.log` in the source diff.
- [x] No commented-out code. Comments added are explanatory and avoid the banned purity tokens.
- [x] Error paths: non-function `hash8`, non-8-hex result, throwing supplier, missing `deps.hash8` — all throw with `hash8` in the message.
- [x] Concurrency: `hash8` is resolved before the plan array is built and before any signer prompt; no interleaving with `findHeaders`. Nothing new is stateful.
- [x] Security: `d16` is user-influenced text embedded verbatim in a tag value; the spec and code both forbid parsing it and cap it at 16 code units, so it cannot exceed `maxTagValSize` or confuse a coordinate splitter (the assertion's own coordinate is `39999:<asserter>:<d>` and is only ever consumed by readers that split on the first two colons — the same class of `d` the pre-existing 30023 URL-ish targets already produce).

### Test-fixture fix in the implementation commit

`2417b807` changed `test/event-tagging-a-target-dtag.test.js:245–256`: the "NO hash8 throws" test previously passed `h: undefined` into `buildA`, whose parameter default `h = hash8` then supplied the real hash — so the guard was never exercised (the test passed for the wrong reason). It now calls `load().buildEventTaggingAssertion(...)` directly with the option genuinely absent. **The test is now meaningful**: I confirmed by reading that the builder throws `hash8 dep is required…` on that path, and the sibling "non-function hash8" test still covers `'deadbeef'`, `{}`, `42`, `null` via `buildA` with explicit non-`undefined` values. This is a Phase-4 edit to a Tester-owned suite; it corrects a fixture defect the Implementer disclosed in `## Deviations` rather than changing what is pinned. Acceptable.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.
- [x] TA pubkey not hardcoded.

## Product-guide adherence

Not applicable — no PRD; no UI copy.

## Collateral

- **Other callers of the builder/orchestrator:** `buildEventTaggingAssertion` is called only from `apply.js`; `applyEventTagging` only from `ui/src/hooks/useEventTagging.js:52` — both updated. No server caller; `integration-kits/` absent on this branch. Matches ADR Constraint 9.
- **Docs quoting the old rule** (`grep -rn "target8\|event-tag-<" protocols docs engineering-team BIBLE.md`): remaining hits are (a) the superseded ADR `engineering-team/decisions/event-tagging/0001-protocol-core-and-spec.md:95,110` — historical record, explicitly superseded by this ADR's "Supersedes" bullet, correct to leave; (b) the `event-tagging` Story 1 story/test-plan — retired history; (c) `profile-tag-<slug>-<target8>-<asserter8>` in ADR 0022 / profile-tag-hardening / protocols-directory 0005 — the **pubkey-tag** sibling, a different rule explicitly out of scope; (d) `engineering-team/epics/dlist-item-tagging.md:22` describes the *problem* ("target8 for `a` targets is the coordinate's author8") as of discovery — accurate as history. No live document still asserts the old rule as current.

## Findings

### Blocking
None.

### Non-blocking
1. **ADR § Consequences → "Follow-up (not this story): harden `classify.js` counted buckets to latest-wins per `(asserter, descriptor, target)` … Record as an `_intake.md` / OPEN row at implementation time."** — not recorded: neither `OPEN.md` nor `engineering-team/stories/_intake.md` changed in this diff and neither mentions it. Ask: add the row (either surface) before the epic closes so the orphan-event case named by the compat posture has an owner. Bookkeeping, not code.
2. **`engineering-team/stories/dlist-item-tagging/2-addressable-target-dtag-collision.md` § Deviations, bullet 2** says the fixture defect was "not fixed — Tester's lane", but the same commit (`2417b807`) *did* fix it in `test/event-tagging-a-target-dtag.test.js:245–256`. The sentence is stale relative to the diff. Optional: amend to "fixed in the implementation commit (fixture-only; the pinned behaviour is unchanged)".
3. **`protocols/drafts/event-taggings.md:203`** says "first 16 characters" while the reference implementation truncates to 16 UTF-16 code units (`String.prototype.slice`). The ADR notes this equivalence explicitly; the spec does not. Since `d16` is decoration and readers MUST NOT parse it, a third-party implementer counting code points would still produce a *valid* (merely different-looking) `d` — but two conformant implementations would then mint different addresses for the same (asserter, tag, target) on a non-BMP `d`. Optional: one parenthetical in the spec ("16 UTF-16 code units, i.e. JS `slice(0, 16)`") would pin it. Not blocking — the ADR already records the choice and DList item `d`s are ASCII `slug-hash8`.
4. **ADR § Constraints 8** notes `feat/dlist-item-tagging` is 26 commits behind `origin/staging`. Not this story's problem, but whoever merges should rebase/merge staging first and re-run the five suites — `test/test.js` registration sites are a classic conflict spot.

### Harness friction
None. Story, ADR, and test plan were consistent with each other and with the diff; the test plan's location note (stories/ folder vs the `engineering-team/tests/` outlier) followed the documented convention.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place (`engineering-team/stories/dlist-item-tagging/2-addressable-target-dtag-collision.md`).
- [x] Completion detection performed — reported in chat, not here. Epic `dlist-item-tagging` has Story 3 (`3-tag-a-dlist-item.md`) still open; the book is not complete, so no `/close-book` offer.
