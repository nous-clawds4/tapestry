# Decision journal — take-a-concept-back-out

Append-only. Every gate decision, answered question, judge verdict, and halt.
Mode: **operational Direction** (goal-derived terms). Staging is the ceiling.

---

## 2026-07-29T05:59:07Z — Eligibility resolved before any book file existed

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** `GET /api/brain/direction/take-a-concept-back-out`, run from inside the container (host-side brain reads answer 403), returned `eligible: true` — anchor `take-a-concept-back-out` at **distance 0** (the goal is its own anchor, as owner policy v1 `maxAnchorDistance: 0` requires), ratified by proposal `proposed-take-a-concept-back-out-a11bde80` approved `2026-07-29`. `boundaryReview.required: false` with zero steps, so **no boundary judging is owed** — the two-call verdict flow does not apply at distance 0. The response carries `terms.prompt` in full (the `store-and-show-the-prompt-and-the-estimate` book shipped that field), so the operator's read-the-prompt instruction is servable from the endpoint, with the raw record as the check.
**Next:** Read the goal's prompt; verify the endpoint copy against the raw record per the operator's instruction.

## 2026-07-29T06:05:00Z — Goal prompt read; endpoint copy verified byte-identical against the raw record

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** The prompt was read in full from `terms.prompt` before any planning act. Verification against the raw record took three probes because the storage shape has moved since the 2026-07-28 run read it out of a Neo4j property: today **no Neo4j node carries `prompt` at all** — the graph holds only an identity projection (`NostrEvent:ListItem` with id/kind/pubkey/slug/uuid/name/created_at). The raw record is the kind-39999 event itself (`078dedca5761767cfa5cfda93389fcffb2f4610bdb942f3be30f360cd079fc3d`, fetched via in-container `strfry scan` by id): its `json` tag holds `tapestryOwnerGoal`, and **all five term fields byte-match the endpoint's derivation** — `description`→`ask`, `deliverable`→`successCriteria`, `boundary`→`ceiling`, `prompt`→`prompt` (2,770 chars, `promptVersion: 1`), `chanceOfSuccess`→`estimate` (80). Flags match too (`needsHumanInput/needsBreakdown: false`). One lineage fact surfaced only in the raw record: `parent: edit-an-existing-tapestry` — consistent with eligibility, since the anchor is this goal itself at distance 0 and no boundary review is owed. The prompt's checkable artifact claims verify on disk (`AddConceptToTapestry.jsx`, `TapestryDetail.jsx`, `tapestryDraft.mjs`; story #5 + ADR 0005 under `done/tapestries/`).
**Next:** Open the book eagerly; generate the derived section, never hand-author it.

## 2026-07-29T06:08:30Z — Book opened eagerly; derived section generated, not typed

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** `book.md` was opened **before any story exists**, so the anchor gates the work while it happens. The `## Direction mode (operational) — goal-derived` section is **generated** per `roles/director.md`: a generator script read this session's saved endpoint fetch (`derivedAt: 2026-07-29T06:02:14.094Z`) and emitted the section; the assembled `book.md` was then checked to contain the generator's output **byte-identical** (containment assert, not eyeballing), so no character of it was typed. The sole transform is redacting the pubkey inside the goal uuid to `<TA>` — verified first via `GET /api/assistant/pubkey` that it **is** the live assistant pubkey (house rule: never write a per-deployment pubkey into a shared file; precedent `audits/add-a-concept-to-a-tapestry/book.md`). Terms were identical across both of this session's fetches (05:59:07Z and 06:02:14Z) — no drift inside the session. The section states the `surrendered` block verbatim (baseline commit, pinned governing versions — each with the endpoint's own reason) and carries the `unavailable` block and the owner's `prompt` verbatim.
**Next:** Transcribe the operator's kickoff instructions, then complete preflight.

## 2026-07-29T06:09:00Z — Operator instructions at open: deadline 24h, story cap 2, own baseline, goal read-only

**Story/Phase:** — / Stage 0 preflight
**Decision:** ANSWER
**Judge:** n/a
**Why:** The operator's kickoff message set five run-governing instructions, transcribed into `book.md` § "Operator instructions at open" and recorded here as an ANSWER because they are operator-authored terms, not Director inferences: (1) **deadline = kickoff instant + 24 hours** — pinned as `2026-07-30T05:59:07Z`, with the kickoff instant fixed to `2026-07-29T05:59:07Z`, the endpoint-recorded `derivedAt` of this run's first eligibility resolution (the earliest externally recorded instant of the run; the deadline errs earlier rather than later); feeds stopping rule 1. (2) **Story cap 2** — halt *before* approving a story that would exceed it; feeds stopping rule 4, tightening its book-level ceiling of 5. (3) **Read the goal's prompt before Planning** — done and verified against the raw record (06:05:00Z entry) rather than taken on trust. (4) **Run this run's own Stage-0 baseline; reuse no earlier log** — with the operator's context that the night's preflight baseline went red on two sentinel pins broken by PR #480 and re-pinned in PR #481; `b6c23d43` (PR #481) confirmed an ancestor of the branch tip at open, so any sentinel failure in this run's baseline is *not* pre-explained by #480 and must be diagnosed on its own. **Quiesce `strfry-router` for the run (OPEN.md #75), restart after** — read as governing each full-suite gate run (the baseline first among them): stop the router for the run, restart on completion. A whole-book quiesce would starve the local relay's sync for the run's full duration, which the instruction's "restart it after" does not support; this reading is recorded for audit. (5) **Do not edit the goal** — any change to its `deliverable` or `boundary` halts with `anchor-stale` and costs a fresh approval.
**Next:** Journal the kickoff preflight status; commit the book open; run the baseline.

## 2026-07-29T06:10:00Z — Kickoff: preflight status, confirmed rather than taken

**Story/Phase:** `tapestries` / Stage 0 preflight
**Decision:** INFO
**Judge:** n/a
**Why:** Preflight state, honestly recorded. **Step 2 arming baseline — not applicable, and not silently skipped:** operational mode *knowingly surrenders* the pinned baseline commit and pinned governing versions, for the endpoint's own stated reason (reproducibility traded for operational cost; both retained in armed mode). The branch point (`origin/staging` = `ea2250d0`, merge of PR #481) is noted for cold resume only and is **not** a pinned baseline. **Contamination check passes, and not vacuously:** the `tapestries` epic exists (`**Status:** Done`, retired 2026-07-28) with stories 1–5 belonging to *closed* books — prior art, not contamination; nothing for **this** goal predates the run (no story, ADR, or review about removing a concept from a Tapestry anywhere under `stories/`, `decisions/`, `reviews/` including `done/`; the active `stories/tapestries/` and `decisions/tapestries/` folders do not even exist; branch tip **equals** `origin/staging` at `ea2250d0`, zero commits, clean tree). **Step 3:** working tree clean; fetched; branch cut from `origin/staging` *after* the fetch, so no drift to rebase. **Step 4:** the two other open books (`task-timeline`, `unified-tagging-ui`) mention no tapestries surface; five `🔴 OPEN` handoffs scanned (communities protocol delivery, b-tag affiliation, harness review §5, profile followers, self-ontology) — none touches the tapestries UI; no entanglement. **Step 5:** on `feat/take-a-concept-back-out` at `ea2250d0`. **Step 6 pending:** the baseline runs *next*, before any Stage-1 work — this run's own, per operator instruction, `npm test` with no filters, `strfry-router` quiesced for the run and restarted after, tee'd to `baseline-2026-07-29.log` in this book's folder, verdict read from the log's `Overall:` line plus an explicitly echoed exit code — never a background notification's exit code (OPEN.md #103/#105). One orientation-doc defect noted for a `meta` ledger row at session end (CLAUDE.md standing rule): CLAUDE.md's "local-dev value `82b75e47…973833`" for the TA pubkey is stale — the live assistant pubkey is `11f23fe4…3767` (verified twice at open); the runtime-lookup rule it illustrates is unaffected.
**Next:** Commit the book open; quiesce `strfry-router`; run the Stage-0 baseline in the background; journal its verdict before any Stage-1 act.
