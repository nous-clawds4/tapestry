# Story 1: Capture a goal and see it

**Status:** Approved
**Created:** 2026-07-22
**Type:** Feature

**Epic:** `second-brain` (#1) — `engineering-team/epics/second-brain.md`
**Book:** `engineering-team/audits/second-brain/book.md` (PRD-backed)
**Source:** `product-team/stories-queue.md` → Second Brain block, Story 1 (queue order is pickup order)
**PRD:** `product-team/prd/second-brain.md` §5.1 (Goal capture), §5.8 (Screens), §6 (Data Model), §7.7–7.8 (Policy Constitution: plain language; adopt existing structures)
**Guides (binding at review):** `product-team/guides/second-brain-design-guide.md` (Goals view + goal row + capture confirmation; wireframes §1, §4), `product-team/guides/second-brain-style-guide.md` (all owner-facing copy, verbatim)

## Background

The Tapestry owner's goals live in their head; getting one out today costs more than a text file, so it doesn't happen, and every agent session starts amnesiac about what the owner is trying to achieve. This story is the end-to-end proof of the Second Brain's first loop: the owner says a goal in plain words, and it exists in the brain — named, findable, dated — visible in a Goals view. It is deliberately the smallest demoable slice of the product (queue sequence: "end-to-end proof; demoable immediately"); decomposition, pointers, proposals, and everything else build on the path this story proves.

The brain **adopts** the existing goal concept — `39998:<TA>:tapestry-owner-goal` — rather than creating a parallel one (PRD §7.8). Verified live on the local instance (2026-07-22): the concept exists and carries three real goals recorded before this product shipped ("NosFabrica success", "advance physical understanding of the world", "develop tapestry into an agentic second brain"). Those must appear in the new view. The live graph also carries the two stray class-machinery edges that Story 2 (`structures-the-brain-can-trust`) will clean — this story does not clean them, but they must never render as goals (their names are system vocabulary; see AC 3 and AC 6).

Affected: the Delegating Owner (primary persona; journey step 1 — "first capture"). The view is owner-gated, inside the existing control panel; nothing here is visitor-facing.

## User-facing description

As the Tapestry owner, I want to state a goal in plain words in conversation and then see it in a Goals view in my control panel, so that a goal leaves my head at below text-file cost and verifiably exists in my brain.

## Acceptance criteria

Queue-authored (6, verbatim in intent; phrased testable-from-outside). Owner-facing strings come **verbatim** from the style guide.

- [ ] **AC 1 — Capture.** Given the owner states a goal in plain words in conversation, when the capture completes, then a goal is recorded in the brain with its name, statement, origin, and capture date, and the confirmation presented to the owner is one plain sentence (canonical: *"Goal captured."*).
- [ ] **AC 2 — See it.** Given a captured goal, when the owner opens the Goals view, then the goal appears in the tree with the standing word `captured` and its metadata, per the design guide's goal-row pattern (standing is derived and read-only; no status control exists anywhere in the view).
- [ ] **AC 3 — Adoption, not re-derivation.** Given the goals recorded before this product shipped (the existing goal concept's elements — locally the three named in Background), when the owner opens the Goals view, then those goals appear in the same view with the same treatment as newly captured ones, and items wired to the goal concept that are not goals (the two known stray class-machinery entries) do not render as goals. The brain adopts the existing concept; no parallel goal store is created.
- [ ] **AC 4 — Cold start.** Given a brain with no goals, when the owner opens the Goals view, then the canonical cold-start empty state renders verbatim — *"Your brain is empty — that's the right place to start. Tell your assistant a goal in plain words and it will appear here."* — and the view offers exactly one action.
- [ ] **AC 5 — Privacy indicator.** Given the Goals view in any state, the privacy line renders verbatim — *"This brain stays on this machine — nothing here is published."* — as an indicator only: no toggle, no button, no control affordance attached to it.
- [ ] **AC 6 — Register.** No owner-facing string shipped by this story contains a banned jargon word (*element, kind, schema, event, pubkey, superset, concept header, persona, acceptance criteria, lease, payload, endpoint*), and every standing word shown comes from the canonical set (`captured` is the only one this story produces; `viable / achieved / abandoned` arrive with later stories).

## Concepts touched

- `39998:<TA>:tapestry-owner-goal` — tapestry owner goal (**adopted and extended** per PRD §6; the goal record carries name, statement, origin, captured-on). `<TA>` is the per-deployment assistant pubkey, resolved at runtime — never hardcoded (house rule; PRD §7.8). Local resolution 2026-07-22: `11f23fe4…` via `/api/assistant/pubkey`; note CLAUDE.md's quoted local value `82b75e47…` is stale, which is the house rule proving its own point.
- No other concept is created or modified by this story. (External Resource arrives in story 4; Priority Signal, Proposal, Work Record in stories 5–7. Category instances: none exist yet; see Out of scope.)

## Out of scope

- **Rename and abandon** (PRD §5.1 owner actions beyond capture) — not in the queue's acceptance criteria for this story; placement confirmed at the planning gate (see Open questions → resolution).
- **Decomposition** — child goals, nesting, disclosure rendering of children, viability (`viable` standing, "Done means" / "Stays inside") — story 3.
- **Goal detail page** — row click's target ships in story 4 (the one-spine page). Until then the row may open an unbuilt/minimal target — same precedent as verified-reporters story 1, acceptable within the epic sequence.
- **Pointers / pointer counts** — story 4. The goal-row's "3 pointers" text renders only when pointers exist; with none, nothing.
- **Category filter UI** — the Goals view's category filter is dead UI until category instances exist (live graph: the goal concept has zero sets today); it arrives with the story that first records categories. The category chip on a goal row renders only when a goal has one.
- **Hygiene cleanup** — the two stray class-machinery edges are story 2's target. This story must not clean or touch them (only refuse to render them as goals).
- **Session read loop, work records** (story 5); **proposals** (story 6); **signals** (story 7); **export** (story 8).
- **Any capture form in the UI** — capture happens in conversation, not in this view (design guide); the view is read-only in v1 apart from navigation.
- **Firmware installer changes** — if adopting the concept requires extending its definition, the installer's behavior is untouched (operator decision 2026-07-18; clobber protection is separate work referenced by PRD §7.9).

## Open questions

None open. Two were resolved at the planning gate (operator, 2026-07-22):

1. **Rename/abandon placement** → **deferred.** Story 1 ships capture-to-view only, per the queue's decomposition. The gap (PRD §5.1 owner actions rename/abandon have no covering queue story) is recorded in the epic's coverage-gap note; revisit before book close so the PRD-computed completion isn't surprised.
2. **Category filter** → **scoped out.** No filter UI until category instances exist; the category chip on a goal row still renders whenever a goal has one.

## Linked artifacts

- ADR: `engineering-team/decisions/second-brain/0001-goal-capture-and-goals-view.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
