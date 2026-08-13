# Build Audit: ORE POV Availability

**Book:** `engineering-team/audits/ore-pov-availability/book.md`
**Date:** 2026-08-13
**Branch / commit range:** `d2f9446a..a536002c` (story `41c59c87` → review `f7ccf920` via [PR #549](https://github.com/nous-clawds4/tapestry/pull/549) → staging, [PR #550](https://github.com/nous-clawds4/tapestry/pull/550) → production; post-review doc amendment `a536002c`)
**Provenance:** Acceptance-frame
**Confidence:** high

> The Build Audit is the **as-built record** — what the product *is* now, factual and source-linked. It does not propose changes — that's the seed's job.

## 1. What shipped

- **An informative POV-unavailable refusal on the ORE stats endpoint.** With the personalized-stats gate open, `POST /stats/pubkey` + `graperank-personalized` + an unprovisioned `pov` returns `422` whose `X-Reason` states the unavailability and names the endpoint's registry-derived default algorithm; mirrored in `body.error`; no other POV's scores ever ride under the caller's label — `stories/done/ore-pov-availability/1-pov-unavailable-error-and-upstream-proposal.md`.
- **The never-substitute invariant pinned as tests** (P1–P5, additive) alongside the pre-existing pins (B5 no-fetch, G1–G2 anti-oracle, B4/G3/B12 provisioned-200) — same story.
- **A submission-ready upstream spec proposal** at `protocols/upstream/ore-01-pov-unavailable.md`: ORE-01 "Unavailable pov" normative subsection (422 + MUST-NOT-substitute + `X-Reason` guidance + `202`/`Retry-After` split) plus one restating row for each endpoint Error Codes table (`02.md`–`07.md`), with ready-to-paste PR title/description (`Closes #8`) for the author (wds4) to submit — same story + operator-directed post-review amendment (`a536002c`).
- **The contract documented** on `/developers/open-ranking` (capability-doc caveat, "Point-of-view honesty" conventions paragraph, issue-#8 reference) and aligned in `BIBLE.md:1726`, `protocols/README.md` (new `upstream/` layout line), and worksheet **W12** (dated append; question (2) resolved, auth half untouched).

## 2. Epics & stories rolled up

### Epic: `ore-pov-availability` (Status: Done, retired 2026-08-13)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 pov-unavailable-error-and-upstream-proposal | Informative 422 + never-substitute pins + upstream proposal + docs/tracking | Done | `reviews/done/ore-pov-availability/1-pov-unavailable-error-and-upstream-proposal.md` (verdict recorded there; post-review doc addendum noted in the same file) |

## 3. As-built inventory

- **User-facing:** no new endpoints; `/stats/pubkey`'s gate-open unprovisioned-pov `422` reason enriched (observable only where the operator opens `openRanking.personalizedStats` — default OFF everywhere; production behavior at the shipped default is byte-identical to before). `/developers/open-ranking` page gains the contract section.
- **Domain:** no concept-graph handles touched; no firmware reinstall (none required).
- **Data & contracts:** no wire-format change to responses beyond the reason text; the *proposed* upstream contract (not yet normative) lives at `protocols/upstream/ore-01-pov-unavailable.md`. Code delta: one composed string in `src/api/open-ranking/stats.js:96` (registry-derived via `resolveAlgorithm`, so guidance can't drift from the capability document).
- **Deploys:** staging run `31659486139` (1m27s, smoke clean); production run `31660261212` (1m47s, smoke clean). Safe-to-merge gates: staging attempt 1 safe; prod safe on attempt 5 after waiting out a running `refreshPinnedTagTLs` task.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 5: "Verified: locally and on staging" | Staging verification covered deploy, gate-off default, docs page, bundle proof, regressions; the *gate-on demo specifically* was replaced by test pins + local-stack e2e, because droplet SSH is unavailable from the operator's machine (publickey denied; deploy key lives only in GitHub secrets). Operator ratified the substitution 2026-08-13. | constraint-discovered | Staging cycle report, 2026-08-13 (in-session); retro F1 | None — the shipped default is gate-off everywhere | OPEN.md row 177 (process fix) |
| 2 | Frame bullet 2: upstream proposal = ORE-01 subsection | Proposal extended post-review with one restating row per endpoint Error Codes table (`02.md`–`07.md`) + ORE-08 gap aside, after the operator noticed the tables' restatement pattern (and ORE-04's `topic` missing/cannot-serve precedent) | added-beyond-scope (operator-directed) | Review addendum 2026-08-13; discussion in-session | Stronger, more mergeable upstream proposal; no runtime impact | Rides OPEN.md row 176 (submission) |

**Undocumented work:** none — every hunk in the range traces to the story/ADR or the recorded review addendum.

## 5. Quality state at close

- Test gate at close (final tree, post epic-move): `npm test` — **Overall PASS** (`open-ranking-stats` 29/29; 53 pre-existing live-stack skips). Recorded from the close-time run, exit 0.
- Known open issues: pre-existing cosmetic JSX spacing nit "(malformed JSON),422" on the docs page (review non-blocking finding #1; one-char fix if wanted). Upstream-wording drift risk accepted (ADR §Consequences): if the merged spec text diverges, our `X-Reason` deserves a cosmetic re-phrase.
- Debt: none new. ADR `open-ranking/0005`'s gate (W12 auth before any public gate-open) unchanged and re-verified (G1/G2 + live checks on staging and prod).

## 6. Carry-forward register

- [ ] **Upstream submission (wds4's act):** fork, apply, open the PR from `protocols/upstream/ore-01-pov-unavailable.md` — OPEN.md row 176. Post-merge: align `X-Reason` phrasing if upstream edits (ADR §Consequences).
- [ ] **ORE-08 pov-row gap:** flagged as an aside in the PR description; whether to fix it upstream is the maintainer's call — rides the PR conversation.
- [ ] **W12 auth (the enumeration oracle):** unchanged by this book; still the blocker before `openRanking.personalizedStats` can be enabled publicly (worksheet W12 question (1); ADR `open-ranking/0005`).
- [ ] **NosFabrica adoption:** the actual silent-fallback fix on brainstorm.world — **client first** (les-femmes-orange must handle the error and re-request global explicitly), then flip the provider. Separate effort, likely its own session/book (operator's stated plan).
- [ ] **Personalized search** (retired open-ranking epic Story 3 / worksheet W13): pre-existing deferral, untouched here.

## 7. Process findings (harness)

Retro inputs: review "Harness friction" (none recorded), in-session staging report, no Direction journal (human-gated book), no prior meta rows from this book. `harness-stats.sh` at retro time: 883 phase commits, 171 reviews decided (kick-back rate 1%), books 4 open / 35 closed, cycle-time median same-day — no anomaly signal for this book (all phases same-day, zero kick-backs).

| Finding | Source | Terminal state |
|---|---|---|
| A PR test plan promised a staging verification the session couldn't perform (droplet state-flip needs SSH that exists only in GH Actions secrets); OPERATIONS §5's staging entry also lacks IP/specs, so the address came from DNS. Ports to both flows — a Direction-mode run would have halted on the same wall. | Staging cycle report 2026-08-13; deviation #1 | OPEN.md `meta` row **177** |
| Harness otherwise ran clean this book: orientation docs accurate, ports/paths correct, no gate friction (review recorded "none"). | Review § Harness friction | declined (nothing to fix — recorded for the stats trail) |
