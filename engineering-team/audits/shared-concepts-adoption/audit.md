# Build Audit: Shared-Concepts Adoption Suite

**Book:** `engineering-team/audits/shared-concepts-adoption/book.md`
**Date:** 2026-08-07
**Branch / commit range:** `f08aeeec` (PR #495, the book plan) → `8ecdd94b` (PR #508) on `staging`; production at `f3d3ae43` (PR #510, full promotion). Close commits ride `chore/snapshot-fixture-hygiene`.
**Provenance:** Acceptance-frame (owner-confirmed in-session at book open, 2026-08-05)
**Confidence:** high — every frame bullet shipped through its own gated story cycle, every review PASS, all six features smoke-verified on staging and production.

> The Build Audit is the **as-built record** — what the product *is* now, factual and source-linked. It does not propose changes — that's the seed's job.

## 1. What shipped

- **The instance-identity doctrine (F0):** "me" = the TA pubkey, ratified as BIBLE §31; every first-person query in the suite answers `authors:[TA]`; W15 graduated — `stories/self-ontology/2-ratify-instance-identity.md`
- **b-coverage audit + guided disposition (F5):** coverage states on the concept-headers list (wired / self-declared / deliberately-private / undispositioned), a guided flow with three symmetric actions, the W16 sentinel ruling (`b-tag-deferred` as a reserved `b` value form), and the wire-external b-append primitive — `stories/shared-concepts-adoption/1-b-coverage-audit-and-disposition.md`
- **Adoption-candidates queue (F1):** the S3 ∖ S2a nomination surface with cross-author evidence counts, Adopt (wire a twin via pointer-b) / Recognize (registry element) / Decline (dated, supersedable, reversible local ledger) — `2-adoption-candidates-queue.md`
- **Inverse queue, "Mine to publish" (F2):** the owner's headers with cross-author z/b usage and no `b`, both evidence kinds counted distinguishably; decline = the F5 sentinel; kept-private-but-in-use behind a collapsed reveal — `3-inverse-queue-publish-candidates.md`
- **Publish-time default dual-z stamping, stage 1 (F4):** pins and Trusted Lists gain personal-z parity; `selectPointerTargets` resolves shared stamps from the personal header's pointer-b (the choice IS the pointer-b); the central create-element seam stamps wired concepts dual automatically — `4-publish-time-default-stamping.md`
- **Trusted dictionary (F3):** live per-POV view of concepts z-used by ≥ N distinct trusted authors (verified influence cutoff; house/personalized branches with honest fallback disclosure), plus owner-gated dated TA-signed snapshot publication (server-recomputed, sentinel-excluding, `derivation: 'z-usage'`) — `5-trusted-dictionary.md`
- **Post-frame hygiene & clarity (owner-driven fast-tracks):** self-cleaning test snapshots (`6-…`), the graph-derived twin picker — wireable concepts only, deduplicated (`7-…`), per-view explainers + Events/Authors and action-button tooltips in the owner's own wording (`8-…`), and click-through from any queue row to the raw kind-39998 event (`9-…`).

## 2. Epics & stories rolled up

### Epic: `self-ontology` (F0 lived here; doctrine, not adoption machinery)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #2 ratify-instance-identity | BIBLE §31, W15 graduated, stage-2 owner-letter ruling | Done | `reviews/self-ontology/2-ratify-instance-identity.md` |

### Epic: `shared-concepts-adoption`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 b-coverage-audit-and-disposition (F5) | Coverage states + guided disposition + W16 sentinel + b-append primitive | Done | `reviews/shared-concepts-adoption/1-…` |
| #2 adoption-candidates-queue (F1) | Nomination surface + Adopt/Recognize/Decline + dated decline ledger | Done | `…/2-…` |
| #3 inverse-queue-publish-candidates (F2) | Mine-to-publish view, distinguishable evidence, deferred reveal | Done | `…/3-…` |
| #4 publish-time-default-stamping (F4) | Pin/TL parity + resolver + create-element seam (one in-session review round: the ADR-0015 caller pin amended to key-based intent) | Done | `…/4-…` |
| #5 trusted-dictionary (F3) | Per-POV view + Neo4j qualifying-set seam + snapshot mint | Done | `…/5-…` |
| #6 self-cleaning-snapshot-fixtures | Suite teardown sweeps fixture-membered snapshots (spike-proven no graph side effect) | Done | `…/6-…` |
| #7 graph-derived-twin-picker | `GET /api/adoption-twins` = graph ∩ has-event, uuid-deduped; page's raw scan removed | Done | `…/7-…` |
| #8 adoption-queue-view-explainers | Per-view explainers (owner's wording) + column/action tooltips (doc-class follow-ups in-review) | Done | `…/8-…` |
| #9 adoption-row-raw-event-view | Row click → `header/:coord` raw-event page | Done | `…/9-…` |

## 3. As-built inventory

**User-facing.** Pages: Adoption Queue (three views + review panel + explainers/tooltips + clickable rows), Trusted Dictionary (entries + snapshots strip + POV disclosure + Publish snapshot), Header Event (raw JSON at a coordinate), coverage columns/filters + DispositionPanel on the concept-headers surfaces. Routes added: `shared-concepts/adoption-queue`, `shared-concepts/dictionary`, `shared-concepts/header/:coord`; nav entries for the first two.

**Endpoints.** Public reads: `GET /api/adoption-queue` (`nominations`/`declined`/`publishCandidates`/`deferredInUse`), `GET /api/trusted-dictionary` (`entries`/`snapshots`/`pov`), `GET /api/adoption-twins` (`twins`). Owner-gated writes (`isOwner || localTrusted`): `POST /api/normalize/adoption-disposition`, `POST /api/normalize/trusted-dictionary-snapshot`, plus the F5 concept-disposition primitives (`b-append` wire-external / `self-declare` / `b-defer`).

**Domain.** Runtime-created concepts (ensure idiom, never firmware): `adoption disposition`, `trusted dictionary snapshot`. Wire vocabulary: the W16 sentinel `["b", "b-tag-deferred"]`; pointer-b as the affiliation/stamping source (community-reference ADR 0029 semantics honored throughout — z-usage carries zero consensus weight, and the F3 snapshot self-describes `derivation: 'z-usage'`). Docs: BIBLE §31; stamping-spec cross-references; ADR-0015 caller pin amended to key-based intent. **No firmware reinstall anywhere in the book.**

**Libraries & config.** Pure zero-require cores: `src/lib/adoptionQueue.js` (`computeQueue`, `computePublishCandidates`), `src/lib/trustedDictionary.js` (`computeDictionary`); `src/lib/bValueForms.js` as the single owner of b-value semantics; `selectPointerTargets` (F4's resolver). Config knobs: `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` gains a second live consumer (default 0.01, batch-side), new `TRUSTED_DICTIONARY_MIN_USERS` (default 2). Test surface: seven new five-touch suites (`b-coverage-audit-and-disposition`, `adoption-candidates-queue`, `inverse-queue-publish-candidates`, `publish-time-default-stamping`, `trusted-dictionary`, `adoption-twins`, `adoption-raw-event-view`), with the loopback-write / host-read / `nextStamp` / Neo4j-fixture idioms.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Intake dependency sketch: F0 → F1 → … → F5 | F5 shipped first; the b-append primitive moved with it; F1 consumed it later | intentional-change | Owner priority decision 2026-08-06 (book.md; epic Notes) | None — same features, different order | — |
| 2 | F1: "adopt via pointer-b … and/or create the registry record" | Two separate actions (Adopt / Recognize) **plus** a dated, supersedable decline ledger the frame never named | intentional-change + added | Planning decisions 2026-08-06 (story 2 Open questions); the proposal-loop needs a reversible "no" | Declines persist across sessions and are reversible from a dedicated view | Declined-then-wired cosmetic (review 2 NB-1) |
| 3 | Intake F4 sketch: a registry field records the "shared header of choice" | **The choice IS the pointer-b** — wire-visible, spec-verbatim; registry-field sketch dropped | interpretation (owner-ratified) | `/discuss` 2026-08-06 (story 4 Background) | Zero new state to manage; multi-affiliation *ordering* deferred | Revisit only if ordering matters |
| 4 | F4: "the ratified floor in the authoring flows" | Fixed-surface writers only (pins, TLs, create-element seam); scattered client-built writers deferred with a confidence-tagged candidate map | deferred (staged reach, owner-scoped) | ADR 0004 (Decision + Consequences) | Items from unswept writers still single-stamp | §6: the stage-2 sweep |
| 5 | F3: "S3b with a minimum-trusted-users threshold; a dated derived artifact" | Live computed view (nothing stored) + owner-clicked snapshot mint; trusted = verified influence cutoff (batch default 0.01); N = distinct trusted authors, default 2, config knob | interpretation (owner-ratified) | `/discuss` 2026-08-07 (story 5 Background; ADR 0005) | The dictionary is an *offering the owner mints*, never an auto-published feed | §6: snapshot consumption/retention |
| 6 | — (not in frame) | The verified cutoff has a pre-existing two-default split (batch 0.01 vs live-fallback 0.05); F3 chose batch-side and documented the divergence | constraint-discovered | ADR 0005 fixed point 1 | None until the knob is set explicitly | Parked with the verified-muters cutoff item |
| 7 | — (not in frame) | Stories 6–9: fixture self-cleaning, graph-derived twin picker, explainers/tooltips, raw-event view | added-beyond-scope (owner-driven, each gated) | Owner requests 2026-08-07 (stories 6–9); review 2's NB-3 "twin picker cosmetics" presaged #6/#7 | Cleaner dev UX; picker can no longer offer dead addresses | — |
| 8 | Frame: F2 decline "removes from re-prompting" | Sentinel-deferred headers with active usage sit behind a **collapsed reveal** rather than vanishing | interpretation | Story 3 (AC-5) + owner gate | Kept-private-but-used stays visible on demand; same rule reused by F3's view/snapshot split | — |

**Undocumented work** — diff content with no story/ADR provenance:
- **PR #500** (`fix/adoption-queue-stream-scan`) — the corpus-scale streaming rewrite of the F1 endpoint's scans. Fast-tracked during the 2026-08-06 outage session with no story/test-plan/review artifacts; documented only in code comments (`src/api/adoption/index.js` header) and OPEN.md #145. Functionally load-bearing (staging was failing on maxBuffer until it landed). Low-severity finding: the fix-class fast-track lane was used for a change larger than one line.
- **PR #496** (`chore/instance-identity-capture`) — pre-book capture chore; provenance is the intake entry, acceptable.
- Doc-class follow-up commits under story 8 (tooltips, owner's wording) — sanctioned by the strictness table's doc lane, enumerated in review 8.

## 5. Quality state at close

- **Test gate at close:** `npm test` over the closed-out tree (post book-flip + epic folder moves) — **Overall PASS, exit 0, zero failing tests** across every suite (53 skips, all in unrelated suites' preconditioned rows); `harness-lint` clean, L2 book⇔epic pairing green. Run 2026-08-07 at close time; even the #150-class brackets held on this run.
- **Known open issues:** OPEN.md **#150** (whole-corpus bracket flake in `relationship-primitives`(+`-probe`), two sightings 2026-08-07, both re-run green); OPEN.md **#148** (ta-avatar #2's picture-guard RFC1918 gap — ships *beside* this book, not within it); local dev wire-archaeology (166 header addresses for 83 names in strfry + six same-handle graph pairs) — un-offered since story 7, cleanup swept to the ledger at this close.
- **Debt rolled up from ADRs:** the sign/publish/import triplication (#142, pre-existing, cited by ADR 0001); the dual-homed sentinel literal (server/UI, pinned identical by a structural test — ADR 0001); the cutoff two-default divergence (ADR 0005, parked); create-element's gate posture (pre-existing, noted by ADR 0002 for a future security sweep); ADR 0004's unmapped/possibly-display-only writer entries.
- **Owner-verifiable on prod (first use):** the first real snapshot publish and the first pin/TL dual-z check — swept to the ledger.

## 6. Carry-forward register

- [ ] **F4 stage-2: the client-built-writer sweep** — ADR 0004's confidence-tagged map (confirmed: `NewDListItem`, tapestry drafts; unmapped: `DListItemNeo4j`; possibly display-only: `NewElement`/`NewProperty`); review 4 adds `syncPinnedExportsForTag`/secondary pin flows to confirm. Out of this book's frame unless the owner extends it.
- [ ] **Snapshot lifecycle** — consuming *other* instances' dictionary snapshots, retention/diffing, and any cadence beyond click-to-mint (story 5 Out of scope).
- [ ] **Personalized-POV productization** — the dictionary's personalized branch serves only observers with computed metrics cards (W12 stance); enrollment/UX for that is unbuilt; `fellBackToHouse` disclosure exists.
- [ ] **Local wire-archaeology cleanup** — the ~83 orphaned strfry husks + six same-handle graph node pairs (OPEN.md row added at this close; owner-decide).
- [ ] **Adoption-queue polish seeds** — declined-then-wired rows still list under Declined (review 2 NB-1); recognized-by-event-id can lapse on republish (review 2 NB-2); raw-event links on other surfaces (review 9 NB-1); element-retraction primitive if snapshot/graph residue ever matters (story 6 Out of scope).
- [ ] **Cutoff consolidation** — parked with the verified-muters deferred-scope item (audit §6 there).
- [ ] **Protocol trajectories** — W1 (cross-deployment identity), W13 (cross-store POV identity, flagged not advanced by ADR 0005), ADR-0015 legacy re-parenting (standing epic-in-waiting).

## 7. Process findings (harness)

Retro instrument at close (`scripts/harness-stats.sh`, 2026-08-07): 842 phase commits · 162 reviews decided · kick-back rate 1% · churn 2 · books 4 open / 31 closed · cycle-time median same-day (141/185 stories matched). This book: 10 stories (incl. F0), 10 PASS verdicts, one in-session kick-back round (story 4), five fast-tracks.

| Finding | Source | Terminal state |
|---|---|---|
| Replaceable-tie fixture discipline (`nextStamp` on every fixture write) | Review 2 harness friction | OPEN.md row **#144** (adopted by every later suite in the book, day one) |
| `show-the-four` S5 absolute route-count pin broke on additive routes | Review self-ontology-2 harness friction | OPEN.md row **#143** (DONE 2026-08-06 via PR #501) |
| ADR-0015 caller pin regex tighter than its intent (value ban vs parameter removal) | Review 4 harness friction | Declined as a new row — rows #109/#112's assertion-form umbrella covers the genus; the dated amendment comment carries the specifics (review 4's recorded disposition) |
| Narrow-tail log windows hid failing terms twice (tail -49 vs a grown suite roster) | Review 4 NB-1 (process-shaped) | Declined — one-session capture practice, recorded here: size capture windows generously or grep the full stream; not a harness-doc rule |
| Whole-corpus scan-count brackets flake under live router ingest | Review 7 harness friction + batch-gate second sighting | OPEN.md row **#150** (both suites named; fix shape recorded) |
| Parallel-machine OPEN.md row-number collision (two independent #148s minted same day) | This close (merge resolution `4b32b53f`) | OPEN.md `meta` row **#151** (added at this close: claim-convention fix shape) |
| Stale local env (dist/ + server process) after cross-machine staging merges produced two false gate failures | This close (batch-gate disposition) | Declined — practice note recorded here: after merging staging into a working branch, rebuild the UI and restart the control panel before any full-suite gate; the deploy pipeline is immune (fresh builds), so no harness-doc change |

Portability check (Direction ↔ human-gated): #144/#143/#150 are suite-level and flow-agnostic; the row-collision (#151) affects any parallel sessions regardless of mode; the practice notes apply to both.
