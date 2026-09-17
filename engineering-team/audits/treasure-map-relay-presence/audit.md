# Build Audit: Treasure Map — Relay Presence

**Book:** `engineering-team/audits/treasure-map-relay-presence/book.md`
**Date:** 2026-09-07
**Branch / commit range:** `13885661..fc555bc8` on `feat/treasure-map-relay-presence`, promoted via PR #590 → `staging`, PR #597 → `main` (`21dc569f`)
**Provenance:** Acceptance-frame *(no PRD)*
**Confidence:** high — every frame bullet was verified on production, not merely on the dev stack

## 1. What shipped

- **A per-relay answer to "where does my Treasure Map actually live?"** The page previously reported one fact — presence in local strfry — which is the single location no third-party reader ever consults. — `stories/treasure-map-relay-presence/1-treasure-map-relay-presence.md`
- **A truthful distinction between "this relay doesn't have it" and "we couldn't reach this relay."** Previously indistinguishable; two production relays were being mislabelled. — story #1
- **Version-awareness.** Kind 10040 is replaceable, so a relay can serve a *different* Map. Each row reports same / older / newer / unorderable, with the differing version's creation time. — stories #1, #3
- **One-click repair.** Per-relay sync converging local strfry and one relay on the more recent copy, in a labelled direction. — `stories/.../2-per-relay-map-sync.md`
- **A quiet panel.** Collapsed by default behind a status light that names the most serious finding rather than counting coverage. — `stories/.../3-scannable-presence-panel.md`
- **A relay set operators can edit.** New `aTapestryInstanceRelays` group; two unreachable relays removed from shipped defaults. — story #1 + doc-lane chore

## 2. Epics & stories rolled up

### Epic: `treasure-map-relay-presence`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 treasure-map-relay-presence | Per-relay presence probe + `GET /api/relay/presence` + panel | Done | `reviews/treasure-map-relay-presence/1-treasure-map-relay-presence.md` |
| #2 per-relay-map-sync | Direction-labelled sync; opt-in `full=1`; policy-gated | Done | `reviews/.../2-per-relay-map-sync.md` |
| #3 scannable-presence-panel | Collapsed by default; status-light summary; visible timestamps | Done | `reviews/.../3-scannable-presence-panel.md` |
| *(doc-lane)* drop unreachable `*.nostr.band` | Two entries removed from `defaults.json` | — | `reviews/.../drop-unreachable-nostr-band-relays.md` |

## 3. As-built inventory

**User-facing**
- `/tapestry/grapevine/trusted-assertions` — the "Where this Map lives" panel: collapsed by default, status-light header, per-relay rows with group labels, per-row sync, local-strfry row retaining its import affordance.
- Home > Settings > Relays — new **Tapestry Instance Relays** group.

**API**
- `GET /api/relay/presence?relay=&pubkey=&kind=[&full=1]` → `{success, relay, status: present|absent|unreachable, event, error}`. One relay per request. Default projects `event` to `{id, created_at}`; `full=1` returns the complete verified event.

**Modules**
- `src/api/_shared/relaySource.js` — `probeRelayForEvent()` (+128), the only sourcing primitive that can report reachability.
- `ui/src/utils/treasureMap.js` (+158) — `buildPresenceTargets`, `compareMapVersions`, `planRelaySync`, `summarizePresence`.
- `ui/src/pages/grapevine/TreasureMapRelayPresence.jsx` (+380) — new.

**Domain:** no concept handles touched, no schema change, **no firmware reinstall** — correct, and asserted by all three ADRs.

**Data & contracts:** reads kind 10040 only. Writes only by republishing an already-signed event (sync push) or importing one (sync pull). **No event is ever created or deleted by this book.**

**Diff:** 10 files, +1792 / −31 (source and tests; excludes harness docs).

## 4. Deviations from intent

| # | Specified (frame bullet) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | "Coverage: … the trusted-assertion relays" | Group ships with 2 relays, not 3 | constraint-discovered | `nip85.nostr.band` unreachable at TCP layer from host and container (doc-lane review) | Coverage narrower than drafted, but the removed relay served nothing | — |
| 2 | Story 2: "sending converges the relay" with a legible failure | Outcome judged from what the relay serves, **not** from the publish call's verdict | constraint-discovered | `publishToRelays` reports every publish as success — `Promise.race` on a non-thenable array (review #2 § Deviation; OPEN.md row 200) | None visible; the criterion works *because* of the deviation | Row 200 — five other publish paths still trust the broken signal |
| 3 | ADR 0001 named `aRelays` as the relay source | Page now has **two** relay-list sources: `aRelays` for the panel, concept-graph Cypher for the Map-lookup fallback | intentional-change | ADR 0001 § Consequences: the story adds a panel and must not alter a shipped read path | None today; the two can drift | `follow-ups.md:131` |
| 4 | Story 1 said nothing about config-load state | Panel distinguishes "config not yet loaded" from "no relays configured" | added-beyond-scope | Self-review found the panel asserting "No relays configured" during the load window — a false statement about the operator's setup | Removes a misleading transient | — |
| 5 | Story 3 AC-2 fixed a 4-rung precedence | Implemented as 5 rungs: an *unjudged* row blocks the all-clear without outranking a real finding | interpretation | Review #3 blocking 2 — the helper could emit `ok` over rows it never judged | Prevents a false all-clear | — |
| 6 | Story 3: "all-missing" caution unchanged | Condition changed from `holding === 0` to `agreeing === 0` | intentional-change | Keeping a "holding" count beside an "agreeing" summary would let the two contradict each other on screen (Implementer disclosure; review #3 non-blocking 2) | Caution now also fires when relays hold only divergent copies — arguably more correct | — |
| 7 | Story 3: default closed | Also **keyboard-operable** (`role`, `tabIndex`, `aria-expanded`, Enter/Space) | added-beyond-scope | Review #3 blocking 1: this book is what put ten rows behind a disclosure, so a pointer-only toggle would have been a regression | Panel reachable without a mouse | Residual: no `aria-controls` |

**Undocumented work:** none. Every source file in the diff traces to a story or the doc-lane chore.

## 5. Quality state at close

- **Test gate:** the three book suites are green — `treasure-map-relay-presence` 35/35, `treasure-map-relay-sync` 22/22, `treasure-map-panel-summary` 18/18. Full `npm test` is `Overall: FAIL` on three unrelated `trusted-lists` suites (**OPEN.md row 191**), proven pre-existing at story 1's review by running one of them at this branch's base commit in an unmodified checkout. **CI `npm test` passed green** on the promotion PR (#597, run 34171675430) — the stack-free subset.
- **Production verification (2026-09-07):** all three presence statuses correct against real relays; narrow default vs `full=1` shapes; validation rejects; relay group served; no `nostr.band`. Production TA pubkey `919ba08a…` ≠ staging `8e901369…` ≠ dev `11f23fe4…`, confirming no hardcoded identity leaked.
- **Known open issues:** OPEN.md rows 200 (publish success always reported), 201 (read-after-write race), 191 (trusted-lists suites vs publish posture), 196 (no keyboard events in the Browser pane).
- **Debt from ADRs:** two relay-list sources (ADR 0001); a third `querySync`-shaped helper that must *not* be unified with the other two (ADR 0001, `follow-ups.md:139`); negentropy sync deferred for NIP-77 relays (ADR 0002).

## 6. Carry-forward register

- [ ] **Fix `publishToRelays`** — `await Promise.allSettled(pool.publish(...))` and classify per relay. Expect previously-silent failures to surface; check the tag/TL publish suites in the same change. (§4 #2, OPEN.md row 200)
- [ ] **Sweep read-after-write assumptions** wherever the code publishes then immediately re-reads the same relay. (OPEN.md row 201)
- [ ] **Reconcile the two relay-list sources** and decide whether `aRelays` or the concept graph is canonical instance-wide; the graph still carries the two dead `nostr.band` relays. (§4 #3, `follow-ups.md:131`)
- [ ] **Two Phase-4 coverage gaps** — story 2's failure branch and story 3's empty-state branch, both added where test edits are barred. Tester lane. (reviews #2 nb-1, #3 nb-3)
- [ ] **Strengthen `M8`** — it asserts what the level *is not*, never what it *is*, which is why review #3's blocking 2 passed the suite.
- [ ] **Push/repair affordance** — "put my Map on every relay missing it", deliberately deferred from story 2.
- [ ] **Negentropy sync** for relays that support NIP-77 (the Tapestry instances do). (ADR 0002 follow-up 1)
- [ ] Optional: remember the panel's open/closed choice; add `aria-controls`; normalise trailing slashes in `buildPresenceTargets`.

## 7. Process findings (harness)

| Finding | Source | Terminal state |
|---|---|---|
| CLAUDE.md claims the repo is bind-mounted into the container; it is not | story 1 orientation | OPEN.md row 198 |
| `/cycle-local` step 1 fails in a fresh worktree (`vite: command not found`); root `.gitignore` doesn't ignore a symlinked `node_modules` | story 1 implementation | OPEN.md row 199 |
| `publishToRelays` reports every external publish as success | story 2 live verification | OPEN.md row 200 |
| A relay acknowledges a publish before it is queryable — an immediate re-read can report success as failure | story 2 live verification | OPEN.md row 201 |
| The Browser pane delivers no keyboard events, so a11y cannot be verified end-to-end there | story 3 re-review | OPEN.md row 196 |
| A phase gate was silently skipped when the operator's approval carried a new instruction in the same message — story 2 reached a successor story unreviewed | story 2 deferred review | OPEN.md row 197 |
| Two branches allocated the same OPEN.md ids in parallel (192–195), and again (181/182/184) | staging merge; operator report | Commits `fc555bc8`, `0d46668c` — renumbered, tiebreakers recorded in each message |
| Selective promotion of `relay-scan-bounds` to `main` diverged the histories, so `staging → main` conflicted on five paths including a source file | production promotion | Commit `7fe0d4b7` — reconciled toward staging on proof that main held no file or ledger row staging lacked |

## 8. Note on scope of the production promotion

The `staging → main` promotion (PR #597) carried **more than this book**: the `trusted-lists` weighted-certainty book (PR #574, four stories) and a `treasure-map-user-assistant` fix rode the same line. The operator was shown the full bundle — including OPEN.md row 191's explicit warning that #574 wants validation before promotion — and authorized promoting everything. Recorded here so a future reader does not attribute the trusted-lists surface to this book.
