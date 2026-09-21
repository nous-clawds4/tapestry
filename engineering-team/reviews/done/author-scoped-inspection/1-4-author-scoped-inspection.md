# Review: Stories 1–4 — author-scoped inspection on Active b-tags

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-20
**Diff:** `git diff staging...HEAD` (implementation commit `532ecb0f`, branch `feat/author-scoped-inspection` off `staging` `a55b9631`)

One review for the book's four stories: they share two ADRs, one page and one fetch, and stories
2–4 are indivisible in the diff.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — run `20260920T233654Z-13297-461a` on `532ecb0f`: **FAIL, exit 1, 3442 passed,
      6 failed, 59 skipped, 211/211 suites**; failed: `harness-lint`,
      `tl-membership-method-selector`, `tl-weighted-sum-method`, `tl-certainty-method`,
      `summaries-element-count`.

      **Read the six honestly — one of them is mine, and it is already gone.**

      - **Four are pre-existing**, byte-identical to the `06:06` baseline taken before this book
        began (`tmp/gate-runs/20260920T060602Z-16829-80d9.json`: 208 suites, 3371 passed, the same
        5 failures with the same per-suite counts). `tl-*` belong to the open `tl-weighted-certainty`
        book. This book added **3 suites and +71 passing assertions** and broke none of them.
      - **`harness-lint` failed for a condition this review created and then removed.** L1 fired
        because a PASS-final review existed while the stories still read `Status: Approved` — the
        exact half-finished state the rule is designed to catch, and it caught me. The stories were
        flipped to `Done` in this same commit; re-run afterwards, the suite is **76 passed / 0
        failed** and `bash scripts/harness-lint.sh` is clean. **The gate run above captured the
        pre-fix moment and its `harness-lint` line is therefore stale by design** — recorded rather
        than re-run so the sequence is legible, since a clean re-run alone would hide that the rule
        fired at all.
      - Net of both: **zero regressions attributable to this book.**
- [x] `npm run test:playwright` (`tests/brainstorm/author-scoped-inspection.spec.js`, chromium) — **13 passed**, 0 failed.
- [x] Suites re-run individually: `author-scoped-inspection-roster` **15/15**, `author-scoped-inspection-views` **23/23**.
- [x] `bash scripts/harness-lint.sh` — clean (0 violations).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._ (`npm --prefix ui run build` succeeds; the bundle is deployed to the container by `docker cp`, there being no source bind mount.)

## Spec adherence

Every AC is covered and passing. Two are smoke steps by design (the test plans say so), and I
re-measured both myself rather than taking the Implementer's word.

| Story | AC | Evidence |
|---|---|---|
| 1 | AC-1 roster shape | H1, H2; live read of `/api/assistant/roster` |
| 1 | AC-2 provisioned assistant | H2, H5 (owner row agrees with `/api/assistant/pubkey`) |
| 1 | AC-3 unprovisioned → `null`, present | U2, H2 (`hasOwnProperty` check) |
| 1 | AC-4 no private key material | U3, S3, H4 — **and** an independent four-caller probe (below) |
| 1 | AC-5 per-deployment | H5 + my own staging read (`8e901369…` ≠ local `11f23fe4…`) |
| 2 | AC-1 every author | S1, E2 |
| 2 | AC-2 author column | S4, S9, E3 |
| 2 | AC-3 sentinel still skipped | R1, E13 |
| 2 | AC-4 description rewritten | S5 |
| 2 | AC-5 counts | **re-measured independently** — see below |
| 3 | AC-1…AC-6 | P1–P8, E1, E4–E9 |
| 4 | AC-1…AC-5 | S3, S6, S7, S8, S10, E10–E12 |

**AC-5 re-measured by the reviewer**, not accepted as reported. Local: **13 → 17**, external authors
`253d40c4…`, `82b75e47…` (×2), `919ba08a…` — exactly 4, exactly as named. Story 4's figures:
local **4 of 13 shown / 7 of 17 held**; staging **3 of 10 / 6 of 24**. Every corrected figure in the
story, epic, ADR 0002 and test plan matches what I measured. The Planning-era figures (12 → 16)
were genuinely stale — the relay gained one owner-assistant row mid-book — and the **delta of four
is unchanged**, which is the part the AC actually constrains.

## ADR adherence

Module boundaries, layering and dependencies all match; **no new dependencies**. Three departures
from the ADRs' Implementation notes, all improvements, all documented in code comments and the
implementation commit, **none recorded in the ADRs themselves** — listed here because the ADR is the
agreed contract and a later reader should not have to diff to find them:

1. **`decisions/…/0001…md:144`** says the handler, for a session pubkey absent from the rows,
   should "append its own row". It does not — the pair rides in `viewer` only. The handler's own
   comment gives the reason, and it is a good one: the appended row would need a `role`, and the
   only role inferable for a caller the roster withholds is a guess. **Better than specified.**
2. **`decisions/…/0002…md:137`** says the provider "fetches `/api/assistant/roster` once on mount".
   It fetches on mount **and** re-fetches when the session pubkey changes, so an in-page
   login/logout re-shapes a session-shaped response. **Necessary, not optional** — without it a
   logged-in reader keeps a stranger's roster.
3. **Not in either ADR:** the page withholds its selectors and table until the roster answers
   (`ActiveBTags.jsx:236`). This fixes a real defect — the table painted "Everyone" and then snapped
   to the reader's own scope. Caught by E4 during implementation.

## Concept-graph integrity

- [x] No concept definitions changed; **no firmware reinstall required**, and none performed.
- [x] Handles remain `kind:pubkey:slug`; the `39998:<TA>:tapestry-assistant` concept is referenced
      as future context only and is not written.
- [x] **No 64-hex literal in any added source line** (verified over the `src`/`ui` diff with a live
      positive control). Every assistant pubkey is runtime-resolved, which this book stresses harder
      than usual: several are in play at once.

## Things tests can't catch

- [x] **No secrets.** The one `privkey` occurrence in the diff is a JSDoc in
      `src/utils/assistantKeys.js` explaining why the resolver returns a string. No `nsec1`, no
      `debugger`, no `console.log` added to `src`/`ui`.
- [x] **The security claim, probed independently.** H3 ("an unauthenticated read discloses no
      admin") **passes vacuously on this instance** — `BRAINSTORM_ADMIN_PUBKEYS=""`, so there is no
      admin to disclose, and the gate itself is unexercised. I forced one into existence with a
      stubbed config and called the handler four ways:

      | caller | roles returned | admin pubkey present | key material |
      |---|---|---|---|
      | unauthenticated | `[owner]` | no | none |
      | a stranger | `[owner]` | no | none |
      | **the admin themselves** | `[owner]` | no (own pair via `viewer`) | none |
      | **the owner** | `[owner, admin]` | **yes** | none |

      That is ADR 0001's table exactly. The gate is correct. **The suite does not demonstrate it** —
      see non-blocking finding 1.
- [x] **The Phase-4 test edit is legitimate and does not weaken the suites.** Operator-authorized.
      I checked the replacement scanner in both directions rather than only the one that was
      failing: real code satisfies the assertion, a line-comment or block-comment *containing the
      same text does not*, and line offsets are preserved. A stripper that had quietly stopped
      blanking comments would make every structural assertion satisfiable by prose; this one does not.
- [x] **Opt-in props are genuinely opt-in.** `DataTable.jsx:149` yields `''` with neither prop and
      `'clickable'` with only `onRowClick` — byte-identical to the prior expression for the other
      24 callers. `TagDetailPanel` renders nothing without `note`.
- [x] **CSS ordering is a decision, not an accident.** `.data-table tbody tr:hover` (`styles.css:377`)
      and `.data-table tbody tr.row-self-declared` (`:386`) have **equal specificity** (0,2,2), so
      source order decides and the marked rule is placed second deliberately; the `:hover` variant
      at `:387` is (0,3,2) and wins over both, which is what keeps the row's hover feedback. E12
      checks both directions empirically.
- [x] **Race conditions.** Every fetch effect carries a `cancelled` flag. The person default is
      applied once and guarded by `chosen`, so a later roster refresh cannot overwrite a reader's
      own selection.
- [x] **Invariants.** Narrowing is applied at render over one fetch (#3 — `queryRelay` is still
      called exactly once, pinned by R2). Nothing is POV-namespaced or stored per person (#1).
      Foreign-authored events are displayed, never validated for authorship (#2). No storage,
      rebuild or backup path is touched (#4).
- [ ] **Version skew is unhandled** — non-blocking finding 3.

## House rules check

- [x] Concept Graph API authority respected (oriented via `/summaries`; no BIBLE re-read for a
      concept in the graph).
- [x] No new lint/typecheck/build tooling.
- [x] Per-deployment TA pubkey rule honored throughout.

## Findings

### Blocking

None.

### Non-blocking

1. **`test/author-scoped-inspection-roster.test.js` (H3) — the book's central security claim is
   asserted but not demonstrated.** H3 passes because this instance has no admins, and S4 is a
   source-read proxy (it checks that `includeAdmins` and `BRAINSTORM_OWNER_PUBKEY` *appear* in the
   handler, not that they are wired the right way round). An inverted gate — `includeAdmins =
   !isOwner` — would pass every test in the suite. I verified the gate by hand and it is correct,
   but that verification lives in this review rather than in the suite. *Asked change (follow-on,
   not this book):* a stubbed-config unit test over `handleGetAssistantRoster` asserting the
   four-caller matrix above. The probe is reproducible from this review's table.

2. **`ui/src/pages/shared-concepts/ActiveBTags.jsx:145` — the client fabricates `role: 'admin'`
   for a viewer the roster does not list.** This is the same guess the implementation deliberately
   *removed* from the server handler, reintroduced on the other side of the wire. It is inert
   today: `classifyAuthor` reads only the two pubkey fields, `personLabel` short-circuits on
   `viewer` before reaching `role`, and the fabricated row is filtered out of the option list. But
   it is a false value in a shared structure, and the next reader of `scopeRoster[].role` inherits
   it. *Optional improvement:* use a neutral marker (`role: 'viewer'`) or omit the field.

3. **UI/server version skew degrades silently.** If the bundle ships without the server half,
   `/api/assistant/roster` 404s, `AssistantRosterContext` catches, and the page falls back to
   `{assistants: [], viewer: null}` → person `null` → **Everyone**, with no Owner or Mine option
   and no indication anything is missing. That is the opposite of the intended default and shows
   every author to every reader. Not reachable through the normal deploy chain (both halves ship
   together, and the epic already marks stories 2–3 a shipping pair), and arguably the least-bad
   degradation, but it is undetectable from the page. *Optional improvement:* surface roster
   failure as a notice rather than as silence.

4. **`getAssistantPubkeyFor` rejects a non-64-hex pubkey by returning `null`.** Correct and
   deliberate — the guard exists because `getAssistantKeys` compares against a config read that is
   `null` when `brainstorm.conf` is absent, so a `null` pubkey would compare equal to a `null` owner
   and route to the owner's key slot. Worth noting only because it is a *latent bug in
   `getAssistantKeys`* that this story routes around rather than fixes. Out of scope here; a
   candidate ledger row if anyone else calls it with untrusted input.

### Harness friction

1. **A vacuous negative nearly reached this review.** My first secrets/debug sweep piped
   `git diff | grep -nE '<pattern>' | grep '^+'` — `grep -n` prefixes each line with `NNN:`, so the
   downstream `^+` filter can never match and the sweep reported "clean" having searched nothing.
   Caught only because OPEN.md row 342 requires a positive control through the *same* pipeline: the
   control printed nothing too, which is what exposed it. Rerun with the `^+` filter first, the
   control returned 17 matches and the negative held. **No new row needed** — this is row 342's
   rule working as designed, and its worked example is now one case richer.

2. `ledger/2026-09-20-comment-stripper-eats-wildcard-route.md` was filed during implementation for
   the stripper defect. Verified accurate: five other suites still carry the naive regex, and
   `git grep` confirms none of them reads `src/api/index.js` today.

## Verdict

**PASS**

Four stories, every acceptance criterion covered by a passing test, the two live-data criteria
re-measured by me rather than accepted. The security posture at the centre of ADR 0001 is correct
under an independent four-caller probe, and no key material reaches any response. The three ADR
departures are each an improvement on what was specified and each is explained where a reader will
find it. The four non-blocking findings are all follow-ons: one test-coverage gap over a gate I
verified by hand, one inert fabricated value, one silent-degradation path unreachable through the
normal deploy chain, and one pre-existing latent bug this story routes around.
