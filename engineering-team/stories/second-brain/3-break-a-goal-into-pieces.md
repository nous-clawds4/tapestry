# Story 3: Break a goal into pieces

**Status:** Approved
**Created:** 2026-07-23
**Type:** Feature

**Epic:** `second-brain` (#3) — `engineering-team/epics/second-brain.md`
**Book:** `engineering-team/audits/second-brain/book.md` (PRD-backed)
**Source:** `product-team/stories-queue.md` → Second Brain block, Story 3 (queue order is pickup order)
**PRD:** `product-team/prd/second-brain.md` §5.2 (decomposition), §5.8 (screens), §6 (data model: one optional parent; deliverable + boundary required for viable leaves; standing always derived, never stored), §7 binds throughout (notably §7.7 plain language, §7.8 adopt existing structures / runtime identity, §7.9 in-flight engineering referenced, never re-specified)
**Guides (binding at review):** `product-team/guides/second-brain-design-guide.md` (goal-row tree: disclosure `▸`, 20px indent per depth, inline hint line; Goal detail per wireframes §2), `second-brain-style-guide.md` (standing words canonical lowercase incl. `viable`; all owner-facing copy verbatim where canonical, register everywhere else)
**Pickup context:** `docs/SECOND_BRAIN_STORY3_HANDOFF.md`

## Background

A captured ambition is not yet something another pair of hands can carry. Decomposition turns it into session-sized pieces (owner journey 2: *"A big goal becomes a tree of session-sized pieces, each with a deliverable and a boundary, in the owner's own sharpened language"*; session journey 2 receives exactly that deliverable and boundary verbatim). This story defines **viability** — the property story 6's proposal loop will select on: a leaf goal is `viable` only when it has both a stated deliverable ("done means") and a stated boundary ("stays inside"); a goal with children is never `viable` and never proposed (PRD §5.2).

**Live baseline (planning recon, 2026-07-23, loopback):** three goals exist, all top-level, all `captured`, none with deliverable/boundary/parent; the hygiene check is green (`sound:true`, 3 + 5 elements across the two work-item concepts). TA on this instance is `11f23fe4…`, resolved at runtime per house rule — never hardcoded.

Structural commitments already ratified by prior gates, carried here so no phase rediscovers them:

- **Decomposition position is durable intent.** The child's parent reference is part of the goal's own record (PRD §6), so the structure survives regardless of how edges are materialized. The Goals tree renders from record-based data, never from an edge walk (ADR 0001, Consequences). If edge materialization is ever wanted, that is the `relationship-primitives` book's documented post-book whitelist-extension path — declared dependency, **not** exercised inside this story (queue note; PRD §7.9).
- **Standing stays derived at read time, never stored** (PRD §6 lifecycle; ADR 0001 d4 names the single extension point this story grows).
- **Scheduled decisions that fall due at this story's Architecture phase:** ADR 0002 explicitly defers Option C — folding primary-property regeneration into the schema-extension write path — to story 3's ADR (it also erases the reconcile's unlocked read-compare-write race, OPEN.md row 85b); ADR 0002's Consequences require any class-thread/taxonomy change to update the hygiene taxonomy *deliberately, not accidentally* (row 85 a/c/d are the taxonomy notes aimed at exactly this moment). Until Option C (or a paired reconcile) is honored, any schema extension turns the hygiene check red by construction — and the check now gates the live test chain.
- **Sibling-suite re-pins must be planned at Test Design, not discovered at implementation** (story 2's logged lesson): story-1 S7 asserts the words `viable`/`achieved`/`abandoned` are *absent* from the Goals view — this story renders `viable`, so that assertion must be amended in the plan; the brain module's import surface is pinned by story-1 S2 *and* story-2 S3; story-2 S6 pins the brain module strfry-/mutation-free.

Affected: the Delegating Owner (their ambitions become carryable pieces) and, downstream, the Fresh-Context Session (story 5 reads the deliverable and boundary verbatim) and the proposal loop (story 6 selects only `viable` goals). "In conversation" means what it meant in story 1: the conversational agent (or owner session) exercising the capture contract — API responses are not owner-facing; the agent utters the one-sentence confirmations.

## User-facing description

As the Tapestry owner, I want to break a goal into child goals in conversation — each child viable only once it has a deliverable and a boundary stated in my own words — so that my ambitions become session-sized pieces something else can carry, and the system knows exactly which pieces are ready to be proposed.

## Acceptance criteria

Queue-authored intent (Story 3), phrased testable-from-outside.

- [ ] **AC 1 — Children in conversation, one parent each.** Given an existing goal, when the owner adds a child goal in conversation (its own name and statement), then the child is recorded with name, statement, origin, capture date, and its parent reference, and the position is durable — it survives re-reading the brain. A goal has at most one parent. A child can itself acquire children (the structure is a tree). The owner may also place an existing *parentless* goal under a parent in conversation (adoption — gate-ratified); self-parenting, placing a goal under its own descendant (a cycle), and recording a child under a parent that does not exist are each refused loudly, with nothing written. Changing an already-set parent is out of scope.
- [ ] **AC 2 — Viable means deliverable + boundary, leaves only.** Given a leaf goal (no children) with both a deliverable ("done means") and a boundary ("stays inside") recorded, when the Goals view renders, then its standing word is `viable`. Given a leaf missing either or both, then its standing word is `captured` and the row carries the inline muted hint verbatim: *"needs a deliverable and boundary before it can be proposed"*. Standing is derived at read time from the goal's recorded facts — never stored as a flag.
- [ ] **AC 3 — A goal with children is never viable.** Given a goal with at least one child — even one that has its own deliverable and boundary — when any surface renders its standing, then it shows `captured` (or `achieved`/`abandoned` once such dated facts exist; no flow records them yet), and never `viable`. Since proposal eligibility (story 6) is defined on `viable`, a goal with children is structurally never eligible for proposals.
- [ ] **AC 4 — The tree renders with disclosure.** Given goals with children, when the Goals view renders, then children nest under their parents per the design guide: disclosure glyph `▸` toggling children without navigation, indentation per depth level, top-level goals at the root. The three pre-existing goals render at the root as `captured` leaves (carrying the AC 2 hint, since none has a deliverable yet). Cold-start empty state, privacy indicator line, loading, and error states remain as story 1 shipped them.
- [ ] **AC 5 — Deliverable and boundary, in the owner's words, labelled.** Given a goal, when the owner states — or later sharpens — its deliverable and boundary in conversation, then those words are recorded as part of the goal's durable intent, and the goal's detail surface shows them labelled **"Done means"** and **"Stays inside"** (wireframes §2), verbatim in the owner's words. The detail surface arrives minimal in this story (the goal's intent: name, statement, standing, capture metadata, parent context — the wireframe's *part of "{parent}"* — plus the two labelled fields); story 4 grows it into the one-spine page.
- [ ] **AC 6 — Copy discipline and no regression.** No owner-facing string uses a banned jargon word; rendered standing words are exactly the canonical lowercase set; any new owner-facing sentence follows the style guide's register (canonical strings verbatim where they exist). Every goal present before this story ships is present after it, unchanged in name and statement, and the hygiene check reports green after the story ships — including after its structures are extended (story 2's paired-reconcile lesson; the check gates the live test chain).

## Concepts touched

- `39998:<TA>:tapestry-owner-goal` — tapestry owner goal (extended: decomposition facts — deliverable, boundary, parent reference — join the goal's durable-intent record; its schema/primary-property machinery must end the story in agreement, per AC 6). `<TA>` resolved at runtime — never hardcoded.
- `39998:<TA>:project-for-the-engineering-team` — sibling work-item concept (untouched; stays green in the hygiene check).
- Class-thread context read-only; **the relationship whitelist and the shipped add/delete primitives are referenced, never modified** (PRD §7.9).
- No new concept. No category instances (chips stay data-driven; none exist yet).

## Out of scope

- **Edge materialization / `HAS_SUBGOAL`** — the relationship-primitives book's documented post-book whitelist-extension path (needs its cardinality-safety design ADR); the tree must work from record-based data regardless. Declared, not exercised.
- **The proposal loop itself** (story 6) — this story makes `viable` derivable and visible; nothing proposes, nominates, or decides here.
- **Pointers and the full one-spine Goal detail** (story 4) — the detail arrives minimal (intent only), no record entries, no pointer cards.
- **Rename, abandon, achieve flows** — the epic's recorded coverage gap (deferred at the story-1 gate); `achieved`/`abandoned` render only if such dated facts ever exist, and no flow here records them.
- **Category instances and the category filter** — no queue story creates categories.
- **Re-parenting and detaching** — changing or removing an *already-set* parent reference is a deliberate durable-intent edit deferred beyond this story. (Adoption — setting a parent on a still-parentless goal — is in scope per the gate ruling; see AC 1.)
- **Firmware/installer changes** (operator decision 2026-07-18), router configuration, and the pre-existing `publishToStrfry` silent-drop bug (separately tracked; read-back assertions remain the mitigation).

## Open questions

None open. Three were resolved at the planning gate (operator, 2026-07-23):

1. **Minimal Goal detail now** → ratified. This story introduces the minimal detail surface (row click navigates, per the design guide; intent fields only — name, statement, standing, capture metadata, parent context, "Done means", "Stays inside"); story 4 extends it in place into the one-spine page.
2. **Adoption ratified.** The owner may place an existing *parentless* goal under a parent in conversation; self-parenting and cycles are refused loudly (folded into AC 1). Changing an already-set parent stays out of scope.
3. **Legacy-goal hint confirmed as designed.** All three pre-existing goals carry the inline hint (childless, no deliverable) — the design guide's literal behavior, wanted as honest onboarding.

## Deviations

*(Implementer log, 2026-07-23 — small judgment calls; the ADR was not departed from.)*

- **Journaled schema extension — the d8 fold's first live use (ADR d13, operational step):** after the code deploy (`supervisorctl restart brainstorm`), one `POST /api/normalize/save-schema` call for `tapestry owner goal` with the complete schema — the existing five properties plus optional `deliverable` (*"what 'done' produces, in the owner's words"*), `boundary` (*"what pursuing this goal may not touch, in the owner's words"*), `parent` (*"the slug of the parent goal this goal is part of (one parent at most)"*); `required` and `x-tapestry.unique` unchanged. Response carried `primaryProperty: {result: 'reconciled', properties: {before: [5 keys], after: [8 keys]}}` — **no paired reconcile call was needed**; hygiene read back green (`sound:true`, 0 problems). Other deployments: extend the current schema the same way at bootstrap; the fold auto-reconciles.
- **Refusal responses carry a machine-readable `refusal` key** alongside the human `error` sentence (e.g. `{success:false, refusal:'name-collides', error:'…'}`) — additive; gives the conversational agent the discriminated contract the ADR's named refusals imply. Same pattern: the extracted `reconcilePrimaryPropertyForConcept` failures carry a `code` key (needed by the fold's `not-applicable` mapping) — additive on the endpoint's otherwise byte-equivalent responses.
- **The core's refusal kinds pass through from `validateDecompositionOp`** (`parent-not-found`, `ambiguous-slug`, `self-parent`, `cycle`, `already-has-parent` originate in `lib/brain/goals`); `name-collides`, `empty-value`, `goal-not-found` are built endpoint-side (d-tags and body validation are endpoint knowledge). The handlers' refusal-contract comments document the full set at the route.
- **`resolveDecomposition` also annotates cycle members with `cycleOf`** (the smallest member uuid — the cycle's stable identity) beyond the ADR's flag list — additive; it is how `classifyDecomposition` groups one problem per cycle deterministically.
- **`resolveGoalConcept` adopts create-element's exact lookup** (ListHeader OR ClassThreadHeader, no ConceptHeader — matching the write path the child-create rides, rather than save-schema's wider match).
- **UI hint condition is `!hasChildren && standing !== 'viable'`** — equivalent to `=== 'captured'` while only two standings exist; story 6's ADR revisits when `achieved`/`abandoned` become derivable.
- **Detail page gate/loading/error branches title the page "Goal"** (the goal's name is unavailable in those branches); the not-found line is *"Couldn't find this goal — it may have been renamed or removed."* (register-conformant, reviewer-checkable).
- **Visual verification stopped at the gate branch:** in-container `vite build` clean (the established JSX gap-filler); browser smoke of `/tapestry/goals` renders the owner gate with zero console errors (an unauthenticated browser is the remote caller class — the tree needs an owner session); tree behavior is verified end-to-end through the same endpoint the view consumes (suite H3–H6).

## Linked artifacts

- ADR: `engineering-team/decisions/second-brain/0003-record-based-decomposition-and-validated-goal-writes.md`
- Test plan: `engineering-team/stories/second-brain/3-break-a-goal-into-pieces.test-plan.md`
- Review: (filled in after Review phase)
