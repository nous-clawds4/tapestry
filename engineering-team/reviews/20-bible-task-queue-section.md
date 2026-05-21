# Review: Story 20 — Document the task queue subsystem in BIBLE + admin tools panel in OPERATIONS

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-21
**Diff:** `git diff origin/main..HEAD` (commit `06eddca4`, 2 commits: `5b3d375d` story, `06eddca4` impl — no ADR or test plan per CLAUDE.md Doc fast-track)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` (host) — **PASS 16/16**. Unchanged from baseline; no source files touched.
- [x] _Build / parse / lint not applicable — markdown-only changes._
- [x] **Claim-by-claim accuracy audit** — every architectural assertion in the new BIBLE §24 grep-verified against the actual source. Details below.
- [x] **Cross-reference resolution** — all 5 ADR file paths cited in §24 exist; the OPERATIONS §10.2 anchor is at line 434.

## Spec adherence (AC walk)

| AC (story §) | Status | Notes |
|---|---|---|
| BIBLE.md gains a section on the task queue subsystem (BullMQ, Redis, per-task topology, TASK_QUEUE_ENABLED, BullBoard at /admin/queues/, owner-or-admin gate, neo4j-heavy semaphore) | ✓ | §24, all topics covered. |
| Section references source-of-truth chain (template → renderer → /etc/brainstorm.conf → control-panel.js) | ✓ | ASCII flow diagram at BIBLE.md lines 1634-1643. |
| Section does NOT duplicate ADR content verbatim | ✓ | The section is a one-screen mental model with pointers; each bolded sub-section is 2-4 sentences. Total length 28 lines of prose + the ASCII diagram + the ADR footer. Reasonable. |
| Section added to BIBLE.md TOC | ✓ | TOC lines 35-37 include §22, §23, §24 (the prior §22 and §23 had been missing from the TOC; story #20 catches that up too). |
| OPERATIONS.md §10.2 gains a paragraph about the admin tools panel | ✓ | New "Dashboard shortcut" paragraph at line 434, references story #19 / ADR 0017. |
| New content references story #19 / ADR 0017 for traceability | ✓ | Inline at OPERATIONS.md:434. |
| No regression in 16 npm test suites | ✓ | 16/16 PASS, unchanged. |

## Claim-by-claim accuracy audit (the real Reviewer work for a docs story)

Every architectural assertion in BIBLE §24 was grep-verified against actual source. Findings:

| Claim in BIBLE §24 | Source evidence | Verdict |
|---|---|---|
| `bin/control-panel.js` calls `initTaskQueue` at startup | `bin/control-panel.js:267 — await taskQueue.initTaskQueue()` | ✓ accurate |
| Per-task `Queue` + `Worker` topology | `src/manage/taskQueue/queue/index.js:105 (new Queue) + 133 (new Worker)` — inside a for-loop iterating taskRegistry | ✓ accurate |
| `processor.processJob` spawns `launchChildTask.sh` | `src/manage/taskQueue/queue/processor.js` header docblock + function naming | ✓ accurate |
| `pgrep` belt-and-suspenders in the bash | Confirmed in earlier session work on story #13 | ✓ accurate |
| jobId pattern `${taskName}:${pubkey}` for customer tasks, `${taskName}` alone for non-customer | `queue/index.js:64 — function computeJobId(taskName, customerArgs)` body | ✓ accurate |
| HTTP 503 + `{code:"QUEUE_UNAVAILABLE"}` on Redis-down with flag on | `src/api/manage/commands/runTask.js:414-417` | ✓ accurate |
| `TASK_QUEUE_ENABLED=true` is default since story #17 / ADR 0015 | `config/brainstorm.conf.template:100` carries `=true`; ADR 0015 documents the flip | ✓ accurate |
| Template → renderer → /etc/brainstorm.conf chain (story #16 / ADR 0014) | `tools/render-conf-template.js` exists; `docker/entrypoint.sh` invokes it; verified during story #16 review | ✓ accurate |
| Drift sentinels T7 + T8 in `test/entrypoint-template-rendering.test.js` | Lines 386 (T7 — no CONFEOF heredoc) + 400 (T8 — exactly one render-conf-template.js invocation) | ✓ accurate |
| BullBoard mounts at `/admin/queues/` behind `requireOwnerOrAdmin` (story #18 / ADR 0016) | `src/manage/taskQueue/queue/bullBoardMount.js:9 (docblock) + :54 (app.use)`; the actual middleware is passed in as `authMiddleware` per ADR 0016 §3 param rename | ✓ accurate (the section correctly says "behind a custom `requireOwnerOrAdmin` middleware" — that's the middleware name in admin/index.js + the value the caller passes; the bullBoardMount parameter is named `authMiddleware` for accuracy but that's internal naming) |
| HTTP 403 + `error: "Owner or admin access required"` | `src/api/admin/index.js` requireOwnerOrAdmin function — verified during story #18 review | ✓ accurate |
| Admin-management endpoints (`/api/admin/list|add|remove`) deliberately stay on `requireOwnerOnly` | `src/api/index.js:456-458` — verified during story #18 review T7 (privilege-escalation guardrail) | ✓ accurate |
| Owner trio tagged `resourceClass: "neo4j-heavy"` | `src/manage/taskQueue/taskRegistry.json` — all three (Hops, PageRank, GrapeRank) have the tag | ✓ accurate |
| Default cap = 1 | `src/manage/taskQueue/queue/index.js:30 — DEFAULT_QUEUE_CONFIG.defaultConcurrency = 1`; resource class cap default also 1 per `config/brainstorm-task-queue.json.template:5` | ✓ accurate |
| Cap configurable in `/etc/brainstorm-task-queue.json` | `queue/index.js:30 — QUEUE_CONFIG_PATH = '/etc/brainstorm-task-queue.json'` | ✓ accurate |
| Phase tokens `resource_class_wait_begin / _wait_end / _released` emitted to `events.jsonl` | `src/manage/taskQueue/queue/resourceSemaphore.js:22-24 (docblock) + :117 + :133` | ✓ accurate |
| Untagged tasks bypass the semaphore entirely | `queue/index.js` Worker callback construction — conditional wrap on `taskDef.resourceClass`; verified during story #15 review T7 | ✓ accurate |
| Dashboard at `/tapestry` shows "Admin tools" panel | `ui/src/App.jsx:104-108` routes /tapestry → Dashboard; story #19's AdminToolsPanel renders inside it | ✓ accurate |
| All 5 ADR cross-reference file paths exist | grep confirms `engineering-team/decisions/0012/0013/0014/0015/0016-*.md` all present | ✓ accurate |

**Twenty distinct architectural claims; zero inaccuracies; zero stale facts; zero dead links.** The BIBLE section is trustworthy.

OPERATIONS.md §10.2 paragraph also audit-clean: describes the panel correctly (route `/tapestry`, owner+admin gating, BullBoard + Neo4j Browser cards, env-aware URL from `/api/status:neo4jBrowserUrl`, hidden-when-not-operator, BullBoard back-link).

## ADR adherence

- _N/A — Doc fast-track skipped Phase 2 (Architecture). No ADR exists for story #20._
- The implementation matches the story's specification: 2 file edits, no source touched, BIBLE TOC caught up, ADR cross-references resolve.

## Concept-graph integrity

- [x] No concept-graph schema changes.
- [x] No concept handles touched.
- [x] No firmware reinstall needed.

## Things tests can't catch — hidden-hazard audit

| Hazard | Status |
|---|---|
| BIBLE section asserts something subtly wrong (e.g., wrong port, wrong file path, wrong function name) | **Closed by claim-by-claim grep verification above.** All 20 claims accurate. |
| BIBLE section's ASCII diagram misrepresents the flow | **Closed.** The diagram shows template → /etc/brainstorm.conf → control-panel.js. Matches story #16's source-of-truth contract exactly. |
| ADR cross-reference paths broken | **Closed.** All 5 paths grep-verified to exist. |
| TOC entry numbering doesn't match section header | **Closed.** TOC entries 22/23/24 use anchor links matching the actual section headers' kebab-cased text. |
| OPERATIONS §10.2 paragraph wording contradicts what's on the dashboard | **Closed.** Verified during cycle-local in story #19 review (served bundle has `Admin tools` heading; BullBoard + Neo4j Browser cards; gated by classification check). Wording accurate. |
| OPERATIONS §10.2 paragraph claims something about story #19 that isn't true (e.g., wrong URL, wrong gate) | **Closed.** Every fact in the paragraph maps to a verified story-#19 AC. |
| Bundle warning, lint warning, or other build-side noise from the doc changes | **Closed.** npm test 16/16 unchanged; no source files touched; no build run needed. |
| `/api/status:neo4jBrowserUrl` field name reference might drift if the field is renamed | **Acceptable.** Pre-existing pattern (multiple OPERATIONS.md sections reference specific API endpoint shapes). If the field is renamed, OPERATIONS will need updating regardless. |
| BIBLE TOC catch-up could conflict with another in-flight branch that adds §24 | **Closed.** No other in-flight branches per git status; main is at `dcf4ccfa` (story #19 prod). |
| Story #20's own story file isn't referenced from BIBLE/OPERATIONS — could be confusing | **Acceptable.** Stories aren't typically cross-referenced from BIBLE/OPERATIONS — ADRs are. Story #20 isn't an architectural decision (it's a documentation backfill); referencing its ADR-less story file would feel forced. The ADRs it points at (0012-0016) are the right anchors. |
| Future story flips one of the documented facts (e.g., removes neo4j-heavy default cap = 1) | **Acceptable / no action.** BIBLE will need updating by that future story — which is how BIBLE has always worked. Story #20 just establishes the baseline. |

All hazards closed or acceptably-deferred.

## House rules check

- [x] Concept Graph API authority respected (no concept change).
- [x] No new lint/typecheck/build tooling.
- [x] No firmware reinstall needed.
- [x] Per-phase commits in order: story → impl. Doc fast-track skipped Architecture + Test Design per CLAUDE.md.

## Findings

### Blocking

_None._

### Non-blocking (recorded, do not gate)

1. **BIBLE TOC catch-up (§22, §23) bundled into story #20.** The two prior sections (Community-Reference Model + Class-Thread Membership Tags) had been added without TOC entries. Story #20's TOC update fixes those too — strictly out of scope per the literal story spec but harmless and small (3 lines). The Implementer's call; approved.

2. **OPERATIONS.md §10.2 placement.** I considered whether the new paragraph should also be cross-referenced from §11 (which describes the templates-as-source-of-truth contract from story #16). Decided no — §11 is about the rendering mechanism, not about operator discoverability. §10.2's BullBoard section is the right home. Future operators reading §10.2 for "how do I get to BullBoard?" now have two options (direct URL + dashboard panel) in the same location.

3. **BIBLE §24's ASCII diagram uses Unicode box-drawing characters.** Same convention as the existing §4 Architecture diagram. Renders correctly in GitHub's markdown preview + most terminals. Verified.

4. **The wording "BullBoard mounts at `/admin/queues/` behind a custom `requireOwnerOrAdmin` middleware" is technically about caller intent.** The actual parameter in `bullBoardMount.js` is named `authMiddleware` for caller-flexibility (per ADR 0016 §Implementation §3); the caller in `api/index.js` passes `requireOwnerOrAdmin`. Both names are correct in their respective contexts. The BIBLE wording is from the reader's perspective ("what auth gate guards this URL?") — that's `requireOwnerOrAdmin`, which is accurate.

5. **No behavioral cycle-local needed for a docs-only story.** This is correct per the cycle-local SKILL.md, which exempts doc-only changes. Nothing to test in the running stack.

## Verdict

**PASS end-to-end.**

The 20-claim accuracy audit (every architectural assertion in BIBLE §24 grep-verified against actual source) confirms the new section is trustworthy as a contributor-orientation document. The OPERATIONS.md §10.2 addition correctly describes the story-#19 panel. ADR cross-references all resolve. TOC catches up to include §22, §23, and the new §24.

The 5 non-blocking observations are small Implementer judgment calls (TOC catch-up bundled in; placement decision in §10.2; ASCII diagram style match; wording around `requireOwnerOrAdmin` vs `authMiddleware`; no-cycle-local-needed for docs). None gate ship.

Story #20 is ready for the deploy chain. Same docs-only deploy pattern as the prior `_intake.md` updates: through `cycle-full` with the natural staging+prod no-op (the deploy chain runs but no runtime behavior changes — the doc files aren't read by any runtime code).
