# Review: Story 2 — Ratify instance identity — the TA is the instance's "me"

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-06
**Diff:** `git diff 2e656a2f..HEAD` (commits `aee082b3` story+book, `9c301b27` ADR, `1ccd1fca` implementation)
**Mode:** Docs-mode (Protocol-Spec Workflow phase 3) — no test plan by design; this audit is accuracy + cross-reference consistency + regression gates, per `workflows/protocol-spec-workflow.md`.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **run independently by the Reviewer** (2026-08-06, strfry-router quiesced per OPEN.md #75, restored after): every suite green **except one pre-existing failure** — `show-the-four` S5 (34 passed, 1 failed, 2 skipped), the `ui/src/App.jsx` route-count pin (expects 108, finds 116). Verified independent of this diff: `git diff origin/staging -- ui/ test/` is **empty** (the branch's code and test surfaces are byte-identical to the staging base), and the 8-route delta traces to the Shared Concepts area (PRs #491–#494, commits `ace13982`/`5c4d962d`), merged before this story's first commit. The Implementer's run found the identical single failure; ledger row **OPEN.md #143** (meta) records it with the fix direction (tester-lane re-pin in the `goal-intent-fields` suite — deliberately not smuggled into this docs story, per ADR 0002's scope). **No regression from this change** — the docs-mode gate this workflow specifies.
- [x] `bash scripts/harness-lint.sh` — clean (0 violations), re-run by reviewer post-implementation.
- [x] `npm run test:playwright` — N/A (docs-only; no UI surface changed).
- [x] _Lint/typecheck/build not configured — skipped._

## Spec adherence (story ACs, audited by inspection)

- [x] **AC1** §31 exists as §30's sibling (`BIBLE.md:1830`), states the doctrine (instance = its own person; TA pubkey = its key; Owner = distinct correspondent privileged in trust, not identity; first-person queries answer `authors:[TA]`).
- [x] **AC2** Two-layer reconciliation stated (`BIBLE.md:1846-1848`): assistant-designation byte-unchanged for the external question; custody-asymmetry security rationale present.
- [x] **AC3** Operator variability + explicit-act consequence (`BIBLE.md:1844`, `1852`).
- [x] **AC4** Absorption modes as vocabulary with shipped precedents; per-feature choice; provenance-link sub-question named (`BIBLE.md:1850-1857`).
- [x] **AC5** Tapestries-#7 ruling with stage-2 routing, explicitly marked a ruling about future work (`BIBLE.md:1859`).
- [x] **AC6** Scope: single-owner normative; multi-tenant one-paragraph direction, marked not-built (`BIBLE.md:1861-1863`).
- [x] **AC7** Mutual §30↔§31 cross-refs (`BIBLE.md:1767`, `1832`); ToC row + anchor resolves (`31-the-self-and-its-keys`); header "Last updated" + §16 changelog row updated.
- [x] **AC8** assistant-designation gains `## Relationship to instance identity (BIBLE §31)` before its Deployment-status section; wire format and precedence prose untouched (4-line diff, purely additive).
- [x] **AC9** W15 → `Graduated → BIBLE §31` with Resolution paragraph in the W5/W11/W14 house format; heading byte-unchanged (anchor-stable); W16 untouched.
- [x] **AC10** Handoff → `✅ SUPERSEDED` with landing map; body kept for history; §31 named authoritative on overlap.
- [x] **AC11** ADR 0002 records decision, rejected alternatives (owner-as-"me" via Options B/C framing + key-union/most-recent-wins named in Context), and the per-feature remainders.
- [x] **AC12** harness-lint clean; `npm test` disposition per the Quality gates entry above (no regression caused; pre-existing failure ledgered as OPEN.md #143).
- [x] No criterion silently dropped; no behavior beyond the story (the OPEN.md #143 row is required harness-friction discipline, not scope creep).

## ADR adherence

- [x] Files changed match ADR 0002's implementation notes exactly — seven prose files + the phase artifacts; nothing else.
- [x] Confidence-level discipline honored: the stage-2 ruling and multi-tenant direction are explicitly marked not-yet-built; assistant-designation's specified-not-wired status restated (`BIBLE.md:1848`) — no unbuilt behavior presented as present (the ADR-0033 constraint).
- [x] "Definitions and rules in BIBLE; derivations in the handoff" — §31 carries no scoping dialogue or code inventory; the Jarvis gloss is one parenthetical sentence (`BIBLE.md:1842`) as decided.
- [x] No new dependencies, no CLAUDE.md edit (190/190 confirmed), no `scripts/` edits, no `engineering-team/CHANGELOG.md` row needed (no def path touched — verified against `scripts/harness-def-paths.txt`).

## Concept-graph integrity

- [x] No concept definitions changed; **firmware reinstall: N/A** (matches ADR).
- [x] No concept handles introduced; zero literal 64-hex pubkeys anywhere in the diff (checked mechanically).
- [x] Architect oriented via `/api/concept-graph/summaries` before source (recorded in the ADR).

## Things tests can't catch

- [x] No secrets, no debug logging, no commented-out code (prose diff).
- [x] Factual claims spot-checked against primary sources: TA signing (`src/api/normalize/helpers.js:27-43`), tapestries-0007 "TA or owner, both runtime-resolved" (ADR + BIBLE §6 note), second-brain 0008 re-mint + Option C rejection, OPEN.md #136 stage-2 wording ("general strfry→Neo4j letter ingest + provenance" — verbatim match to §31's citation), W13 resolver direction.
- [x] All five referenced artifact paths exist; internal links verified.

## House rules check

- [x] Concept Graph API authority respected; no new tooling.

## Product-guide adherence

- N/A — no PRD; docs-mode protocol story.

## Findings

### Blocking

None.

### Non-blocking

1. **BIBLE.md:8** — the "Last updated" prior-chain now carries five entries; the file has previously been groomed to ~four. Optional: trim the oldest on the next BIBLE touch.
2. **BIBLE.md §16 row** — states "(2026-08-05, staging)" ahead of the staging deploy; accurate at read-time once this branch merges (the row ships with the change it describes — the established pattern), noted for completeness.

### Harness friction

1. `show-the-four` S5's absolute route-count pin fails on the staging base after unrelated additive routes — filed during Implementation as **OPEN.md #143** (same brittle-pin genus as rows 109/112, same suite file). Nothing further to file from this phase.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Book box F0 ticked in `engineering-team/audits/shared-concepts-adoption/book.md`; completion detection performed — result reported in chat (book remains Open: F1–F5 unbuilt).
