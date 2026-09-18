# Review: ledger-closeout — close what's already finished

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-13
**Diff:** `b415d354` (Implementer phase) — authored 2026-09-13 on `origin/staging` `5a79757e` as
`18737b95`, rebased 2026-09-18 onto `7c06c61e`. Gates below were re-run after the rebase and are
unchanged; the only content change was renumbering the new ledger row (see Quality gates).
**File:** non-numbered by convention — this lane has no story to match (`workflows/0-intake.md` §3).
**Lane:** doc/one-liner (Implementer + Reviewer, Standard strictness). No story / ADR / test plan and
no book by design: the deliverable is records, not behaviour.
**Scope:** `OPEN.md`, `engineering-team/stories/_intake.md`, `docs/HARNESS_REVIEW_HANDOFF_2026-07-02.md`.
No source file, and no harness-definition path, was touched.

## Quality gates (run by reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh` → **clean (0 violations)**, exit 0. Waiver and INFO lines are
      pre-existing and unchanged by this diff.
- [x] `npm test` → **2688 passed, 0 failed, 531 skipped across 199 suites**
      (record `tmp/gate-runs/20260913T200920Z-6172-a052.json`). No Docker stack in this environment
      (`curl -sf localhost:7778/api/concept-graph/summaries` fails), so the live suites skip by
      design. **The 531 skips are reported, not glossed:** ~16.5% of cases did not execute, so this
      run is evidence the records-only diff broke nothing, not evidence the live paths are healthy.
- [x] No CHANGELOG row required: `scripts/harness-def-paths.txt` states that records — `stories/`,
      `reviews/`, `decisions/`, `audits/`, `OPEN.md`, handoffs — are deliberately excluded, so L10
      does not fire on this commit. Confirmed by the clean lint run above.
- [x] L9 (freshness headers) scans only `BIBLE.md` and `OPERATIONS.md` (`harness-lint.sh:224`).
      Neither is touched, and the handoff doc carries no `**Last updated:**` header of its own.
- [x] Ledger structure preserved: 282 rows before → 283 after (one added), every pre-existing row
      number still present, no row deleted, no cell-count change. The nine rows whose raw pipe count
      differs carry escaped `\|` and are none of this diff's targets.
- [x] Row `305` taken as `origin/staging` max (`304`) + 1, per the ledger's own rule. Originally
      minted as `292` against the 2026-09-13 base; **renumbered on the 2026-09-18 rebase** onto
      `7c06c61e`, where another session had since appended row `304`. Both rows kept — the rebase
      conflict in `OPEN.md` was resolved by keeping both sides, per the packet's standing rule.
- [x] This review is non-numbered and ends at its Verdict — no verdict-shaped heading or bold line
      follows it, so `scripts/lib/review-verdict.awk`'s last-token rule cannot misread it
      (the defect tracked as #28 / #272).

## Claims adherence — every flip, with the evidence that verified it

Each row below was checked with its own command before the cell was written. "✓" = the packet's
premise held as stated.

| # | Claim | Evidence | |
|---|---|---|---|
| 13 | Already done 2026-07-06 (PR #338) | Row's own text carries the close; `.github/workflows/test.yml` exists (the R-E3 CI job) | ✓ |
| 12 | Book Closed, epic Done, artifacts retired, branch deleted | `audits/verified-muters/book.md:4` **Closed**; `epics/verified-muters.md:3` **Done**; `done/verified-muters/` 4 stories / 2 decisions / 2 reviews; no live epic folder; `git ls-remote` returns no `feat/verified-muters` | ✓ |
| 23 | Same, for `test-hermeticity-ci` | `book.md:4` **Closed**; `epics/…:3` **Done**; `done/test-hermeticity-ci/` 8 / 1 / 4; no live epic folder; branch absent from origin | ✓ |
| 9, 131, 189 | Every staging-held bundle is in production | `git merge-base --is-ancestor origin/staging origin/main` exits 0 (`5a79757e` ⊆ `89c50385`) | ✓ |
| 57, 63 | Ratified 2026-08-04 into `roles/director.md:83` | Line 83 reads "**Partial reads are pinned mechanically** … *(Ratified 2026-08-04, OPEN.md #133.)*", inside § "The blinded gate-judge protocol"; it pins the read to `sed -n '1,36p'` and forbids the soft "stop at section X" form both rows describe | ✓ |
| 42 | Anonymous `POST /api/firmware/install` refused by default-deny | `src/middleware/auth.js:481` denies every unauthenticated mutation; `:480` `PUBLIC_MUTATIONS` = `/api/neo4j/query`, `/api/strfry/publish` only; the block comment names this endpoint as the former gap. Non-owner half carried by `_intake.md:1800` (2026-07-21), which lists the endpoint at `:1810` | ✓ |
| 134 | "Flip only if the deploy runs are clean" | **Could not be evaluated** — no `gh` and no GitHub API in this session; left OPEN with the reason recorded in-row | ✗ (see Findings 3) |
| 71(a), 127, 168, 223 → 44 | Same stale CLAUDE.md:177 TA-pubkey literal | All four describe the `82b75e47…` literal presented as "this machine"; #44 is the fullest statement. Targets left OPEN | ✓ |
| 106 → 104 | Same flaky `stackAvailable()` probe | Both describe the 2 s fetch + `docker exec` probe flipping H-class between executed and skipped, with a fully-skipped run still reporting PASS | ✓ |
| 272 → 28 | Same `review-verdict.awk` last-token defect | Both describe a CHANGES_REQUESTED review parsing PASS-final from template ordering | ✓ |
| 232 → 213 | Same Playwright chromium-1194 gap | Both: driver 1.56.1 wants build 1194, cache holds 1187/1223/1228 | ✓ |
| 226 → 198 | Same false bind-mount claim in CLAUDE.md § House rules | Both: `docker inspect tapestry` shows named volumes only, no repo bind | ✓ |
| 201, 219 → `bug` | Defects in shipped behaviour, not harness lessons | 201: a successful publish reported as a failure. 219: a red "ISSUES FOUND" banner that means nothing | ✓ |
| 195 → `ops` | Branch/estate management | `feat/tags` carries a cherry-pick whose `test/test.js` will conflict on the next sync | ✓ |
| 115 → `docs` | A product-team doc correction | The falsified claim is in **PRD §2** | ✓ |
| 55 → `cleanup` | Dead-code removal | A term appended to the #43 dead `overallOk` expression | ✓ |
| 24 | "(a) and (c) are done; only (b) remains" | **(c) is NOT done** — see Findings 1 | ✗ |
| 81 | Local branch gone; `origin/feat/nostr-search` exists | `git ls-remote` → `7941e9d5`; 4 commits ahead of `origin/staging`; last commit 2026-03-26; `git branch --list` empty | ✓ |
| :1226 | Story 8 shipped | `src/api/index.js:577` → `eventTags.handleForTag`; `ui/src/pages/Tag.jsx:8,63-66` (`TagNotesView`, the Profiles\|Notes switch) | ✓ |
| :1263 | POV-selectable epic complete | Stories 1–3 reviewed 2026-07-09; ADR `decisions/pov-selectable-tag-surfaces/0001-…`; ledger row **35**, not 38 — see Findings 2 | partial |
| :1550 | Body already says done 2026-07-17 | Body line reads `**DONE** 2026-07-17 — …` — real, but not a marker the parser recognises | ✓ |
| :1659 | Relationship primitives closed | `audits/relationship-primitives/book.md:4` **Closed** | ✓ |
| :1866, :1999 | Both books closed | `audits/shared-concepts-adoption/book.md:4` and `…-legibility/book.md:4` both **Closed** | ✓ |
| :2183 | Reassigned to David, not built here | Body line reads `**REASSIGNED (2026-08-27)**` — again not a recognised marker | ✓ |
| :2252 | Became honest-publish-reporting | Ledger row 200 is **DONE** (2026-09-08) | ✓ |
| :692 | Guard shipped; drain-on-deploy open | `audits/deploy-safety-gate/` exists; `audit.md` §6 Carry-forward register's first item (`closeTaskQueue()` unwired to SIGTERM) is still unchecked | ✓ |
| :1509 | #21/#22/#41 closed; #16/#28/#29/#40 carried | All three read **DONE** (2026-07-25/26); all four others read **OPEN** | ✓ |

## Things tests can't catch

- [x] No secrets, no credentials, no debug output in the diff. No pubkey literal was added — the
      stale `82b75e47…` value stays where it already was, and #44 (left OPEN) is the row that fixes it.
- [x] The un-nesting at `_intake.md` promotes a `###` heading to `##` and adds no text. Per
      `SECURITY.md`, the security note's substance is referenced by pointer only, here and in the
      commit message; no detail is restated.
- [x] **Ordering was load-bearing and was honoured.** `whats-open.sh`'s awk attributes a marker to
      the heading above it, so adding `**RESOLVED**` to the `:2252` parent *before* promoting the
      nested block would have silently swallowed an untriaged security item. The Implementer
      promoted first. Verified after the fact: the note now appears in the unmarked listing under
      its own name.
- [x] Marker effect measured against the real parser rather than assumed: unmarked entries
      **40 → 31**, which is exactly 10 marked minus 1 newly surfaced.
- [x] `**NOT PICKED UP**` is not matched by the parser (it is anchored precisely to avoid that), so
      the three stale ones were demoted to `Originally filed **NOT PICKED UP** — …` rather than
      deleted. No prose was lost anywhere in this diff; every narrow kept the original text and
      appended to it.
- [x] Blank-line convention (`heading / blank / marker / blank / body`) matches the 24 pre-existing
      markers. A first attempt placed the marker above the blank and was reverted from backup and
      redone, not patched over.

## Findings

### Blocking

None.

### Non-blocking

**1. Row 24(c) was asserted done and is not.** The packet's premise was that row 14 fixed
OPERATIONS §9.9 on 2026-09-12. It did not: `git log -p --since=2026-09-10 --until=2026-09-14 --
OPERATIONS.md` shows the only commit, `3b84677d`, referencing §9.9 solely from §2 entries.
`OPERATIONS.md:405` still reads *"all four existing deploy droplets (`brainstorm.world`,
`staging.brainstorm.world`, `magic-carpet.brainstorm.world`, `tags.brainstorm.world`)"* — verbatim
the drift 24(c) describes. Row 24 was therefore narrowed to **(b) and (c)**, not to (b) alone, with
the re-verification recorded in-row. Raised to the operator before writing; the correction was the
chosen option. **Residue for someone else:** row **14**'s own text claims *"§1/§7/§9.9 prose
reconciliation is **FIXED 2026-09-12**"*, which overstates that pass as to §9.9. Row 14 is outside
this packet's touch list and was left alone; it needs a one-line correction.

**2. The `:1263` pointer named the wrong row, though its claim was true.** The packet cited OPEN row
38; row 38 is the post-merge harness reconciliation. The epic's *work* is row **35**
(`DONE-LOCAL` — complete and reviewed 2026-07-09, awaiting operator test → deploy). Row 38 does
carry a real slice of it — the epic *file* was never created on `feat/tags`, waived at
`scripts/harness-lint-waivers.txt:10` — so the marker cites both, distinguishing feature from
harness residue rather than simply substituting one number for the other.

**3. Row 134 could not be evaluated, so it was not flipped.** Its condition was a clean
`gh run list --workflow deploy-tapestry.yml --limit 10`. This session has no `gh` binary and no
GitHub API access (`api.github.com` → *"GitHub access to this repository is not enabled for this
session"*). Per the packet's own "flip only if clean, otherwise note what you saw", the row stays
OPEN with the reason in-row. Worth noting the row is now *less* urgent than when written: it warned
about the batch promotion's staging leg, and row 131 confirms that promotion has landed.

**4. Row 71 was narrowed rather than closed.** The packet listed "71(a)" among the duplicates, but
the row carries a second, uncovered hazard: a host-side `npm install` in `ui/` leaves macOS-only
rollup/esbuild binaries that break every in-container vite build, with nothing enforcing the
reinstall. #44 covers only half (a). Closing the row wholesale would have retired a live item, so
(a) was struck with a cross-reference and (b) kept. Raised to the operator before writing.

**5. One new row, not four.** Of the handoff's §4.1/§4.4 items, only **R-E5** is genuinely
outstanding → row **305**. Two dispositions worth recording rather than filing:
R-E1(b) shipped by a *different mechanism* than recommended — per-agent `permissions:` frontmatter
in `.claude/agents/*.md` instead of `settings.json` deny rules — which satisfies the intent; and its
"drop the gate-judge's Bash entirely, it never legitimately needs it" clause is **superseded**, not
undone, because `roles/director.md:83` — the very amendment closing rows 57 and 63 in this diff —
*requires* the judge to run pinned `sed -n` / `grep -m1` commands. Recording that as an open row
would have been wrong.

### Harness friction

**6. The packet's own premises needed checking, and two of eight didn't hold.** Findings 1 and 2
were both "verified" statements in a triaged work packet that a single command falsified. The
instruction to check each claim with one command before writing it is what caught them; without it
this diff would have recorded a live doc drift as fixed. Not a new harness rule — it is the existing
one working — but worth noting that triage-time verification and write-time verification drifted
apart in under 24 hours.

**7. `_intake.md` nesting is a silent-loss hazard.** A `###` block under a `##` entry is invisible
to `whats-open.sh`, so marking the parent resolved erases the child from every roll-up with no
warning. This diff hit one instance (an untriaged security note filed a day after its parent) and
the packet had pre-identified it — but nothing mechanical would have caught it. Candidate fix: have
`whats-open.sh` warn when a resolved entry contains `###` sub-headings, or state in `0-intake.md`
that a new concern gets a new `##` entry even when it surfaces inside an existing one. Not filed as
a row — it is one line of judgement, and the operator may prefer the convention to the lint.

## Verdict

**PASS**

Every claim written into a record is backed by a command run in this session; the three premises
that did not survive checking (Findings 1–3) are recorded as they actually are rather than as the
packet described them, and the two rows carrying live work (24, 71) were narrowed instead of closed.
Both deviations from the packet's literal instruction were put to the operator before anything was
written. Gates are green: lint clean, suite green with its skip count stated plainly.

One thing the operator must finish: the `Done` cells say `2026-09-13 (ledger-closeout PR)` because
this session could not open the PR (no push credential for this repo), so no number existed to
write. They need the real PR number substituted — `grep -n 'ledger-closeout PR' OPEN.md` finds all
nine.
