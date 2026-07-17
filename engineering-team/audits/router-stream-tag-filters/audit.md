# Build Audit: Tag filters for Router Management streams

**Book:** `engineering-team/audits/router-stream-tag-filters/book.md`
**Date:** 2026-07-16
**Branch / commit range:** `58314b7c..48b1550e` (feature branch `feat/router-stream-tag-filters`, phase ladder `682bda80..f7831258` + review `c2d2d539`, merged to staging via PR #361; promoted to prod via #362 `3a4b653e`; merged to `feat/tags` via #363 `2311487f`; post-merge journal commits ride the close PR)
**Provenance:** Acceptance-frame (opened **eagerly at intake** — the OPEN.md #29 remedy applied; anchor confirmed by the operator's kickoff message)
**Confidence:** high (single day, ask → story → ship → three-instance verification traceable end to end; append-only journal for every gate)

> The Build Audit is the **as-built record** — what the product *is* now, factual and source-linked. It does not propose changes; that's `prd-seed.md`.

## 1. What shipped

- **Operators can attach single-letter tag filters to Router Management streams** — the stream add/edit editor gains a **Tag Filters** field block (between Event Kinds and Limit) reusing the sync panel's `TagFilterEditor`: one ASCII letter + one-or-more comma-separated values per add; `p`/`e`/`a` (and uppercase) format-checked with bech32 (`npub`/`nprofile`/`note`/`nevent`/`naddr`) normalization to hex/coordinate; other letters free-form; rows removable. — `stories/relay-management/2-router-stream-tag-filters.md`
- **Filters are persistent config, honored end-to-end** — saved into the stream's filter in `router-state.json`, emitted into the strfry-router config (`filter = {…}` line), surviving the save → router-restart cycle, round-tripping back into the editor (`form.filter` is the single source of truth via two new pure helpers), and visible on the stream read card (` #z: v1, v2` appended to the Filter line). — same story, ACs 1/3/4
- **Every stream save is sanitized against the deployed router parser's closed vocabulary** (`ids`/`authors`/`kinds`/`since`/`until`/`limit`/`#<letter>`) — `sanitizeStreamFilter` reconstructs each stream's filter at the config-update ingress, because one unknown key hard-fails the WHOLE router config at restart (live-binary evidence, both directions): this closes a pre-existing crash-loop hole while re-emitting tag-less streams byte-identically. — ADR `decisions/relay-management/0002`
- **The ledgered tags-federation stream is now UI-expressible** (OPEN.md #25: `{"kinds":[39999],"#z":[<canonical handles>]}` on a dcosl stream) — point-and-click, no container shell. — frame bullet 3
- **Live on all three instances** same-day: staging (PR #361, deploy 29473065662), prod (PR #362, deploy 29514945867 — operator-ratified), tags (PR #363, deploy 29505362212 auto-fired off `feat/tags`).

## 2. Epics & stories rolled up

### Epic: `relay-management` (remains Active — story #1 shipped by the sibling book; future evolution continues)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #2 router-stream-tag-filters | TagFilterEditor reuse in StreamEditor + filter↔rows bridge helpers + ingress sanitizer + read-card display | Done | `reviews/relay-management/2-router-stream-tag-filters.md` (PASS, 2026-07-16; Gate-5 blinded judge APPROVE) |

## 3. As-built inventory

**User-facing**
- `StreamEditor` (`ui/src/pages/settings/RelaySettings.jsx`) renders **Tag Filters** *(optional — single-letter tag names, e.g. #z)* between Event Kinds and Limit: `<TagFilterEditor tagFilters={tagFiltersFromFilter(form.filter)} onChange={…applyTagFilters…} disabled={false}/>` — rows derived from the persisted filter each render, written back on change; **no parallel tag state**.
- `RouterStatus` stream cards render saved tag entries appended to the existing `Filter:` line; render condition extended to "has kinds **or** tag entries" (a tag-only filter now shows). Cards display kinds, limit, and tag entries (other whitelisted keys persist but are not card-rendered — pre-existing card scope).
- No new routes, no changed endpoints — the same `/api/strfry/router-*` surface.

**Domain**
- No concepts touched, no schema change, **no firmware reinstall required**. Deliberately concept-unaware: a `#z` value is an opaque string (epic guardrail). **No TA-pubkey use anywhere in the diff** (values are operator-entered strings).

**Data & contracts**
- `ui/src/utils/tagFilterValidation.js` gains two pure helpers: `tagFiltersFromFilter(filter)` (wire-format `#<letter>` keys → editor rows; insertion order; stored values returned verbatim — loading never rewrites persisted config) and `applyTagFilters(filter, rows)` (rows wholly replace the filter's #-keys; non-# keys copied first; pure). Module charter comment now names both panels + both ADRs.
- `src/api/strfry/routerConfig.js` gains `sanitizeStreamFilter` (exported for tests), applied in `handleUpdateRouterConfig` before `saveState`/`applyConfig`: insertion-order whitelist copy; `kinds` integer-filtered (empty `[]` preserved — byte-compat with today's UI output); `ids`/`authors` non-empty-string arrays; `since`/`until`/`limit` integers; `#<letter>` non-empty-string arrays; everything else dropped; non-object → stream persists filterless. Tag values reach the config file only through `JSON.stringify` (quotes/backslashes/control chars escaped — injection-safe into the config grammar).
- Tests: `test/router-stream-tag-filters.test.js` (21 tests: U-series executed pure helpers, B-series executed sanitizer incl. byte-identity/idempotence, S/R-series source-level UI assertions region-scoped) registered in `test/test.js`; sibling suite `test/sync-panel-tag-filters.test.js` region-scoped per **ADR 0002 Amendment 1** (S1/S3 → `negentropySyncRegion`; predicates/messages byte-identical; guarding power proven by 5 must-still-fail mutation spot-checks, isolation both ways).

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 1: the sync panel's "similar feature" | Same capability + story #1's ratified defaults carried over verbatim (uppercase `P`/`E`/`A`, duplicate-letter merge+dedupe, bech32→hex/coordinate, hex display) | interpretation ("similar" read as behavior-parity) | journal ANSWER 2026-07-16T02:05; story § Product decisions; Gate-1 judge diffed parity | One mental model across both panels | display-normalization ratification still open (seed §7) |
| 2 | Frame bullet 2: persist + survive restart + round-trip | Persistence built via whitelist **reconstruction** at the ingress (sanitizer), not opaque client-JSON storage | constraint-discovered — the deployed router hard-fails its whole config on any unknown filter key (Gate-2 judge reproduced live, both directions) | ADR 0002 § Context/Decision | Stream saves are crash-loop-safe; hand-edited *unknown* keys are dropped at the next UI save (known keys survive — B3) | hardening trio → OPEN.md #31 |
| 3 | Frame bullet 4: three product questions settled at Planning | Settled: per-stream scoping; presets remain kinds-only starting points with **no tags-federation preset shipped**; save/apply→restart semantics unchanged | interpretation (smallest-that-satisfies + epic generic-tooling guardrail) | journal ANSWER 2026-07-16T02:05; story § Product decisions; Gate-1 judge | Operators hand-enter `#z` values; no concept-aware affordance | preset question promoted to seed §7 |
| 4 | (read-card format unstated) | Card appends ` #x: v1, v2` to the Filter line rather than the ADR's non-normative example text | interpretation (within ADR "e.g." latitude) | story `## Deviations` (Implementer) | Saved filters visible without opening the editor | — |
| 5 | AC-3's physical save→restart→round-trip | Verified by executed state/emit tests + architectural evidence (the unchanged `applyConfig` restart path; every post-ship deploy restarted routers with streams surviving byte-intact on all three instances), **not** by a live operator-entered mutation on a shared instance | constraint-discovered (read-only smoke discipline; owner-gated UI) | review Finding 4; test-plan trade-offs; journal ship/prod/tags entries | None observed across 5 live router restarts post-ship | optional live round-trip remains offered (seed §7) |

**Undocumented work:** none in the product diff — every hunk traces to story/ADR/amendment (review § scope-creep sweep, re-verified by the Gate-5 judge via `git diff --name-only`). Out-of-band commits are process artifacts (book-open, journal, intake markers, OPEN.md rows) and two operator-directed post-ship ops actions, each traced: the `deploy-tags.yml` staging-copy repoint (PR #364; hotfix trace on OPEN.md #14) and the staging→`feat/tags` sync merge (PR #363; journaled, mirrors the #359 pattern).

## 5. Quality state at close

- **Test gate at close (step 8):** full `npm test` on the rebased close branch — **Overall: PASS, exit 0, zero FAIL lines** (242 skips = live-API suites self-skipping; Docker daemon down, so the run mirrors CI's `stack-free` job exactly). Story suite 21/21, sibling 20/20.
- **Gate history:** CI `stack-free` green at every remote gate (#361 22s, #362 28s, #364 29s, #366 29s). The #363 `feat/tags` PR runs no CI (test.yml scopes staging/main) — substituted by a local full-suite Overall PASS **plus** `vite build` with the tags line's real deps (journaled). Stack-up differential at Gate 4: post-implementation FAIL-name set byte-identical to the Stage-0 baseline (34 OPEN.md-#27 environmental fails, zero additions).
- **Amendment integrity:** ADR 0002 Amendment 1 (the book's sole kick-back event, 1 of the >2 halt threshold) region-scoped the sibling suite's latent single-occurrence assertions — scoping-only, predicates byte-identical, five mutation spot-checks; audited line-by-line at Gate 4 and independently by the Gate-5 judge (including a live mutation re-test).
- **Deployment state:** live and smoke-verified on staging, prod, and tags same-day. (Post-book, the tags-stack integration #360/#366 aligned all three instances; the served bundle converged at `index-BLjSXI9c.js` and this feature's strings verified in it on all three.)
- **Known open issues:** OPEN.md **#31** — the pre-existing hardening trio (raw `urls`/plugin interpolation in `generateConfig`; negative integers pass `Number.isInteger`; stream-editor crash on a hand-edited kinds-less filter at `RelaySettings.jsx:118`). None introduced by this book; all pre-date it (review non-blocking findings 1–3).
- **Debt (ADR Consequences):** the sanitizer's vocabulary must be deliberately extended if the router parser ever grows new filter keys (mirrors the sibling's whitelist posture — by design); per-instance `router-state.json` means per-instance stream sets (observed: staging `treasureMaps` vs prod `dcoslUpload`) — a fact for the OPEN.md #25 runbook, not a defect.

## 6. Carry-forward register

- [ ] **Execute OPEN.md #25** — actually configure the `#z`-filtered both-direction dcosl stream on the instances (runbook correction + per-instance setup; now point-and-click via this feature; mind per-instance stream-state divergence and the kind-5 deletion caveat noted on #25).
- [ ] **OPEN.md #31 hardening trio** — one bounded story (relay-management #3 candidate).
- [ ] Optional **live round-trip** of a tag-filtered stream save→restart→re-edit on a shared instance (review Finding 4; deliberately left to the operator).
- [ ] **Tags-federation preset question** — declined this book on the generic-tooling guardrail; product should decide whether an optional concept-aware preset layer is warranted (seed §7).
- [ ] **Count/preview affordance for router streams** — the sync panel can Count a filter before running; stream editing has no match-volume preview (close-time observation; candidate sugar).
- [ ] Inherited from the sibling book, still open: display normalization (hex vs bech32 echo), duplicate-letter merge-vs-replace ratification, saved presets across both panels, in-place editing, concept-handle autocomplete.

## 7. Process findings (harness)

Retro run 2026-07-16 against `scripts/harness-stats.sh` (phase commits: story 125 · adr 107 · test 103 · impl 112 · review 143; relay-management 12; no threshold findings). Every lesson carries exactly one terminal state; **no fourth state**.

| Finding | Source | Terminal state |
|---|---|---|
| Eager book-open at intake (the OPEN.md #29 remedy) ran correctly this time; review-time completion detection had its anchor | journal book-open entry; review close-out | **Declined as new** — validation data point for existing row **#29**; the fix proposal is already filed (the 2026-07-15 meta-sweep proposal in `_intake.md`) |
| Implementing a ratified reuse broke the sibling suite's file-global single-occurrence assertions; resolved by ADR amendment ratifying **region-scoping** (strengthening); pattern should become default Tester practice for source-level suites over multi-surface files | journal Gate-4 pre-check + Amendment-1 entries | **OPEN.md meta row #40** — candidate one-liner for the Tester role/test-plan template; ADR 0002 Amendment 1 is the worked precedent; folds into the meta-sweep story |
| Cross-branch workflow drift misled the session: `deploy-tags.yml` read from staging's copy while push-event triggers use the **pushed branch's** copy — wrong "won't auto-deploy" claim, corrected same-session | journal correction entry; PR #363 comment | **Operator-ratified commit** — PR #364 (`b725c377`) byte-mirrors the tags-line copy onto staging, eliminating the drift; residual OPERATIONS.md prose reconciliation stays on existing row #14 |
| A PR comment cited a run ID from memory; it was wrong (caught by self-audit, patched via `gh api`) | journal cleanups entry | **Declined** — one-off agent discipline (cite IDs only from captured output); journaled + corrected; too narrow for a harness rule after one occurrence |
| Mid-book environment loss (session interrupt; Docker daemon down) — Gate 4 recomposed from the stack-up differential + the stack-free CI-mirror run; discovered that with the daemon fully down, plain `npm test` mirrors CI *exactly* (live suites self-skip → clean Overall PASS required) | journal env-change + Gate-4 entries | **OPEN.md row #27 annotated** (existing row) with the daemon-down CI-mirror nugget — the differential baseline is only needed while the stale stack is *up* |
| Gate-3 judge disclosed over-reading book.md beyond the frame section; APPROVE stood after evaluating the leak against the prohibited categories (none present in book.md) | journal Gate-3 entry | **Declined** — the blinding protocol worked as designed (disclosure honored, categories evaluated); no doc change warranted |
| The book ran a **session-mode standing gate authorization** (operator's kickoff pre-authorized gates through staging; blinded judges at 1/2/3/5 as insurance; journal kept) — a documented middle path between human-gated and armed Direction mode that CLAUDE.md's "sole exception" language doesn't currently name | book.md § Session mode; the whole journal | **OPEN.md meta row #41** — formalize-or-forbid decision routed to the meta-sweep story; this book is the worked clean run either way |

Portability check (Direction ↔ human-gated): #40 ports directly (region-scoping is Tester practice in both flows). #41 *is* the portability question. The deploy-drift lesson ports trivially (any flow reading workflow files must read the pushed branch's copy).
