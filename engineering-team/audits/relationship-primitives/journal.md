# Decision Journal — relationship-primitives (Direction mode)

Append-only. Format per `engineering-team/roles/director.md` → "The decision journal".

## 2026-07-21T08:36:20Z — Run kickoff: Stage-0 preflight complete
**Story/Phase:** relationship-primitives / Stage 0 (preflight)
**Decision:** INFO
**Judge:** n/a
**Why:** Book armed by operator (commit `117e5313`, Armed 2026-07-21T08:09:50Z, Deadline 2026-07-23T08:09:50Z, Baseline `27004981`, pinned SHAs verified against history: director.md @ `bdbc8cf6`, direct-feature SKILL @ `1d9f9b86`, gate-judge @ `3a2657b2`). Arming diff touches only the arming subsection (1 file, 4 insertions/4 deletions). Contamination check clean: no stories, ADRs, epic file, or source for this epic exist at the baseline SHA. Working tree clean; `feat/relationship-primitives` created at `117e5313`. Overlap scan: four other 🔴 OPEN handoffs (communities-protocol delivery, b-tag ratification, harness-review meta items, profile-followers) — none touch `/api/normalize`, `src/middleware/auth.js`, or this book's lane; open books task-timeline (parked) and unified-tagging-ui do not overlap. Pre-arming refresh of the pre-registration was operator-ratified and merged before arming (PR #405).
**Baseline test record:** command `npm test` (no filters), exit code 0, summary line `Overall: PASS`. 38 suites; 37 PASS; **harness-lint suite internally FAIL (28 passed, 1 failed)** — the single failure is the pre-existing `L9 BIBLE.md` last-updated staleness violation, present in the SessionStart digest before arming and at the baseline SHA; unrelated to this book's subsystem and outside the Director's lane to fix. Total skipped: 41. Gate 4 will re-run the identical command and be held to: Overall PASS, and the harness-lint violation set unchanged (exactly the pre-existing L9 entry, nothing new). Decision to proceed (not halt) journaled on these grounds and surfaced to the operator in-session.
**Next:** Spawn `product-owner` for Planning (story #1) against the intake entry (2026-07-18, `_intake.md` ~L1659) + the acceptance frame.

## 2026-07-21T08:45:03Z — Gate 1 verdict VOID: judge self-reported blinding breach
**Story/Phase:** relationship-primitives #1 / Gate 1 (Story)
**Decision:** INFO (verdict void; protocol breach journaled)
**Judge:** APPROVE — void. The judge's spawn prompt correctly scoped book.md to the "### Acceptance frame" section only, but the judge disclosed it over-read into "## Direction mode — pre-registered", exposing the arming timestamp, deadline, hypothesis odds, and ceiling. Per the pinned protocol (director.md → "The blinded gate-judge protocol": "An APPROVE from a judge who reports broken blinding is void"), the APPROVE does not stand. Not a KICK_BACK — no kick-back counter increments. The judge's item findings (all rubric items pass) are disregarded for the gate decision; a fresh judge decides cold.
**Why:** The breach was judge-side over-read, not a prompt leak, but the protocol's void clause keys on the report of broken blinding, not on fault. Re-spawn prompt corrected with a mechanical read boundary (bounded extraction of the frame section; instruction that reading any other book.md section invalidates the verdict). This is a live instance of the open harness lesson on mechanical blinding boundaries for judge spawns (OPEN.md meta rows on judge-blinding rigor) — noted for the post-mortem retro.
**Next:** Re-spawn fresh `gate-judge` for Gate 1 with the bounded-read prompt.
