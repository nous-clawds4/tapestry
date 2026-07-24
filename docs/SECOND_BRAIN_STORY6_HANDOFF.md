# Second Brain — Story 6 Session Handoff (2026-07-24)

**Status:** 🔴 OPEN

> Written at the close of the story-5 session (sessions-read-the-brain: review
> PASS, shipped to production 2026-07-24, staging PR #439, carried to prod by the
> concurrent promotion PR #440). This is the pickup prompt for the next session,
> with the load-bearing discoveries from story 5 baked in. When story 6 ships,
> flip this Status to ✅ ADDRESSED.

## Pickup prompt

Pick up story 6 of the second-brain book — **"The proposal loop"** (the system
nominates one viable goal with comparative rationale; the owner approves-and-
launches or skips-with-reason; every decision is recorded — PRD §5.5, §5.8,
§7.1–7.2, §7.7). Stories 1–5 are Done and in production. The book, epic, and
stories folder exist — do **not** re-open the book. Branch fresh off updated
staging (`git checkout staging && git pull`, then re-create `feat/second-brain`).

Read, in order:

1. `product-team/stories-queue.md` — Second Brain block, Story 6. Dependency line:
   **stories 3 and 5 must ship first** (viable goals must exist; decisions and
   records share the spine — both shipped). Note the 6 ACs and the "Notes for
   engineering": the proposer's **cadence and selection heuristic are deliberately
   unspecified** — the Architect chooses the *simplest honest mechanism*; the
   **decision record's completeness is the point** (it's the calibration corpus
   for the Phase-3 entry metric: agreement ≥50% over ≥15 decisions). **Proposal
   auto-expiry is Phase 2 — do not build it.**
2. `product-team/prd/second-brain.md` — §5.5 (propose-only cadence: exactly one
   viable goal, why-now legible in ten seconds, named runners-up each with a
   one-line why-not; approve **and the owner launches the session themselves in
   v1**, or skip with a required one-line reason; **nothing is decided silently**
   — open proposals are decided or remain open), §6 (**Proposal** is a *new*
   append-only concept — nominates goal, why-now, passed-over goals with why-nots,
   made-on; decision open → approved | skipped, decision-reason required on skip,
   decided-on), §7.1 (the brain decides; the metabolism asks/reports), §7.2
   (append-only — corrections are new facts), §7.7 (plain language is a contract).
3. `product-team/guides/second-brain-design-guide.md` — the **Proposal card**
   (the *emphasis card of the product*: accent-tinted background — the **one
   permitted derived tint** `rgba(88,166,255,0.08)`, no other new tokens — "**Next:**
   {goal}" · why-now 1–2 body sentences · a "considered instead" block, one line
   per passed-over goal (name + muted why-not) · **two equal-weight buttons**:
   Approve (solid) and Skip… (outline, ellipsis signals a reason is coming)) and
   the **Skip-with-reason inline** control (required reason, placeholder "why not
   this one, in a few words", Skip disabled until non-empty, Enter submits). The
   Proposal queue is **wireframes §3** — the **third v1 view**. `second-brain-
   style-guide.md` — the proposal register skeleton (line 28), the skip prompt,
   "Skipped — noted.", **no numeric score in owner-facing copy** (comparisons and
   words only).
4. `engineering-team/epics/second-brain.md` + `audits/second-brain/book.md` —
   roster, guardrails, coverage-gap notes (rename/abandon + category filter still
   deferred). Story 6 is the propose/decide loop; after it, the book has only
   story 7 (priority signals) + story 8 (export/restore) left.
5. `engineering-team/decisions/second-brain/0005-*.md` — **the one to
   internalize.** Story 5 built the `records[]` projection as an **extension seam**
   (d10: "Extensible — stories 6/7 merge their concepts' projections into this
   same array"). It shipped the self-bootstrapping-concept pattern
   (`ensureWorkRecordConcept`), the append-only-by-construction mint (random
   d-tag, never `regenerateJson`), the bounded-orient precedent, and the pure-core
   + read-time-derivation idiom. ADRs 0001–0004 remain binding context.
6. `engineering-team/reviews/second-brain/5-sessions-read-the-brain.md` — PASS; 2
   non-blocking findings = **OPEN.md row 91** (`servingGoal` unused in
   `note-goal-idea`; internal resolver jargon — both defensible/observation-only).

## Load-bearing context from story 5

- **The `records[]` projection is the extension seam you plug into.**
  `handleGetGoalDetail` (`src/api/brain/index.js`) reads Work Records, projects
  each to `{date, type, summary, session, questions, produced}`, sorts newest
  first, and returns them. Story 6 adds the **Proposal** concept's projection into
  the **same** `records[]` array — new type words **`proposed / approved /
  skipped`** (story 5 emits only `worked` / `noted`; the RecordEntry UI already
  renders any type word). Read all Proposals for the goal, project, **merge** with
  the work-record projection, sort the combined list by date. The pure core
  pattern is `src/lib/brain/work-records.js` (parse / group-by-goal / recency
  sort) — mirror it as `src/lib/brain/proposals.js`.
- **THE load-bearing design question: a proposal's `open → approved | skipped`
  transition vs. strict append-only (§7.2).** Work records are *strictly*
  append-only (never mutated, never `regenerateJson`'d — that's the structural
  §7.2 guarantee story 5 established). But a **Proposal changes state** (open →
  decided). Two shapes the Architect must weigh: **(a)** mutate the proposal
  element's `decision` field in place (a *durable-intent update*, the way story
  4's `verify-resource` overwrites `lastVerified` — permissible because §7.2
  governs the **record entities**, not all metadata); or **(b)** keep the
  proposal element immutable and append a **separate decision fact** (an
  approved/skipped record referencing the proposal), deriving "is this proposal
  still open?" at read from whether a decision fact exists. **(b) is more
  consistent with the append-only spine and gives the goal's record its
  `approved`/`skipped` entries for free**, but costs a read-time join; **(a)** is
  simpler but reintroduces a mutable element. Decide this at Architecture — it is
  the story's spine, exactly as the (goal, locator) identity was story 4's and
  bounded-orientation was story 5's.
- **Proposal is a NEW append-only concept — self-bootstrap it like Work Record.**
  `ensureWorkRecordConcept` in `src/api/normalize/index.js` is the exact template
  (idempotent `create-concept` + `save-schema` via the internal fake-req/res
  `invokeNormalizeHandler`, run only when the concept is absent). **Never
  firmware-seeded** (PRD §7.8); self-provisions per-instance on the first live
  write (staging/prod won't have `tapestry-work-record` OR the new proposal
  concept until their first live write — that's expected).
- **Writes ride the settled pattern.** Gate-first (`isOwner(req) ||
  req.localTrusted → 403`), validate before any write, serialize through the
  **existing `serializeGoalWrite`** (do **not** rename it — pinned by story-3 S5,
  story-4 S4, story-5 S4), local-only (`publishToStrfry` + `importEventDirect`,
  never `publishEverywhere`). Nominating a proposal = a new element; the decision
  = per the (a)/(b) call above.
- **Story 6 ADDS a new owner-facing VIEW — the Proposal queue** (route +
  page, wireframes §3). This is unlike story 5 (whose orient surface was
  *agent-facing*, no new UI page). Expect a new `ui/src/pages/brain/*` page +
  route in `App.jsx` + nav entry (owner-gated, mirroring the Goals view). **The
  tapestries stories (#1/#2, now in prod) added Playwright specs
  (`tests/brainstorm/*.spec.js`) for their new UI pages** — consider whether the
  Proposal queue's interactive Approve/Skip flow wants Playwright coverage
  (story 1–5's brain UI has been source-asserted only; the interactive
  skip-reason-required flow may be worth a real browser test).
- **The brain read import surface is now SEVEN, quintuple-pinned.**
  `src/api/brain/index.js` is pinned to seven requires by story-1 S2, story-2 S3,
  story-3 S1, story-4 S11, **and** story-5 S8 (the six cores + `lib/brain/work-
  records`). If story 6 adds `lib/brain/proposals`, that require addition must
  amend **all five** sibling allowlists in the same diff — plan it in Phase 3
  (the recurring sibling-re-pin lesson, now five times). Story-5 S13 also pins the
  brain module strfry-/mutation-free — keep proposal *writes* in normalize.
- **Copy is verbatim.** Proposal register: "**Next:** {goal}." + why-now (1–2
  sentences) + "considered instead" + one line per runner-up. Skip prompt: "why
  not this one, in a few words". Confirmations: "Skipped — noted." Empty state:
  "No proposal right now — the next one appears when there are viable goals to
  choose between." Error: "The proposer couldn't run — its last message: {plain-
  English reason}. Nothing was decided for you." **No numeric score** anywhere
  owner-facing; the jargon scan (story-3 S9 / story-4 S8 / story-5 S10) extends to
  the queue's new strings.

## Practicalities

- TA pubkey is runtime-resolved (local instance currently `11f23fe4…`); never
  hand-transcribe — fetch into a variable.
- Full `npm test` ≈ 24+ min (now includes the story-5 suite). Background it from
  the start via the bounded `until grep -q "^Overall:" <log>; do sleep 15; done`
  waiter (OPEN.md rows 74/83). **OPEN.md row 75** (relationship-primitives H8
  strfry-router scan-count drift) is environmental — quiesce `strfry-router` and
  rerun that suite if the +1 signature recurs; it passed 23/0 clean in the
  story-5 full run.
- New suite registers in `test/test.js`'s **live** `overallOk` chain before the
  severed terminator (OPEN.md #43 — flip the current terminator's `;` to ` &&`,
  add your term ending `;`, leave the dead block) plus the `totalSkipped` array.
  Story 5's registration is now the live terminator (`sessionsReadTheBrainResult`).
- **Parallel-session collisions are live.** The tapestries book has been shipping
  concurrently (PRs #438/#440/#441). Story 5 hit this twice: (1) merged
  `origin/staging` mid-flight after going 11 commits behind — **only OPEN.md
  conflicted** (row-number collision, resolved by renumber + a numbering note);
  (2) a concurrent `staging → main` promotion (#440) carried story 5 to prod
  *during* the staging smoke, so `/cycle-prod` found nothing of ours to promote.
  **Re-sync (merge origin/staging) before the staging PR; re-check
  `origin/main..origin/staging` before any prod promote** — it may bundle another
  team's work your authorization doesn't cover.
- If you implement in the main session, spawning the independent reviewer
  subagent is required-by-practice (OPEN.md row 80b) — the story-5 review used the
  `reviewer` agent type and re-ran every gate itself.
- Host shell quirk seen in the story-5 deploy: bare `curl` / `python3` / `docker`
  / `head` intermittently resolve as "command not found" inside compound scripts;
  use explicit paths (`/usr/bin/curl`, `/opt/homebrew/bin/python3`).
- Local dev loop: the repo bind-mounts into the container; new/changed server
  routes need `docker exec tapestry supervisorctl restart brainstorm`; UI changes
  need the in-container `npx vite build` (or the cycle-local host build + docker
  cp).

## Then

Act as the engineering Product Owner: promote Story 6 — "The proposal loop" —
via `/plan-feature` into `engineering-team/stories/second-brain/` (next story
number: 6).

Run human-gated: the operator answers every phase gate. Any owner-facing copy
comes verbatim from `product-team/guides/second-brain-style-guide.md`. One story
per session.
