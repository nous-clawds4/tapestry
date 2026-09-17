# Build Audit: Graph-curation UI — place and move nodes between sets

**Book:** `engineering-team/audits/graph-curation-ui/book.md`
**Date:** 2026-07-23
**Branch / commit range:** `f93f04e1..ff912e37` (feat/graph-curation-ui, 5 commits, merged via
PR #415; promoted to main in PR #416 `39822c9d`; merged into `feat/tags` as `30e4ff68`)
**Provenance:** Reconstructed (same-session ask, operator-gated at every phase)
**Confidence:** medium *(anchor-less closes default to low; raised because the intent holder
ratified every gate live in the same session — see book.md)*

> As-built record for the book that closed the "UI affordances" descope left by the
> `relationship-primitives` book.

## 1. What shipped

- The instance owner can **place an existing node under a set** (as member *element* or as
  *subset*), **move a placement between sets**, and **remove a placement**, from three concept
  surfaces — set detail, element detail, Organization (Sets) overview — with the
  firmware-install hazard note surfaced on every graph change —
  `stories/graph-curation-ui/1-move-nodes-between-sets-ui.md`.

## 2. Epics & stories rolled up

### Epic: `graph-curation-ui`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 move-nodes-between-sets-ui | Shared PlacementDialog + pure placement core + client, mounted owner-gated on three pages | Done | `reviews/graph-curation-ui/1-move-nodes-between-sets-ui.md` (PASS) |

## 3. As-built inventory

**User-facing** (owner/admin only; anonymous and non-owner views byte-identical to before):
- Set detail (`…/dag/:setUuid`): "＋ Add to this set…" (dialog, `intoSet` mode); remove control
  on Direct Subsets rows and on *direct* element rows (ConfirmDialog-gated); result banners.
- Element detail (`…/elements/:elemUuid`): owner-only **Placements** panel (direct parents with
  kind), per-placement "Move…" / remove, "＋ Add placement…".
- Organization (Sets) (`…/dag`): per-row "Place / move…" (dialog, `forNode` mode, subset kind
  preselected, optional move-from select).
- New shared pieces: `ui/src/components/PlacementDialog.jsx`, `ui/src/utils/placement.js`
  (pure, executed-tested core), `ui/src/api/relationships.js` (full-body client).
- No new routes, no new dependencies, no server-side changes.

**Domain:** no concept definitions changed; **no firmware reinstall**. Node identity throughout
is the Neo4j `uuid` property = the nostr coordinate `kind:pubkey:dtag`; TA pubkey never
hardcoded (resolved per instance at runtime — verified live on four instances with four
distinct TA pubkeys).

**Data & contracts:** consumes ADR `relationship-primitives/0001`'s contract verbatim
(`{fromUuid, toUuid, relType}`, parent-first direction, idempotent `result` discriminator,
hazard `note`). Read side adds two Cypher shapes (validated live by H-sentinels before any JSX
embedded them): the `EXISTS { … } AS direct` per-row flag on the set page's elements query, and
the direct-parents query `[r:HAS_ELEMENT|IS_A_SUPERSET_OF] … type(r)`.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: "make it a **subset** of a preexisting set" | Both placement kinds, chosen per action | intentional-change | Operator scope answer #1 at Planning (2026-07-22) | Owner chooses membership vs nesting each time | — |
| 2 | AC3 "page shows its direct parent set(s)" vs AC6 "non-owner views unchanged" | Placements panel renders **owner-only as a whole** | interpretation | Story `## Deviations` (Implementer, 2026-07-22): AC6 read strictly | Non-owners don't get the new read display (data itself is public via set pages) | Product to validate (seed §7) |
| 3 | ADR named source-prefilled Move + plain add | `forNode` without source also offers an optional "move from" select | added-beyond-scope (minor) | Story `## Deviations`: makes ConceptDag's single affordance honor both verbs | One affordance serves add *and* move from the overview | — |
| 4 | Ask named `/api/normalize/relationship-primitives` as the mutation endpoint | That route is a read-only probe; feature consumes `add-relationship` / `delete-relationship` | constraint-discovered | Phase-1 reconnaissance; relationship-primitives story #2 | None (naming only) | — |
| 5 | (implicit) moves should persist | Instant Neo4j edit; a firmware install can overwrite; hazard note surfaced on every change | deferred (operator choice #3) | Primitives book's governing premise; scope answer #3 | Moves are live immediately but not event-backed | Event-backed durability (§6) |

**Undocumented work:** none — the reviewer walked the book diff and every hunk traces to the
story/ADR. (The promotion PR #416 additionally carried the `relationship-primitives` book to
prod, which has its own closed audit; the post-ship docs commit `bd3ef4ac` — BIBLE §11/§13,
handoff + epic status flips — is session-recorded housekeeping outside this book's diff.)

## 5. Quality state at close

- Test gate at close (2026-07-23, full `npm test` on `staging` @ `32d55f2c` + these close
  artifacts uncommitted): **exit 1 — Overall FAIL attributable solely to the known-brittle
  `relationship-primitives` H8 strfry equality bracket** (OPEN.md row 75; scan count drifted +2
  mid-bracket from a live publisher). Immediate isolated re-run: **23/23 PASS**. Everything
  else green: this book's suite **20/20**, `harness-lint` **29 passed / 0 violations** (the
  BIBLE refresh holding), 51 counted skips, no other failures.
- Known open issues: OPEN.md **row 79** — four non-blocking dialog-hardening findings from the
  PASS review (stale-selection kind-switch, `|`-in-uuid move-from parsing, overlay dismiss not
  busy-gated, redundant inner gate).
- Accepted debt (ADR `graph-curation-ui/0001` Consequences): non-atomic two-call move
  (add-before-delete caps the failure at "in both places", surfaced to the user); client-side
  cycle guard is advisory + TOCTOU-prone; per-row `EXISTS` cost bounded by concept size
  (measure-before-optimizing).

## 6. Carry-forward register

- [ ] **Event-backed durable moves** (deviation #5; epic guardrail names it the candidate
  follow-up) — the existing event-backed path targets only a concept's top-level Superset.
- [ ] **Row 79 hardening items** on next touch of PlacementDialog/ElementDetail.
- [ ] **`HAS_SUBGOAL` whitelist extension** — inherited pointer from the relationship-primitives
  seed §7 (second-brain follow-up); the UI's kind map is the one-line landing site.
- [ ] Story out-of-scope set, still out: cross-concept placement; bulk/multi-node moves;
  drag-and-drop; migrating the event-backed "Add Node as Element" flow off superset-only.
- [ ] **Duplicate-superset data quirk** observed on prod & tags `tag` concept during smoke
  (same-named Superset nested under itself, 0 elements) — pre-existing data state; the shipped
  tool can now fix it by hand, or a cleanup task can.
- [ ] Non-owner read access to the Placements panel — product decision (seed §7).

## 7. Process findings (harness)

Retro run 2026-07-23 against `scripts/harness-stats.sh` (648 phase commits · 126 reviews ·
kick-back 1% · books 20 closed / 2 open · this story same-day story→review). Every lesson has
exactly one terminal state.

| Finding | Source | Terminal state |
|---|---|---|
| Eager book anchor skipped at intake for a bounded ask; completion detection had no anchor. Ports to both flows (Direction Stage-0 already checks it). | Review § harness friction | **OPEN.md row 78** (proposal: `/plan-feature` + 0-intake open the anchor when a new epic starts) |
| Non-blocking findings in a PASS review have no swept surface — lost unless hand-rowed (second occurrence; row 77 was the first). Related: when the main session implemented, Review should spawn the independent reviewer subagent (done here by choice, not rule). Ports to both flows. | Reviews of two books; this session's Review phase | **OPEN.md row 80** (proposal: 5-review.md sweeps PASS findings to the ledger in the review commit + names the same-session subagent rule) |
| Strfry equality-bracket flake recurred **twice** this book (relationship-primitives H8 failed in the phase-4 full run and again in the close-gate full run; passed isolated both times — drift +10 and +2 respectively). | Phase-4 + close-gate full-run logs | **OPEN.md row 75** (existing; recurrence noted here, row text unchanged — third and fourth occurrences overall strengthen the triage case) |
| Severed `overallOk` terminator navigated twice without incident (suite registration; feat/tags merge resolution) — the OPEN.md #43 comment convention worked as guardrail. | test/test.js edits | **OPEN.md row 43** (existing; no new action) |
| TA-pubkey placeholder slip: a staging smoke navigation used an invented pubkey before resolving the real one at runtime; cost ~1 min, self-corrected by the standing rule. | Staging Tier-4 log (this session) | **Declined** — CLAUDE.md's runtime-resolution rule exists and caught it; no doc change warranted |
