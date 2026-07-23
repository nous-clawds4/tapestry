# Second Brain — Story 3 Session Handoff (2026-07-23)

**Status:** ✅ ADDRESSED — story 3 (break-a-goal-into-pieces) review PASS 2026-07-23, shipped to production 2026-07-23 (staging PR #432, prod promotion PR #433, merge `89e5d8f`). Record-based decomposition (deliverable/boundary/parent-slug on the goal record); `viable` standing derived at read time; two validated+gated+serialized normalize primitives (`create-child-goal`, `update-goal-intent`) refusing dangling/cycle/self-parent/already-parented/collision/empty; the save-schema→primary-property reconcile fold landed (ADR 0002's Option C, via ADR 0003 d8); hygiene taxonomy grown to nine kinds; Goals tree + minimal Goal detail. See `engineering-team/reviews/second-brain/3-break-a-goal-into-pieces.md` and the story-4 handoff.

> Written at the close of the story-2 session (structures-the-brain-can-trust: review
> PASS, promoted to production 2026-07-23, PRs #429/#430). This is the pickup prompt
> for the next session, with the load-bearing discoveries from story 2 baked in.
> When story 3 ships, flip this Status to ✅ ADDRESSED.

## Pickup prompt

Pick up story 3 of the second-brain book — **"Break a goal into pieces"**
(decomposition; PRD §5.2, §5.8, §6). Stories 1–2 are Done and in production.
The book, epic, and stories folder exist — do **not** re-open the book. Branch
fresh off updated staging (`git checkout staging && git pull`, then re-create
`feat/second-brain`).

Read, in order:

1. `product-team/stories-queue.md` — Second Brain block, Story 3. Queue order is
   pickup order.
2. `product-team/prd/second-brain.md` — §5.2, §5.8, §6 (goal decomposition, one
   parent per goal in v1, viability = deliverable + boundary, a goal with
   children is never proposed); §7 binds every story.
3. `product-team/guides/second-brain-design-guide.md` — goal-row disclosure/
   nesting, the viability hint line ("needs a deliverable and boundary before it
   can be proposed"), 20px tree indentation; `second-brain-style-guide.md` —
   standing word `viable` (lowercase canonical), labels "Done means" / "Stays
   inside", all owner-facing copy verbatim.
4. `engineering-team/epics/second-brain.md` + `audits/second-brain/book.md` —
   roster, guardrails, coverage-gap notes.
5. `engineering-team/decisions/second-brain/0001-*.md` and `0002-*.md` — binding
   context; 0002 §Options C and Consequences schedule decisions to story 3
   (below).
6. `engineering-team/reviews/second-brain/2-structures-the-brain-can-trust.md` —
   PASS; its five non-blocking findings are OPEN.md row 85, most aimed at
   story 3.

## Load-bearing context from story 2

- **Every schema extension MUST be paired with a reconcile, or the hygiene check
  goes red by construction.** `save-schema` regenerates only the schema node;
  story 3 will extend the goal schema again (deliverable/boundary/parent — the
  ADR 0001 d2 optional-field pattern), so either call
  `POST /api/normalize/reconcile-primary-property` `{"concept":"tapestry owner goal"}`
  right after `save-schema` (idempotent; `reconciled`/`already-consistent`), or
  take **ADR 0002 Option C** — fold primary-property regeneration into
  `save-schema` itself — which 0002 explicitly defers to story 3's ADR. Option C
  also erases the reconcile's unlocked read-compare-write race (OPEN.md row 85b).
- **The hygiene taxonomy is a contract — change structures deliberately.** ADR
  0002 Consequences: story 3's class-thread changes (e.g. materializing child
  edges) "must update the taxonomy deliberately, not accidentally."
  `src/lib/brain/hygiene.js` classifies header edges, element edge/z-tag
  consistency, and property-record agreement; new edge types or new schema
  fields must leave `GET /api/brain/hygiene` green (it now gates in the live
  npm-test chain via H1). Row 85's findings (a/c/d) are taxonomy notes for
  exactly this moment.
- **`HAS_SUBGOAL` is the relationship-primitives book's documented
  whitelist-extension path — do NOT extend the whitelist inside story 3.** The
  queue is explicit: decomposition position is durable intent (the child's
  parent reference lives in the goal's own record, PRD §6); the structure must
  survive regardless of edge materialization. If edges are wanted, that is the
  declared-dependency path (needs the cardinality-safety design ADR
  relationship-primitives 0001 asks for). ADR 0001's Consequence stands: the
  Goals tree renders from record-based data, never from an edge walk.
- **`deriveStanding()` in `src/lib/brain/goals.js` is the single extension point
  for `viable`** (ADR 0001 d4: "the derived-not-stored extension point stories
  3/6 grow"). Standing stays derived at read time, never stored.
- **Plan the sibling-suite re-pins in Phase 3, not Phase 4** (this session's
  lesson, logged in story 2's Deviations): story-1's suite **S7 asserts the
  words `viable`/`achieved`/`abandoned` are ABSENT from `Goals.jsx`** — story 3
  renders `viable`, so that assertion must be amended in the Tester's plan (not
  discovered at the impl gate). Likewise the brain module's import surface is
  pinned by **both** story-1 S2 and story-2 S3 (exactly five requires today) —
  any new require needs both amendments planned. Story-2's S6 also pins the
  brain module strfry-/mutation-free.
- **Parallel sessions collide in `test/test.js` and OPEN.md row numbers** — a
  firmware-explorer session landed mid-flight this session and cost a rebase
  (suite registrations at the same anchors; two row-84s). Fetch origin/staging
  immediately before opening the PR; resolve by keeping both registrations and
  renumbering your ledger row.

## Practicalities

- TA pubkey is runtime-resolved (local instance currently `11f23fe4…`); never
  hand-transcribe it — fetch into a variable (a 2-char transcription slip cost
  this session a false "orphaned header" scare).
- Full live `npm test` ≈ 24 min — background it from the start (OPEN.md row 83).
  Known row-75 hazard recurred ×2 this session: if relationship-primitives
  H8 / capture H4 fail with the "+1 scan count" signature, quiesce
  `strfry-router` for the rerun and restart it after.
- If you spawn the independent reviewer (required-by-practice when the main
  session implemented — OPEN.md row 80b): its nohup'd npm test is not
  harness-tracked; tell it to poll the log inline rather than ending its turn,
  or expect to nudge it (row 74 recurrence this session).
- New suites register in `test/test.js`'s **live** gating chain, before the
  severed terminator (OPEN.md #43); add the suite to the `totalSkipped` array
  too.
- Local dev loop: the repo bind-mounts into the container; new/changed server
  routes need `docker exec tapestry supervisorctl restart brainstorm`.

## Then

Act as the engineering Product Owner: promote Story 3 — "Break a goal into
pieces" — via `/plan-feature` into `engineering-team/stories/second-brain/`
(next story number: 3).

Run human-gated: the operator answers every phase gate. Any owner-facing copy
comes verbatim from `product-team/guides/second-brain-style-guide.md`. One
story per session.
