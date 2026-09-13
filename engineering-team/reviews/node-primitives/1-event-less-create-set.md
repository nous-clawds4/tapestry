# Review: Story 1 — Create a set with no event behind it (strfry-free create-set)

**Reviewer:** Claude (acting as Reviewer — independent context; the story, ADR, tests and code were all authored by one other session)
**Date:** 2026-09-12
**Diff:** `git diff b8ea1f4d..HEAD` on `chore/concept-graph-curation` (HEAD = implementation commit `a5c90134`)
**Story:** `engineering-team/stories/node-primitives/1-event-less-create-set.md`
**ADR:** `engineering-team/decisions/node-primitives/0001-event-less-add-subset-primitive.md`
**Test plan:** `engineering-team/stories/node-primitives/1-event-less-create-set.test-plan.md`

Range: book + epic (`51012d43`), story (`7f05f78d`), ADR (`3258a0c6`), failing suite + runner registration (`e4e747f5`), H10 fixture amendment (`8b77d448`), implementation (`a5c90134`). Implementation files:
- `src/api/normalize/nodes.js` (new)
- `src/api/normalize/nodePrimitivesProbe.js` (new)
- the 11-line registration at `src/api/normalize/index.js:5519-5529`
- `scripts/scratch-stack.sh` (new)
- BIBLE §6 / §11 / "Last updated"
- the story's `## Deviations` section

Test-integrity check: `git log e4e747f5..HEAD -- test/` lists only `8b77d448`, the H10 fixture amendment (non-blocking finding 5). The implementation commit touches no test file. No `package.json`, `package-lock.json` or `ui/package.json` changes in the range.

## At a glance (for the gate)

- One blocking item. The `already-existed` answer does not have the shape ADR decision 9 gives it, and the story's `## Deviations` section does not record the difference (B1). Either of two cheap remedies clears it.
- The live class (H0–H10) could not be reproduced under this review's safety limits. It rests on the Implementer's scratch-instance run. I weighed that run as credible, after independently checking most of what it asserts (see "Independent verification").
- Everything else conforms: order of checks, address, would-be tags, the single write, idempotency, injection boundary, import boundary, probe, scratch-script safety, BIBLE edits, and all five journaled deviations.

## Quality gates (run by reviewer, not trusted)

- [ ] `npm test` (full runner) — **not run.** This review has a hard safety limit: another session is using the shared `tapestry` container, and other suites' live classes would write fixtures there (some also publish). What I ran instead, from the worktree:
  - [x] `node -e "require('./test/event-less-create-set.test.js').run()"` against the default container.
    - Result: 14 passed, 0 failed, 11 skipped.
    - U1–U10 and S1–S4 all pass.
    - H0–H10 skip, because the shared `tapestry` answers 404 on `GET /api/normalize/node-primitives`. I confirmed that with a read-only GET before running.
  - [x] The 18 stack-free suites that read `normalize/index.js`.
    - Env: `BRAINSTORM_BASE_URL=http://127.0.0.1:1 TAPESTRY_CONTAINER=no-such-container TAPESTRY_PORT=1 BRAINSTORM_PUBLISH_LOCAL_ONLY=true`.
    - Run in one process, each via `require(...).run()`.
    - Result: 286 passed, 0 failed, 103 skipped; no suite threw.
  - [x] Stub-leak check: the same 18 suites re-run in one process after `event-less-create-set`.
    - Per-suite results are identical to the baseline.
    - Afterwards neither `src/lib/neo4j-driver.js` nor `src/api/normalize/firmware.js` is left in `require.cache`. Both were absent before, so the restore correctly deleted them.
    - `nodes.js` is not left cached, and all seven `child_process` functions are the originals.
  - [x] `bash scripts/harness-lint.sh` — clean (0 violations).
  - [x] `node --check` on the three `src` files, the suite and `test/test.js`; `bash -n scripts/scratch-stack.sh`; `git diff --check b8ea1f4d..HEAD` — all clean.
- [ ] Live class H0–H10 — **not reproduced.** No scratch instance could be booted: the Docker VM has about 1 GB of headroom, and booting one needs the operator's approval.
  - Implementer's final run: `…/tasks/b53klstr1.output` (22:55) — 24 passed, 0 failed, 1 skipped. H7 skips by design when the target is not the default container.
  - Earlier run: `…/tasks/bi7enueg6.output` (22:51) — 23/1/1. H10 failed its own fixture precondition ("need two nostr-kind elements to wire; found 0"), which `8b77d448` (22:54) fixed.
  - The sequence is consistent with the commits and with the code. I weigh it as credible, but it is Implementer-supplied (non-blocking finding 1).
- [x] `npm run test:playwright` — not applicable (no UI change).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

### Independent verification (reviewer-run; read-only against the shared stack)

- **Decisions 5, 7 and 8 against real data.**
  - The lettered set `firmware concepts for nostr` (made by `create-set` on 2026-09-12) sits at exactly the address `add-subset` computes for that name and parent: `39999:<TA>:firmware-concepts-for-nostr-31a7463e`.
  - All five of its tag nodes (d, name, z, s, description) equal `buildSubsetTags`' output by uuid, type and value.
  - Its properties are `{uuid, name, kind, pubkey, created_at, id}`, with labels `NostrEvent, ListItem, Set`. That is exactly the node `add-subset` writes, plus `id`.
  - So a later letter lands on identical tag nodes, and decision 6a would report this set as `already-existed, hasEvent:true`.
- **Schema.**
  - `nostrEvent_uuid` and `nostrEventTag_uuid` are uniqueness constraints, so the write's MERGEs cannot create twin nodes under concurrency.
  - `nostrEvent_id` uniqueness ignores nulls, and there is no existence constraint, so an id-less node is schema-legal.
- **Graph state.**
  - 0 `NostrEvent` nodes lack an `id` today, so the ADR's "no event-less node exists" fact still holds.
  - No leftover `test-nodeprim` fixtures.
  - 24 Sets, every one a direct element of `set-superset`; 10 of them are nested under another Set.
  - No Set has a padded or null name.
- **Criterion 4, by construction.**
  - `ui/src/pages/concepts/ConceptDag.jsx:28-35`, `ui/src/utils/conceptCounts.js:49-50` and `ui/src/pages/concepts/SetDetail.jsx:33-72` never read `id`.
  - `src/api/concept/exportSet.js:62` keeps only `n.id IS NOT NULL`.
  - The UI's only publish path (`ui/src/pages/concepts/ConceptDetail.jsx:146-179`) publishes exactly what export-set returns. That route is `requireOwner` (`src/api/index.js:598`).
- **Criterion 5, by construction.**
  - The only node-deleting Cypher in `src/`, `scripts/` and `setup/` is tag replacement: `src/api/neo4j/eventSync.js:339`, `src/api/normalize/index.js:157-160`, `src/api/normalize/helpers.js:88`.
  - Install pass 1e deletes only direct Superset edges of manifest concepts (`src/firmware/install.js:780-832`).
  - Pass 1d re-MERGEs `HAS_ELEMENT` from a concept's superset to every node z-tagged to that concept (`:614-634`). That covers the set's `z` tag.
- **Criterion 3 beyond the handler.**
  - Default-deny returns 401 for every unauthenticated mutation except two exact-match public paths (`src/middleware/auth.js:474-483`).
  - For an authenticated non-owner, the middleware already returns 403 on `POST /api/normalize/*` (`:423`, `:459-462`), before the handler's own gate (`nodes.js:94-96`).
  - `localTrusted` requires a loopback peer and no proxy header (`:350-364`).

## Spec adherence

- [x] Every acceptance criterion has a passing test:

  | Criterion | Tests | Evidence |
  |---|---|---|
  | AC-1 Create | U3, U5–U9, S1, S4; H1 | U/S run by me; H1 Implementer-run; address and tags also verified against real data |
  | AC-2 No duplicates | H2, H3, H4 | Implementer-run; logic at `nodes.js:151-166` read and traced |
  | AC-3 Guards | U1, U2, U4; H6; H7 | U run by me; H6 Implementer-run; H7 never ran live (skips off the default container) — covered statically (auth middleware above) |
  | AC-4 Behaves like any set, stays private | H8, H9 | Implementer-run; read and publish paths verified statically |
  | AC-5 Survives reinstall | H10 (scratch, opt-in) | Implementer-run; install passes verified statically; nested-set shape not exercised (non-blocking finding 6) |

- [x] No criterion silently dropped.
- [x] No behavior outside the story. The probe is the book frame's "shipped" evidence (ADR decision 1).

## ADR adherence

- [x] Files match the Implementation notes.
  - New: `nodes.js`, `nodePrimitivesProbe.js`, `scripts/scratch-stack.sh`.
  - `index.js`: registration only (`:5519-5529`, beside the relationship-primitive routes).
  - BIBLE: the §6 row (`BIBLE.md:224`), the §11 rows (`:446-447`) and "Last updated" (`:8`).
  - Nothing else in `src/` changed.
- [x] Import surface is exactly `crypto`, `../../lib/neo4j-driver`, `./firmware`, `../../middleware/auth` and `../../lib/dtag` (`nodes.js:44-48`). S1 enforces it.
- [x] Decisions 1–8 conform:
  - **Order (decision 3), then parent (decision 4):**
    1. gate → 403 (`:94-96`)
    2. body fields → 400 (`:99-108`)
    3. TA pubkey and `set` concept → 500 (`:113-120`)
    4. `set` concept's superset → 500 (`:123-129`)
    5. parent → 404, or 400 on labels (`:132-144`)

    U7 pins the superset-before-parent order.
  - **Address (5):** `:148`.
  - **Duplicates:** 6a at `:151-166`, 6b at `:169-177`.
  - **The write (7):** `:183-198`. It matches the ADR sketch, with the aliases resolved and `hasEvent` added to the RETURN. Zero rows answers 500 (`:210-214`).
  - **Would-be tags (8):** `buildSubsetTags` (`:71-80`), using `importEventDirect`'s formula (`index.js:165`).
- [ ] Decision 9 — the `created` answer conforms (`:223-231`); the `already-existed` answer does not (blocking finding B1).
- [x] No new dependencies.
- [x] Injection boundary holds. Only the three firmware-resolved class-thread aliases are interpolated into query text (`:53-57`; used at `:124`, `:152`, `:184`, `:196-197`); every caller value is a query parameter.

### `## Deviations` entries, judged

1. **`src/` mounted read-only instead of copied in with a restart** — accepted. This is `brain-drill.sh`'s own pattern (`scripts/brain-drill.sh:66-67`): same effect, no restart, read-only (`scratch-stack.sh:77`).
2. **`BRAINSTORM_PUBLISH_LOCAL_ONLY=true` on the scratch instance** — accepted. It is strictly safer, and `src/api/publish-policy/index.js:28-30` honors it.
3. **`firmware.relAlias` instead of literal aliases** — accepted. It is the `relationships.js:67-68` pattern and resolves to the same three aliases.
4. **An empty-string description is treated as absent** — accepted. It matches `create-set`'s `if (description)` (`index.js:4315`); both keep a whitespace-only description, so the parity is exact.
5. **`BRAINSTORM_NEO4J_*` override instead of shrink-after-boot** — accepted. `docker/entrypoint.sh:158-161` honors it (neo4j-sizing book; `test/neo4j-sizing-override.test.js`). It needs an image built from that entrypoint, which the local image is.

Deviations found that are not journaled: B1 (the decision-9 answer shape), and non-blocking finding 5 (the Phase-4 test amendment).

## Concept-graph integrity

- [x] Handles are in `kind:pubkey:slug` form, with the TA resolved at runtime.
  - `39998:<TA>:set` comes from `firmware.conceptUuid` (`nodes.js:117`).
  - The set's address is `39999:<TA>:<d-tag>` (`:148`).
  - No TA pubkey is hardcoded; the suite's `FAKE_TA` is built at runtime (`test/event-less-create-set.test.js:156`).
- [x] No concept definition changed, so no firmware reinstall is needed (ADR Consequences). The diff touches no firmware JSON.
- [x] The ADR's Context records orientation via `/api/concept-graph/summaries`. The code re-derives nothing from BIBLE.

## Things tests can't catch

- [x] **No secrets.** `NEO4J_PASSWORD="scratch-stack-pass"` (`scratch-stack.sh:78`) is a throwaway for an ephemeral container with no published ports, following the `brain-drill.sh` precedent.
- [x] **No leftover debug output.** The only console output is `console.error` in the catch (`nodes.js:233`), which is the surface's convention.
- [x] **No commented-out code, no TODOs.**
- [x] **Error paths.** Every failure is typed and names what was wrong. A write that returns zero rows answers 500, never a false success.
- [ ] **Concurrency.** There is a narrow window between the duplicate check and the write (non-blocking finding 2).
- [x] **Security.** Inputs are validated at the boundary; see the injection boundary above.
- [x] **`scratch-stack.sh` never touches `tapestry`.**
  - It uses fixed names — `tapestry-scratch`, `tapestry-scratch-redis`, `tapestry-scratch-net` (`:26-28`) — and `down` removes only those (`:34-38`).
  - None of those names is hex, so `docker rm` cannot ID-prefix-match another container.
  - No published ports; `src/` is mounted `:ro`; it refuses to reuse an existing scratch instance (`:61-64`).
  - An ERR trap and an explicit `down` on a failed firmware install clean up after failures (`:67`, `:92-96`). Signals are not trapped (non-blocking finding 4).
  - If `up` fails inside the documented one-liner, the suite falls back to `tapestry` (`test/event-less-create-set.test.js:69`). That is safe: H10 still skips (`CONTAINER_EXPLICIT` is false, `:903`), and today everything else skips too, because the probe answers 404.
- [x] **Stub isolation.** The suite restores its `require.cache` stubs, so nothing leaks into later suites in the runner. The in-process re-run above verifies this.
- [x] **BIBLE edits are accurate.**
  - The §6 row matches the node written: an event-form `uuid`, no `id`, and "no `id`" is not §30's provenance marking.
  - The §6 addressing line (`BIBLE.md:212`) is still true.
  - The §11 rows list exactly the statuses `nodes.js` returns. They say "owner-gated" in the same sense as the sibling rows: owner or admin, or a trusted local caller.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.
- [x] No hardcoded TA pubkey. The module header documents the container-loopback operator path (`nodes.js:30-36`).

## Product-guide adherence *(when the story traces to a PRD)*

- N/A — there is no PRD; the book is anchored to an acceptance frame (`engineering-team/audits/event-less-sets/book.md`).

## Findings

### Blocking

1. **`src/api/normalize/nodes.js:159-165` (and `:219-221`)** — the `already-existed` answer does not have the shape ADR decision 9 gives it, and the story's `## Deviations` section does not record the difference.
   - **What decision 9 says:** `already-existed` is "the same shape [as `created`] with `hasEvent` and no `note`". That is:
     - `set: { uuid, name, description?, labels, hasEvent }`
     - `parent`
     - `registeredUnder`
   - **What the code returns:**
     - The 6a path, which is the normal repeat, answers `set: { uuid, name, hasEvent }` plus `parent`. It has no `set.labels` and no `registeredUnder`.
     - The race path (`:219-221`) answers `set` with `labels` (and `description`), but no `registeredUnder`.
     - So the same `result` value comes back in two different shapes, depending on an internal branch.
   - **Why the tests don't catch it:** H2 and H4 check only `set.uuid`, `set.hasEvent` and the absence of `note`, so they pass either way.
   - **Asked change — either (a) or (b):**
     - **(a) Conform.** Make both `already-existed` answers carry decision 9's shape.
       - Return `labels(s)` from the 6a lookup and include it in `set`.
       - Include `registeredUnder` only when it is true of the existing set. A 6a hit can be a set this primitive never registered — for example an imported set z-tagged to another author's `set` concept. So have the 6a query `OPTIONAL MATCH` the `set` superset's `HAS_ELEMENT` edge, rather than echoing `supRows[0].uuid`.
       - Optionally echo the existing set's `description`, so a repeat that carries a different description visibly changed nothing.
     - **(b) Journal it.** Record the difference in the story's `## Deviations` section, for the operator to accept at the gate.

     Either way, pinning the chosen shape in H2/H4 is optional, and belongs to the Tester's lane.

### Non-blocking

1. **`test/event-less-create-set.test.js:704-950` (H0–H10)** — the live evidence is Implementer-supplied. I could not reproduce any H test here. AC-2, AC-4, AC-5, the 404 / label-400 / 409 paths and the no-event bracket all rest on the scratch run weighed above.
   - If memory allows, run the live class once on a scratch instance at the gate — H10 above all, since it is the only reinstall check.
   - At the latest, run it (H7 included) against the default container as soon as the feature is deployed there, before the book's real use.
2. **`src/api/normalize/nodes.js:169-177` vs `:183-198`** — a check-then-write window.
   - If a node appears at the address between the 6b read and the write, the MERGE adopts it: it links the node under the parent, registers it in `set`, and answers `already-existed`. Under a race, 6b's "never silently re-linked" does not hold.
   - Two concurrent identical calls both answer `created`, because the OPTIONAL MATCH at `:185` reads before the MERGE takes its lock.
   - The uniqueness constraint rules out a twin node. The window is milliseconds, the tool is single-operator, and the test plan lists concurrency as untested.
   - Optional hardening: carry `pre` through the `WITH` and filter it (`WHERE pre IS NULL OR pre:Set`), so an interloper yields zero rows (500) instead of being adopted.
3. **`src/api/normalize/nodes.js:148`, via `slug` in `src/lib/dtag.js`** — slug collisions.
   - Every name with no ASCII letter or digit (`日本語`, `中文`, `!!!`) gets the d-tag `-<hash8(parent)>`. So each parent can hold only one such set; a second one answers 409.
   - `Café`/`Cafe` and `Foo Bar`/`foo-bar` also answer 409 against each other.
   - This is loud and ADR-conformant (6b), and inherited from the address rule — `create-set` would silently replace instead.
   - Worth an intake note if sets will ever be named in a non-Latin script.
4. **`scripts/scratch-stack.sh:67`** — only an ERR trap is set.
   - Ctrl-C or SIGTERM during the multi-minute boot leaves the scratch container and its redis running beside the shared stack. That is the memory-pressure hazard `scripts/brain-drill.sh:141-146` documents.
   - Optional: `trap 'down; exit 130' INT TERM` for the duration of `up`.
5. **`test/event-less-create-set.test.js:917-929` (commit `8b77d448`)** — the H10 fixture amendment was made in Phase 4, by the implementing session. The earlier live log shows the implementation already in place.
   - The ADR's Implementation notes reserve test-file changes to Phase 3.
   - The change itself is sound: it only brings its own members, weakens no assertion, and the test plan's Fixtures section was updated with it.
   - But the story's `## Deviations` section doesn't record it. Add a line.
6. **`test/event-less-create-set.test.js:902-950`** — AC-5's nested-set shape is not exercised.
   - H10 places the set directly under a manifest concept's superset. A set nested under another Set is never taken through a reinstall.
   - By construction, install treats it exactly as it treats a nested lettered set: same `z` tag, same edges, and pass 1e prunes only Superset edges.
   - On the shared graph, all 10 nested lettered sets currently keep their direct `set` membership.
   - Parity holds. Recorded only because criterion 5 says "under a concept".
7. **`src/api/normalize/nodes.js:61-62`** (the `note`; ADR Consequences, "Mortal and box-bound") — durability follow-up.
   - The book's real use will put operator curation into sets that no backup covers: the brain export carries only the five second-brain families.
   - No OPEN.md row tracks this today. Suggest filing one (backup coverage for event-less nodes), so the first private curation isn't unbacked by default.

### Harness friction *(each becomes an OPEN.md row, type `meta` — left for the main session to file)*

1. **A live class whose environment is built in Phase 4 cannot be validated in Phase 3.**
   - Here the environment, `scripts/scratch-stack.sh`, is a Phase-4 deliverable. So H10's fixture precondition (pre-existing `nostr-kind` elements) could not be checked when H10 was written.
   - It failed on first contact and was amended in Phase 4, outside the Tester's lane.
   - Suggest: when a story's live tests need a new environment, deliver it with Phase 3 — or sanction a journaled, fixture-only amendment in Phase 4.
2. **Under the shared-stack and memory limits, the Reviewer cannot "run the gate yourself" for a scratch-only live class.**
   - The per-story review then falls back on Implementer evidence.
   - Suggest a defined path: a reviewer-run scratch pass at the gate, with the operator's approval to pause containers — or keep the Implementer's full run output as a gate artifact.

## On PASS (same commit) — not applicable

- The verdict below is CHANGES_REQUESTED, so the story's `**Status:**` stays `Approved`.
- Per this review's instructions, nothing was committed, and no story, code or test file was edited.
- Completion detection is deferred until a passing review. The book cannot be complete yet anyway: its frame requires staging → production plus one real use.

## Verdict

**CHANGES_REQUESTED**

The implementation is otherwise sound and matches ADR decisions 1–8 and its Implementation notes clause for clause. Everything I could check under this review's limits held:
- The U and S classes, and the 18 neighbouring stack-free suites, with no stub leakage.
- Harness-lint.
- A real lettered set, which confirmed the address rule and the would-be tag formula.
- The uniqueness constraints that make the write idempotent.
- The read, publish, install and auth paths behind criteria 3–5.

The one block is contractual. The `already-existed` answer diverges from ADR decision 9's shape, and the story's Deviations section does not record it — the section exists precisely so that the operator accepts or rejects such differences at the gate. Clearing it takes either a few lines in `nodes.js` (remedy a) or one journaled line in the story (remedy b). The live-evidence caveat (non-blocking finding 1) is not blocking, but the operator gate should know that criteria 2, 4 and 5 are evidenced by the Implementer's scratch run, not reproduced by this review.
