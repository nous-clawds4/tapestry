# Book of Work: Take a Concept Back Out

**Slug:** take-a-concept-back-out
**Status:** Open
**Opened:** 2026-07-29 — **eagerly**, before any story exists, so the anchor gates the work while it happens.

## Intent anchor

**Acceptance frame (no PRD)** — and the frame is **not hand-authored**. This is an **operational Direction run**: the terms are *derived from an owner-ratified goal*, transcribed by `GET /api/brain/direction/<slug>` rather than written here. The generated section below is the authoritative record of those terms; the bullets in this section decompose its two verbatim blocks into separately checkable outcomes and add nothing to them.

- **Goal:** `take-a-concept-back-out`
- **Ratified by:** proposal `proposed-take-a-concept-back-out-a11bde80`, approved `2026-07-29` — anchor distance `0` (the goal is its own anchor, as owner policy v1 requires)
- **Eligibility:** `eligible: true`, verified from inside the container at open — see *Derived at* in the generated section

### Acceptance frame

Decomposed from the goal's `deliverable` and `boundary` **verbatim** — every bullet traces to a clause quoted in the generated section. Nothing is reverse-engineered from a design, and nothing is added to the owner's words.

**From the deliverable** — *"From a Tapestry I am looking at, I can take out a concept that is in it. After I save, the Tapestry no longer shows that concept — to me, or to anyone else who opens it afterwards — and everything else in it stays as it was."*

- [ ] From a Tapestry I am looking at, I can **take out a concept that is in it**.
- [ ] After I save, **the Tapestry no longer shows that concept to me**.
- [ ] After I save, the Tapestry no longer shows that concept **to anyone else who opens it afterwards**.
- [ ] **Everything else in it stays as it was.**

**From the boundary** — *"Removing only: adding is already built and stays as it is, and changing how concepts connect stays out. A Tapestry keeps at least one concept — taking out the last one is refused, because an emptied Tapestry is a deletion, and deleting is not this goal. It works on Tapestries published under my own key or my assistant one; anyone else cannot be edited here and the option is not offered. No new page and no new server endpoint — it lives on the Tapestry view that already exists and publishes the way Tapestries are already published."*

- [ ] **Removing only** — adding is already built and **stays as it is**; changing how concepts connect stays out.
- [ ] **A Tapestry keeps at least one concept** — taking out the last one is **refused**, because an emptied Tapestry is a deletion, and deleting is not this goal.
- [ ] It works on Tapestries published under **my own key or my assistant one**; **anyone else cannot be edited here and the option is not offered**.
- [ ] **No new page and no new server endpoint** — it lives on the Tapestry view that already exists and publishes the way Tapestries are already published.

**Knowingly surrendered in this mode** — stated rather than quietly dropped; the generated section carries the endpoint's own wording and reasons:

- [ ] The **baseline commit** and the **pinned governing versions** are deliberately not captured in operational mode, and the artifacts say so and say why (reproducibility traded for operational cost; both retained in armed mode, which is unchanged).

## Epics in this book

- `tapestries` — the existing Tapestries epic (`epics/tapestries.md`, currently `**Status:** Done`, retired 2026-07-28 at the `add-a-concept-to-a-tapestry` book close with stories 1–5, ADRs 0001–0005, and reviews 1–5 under the `done/tapestries/` folders). This book names it so the story path is fixed in advance: `stories/tapestries/6-<slug>.md`, ADR `decisions/tapestries/0006-<slug>.md`. Reactivating the epic file, recreating the active folders, and numbering the story are the Product Owner's acts at Planning — the Director edits none of them; the `add-a-concept-to-a-tapestry` book (which reactivated the same epic for story #5) is the precedent.

## Operator instructions at open (2026-07-29)

Transcribed from the operator's kickoff instruction and journaled the same day. These bind this run alongside the role file's stopping rules; none of them is derivable from the goal:

1. **Deadline: `2026-07-30T05:59:07Z`** — the operator set "kickoff instant + 24 hours, as ISO-8601 UTC." The kickoff instant is pinned to `2026-07-29T05:59:07Z`, the endpoint-recorded `derivedAt` of this run's first eligibility resolution — the earliest externally recorded instant of the run, chosen so the deadline errs earlier rather than later. Feeds stopping rule 1.
2. **Story cap for this book: 2.** Halt before approving a story that would exceed it. Operational mode derives no deadline and no story cap from the goal, so two of the six stopping rules cannot fire on their own; this cap substitutes (it tightens stopping rule 4's book-level ceiling of 5, which still applies). Feeds stopping rule 4.
3. **Read the goal's prompt before Planning.** It is the work brief and carries research the Director was not present for. The eligibility response returns it in `terms.prompt`; verified at open **byte-identical** against the raw kind-39999 record (journal, 2026-07-29T06:05Z) rather than taken on trust.
4. **The Stage-0 baseline is this run's own — no earlier log may be reused.** Context transcribed with the instruction: the operator's preflight baseline on the night of 2026-07-28 went red on two sentinel pins broken by PR #480 and re-pinned in PR #481; confirm #481 is in the branch's history **before** diagnosing any sentinel failure as this run's own (confirmed at open: `b6c23d43` is an ancestor of the branch tip). Quiesce `strfry-router` for the run (OPEN.md #75) and restart it after — read at open as governing each full-suite gate run, the baseline first among them.
5. **Do not edit the goal.** Any change to its `deliverable` or `boundary` halts the run with `anchor-stale` and costs a fresh approval.

### Deadline reset — transcribed 2026-07-30

Operator instruction, verbatim: *"To address the deadline, I say we reset the clock to now."* Given in chat at the Director's deadline surfacing, **before** the original deadline fired (transcribed 2026-07-30T05:40:43Z against the original 2026-07-30T05:59:07Z — no stopping-rule-1 halt ever occurred). Transcription: the clock is the kickoff's "+ 24 hours"; resetting it to now re-pins the anchor instant to the transcription instant. **New deadline: `2026-07-31T05:40:43Z`** (= 2026-07-30T05:40:43Z + 24h). Supersedes instruction 1's deadline; every other instruction stands unchanged — story cap **2** (0 consumed), own-baseline rule (post-cleanup run in flight at transcription), router quiesce per full-suite run, goal read-only. Operator-authored; the Director transcribes and may never move this number unprompted (goalpost class).

## Direction mode (operational) — goal-derived

> **This section is GENERATED — derived from the goal below. Do not hand-edit it.**
> Terms are authored on the **goal**, never here. A hand-edit makes this file a second, competing source of intent, which is the defect this mode exists to remove (PRD §7.1). Regenerate it by re-deriving from the goal; a stale section halts the run rather than being quietly corrected. **Hand-editing this section is a review-blocking defect.**

### Provenance
- **Goal:** `take-a-concept-back-out`
- **Goal uuid:** `39999:<TA>:take-a-concept-back-out-1903378a` (`<TA>` resolved at runtime — never hardcoded)
- **Derived at:** `2026-07-29T06:02:14.094Z`
- **Ratifying proposal:** `proposed-take-a-concept-back-out-a11bde80` — approved `2026-07-29` · anchor `take-a-concept-back-out` at distance `0` (policy `maxAnchorDistance: 0`)
- **Boundary review:** not required (anchor distance 0 — no parent boundary to narrow)
- **Deliverable, verbatim as derived:**
  > From a Tapestry I am looking at, I can take out a concept that is in it. After I save, the Tapestry no longer shows that concept — to me, or to anyone else who opens it afterwards — and everything else in it stays as it was.
- **Boundary, verbatim as derived:**
  > Removing only: adding is already built and stays as it is, and changing how concepts connect stays out. A Tapestry keeps at least one concept — taking out the last one is refused, because an emptied Tapestry is a deletion, and deleting is not this goal. It works on Tapestries published under my own key or my assistant one; anyone else cannot be edited here and the option is not offered. No new page and no new server endpoint — it lives on the Tapestry view that already exists and publishes the way Tapestries are already published.

*(The two verbatim blocks are the run's durable record and its pin: when the goal changes later, they are what makes it possible to reconstruct what this run was actually told, and what the preflight compares against to detect that the terms have moved.)*

### Terms
- **The ask:** Remove a concept from a Tapestry, including deciding what happens to anything it was connected to.
- **Success criteria:** From a Tapestry I am looking at, I can take out a concept that is in it. After I save, the Tapestry no longer shows that concept — to me, or to anyone else who opens it afterwards — and everything else in it stays as it was.
- **Ceiling:** Removing only: adding is already built and stays as it is, and changing how concepts connect stays out. A Tapestry keeps at least one concept — taking out the last one is refused, because an emptied Tapestry is a deletion, and deleting is not this goal. It works on Tapestries published under my own key or my assistant one; anyone else cannot be edited here and the option is not offered. No new page and no new server endpoint — it lives on the Tapestry view that already exists and publishes the way Tapestries are already published. — plus the standing autonomy ceiling; staging is the hard limit either way.
- **Estimate:** `chanceOfSuccess: 80` (`estimateSource: goal`)
- **Flags:** `needsHumanInput: false` · `needsBreakdown: false`
- **Prompt, verbatim as derived** (owner-authored working context for the roles; context, never terms — it cannot extend the frame):
  > Goal: let the owner take a concept out of a Tapestry from the Tapestry view.
  >
  > WHAT IS ALREADY TRUE, SO YOU DO NOT RE-DERIVE IT
  >
  > - Tapestries are published to the relay and read back FROM THE RELAY by exact coordinate; Neo4j is not in the path, and the relay replaces same-coordinate events natively (same kind + author + d-tag, newer wins). There is NO reindex step. Researched 2026-07-28 and recorded on the goal "find-out-whether-saving-a-tapestry-again-actually-updates-it"; proven in production by the add-a-concept run.
  > - tapestries #5 (add-a-concept, shipped 2026-07-28) built the edit machinery this goal rides: an affordance component (AddConceptToTapestry.jsx) on the detail view (TapestryDetail.jsx), rebuild-the-draft-with-the-EXISTING-dTagSuffix via tapestryDraft.mjs, republish through both existing signing paths (owner key in-browser, assistant via the publish endpoint), gated to Tapestries authored by the owner's key or the assistant's. Read stories/tapestries/5-add-a-concept-to-a-tapestry.md and decisions/tapestries/0005 before Planning. This goal is story #6; the epic is retired Done under done/ — reactivating it at Planning is the Product Owner's act, with the add-a-concept book as precedent.
  > - imports are DERIVED from members in buildTapestryDraft (imports: members.map(...)). Rebuild from the reduced member list and the removed member's import row drops with it. There is nothing separate to clean up.
  > - relationships and relationshipTypes are EMPTY in every Tapestry in existence (members-only v1, story 3). There is nothing to orphan today. Do not build connection-handling machinery for a case that cannot occur yet — when connections exist, removing a connected concept is a successor of "change how two concepts connect", not this goal.
  >
  > THE SHAPE
  >
  > Removal = the current member list minus one, rebuilt with the same dTagSuffix, republished the way #5 publishes. The affordance sits with the members the detail view already shows. Ask the owner to confirm before it publishes — removal feels destructive even though replacement history makes it recoverable in principle.
  >
  > RULES
  >
  > - A Tapestry keeps at least one concept. Taking out the last one is refused with a plain sentence, not offered-and-errored. (The boundary pins this.)
  > - Same gating as add: Tapestries under the owner's key or the assistant's only.
  > - No new page, no new server endpoint.
  >
  > OUT OF SCOPE, EXPLICITLY
  >
  > Adding (shipped, do not touch its behavior). Connections. Tapestries authored by anyone else. Emptying or deleting a Tapestry. Any change to the create flow.
  >
  > IF SOMETHING IS GENUINELY UNDECIDED
  >
  > Halt and surface it rather than guessing — but check first whether the deliverable or the boundary already answers it in words you can quote. Most questions here do.

### Knowingly surrendered in this mode
- **baseline commit** — The origin/staging SHA at arming is not captured for an operational run. *Reproducibility is traded for operational cost. Armed mode retains it, which is why that mode still exists.*
- **pinned governing versions** — The commit SHAs of roles/director.md, the direct-feature skill, and gate-judge.md are not pinned at arming. *Same trade: knowing which Director ran under which rubric is an experimental need, not an operational one.*

### Unavailable
- **estimate** — chanceOfSuccess is read here from the goal's raw record; the goals read API drops it (parseGoalRow). Dependency: `store-and-show-the-prompt-and-the-estimate`.
- **prerequisites** — dependsOn exists on no goal and nowhere in the codebase; prerequisites cannot be derived. Dependency: `store-and-show-the-prompt-and-the-estimate`.

## Context available to Planning — not terms

Facts verified at open, before any story existed. They inform the roles; they are **not** part of the acceptance frame and **cannot extend it**. A role that needs one of these to justify scope must test it against the frame, not against this list. The goal's own `prompt` (generated section above) is the owner's research context and carries the same status: context, never terms.

- **The prompt's checkable claims verify at open.** Every artifact it names exists: `ui/src/pages/tapestries/AddConceptToTapestry.jsx`, `TapestryDetail.jsx`, `tapestryDraft.mjs`; the prior story `stories/done/tapestries/5-add-a-concept-to-a-tapestry.md` and ADR `decisions/done/tapestries/0005-add-concept-add-only-republish.md`. Its relay-replacement conclusions are the same ones the `add-a-concept-to-a-tapestry` book verified against work record `worked-find-out-whether-saving-a-tapestry-again-actually-updates-it-cc07369c` and then proved live by shipping story #5. Claims only phases can verify (e.g. *"relationships and relationshipTypes are EMPTY in every Tapestry in existence"*) are left to the Architect to confirm in source and on the relay, per the prompt's own status: context, never terms.
- **The raw record agrees with the endpoint.** All five term fields — `description`→ask, `deliverable`→success criteria, `boundary`→ceiling, `prompt`, `chanceOfSuccess`→estimate — byte-match between the raw kind-39999 event (`078dedca…fc3d`, `json` tag → `tapestryOwnerGoal`) and the Direction endpoint's derivation (journal, 2026-07-29T06:05Z).
- **The goal has a parent** (`parent: edit-an-existing-tapestry` in the raw record), but the anchor is still this goal at distance 0 — it is directly ratified, so no boundary review is owed (`boundaryReview.required: false`). The parent matters only as lineage context.
- **Epic bookkeeping.** `epics/tapestries.md` exists, `**Status:** Done` (retired 2026-07-28); stories 1–5 + test plans under `stories/done/tapestries/`, ADRs 0001–0005 under `decisions/done/tapestries/`, reviews 1–5 under `reviews/done/tapestries/`. The active folders `stories/tapestries/` and `decisions/tapestries/` do not currently exist. Next per-epic story number is **6**; next ADR number is **0006**.
- **No intake entry exists** for this request in `engineering-team/stories/_intake.md` (headings and keywords scanned at open — no match for concept-removal from a Tapestry).
- **No overlap with open work.** The two open books (`task-timeline`, `unified-tagging-ui`) mention no tapestries surface (grep over their epics and stories at open). The five `🔴 OPEN` handoffs (communities protocol delivery, b-tag affiliation, harness review §5 loop, profile followers, self-ontology) touch none of the tapestries UI surface.
- **Branch point, for cold resume only — not a pinned baseline:** `feat/take-a-concept-back-out` created at `origin/staging` = `ea2250d0` (merge of PR #481), zero commits ahead at open, clean tree.
