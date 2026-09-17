# Book of Work: Blinding Rebuild — move gate history out of judge-read surfaces

**Slug:** blinding-rebuild
**Status:** Closed
**Opened:** 2026-08-04 — **eagerly, at intake**, before any story exists (the rows-78/99/110 lesson, practiced on a harness story).
**Closed:** 2026-08-04 — story #2 Done (review PASS `7420fde4`), template follow-up `f4a84bcc`, operator-ratified close. Close artifacts: [`audit.md`](audit.md) · [`prd-seed.md`](prd-seed.md). Confidence: **high** (same-day acceptance-frame anchor; every frame bullet checked below at close).
**Mode:** Human-gated — deliberate. This book rewrites Direction mode's own gate protocol; a Direction run whose deliverable changes its governing rules mid-flight is exactly what the goalpost-class freeze forbids. The operator holds every phase gate.

## Intent anchor

**Acceptance frame (no PRD)** — restated from the intake proposal ([`stories/_intake.md`](../../stories/_intake.md) § "2026-07-28 — Harness story proposal: Direction-mode blinding rebuild"), whose direction the operator ratified 2026-07-28:

> Gate history moves somewhere no rubric requires a judge to read; the blinding contract becomes artifact hygiene enforced by construction, not prompt discipline.

Done means the catalogued leak channels are closed structurally, not by instruction:

- [x] **Epic files stop accumulating verdicts.** Kick-back counts and prior-verdict summaries live in the run journal (already forbidden to judges); Gate 1's epic check becomes a derived existence/`Status:` assertion so no judge is handed the epic file. (#117 channel c — the structural one.)
- [x] **Story/ADR hygiene:** `Supersedes:` lines and ADR prose carry no verdict words; a template line plus a lint-shaped check pins it. (#117 channel a.)
- [x] **Commit-subject discipline:** journal commits stop naming gate outcomes in subjects; the outcome lives in the body a judge never reads. (#117 channel b.)
- [x] **Frame-only reads:** decide at Architecture whether the mechanically pinned line-range read — ratified 2026-08-04 per OPEN.md #133 (`sed -n '1,36p'` in the spawn prompt; over-read voids; now in `roles/director.md` + `.claude/agents/gate-judge.md`) — is the structural answer for this channel, or whether a generated frame excerpt / frame-only sibling file replaces it. The intake proposal predates #133's ratification; do not duplicate what it already closed. (#117, fourth instance.)
- [x] **Role scoping:** unblinded roles stop receiving run meta-state they don't need (fifth channel, add-a-concept audit §7 F3: the PO read the story cap; a review's mandated On-PASS section carried a cap remark a judge then met).
- [x] **The retro instrument sees Direction outcomes:** `scripts/harness-stats.sh` parses `audits/*/journal.md` `**Decision:**` lines into a per-book gate tally (APPROVE / KICK_BACK / HALT / ANSWER), so an 8-kick-back run stops scoring "kick-back rate 0". (#119.)
- [x] **Ledger effect:** OPEN.md #117 and #119 flip DONE; the L2 reopen waiver added for the epic reactivation (citing #129) is removed at this book's close; no new waiver outlives the book.

## Epics in this book

- `harness-gate-integrity` — existing epic ([`epics/harness-gate-integrity.md`](../../epics/harness-gate-integrity.md), currently `**Status:** Done`; story #1 closed 2026-07-25). Named here so the story path is fixed in advance: `stories/harness-gate-integrity/2-<slug>.md`, ADR `decisions/harness-gate-integrity/0002-<slug>.md`. Reactivating the epic file and numbering the story are the Product Owner's acts at Planning (tapestries reactivation precedent). Expect harness-lint **L2's reopen blind spot (#129)** to fire when the epic flips Active while the closed `harness-gate-integrity` book names it — run-scoped waiver citing #129, removed at this book's close.

## Classification (from intake)

Harness infrastructure — docs, templates, lint, scripts; no product surface. **Strictness:** Standard. **Phase path:** Planning → Architecture (the Gate-1 rubric change wants a real design pass) → Implementation → Review, with Test Design folded to the pieces that are code (`harness-stats.sh` parsing, the lint-shaped hygiene check); the story records that adaptation explicitly.

## Return edge

On close: `audit.md` (as-built) + `prd-seed.md` (no PRD upstream). Primary sources: OPEN.md #117, #119 (+#132/#133 as ratified context); `audits/store-and-show-the-prompt-and-the-estimate/audit.md` §7 P1/P2/P8 + §7a; `audits/add-a-concept-to-a-tapestry/audit.md` §7 F3; `audits/take-a-concept-back-out/journal.md` Gate-5 void + re-spawn entries (2026-07-30); `engineering-team/CHANGELOG.md` 2026-07-28 + 2026-08-04 rows.
