# Build Audit: Second Brain (MVP — Capture, Decompose, Propose)

**Book:** `engineering-team/audits/second-brain/book.md`
**Date:** 2026-07-25
**Branch / commit range:** staging PRs #422 → #454 (stories 1–7, each merged to staging and promoted to production) + `feat/second-brain` `4b287c5a..448a38ea` (story 8 — PASSed, shipping in the PR that follows this close). Product-phase provenance: PRs #406–#408 (discovery → design), queue ratified 2026-07-21.
**Provenance:** PRD-backed
**Confidence:** high

> The as-built record of the Second Brain MVP block (`product-team/prd/second-brain.md` §8.1), decomposed as 8 stories in `product-team/stories-queue.md` (2026-07-21). All 8 stories are Done with PASS reviews; the anchor's completion condition (every §8.1 story Done + the epic closed) is met at this close.

## 1. What shipped

- **Goal capture in conversation, visible in a Goals view** (tree, cold-start onboarding, privacy indicator line) — `stories/second-brain/1-capture-a-goal-and-see-it.md`
- **A hygiene check** validating the goal structures against the graph's class discipline (the queue's "stray membership edges" premise falsified and adjudicated; the real drift — primary-property records lagging extended schemas — reconciled on both work-item concepts) — `stories/second-brain/2-structures-the-brain-can-trust.md`
- **Decomposition into session-sized pieces** (child goals; viable = deliverable + boundary; parents never proposed; validated, serialized, collision-refusing writes) — `stories/second-brain/3-break-a-goal-into-pieces.md`
- **External Resource pointers + the one-spine Goal detail** (freshness derived at read; pointer cards open native) — `stories/second-brain/4-attach-the-world.md`
- **Bounded session orientation + append-only work records** (corpus-independent orient payload; `worked`/`noted` facts on the goal spine; session-born ideas captured as proposals-shaped `note-goal-idea`) — `stories/second-brain/5-sessions-read-the-brain.md`
- **The proposal loop** (one viable goal nominated with why-now + passed-over runners-up; approve / skip-with-reason; every decision an append-only fact; open-ness derived from the absence of a decision) — `stories/second-brain/6-the-proposal-loop.md`
- **Priority signals** (pairwise "solve one today: which?" choices — dated, attributed, framing-tagged, append-only, projected onto BOTH touched goals' spines; recorded, never acted on) — `stories/second-brain/7-teach-it-what-matters.md`
- **Export + one verified restore drill** (dated identity-free artifact of all five content families; collision-refusing verbatim restore; the drill run once against an ephemeral own-identity scratch instance and journaled `matched` in the brain itself — the interim reinstall-clobber protection) — `stories/second-brain/8-the-brain-survives.md`

## 2. Epics & stories rolled up

### Epic: `second-brain`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 capture-a-goal-and-see-it | Goals view + adopted goal concept + capture contract | Done | `reviews/second-brain/1-capture-a-goal-and-see-it.md` (PASS 2026-07-23) |
| #2 structures-the-brain-can-trust | Hygiene check + primary-property reconcile | Done | `reviews/second-brain/2-structures-the-brain-can-trust.md` (PASS 2026-07-23) |
| #3 break-a-goal-into-pieces | Record-based decomposition + validated goal writes | Done | `reviews/second-brain/3-break-a-goal-into-pieces.md` (PASS 2026-07-23) |
| #4 attach-the-world | Resource pointers + one-spine Goal detail | Done | `reviews/second-brain/4-attach-the-world.md` (PASS 2026-07-23) |
| #5 sessions-read-the-brain | Bounded orient + work records + note-goal-idea | Done | `reviews/second-brain/5-sessions-read-the-brain.md` (PASS 2026-07-24) |
| #6 the-proposal-loop | make/approve/skip proposals + queue view | Done | `reviews/second-brain/6-the-proposal-loop.md` (PASS 2026-07-24) |
| #7 teach-it-what-matters | Priority signals, two-spine fan-out at read | Done | `reviews/second-brain/7-teach-it-what-matters.md` (PASS 2026-07-24) |
| #8 the-brain-survives | Export artifact + restore + journaled drill | Done | `reviews/second-brain/8-the-brain-survives.md` (PASS 2026-07-25, independent row-80(b) audit) |

## 3. As-built inventory

**User-facing (owner-gated, inside the existing control panel):**
- Three views + cold start: **Goals** (`/tapestry/goals` — tree, disclosure, standing words, pointer counts, cold-start onboarding, privacy line, and the story-8 **"Export brain."** footer affordance), **Goal detail** (`/tapestry/goals/<slug>` — intent + pointers + the merged append-only record spine), **Proposal queue** (open proposals as emphasis cards, Approve / Skip-with-reason).
- Brain read API (in-handler `isOwner ∥ localTrusted` gates): `GET /api/brain/goals`, `/api/brain/goals/:slug`, `/api/brain/orient`, `/api/brain/proposals`, `/api/brain/hygiene`, `/api/brain/export` (dated attachment download).
- Normalize producers (gate-first, validated-before-write, serialized via the process mutex, local-only publish): `create-child-goal`, `update-goal-intent`, `create-resource`, `verify-resource`, `create-work-record`, `note-goal-idea`, `make-proposal`, `approve-proposal`, `skip-proposal`, `record-priority-signal`, `restore-brain`, `record-restore-drill`.
- Operator tooling: `scripts/brain-drill.sh` (the one-time restore drill against an ephemeral scratch container; journals BOTH outcomes).

**Domain (all handles `39998:<TA>:<slug>`, TA always runtime-resolved):**
- `tapestry-owner-goal` — **adopted** (runtime-created 2026-07-18, pre-book; ADR 0001 established it is NOT firmware-seeded; story 8 added `ensureGoalConcept`, closing the bootstrap gap for fresh targets).
- Five runtime-created, never-firmware-seeded concepts, each self-provisioning on first content: `tapestry-external-resource` (story 4), `tapestry-work-record` (5), `tapestry-proposal` (6), `tapestry-priority-signal` (7), `tapestry-restore-drill` (8).
- **Zero firmware changes, zero firmware reinstalls, zero relationship-whitelist changes** across the book — every cross-record link is record-based (slug/locator fields inside json sections), resolved at read.

**Data & contracts:**
- All content is kind-39999 elements with single-wrapper json sections: `tapestryOwnerGoal`, `externalResource`, `workRecord` (types `worked`/`noted`), `proposal` (types `proposed`/`approved`/`skipped`; decisions reference proposals by slug via `proposalId`), `prioritySignal` (born final), `restoreDrill` (born final; outcomes `matched`/`did-not-match`).
- Derived-at-read state (never stored): goal standing, resource freshness, proposal open-ness, decomposition annotations.
- The export artifact: `{format: 'tapestry-brain-export', version: 1, takenOn, content: {goals, resources, workRecords, proposals, signals}}` — entries `{name, section}` with RAW stored sections verbatim; identity-free (no uuids/pubkeys/handles); canonical sort; one `contentEquivalent` definition serving idempotence and restore-reproduction.
- Pure cores (zero-require CJS) in `src/lib/brain/`: `goals`, `hygiene`, `resources`, `work-records`, `proposals`, `signals`, `export`, `restore`.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | PRD §5.1 owner actions "capture; **rename; abandon**" | Capture only; no rename/abandon surface | deferred | Deferred at the story-1 planning gate (operator, 2026-07-22); no covering queue story (epic gap (a)) | Owner cannot rename or formally abandon a goal yet; abandonment as a dated fact is unproducible | §6 item 1 |
| 2 | Design guide Goals view "filter by category"; PRD §6 Category entity | Category chip renders if a goal carries one; **no instances exist, no filter** | deferred | No queue story creates category instances (epic gap (b)) | Category machinery is dormant; one flat list in practice | §6 item 2 |
| 3 | Design guide screen inventory: three views, **no export surface** (yet style guide pins the "Export brain." button label) | Export affordance in the Goals-view footer beside the privacy line | constraint-discovered + interpretation | The guide pair was inconsistent; placement proposed by ADR 0008 d11, operator-ratified | The owner exports from the "what do I have?" view; guides need the affordance recorded | §6 item 5 |
| 4 | Style guide confirmations table (capture/skip/restore-drill only) | Three gate-ratified string sets shipped beyond the guide: ADR 0006 d16 approve confirmation; ADR 0007 d5 signal set (type words, both side templates, capture confirmation, verbatim prompt); ADR 0008 d12 export set | added-beyond-scope (copy) | Guide gaps discovered per story; strings authored to register and operator-ratified at gates (the d16 precedent) | Canonical copy exists that the guides don't yet carry | §6 item 5 (the back-fill bundle — verbatim list in addendum §3) |
| 5 | Queue story 2: "the two known live defects — **stray membership edges** … are cleaned" | Edges adjudicated **legitimate-and-retained** (direction-aware analysis falsified the premise); the real drift — primary-property records lagging extended schemas — reconciled instead | intentional-change | ADR 0002 (operator-ratified); review 2 PASS | The hygiene check guards the real invariant; the queue's defect inventory was wrong | — |
| 6 | PRD §5.6/§7.6 framing "tagged with the framing that produced it" | Framing is a **server-stamped constant** (`solve-one-today`); no caller-suppliable framing | interpretation | ADR 0007 d8: a framing parameter IS the §7.6 swap hatch, which the constitution defers to an owner-ratified mechanism (Phase 2+) | Framing history is safe by construction; replacement needs the Phase-2+ mechanism | §6 item 8 |
| 7 | PRD §5.7 "export … and has performed one verified restore drill" (mechanics unspecified) | Scratch = ephemeral same-image container with its **own assistant identity**; journal = the fifth runtime concept (both outcomes journaled); restore = collision-refuse-never-merge, verbatim re-mint under the target's identity | interpretation | ADR 0008 Q3/Q5 bundle, operator-ratified; the fresh-TA scratch makes the §5.9 portability proof real | The drill is reproducible operator tooling; drill history is instance-local (not exported) | §6 items 9–10 |
| 8 | Design guide error strings (e.g. "Couldn't load this goal's details — retry") | Register-pattern variants shipped ("Couldn't load your goals — Retry", "Couldn't load this goal — Retry") | interpretation | Review 1 AC-6 audit + review 3 finding #4: the guide lines are register patterns, not byte-canonical; flagged for this close to ratify | None if ratified; addendum asks product to confirm the pattern reading | addendum §5 Q4 |
| 9 | Style guide base guardrail "no emoji in UI copy" | "🧠" nav label + "🔒" gate line byte-mirror the app shell idiom; product-owned content is emoji-free | interpretation | Review 1 finding #2: the design guide's own grounding principle (indistinguishable from the app) wins on shell/gate surfaces | None; needs the ruling recorded so future surfaces don't re-litigate | addendum §5 Q4 |
| 10 | Wireframe §2 (no section headings) | Goal detail ships `Resources` / `Record` headings | added-beyond-scope (cosmetic) | Review 4 finding #2: plain-language, aids one-spine readability | Minor visual difference from wireframe | addendum §5 Q4 |
| 11 | ADR 0005 d7 suggestion: fold servingGoal into the noted summary | `servingGoal` accepted but not rendered (summary = the idea's statement) | interpretation | Review 5 finding #1 + OPEN.md row 91: a raw slug in owner copy would leak a machine identifier | Session-born ideas don't display their serving goal | §6 item 6 |

**Undocumented work** — none. The story-8 independent review walked the diff; every change traces to a story/ADR. (The drill script's two environmental accommodations — the read-only `src/` mount into scratch and the scratch-database memory shrink — are documented in the script and recorded as an ADR-notes gap in review 8, finding #3.)

## 5. Quality state at close

- **Test gate:** full `npm test` **`Overall: PASS`, exit 0, zero FAIL lines** — run independently by the story-8 reviewer 2026-07-25 at `35506766`; every commit since (`d21ea321`, `448a38ea`) is markdown-only (verified by diff). Story-8 suite re-run at close: **31 passed, 0 failed, 0 skipped**. 41 skips in the full gate are the pre-existing environmental family (pin/TL publish suites + event-tagging-firmware-seed), unrelated to this book.
- **The §10 MVP metric row "1 journaled export/restore drill" exists and is countable by inspection:** drill journal element `restore-drill-2026-07-25-5154b7b2`, outcome `matched`, performedBy `owner`, verified live by the independent reviewer.
- **Known open issues (linked):** OPEN.md row 91 (story-5 non-blocking pair), row 94 (fixture pre-clean pattern — story 8's suite shipped the state-free fix; the two older brain suites still await it), row 95 (local live Neo4j memory fragility — environmental, never a code defect).
- **Debt rolled up from ADR Consequences (0001–0008):** hygiene covers only the two work-item concepts — the four newer record concepts (resource/work-record/proposal/signal) plus the drill concept have no classifiers (dangling-reference tolerance compensates at read); the raw `save-element-json`/`set-json-tag` hatches remain ungated (pre-existing, security follow-up intake 2026-07-21) — export membership-filters and read-tolerance compensate; brain reads are O(N) full scans (sub-linear index deferred to Phase 4 by the PRD); no edit/retire/detach flows anywhere (append-only by design; corrections are new facts); `publishToStrfry` silent-drop remains open on the normalize surface (pre-existing intake; mitigated by read-back assertions); deployed-instance unauthenticated read-Cypher residual exposes goal content under the §7.4 convention posture (Phase-2 mechanism is the named fix); ~30 lines of concept-lookup Cypher mirrored across producers (accepted by ADRs 0003–0005); restore is not transactional (partial-scratch recovery = discard and re-drill).

## 6. Carry-forward register

- [ ] 1. **Rename + abandon** owner actions (PRD §5.1; deviation #1) — likely one small story; abandonment is the missing dated fact for the `abandoned` standing.
- [ ] 2. **Category instances + the Goals-view filter** (deviation #2) — decide at Phase-2 scoping (acceptance tiers are per-category; the two may arrive together).
- [ ] 3. **Hygiene classifiers** for the five uncovered concepts (dangling `goal`/`proposalId`/`prefers`/`over` refs, duplicate record slugs, unexportable rows — ADRs 0004–0008 debt).
- [ ] 4. **Proposals view retry-button parity** with the Goals view (review 6 finding #1).
- [ ] 5. **Guide back-fill bundle** — the ratified strings + export-affordance placement + pattern rulings (deviations #3/#4/#8/#9/#10); verbatim list in addendum §3.
- [ ] 6. **`note-goal-idea` serving-goal rendering** by human name (deviation #11; OPEN.md row 91a).
- [ ] 7. **Locator-scheme refinement** for non-web pointer kinds (nostr-event → `nostr:`/njump; file → OS scheme) (review 4 finding #3).
- [ ] 8. **Framing-replacement mechanism** (§7.6; P5 per PRD §11 Q5, sketch at P2) — the v1 constant is the deliberate placeholder.
- [ ] 9. **Restore merge semantics** (story 8 out-of-scope) — if Phase 2's goal engine ever needs restore-into-populated, it's a new product question, not a patch.
- [ ] 10. **Routine/scheduled drills + drill-history surfacing** (story 8 out-of-scope; drill records are instance-local and unexported by design).
- [ ] 11. **PRD §8.3 Phase-2 block as written** (lifecycle/acceptance, review gates, tiers, expiry, queue-age, launch answer, claim/lease, private write mode, engineering-project merge decision) — unchanged by this book; §10's P2 gate metrics now measurable.
- [ ] 12. **The §10 MVP metrics 6-week window** — the block is complete; the counters (≥20 goals, ≥5 session outputs, ≥15 decided proposals, 1 drill ✓, ≥3 retrievals, hygiene green ✓) can start accruing.

## 7. Process findings (harness)

Retro run on measurement: `scripts/harness-stats.sh` at close — **second-brain: 40 phase commits** (story/adr/test/impl/review chain intact for all 8 stories), book **open→close 3 days** (2026-07-22 → 2026-07-25), against global counts story: 147 · adr: 129 · test: 130 · impl: 135 · review: 167. Sources harvested: the eight reviews' "Harness friction" sections, the book's OPEN.md meta rows, and process-shaped deviations. Every lesson has exactly one terminal state — no fourth state.

| Finding | Source (journal / review / deviation / meta row) | Terminal state |
|---|---|---|
| The ~25-min full gate cannot run inside the foreground tool cap; the working idiom is background-as-the-call + bounded until-loop (not sleep-chains) | reviews 1 + 3 harness friction | OPEN.md rows **74/83** (pre-existing; appended during this book; the until-loop pattern is now the documented practice across stories 6–8) |
| strfry-router drifts relationship-primitives scan-count brackets under load; quiesce-then-restart is the discipline | reviews 2 + 3; stories 7–8 practice | OPEN.md row **75** (pre-existing; recurrence appended; quiesce step now standard in every full-gate run) |
| Brain H-suite fixture pre-clean derives deletions from process-local state — a crashed teardown strands nodes and cascades | story-7 impl; row filed 2026-07-24 | OPEN.md row **94** — and story 8's suite **shipped the state-free discovery pattern** (sentinel-query teardown, commit `e15988f7`), proving the row's proposed fix; the row stays open for the two older suites |
| The local live Neo4j is OOM-fragile under multi-container pressure (exit 137, ~1–2 min supervisor recovery); shaped the drill script's design | review 8 harness friction | OPEN.md row **95** (commit `448a38ea`) |
| The brain import-allowlist re-pin recurs on every new require (8th occurrence; ×7 suites by story 8) | ADRs 0004–0008 planned-amendment sets | **Declined:** the per-ADR complete-amendment-set practice held with zero misses across the whole book; centralizing the allowlist would weaken each suite's independent pin. Revisit only if a future occurrence misses a sibling. |
| Gate-ratified owner-facing strings (d16/d5/d12 pattern) accumulate a book-close back-fill obligation | ADRs 0006 d16, 0007 d5, 0008 d12 | **Recorded — worked as designed:** the bundle is promoted to addendum §3 for the product team to apply to its guides; no harness change needed (the pattern IS the mechanism for guide gaps discovered mid-book) |
| Story-8's S10 jargon scan covers 9 of the 12 banned words (story-7's scanned all 12) | review 8 non-blocking #2 | **Declined:** no consequence — the reviewer verified the full list independently both stories; recorded here so future suites copy the 12-word constant from story 7's S11 |
