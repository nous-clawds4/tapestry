# Review: Story 4 — Attach the world (pointers and the goal's page)

**Reviewer:** Claude (acting as Reviewer — independent subagent; the main session ran PO/Architect/Tester/Implementer, so this audit is the OPEN.md row-80(b) independent check — nothing the Implementer reported was trusted; every gate re-run and every claim re-verified here)
**Date:** 2026-07-23
**Diff:** `git diff ac344864..91df2633` (story `50b0feac` → adr `4f244f3e` → tests `d4f67a92` → impl `91df2633`, on `feat/second-brain`; base `ac344864` = origin/staging tip; tree clean)
**Story:** `engineering-team/stories/second-brain/4-attach-the-world.md`
**ADR:** `engineering-team/decisions/second-brain/0004-external-resource-pointers-and-one-spine-detail.md` (d1–d13; fulfils/supersedes ADR 0003 d11 — reciprocal `Amended by` header verified present)
**Test plan:** `engineering-team/stories/second-brain/4-attach-the-world.test-plan.md`
**Binding guides:** `product-team/guides/second-brain-design-guide.md` (Pointer card, one-spine, freshness colors), `second-brain-style-guide.md` (standing words, banned-jargon list), `second-brain-wireframes.html` §2, PRD `product-team/prd/second-brain.md` §5.3/§6/§7

## Quality gates (run by reviewer, not trusted)

- [x] `node test/attach-the-world.test.js` — **29 passed, 0 failed, 0 skipped**, stack up, all 8 H rows ran live. Fixture teardown ran clean (strfry deletes by event id observed in the log; the suite's own count-0 verify passed).
- [x] `node test/capture-a-goal-and-see-it.test.js` — **27 passed, 0 failed, 0 skipped** (amended sibling — widen-only re-pin).
- [x] `node test/structures-the-brain-can-trust.test.js` — **24 passed, 0 failed, 0 skipped** (amended sibling — widen-only re-pin).
- [x] `node test/break-a-goal-into-pieces.test.js` — **30 passed, 0 failed, 0 skipped** (amended sibling — widen-only re-pin).
- [x] Impl-commit-touched-no-test check: `git diff d4f67a92..91df2633 --stat` lists **only the 7 source files** — no test file touched by the Implementer (tests not weakened after they were written).
- [x] `npm test` (full ~24-min gate) — **not re-run in full by me**; accepted the main session's report (all four second-brain suites PASS; the only failure `relationship-primitives` H8 = the documented row-75 strfry-router scan-count drift, an environmental effect that passes 23/0 quiesced). This is sound because I byte-verified this story's untouchables (`relationships.js`, `probe.js`) unchanged — story 4 cannot affect that suite — and I independently ran all four second-brain suites + the build + live spot-checks against the same running stack, all green.
- [x] JSX gap-filler: in-container `docker exec -w …/ui tapestry npx vite build` — **clean** (`✓ built in 1m 57s`; only the pre-existing chunk-size warnings).
- [x] Live spot-checks (loopback via `docker exec tapestry curl 127.0.0.1:7778` = the `localTrusted` class; TA resolved per-run via `/api/assistant/pubkey` → `11f23fe4…`, never hardcoded):
  - `GET /api/brain/hygiene` → `sound:true`, `problems:[]`; `checked` = the two work-item concepts only (External Resource intentionally **not** in `HYGIENE_CONCEPTS`, ADR debt (a)) — the runtime concept does not disturb hygiene.
  - `GET /api/brain/goals` → the three legacy goals; **every goal carries `pointerCount`** (all `0` after teardown); existing keys unchanged (the 14 story-3 keys + `pointerCount`).
  - `GET /api/brain/goals/:slug` → `{success, goal, pointers, records}`; `goal` carries `parentSlug`+`parentName`; `pointers:[]`, `records:[]`. Unknown slug → `{success:true, goal:null, pointers:[], records:[]}` (empty state, not an error).
  - Host-side caller classes (via node `fetch` — `curl` absent from the host PATH; same mechanism H8 uses): `POST /api/normalize/create-resource` → **401**, `POST /api/normalize/verify-resource` → **401** (default-deny middleware before the handler), `GET /api/brain/goals/:slug` → **403** (in-handler owner gate).
  - Residue: direct Neo4j scans → **0** External Resource elements (kind 39999 on the resource z-tag) and **0** `harness-resource` json hits — fixtures and any demo fully torn down. The concept header persists (expected): `39998:11f23fe4…:tapestry-external-resource`, kind 39998 — and its slug is byte-identical to `RESOURCE_CONCEPT_SLUG` the brain read hard-codes, so the self-bootstrap name→slug derivation and the read path agree.
- [x] _Lint / typecheck not configured — skipped. Playwright not applicable (no Playwright coverage for this surface; AC 2/3/6 visual behavior is source-asserted, the vite build is the JSX compile gap-filler, both run above)._

## Spec adherence (all seven ACs)

- [x] **AC 1 — Attach a resource.** `handleCreateResource`/`createResource` (`src/api/normalize/index.js`): gate-first `isOwner||localTrusted` → 403; 400 on missing/empty `goal`/`title`/`locator`; `unknown-kind` when `locatorKind ∉` the five; `goal-not-found`/`ambiguous-slug`; `resource-exists` on a duplicate (goal, locator). Only locator + metadata stored — **no external content copied**. Local-only ride (`publishToStrfry`+`importEventDirect`; never `publishEverywhere`). Covered by S1, H1 (live round-trip), H4 (refusal matrix + snapshot-equality = nothing written).
- [x] **AC 2 — Pointer card per the design guide.** `PointerCard` (`ui/src/pages/brain/GoalDetail.jsx:43-65`): kind marker (`KIND_MARKER` maps the canonical `locatorKind`→`file/vault/event/repo/web`, 0.75rem uppercase muted, no icons — CSS `.brain-pointer-kind`), title as accent link, `truncateMiddle` locator preview (monospace muted), freshness line, optional why-kept italic. Freshness colored by word: current→`--text-muted` (default `.brain-freshness`), stale→`--orange`, unreachable→`--red` — verified all three tokens are defined in `:root`. Covered by S6, H2, H6.
- [x] **AC 3 — Open native, never embed.** The title anchor carries `target="_blank" rel="noopener noreferrer"` (`GoalDetail.jsx:50-55`); no `<iframe>`/`dangerouslySetInnerHTML`/`<embed>`/`<object>`/fetch of the resource anywhere. S6 pins both halves.
- [x] **AC 4 — Freshness derived; verifying updates it; no egress.** `deriveFreshness` (`src/lib/brain/resources.js:80-85`) is a pure read-time function of `lastVerifyStatus`+age, stored nowhere; `handleGetGoalDetail` derives it on every call. `verifyResource` sets `lastVerified`/`lastVerifyStatus` and `regenerateJson`s — an **asserted** re-check: I read the whole handler slice; it only reads and rewrites the record, **no `fetch`/`http(s).get`/`.request`/`axios`/`node-fetch`/`got`/`undici`** anywhere (grep-confirmed over the added lines; S2 pins it). H3 flips freshness unreachable↔current live.
- [x] **AC 5 — One-spine Goal detail.** `GoalDetail.jsx` renders intent (unchanged from story 3 — parent context merely re-sourced from the endpoint's `parentSlug`/`parentName`, output byte-equivalent), then the pointers section, then the record section — wireframe §2 order. Empty state verbatim: `Nothing attached yet — resources this goal needs will appear here.` (`POINTER_EMPTY`, `GoalDetail.jsx:15`). H5 pins the live spine shape + unknown-slug empty.
- [x] **AC 6 — Record entries append-only.** `RecordEntry` (`GoalDetail.jsx:67-77`) renders date/type/summary with **no** input/textarea/form/contentEditable/edit-delete handler at the entry level (S7 pins it). Live-empty in story 4 (`records:[]` from the endpoint; producers are stories 5–7) — expected, not a gap.
- [x] **AC 7 — Copy discipline & no regression.** New owner-facing strings pass the banned-jargon scan (S8; `event` kind marker the ADR-d11-sanctioned exception). The three sibling suites stay green (27/24/30) under a widen-only re-pin (no behavior weakened). No criterion silently dropped; no behavior beyond the story — the impl file list is exactly the ADR's seven.

## ADR adherence (all thirteen sub-decisions)

- [x] **d1 — External Resource concept.** `RESOURCE_CONCEPT_NAME = 'tapestry external resource'` → header slug `tapestry-external-resource` (verified live). `RESOURCE_SCHEMA` is a single concept-object wrapper `properties.externalResource` (satisfies the d8 fold's one-top-level-key rule); `required` = `['name','slug','description','locatorKind','locator','goal']`; `x-tapestry.unique:['slug']`; enum `['file','vault-note','nostr-event','repository','web-address']`; all descriptions plain-language.
- [x] **d2 — Record-based linkage.** `section.goal = goalSlug`; the read groups by `goal` slug (`groupResourcesByGoal`) — no edge, no whitelist change. Read-tolerant of an orphaned resource (grouped under a nonexistent goal simply renders nowhere).
- [x] **d3 — Identity (goal, locator); write-path enforcement.** `identitySlug = ${goalSlug}-${dtag.hash8(kind\nlocator)}` — distinct per (goal, kind, locator), verify-stable; json `slug` ≡ d-tag base (`dtag.childDTag(identitySlug, headerUuid)`, the createChildGoal idiom). `x-tapestry.unique` is advisory, so `createResource` enforces it itself: duplicate (goal, locator) → `resource-exists`, nothing minted.
- [x] **d4 — Pure `src/lib/brain/resources.js`.** Zero requires; `parseResourceRow` (non-resource/malformed → `null`, never throws), `deriveFreshness` (unreachable overrides; boundary `days > STALE_AFTER_DAYS`; missing date → `stale`), `freshnessDays`, `groupResourcesByGoal`, `STALE_AFTER_DAYS = 30`. Freshness derived, stored nowhere.
- [x] **d5 — Read surface.** `GET /api/brain/goals` gains `pointerCount` (grouped at query time — no denormalized column); existing keys unchanged (verified live). New `handleGetGoalDetail`: gate → 403; resolver-winner (oldest `createdAt`, uuid tie-break — matches the list/tree); `goal` = list projection **+ `parentSlug`/`parentName`**; `pointers` each with `freshness`+`freshnessDays` (newest-`notedOn` first); `records:[]`; unknown slug → `goal:null`. Both reads use EXPLICIT∪IMPLICIT and are concept-absence-tolerant. The brain module gains exactly the **sixth** require (`lib/brain/resources`) — S11 pins it; S12 confirms no mutation/strfry tokens (read-only intact).
- [x] **d6 — `create-resource`.** Gate-first; body `{goal,title,locatorKind,locator,whyKept?,keywords?}`; validation before any write; `ensureResourceConcept()` then mint via the `create-element` idiom with `notedOn=lastVerified=today`, `lastVerifyStatus='reachable'`, optionals omitted (not empty strings); discriminated `attached`; refusals loud/named/HTTP-200/nothing-written.
- [x] **d7 — `verify-resource`.** Same gate idiom; locate by (goal, locator) → `resource-not-found` if absent (incl. when the concept was never bootstrapped); shallow-merge the two fields and `regenerateJson`, all other sections pass through verbatim; discriminated `verified` with derived `freshness`. Durable-intent update (not append-only-governed). No egress (see AC 4).
- [x] **d8 — `ensureResourceConcept()` self-bootstrap.** Resolve → return early if present (so **no per-write churn**; save-schema, which re-signs the schema node, runs only on the absent branch). Absent → `create-concept` then `save-schema` (the d8 fold reconciles the primary property in the same call) then re-resolve; a `create-concept` "already exists" is not inspected/thrown — the re-resolve maps it to success. `invokeNormalizeHandler` builds a `{localTrusted:true}` fake req/res — **gate-safe**: it is module-internal, unexported, and reachable only from `createResource`, itself only reachable from the already-gated `handleCreateResource` inside `serializeGoalWrite`; the target handlers (`handleCreateConcept`/`handleSaveSchema`) carry no in-handler gate, so a loopback-equivalent call is exactly correct. Proven live: the concept + schema exist after the suite's first attach (H1), and the header persists byte-consistent with the read path's slug.
- [x] **d9 — Serialization.** Both write bodies run inside the **existing** `serializeGoalWrite` (not renamed — 6 occurrences remain; S4 + my own read of both handlers confirm the read-validate-write body is inside the mutex); `ensureResourceConcept` runs inside the serialized body on first attach.
- [x] **d10 — UI.** `useBrainGoalDetail` mirrors `useBrainGoals` (fetch/poll/refetch/AbortController) against `/api/brain/goals/:slug`. Intent block unchanged. Pointer card + record section per the design guide; `Goals.jsx` row gains `{n} pointer{n===1?'':'s'}` rendered only when `>0`. **No new `:root` tokens** — `styles.css` extends `.brain-*` with `var(--…)` only.
- [x] **d11 — Copy discipline / `event` exception.** S8 excludes the `event`/`kind` markers as the design-guide-sanctioned typographic vocabulary; scans `schema/endpoint/superset/pubkey/payload/concept header/acceptance criteria/lease` — clean.
- [x] **d12 — Conversational contract addendum.** ADR-body/doc only; no code obligation this story.
- [x] **d13 — `STALE_AFTER_DAYS = 30`.** Single named constant in `resources.js`; not per-kind.

## Concept-graph integrity

- [x] Handle is `kind:pubkey:slug` form — `39998:<TA>:tapestry-external-resource`, TA runtime-resolved (verified live).
- [x] Firmware reinstall **not** required — the concept is runtime-created / self-bootstrapped, the installer is untouched (`firmware/` byte-unchanged; ADR states so explicitly). Correctly *not* called out as needed.
- [x] New code orients via the runtime concept + the existing ConceptElements union pattern — no BIBLE.md re-derivation.

## Things tests can't catch

- [x] No secrets; no hardcoded 64-hex pubkey in any added line (grep-confirmed across `src/` + `ui/`); TA runtime-resolved at every use.
- [x] No stray `console.log`. The two `console.error(...)` calls are on the handler catch paths — identical to the existing `update-goal-intent`/`create-child-goal` handler pattern, house-consistent error logging, not debug noise.
- [x] No commented-out code; comments are explanatory and trace to d-numbers.
- [x] Error paths gate-before-work: both handlers 403 before reading the body; validation before any write; refusals return before minting; `verifyResource` returns `resource-not-found` before any rewrite.
- [x] Concurrency: both read-validate-write bodies run inside `serializeGoalWrite`, so a duplicate-(goal,locator) attach racing itself, or verify racing attach, is closed in-contract.
- [x] Demo cleaned: 0 resource elements, 0 `harness-resource` residue live; goal set back to the legacy three, hygiene green.
- [x] Privacy §7.4: no `publishEverywhere`/`nostrPublish` in the diff; verify performs no network egress.

## House rules check

- [x] Concept Graph API authority respected — the concept is provisioned through the blessed create-concept/save-schema path; reads go through the standard union.
- [x] No new lint/typecheck/build tooling; `resources.js` is dependency-free CJS.
- [x] Untouchables byte-unchanged (`--stat` empty): `relationships.js`, `probe.js`, `middleware/auth.js` (incl. `PUBLIC_MUTATIONS`), `firmware/`, the four ADR-0015 `LEGACY_*` files, `ui/src/utils/nostrPublish.js`. `serializeGoalWrite` not renamed. ADR 0003 gained only the reciprocal `Amended by` header line (body untouched).

## Product-guide adherence

- [x] Freshness copy byte-exact for every well-formed resource: `verified {N} days ago` / `not verified in {N} days` / `unreachable at last check`, colored by word (design guide line 72). Pointer empty state byte-exact. Kind markers `file/vault/event/repo/web` per the design guide. No exclamation marks. Standing words canonical (`current/stale/unreachable`).
- [x] Design-guide patterns honored: tokens not raw values; open-native no-embed; append-only record with no edit affordance; no new visual identity/tokens.

## Findings

### Blocking
None.

### Non-blocking
1. **`ui/src/pages/brain/GoalDetail.jsx:36-41`** — `freshnessLine` has two fallback strings for `freshnessDays == null` that are not in the guides: `'verified recently'` (current branch) and `'not verified recently'` (stale branch). The `current` fallback is effectively **dead code** — the server's `deriveFreshness` only returns `'current'` when the day-count is a number, so `n` is never null there. The `stale` fallback fires only for a resource with a missing/unparseable `lastVerified`, which the blessed `create-resource` path never produces (it always stamps today) — reachable only via the flagged raw `save-element-json` hatch, and the design guide (line 74) explicitly casts the freshness line as the degraded/error surface. Jargon-clean, no exclamation. Optional: drop the dead `current` fallback and/or align the stale fallback wording; not a happy-path violation.
2. **`ui/src/pages/brain/GoalDetail.jsx:170,182`** — the implementation adds `<h2>Resources</h2>` and `<h2>Record</h2>` section headings; wireframe §2 shows the pointer cards and record entries directly under the intent block with no explicit headings. The added labels are plain-language and jargon-clean (`Record` is the design guide's own term), and they aid one-spine readability. Optional: confirm the headings with design, or drop them to match the sketch exactly.
3. **`ui/src/pages/brain/GoalDetail.jsx:50-55`** — the title anchor uses the raw `locator` as `href` for all kinds. For `web-address`/`repository` this resolves natively; for `nostr-event`/`file`/`vault-note` a raw locator may not resolve to a real destination (the ADR d10 left "the Implementer's exact scheme" open and required only "register-safe"). AC 3's testable contract (no embed/fetch, `target=_blank rel=noopener`) is satisfied. Optional later refinement: map nostr-event→njump/`nostr:` and file→a file scheme.

### Harness friction
None new. (Pre-existing OPEN.md #43 severed-terminator dead block in `test/test.js` — the runner registration correctly extended the LIVE `overallOk` chain onto `attachTheWorldResult` per the ADR's explicit guidance; the dead block below was left untouched as instructed. OPEN.md #75 router-drift is the known environmental flake, not triggered by this story.)

## Verdict
**PASS**

## On PASS (same commit — owned by the main session per the launch instruction)
- [ ] Story `**Status:**` flip to `Done` — deferred to the main session (this independent reviewer was instructed not to flip status or commit).
- [x] Completion detection: the `second-brain` book has stories 5–7 (record producers) still open — the book is **not** complete; no `/close-book` offer.
