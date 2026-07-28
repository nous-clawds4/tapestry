# Book of Work: Add a Concept to a Tapestry

**Slug:** add-a-concept-to-a-tapestry
**Status:** Closed
**Opened:** 2026-07-28 — **eagerly**, before any story exists, so the anchor gates the work while it happens.
**Closed:** 2026-07-28 — ratified by the operator (`/close-book` invoked in response to the completion offer; journal `2026-07-28T08:55:00Z`); closed by the Reviewer at book scope.

## Intent anchor

**Acceptance frame (no PRD)** — and the frame is **not hand-authored**. This is an **operational Direction run**: the terms are *derived from an owner-ratified goal*, transcribed by `GET /api/brain/direction/<slug>` rather than written here. The generated section below is the authoritative record of those terms; the bullets in this section decompose its two verbatim blocks into separately checkable outcomes and add nothing to them.

- **Goal:** `add-a-concept-to-a-tapestry`
- **Ratified by:** proposal `proposed-add-a-concept-to-a-tapestry-56a594c4`, approved `2026-07-28` — anchor distance `0` (the goal is its own anchor, as owner policy v1 requires)
- **Eligibility:** `eligible: true`, verified from inside the container at open — see *Derived at* in the generated section

### Acceptance frame

Decomposed from the goal's `deliverable` and `boundary` **verbatim** — every bullet traces to a clause quoted in the generated section. Nothing is reverse-engineered from a design, and nothing is added to the owner's words.

**From the deliverable** — *"From a Tapestry I am looking at, I can add a concept that is not already in it. After I save, the Tapestry shows the new concept — to me, and to anyone else who opens it afterwards."*

- [x] From a Tapestry I am looking at, I can **add a concept that is not already in it**.
- [x] After I save, **the Tapestry shows the new concept to me**.
- [x] After I save, the Tapestry shows the new concept **to anyone else who opens it afterwards**.

**From the boundary** — *"Adding only: taking a concept out, and changing how concepts connect, both stay out. It works on Tapestries published under my own key or my assistant one; a Tapestry published by someone else cannot be edited here and the option is not offered for it. No new page and no new server endpoint — this is an affordance on the Tapestry view that already exists, publishing the way Tapestries are already published."*

- [x] **Adding only** — taking a concept out, and changing how concepts connect, both stay out.
- [x] It works on Tapestries published under **my own key or my assistant one**.
- [x] A Tapestry published by **someone else cannot be edited here**, and **the option is not offered** for it.
- [x] **No new page and no new server endpoint** — an affordance on the Tapestry view that already exists, publishing the way Tapestries are already published.

**Knowingly surrendered in this mode** — stated rather than quietly dropped; the generated section carries the endpoint's own wording and reasons:

- [x] The **baseline commit** and the **pinned governing versions** are deliberately not captured in operational mode, and the artifacts say so and say why (reproducibility traded for operational cost; both retained in armed mode, which is unchanged).

## Epics in this book

- `tapestries` — the existing Tapestries epic (`epics/tapestries.md`, currently `**Status:** Done` from the closed read-only/create book; its own "Future (not yet storied)" list names *Edit a Tapestry*). This book names it so the story path is fixed in advance: `stories/tapestries/<n>-<slug>.md`. Reactivating the epic file and numbering the story are the Product Owner's acts at Planning; the Director edits neither.

## Operator instructions at open (2026-07-28)

Transcribed from the operator's kickoff instruction and journaled the same day. These bind this run alongside the role file's stopping rules; none of them is derivable from the goal:

1. **Story cap for this book: 2.** Halt before approving a story that would exceed it. Operational mode derives no deadline and no story cap from the goal, so two of the six stopping rules cannot fire on their own; this cap substitutes for them (it tightens stopping rule 4's book-level ceiling of 5, which still applies).
2. **Do not edit the goal.** Any change to its `deliverable` or `boundary` halts the run with `anchor-stale` and costs a fresh approval. This has already happened once on an earlier run.
3. **Splitting the goal is the most expensive known move** — roughly 11 hours per story, measured on the previous book. That is context, not licence: a story that genuinely spans more than one subsystem must still be split, and said so. Do not under-split to save time.

## Direction mode (operational) — goal-derived

> **This section is GENERATED — derived from the goal below. Do not hand-edit it.**
> Terms are authored on the **goal**, never here. A hand-edit makes this file a second, competing source of intent, which is the defect this mode exists to remove (PRD §7.1). Regenerate it by re-deriving from the goal; a stale section halts the run rather than being quietly corrected. **Hand-editing this section is a review-blocking defect.**

### Provenance
- **Goal:** `add-a-concept-to-a-tapestry`
- **Goal uuid:** `39999:<TA>:add-a-concept-to-a-tapestry-1903378a` (`<TA>` resolved at runtime — never hardcoded)
- **Derived at:** `2026-07-28T04:06:02.932Z`
- **Ratifying proposal:** `proposed-add-a-concept-to-a-tapestry-56a594c4` — approved `2026-07-28` · anchor `add-a-concept-to-a-tapestry` at distance `0` (policy `maxAnchorDistance: 0`)
- **Boundary review:** not required (anchor distance 0 — no parent boundary to narrow)
- **Deliverable, verbatim as derived:**
  > From a Tapestry I am looking at, I can add a concept that is not already in it. After I save, the Tapestry shows the new concept — to me, and to anyone else who opens it afterwards.
- **Boundary, verbatim as derived:**
  > Adding only: taking a concept out, and changing how concepts connect, both stay out. It works on Tapestries published under my own key or my assistant one; a Tapestry published by someone else cannot be edited here and the option is not offered for it. No new page and no new server endpoint — this is an affordance on the Tapestry view that already exists, publishing the way Tapestries are already published.

*(The two verbatim blocks are the run's durable record and its pin: when the goal changes later, they are what makes it possible to reconstruct what this run was actually told, and what the preflight compares against to detect that the terms have moved.)*

### Terms
- **The ask:** Put a concept into a Tapestry that did not have it before.
- **Success criteria:** From a Tapestry I am looking at, I can add a concept that is not already in it. After I save, the Tapestry shows the new concept — to me, and to anyone else who opens it afterwards.
- **Ceiling:** Adding only: taking a concept out, and changing how concepts connect, both stay out. It works on Tapestries published under my own key or my assistant one; a Tapestry published by someone else cannot be edited here and the option is not offered for it. No new page and no new server endpoint — this is an affordance on the Tapestry view that already exists, publishing the way Tapestries are already published. — plus the standing autonomy ceiling; staging is the hard limit either way.
- **Estimate:** `chanceOfSuccess: 75` (`estimateSource: goal`)
- **Flags:** `needsHumanInput: false` · `needsBreakdown: false`
- **Prompt, verbatim as derived** (owner-authored working context for the roles; context, never terms — it cannot extend the frame):
  > Goal: let the owner add a concept to a Tapestry from the Tapestry view.
  >
  > WHAT SOMEONE ALREADY FOUND OUT, SO YOU DO NOT HAVE TO
  >
  > This was researched on 2026-07-28 and recorded on the goal "find-out-whether-saving-a-tapestry-again-actually-updates-it". Read that goal's record if you want the evidence; the conclusion is:
  >
  > - Tapestries are published to the relay and read back FROM THE RELAY. Neo4j is not in the path. useTapestryGraph and the Tapestries index both query the relay directly by exact coordinate.
  > - Tapestry elements are kind-39999 parameterized-replaceable events. The relay replaces same-coordinate events natively: same kind + same author pubkey + same d-tag, and the newer event wins.
  > - Therefore editing a Tapestry is republishing it, and there is NO reindex step to get wrong. An earlier estimate treated this as the main risk. It is not a risk; it is a non-question.
  > - There are ~71 tapestry rows sitting in Neo4j that nothing reads. Leave them alone. Whether they matter is an open question recorded on that same goal, and it is not this goal's problem.
  >
  > WHAT ALREADY EXISTS
  >
  > - useTapestryGraph splits the uuid into { kind, pubkey, dTag } and loads the current members. So the author key and the d-tag — both halves of a replacement — are already in hand on the detail page.
  > - buildTapestryDraft already takes dTagSuffix as a parameter. Create always passes a fresh random suffix; an edit passes the existing one. The model is already replacement-capable and has simply never been called that way.
  > - Both publish paths already exist: the owner's own key signs in the browser, and the assistant path posts the unsigned event to the publish endpoint with signAs assistant.
  > - A concept picker already exists on the new-Tapestry screen.
  >
  > THE ONE BRANCH
  >
  > Which path re-signs is decided by the Tapestry's author pubkey, which you already have. If it is the owner's key, sign in the browser; if it is the assistant's, use the assistant path. This is data, not a design decision — do not treat it as one and do not halt on it.
  >
  > OUT OF SCOPE, EXPLICITLY
  >
  > Removing a concept. Changing how concepts connect. Editing a Tapestry published by someone else — that raises whose key may republish, which is an unsettled question with its own goal, and it must not be answered here. No new page. No new server endpoint.
  >
  > IF SOMETHING IS GENUINELY UNDECIDED
  >
  > Halt and surface it rather than guessing. But check first whether the deliverable or the boundary already answers it in words you can quote — most questions here do.

### Knowingly surrendered in this mode
- **baseline commit** — The origin/staging SHA at arming is not captured for an operational run. *Reproducibility is traded for operational cost. Armed mode retains it, which is why that mode still exists.*
- **pinned governing versions** — The commit SHAs of roles/director.md, the direct-feature skill, and gate-judge.md are not pinned at arming. *Same trade: knowing which Director ran under which rubric is an experimental need, not an operational one.*

### Unavailable
- **estimate** — chanceOfSuccess is read here from the goal's raw record; the goals read API drops it (parseGoalRow). Dependency: `store-and-show-the-prompt-and-the-estimate`.
- **prerequisites** — dependsOn exists on no goal and nowhere in the codebase; prerequisites cannot be derived. Dependency: `store-and-show-the-prompt-and-the-estimate`.

## Context available to Planning — not terms

Facts verified at open, before any story existed. They inform the roles; they are **not** part of the acceptance frame and **cannot extend it**. A role that needs one of these to justify scope must test it against the frame, not against this list. The goal's own `prompt` (generated section above) is the owner's research context and carries the same status: context, never terms.

- **The prompt's conclusions are corroborated by the evidence goal it cites.** Work record `worked-find-out-whether-saving-a-tapestry-again-actually-updates-it-cc07369c` (2026-07-28) answers "yes, cleanly": tapestries are published to the relay and read back from the relay by exact coordinate, the graph is not in the read path, and the relay replaces same-coordinate events natively — there is no reindex step to get wrong. Its one open question (the ~71 unread tapestry rows in Neo4j) is recorded on that goal and is explicitly not this book's problem.
- **Epic bookkeeping.** `epics/tapestries.md` exists, `**Status:** Done`; `stories/tapestries/` holds story files 3 and 4 (files for the epic's listed stories 1–2 are absent on disk); `decisions/tapestries/` holds ADRs 0003 and 0004. Next per-epic story number is 5; next ADR number is 0005.
- **No intake entry exists** for this request in `engineering-team/stories/_intake.md` (headings scanned at open; the latest entry is dated 2026-07-21).
- **No overlap with open work.** The two open books (`task-timeline`, `unified-tagging-ui`) and the `🔴 OPEN` handoffs (communities protocol delivery, harness review, b-tag affiliation) touch none of the tapestries UI surface.

## Close artifacts

- **Build audit:** `engineering-team/audits/add-a-concept-to-a-tapestry/audit.md` — written 2026-07-28 by the Reviewer at book scope, **not** by the Director that ran this book. Every mechanically checkable claim in the run record was re-verified there rather than harvested; §4 and §7 record where the record and reality disagree (notably: several committed journal timestamps post-date their own commits, and the run's strfry-CLI `#z` probe caveat did not reproduce at close).
- **Product feedback:** `engineering-team/audits/add-a-concept-to-a-tapestry/prd-seed.md` — no PRD backs this book, so the feedback artifact is a reconstructed baseline in PRD shape, every section tagged `[FROM FRAME]` / `[INFERRED]` / `[UNKNOWN]`.
- **Retro dispositions:** audit §7 — every process lesson carries exactly one terminal state (operator-ratified harness commit · OPEN.md `meta` row · declined-with-reason). The rows this close inserts into `OPEN.md` include the five rows + two appends the `store-and-show-the-prompt-and-the-estimate` close drafted but never landed (repaired here, renumbered).
- **Epic close-out performed at this close:** `epics/tapestries.md` → `**Status:** Done`; stories/ADRs/reviews for #3–#5 moved under the existing `done/tapestries/` folders (per-file `git mv` — the "one mv on the directory" form was unavailable because the first tapestries close already created the `done/` folders). `harness-lint` L2 is green at close — the previous book's deliberate L2-red close is not repeated.
- **Story #5 shipped to:** `staging` as merge `ac09d591` (PR #476, deploy run 30340623300, success, 1m32s). **Not promoted to `main`** — production untouched (verified at close: `ac09d591` is not an ancestor of `origin/main`).
- **Branch-local at close:** the completion report (`f10b53f5`) and this close commit are **not on `staging`** — the audit trail lands there via a docs-only PR (OPEN.md row filed, mirroring the live-feed/open-ranking/verified-muters/test-hermeticity-ci pattern).
- **Demonstration state, honestly:** the live end-to-end add was performed on **local only** (the `cat` concept into the real `b0b48b00` tapestry, assistant path, relay-native replacement verified). Staging smoke was **read-only by rule**; the staging live add and the owner NIP-07 click-through remain one-click operator acts, not automated anywhere.
