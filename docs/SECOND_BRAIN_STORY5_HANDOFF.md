# Second Brain — Story 5 Session Handoff (2026-07-23)

**Status:** ✅ ADDRESSED

> **Shipped to production 2026-07-24.** Story 5 "sessions-read-the-brain" ran the
> full engineering cycle (story → ADR 0005 → tests → impl → independent review
> **PASS**), merged to staging via **PR #439**, and reached production via the
> concurrent `staging → main` promotion **PR #440** (which bundled it with the
> tapestries book). Prod-verified live: `GET /api/brain/orient` (bounded, 403
> owner-gated), `create-work-record` / `note-goal-idea` (401-gated), the
> goal-detail `records[]` projection, and the UI record-entry rendering. The
> new self-bootstrapping `tapestry-work-record` concept provisions per instance
> on its first live write. Non-blocking findings → OPEN.md **row 91**. Next:
> **story 6 (the proposal loop)** — see `docs/SECOND_BRAIN_STORY6_HANDOFF.md`.
>
> _Body preserved below for history — it was the pickup prompt for the story-5
> session, with the load-bearing discoveries from story 4 baked in._

## Pickup prompt

Pick up story 5 of the second-brain book — **"Sessions read the brain"**
(bounded, corpus-independent orientation + append-only **work records** on the
goal's spine; PRD §5.4, §6, §7.1–7.3). Stories 1–4 are Done and in production.
The book, epic, and stories folder exist — do **not** re-open the book. Branch
fresh off updated staging (`git checkout staging && git pull`, then re-create
`feat/second-brain`).

Read, in order:

1. `product-team/stories-queue.md` — Second Brain block, Story 5. Note the
   dependency line: **stories 1 and 4 must ship first** (goals and pointers must
   exist for records to reference — both shipped). Queue order is pickup order.
2. `product-team/prd/second-brain.md` — §5.4 (session orientation + the read
   loop: bounded, corpus-independent budget; every session references the goal
   it served; work performed is recorded as an append-only work record —
   session, goal served, resources produced, one-sentence standing, ≤2
   plain-English questions), §6 (**Work Record** is a *new* append-only concept),
   §7.1 (the brain decides; the metabolism asks/reports), §7.2 (append-only —
   never edited/deleted; corrections are new facts), §7.3 (sessions propose,
   never launch — a goal idea born in a session enters as a proposal-shaped
   capture attributed to the session).
3. `product-team/guides/second-brain-design-guide.md` — the **Record entries**
   component (append-only chronological list; date · type word
   `proposed / approved / skipped / worked / noted` · one-sentence summary;
   **work entries list produced pointers as pointer cards**; **no edit affordance
   on any entry, ever**). `second-brain-style-guide.md` — the work-record
   register, the ≤2-questions rule, standing words canonical lowercase.
   `second-brain-wireframes.html` §2 — the record sits below pointers on the one
   spine (story 4 shipped the empty section; story 5 fills it).
4. `engineering-team/epics/second-brain.md` + `audits/second-brain/book.md` —
   roster, guardrails, coverage-gap notes (rename/abandon + category filter
   still deferred).
5. `engineering-team/decisions/second-brain/0004-*.md` — **the one to
   internalize.** It shipped the record-section rendering that this story feeds,
   the per-goal detail endpoint whose `records` array is currently `[]`, the
   self-bootstrapping-concept pattern (`ensureResourceConcept`), the record-based
   linkage idiom, and the pure-core + read-time-derivation precedents you follow
   again. 0001/0002/0003 remain binding context.
6. `engineering-team/reviews/second-brain/4-attach-the-world.md` — PASS; its 3
   non-blocking findings are **OPEN.md row 87**, all in `GoalDetail.jsx` — which
   this story touches, so address/decide them here (plus row 86's href-less
   `GoalDetail` Retry, also that file).

## Load-bearing context from story 4

- **The record section is BUILT and waiting for you — you are its first
  producer.** `ui/src/pages/brain/GoalDetail.jsx` already renders the `records`
  array append-only (the `RecordEntry` component: `{date, type, summary}`, no
  edit affordance) below the pointers, but `GET /api/brain/goals/:slug` returns
  `records: []` today (`src/api/brain/index.js` `handleGetGoalDetail`). Story 5
  is the **first record producer**: create append-only work-record facts, and
  have the detail endpoint project them into `records` in the shape the UI
  already expects (`{date, type, summary}` with `type ∈ proposed/approved/
  skipped/worked/noted` — story 5 emits `worked` and `noted`). **Work entries
  list produced pointers as pointer cards** — the pointer machinery + the detail
  endpoint's pointer projection are already live; a work record references
  resources (created via `create-resource`) it produced.
- **Work Record is a NEW append-only concept — self-bootstrap it exactly like
  External Resource (ADR 0004 d8).** `ensureResourceConcept` in
  `src/api/normalize/index.js` is the template: an idempotent
  `create-concept` (treat "already exists" as success) + `save-schema` (folds
  the primary-property reconcile), run ONLY when the concept is absent (no
  per-write churn), via the internal fake-req/res `invokeNormalizeHandler`. Copy
  that shape for a `tapestry-work-record` concept. **Never firmware-seeded**
  (PRD §7.8). Note: the External Resource concept self-provisions per-instance on
  first attach — staging/prod won't have it until their first live attach; the
  Work Record concept behaves the same.
- **Writes ride the settled pattern.** Work-record writes are conversation/
  owner-gated normalize primitives (the `create-resource`/`create-child-goal`
  idiom): gate-first `isOwner(req) || req.localTrusted → 403`, validate before
  any write, serialize through the **existing `serializeGoalWrite`** (do **not**
  rename it — pinned by story-3 S5 and story-4 S4), local-only
  (`publishToStrfry` + `importEventDirect`, never `publishEverywhere`). Work
  records are **append-only** (§7.2) — each session's record is a new element;
  never an edit of a prior one.
- **The bounded-orientation AC is the load-bearing one — cost must stay FLAT as
  the corpus grows** (the machine-persona tolerance; PRD §5.4). AC 1: "state
  which goals exist and which goal it serves after a bounded orientation —
  without reading every goal, at a cost that does not grow with the number of
  goals." This is the design problem of the story: a bounded read budget, not a
  full-corpus scan. Do NOT build the Phase-4 brain keyword index or the Phase-3
  morning digest — the notes are explicit: the work record is the *raw material*
  of the future morning review; do not build the digest now.
- **The brain read module's import surface is now SIX, quadruple-pinned.**
  `src/api/brain/index.js` is pinned to exactly six requires by story-1 S2,
  story-2 S3, story-3 S1, **and** story-4 S11 (neo4j-driver, middleware/auth,
  assistantKeys, lib/brain/goals, lib/brain/hygiene, lib/brain/resources). If
  story 5 needs a new core (e.g. `lib/brain/work-records`), that require addition
  must amend **all four** allowlists in the same diff — plan it in Phase 3, do
  not discover it at the impl gate (the story-2/3/4 sibling-re-pin lesson, now
  three times). Story-2 S6 also pins the brain module strfry-/mutation-free —
  keep work-record *writes* in normalize.
- **`GoalDetail.jsx` is the file story 5 grows** — its jargon scan (story-4 S8 /
  story-3 S9) must extend to any new owner-facing strings; the record section's
  no-edit contract (story-4 S7) is review-blocking. OPEN.md rows 86 + 87 land
  here — address or explicitly ratify them.
- **Session identity / attribution.** AC 4 (work records dated + attributed) and
  AC 5 (a session-born goal idea is a capture *attributed to the session*, never
  launches — §7.3) need a notion of "which session." Decide at Architecture how a
  session identifies itself (the record's `session` field) without inventing an
  auth surface — likely a caller-supplied session id on the write, recorded as a
  dated fact.

## Practicalities

- TA pubkey is runtime-resolved (local instance currently `11f23fe4…`); never
  hand-transcribe it — fetch into a variable.
- Full live `npm test` ≈ 24 min. Background it from the start via the bounded
  `until grep -q "^Overall:" <log>; do sleep 15; done` waiter (OPEN.md rows
  74/83). **OPEN.md row 75 recurred in story 4 (occurrence 5):** the full gate's
  relationship-primitives H8 hit the strfry-router scan-count drift; it passes
  23/0 with `strfry-router` quiesced (`docker exec tapestry supervisorctl stop
  strfry-router`, rerun `node test/relationship-primitives.test.js`, then
  `start`). It is environmental — untouched-suite drift, never a second-brain
  defect; disposition it the same way.
- If you implement in the main session, spawning the independent reviewer
  subagent is required-by-practice (OPEN.md row 80b) — the story-4 review used
  the `reviewer` agent type and it re-ran every gate itself.
- New suites register in `test/test.js`'s **live** `overallOk` chain before the
  severed terminator (OPEN.md #43 — flip the current terminator's `;` to ` &&`,
  add your term ending `;`, leave the dead block) plus the `totalSkipped` array.
- Local dev loop: the repo bind-mounts into the container; new/changed server
  routes need `docker exec tapestry supervisorctl restart brainstorm`.

## Then

Act as the engineering Product Owner: promote Story 5 — "Sessions read the
brain" — via `/plan-feature` into `engineering-team/stories/second-brain/`
(next story number: 5).

Run human-gated: the operator answers every phase gate. Any owner-facing copy
comes verbatim from `product-team/guides/second-brain-style-guide.md`. One
story per session.
