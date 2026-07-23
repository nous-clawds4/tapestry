# Review: Story 1 — Capture a goal and see it

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-23
**Diff:** `git diff c26410fa..7f5052b0` (story `04e375fe` → adr `83e43d39` → tests `004e53d0` → impl `7f5052b0`, on `feat/second-brain`; HEAD = `7f5052b0`, tree clean)
**Story:** `engineering-team/stories/second-brain/1-capture-a-goal-and-see-it.md`
**ADR:** `engineering-team/decisions/second-brain/0001-goal-capture-and-goals-view.md`
**Test plan:** `engineering-team/stories/second-brain/1-capture-a-goal-and-see-it.test-plan.md`
**Binding guides:** `product-team/guides/second-brain-design-guide.md`, `second-brain-style-guide.md` (+ wireframes), PRD §7 Policy Constitution

## Quality gates (run by reviewer, not trusted)

- [x] `node test/capture-a-goal-and-see-it.test.js` — **27 passed, 0 failed, 0 skipped**, stack up, H-class ran live. The H4 fixture created its one sentinel element and the teardown visibly deleted it (strfry "Deleting 1 events" in the run output). Post-run residue independently verified zero: strfry scan-count for the fixture d-tag = 0; Neo4j nodes matching the fixture uuid = 0; `NostrEventTag` nodes matching the fixture values = 0 (orphan-tag check included).
- [x] `npm test` — **Overall PASS, exit 0, single run.** `capture-a-goal-and-see-it suite: PASS (27 passed, 0 failed)`, gating in the live `overallOk` chain. Every other suite PASS (110 suite-summary lines audited, incl. wrapped ones); total skipped 51 (the normal publish-flow/live-precondition skips). The OPEN.md #75 router-drift hazard (H8/H4 equality brackets in *other* suites) did **not** materialize this run — no re-run needed. Full run exceeds the 10-minute foreground tool cap; run in background (~24 min).
- [x] JSX compile (established gap-filler, graph-curation-ui precedent): `docker exec tapestry sh -c "cd /usr/local/lib/node_modules/brainstorm/ui && node_modules/.bin/vite build"` — **✓ built in 1m 22s**; only the pre-existing chunk-size warnings.
- [x] Live spot-checks: loopback `GET /api/brain/goals` → `success:true`, exactly the **three legacy goals** ("NosFabrica success", "advance physical understanding of the world", "develop tapestry into an agentic second brain"), each `standing:"captured"`, contract keys all present (+ additive `captureDate`, legacy fallback `2026-07-18` from `created_at`), no strays, no schema-element leak. Host-side `curl http://localhost:7778/api/brain/goals` → **403** `{"success":false,"error":"Owner access required"}`.
- [x] `npm run test:playwright` — **not applicable/not run**: no browser-flow test exists for this story; the harness browser has no NIP-07 signer (story Deviations, "Owner-eye UI verification bound"), so the signed-in list is proven at the API layer (H1/H2/H4/H6) with the vite compile + S-class source assertions covering the view — the established substitute.
- [x] _Lint / typecheck / build not configured — skipped (vite compile above is the JSX gap-filler, not a new gate)._

## Spec adherence

- [x] **AC 1 — Capture.** H4 exercises the exact ADR d1 contract body against `POST /api/normalize/create-element` and asserts **read-back** through `GET /api/brain/goals` (name, statement, origin, capturedOn, standing) — not response success, per the publishToStrfry silent-drop mitigation. U2/U5 cover mapping and date resolution. The confirmation sentence *"Goal captured."* is uttered by the conversational agent, not shipped code (test-plan note 3, ratified at the Phase-3 gate); verified here as contract documentation (ADR d1) plus absence of any contradicting in-view confirmation — no toast, no record dump; the in-view acknowledgment is the 2-second row highlight only, per the design guide's capture-confirmation pattern.
- [x] **AC 2 — See it.** H1 (every goal `standing:'captured'` live), U4, S7. Row renders name (600) + standing word (`ui/src/pages/brain/Goals.jsx:92-97`); standing is read-only text — no status control anywhere (S5b + manual walk: no select/dropdown/button in the view). Row metadata per the design guide's goal-row pattern (chip, pointer count) is data-driven and none exists in v1 (wireframe §1 confirms; no date belongs in the row). Rows do **not** navigate — no `onClick`/`Link` on the `li` (story 4's wiring lands in a view with no stub to fight, per ADR Consequences).
- [x] **AC 3 — Adoption.** H1 asserts the three legacy goals by name (reproduced in my live spot-check); H2 asserts no stray class-machinery entries (live: exactly 3 rows); the directed walk excludes strays structurally (`src/api/brain/index.js:31-38`) and `parseGoalRow` classifies out non-goal json (schema element's `jsonSchema` shape has no top-level `tapestryOwnerGoal` section → null; U3). No parallel store: zero new write endpoints; capture rides the adopted `create-element`.
- [x] **AC 4 — Cold start.** S5 asserts the style guide's canonical sentence byte-exact; I independently extracted the sentence from `second-brain-style-guide.md` and programmatically confirmed `Goals.jsx` contains it verbatim (em dash U+2014, ASCII apostrophe — identical bytes). The ADR's ruling (style guide over the wireframe's embellished variant) is honored — the wireframe §4 extra copy ("Big or small…") is correctly absent. "Exactly one action": the cold-start view offers only the conversational instruction inside the sentence — no buttons, no capture form, no other affordance (the retry link exists only in the error state; the privacy line is static). Matches design principle 7 and wireframe §4 (which also has no button).
- [x] **AC 5 — Privacy indicator.** Line verbatim (byte-checked against the style guide), rendered as a static `<p>` (`Goals.jsx:101`), no control attached; S5b confirms no toggle/checkbox/switch vocabulary.
- [x] **AC 6 — Register.** S8 covers the unambiguous subset mechanically; per the test plan, the Reviewer owns the full list. **Full-list manual audit of every owner-facing string** in `Goals.jsx` ("Goals", "Checking who you are…", "🔒 Goals are only available to the owner.", "Please sign in to continue.", "Couldn't load your goals —", "Retry", the cold-start sentence, the privacy line, `captured`), the Layout nav label ("🧠 Goals"), and the App crumb ("Goals"): **none** of *element, kind, schema, event, pubkey, superset, concept header, persona, acceptance criteria, lease, payload, endpoint* appears; no exclamation marks; no celebration/urgency/progress/machine-narration phrases ("Checking who you are…" is in the owner's terms, not machinery narration); the only standing word is lowercase canonical `captured` (the CSS small-caps presentation is itself the design guide's spec); later-story standings absent (S7). Emoji observation below (non-blocking).
- [x] No criterion silently dropped; no behavior beyond the story (see scope notes below).

## ADR adherence

- [x] **d1 (capture contract):** no new write path; H4 uses the documented body verbatim. R2 sentinel pins the ridden route.
- [x] **d2 (field mapping / schema):** H3 live-asserts `origin`/`capturedOn` present as **optional**, `required` unchanged `[name, slug, description]`; statement ≡ `description` (U2); `capturedOn` wins over `created_at`, fallback for legacy, null degrade (U5). One-time `save-schema` call journaled in the story's Deviations.
- [x] **d3 (read surface):** `src/api/brain/index.js` new; registered in `src/api/index.js:577-579`; **in-handler gate** `if (!isOwner(req) && !req.localTrusted) return res.status(403)…` (`brain/index.js:52-54`) — exactly the platform template, **not** route-level `requireOwner` (which would 401 the loopback agent); TA via `getOwnerAssistantPubkey()` at request time (`:57-61`); handle built as `39998:<TA>:tapestry-owner-goal`; queries parameterized; concept-absent degrades to `{success:true, goals:[]}` structurally (no rows → empty map → `[]`; not locally testable per plan — staging smoke is the natural check); response contract per H6. **Import surface exact**: `lib/neo4j-driver`, `middleware/auth` (isOwner), `utils/assistantKeys`, `lib/brain/goals` — nothing else (S2 pins it; manual read confirms). Strfry-free and mutation-free.
- [x] **d4 (pure core):** `src/lib/brain/goals.js` — zero require/import (S1), CJS (Tester deviation ratified at the Phase-3 gate; purity is the binding property), exports pinned (U1), capture-date-desc sort (U6), tolerant classification (U3).
- [x] **d5 (UI):** route `App.jsx:204` (`goals` child of `/tapestry`, crumb `Goals`); nav `Layout.jsx:15` with `ownerOnly: true` — first consumer of the existing filter (`Layout.jsx:175`, R1 sentinel); Layout's `isOwner` is the same owner||admin pair-check as the page gate (`Layout.jsx:139`, `Goals.jsx:19`) — consistent; full-page gate mirrors `settings/Index.jsx`; hook `useBrainGoals.js` with AbortController + focus/visibility refetch + 20s visible-only poll; loading = three `.bsp-skeleton-row`s; error = plain-language line + accent retry; new-row 2s fade via `--bg-tertiary` (`styles.css` `.brain-row-new`); **no viability hint** (story 3's AC — absent, confirmed); **rows don't navigate**; cold-start/privacy verbatim.
- [x] **d6 (tokens/shell):** the diff adds **no `:root` tokens** — only `.brain-*` classes; `--surface`/`--surface-2` correctly mapped to `--bg-secondary`/`--bg-tertiary` (values identical to the guide's: `#161b22`/`#21262d`); radius/spacing as literals in the stylesheet per app idiom; Layout `page` shell.
- [x] **d7 (privacy posture):** nothing in the diff imports or routes through `ui/src/utils/nostrPublish.js` / `publishEverywhere` (S11 + my grep across the whole diff); **no router-stream or router-config changes** (14-file diff list audited); the indicator is static text only. PRD §7.4's convention posture honored.
- [x] Layering/boundaries respected; **no new dependencies** (zero package.json changes).
- [x] **Untouchables byte-unchanged** (0-line diff verified): `src/api/normalize/relationships.js`, `src/api/normalize/probe.js`, `src/middleware/auth.js` (incl. `PUBLIC_MUTATIONS`), `firmware/`, and the four ADR-0015 `LEGACY_*` files (`src/api/profile-tags/index.js`, `ui/src/utils/publishTagPin.js`, `ui/src/hooks/useProfileTags.js`, `ui/src/utils/publishProfileTag.js`).

## Concept-graph integrity

- [x] Handles in `kind:pubkey:slug` form — `39998:<TA>:tapestry-owner-goal` constructed at runtime; d-tag scheme respected by the fixture.
- [x] Firmware reinstall: **not required** — the concept is runtime-created, not firmware-seeded (ADR Context, verified reasoning: `manifest.concepts` iteration only); the schema extension was a live `save-schema` call, journaled in the story Deviations with the required/optional split H3-verified. Installer untouched (operator decision 2026-07-18).
- [x] No concept definitions changed in code; no re-derivation from BIBLE.md — the module orients via runtime lookups.

## Things tests can't catch

- [x] No secrets in committed files.
- [x] No leftover debug logging / `console.log` in the new modules (the only console use is the test runner's own reporting).
- [x] No commented-out code.
- [x] Error paths: gate evaluated before any work; TA-unavailable → structured 500; Cypher failure → structured 500; hook catches non-JSON/aborted/failed fetches; `resolveCaptureDate` never yields "Invalid Date"; view error copy is fixed plain language (server `err.message` is never rendered to the owner).
- [x] Concurrency: `Promise.all` of two read-only queries is safe; the hook's per-effect AbortController prevents stale-response races; the poll re-entry is tick-serialized.
- [x] Security: both Cypher queries **parameterized** (`$headerUuid`) — notably better than the incumbent client-side pattern it transcribes, which string-interpolates; the read is behind the in-handler gate (H5 proves the remote class gets 403); no injection vector via the json blob (parsed defensively, classified out on any malformation).
- [x] **Test-file change in the impl commit** (failing-tests-first contract): `git diff 004e53d0..7f5052b0 -- test/capture-a-goal-and-see-it.test.js` audited hunk-by-hunk — a `crypto` require, hoisted `FIXTURE_JSON`/`FIXTURE_DTAG` constants (H4's body is the identical object, now shared), `fixtureTagUuids()` and the orphan-tag teardown queries. **No assertion was added, removed, or weakened** — the Deviations claim ("teardown-only, no assertion changed") is accurate. Failing-first verified from the plan's recorded run at `83e43d39` (25 fail / 2 sentinel pass).
- [x] **POV/architecture invariants:** standing is derived at read time, never stored (no denormalized subjective state); no write-time gating of any publisher (no write path shipped); the view is explicitly the owner's own-brain surface — no global-truth claim smuggled in.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling (the vite invocation is the existing in-container build, used as a review gate only).
- [x] **No hardcoded 64-hex pubkey in any new file** (S4 + manual scan); TA resolved at runtime server-side (`getOwnerAssistantPubkey()`) and per-run in the tests (`/api/assistant/pubkey`). The story itself caught CLAUDE.md's stale quoted local value — the house rule proving its point.

## Product-guide adherence (story traces to PRD §5.1/§5.8/§6/§7)

- [x] Copy matches the style guide's canonical table **verbatim** — cold start and privacy line byte-compared programmatically against the guide file (not just against the test's copy of the strings).
- [x] Design-guide patterns honored: tokens only (no hex/px literals in components — literals live in the stylesheet per the ADR's ruling); designed loading (3 skeletons) / error (plain language + retry) / empty (canonical, one action) states; view title 1.4rem; goal name 600; standing muted small caps; row min-height 44px; capture confirmation = 2s highlight fade, no toast.
- [x] Do-not-design list: no agent chat UI, no gauges, **no privacy toggle**, nothing visitor-facing. PRD §7 Policy Constitution: §7.2 append-only untouched, §7.4 indicator-not-toggle, §7.7 plain-language audit above, §7.8 adoption + runtime identity, §7.9 nothing re-specified (no relationship-primitive re-implementation; no `HAS_SUBGOAL` work).

## Deviations audit (story `## Deviations`, all five)

1. **Schema-extension journal** — consistent with ADR d2's "operational step, journaled"; H3 proves the live result exactly (optional fields, required unchanged). ✓
2. **Extra `captureDate` response field** — additive; H6 contract keys all present; live-verified. Accurate as logged, though its stated justification ("so the view renders dates") is anticipatory — the v1 view renders no dates (see non-blocking #4). ✓
3. **Teardown-only fixture amendment** — verified against the raw diff, claim holds (above). Tester-lane, correctly logged. ✓
4. **S1 comment rewording** — no behavior; the shipped docblock scans clean. ✓
5. **Owner-eye UI verification bound** — honest about the NIP-07 limitation; the API-layer + compile + source-assertion coverage is the accepted substitute here. ✓

## Findings

### Blocking

None.

### Non-blocking

1. **ui/src/pages/brain/Goals.jsx:80** — the Retry affordance is an href-less `<a onClick>`: not keyboard-focusable, so the error state's only in-view action fails the design guide's own accessibility baseline (focus ring / tab order on interactive elements). Mitigated: the hook refetches on window focus/visibility, so any tab-away-and-back recovers. App precedent for Retry is a `<button>` (`ui/src/components/AssistantProfileEditor.jsx:129`, `ui/src/pages/lists/DListOverview.jsx:219`). Optional improvement: a `<button className="brain-retry">` styled as the accent link.
2. **ui/src/components/Layout.jsx:15, ui/src/pages/brain/Goals.jsx:60** — emoji ("🧠" nav label, "🔒" gate line) vs the style guide's base guardrail "no emoji … in UI copy". Both are deliberate byte-mirrors of the app shell: every nav item is emoji-prefixed, and the gate line mirrors `settings/Index.jsx:125` — the exact template ADR d5 designates. The design guide's grounding principle ("a reviewer should not be able to tell this was built at a different time") wins for shell/gate surfaces; the product's own owner-facing content (rows, states, indicator) is emoji-free. Recorded so book close can rule if the product surfaces ever diverge from shell idiom.
3. **src/api/brain/index.js:63-66** — ADR d3 says "runs **one** Cypher"; the implementation runs two parameterized queries under `Promise.all` with JS dedup. The ADR's *cited canonical pattern* (`ConceptElements.jsx:68-85`) is itself two queries merged client-side, so the implementation matches the pattern the ADR pointed at — the "one Cypher" phrasing was loose, not a contract. Would have been cleaner to log in Deviations. (The new code parameterizes where the incumbent interpolates — an improvement.)
4. **Story Deviations, `captureDate` entry** — the justification says the field lets "the view render dates without re-deriving," but the v1 view renders no dates (the goal-row pattern has none). Harmless additive field; the note is anticipatory (story 4's detail page is the likely consumer).
5. **ui/src/pages/brain/Goals.jsx:24-40** — of the two `[goals]`-dep effects, the second unconditionally overwrites `seenUuids.current`, making the first effect's conditional ref update dead code; and `freshUuids` state can outlive its 2s window (no visual effect — the CSS animation runs once). Works correctly as shipped; could be one effect.

### Harness friction

1. `npm test` cannot complete inside the Bash tool's 10-minute foreground cap (live run ≈ 24 min) — first attempt was killed at timeout and had to be re-run in the background with completion polling. Worth an OPEN.md `meta` row (reviewer-role guidance: run the full gate in background from the start). Left for the main session to ledger — this review's assignment scopes writes to this file only.

## Verdict

**PASS**

The diff is mergeable as-is: every AC is covered by passing tests I ran myself, live behavior matches the spec (three adopted goals, no strays, structured 403 for the remote class), all seven ADR sub-decisions are implemented as agreed, owner-facing copy is byte-verbatim from the style guide with a clean full-list register audit, untouchables are byte-unchanged, and the failing-tests-first contract survives the impl commit's teardown-only test amendment.

## On PASS (same commit)

- [ ] Story `**Status:**` flip to `Done` — **deferred to the main session** (per this review's assignment, the main session owns the gate, the status flip, and the commit).
- [x] Completion detection run: the book (`engineering-team/audits/second-brain/book.md`, PRD-backed) is **not** complete — this is story 1 of an 8-story queue (decomposition, pointers, session loop, proposals, signals, export all outstanding). No `/close-book` offer.
