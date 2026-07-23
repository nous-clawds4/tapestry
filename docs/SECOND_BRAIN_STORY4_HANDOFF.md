# Second Brain — Story 4 Session Handoff (2026-07-23)

**Status:** 🔴 OPEN

> Written at the close of the story-3 session (break-a-goal-into-pieces: review
> PASS, promoted to production 2026-07-23, PRs #432/#433). This is the pickup
> prompt for the next session, with the load-bearing discoveries from story 3
> baked in. When story 4 ships, flip this Status to ✅ ADDRESSED.

## Pickup prompt

Pick up story 4 of the second-brain book — **"Attach the world — pointers and
the goal's page"** (External Resource pointers + the one-spine Goal detail;
PRD §5.3, §5.8, §6). Stories 1–3 are Done and in production. The book, epic,
and stories folder exist — do **not** re-open the book. Branch fresh off
updated staging (`git checkout staging && git pull`, then re-create
`feat/second-brain`).

Read, in order:

1. `product-team/stories-queue.md` — Second Brain block, Story 4. Queue order is
   pickup order. Note the dependency line: Story 1 must ship first; **Story 3 is
   not required** (a childless goal can carry pointers) — but story 3 shipped the
   detail page this story extends, so in practice you land in its file.
2. `product-team/prd/second-brain.md` — §5.3 (resource pointers: the brain
   organizes knowledge, never contains it — content stays in its native home),
   §6 (data model: **External Resource** is a *new* concept on the graph's
   established pointer-element pattern — title, locator-kind {file / vault note /
   nostr event / repository / web address}, locator, why-kept, keywords,
   noted-on, last-verified; freshness derived from verification age), §5.8, §7
   (the Policy Constitution binds every story — notably §7.2 append-only record,
   §7.8 adopt/runtime-identity).
3. `product-team/guides/second-brain-design-guide.md` — the **Pointer card**
   component (kind marker as typography, title as accent link, locator preview,
   freshness line; opens native, no embed), the **Record entries** component
   (append-only chronological list; **no edit affordance, ever**), and the
   Goal-detail "one spine" principle (intent + pointers + record on one page);
   `second-brain-wireframes.html` §2 is the binding detail layout.
   `second-brain-style-guide.md` — freshness wording verbatim ("verified N days
   ago" / "not verified in N days" / "unreachable at last check"), the pointer
   empty state ("Nothing attached yet — resources this goal needs will appear
   here."), standing words canonical lowercase.
4. `engineering-team/epics/second-brain.md` + `audits/second-brain/book.md` —
   roster, guardrails, coverage-gap notes (rename/abandon and the category
   filter are still deferred).
5. `engineering-team/decisions/second-brain/0001-*.md`, `0002-*.md`, `0003-*.md` —
   binding context. **0003 is the one to internalize:** it shipped the minimal
   Goal detail (`ui/src/pages/brain/GoalDetail.jsx` at `/tapestry/goals/:slug`)
   that this story grows into the one-spine page, folded primary-property
   reconciliation into `save-schema`, and set the record-based / read-only-brain
   / writes-in-normalize precedents you will follow again.
6. `engineering-team/reviews/second-brain/3-break-a-goal-into-pieces.md` — PASS;
   its five non-blocking findings are **OPEN.md row 86**, several of which land
   naturally on this story's touch (GoalDetail's href-less Retry; the
   collision-check raw-row gap on the normalize write surface).

## Load-bearing context from story 3

- **The minimal Goal detail is your landing zone — extend it in place, don't
  rebuild.** `ui/src/pages/brain/GoalDetail.jsx` exists (route `goals/:slug`,
  crumb "Detail"), reads through `useBrainGoals` and selects the record by slug
  (resolver-consistent: oldest-capture wins on a slug collision), and renders
  intent (name, statement, standing, capture metadata, parent context,
  "Done means" / "Stays inside"). Story 4 adds the **pointers** section and the
  **append-only record** section below the intent — the wireframe §2 spine.
  ADR 0003 d11 explicitly named this the moment to introduce a **per-goal read
  endpoint** if the whole-list select gets expensive (the corpus is small today;
  measure before denormalizing — architecture-invariant reflex #4).
- **New concept = the bootstrap sequence, now auto-reconciling.** External
  Resource is runtime-created like the goal concept (never firmware-seeded):
  `POST /api/normalize/create-concept` → `POST /api/normalize/save-schema` →
  `create-element`. As of story 3, **`save-schema` folds the primary-property
  reconcile in the same call** (ADR 0003 d8 — ADR 0002's Option C landed), so no
  separate `reconcile-primary-property` call is needed at bootstrap; the response
  carries `primaryProperty: {result:'reconciled'|'already-consistent'|'not-applicable'|'error'}`.
  This fold now also runs for every firmware concept during install pass 2
  (disclosed/scoped in 0003 d8) — convergent, no-write when already consistent.
- **Freshness is a NEW read-time derivation, parallel to `deriveStanding`.**
  Standing stays derived-not-stored (PRD §6). Resource freshness
  (current / stale / unreachable) derives from the last-verified date the same
  way — a pure function, dependency-free, in a core module (follow the
  `src/lib/brain/goals.js` precedent; a sibling `resources.js` core is the
  natural shape, and it keeps the brain read module's pinned import surface
  honest — see next point). Verifying a resource updates `last-verified`; that
  is a **write** and belongs in normalize (validated + gated + local-only),
  never in the read-only brain module.
- **The brain read module's import surface is triple-pinned — plan any new
  require at Test Design.** `src/api/brain/index.js` is pinned to exactly five
  requires by story-1 S2, story-2 S3, **and** story-3 S1 (which re-pins the same
  five). Story 3 added its behavior through *new exports of the two cores it
  already required* and touched none of the pins. If story 4 needs a new core
  (e.g. `lib/brain/resources`), that is a require addition that must amend **all
  three** allowlists in the same diff — plan it in Phase 3, do not discover it at
  the impl gate (this is the story-2/story-3 sibling-re-pin lesson, twice now).
  Story-2 S6 also pins the brain module strfry-/mutation-free — keep resource
  *writes* out of it.
- **`GoalDetail.jsx` is outside story-1's jargon scan — story 3 gave it its own
  (suite S9).** Any owner-facing string you add to the detail (pointer kind
  markers, freshness lines, the empty state) must stay clear of the banned list
  and come verbatim from the style/design guides; extend the S9-style scan to
  cover the new strings.
- **Append-only is a review-blocking contract (PRD §7.2 / design guide).** The
  record section renders dated facts with **no edit affordance on any entry,
  ever**. Don't add an inline-edit stub "for later"; a reviewer who sees one
  rejects.

## Practicalities

- TA pubkey is runtime-resolved (local instance currently `11f23fe4…`); never
  hand-transcribe it — fetch into a variable.
- Full live `npm test` ≈ 24 min. Background it from the start (OPEN.md row 83),
  and use the **corrected** waiter pattern the story-3 review pinned down: a
  bounded `until grep -q "^Overall:" <log>; do sleep 15; done` loop (the harness
  promotes it to a *tracked* background task and re-invokes you on completion) —
  **not** the old "nohup + repeated sleep-and-tail" phrasing, which the Bash
  tool's foreground-sleep block now refuses (OPEN.md rows 74/83, updated
  2026-07-23).
- OPEN.md row 75 (strfry scan-count drift) **did not recur** in story 3 — both
  full gates passed first-try with `strfry-router` active. If it does resurface
  (relationship-primitives H8 / capture H4, "+1 scan count" signature), quiesce
  `strfry-router` for the rerun and restart it after.
- If you implement in the main session, spawning the independent reviewer subagent
  is required-by-practice (OPEN.md row 80b) — and it must poll its own nohup'd
  gate inline rather than ending its turn (row 74 recurrence risk).
- New suites register in `test/test.js`'s **live** `overallOk` chain before the
  severed terminator (OPEN.md #43 — the terminator now sits on the story-3 term;
  flip its `;` to ` &&`, add your term ending `;`, leave the dead block
  untouched) plus the `totalSkipped` array.
- Local dev loop: the repo bind-mounts into the container; new/changed server
  routes need `docker exec tapestry supervisorctl restart brainstorm`.

## Then

Act as the engineering Product Owner: promote Story 4 — "Attach the world —
pointers and the goal's page" — via `/plan-feature` into
`engineering-team/stories/second-brain/` (next story number: 4).

Run human-gated: the operator answers every phase gate. Any owner-facing copy
comes verbatim from `product-team/guides/second-brain-style-guide.md`. One
story per session.
