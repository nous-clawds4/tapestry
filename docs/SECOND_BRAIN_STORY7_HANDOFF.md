# Second Brain — Story 7 Session Handoff (2026-07-24)

**Status:** ✅ ADDRESSED — story 7 (teach-it-what-matters) shipped to production 2026-07-24: staging PR #454, prod promotion PR #455, independent review PASS (`engineering-team/reviews/second-brain/7-teach-it-what-matters.md`). Pickup for story 8: `docs/SECOND_BRAIN_STORY8_HANDOFF.md`.

> Written at the close of the story-6 session (the-proposal-loop: review PASS,
> shipped to production 2026-07-24, staging PR #449, prod promotion PR #450). This
> is the pickup prompt for the next session, with the load-bearing discoveries
> from story 6 baked in. When story 7 ships, flip this Status to ✅ ADDRESSED.

## Pickup prompt

Pick up story 7 of the second-brain book — **"Teach it what matters — priority
signals"** (the owner records pairwise choices between goals — dated, attributed,
framing-tagged — which proposals *may* cite but which never launch anything —
PRD §5.6, §6, §7.6). Stories 1–6 are Done and in production. The book, epic, and
stories folder exist — do **not** re-open the book. Branch fresh off updated
staging (`git checkout staging && git pull`, then re-create `feat/second-brain` —
note: the remote `feat/second-brain` is auto-deleted when each story's PR merges,
so the re-create is a fresh branch each time).

Read, in order:

1. `product-team/stories-queue.md` — Second Brain block, Story 7. Dependency line:
   **only Story 1 is strictly required** (goals must exist); it "pairs naturally
   after Story 6 but does not require it." Note the 5 ACs and the "Notes for
   engineering": **the framing is a replaceable slot by design** (PRD §7.6; the
   operator's stated epistemology — "99 wrong framings, find the right one by
   iterating"); **V1 ships pairwise only — no score aggregation, no ranking
   display**; the signals are *data for the future*, not a feature surface now.
2. `product-team/prd/second-brain.md` — §5.6 (priority signals: the owner records
   pairwise choices "solve one today: which?" with an optional one-line reason;
   each signal is dated, attributed, and **tagged with the framing that produced
   it**, so a replaced framing's history stays interpretable; **recorded, never
   acted on autonomously in v1** — proposals may cite them as rationale, nothing
   launches from them), §6 (**Priority Signal** is a *new append-only* concept —
   *prefers goal / over goal, reason, judged-by, judged-on, framing tag*), §7.6
   (the prioritization framing is a **replaceable slot**: replacements are
   proposed with evidence and ratified by the owner — the constitution binds this).
3. `product-team/guides/second-brain-design-guide.md` + `second-brain-style-guide.md`
   — **note the gap:** the guides do **not** define a signal-specific component or
   a spine record-type word for signals (the design-guide record types are
   `proposed / approved / skipped / worked / noted` — no signal word). The AC
   requires signals be "**visible on the goals they touch**," so the Architect
   must decide the spine representation (a new record type word? a distinct
   panel?) and any owner-facing copy — flag it as a ratification gate the way
   story 6's **approve-confirmation copy** was (that gap was surfaced at planning
   and ratified at the Architecture gate to *"Approved — launch it when you're
   ready."* — the same move applies here). **Comparisons, not decimals** still
   binds: a signal is a *choice between two goals*, never a number.
4. `engineering-team/epics/second-brain.md` + `audits/second-brain/book.md` —
   roster, guardrails. After story 7, the book has only **story 8** (export/restore)
   left, then it closes. (Epic hygiene note: the per-story "Done" markers in the
   epic lag — stories 3/4/5 still read "Queued" though they shipped; story 6 is
   marked Done. Reconcile 3–6 to Done at book-close, or when convenient.)
5. `engineering-team/decisions/second-brain/0006-the-proposal-loop.md` — **the one
   to internalize.** Story 6 is the **third** self-bootstrapping append-only
   concept (after External Resource / Work Record) and it settled the
   **append-only-by-construction** idiom you'll reuse wholesale: `ensureXConcept`
   (idempotent create-concept + save-schema via `invokeNormalizeHandler`),
   `mintXElement` (nonce/`randomDTag`, **never `regenerateJson`**), record-based
   linkage (the `goal` slug field, dereferenced at read by grouping — no edge, no
   whitelist change), and the pure-core + read-time-derivation pattern
   (`src/lib/brain/proposals.js`). ADRs 0001–0005 remain binding context.
6. `engineering-team/reviews/second-brain/6-the-proposal-loop.md` — PASS; 2
   non-blocking findings, both dispositioned (the error-state Retry button was
   fixed post-review; the `ensureProposalConcept`/`already-open` ordering is
   benign).

## Load-bearing context from story 6

- **Priority Signal is a NEW append-only concept — self-bootstrap it like Work
  Record / Proposal (the fourth such concept).** `ensureProposalConcept` /
  `mintProposalElement` in `src/api/normalize/index.js` are the exact template
  (idempotent bootstrap; append-only random-d-tag mint; never `regenerateJson`;
  gated + validated + serialized through the **existing `serializeGoalWrite`** —
  do **not** rename it). **Never firmware-seeded** (PRD §7.8); self-provisions
  per-instance on the first live write. Unlike Proposal (type-discriminated
  proposed/approved/skipped), a Signal likely has **one shape**
  (`prefers`/`over`/`reason`/`judgedBy`/`judgedOn`/`framing`) — simpler; no `type`
  enum needed unless the Architect finds a reason.
- **THE new wrinkle: a signal touches TWO goals (`prefers` + `over`), so it must
  surface on BOTH goals' spines.** Work records and proposals each attach to
  **one** goal (`workRecord.goal` / `proposal.goal`); a Priority Signal is about a
  **pair**. The goal-detail `records[]` projection (`handleGetGoalDetail`,
  `src/api/brain/index.js`) currently groups by a single `goal` slug — story 7
  must project a signal onto **both** the prefers-goal and the over-goal (each
  reading "chose this over X" / "X chosen over this", in plain comparative
  language). Decide this at Architecture — it is the story's spine, the way the
  (a)/(b) transition was story 6's and bounded-orientation was story 5's. The
  pure core is `src/lib/brain/proposals.js` (parse / group-by-goal / project) —
  mirror it as `src/lib/brain/signals.js`, but the grouping fans out to two goals.
- **The framing tag is a replaceable slot (PRD §7.6).** Each signal records the
  framing that produced it, so a later framing swap leaves earlier signals
  interpretable. V1 just records the framing string on the signal; **no framing
  registry, no swap mechanism, no ranking/aggregation** (all deferred — the
  signals are raw data for the future). Don't build a framing-management surface.
- **Signals are recorded, never acted on (§7.6/§5.6).** A signal **never** causes
  a launch or a decision. Story 6's `make-proposal` does **not** consume signals
  (its rationale is caller-supplied); AC4's "a proposal's why-now *may* cite
  recorded signals in plain words" is a soft affordance — the conversational agent
  can read signals and mention them; **no hard wiring of signals into
  make-proposal is required** (and per the queue note, story 6 doesn't depend on
  signals). If the Architect adds a signals **read** surface, it stays read-only
  and in the brain module.
- **Writes ride the settled pattern; a signal validates BOTH goals exist + are
  distinct.** Gate-first (`isOwner(req) || req.localTrusted → 403`), validate
  before any write (both goal slugs resolve to real goals; refuse if either is
  unknown/ambiguous, or if `prefers === over`), serialize through
  `serializeGoalWrite`, local-only (`publishToStrfry` + `importEventDirect`,
  never `publishEverywhere`). Mirror `make-proposal`'s live-graph validation.
  Unlike make-proposal, a signal does **not** require the goals to be *viable* —
  the owner can prefer any goal over any other (confirm at the gate).
- **The brain read import surface is now EIGHT, sextuple-pinned.**
  `src/api/brain/index.js` is pinned to eight requires by story-1 S2, story-2 S3,
  story-3 S1, story-4 S11, story-5 S8, **and** story-6 S8 (the six cores +
  `lib/brain/work-records` + `lib/brain/proposals`). If story 7 adds
  `lib/brain/signals`, that require addition must amend **all six** sibling
  allowlists in the same diff — the recurring sibling-re-pin lesson, now the
  **sixth** time. Plan it in Phase 3. The brain module stays read-only (signal
  **writes** live in normalize).
- **Copy is comparisons, never decimals.** A signal is "chose A over B" (+ an
  optional one-line reason), never a score. The pairwise prompt is "solve one
  today: which?" (PRD §5.6). Any new owner-facing string passes the banned-jargon
  scan (*element, kind, schema, event, pubkey, superset, concept header, persona,
  acceptance criteria, lease, payload, endpoint*), no exclamation marks. **No
  numeric score anywhere.** The signal's spine wording + any capture confirmation
  are a **style-guide gap** — ratify the exact copy at a gate (see Read #3).

## Practicalities

- TA pubkey is runtime-resolved; never hand-transcribe — fetch into a variable
  (`/api/assistant/pubkey`).
- Full `npm test` ≈ 24+ min (now includes the story-6 `the-proposal-loop` suite).
  Background it from the start via the bounded `until grep -q "^Overall:" <log>;
  do sleep 15; done` waiter (OPEN.md rows 74/83). **Run the long command *as* the
  backgrounded call — no inner `nohup … &`** — or the launcher exits immediately
  and the real process detaches untracked (story-6 lesson: this idled a spawned
  reviewer subagent; it had to be resumed with SendMessage).
- **The `tl-publication-from-pins-publish` suite flakes under heavy local-session
  churn** — it goes non-deterministically red (`status 0` / empty-TL /
  missing-cutoff-tag) as the local Meili/WoT index degrades from many fixture
  create/teardown cycles; it is **unrelated to any brain code** (zero overlap with
  the second-brain diff) and was green in the clean pre-merge run. Don't chase it;
  CI in a clean environment is the authoritative gate. (Row-75 strfry-router
  scan-count drift is a separate known environmental flake on
  `relationship-primitives`.)
- New suite registers in `test/test.js`'s **live** `overallOk` chain before the
  severed terminator (OPEN.md #43 — flip the current terminator's `;` to ` &&`,
  add your term ending `;`, leave the dead block) plus the `totalSkipped` array
  and a per-suite summary line. Story 6's `theProposalLoopResult` is now the live
  terminator.
- **Parallel-session collisions are live.** The tapestries book has been shipping
  concurrently (story 6 hit it: tapestries #3 merged to staging mid-session,
  forcing a re-sync merge — conflicts only in `test/test.js` runner-registration +
  `ui/src/styles.css`, both **additive → keep both** — and a concurrent
  `staging→main` promotion (#448) carried tapestries #3 to prod, which happened to
  make story 6's prod promote clean). **Re-sync (merge origin/staging) before the
  staging PR; re-check `origin/main..origin/staging` before any prod promote** — it
  may bundle another team's work your authorization doesn't cover.
- If you implement in the main session, spawning the independent reviewer subagent
  is required-by-practice (OPEN.md row 80b) — re-run every gate itself, trust
  nothing the implementer reported.
- Host shell quirk: bare `curl` / `python3` / `docker` / `head` intermittently
  resolve as "command not found" inside compound scripts; use explicit paths
  (`/usr/bin/curl`, `/opt/homebrew/bin/python3`).
- Local dev loop: the repo bind-mounts into the container; new/changed server
  routes need `docker exec tapestry supervisorctl restart brainstorm`; UI changes
  need the in-container `npx vite build`.

## Then

Act as the engineering Product Owner: promote Story 7 — "Teach it what matters —
priority signals" — via `/plan-feature` into `engineering-team/stories/second-brain/`
(next story number: 7).

Run human-gated: the operator answers every phase gate. Any owner-facing copy
comes verbatim from `product-team/guides/second-brain-style-guide.md` (and any
gap — the signal spine wording — is ratified at a gate, per story 6's
approve-string precedent). One story per session. After story 7, only story 8
(export/restore) remains before the book closes; at book-close, back-fill the
ratified approve string *"Approved — launch it when you're ready."* into the
style guide's confirmations list (ADR 0006 d16 / the product-team return edge).
