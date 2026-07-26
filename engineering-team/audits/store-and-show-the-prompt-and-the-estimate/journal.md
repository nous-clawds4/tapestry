# Decision journal — store-and-show-the-prompt-and-the-estimate

Append-only. Every gate decision, answered question, judge verdict, and halt.
Mode: **operational Direction** (goal-derived terms). Staging is the ceiling.

---

## 2026-07-26T16:50:48Z — Eligibility resolved before any book file existed

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** `GET /api/brain/direction/store-and-show-the-prompt-and-the-estimate`, run from inside the container (host-side brain reads answer 403), returned `eligible: true` — anchor `store-and-show-the-prompt-and-the-estimate` at **distance 0** (the goal is its own anchor, as owner policy v1 `maxAnchorDistance: 0` requires), ratified by proposal `proposed-store-and-show-the-prompt-and-the-estimate-08e8c4c8` approved `2026-07-26`. `boundaryReview.required: false` with zero steps, so **no boundary judging is owed** — the two-call verdict flow does not apply at distance 0.
**Next:** Generate the book's derived section from this response; never hand-author it.

## 2026-07-26T16:55:00Z — Book opened eagerly; derived section generated, not typed

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** `book.md` was opened **before any story exists**, so the anchor gates the work while it happens — the precise failure OPEN.md #110 filed against the previous book, which was opened only after its work reached production. The `## Direction mode (operational) — goal-derived` section is **generated** per `roles/director.md` line 40: a generator reads the live endpoint JSON and emits the section; the section was then diffed back out of the assembled file and is **byte-identical** to the generator's output, so no character of it was typed. It states the `surrendered` block verbatim — **baseline commit** and **pinned governing versions**, each carrying the endpoint's own reason — rather than dropping them quietly, and carries the `unavailable` block. The sole transform is redacting the TA pubkey inside the goal uuid to `<TA>` (house rule: never write a per-deployment TA pubkey into a shared file; precedent `audits/operational-direction/book.md:13`).
**Next:** Complete the remaining preflight steps.

## 2026-07-26T17:01:30Z — HALT: concurrent session detected on the same branch

**Story/Phase:** — / Stage 0 preflight (step 3–4)
**Decision:** HALT
**Judge:** n/a
**Why:** Stopping rule 6 (external interference). A second session was **actively mid-`/close-book`** on the unrelated `operational-direction` book: it rewrote `audit.md` (12:59:29 EDT), `book.md` (12:59:42, flipping `Status: Open → Closed`) and `epics/operational-direction.md` (13:00:31) — all *after* this session committed a snapshot of those same files at ~12:58, and with no git hook behind it. Directing a run on a branch another session is writing is exactly the entanglement step 4 forbids, so I stopped rather than working around it. I deliberately did **not** `git reset` my commit: another mutation on a branch a live session was mid-write on would compound the collision, not undo it. Nothing was lost — that session's newer content stayed in the working tree.
**Next:** Surface to the operator; resume only once the other session is verifiably finished.

## 2026-07-26T17:28:00Z — Interference cleared; verified, not assumed

**Story/Phase:** — / Stage 0 preflight (step 3–4)
**Decision:** INFO
**Judge:** n/a
**Why:** The operator reported the other session finished; I verified rather than taking it. Evidence: no repo write since 13:00:31 EDT (~28 min quiet); that session committed its own flip (`bfdef9cc`); its PR #471 merged to `staging` (deploy run `30212236080`, success) and PR #472 promoted `staging → main` (deploy run `30212340164`, success, 17:19:46Z); `book.md` reads `**Status:** Closed` and the epic `**Status:** Done` on **both** `origin/staging` and `origin/main`; working tree clean; no related open PRs. The `operational-direction` book is closed and shipped — it is a *different* book from this one and shares no files with it.
**Next:** Re-verify terms, branch, baseline.

## 2026-07-26T17:29:00Z — Terms-mismatch check: PASS (no anchor-stale)

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** Re-asked the endpoint and compared the goal's **live** `deliverable` and `boundary` against the verbatim blocks recorded in the book's derived section: both match exactly, and `eligible` is still `true` at distance 0 under the same proposal. The goal has not been edited since derivation, so there is no `anchor-stale` condition. Per the role file this check re-runs at every preflight **and before every gate decision** — it is the operational analogue of armed mode's pinned governing hashes.
**Next:** Baseline suite.

## 2026-07-26T17:30:54Z — Kickoff: preflight status, and what this mode surrenders

**Story/Phase:** `goal-intent-fields` / Stage 0 preflight
**Decision:** INFO
**Judge:** n/a
**Why:** Preflight state, honestly recorded. **Step 2 arming baseline — not applicable, and not silently skipped:** operational mode *knowingly surrenders* the pinned baseline commit and the pinned governing versions (`roles/director.md`, the skill, `gate-judge.md`), for the reason the endpoint itself gives — reproducibility traded for operational cost, retained in armed mode. The branch point (`origin/staging` `e75d738b`) is noted for cold resume only and is **not** a pinned baseline; scoring may not treat it as one. **Contamination check passes vacuously and verifiably:** epic `goal-intent-fields` does not yet exist — no stories, ADRs, or source changes for it predate this run. **Step 3:** working tree clean, branch `feat/store-and-show-the-prompt-and-the-estimate` created off `origin/staging` `e75d738b`, no drift to rebase. **Step 4:** five `🔴 OPEN` handoffs and two other open books (`task-timeline`, `unified-tagging-ui`) scanned — **none** references `brain/goals`, `api/brain`, `parseGoalRow`, `tapestryOwnerGoal`, `chanceOfSuccess`, or `normalize/index`; no overlap, nothing to entangle. **Step 6:** baseline `npm test` running, tee'd to a log with an explicit `BASELINE_EXIT=$?` — per OPEN.md #103/#105 the background notification's exit code is **not** evidence and will not be used; the log's `Overall:` line and that echoed code are.
**Next:** Read the baseline verdict from the log; green → Planning (spawn `product-owner`), red → halt.

## 2026-07-26T18:02:30Z — HALT: Stage-0 baseline is RED

**Story/Phase:** `goal-intent-fields` / Stage 0 preflight (step 6)
**Decision:** HALT
**Judge:** n/a
**Why:** Step 6 requires a green baseline before any new work and says a red one is "not yours to fix silently." `BASELINE_EXIT=1`, `Overall: FAIL` — **four** failures across four suites. I characterized them rather than reporting a bare count, and verified both classes by isolated re-run instead of trusting the ledger:

- **Deterministic, pre-existing (2)** — `structures-the-brain-can-trust` **H4** and `break-a-goal-into-pieces` **H1**, both failing on `required must stay exactly [name, slug, description] … got ["name","slug","description","chanceOfSuccess"]`. Isolated re-run reproduces exactly (23/1 and 29/1, identical to the full run). This is **OPEN.md #102**, which assigns the fix *to this very goal by name*.
- **Non-deterministic, environmental (2)** — `relationship-primitives` **H8** and `relationship-primitives-probe` **H4**, both strfry event-count brackets (`scan count went 6013581 -> 6013582`). The tests' own message anticipates a concurrent publisher; on isolated re-run both are **fully green (23/0 and 9/0)**. Not a regression — a shared-stack race, and further evidence for OPEN.md #104/#106 on H-class non-determinism.

**The notification lied, live.** The background task reported "exit code 0" for a run that ended `Overall: FAIL`; only the explicitly echoed `BASELINE_EXIT=1` and the log's `Overall:` line were truthful. Third independent reproduction of OPEN.md #103/#105 — and the exact mechanism by which a Director could journal a green Gate 4 that was red. The mitigation held because it was applied in advance.

**Why I am not proceeding on my own judgement.** Whether the #102 schema fix falls inside this goal's frame — *"set … when capturing or updating a goal"* — is genuinely arguable in both directions, and the frame does not decide it in terms I can quote. Role file rule 3 makes that the operator's call, not mine. Fixing it directly would also be a hot patch outside the harness, which Stage 2 forbids.
**Next:** Surface to the operator with the options; resume only on their explicit instruction.
