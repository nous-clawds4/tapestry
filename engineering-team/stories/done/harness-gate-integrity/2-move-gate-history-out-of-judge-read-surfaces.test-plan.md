# Test Plan: Story 2 — Move gate history out of judge-read surfaces

**Story:** `engineering-team/stories/harness-gate-integrity/2-move-gate-history-out-of-judge-read-surfaces.md`
**ADR:** `engineering-team/decisions/harness-gate-integrity/0002-move-gate-history-out-of-judge-read-surfaces.md`
**Date:** 2026-08-04

Per the book's classification (`audits/blinding-rebuild/book.md`), Test Design is **folded to the code pieces**: the L14 hygiene check, the stats (b2) tally, and the one S-class def-path assertion. The protocol/doc amendments (AC-1, AC-3, AC-5) are **review-verified** against ADR 0002's implementation notes — the Reviewer's spec-adherence pass is their verification vehicle, and this plan says so rather than pretending a test pins them.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (Gate-1 epic channel) | *review-verified* — director.md `:83/:84/:102` + journal-locality rule per ADR notes 1 | — | review |
| AC-2 (hygiene check) | 7 × `L14: …` tests (positive: story / ADR / epic shapes; guards: mention-vs-use, narrowness, scope, waiver; calibration: corpus-silent with zero waivers) | `test/harness-lint.test.js` | unit (fixture repos) + real-repo |
| AC-3 (commit subjects) | *review-verified* — journal subject convention per ADR notes 1 | — | review |
| AC-4 (partial-read extinction) | `the harness definition no longer instructs judges to read "the acceptance frame section only" — pinned commands instead` | `test/harness-lint.test.js` | S-class (def-path source) |
| AC-5 (role scoping) | *review-verified* — role-spawn line + review-checklist `:62` rewrite per ADR notes 1/3 | — | review |
| AC-6 (stats tally) | 4 × `(b2) …` tests (controlled counts; journalless absence; zero-decision journal; real-repo exact fixture + summary line) | `test/harness-stats.test.js` | unit (fixture repos) + real-repo |

## Output contracts the tests pin (Implementer reads these as spec)

- **L14 violation shapes** (after stripping fenced blocks and inline code spans; scope `engineering-team/{stories,decisions,epics}` minus any `done/` segment and `stories/_intake.md`): (i) a `Supersedes` reference bearing `KICK_BACK|CHANGES_REQUESTED|APPROVE`; (ii) standalone gate/round context (`Gate <n>`, word-boundary `round`) bearing `KICK_BACK|CHANGES_REQUESTED`. Emission: standard `VIOLATION L14 <path> — <msg>` through `violation()`, so waivers and STALE-WAIVER work unchanged.
- **Stats section (b2):** header contains `Direction-mode gate outcomes`; one line per journal-bearing book: `<slug>: APPROVE <n> · KICK_BACK <n> · ANSWER <n> · HALT <n> · INFO <n>`; journalless books absent; summary block gains `direction gates — approve: <n> · kick-back: <n> · halt: <n>`; `exit 0` always (instrument principle).

## Edge cases

- [x] Substring hazard: `Background` contains `round` — shape (ii) must require a standalone word (narrowness test seeds exactly this).
- [x] Fenced code blocks as well as inline spans are mention-exempt.
- [x] Zero-`Decision:` journal → all-zero counts, still exit 0.
- [x] Journalless book absent from (b2), not zero-filled (checked inside the structure-bounded section slice, not the whole output — OPEN.md #109 discipline).
- [x] L14 routes through the existing waiver machinery (`WAIVED L14` + citation).
- [x] No-stack/no-network: all fixtures are temp git repos; nothing touches the Docker stack, relays, or Meili (drift classes #75/#126 structurally excluded).

## Test infrastructure

- Node built-in runner; **both suites already exist and are registered + gated in `test/test.js`** (`:155-156`, `:820-823`) — no runner change, so the implementation phase inherits an empty expected `test/` diff after this commit.
- Fixtures: temp git repos via the suites' existing `withClean()` / `seedFixture()` machinery; `GIT_AUTHOR_DATE`-controlled commits. The real-repo fixture for AC-6 is `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/journal.md` — frozen history; counts verified by direct count 2026-08-04 (APPROVE 17, KICK_BACK 8, ANSWER 5, HALT 3, INFO 15).
- Firmware state: none. Concept graph: not touched.

## Expected-red inventory (#107 discipline: predictions executed, not trusted)

**RED now, 10 tests, confirmed by running both suites** — 6 in harness-lint (4 positive L14 shapes + existence/corpus-silence + AC-4 extinction), 4 in harness-stats (all (b2): section absent). Each fails for the feature-missing reason: exit 0 where 1 was expected / `check_L14 must exist` / the `:83` phrasing still present / `section must exist`.

**Guard-green now, 3 tests, deliberate and documented** (mention-vs-use, narrowness, scope): negative tests are vacuously green until the check exists — they pin the exemptions *once L14 fires at all*, and the positive tests + existence assertion carry the RED. Stated here so nobody mistakes them for coverage today (#59/#108 lesson).

## How to run

```
npm test
```

Suite-scoped (fast RED check):

```
node -e "require('./test/harness-lint.test.js').run().then(r=>console.log(JSON.stringify(r)))"
```

```
node -e "require('./test/harness-stats.test.js').run().then(r=>console.log(JSON.stringify(r)))"
```

## Verification

The new tests fail with the current code. Confirmed 2026-08-04 at commit `e239bb78` (both suites run standalone):

```
harness-lint:  {"pass":35,"fail":6}
  ✗ L14: a bare Supersedes+verdict line in an active story is a violation        (exit 0 — no check)
  ✗ L14: gate/round history with a verdict token in an active ADR …              (exit 0 — no check)
  ✗ L14: an epic file accumulating verdict history …                             (exit 0 — no check)
  ✗ L14 waiver: routes through the standard waiver machinery                     (no WAIVED L14 line)
  ✗ L14 exists and the real repo is L14-silent …                                 (check_L14 must exist)
  ✗ the harness definition no longer instructs judges to read "…frame section only"  (:83 phrasing present)

harness-stats: {"pass":8,"fail":4}
  ✗ (b2) per-book gate tally from journal Decision lines …                       (section must exist)
  ✗ (b2) books without a journal are absent from the section …                   (section must exist)
  ✗ (b2) a journal with zero Decision lines prints all-zero counts …             (section must exist)
  ✗ (b2) real repo: the store-and-show tally is exact …                          (section must exist)
```

All 40 pre-existing tests across the two suites still pass (the 35+8 passing totals include the 3 new guard-green tests) — the extensions regress nothing.
