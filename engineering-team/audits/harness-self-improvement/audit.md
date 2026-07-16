# Build Audit: Harness Self-Improvement Loop

**Book:** `engineering-team/audits/harness-self-improvement/book.md`
**Date:** 2026-07-04
**Branch / commit range:** `66b52cdf..aa555f29` (+ the book-close retro commit) on `claude/tapestry-harness-review-0o42an` (PR #337, base `staging`)
**Provenance:** Acceptance-frame
**Confidence:** high

> As-built record of the recursive self-improvement loop (harness review §5 + R-E1/E2 + R-S1–S4), built through the harness's own five-phase cycle — 7 stories, 7 ADRs, 7 PASS reviews, every gate operator-ratified in-session.

## 1. What shipped

- **Enforce:** `scripts/harness-lint.sh` — invariants L1–L11 (verdict↔status, book↔epic, story↔epic, review↔story, portability, verdict vocabulary, link integrity, freshness headers, changelog-touch, line budgets), cited-waiver file, `/whats-open` section — `stories/harness-self-improvement/1-harness-lint.md`
- **Ratify:** `engineering-team/CHANGELOG.md` (origin column, 17 rows reconstructed + one per story since) + `scripts/harness-def-paths.txt` (self-listing definition of "the harness") + lint L10 (def-path commit must touch the changelog) + `/whats-open` divergence notice — `2-harness-changelog.md`
- **Route:** the book-close post-mortem/retro (workflow 6 step 7, **no-fourth-state rule**), build-audit §7, review-checklist "Harness friction" section, product Phase-7 mirror, origin-drift preflight in workflows 1–2 — `3-close-book-retro.md`
- **Capture/escalate:** OPEN.md `meta` rows as the single inbox; `collect_meta` banner at ≥3 open or >30d (thresholds single-sourced); CLAUDE.md capture sentence (budget-neutral) — `4-meta-escalation.md`
- **Measure:** `scripts/harness-stats.sh` (phase commits, verdict tallies + kick-back + churn via the shared last-token parser `scripts/lib/review-verdict.awk`, book throughput, slug-matched cycle times with an honest coverage line) — `5-harness-stats.md`
- **Enforcement matches claims:** `.claude/settings.json` SessionStart hook → `scripts/session-start.sh` digest (lint + meta state via shared `scripts/lib/collect-meta.sh` + ≤2s stack probe + open books, always exit 0); allow-list-only Write/Edit scoping on the six writing product agents; Bash removed from the two advisory agents; role-isolation claims reworded to exactly what is enforced at five sites — `6-enforcement.md`
- **Session-start economics:** CLAUDE.md per-task pointer table (191→190 lines), AGENTS.md probe-and-fallback ladder + stack-free card (98→102), README 4-step contributor orientation, dead `concept-graph` checkout removed, `scripts/harness-budgets.txt` + L11 (caps 190/102, exact, def-path-recorded) — `7-session-start-restructure.md`

## 2. Epics & stories rolled up

### Epic: `harness-self-improvement`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 harness-lint | invariant guard L1–L9 + waivers + roll-up wiring | Done | `reviews/harness-self-improvement/1-harness-lint.md` (PASS) |
| #2 harness-changelog | ratified-change record + def-path set + L10 + divergence notice | Done | `…/2-harness-changelog.md` (PASS) |
| #3 close-book-retro | no-fourth-state retro step + §7 + preflight + product mirror | Done | `…/3-close-book-retro.md` (PASS) |
| #4 meta-escalation | banner + Meta section + single-sourced thresholds + capture rule | Done | `…/4-meta-escalation.md` (PASS) |
| #5 harness-stats | measurement instrument + shared verdict parser | Done | `…/5-harness-stats.md` (PASS) |
| #6 enforcement | hook + digest + collect-meta lib + permissions + honest claims | Done | `…/6-enforcement.md` (PASS) |
| #7 session-start-restructure | pointer table + ladder + budgets/L11 + onboarding | Done | `…/7-session-start-restructure.md` (PASS) |

## 3. As-built inventory

- **Session surfaces:** SessionStart hook (`.claude/settings.json` → `scripts/session-start.sh`, verified firing live in-session on `resume`, both quiet and banner states); `/whats-open` sections (meta banner + Meta items, harness-definition divergence, harness invariants); `scripts/harness-stats.sh` on demand.
- **Data files (all def paths):** `scripts/harness-def-paths.txt` (self-listing), `scripts/harness-lint-waivers.txt` (4 waiver groups, each cited), `scripts/harness-budgets.txt` (caps 190/102 + the R-S4 rule prose), `scripts/long-lived-branches.txt` (pre-existing).
- **Shared libs:** `scripts/lib/review-verdict.awk` (lint + stats), `scripts/lib/collect-meta.sh` (whats-open + digest; thresholds + banner wording single-sourced).
- **Process docs:** workflow 6 step 7 (retro), workflows 1–2 step 0 (preflight), workflows 1–5 per-phase commit slug convention (retro bundle), build-audit §7, review-checklist Product-guide/Harness-friction/On-PASS sections, OPEN.md § meta rules, README § Tuning-the-team touch-rule.
- **Agents:** 6 writing product agents permission-scoped (allow-only, `product-team/**` + `OPEN.md`); `product-advisor`/`product-expert` Bash-less; `gate-judge` untouched (kept Bash, gate decision).
- **Tests:** 44 harness tests in 3 suites — `test/harness-lint.test.js` 28, `test/harness-stats.test.js` 8, `test/session-start.test.js` 8 — registered at the four `test/test.js` anchors.
- **Domain:** none — no concepts touched, no firmware reinstalls, no event kinds, no API routes. The stack is probed, never required.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame b1: "each waiver citing an OPEN.md row" | Waivers cite a row **or** a reason | interpretation | ADR 0001 ratified row-or-reason; a reason-cited waiver is still visible every run (review 1 non-blocking 1 reconciled here) | none — auditability preserved | — |
| 2 | Frame b7: hook runs "whats-open.sh + harness-lint.sh" | Compact digest (lint + meta + probe + books), NOT whats-open wholesale | intentional-change | story-6 gate decision 1 + ADR 0006: whats-open does network (git fetch, gh); context economics | digest is smaller; full roll-up one command away | — |
| 3 | Frame b7: Write/Edit scoped "to product-team/" | `product-team/**` **+ root `OPEN.md`**, allow-list-only (no ask/deny) | constraint-discovered | product Phase-7 retro legitimately writes the ledger (story 3); bare-ask-vs-specific-allow precedence contested across CLI versions (ADR 0006) | scoping honest-by-mode, documented at the claim sites | — |
| 4 | Frame b8: "neither CLAUDE.md nor AGENTS.md exceeds its **pre-book** line count" | CLAUDE.md 190 ≤ 191 ✓; AGENTS.md **102 > 98**, cap frozen at 102 | intentional-change | the same bullet demands AGENTS.md *carry the ladder*; the two demands conflicted by 4 lines. Story-7 gate ratified caps = post-restructure sizes (ADR 0007) | combined always-loaded budget 292 lines, now lint-frozen | — |
| 5 | (not in frame) | whats-open `def_paths` bash-3.2 guard fix folded into story 6 | added-beyond-scope | story-2 review non-blocking carry-over, dispositioned at story-6 planning | none | — |

**Undocumented work:** none found — every diff hunk in the book range rides a story commit with ADR provenance (walked per-story at each review; re-spot-checked at close).

## 5. Quality state at close

- **Test gate at close:** the 3 harness suites 44/44 green. Full `npm test` overall-FAIL is the **pre-book stack-dependent baseline** (OPEN.md row 13: ~12 live-API suites need the local stack; none available in remote sessions) — failing-set parity verified at every story review and again at close. No regression attributable to this book.
- **Lint at close:** `bash scripts/harness-lint.sh` exit 0, clean — 4 waiver groups, every one cited (rows 16 / tq#22 rationale / cycle-local ownership); L11 live with both capped files exactly at cap.
- **Known open issues:** OPEN.md rows 13 (hermeticity/CI), 16 (live-feed backfill — holds two L4 waiver groups + one L2), 19 (BSD-date age trigger, new at this retro).
- **Debt logged by ADRs:** per-epic stats attribution is floor-semantics heuristic (ADR 0005); permission scoping is honest-by-mode (ADR 0006); line caps are a token-budget *proxy* (ADR 0007).

## 6. Carry-forward register

- [ ] **CI test job (R-E3)** — blocked on the stack-free/live-API suite split; OPEN.md row 13. The single biggest gap between "self-checking" and "self-checking without a human running anything."
- [ ] **BSD-date fallback in `collect-meta.sh`** — OPEN.md row 19 (the >30d trigger is count-only on macOS today).
- [ ] **live-feed post-close disposition** — OPEN.md row 16; retires one L2 + four L4 waivers when done.
- [ ] **ROADMAP/OPERATIONS content refresh** — OPEN.md rows 14–15 (out of this book's frame; the pointer table now sends readers there, raising the cost of their staleness).
- [ ] **Startup-source digest check** — hook firing verified live on `resume`; the `startup` source self-verifies the next fresh session (its digest either appears or doesn't). Formality, no row.
- [ ] **If a third file is ever budget-capped** — add a STALE-BUDGET-style malformed-row INFO to L11 (review 7 non-blocking 2).

## 7. Process findings (harness)

*First live run of the workflow-6 step-7 retro (frame bullet 9). Stats cited at retro time: **407 phase commits · 81 decided reviews · 2% kick-back-final, churn 2 · books 2 open / 8 closed · cycle median 0d (same-day) · 76 of 95 stories matched.** Every finding below has exactly one terminal state — no fourth state. "This commit" = the `book-close: harness-self-improvement` commit carrying this audit; ratification = the operator's yes at the close gate.*

| Finding | Source | Terminal state |
|---|---|---|
| Review tq#22's "**PASS stands**…cannot pass" phrasing defeats the last-token verdict rule; machine-readable `**Verdict:**` line proposed | story-1 Deviation 1, review-1 NB3 | **declined** — the cited L1 waiver documents the one known misread visibly on every lint run; a new convention (template + parser + every future review) isn't warranted by a single historical edge. Revisit on a second misread. |
| Frame says waivers cite an OPEN.md row; shipped format allows row-or-reason | review-1 NB1 | **declined** — ADR 0001's ratified format stands; reconciled as deviation §4-1 (the frame bullet, not the tool, was over-specified). |
| 19 pre-book stories unmatchable by stats' cycle-time matcher — the coverage gap argues for a commit-slug convention (ADR 0005 Option C) | review-5 friction, stats coverage line | **ratified commit (this commit)** — `(<epic> #<n>)` slug convention written into workflows 1–5 per-phase-commit sections. Already practiced (this book matched 7/7); now normative. Prospective only — history stays honest in the coverage line. |
| gate-judge keeps Bash — revisit promised at retro | story-6 gate decision 2 | **declined** — the judge runs `npm test`/lint itself as rubric steps; Bash is load-bearing. Labeled trust-based in the rewording. |
| `whats-open.md` step 2 restated the ≥3/>30d thresholds the lib single-sources | story-4 note, resurfaced at story-6 extraction | **ratified commit (this commit)** — command file now quotes-and-points at `scripts/lib/collect-meta.sh`. |
| stats: dead verdict `case` + median `0d` needs same-day reading guidance | review-5 NB1+NB2 | **ratified commit (this commit)** — dead case removed; median line reads "(0d = same-day)". |
| `design-architecture.md` house rule ("ask the user to bring the stack up") contradicts the AGENTS.md §2 ladder | review-7 NB1, OPEN.md row 18 | **ratified commit (this commit)** — repointed to the ladder; row 18 flipped DONE. |
| SessionStart fires on `resume` too — AC-7's "this session can't observe the hook" assumption was wrong in a useful direction | review-6 friction observation | **declined (no change)** — beneficial; recorded in review 6. Deferred-verification pattern still valid for true startup-only effects. |
| Digest's `PORT=7778` fallback restates the constant `cycle-local` canonically owns | review-6 NB1 | **declined** — ADR-sanctioned AGENTS.md §1 discovery default; unify only if the default ever changes. |
| `collect-meta.sh` age computation is GNU-date-only → >30d trigger dead on macOS | review-6 NB2 | **OPEN.md row 19** — candidate BSD `date -j -f` fallback in the lib (one place). Not rushed into the close commit. |
| L11 silently skips a malformed (space-separated) budgets row | review-7 NB2 | **declined** — the JS suite independently parses both real rows and fails on absence; revisit if a third capped file is added (noted §6). |
| L5 matches `localhost:<port>` only; `127.0.0.1:<port>` shape would pass | review-1 NB2 | **declined** — drift class never observed in the repo; extend when first seen. |
| **First live escalation:** row 18 pushed open `meta` to 3 → banner fired; triage owed a disposition | review-7 friction, the banner itself | **ratified commit (this commit)** — heterogeneous items disposed individually, not grouped into one story: row 18 fixed (above); **row 9 re-typed meta→docs** (opened 2026-06-19, *before* story 4 defined `meta` = harness lessons; it is a prod-sequencing hold — flagged plainly for operator ratification, since re-typing quiets the banner); row 19 opened fresh. Post-retro: 2 open metas, banner quiet, both under 30d. |

**Ports to the other flow?** The commit-slug convention and threshold-quoting fixes live in shared workflow/command files — both flows inherit them. Direction mode additionally consumes this retro machinery via its Director → post-mortem routing (workflow 6 step 7 note); nothing found that needs a Direction-only mirror.
