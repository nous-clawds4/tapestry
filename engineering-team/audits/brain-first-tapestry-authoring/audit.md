# Build Audit: Brain-First Tapestry Authoring

**Book:** `engineering-team/audits/brain-first-tapestry-authoring/book.md`
**Date:** 2026-08-05
**Branch / commit range:** `b54b2b44..1b0cb47d` (feature branch `feat/brain-first-tapestry-authoring`, merged to staging as PR [#489](https://github.com/nous-clawds4/tapestry/pull/489); phase ladder `3d58dc28` ledger → `801abd4d` story → `73e608b1` ADR → `32fdc82f` failing tests → `03032d1d` impl → `4af0c52f` review)
**Provenance:** Acceptance-frame (eagerly anchored at intake, 2026-08-04)
**Confidence:** high

> The Build Audit is the **as-built record** — what the product *is* now, factual and source-linked. It does not propose changes — that's the seed's job.

## 1. What shipped

- **Tapestry authoring is brain-first (BIBLE §30 honored in code).** Creating a tapestry — and editing one via add-a-concept / take-a-concept-out — now writes Neo4j in the same request that publishes the strfry letter. The split-brain this book was opened to end (View Tapestries listing tapestries the concept's Elements view said didn't exist) is ended for all authoring from this point forward. — `stories/done/tapestries/7-brain-first-tapestry-authoring.md`
- **One seam covers all six authoring paths.** A scoped post-import hook in the shared publish endpoint (the single point create/add/remove × TA-signed/own-key all pass through) performs: event import (node + tag nodes), `ListItem` label + slug, `HAS_ELEMENT` placement under the tapestry Superset, `tapestryKey` stamp (assigned once, §29), and LMDB derivation with pre-derive cache invalidation. — ADR `decisions/done/tapestries/0007-brain-first-authoring-publish-hook.md`
- **The letter now carries `word`.** Newly created tapestry JSON is `{word, tapestry, graph}` (word mirrors the deriver's defaults); republish builders pass it through verbatim and never retrofit legacy word-less letters. — same story, owner-ratified scope in OPEN.md #136
- **The permissionless contract is intact.** Third-party client-signed tapestry letters still publish exactly as before and are **not** brain-imported (author allow-list: TA + owner, runtime-resolved) — general ingest with provenance is explicitly stage 2.

## 2. Epics & stories rolled up

### Epic: `tapestries` (reactivated 2026-08-04 for this book; re-retired Done at this close)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #7 brain-first-tapestry-authoring | Publish-hook dual write + word section + tapestryKey/derive | Done | `reviews/done/tapestries/7-brain-first-tapestry-authoring.md` (PASS) |

## 3. As-built inventory

Derived from the diff (`git show 03032d1d`, plus the test commit `32fdc82f`):

- **Server:** new `src/api/strfry/tapestryBrainWrite.js` — exports `maybeBrainWriteTapestry(signedEvent)` (the hook) and `isOwnedTapestryEvent(event, {taPubkey, ownerPubkey})` (the pure, dependency-injectable guard). `src/api/strfry/commands/publishEvent.js` — `strfry import` promisified; the hook awaited **before** the response (the flow-completion bar); response gains an additive `brainWrite: {success, uuid, tapestryKey, derived}` (or `{success:false, uuid, error}`) only when the hook ran.
- **Client:** `ui/src/pages/tapestries/tapestryDraft.mjs` — `buildTapestryDraft` composes and returns `word {slug, name, wordTypes:['word']}`; json tag is `{word, tapestry, graph}`. Add/remove builders untouched (verified passthrough).
- **Domain:** elements of `39998:<TA>:tapestry` (TA runtime-resolved). No concept-definition changes; **no firmware reinstall** (the concept schema already tolerated `word` — verified live against the graph, review + suite I4). Brain shape per element: `:NostrEvent:ListItem` node, `HAS_TAG` tag nodes (including the `z` row the ConceptElements implicit query matches), `HAS_ELEMENT` from the tapestry Superset, `tapestryKey` property, derived LMDB doc `{word, tapestry, graph, graphContext}`.
- **Tests:** `test/brain-first-tapestry-authoring.test.js` (19 tests: U/G/S/I/R classes), registered additively in `test/test.js` (require + run + summary + `overallOk` term + skip roll-up).
- **Deploy state at close:** staging (PR #489, merge `1b0cb47d`, deploy run 30969587875 success in 83s, five-tier smoke clean — report in session; Tier-3 bundle proof `index-BUkOUnzg.js` carries `wordTypes` ×3). **Not on prod** — rides the operator's batch promotion (OPEN.md #131). Local dev instance verified live end-to-end (the fixture tapestry visible in both views).

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: derived LMDB doc at creation | Also invalidates the cached doc before every re-derive (`store.remove` pre-`deriveByKey`) | constraint-discovered | The word deriver's base prefers an existing LMDB doc over the node's refreshed json tag, so republishes re-derived stale content — surfaced by suite I6's first live run (story `## Deviations`; review finding 3) | None user-visible; edits now refresh the derived doc correctly | General deriver staleness → OPEN.md #139 (self-ontology story 4) |
| 2 | Test plan as approved (R2 random throwaway key) | R2 uses a stable non-secret fixture key + tie-safe `created_at` + best-effort self-cleanup by event id | intentional-change (test hygiene) | Random per-run keys minted a new directory-visible junk row every run — five accumulated during verification, swept dry-run-first (story `## Deviations`; plan correction note; review audited the delta: assertions byte-identical) | None (test-only); the shared staging directory was never touched | — |
| 3 | Frame: own-key create "reaches the same end state by flow completion" | Proven by composition (guard accepts owner + client-signed events traverse the hook + accepted events complete + the await sentinel), not end-to-end | interpretation | A true e2e own-key test requires the owner's private key, which nothing possesses by design (test plan § Known coverage limitation, declared **before** approval) | None expected; the composition covers the seam | Reviewer flagged: weakening G2 or S1 in future breaks AC2's evidence chain |
| 4 | Frame: out-of-frame list (backfill, ingest, read-source flip, #137) | Exactly as stated — none of it built | deferred | Owner-ratified scope split (OPEN.md #136 stage 2, #137) | Pre-#7 tapestries (Farm Animals local; Cat + Organism staging) remain brain-unknown until ingest | OPEN.md #136 (stage 2), #137 |

**Undocumented work** — none. Every hunk in the book diff traces to the story, the ADR, or a logged deviation; the ledger/BIBLE edits trace to the review's findings and this close.

## 5. Quality state at close

- Test gate at close (run over the final tree, after the epic close-out and waiver removal): **`npm test` Overall: PASS** — `brain-first-tapestry-authoring suite: PASS (19 passed, 0 failed, 0 skipped)`; harness-lint clean **without** the L2 waiver (log: session scratchpad `close-npm-test.log`).
- Known open issues, accepted and tracked: `brainWrite` failures are UI-silent (OPEN.md #138); word-deriver cache-first staleness in general (OPEN.md #139); pre-#7 tapestries brain-unknown pending ingest (#136 stage 2).
- Debt from ADR 0007 Consequences: the hook's guard is the thing stage-2 ingest replaces/generalizes; brain nodes carry no provenance marking (nothing does — self-ontology story 2); publish round-trip lengthened by a few Cypher calls + one derive for tapestry letters only.

## 6. Carry-forward register

- [ ] **Stage 2 — the general strfry→Neo4j letter ingest** with provenance, the View Tapestries read-source flip, and backfill of pre-#7 tapestries (OPEN.md #136, stays OPEN; the natural next book in this line).
- [ ] **LMDB completeness doctrine** — what a node "owes" the tapestry-store; when `word` may be omitted; when the entry may be absent (OPEN.md #137 → self-ontology epic, §29/§30 docs-mode).
- [ ] Surface `brainWrite` failures in the authoring UI, or fold into stage 2 (OPEN.md #138).
- [ ] Deriver cache-first staleness audit (OPEN.md #139 → self-ontology story 4).
- [ ] Prod promotion of this book rides the operator's staging batch (OPEN.md #131).
- [ ] Cross-doc `word` uniformity for other word-wrapper doc types — deliberately not decided here (#137's scope).

## 7. Process findings (harness)

Retro inputs: the review's "Harness friction" section (none), the story `## Deviations` (two, both product-shaped — dispositioned as audit §4 rows), this close's own friction, and `scripts/harness-stats.sh` at retro time (784 phase commits; 149 reviews decided, kick-back rate 1%; books open 3 → 2 with this close, closed 30 → 31; cycle-time median 0d — this book opened and closed inside ~26 hours, consistent with the instrument).

| Finding | Source (journal / review / deviation / meta row) | Terminal state |
|---|---|---|
| Phase commits landed directly on local `staging` (no feature branch at intake), so `/cycle-staging`'s step-1 precondition blocked the deploy until ad-hoc branch surgery; the surgery pattern (branch at HEAD → checkout → push → PR; skip the reset — post-merge `git pull` fast-forwards) worked but is folklore | close-session deploy leg | **OPEN.md `meta` row #140** (two candidate fixes for triage: branch-at-intake note in plan-feature, or the recovery pattern documented in cycle-staging) |
| Auto-mode classifier denied the compound branch-surgery command and `git reset --hard` standalone; resolved via the OPEN.md #132-ratified pattern (individual transparent calls) plus recognizing the reset was unnecessary | close-session deploy leg | **Declined** (no new lesson: #132's ratified workaround shape applied cleanly across flows; the reset-avoidance is now also captured inside row #140's text) |
| The review's three non-blocking findings (BIBLE §6 staleness; UI-silent `brainWrite`; deriver staleness) | review § Findings | **Dispositioned**: BIBLE §6 corrected in this close commit (prose + changelog row + freshness line); the other two filed as **OPEN.md #138 / #139** |
