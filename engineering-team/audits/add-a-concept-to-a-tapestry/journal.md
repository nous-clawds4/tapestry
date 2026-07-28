# Decision journal — add-a-concept-to-a-tapestry

Append-only. Every gate decision, answered question, judge verdict, and halt.
Mode: **operational Direction** (goal-derived terms). Staging is the ceiling.

---

## 2026-07-28T03:58:52Z — Eligibility resolved before any book file existed

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** `GET /api/brain/direction/add-a-concept-to-a-tapestry`, run from inside the container (host-side brain reads answer 403), returned `eligible: true` — anchor `add-a-concept-to-a-tapestry` at **distance 0** (the goal is its own anchor, as owner policy v1 `maxAnchorDistance: 0` requires), ratified by proposal `proposed-add-a-concept-to-a-tapestry-56a594c4` approved `2026-07-28`. `boundaryReview.required: false` with zero steps, so **no boundary judging is owed** — the two-call verdict flow does not apply at distance 0. The operator's kickoff message pre-stated exactly this resolution; it was re-checked here rather than taken on report.
**Next:** Read the goal's prompt from the raw record, per the operator's instruction.

## 2026-07-28T03:59:30Z — Goal prompt read from the raw record; endpoint copy agrees

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** The operator instructed reading the goal's `prompt` from the raw record because the goals read API drops the field (`parseGoalRow`). Done via `POST /api/neo4j/query`: the raw record carries `prompt` (`promptVersion: 1`) with the 2026-07-28 research — tapestries are relay-published and relay-read (Neo4j not in the path), kind-39999 replacement is native (same kind + author + d-tag), so editing is republishing with **no reindex step**; both publish paths (owner browser-sign, assistant `signAs`) and a concept picker already exist; the re-sign branch is decided by the Tapestry's author pubkey — data, not a design decision. The Direction endpoint on this deployment **also** returns `terms.prompt` (the `store-and-show-the-prompt-and-the-estimate` book shipped that), and the two copies agree. The evidence goal the prompt cites was read too: work record `worked-find-out-whether-saving-a-tapestry-again-actually-updates-it-cc07369c` answers "yes, cleanly" and corroborates every conclusion; its open question (the ~71 unread Neo4j tapestry rows) stays on that goal, not this book.
**Next:** Open the book eagerly; generate the derived section, never hand-author it.

## 2026-07-28T04:06:41Z — Book opened eagerly; derived section generated, not typed

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** `book.md` was opened **before any story exists**, so the anchor gates the work while it happens. The `## Direction mode (operational) — goal-derived` section is **generated** per `roles/director.md`: a generator script read a fresh endpoint fetch (`derivedAt: 2026-07-28T04:06:02.932Z`) and emitted the section; the section was then extracted back out of the assembled file and diffed **byte-identical** against the generator's output, so no character of it was typed. The sole transform is redacting the pubkey inside the goal uuid to `<TA>` — verified first via `GET /api/assistant/pubkey` that it **is** the live assistant pubkey (house rule: never write a per-deployment pubkey into a shared file; precedent `audits/store-and-show-the-prompt-and-the-estimate/book.md`). The section states the `surrendered` block verbatim (baseline commit, pinned governing versions — each with the endpoint's own reason) and carries the `unavailable` block and the owner's `prompt` verbatim. Terms were identical across both of this session's fetches (03:58:52Z and 04:06:02Z) — no drift inside the session.
**Next:** Transcribe the operator's kickoff instructions, then complete preflight.

## 2026-07-28T04:07:30Z — Operator instructions at open: story cap 2, goal is read-only, splitting guidance

**Story/Phase:** — / Stage 0 preflight
**Decision:** ANSWER
**Judge:** n/a
**Why:** The operator's kickoff message set three run-governing instructions, transcribed into `book.md` § "Operator instructions at open" and recorded here as an ANSWER because they are operator-authored terms, not Director inferences: (1) **story cap for this book is 2** — halt *before* approving a story that would exceed it; operational mode derives no deadline and no story cap from the goal, so two of the six stopping rules cannot fire on their own, and this cap substitutes for them (the last book reached three stories and 34 hours with nothing to stop it); (2) **do not edit the goal** — any change to its `deliverable` or `boundary` halts the run with `anchor-stale` and costs a fresh approval, which has already happened once on an earlier run; (3) **splitting the goal is the most expensive known move** (~11 hours per story, measured) — context, not licence: a story genuinely spanning more than one subsystem must still be split, and said so; no under-splitting to save time. The operator also attested the preflight: branch `feat/add-a-concept-to-a-tapestry` fresh off staging at 0/0 with a clean tree, and the Stage-0 baseline **verified GREEN** — `npm test`, `Overall: PASS`, 81 suites, 1452 passing, 0 failures, 31 skipped (the known environmental family), ~32 minutes, completed at "23:44 on 2026-07-28" by the operator's clock (~14 minutes before this session's first eligibility call) — with the explicit instruction **not to redo it, but to confirm the rest**.
**Next:** Confirm the remaining preflight steps independently; journal the kickoff.

## 2026-07-28T04:08:00Z — Kickoff: preflight status, confirmed rather than taken

**Story/Phase:** `tapestries` / Stage 0 preflight
**Decision:** INFO
**Judge:** n/a
**Why:** Preflight state, honestly recorded. **Step 2 arming baseline — not applicable, and not silently skipped:** operational mode *knowingly surrenders* the pinned baseline commit and pinned governing versions, for the endpoint's own stated reason (reproducibility traded for operational cost; both retained in armed mode). The branch point (`origin/staging` `db7c5a7a`) is noted for cold resume only and is **not** a pinned baseline. **Contamination check passes, and not vacuously:** the `tapestries` epic exists (`**Status:** Done`) with shipped stories 3–4 belonging to the *closed* `tapestries` book — prior art, not contamination; nothing for **this** goal predates the run (no story or ADR about adding a concept to an existing Tapestry — `stories/tapestries/` holds only 3–4, `decisions/tapestries/` only 0003 create-authoring and 0004 detail-views; branch tip **equals** `origin/staging` at `db7c5a7a`, zero commits, no source changes). **Step 3:** working tree clean; fetched; no drift to rebase. **Step 4:** the two other open books (`task-timeline`, `unified-tagging-ui`) and the `🔴 OPEN` handoffs (communities protocol delivery, harness review, b-tag affiliation) were scanned — none touches the tapestries UI surface; no entanglement. **Step 5:** on `feat/add-a-concept-to-a-tapestry` (created in the operator's preflight). **Step 6:** baseline GREEN, **operator-attested** (previous entry) — command of record **`npm test`**, no filters; Gate 4 reruns exactly this, tee'd to a log, with the verdict read from the log's `Overall:` line and an explicitly echoed exit code — never the background notification's exit code (OPEN.md #103/#105) — and with skip-scrutiny on the suites the diff touches (#104/#106).
**Next:** Stage 1, Planning — spawn `product-owner` with the acceptance frame, the goal terms verbatim, and the prompt as context-not-terms.
