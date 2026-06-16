# Epic: Search Quality

**Status:** Active
**Provenance:** Revived 2026-06-16 from the local-only branch `feat/search-eval-harness`. The story + ADR were authored 2026-05-17 by the `Clawds4` agent identity on the operator's machine, committed locally, and **never pushed** — they existed nowhere else until this revival. Idea-seeded by a strategy conversation (search quality is judged only by eyeball today); intended in part as something Vinney could evaluate. Pre-dates epic-scoping, so the story/ADR were renumbered into this epic on revival.

## What this is
The **measurement substrate for search**: an automated, repeatable way to score search-result *quality* so that changes to ranking, WoT weighting, or the search pipeline are caught mechanically rather than by eyeball. v1 is an offline harness that scores **profile** search against a hand-judged gold set; the fixture format is **layered-ready** for the planned Tag→DList WoT search. For a *trust* product, an unmeasured ranking is an integrity risk (regressions in *whose* curation surfaces are otherwise invisible), and this harness is the precondition for safely lengthening agentic-coding autonomy.

## Stories
`stories/search-quality/`:
1. **search-quality-eval-harness** — the offline eval harness: a hand-judged gold set (≥30 queries) + a hand-rolled scorer (recall@k + MRR) driven through the real `/api/search/profiles/meili` proxy against a version-pinned fixture corpus; a PASS/FAIL regression gate (non-zero exit + names the regressed queries) and an auditable per-query report; ships a **non-required** PR-triggered CI workflow. *(Planning + Architecture ratified; a Test Design + Implementation **scaffold** also exists, backed up on `feat/search-eval-harness` — see "Implementation status" below. Unfinished and unmerged.)*

## Implementation status — WIP backed up, NOT finished (2026-06-16)
A substantial Test Design + Implementation **scaffold** for this story already exists, **backed up on branch `feat/search-eval-harness`** (`origin`, commit `e66a3fed`). It was found *uncommitted* in the worktree `tapestry-worktrees/feat-search-eval-harness` during a branch-hygiene pass and committed+pushed so it can't be lost. **It is not merged and not finished** — do not assume the feature works.

- **Done (on the branch):** `nostr-search/eval/` (runner + scorer `recall@k`/`MRR` + gold-entry schema + fixture corpus + `baseline.json`), `test/7-search-quality-eval-harness.test.js` (215-line hermetic suite), a full test plan, `.github/workflows/search-eval.yml`, and the `test/test.js` wiring.
- **Left to do:** the **≥30-query hand-judged gold set** (only seed files `_examples`/`_candidates` exist — the labor-intensive part); then run/verify the suite against current `main`; renumber onto this epic's paths (`test/search-quality-eval-harness.test.js`, `stories/search-quality/1-…test-plan.md`); and pass Review before any merge.
- **To resume:** `git checkout feat/search-eval-harness` (or use its worktree) and pick up at the gold set — or re-run the engineering flow from Test Design with these artifacts as the starting point. The branch is also surfaced by `/whats-open` (unmerged branches).

## ADRs
`decisions/search-quality/` — 0001 (search-quality-eval-harness).

## Related / seeds
- The eval is **observer-relative** (`web-of-trust` / `graperank`): it scores results *for a given observer*, consistent with the three-PoV model (BIBLE §27). The proxy `src/api/search/profiles/meili/index.js` is the documented single authority for PoV resolution.
- A separate, independently-ratifiable **harness-contract ADR** ("every feature ships an executable acceptance check") is referenced by ADR 0001 but tracked **outside** this epic — for the operator + Vinney to ratify on their own.

## Deferred (later phases / not v1)
Concrete baseline value + tolerance (set post-Implementation, once a first run produces numbers); promoting the CI workflow to a required, merge-blocking gate (the separate harness-contract ADR); a production-distribution / real-index-snapshot eval; scoring the layered Tag→DList layers (only the fixture *format* is layered-ready in v1); any label bootstrapping (v1 is hand-judged only, to avoid circularly evaluating WoT search with WoT-derived labels).
