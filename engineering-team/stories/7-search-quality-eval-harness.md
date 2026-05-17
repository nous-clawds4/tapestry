# Story 7: Offline search-quality evaluation harness

**Status:** Approved
**Created:** 2026-05-17
**Type:** Feature

## Background
Search quality in this project is currently judged by human eyeball — there is
no automated, repeatable measure of whether a change to ranking, the WoT
weighting, or the search pipeline made results better or worse. This makes every
search-affecting change unfalsifiable without manual spot-checking, and it is the
binding constraint on (a) safely increasing how much search R&D can run without
per-decision human approval, and (b) any trustworthy measurement of the planned
layered Tag→DList WoT search. Because this is a *trust* product, an unmeasured
search ranking is also an integrity risk: regressions in whose curation surfaces
are invisible. Affects everyone who changes search (engineers and the agentic
harness) and, indirectly, every brainstorm.world search user.

## User-facing description
As an engineer or the engineering-team harness changing anything that affects
search, I want an automated score of result quality against a fixed, human-judged
query set, so that a regression is caught mechanically before it ships rather
than discovered by eyeball or in production.

## Acceptance criteria
Testable from the outside. Each criterion gets at least one test.

- [ ] Given the committed hand-judged gold set, when the harness is run, then it
      produces a single overall quality score **and** a per-query breakdown,
      reporting the search corpus/index reference it ran against.
- [ ] Given an agreed baseline score and tolerance, when a run's overall score is
      below baseline beyond tolerance, then the run reports FAIL, exits non-zero,
      and lists exactly which queries regressed; when at/above baseline it reports
      PASS and exits zero.
- [ ] Given a gold-set entry that includes tag-layer and dlist-layer expectation
      fields, when the harness loads it, then the entry validates and runs
      (the not-yet-implemented layers are accepted and ignored, never rejected),
      and the v1 score reflects profile-search results only.
- [ ] Given a completed run, when an engineer inspects the per-query report, then
      for each query it shows the query text, the observer/WoT context, the
      returned results, and which judged-relevant items were hit vs missed —
      enough to audit *why* the score is what it is.
- [ ] The harness ships with a seed gold set of **at least 30** hand-judged
      queries, each carrying its observer context and human relevance labels,
      committed to the repo.

## Concepts touched
The Concept Graph API was not queried during Planning (requires the running
control panel; the Architect should orient via `/api/concept-graph/summaries`
per AGENTS.md before designing).

- `web-of-trust` — relevance is observer-relative; the eval must score results
  *for a given observer*, not globally.
- `graperank` — the trust-scoring whose effect on ranking the harness measures.
- Search-quality / relevance-eval is **not** a modeled concept today (consistent
  with ADR 0003: Meilisearch/search internals are unmodeled). The Architect
  confirms whether a new handle is warranted.

## Out of scope
- **Metric choice and scorer implementation** (nDCG / MRR / recall / etc.) —
  Architect's decision in ADR 0004.
- **How the gate is wired into CI**, including introducing any PR-triggered CI
  workflow — Architecture + its ADR (this is net-new tooling, gated by the
  CLAUDE.md "no new tooling without an ADR" rule).
- **Bootstrapped or auto-generated relevance labels** — explicitly rejected for
  v1; hand-judged only (avoids circularly evaluating WoT search with WoT-derived
  labels).
- **Implementing layered Tag→DList search, or scoring those layers** — only the
  *fixture format* is layered-ready in v1; scoring is profile-search only.
- **The engineering-team contract change** (a general "every feature ships an
  executable acceptance check" rule) — tracked as its own separate,
  independently-ratifiable ADR; NOT part of this story.
- **Ongoing baseline governance** — v1 establishes the gate mechanism and one
  initial agreed baseline; how the baseline is raised over time is deferred.
- **Merging to staging/main** — this ships as a draft PR for evaluation;
  promotion is out of scope.

## Open questions
Non-blocking for story approval; flagged so they aren't lost:

- The concrete **baseline value and tolerance** can't be fixed until the metric
  exists and a first run produces numbers — the *mechanism* is in scope now; the
  *number* is set during/after Implementation.
- Whether the ~30 seed queries should deliberately target known-weak areas
  (e.g. the documented Meilisearch panic-class queries) or aim for representative
  coverage — a labeling-strategy question, resolvable in Test Design.

## Linked artifacts
- Intake: `engineering-team/stories/_intake.md` — 2026-05-17 entry
- ADR: (filled after Architecture — expected `decisions/0004-*.md`)
- Separate harness-contract ADR: tracked independently of this story; not a
  blocker for it
- Test plan: (filled after Test Design phase)
- Review: (filled after Review phase)
