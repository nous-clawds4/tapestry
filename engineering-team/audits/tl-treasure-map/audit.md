# Build Audit: Trusted Lists on the Treasure Map

**Book:** `engineering-team/audits/tl-treasure-map/book.md`
**Date:** 2026-08-27
**Branch / commit range:** `106c5de0..fae84a60` on `staging` (PRs #568, #569, #570, #571, #572,
#573; 22 files, +1985/−78 — of which code+tests+CI: 8 files, +989/−77)
**Provenance:** Acceptance-frame
**Confidence:** high — anchored frame confirmed at kickoff; every bullet verified in-session
against the live localhost stack and `staging.brainstorm.world` (bundle-hash-matched to the
locally verified build), with the wire convention ratified by a full ADR.

> The Build Audit is the **as-built record** — what the product *is* now, factual and
> source-linked. The product team reads it to scope the next phase; a future engineer reads it
> to understand what shipped.

## 1. What shipped

- **The Treasure-Map TL-advertisement convention** — a kind-10040 Map can now advertise, with a
  generic bare-kind entry `["30392", <pubkey>, <relay>]`, which pubkey publishes the owner's
  Trusted Lists of that kind and where; ratified wire semantics (parse rule, replace-not-append,
  first-occurrence-wins, relay-hint source, named-entry reservation) —
  `stories/tl-treasure-map/1-treasure-map-tl-advertisement-convention.md`, ADR
  `decisions/tl-treasure-map/0001-*`, spec section in `protocols/drafts/trusted-lists.md`.
- **Map Entries panel** — the TA Treasure Map page enumerates every tag of the found 10040: kind,
  TA/TL/other classification, delegate avatar (TA-badged, batch-fetched profiles) linking to
  `/tapestry/users/<pubkey>`, runtime-resolved **Local TA**/**external** badge, relay hint —
  `stories/tl-treasure-map/2-treasure-map-tags-panel.md`.
- **TL opt-in card** — the salient three-state answer (absent / external / local) for generic
  pubkey-TL delegation, the opt-in prompt, a live preview of the exact updated unsigned event,
  and drift-guarded NIP-07 sign + publish to local strfry and the external relays (deployment
  publish gate inherited) — `stories/tl-treasure-map/3-tl-opt-in-preview-publish.md`.
- **Manual Treasure-Map editor** — a hand-edit escape hatch in all card states: the current raw
  event in an editable field, a dirty-gated "Publish updated event" flow with validating parse
  and the re-stamp policy — `stories/tl-treasure-map/4-manual-treasure-map-editor.md`.
- **Serialized staging deploys** — a `concurrency` group on `deploy-staging.yml` after two
  book-PR merges raced `docker compose up` and downed staging (traced hotfix, OPEN.md row 183).

## 2. Epics & stories rolled up

### Epic: `tl-treasure-map`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 treasure-map-tl-advertisement-convention | ADR 0001 + spec section (docs-mode, wire-format trigger honored) | Done | `reviews/tl-treasure-map/1-treasure-map-tl-advertisement-convention.md` |
| #2 treasure-map-tags-panel | classifier util + Map Entries panel replacing TagSummary | Done | `reviews/tl-treasure-map/2-treasure-map-tags-panel.md` |
| #3 tl-opt-in-preview-publish | salient check, prompt, preview, sign & publish | Done | `reviews/tl-treasure-map/3-tl-opt-in-preview-publish.md` |
| #4 manual-treasure-map-editor | hand-edit + republish (operator pre-close addition) | Done | `reviews/tl-treasure-map/4-manual-treasure-map-editor.md` |

## 3. As-built inventory

- **User-facing:** `/tapestry/grapevine/trusted-assertions` (TA Treasure Map page) — reordered
  found-Map view (header → Local Strfry status → Map Entries → raw-event toggle → Trusted Lists
  panel); redundant Event ID/Tags/Content cards removed (PR #571); the "Trusted Lists for
  Pubkeys (30392)" card with opt-in, preview-above-button (PR #572), and the manual editor.
- **New modules:** `ui/src/utils/treasureMap.js` (`classifyEntry`, `findGenericTlDelegation`,
  `upsertGenericTlTag`, `composeManualUpdate` — pure, behaviorally tested);
  `ui/src/pages/grapevine/TreasureMapTagsPanel.jsx`; `ui/src/pages/grapevine/TlOptInCard.jsx`
  (+ `ManualEditSection`).
- **Domain:** no concept-graph changes, no firmware reinstalls, no new handles.
- **Data & contracts:** kind-10040 gains the generic TL-advertisement entry (family-stated
  `30392`–`30395`, exercised for `30392`); relay hint sourced from
  `settings.aRelays.aTrustedListRelays[0]` via `/api/relays`; publishes ride the existing
  `publishOrThrow` chain (local strfry + `PUBLISH_RELAYS`, `BRAINSTORM_PUBLISH_LOCAL_ONLY` gate
  respected). Spec: `protocols/drafts/trusted-lists.md` § "Treasure-Map advertisement";
  `protocols/README.md` row updated.
- **Tests:** `test/tl-treasure-map-panel.test.js` (18) and
  `test/tl-treasure-map-optin-publish.test.js` (22), registered in `test/test.js`; guard suites
  named per story (`global-publish-gate`, `strfry-write-assertion-bracket`,
  `treasure-maps-router-preset`).
- **CI:** `deploy-staging.yml` concurrency group.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: opt-in appends the tag, "all other tags preserved" | Replace-not-append for a stale generic entry; wild duplicates normalized to one | intentional-change | Operator decision at Gate A; ratified ADR 0001 §3 | Readers never face two competing generic entries | — |
| 2 | Frame bullet 3: publish "to local strfry + the general-purpose relays" | `publishOrThrow`: success = local OR external accepted; local-only gate honored | interpretation | Story-3 Design note; `publishOrThrow` contract (review #3) | Rare inverse-partial case can show a stale card until sync | §6 item 1 |
| 3 | Frame: panel enumerates tags (summary cards untouched, implicitly) | Event ID/Tags/Content cards removed; opt-in panel moved below Map Entries + raw event | added-beyond-scope (operator-requested polish) | Operator, pre-close cosmetic pass (PRs #571, #572 — commits `79724ab7`, `a4e3ed36`) | Cleaner "how it is → what to do" reading | — |
| 4 | Frame: prompt copy "…publish your pubkey Trusted Lists on your behalf?" | Reworded + second sentence; panel retitled "Trusted Lists for Pubkeys (30392)" | intentional-change | Operator copy amendment (PR #572); story-3 AC-2 amended with trace | Clearer copy | — |
| 5 | Frame: (no manual editing mentioned) | Story 4: full manual editor with re-stamp policy | added-beyond-scope (operator-ratified story) | Operator pre-close request; Gate A 2026-08-27 (two decisions: all states; re-stamp) | Power-user escape hatch beyond the derived flow | — |
| 6 | Frame: "verified locally and on staging" | Verified logged-out + bundle-hash-matched on staging; logged-in visual pass done by the operator at Gate B ratifications | constraint-discovered | NIP-07 login is a server-session challenge, not headless-automatable (reviews #2–#4) | None observed | — |

**Undocumented work** — none: every diff hunk traces to a story, the ADR, the two
operator-requested polish PRs (#571/#572, recorded here as deviations 3–4), or the traced CI
hotfix (row 183). The docs-only remainder of the range is this book's own harness artifacts.

## 5. Quality state at close

- Test gate (full `npm test`, post-flip): **Overall FAIL (exit 1) — environmental, diagnosed,
  zero book overlap.** 119 suites PASS, 15 FAIL, 154 tests skipped; every failing suite is
  Neo4j/concept-graph-backed (second-brain, adoption, curation, operational-direction families),
  and the local Neo4j was crash-cycling through the run (OPEN.md row 185; it also spoiled a
  first attempt). The book's own suites ran green **in the same run** — panel 18/18, optin
  22/22 — as did its named guards; the book range contains no `src/` change that any server
  suite executes. Staging remains bundle-hash-verified green.
- Scoped gates at final story state: panel suite 18/18; optin suite 22/22; guards 8+6+5 — all
  green (review #4).
- Known accepted issues: inverse-partial publish display (§6 item 1); guard H2 flake under load
  (OPEN.md row 184).
- Debt from ADR 0001 Consequences: named-entry override semantics deferred; cross-repo parse-rule
  adoption (Brainstorm client) is a named follow-up; TL propagation to hinted relays remains the
  TL-publication pipeline's concern.

## 6. Carry-forward register

- [ ] Inverse-partial publish (local strfry rejects, external accepts) shows the stale card
      until sync — add a `result.local.success === false` notice (review #3, non-blocking 1).
- [ ] Named-entry override (`"30392:<name>"`) activation + precedence — future ADR when named
      TLs ship (ADR 0001 Out of scope; reserved in the spec).
- [ ] Brainstorm-client adoption of the generic-entry parse rule (cross-repo; worksheet-level —
      ADR 0001 Consequences).
- [ ] TL propagation to the hinted relay is not guaranteed by the advertisement — verify the
      publication pipeline/router actually lands TA 30392s where the hint points (ADR 0001).
- [ ] Sibling deploy workflows still lack the concurrency guard (OPEN.md row 183 residual).
- [ ] Test S9's assertion is thinner than its name (error surface carried by U9+S6) — strengthen
      on next suite re-aim (review #4, non-blocking 1).
- [ ] Production promotion of the whole book (`/cycle-prod`) — operator's explicit call, outside
      the frame.

## 7. Process findings (harness)

Retro basis: `scripts/harness-stats.sh` at close — 177 reviews parsed, 175 final PASS,
kick-back *history* 32/177 (≈18%, the comparable line per the trial protocol); `tl-treasure-map`
contributed 12 phase commits.

| Finding | Source | Terminal state |
|---|---|---|
| `npm test -- <file>` does not scope in this repo; light-profile.md's example syntax misleads Gate A | review #2 Harness friction; story-2 Type block correction | OPEN.md row **181** |
| Session-start digest false-negatived "stack absent" while the stack served 200s | session start, review #2 | OPEN.md row **182** |
| Concurrent staging deploys raced `docker compose up` and downed staging | incident 2026-08-27 (PRs #568/#569) | harness commit `a12481f2` (concurrency group, merged PR #570) + OPEN.md row **183** for the five sibling workflows |
| Guard test H2 can flake red on a timeout with the stack up, reddening unrelated scoped gates | J3 verdict story #4; review #4 Harness friction | OPEN.md row **184** |
| Gate A for stories 1–3 was bundled into one kickoff exchange (profile reads per-story) | this close's retro | declined — no scope drift materialized and every story carried its own scope/approach/gate in the bundle; per-story Gate A remains the rule, bundling acceptable only when stories are fully pre-specified at kickoff |
| Operator polish PRs #571/#572 ran outside story ceremony without an OPEN.md/intake hotfix row at ship time | this close's retro | declined — the book was open and operator-present; §4 deviations 3–4 supply the trace the hotfix hatch exists to guarantee; an orphan (bookless) hotfix would still need its row |
| J2 finding: story-2 E1 labeled "not derivable" though AC-4 carried the derived clause | J2 verdict story #2 | declined — label fixed in-story (commit `0bd4c80a`); accuracy issue, not a harness rule |
| Close-time gate run exposed a local Neo4j outage (service `STARTING`, concept-graph API refusing) — every Neo4j-backed suite red with zero causal path from the book (no `src/` diff); the session-start "stack absent" digest (row 182) is thereby **vindicated at the graph layer** and its defect re-scoped to message granularity | this close's certified `npm test` (first attempt, discarded as diagnostic) | OPEN.md row **182 (amended at this close)**; gate re-run after Neo4j recovery is the recorded result (§5) |

**Light-profile trial record (workflows/light-profile.md § Trial protocol):** first Light book.
Rules **followed**: story 1 escalated to Standard docs-mode on the wire-format trigger; J1/J2/J3
ran per story (2–4) as fresh blinded spawns naming the light-profile rubric — 9 spawns, 9
verdicts, 0 KICK_BACKs, 0 HALTs; scoped gates named at Gate A and run by judges foreground with
brace-redirect; the full `npm test` was reserved for this close; Gate B reviews ran full-rigor
with AC verdict tables. Rules **bent** (findings above): bundled Gate A (stories 1–3); the
scoped-gate command named at Gate A needed correction mid-story-2 (row 181); polish outside
story ceremony. **Teeth check** (corpus comparison — findings-per-review at Gate B, corpus
median 3): reviews #2–#4 carried 2 + 2 + 2 non-blocking findings plus 3 harness-friction lines —
not empty, and the judged interior produced real catches a human gate might have missed
(delegate-less classification defect fixed at `80960aa4`; dangling docblock; H2 flake;
E1-label inaccuracy). Escaped-defect window (30 days) opens at this close for the trial's other
comparison line.

## Post-flip gate result

- `npm test` after the flip + epic close-out (2026-08-28 local, run b8p77116x):
  `Overall: FAIL`, exit 1 — 119 suite PASS / 15 suite FAIL / 154 tests skipped, all failures in
  Neo4j-backed suites under the diagnosed local Neo4j crash cycle (OPEN.md row 185). Book
  suites in the same run: `tl-treasure-map-panel` **PASS (18/18)**,
  `tl-treasure-map-optin-publish` **PASS (22/22)**. Recorded as an environmental red with
  diagnosis rather than re-run a third time against a known-sick database; the harness-lint
  portion of the run (L2 book/epic pairing over the flipped tree) passed.
