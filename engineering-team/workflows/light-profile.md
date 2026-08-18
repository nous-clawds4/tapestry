# The Light profile (trial — book-scoped opt-in)

> **Status:** trial. Light is **not** a column in the normative strictness table (0-intake.md §3) and does not change the project's Standard setting. A **book opts in** at intake — the same on-ramp pattern as Direction mode — by carrying `**Strictness:** Light (trial) — workflows/light-profile.md` in its intake entry and `book.md`. Ratification into the normative table happens only after the trial reads well. A sibling installation exists in [`nosfabrica/brainstorm_server`](https://github.com/NosFabrica/brainstorm_server) (`engineering-team/workflows/light-profile.md` there; its instruments permit full-gate J3). If Light graduates, both copies move to the shared teams home; if not, delete this file.
> **Source:** the 2026-08-18 harness review ([Harness Review & the Light Profile](https://claude.ai/code/artifact/f650d6c4-80dd-494e-a23a-7a30a0848710)) — a four-analyst study of this repo's own corpus, adversarially fact-checked and red-teamed.

**The design principle:** count *human stops* and *rejection points* separately. The availability tax is paid in human stops; the defect catches live at rejection points. Light keeps a rejector at every gate position the corpus shows rejecting — the census: scope 6/14 kick-backs, interior 4/14, review 2/14 — but staffs the interior with the blinded [gate-judge](../../.claude/agents/gate-judge.md) instead of a waiting human, exactly as Direction mode already does (12 of the corpus's 14 kick-backs were judge-produced).

## Lanes (within a Light book)

| Type | Path | Human stops |
|---|---|---|
| Feature | **Gate A** (human) → J1 design → J2 test plan → J3 post-implementation → **Gate B** (human review) | 2 |
| Bug | Implementer + Reviewer | 1 (Gate B) |
| Refactor | Implementer + Reviewer | 1 (Gate B) |
| Doc / one-liner | Implementer + Reviewer, docs-mode review variant (non-numbered filename; claims-adherence table) | 1 (Gate B) |

The hotfix hatch is unchanged. Stories outside a Light book run Standard as always.

## Gate A — scope, approach, classification, and the scoped gate (human)

Before any interior work, the operator approves in one exchange: the story's scope (one subsystem, bounded); the intended approach in a sentence or two; the **classification** (Design note vs ADR, per the irreversibility triggers); and — tapestry-specific — **the story's scoped gate command**: the changed-area suites plus the relevant guard suites, named explicitly (e.g. `npm test -- test/<area>*.test.js test/strfry-write-assertion-bracket.test.js`). The full `npm test` cannot run inside a judge's tool cap (OPEN #83) and is **not** a judge gate under Light — it remains the book-close and promotion gate, run by the human or the cycle skills as today. When the honest-gates work (intake 2026-08-18) ships a standing story-scoped default gate, it replaces this per-story naming.

**Irreversibility triggers — any one requires a full ADR (Options considered included) and escalates the story to Standard phases:** a wire format or event shape; an auth/trust default; a schema or firmware change; a new dependency; a cross-repo contract; request routing or middleware ordering; response headers or content-type; any value that exists in more than one repo. Otherwise a **Design note** — 3–6 bullets in the story file: chosen approach, one rejected alternative, blast radius. Provisional here; **ratified by the Reviewer at Gate B**. Tripping a trigger mid-story escalates immediately.

## The judged interior (no human stop)

One fresh gate-judge spawn per gate, against the rubrics below. APPROVE proceeds; KICK_BACK loops the phase with the verdict's findings; a HALT, or two consecutive KICK_BACKs on one phase, pages the human. Spawn prompts carry only the gate name, this file's rubric section, and the artifact paths — never progress state, deadlines, or other gates' outcomes (the standard blinding rules apply; a Light spawn names its rubric here rather than in `roles/director.md`).

### J1 — design (after the Design note / ADR)

1. The note/ADR states an approach concrete enough to test against — named modules/endpoints, not intentions.
2. One alternative is named and the rejection reason is real, not a strawman.
3. Blast radius names every consumer the diff will touch; grep-verify at least one claimed non-consumer.
4. No irreversibility trigger is present that the classification missed.
5. For an ADR: Options considered and Consequences sections present per the template.

### J2 — test plan

1. The edge-case / regression-sentinel / not-covered section exists and contains at least one scenario **not** derivable from any acceptance criterion.
2. Error paths for every external dependency the design touches are covered or explicitly not-covered with a reason.
3. Every AC has at least one handle in the AC→handle lines (`AC-3 → U1, U2`).
4. The planned assertions would **fail against the current pre-implementation code** — spot-check one; a plan that passes before the work exists is measuring nothing.
5. For a test-deliverable story: the guard-suite carve-out (`templates/adr.md`) applies — the plan names the guard suite and bars Phase 4 from it.

### J3 — post-implementation readiness (before review)

1. The story's **scoped gate command** (named at Gate A) run in the foreground, exit code captured by brace-redirect — never piped through `tail` (OPEN #157) — and green.
2. The diff stays inside the declared blast radius; anything outside it is named and justified in the story file.
3. New/changed tests correspond to the plan's handles; no planned handle silently dropped.
4. No skipped or vacuous test masks a red result in the changed areas.

## Gate B — review (human verdict)

Full rigor, always; the floor is non-negotiable at every tier: gates re-run by the reviewer (the scoped gate at minimum; the full suite at the reviewer's discretion and always at book close), the AC verdict table (or the claims-adherence table for docs), the evidence table. The reviewer **ratifies the Gate-A classification** and probes adversarially beyond the plan — premise errors, collateral damage outside the diff, error paths — the classes this corpus shows only review catches. Narrative may be capped (~300 words) on small mechanical changes, tier assigned *after* the review is written. Docs/spec and security-adjacent stories always get full-depth prose.

## Artifacts

One story file per story — story + Design note + edge-case list + AC→handle lines — plus one review file. ADRs only when a trigger fires. The book keeps its normal anchor, close, and audit; the audit's §7 records the trial's own frictions.

## Trial protocol

- **No control book needed here:** the corpus is the control. Comparison basis: findings-per-review at Gate B (corpus median 3 — consistently empty Light reviews mean the gates lost their teeth) and escaped defects (OPEN.md rows attributed to a Light story within 30 days of its PASS). Wall-clock and artifact mass are descriptive only. Do not read `harness-stats.sh`'s headline "kick-back rate" (CR-final ÷ decided, ~1%) as the comparison line; the comparable figure is its kick-back *history* line (~17%).
- Run 2–3 Light books on ordinary backlog work. Prefer landing the honest-gates runtime story (standing story-scoped gate) early — under Standard, since it is itself test infrastructure — so J3 stops depending on per-story gate naming.
- Each Light book's close-out states, in the audit §7, whether the profile's own rules were followed or bent — bent rules are findings, not failures.
