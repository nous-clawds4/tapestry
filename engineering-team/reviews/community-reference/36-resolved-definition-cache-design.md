# Review: Story 36 — Resolved-definition cache (deployment-side materialization design)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-13
**Diff:** `git diff 562c59ef~1..562c59ef` (commit 562c59ef) — base is staging; story commit a462c31e and ADR commit a4aa8b11 precede it.
**Mode:** Docs-mode, design-only (Protocol-Spec workflow). Test Design skipped by design; audit is accuracy + consistency + ADR conformance.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS.** Overall: PASS. Every suite green (33 suites; e.g. reconciliation-rearchitecture 15/0, community-reference-* all pass, task-queue-bullmq 18/0). No regression from this docs-only change.
- [x] `npm run test:playwright` — N/A (no browser/UI change; docs-only).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence (acceptance criteria, audited against final file states)

- [x] **ADR exists** ratifying the deployment-side cache, citing handoff D6/H1 and building on ADR 0028. — ADR 0032 present; header cites D6/H1/O8 and names ADR 0028 as the punt it supersedes. ✔
- [x] **Semantic-transparency invariant** stated (deployment optimization, MUST NOT change resolution; on-read live resolution authoritative; miss/stale never differs from a fresh walk). — BIBLE §26 "Semantic transparency (cardinal)" bullet states exactly this, including the "drop the entire cache at any instant, no observable effect but latency" equivalence and the MAY justification. ✔
- [x] **Materialization trigger** stated (inherit-typed `b` per ADR 0029 triggers; pointer-typed does not). — BIBLE §26 "Trigger" bullet: maintained only for inherit-typed `b`; pointer-typed derives `REFERENCES`, never enters the closure, triggers nothing. ✔
- [x] **Refresh model** stated (event-driven + periodic backstop; ADRs 0018/0020 re-derive lesson). — BIBLE §26 "Refresh" bullet: event-driven on ancestor edits **plus** periodic full re-resolve backstop; cites ADRs 0018/0020 and the "id matches ⟹ cache fresh" unsoundness. ✔
- [x] **On-wire-snapshot boundary** stated as the load-bearing safety property (Neo4j-only; never republished as stated fields = override-masquerade H1; O8 deferred with the safe future path noted). — BIBLE §26 "Never on-wire" bullet states all of this incl. the stated-vs-synced field-marking future path at inherit-from.md's payload-binding item. ✔
- [x] **Existing machinery named** (pass_communityReferences, strfry-router remote-subscription, BullMQ, ADR 0010 owner-consent/on-demand-pull, ADR 0006 element/superset stream). — BIBLE §26 "Composes from existing machinery" bullet names all five. ✔
- [x] **Design lands in §26**, replacing the "caching out of scope" bullet, **honestly framed Target/not-wired** (§27/ADR 0030 precedent). — The old bullet's caching clause is replaced; its surviving content (the rejected WoT-weighted alternative) is preserved as a separate "Rejected alternative" bullet referencing ADR 0028. New subsection header: **"Caching the resolved definition (Target — design; `community-reference` ADR 0032)"** with explicit *"Not wired: no resolver and no cache exist."* ✔
- [x] **Design-only / gated** made clear in both documents. — BIBLE: "gated on the resolver and on-wire `b`-tags (in turn gated on the three-branch reconciliation)." Handoff: "P1–P4 ratified (design); implementation gated." ✔
- [x] **No source files touched.** — `git diff --name-only` returns exactly 3 files: `BIBLE.md`, `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`, `engineering-team/decisions/community-reference/0028-resolved-definition.md`. No `src/`, no `protocols/`. ✔
- [x] **`npm test` green.** — PASS (above). ✔

## ADR adherence (ADR 0032 fixed points 1–6 vs §26 expansion)

- [x] FP1 (semantic transparency, cardinal) → §26 "Semantic transparency (cardinal)" — exact, incl. the always-safe-to-drop equivalence.
- [x] FP2 (optionality MAY) → §26 "A deployment **MAY** maintain…"; the MAY is justified by FP1.
- [x] FP3 (inherit-typed trigger; pointer derives REFERENCES, never enters closure) → §26 "Trigger" — matches ADR 0029 / inherit-from.md exactly.
- [x] FP4 (event-driven + periodic re-derive backstop; ADRs 0018/0020) → §26 "Refresh" — wording faithful to the reconciliation lesson.
- [x] FP5 (never on-wire; H1) → §26 "Never on-wire (load-bearing boundary)."
- [x] FP6 (composes from existing machinery, named not built) → §26 "Composes from existing machinery."
- [x] FP7 (honest Target/not-wired) → §26 header + "Not wired" framing.
- [x] **ADR 0028 Amended-by pointer added; body otherwise untouched.** Diff shows exactly one changed line in 0028 — the `**Amended by:**` header gains "**And ADR 0032** — fills this ADR's deferred 'caching … out of scope' punt…". No body edit. ✔ (ADR 0028's historical "out of scope" punt stays in place, superseded by reference, per ADR 0032 Implementation-notes.)
- [x] **Handoff annotations correct.** §5 P4 row marked "✅ ratified (design-only) — ADR 0032 / story #36" with the invariant/trigger/refresh/boundary summary and the code-gated note; new "P1–P4 ratified (design); implementation gated" callout added; O8 annotated "Boundary stated, variant left deferred at the story-36 gate." Header left 🔴 OPEN, SUPERSEDED flip deferred — matches ADR 0032 Implementation-notes. ✔
- [x] **Nothing beyond scope.** No `protocols/` change, no code, no eviction/TTL policy beyond "implementation detail, always safe." ✔

## Consistency cross-checks

- [x] **No contradiction with ADR 0028 on-read live resolution.** §26 describes the cache as transparent/accelerator only — "On-read live resolution (above) stays authoritative." Never framed as a new source of truth. ✔
- [x] **ADR 0029 consistency (inherit-typed trigger; pointer → REFERENCES, never in closure).** Verified against `protocols/drafts/inherit-from.md` lines 43–44, 52: inherit-typed derives `INHERITS_FROM`; pointer-typed (incl. absent) derives `REFERENCES {source:'b-tag'}` and "breaks the chain," contributing nothing to the closure. §26's claim is exactly correct. ✔
- [x] **Never-snapshotted wire rule agrees with inherit-from.md.** inherit-from.md:50 — "computed on read … never snapshotted into the node." §26 quotes this verbatim and links to the file. The "never republished as stated fields" boundary is consistent with the wire rule and with the H1 override-masquerade hazard described in ADR 0032 Option B. ✔
- [x] **Reconciliation lesson attributed correctly.** §26 cites "ADRs 0018/0020 … consistency must re-derive edges, not trust bookkeeping." Verified the exact wording lives at `engineering-team/decisions/task-queue-scheduler/0020-reconciliation-rearchitecture.md:12` ("**consistency must re-derive edges, not trust bookkeeping**", confirming ADR 0018's deferred-fast-path caution). Citation accurate. ✔

## Cross-references resolve

- [x] §26 link to `protocols/drafts/inherit-from.md` — resolves (relative path `protocols/drafts/inherit-from.md` from repo root; file exists). ✔
- [x] §22 reference for `pass_communityReferences` — accurate: §22 is the Community-Reference Model (BIBLE:1438), and `pass_communityReferences` fetch→publish→materialize is documented there (BIBLE:1444). ✔
- [x] §5 reference for ADR 0006's deferred element/superset materialization stream — accurate: §5 "The Tapestry Protocol" (BIBLE:190) contains "the deferred element/superset materialization stream" at BIBLE:195. ✔
- [x] ADR 0010 (owner-consent / on-demand-pull) — exists at `engineering-team/decisions/community-reference/0010-community-class-thread-pull.md`. ✔
- [x] ADR 0006 — exists at `engineering-team/decisions/community-reference/0006-community-reference-theory.md`. ✔
- [x] ADR citations epic-qualified — ADR 0032 header carries the "cite as **community-reference ADR 0032** with the epic-scoped path" hygiene note; handoff rows use `community-reference` ADR NNNN. ✔

## Guard — no source files changed

- [x] `git diff --name-only 562c59ef~1..562c59ef` → BIBLE.md, docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md, engineering-team/decisions/community-reference/0028-resolved-definition.md. Zero `src/`, zero `protocols/`, zero test files. ✔

## Concept-graph integrity

- [x] No concept definitions changed; documents only. No firmware reinstall required (story + ADR both state this). ✔
- [x] No handles introduced or altered. ✔

## Things tests can't catch

- [x] No secrets, no debug code, no commented-out code — prose-only diff.
- [x] No scope creep — every changed line traces to an acceptance criterion or an ADR Implementation-note site.
- [x] **Honesty check (the load-bearing one for a design-only ratification):** the §26 text never asserts the cache exists or is implemented. Opening sentence is *"Not wired: no resolver and no cache exist."* Every mechanism is conditional ("A deployment MAY maintain…", "would draw on…", "named, not built"). The Target framing matches the §27/ADR 0030 precedent. ✔

## House rules check

- [x] Concept Graph API authority respected (no concepts touched; API was unreachable at planning time — noted, documents-only so no derivation from BIBLE concerns).
- [x] No new lint/typecheck/build tooling. ✔
- [x] Deployment-side behavior correctly kept in BIBLE territory, not `protocols/` (the wire rule in inherit-from.md is unchanged). ✔

## Findings

### Blocking
None.

### Non-blocking
1. **BIBLE.md:1540** — the machinery bullet attributes the `pass_communityReferences` path to "§22" and the element/superset stream to "§5"; both are correct, but a reader landing mid-section may not realize §5's reference is at line 195 (a single sentence) rather than a dedicated subsection. Optional: no change needed — the citation is accurate as written.

## Verdict
**PASS**

The diff faithfully ratifies ADR 0032's design into BIBLE §26 with honest Target/not-wired framing, adds the ADR 0028 Amended-by pointer without touching its body, and annotates the handoff exactly as the ADR's Implementation-notes prescribe. All six fixed points map cleanly to §26; every cross-reference resolves; the reconciliation-lesson and inherit-from.md consistency claims are verified against source. No source files changed; `npm test` is green. Mergeable as-is.
