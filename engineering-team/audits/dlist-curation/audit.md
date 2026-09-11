# Build Audit: Treasure Map — DList Curation

**Book:** `engineering-team/audits/dlist-curation/book.md`
**Date:** 2026-09-10
**Branch / commit range:** `f850b07d..c797e037` on `feat/dlist-curation` (41 commits, 58 files; **unmerged at close** — pushed at close-out, see §8)
**Provenance:** Acceptance-frame *(no PRD)* — confirmed by the operator at kickoff 2026-09-10
**Confidence:** high for the as-built (every story reviewed PASS by an independent reviewer, six of seven with a live reproduction on the local stack); **medium for "works end to end with a real signer"** — no story could sign a Map or publish a header under a real session, so the add → sign → publish chain has been exercised only up to the signer, never through it

> The as-built record — what the product *is* now, source-linked. It proposes nothing; the seed does that.

## 1. What shipped

- **The Trusted Lists panel says why, then folds.** The opt-in prompt now opens with why a kind-30392 Trusted List matters ("Tags of pubkeys greatly enrich Vespa search on brainstorm.world…"), and the panel folds to one line — title plus a three-state verdict: your assistant · another publisher (short pubkey) · not set. — `stories/dlist-curation/1-tl-panel-copy-and-collapse.md`
- **A ratified way for a Treasure Map to say "my assistant curates this DList."** One entry per list, `["<kind>:<d-tag>", <assistant>, <relay>]` (kind 39998 or 39999), the header reconstructed as `<kind>:<assistant>:<d-tag>`, `dlist-header` reserved for the blanket designation, replace-in-place writer rules, revocation by removal with the header left standing, precedence untouched. — story #2 (`protocols/drafts/assistant-designation.md` § "Per-DList curation entries", ADR 0002)
- **A third `b` type: `inherit-items`.** Live, parent-authoritative inheritance of a list's *items* — additive in v1 (union over an items-deference closure, a candidate set the observer still trust-filters per item), no definition-deference weight, no affiliation, a distinct derived relationship `INHERITS_ITEMS_FROM`; worksheet W6 narrowed to removal/replacement. — story #3 (`protocols/drafts/inherit-from.md`, `shared-concepts.md`, ADR 0003)
- **The server can author the user's assistant header for a chosen community DList.** `POST /api/dlist-curation/header`: verified session; the *caller's* assistant signs; the target is fetched and must be a self-declared shared concept; names/slug/json copied, one `inherit-items` pointer, nothing from the community namespace; exact / conflict (409, pointer surfaced) / unpointed / absent; local strfry then each DList relay with a per-relay verdict under the publish-policy gate; **no graph write**. — story #4 (ADR 0004, amended to supersede `community-reference` ADR 0004's no-server-publisher posture for this one directory)
- **The DList Curation panel.** Folded with a count; opens to a search over the community's self-declared shared concepts (own and assistant-authored headers excluded), Add / Replace / In your Map, a two-step add (header first, then a previewed, drift-guarded NIP-07 signature of the Map), the list of empowered DLists with local header links, and Revoke. — story #5 (ADR 0005)
- **Map Entries reads curated entries as what they are.** "Curated DList" and "TA designation" classes; the assistant's header verified locally then on the row's relay hint; name, link, the community header it inherits from with the pointer type; warnings naming where it looked; duplicates marked ignored (first occurrence wins); the short pubkey inline on external curated rows; the DList detail route now resolves kind-39999 coordinates. — story #6 (ADR 0006)
- **Regenerating a Treasure Map no longer clobbers it.** Both generators (the API handler behind the legacy customer page; the CLI behind the legacy NIP-85 control panel) read the current Map — local strfry, then the NIP-85 home relay and configured relay groups — keep every non-`30382:*` tag verbatim and in order, regenerate only the eleven Trust-Assertion rows, refuse to regenerate blind on a lookup error, and report what they preserved. — story #7 (Bug lane; the story's Design note ratified in review)

## 2. Epics & stories rolled up

### Epic: `dlist-curation`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 tl-panel-copy-and-collapse | New prompt copy; folded three-state Trusted Lists panel; `describeTlDelegation` | Done | `reviews/dlist-curation/1-tl-panel-copy-and-collapse.md` |
| #2 per-dlist-map-entry-convention | The per-DList Map entry, ratified in the assistant-designation draft + pointers; handoff D9 | Done (docs-mode, 2 rounds) | `reviews/dlist-curation/2-per-dlist-map-entry-convention.md` |
| #3 inherit-items-facet | The facet registered; item-set resolution; policy-layer standing; W6 narrowed; handoff D10 | Done (docs-mode, 2 rounds) | `reviews/dlist-curation/3-inherit-items-facet.md` |
| #4 assistant-curation-header-endpoint | `POST /api/dlist-curation/header` (DI'd; no graph write; per-relay honesty) | Done (escalation → ADR amended) | `reviews/dlist-curation/4-assistant-curation-header-endpoint.md` |
| #5 dlist-curation-panel | The panel: search, add (header → Map), empowered list, revoke; four Map-entry helpers | Done | `reviews/dlist-curation/5-dlist-curation-panel.md` |
| #6 map-entries-dlist-class | Two classifier classes; verified header lookup + details line; duplicates; 39999 route ids | Done | `reviews/dlist-curation/6-map-entries-dlist-class.md` |
| #7 treasure-map-merge-preserve | Shared merge library + current-Map fetch; both generators preserve foreign entries | Done (Bug lane; Design note ratified) | `reviews/dlist-curation/7-treasure-map-merge-preserve.md` |

Phase commits for the epic (`scripts/harness-stats.sh` at close): 40 — story 7 · adr 6 (+1 amendment) · test 5 (+3 Tester-lane amendments; the two docs stories had no tests) · impl 7 (+2 round-1 fix commits) · review 9 (the two docs stories took two rounds; every other story passed in one).

## 3. As-built inventory

**User-facing** (`/tapestry/grapevine/treasure-map`)
- `ui/src/pages/grapevine/TlOptInCard.jsx` — the disclosure header + status label (labels from the helper), the four-sentence prompt; body unchanged.
- `ui/src/pages/grapevine/DListCurationPanel.jsx` (+335, new) — folded panel; body mounts on first open (the community fetch starts then); search over `useCommunitySharedConcepts` rows; Add / Replace / In your Map; endpoint call; composed Map preview; `getActiveSignerOrThrow` → `window.nostr.signEvent` → `publishOrThrow` → page re-search; empowered list with local header links; Revoke.
- `ui/src/pages/grapevine/TreasureMapTagsPanel.jsx` (+121/−11) — two labels; `markDuplicateEntries`; one batched two-step lookup (`queryRelay` per (kind, delegate), then `GET /api/relay/external` per still-missing row with a ws/wss hint); details line (name link, "inherits from" + pointer + type, found-where, or the warning); duplicate pill; inline short pubkey on external curated rows.
- `ui/src/pages/grapevine/TrustedAssertions.jsx` — mounts the DList Curation panel between the Trusted Lists panel and the hand-edit panel (order pin kept).
- `ui/src/pages/lists/DListDetail.jsx` — the a-tag branch accepts `39999:` / `9999:` ids.
- Legacy pages (`public/pages/customers/customer.html`, `public/pages/nip85-control-panel.html`) — unchanged; their regenerate flows are now merge-preserving through the endpoints they call.

**API / server**
- `POST /api/dlist-curation/header` `{ target }` → 200 `{ success, existing, header, published:{ local, relays:[{url,status,reason|error}] } }` (published `null` when the exact header pre-existed); 409 `{ error, existing:{ b, event } }`; 400 / 401 / 404 / 500. Sits behind the default-deny middleware with no allowlist change; the handler's own `requireAuth` follows.
- `POST /api/create-unsigned-kind10040` — `data.merge { preserved, regenerated, currentMap: 'local'|'relay'|'none' }`; 503 "Not regenerating blind" on a lookup error. `bin/brainstorm-create-kind10040.js` — same rule; prints the counts; exit 1 on a lookup error; the written template now carries `pubkey`.
- Modules: `src/api/dlist-curation/index.js` (+315: `parseATag`, `classifyExisting`, `composeCurationHeader`, `scanLocal`, `fetchFromRelays(filter, urls, { strict })`, `publishToRelays` with per-relay `Promise.allSettled`, `isLocalOnly`, the handler factory, `register`); `src/lib/treasureMapMerge.js` (+93, zero-require: `TRUST_ASSERTION_METRICS`, `trustAssertionRows`, `mergeTreasureMapTags`, `restampTreasureMap`, `buildTreasureMapTemplate`); `src/api/export/nip85/currentMap.js` (+53: `fetchCurrentMap`, `defaultRelays`); `src/api/trustedList/index.js` exports `publishToStrfry` (one line); `src/api/index.js` registers the module.
- `ui/src/utils/treasureMap.js` (+149/−2): `describeTlDelegation`; `findDListEntries` / `upsertDListEntry` / `removeDListEntry` / `describeDListCuration`; `classifyEntry` classes `dlist` / `designation`; `markDuplicateEntries` / `communityPointerOf` / `describeHeaderLookup`.

**Protocol & documents**
- `protocols/drafts/assistant-designation.md` — intro (two conventions, two families); "Blanket scope" points at the new section; **§ Per-DList curation entries** (table, reconstruction, meaning, header contract naming `inherit-items`, reserved word, multiplicity/writer/reader rules, relay hint, revocation, precedence scoped to kind 39998 with the 39999 gap recorded, worked example); deployment status; stale "§953" refs fixed.
- `protocols/drafts/inherit-from.md` — three-value registry; the `inherit-items` bullet, "one question", family namespace, no `inherit-all`, fail-safe for unknown types; multi-parent union; `INHERITS_ITEMS_FROM` derivation; the definition walk scoped to `inherit`; **§ Resolution: the resolved item set** (rule, pseudocode, `own_items` note, candidate-set/trust sentence, facet independence); Scope, Security, family table; every "two types / both types" phrasing brought to three.
- `protocols/drafts/shared-concepts.md` — inherit-family never affiliates, anchors no stamps; zero deference weight for the facet; discovery walks and reach read "every type". `protocols/drafts/trusted-lists.md` — parse-rule cross-reference. `protocols/README.md` — two rows. `protocols/worksheet.md` — W6 narrowed; W1 wording.
- `BIBLE.md` — § Assistant Keys paragraph (per-DList entries, clobber, wiring status); §25 pointer + glossary (registry, facet, status); §22 "every type"; `Last updated` chained twice.
- `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` — D9, D10, O2 note, W6 row (status stays 🔴 OPEN by its own rule). `engineering-team/decisions/community-reference/0004-publish-export-a-concept.md` — "Amended by" back-reference. `engineering-team/stories/_intake.md` — the `inherit-items` derivation + resolver follow-up.

**Domain**
- Concepts touched: none changed; `39998:<TA>:shared-concept` and `39998:<TA>:tapestry-assistant` are read for orientation only. No firmware reinstall.
- Event shapes: kind-10040 entries `<kind>:<d-tag>`; kind-39998 assistant headers carrying `["b", <community a-tag>, "inherit-items"]`; kind 10040 regeneration now merge-preserving.
- Derived relationship `INHERITS_ITEMS_FROM` is a **specified target**: the deployment's derivation still gates on the literal `inherit` (an `inherit-items` tag derives the pointer form) and no item-set resolver exists — intake 2026-09-10.

**Tests** — five suites (+1,330 lines) registered in `test/test.js`: `dlist-curation-tl-panel` (19), `dlist-curation-header-endpoint` (28), `dlist-curation-panel` (18), `dlist-curation-map-entries` (14), `dlist-curation-merge-preserve` (16). `test/publish-export-a-concept.test.js` RE1 re-scoped to exclude `src/api/dlist-curation/`.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: the assistant header is "published to local strfry and the community relay" | A **server-side per-relay send** (SimplePool, `Promise.allSettled`, timeouts) plus local import | constraint-discovered | `community-reference` ADR 0004 had recorded "no server-side external publisher" and its sentinel RE1 swept all of `src/api/`; surfaced at story 4's full run; operator chose Option 1 (ADR 0004 § Amends; RE1 re-scoped) | none for users; the posture now has one documented exception | OPEN.md row 243 (conflict check); any second server-side publisher needs its own ADR + exclusion |
| 2 | Frame: "the derived edge records the facet" | Spec target `INHERITS_ITEMS_FROM`; the deployment's derivation **not updated**, no resolver | deferred | The book's headers never enter the hosting instance's graph (no-Neo4j-write decision), so nothing in the book exercises derivation (ADR 0003 § Consequences; intake 2026-09-10) | none in this book; matters when an instance ingests such a header (Bob's own) | intake entry "inherit-items: derivation + item-set resolver" |
| 3 | Frame: entry kind "39998 or 39999" | Map convention and Map Entries handle both; **the endpoint and the panel add kind 39998 only** (39999 refused with a message) | interpretation / deferred | The community rows offered are kind 39998; 39999-declared headers are the DList NIP's open direction; precedence for them recorded as undefined (ADR 0003 §9; ADR 0004 §2) | none today | when 39999-declared headers exist: extend the endpoint and the dual-author rule |
| 4 | Frame: relay hint "from the DList relay group" | `aDListRelays[0]` as the hint; the header sent to **every** DList relay; the router's `dcosl` stream found `enabled:false` on this instance | intentional-change | Direct send is what makes the outcome reportable; router-only would have left the header local here (ADR 0004 Option C rejected) | the header reaches the relay named on the Map without depending on router config | Map Entries verifies presence rather than trusting the send (story 6) |
| 5 | Frame: "Nothing else moves" | Four additive touches to shipped code: `trustedList` exports `publishToStrfry`; story 4's `fetchFromRelays` gains `{ strict }`; `DListDetail` accepts 39999/9999 ids; RE1 re-scoped | intentional-change | Each named in its ADR/Design note and its review; every prior suite green throughout | none | — |
| 6 | Frame bullet 3: the count label | The DList Curation panel counts **every** per-DList entry, duplicates included; Map Entries marks duplicates ignored | constraint-discovered | ADR 0005 sub-decision 2 chose "every entry"; ADR 0002 §5's first-occurrence rule was applied in story 6 (reviews #5 NB-1, #6 NB-4) | a Map with a duplicate entry shows "4 DLists curated" beside an ignored row | OPEN.md row 248 |
| 7 | Story 7: "keep every tag the generator does not own" | Ownership is by the `30382:` prefix — a row delegating one metric to a **different** provider is dropped on regeneration | interpretation | The story defined ownership by prefix; seen live on the operator's own Map (review #7 NB-3) | a user who split metrics across providers by hand loses that split on regeneration | seed §7 (product question) |
| 8 | Frame: `inherit-items` "no affiliation" | Ratified: the facet anchors no stamps; curated items are discoverable only under the assistant's header unless a `pointer` `b` is added | intentional-change | ADR 0003 sub-decision 2 (navigation vs deference kept separate) | the later curation feature must decide whether to add the pointer | seed §7 |
| 9 | Frame: the add flow | Two-step (Add → outcome + preview → Sign & publish), operator-approved at the story-5 gate; the Map is composed at sign time from the event on screen | interpretation | Mirrors the Trusted Lists card's "inspect the exact event first" request (story 5 Deviations 1) | one extra click; never signs a stale Map | — |

**Undocumented work:** none. Every file in the diff traces to a story, a review commit (ledger rows, epic notes, the `community-reference` ADR back-reference), or a Tester-lane commit named in a story's Deviations.

## 5. Quality state at close

- **Gates.** Every story's scoped gate green at its review; full `npm test` run after each code implementation (stories 1, 4, 5, 6, 7) and by three reviewers independently — always **green except the three `trusted-lists` L0 guards and the one prune check downstream of them** (OPEN.md row 191: the container allows external publishing; not this book). Close-time full run (2026-09-10, on the close artifacts): **161 suites PASS, 3 FAIL** — the three failing suites are `tl-membership-method-selector`, `tl-weighted-sum-method`, `tl-certainty-method`, and the only four failing tests are the three row-191 guards plus the prune check downstream of them; the five `dlist-curation` suites and `harness-lint` (41) green.
- **harness-lint:** clean at close, with one new waiver (L2, epic retirement held — row 250).
- **Live verification.** Stories 1, 5, 6: fetch-stub remounts and reviewer Playwright runs (78 / 82 / 45 checks) on the local stack; story 4: real seams exercised read-only in-container, the route's 401 both ways; story 7: the CLI generator run in-container on the operator's real Map (found locally; 0 preserved / 11 regenerated) and the real modules on a synthetic foreign-tag Map. **Not exercised anywhere:** a NIP-07-signed Map publish or a header publish under a real session (no signer in the automated tools; publishing a real header to the public community relay was left to the operator).
- **Known open issues** (ledger): row 245 (story 4's seams read connection refusals and a non-zero `strfry scan` exit as "nothing there" — a double-fault hazard for story 7's refusal rule); row 246 (the legacy control panel's Publish reads a never-written file — pre-existing); row 232 (Playwright driver/Chromium mismatch); row 191.
- **Debt logged by ADRs:** the shared disclosure + header-lookup chore (ADR 0001 B, 0005 C, 0006 C — six hand-rolled disclosures, two lookups on one page family); `scanLocal` / `publishToRelays` as second implementations of handler-bound code (ADR 0004); the derivation/resolver (ADR 0003); the `strict` option's reach (row 245).

## 6. Carry-forward register

- [ ] **Count vs duplicates:** `describeDListCuration` counts duplicates and the panel's "already empowered" index is last-wins; both should follow first-occurrence-wins (§4 #6; row 248).
- [ ] **Shared disclosure + header-lookup primitive** — earned across three ADRs (row 249).
- [ ] **`inherit-items` derivation + item-set resolver** — intake 2026-09-10 (§4 #2).
- [ ] **Story 4's seams and the refusal rule** — row 245.
- [ ] **The later curation feature** (the assistant adding items under its header) — out of every story's scope by design; decides the affiliation pointer (§4 #8) and when the owner's own instance ingests its headers (epic § "Settled at kickoff").
- [ ] **Kind-39999-declared headers** — endpoint, panel add, and the dual-author precedence (§4 #3).
- [ ] **Ownership by prefix on regeneration** (§4 #7) — a product question.
- [ ] **Legacy NIP-85 pages** — row 246 plus the 2026-09-08 intake note on the unauthenticated `/legacy/*` surface.
- [ ] **Epic retirement** at the staging merge (row 250; §8).

## 7. Process findings (harness)

Inputs: the seven reviews' "Harness friction" sections, the stories' process-shaped Deviations, the book's `meta` rows, and `scripts/harness-stats.sh` at close (epic `dlist-curation`: 40 phase commits; corpus: story 203 · adr 181 · test 190 · impl 190 · review 243). Every finding has exactly one terminal state. "Ports" = whether the lesson applies to the other flow (Direction ↔ human-gated).

| Finding | Source | Terminal state |
|---|---|---|
| Docs-mode's "exactly the ADR's edits" rule has no consistency sweep; seven stale "two types" sentences survived a registry change (ports: yes) | review #3 friction 1 | OPEN.md row 240 |
| harness-lint L9 (`Last updated`) is commit-dated, so a pre-commit lint cannot see a missing bump (ports: yes) | review #2 friction 1 | OPEN.md row 238 |
| The Architect's ADR-conflict check cannot see a posture enforced only by a regression sentinel (RE1) — surfaced at Phase 4, needed an operator escalation (ports: yes) | review #4 friction 1; story 4 Deviations | OPEN.md row 243 |
| An ADR implementation note written as a regex literal cannot satisfy the Tester's substring pins on the same tokens (ports: yes) | review #6 friction 1; story 6 Deviations | OPEN.md row 244 |
| A Design note in lieu of an ADR should enumerate the configuration it depends on (ports: yes) | review #7 friction 3 | OPEN.md row 247 |
| `In Progress` exists in the story template but no workflow sets it (ports: yes) | review #2 friction 3 | OPEN.md row 233 |
| No architecture step appends the ADR to the epic's Decisions list (ports: yes) | review #2 friction 4; reviews #4/#5/#6 NB | OPEN.md row 234 |
| A text pin that does not discriminate (S4 Space regex) / a pin anchored on the wrong element (story 1 S5) (ports: yes) | review #1 NB-2; story 1 Deviations | OPEN.md row 236 (+ row 244 for the class) |
| The Playwright driver wants a Chromium build the cache lacks (machine-local) | reviews #1, #2, #5, #6, #7 | OPEN.md row 232 |
| In zsh an unbraced `$TA:slug` applies the `:t` modifier and mangles a concept handle (ports: yes — orientation) | ADR 0001 Context | OPEN.md row 237 |
| The in-app Browser pane delivers no keyboard events (ports: n/a — tooling) | story 1 Deviations | OPEN.md row 196 (pre-existing; restated) |
| The full `npm test` exceeds the 600 s foreground ceiling | every review | OPEN.md row 83 (pre-existing; restated) |
| The three `trusted-lists` L0 guards are red by default here | every full run | OPEN.md row 191 (pre-existing; restated) |
| A recording test fixture that records only inside its defaults makes an override's own assertion unsatisfiable (H4) | story 4 Deviations; review #4 | **declined** — fixture-local; fixed in the suite (`b10a7b50`) with the uniform-recording pattern documented in its header; not a harness rule |
| Round-2 reviews had to run in fresh subagents (SendMessage unavailable this session), re-reading round 1 from disk | reviews #2, #3 (round 2) | **declined** — environment limitation; the fresh-subagent pattern worked and each review file carries both rounds; nothing for the harness to change |
| Session-start META ESCALATION (85 open harness lessons) asked for a grouped harness-story proposal at triage; deferred at intake | session-start digest | **declined for this book** — belongs to the `/whats-open` triage step, not a book retro; noted that this book **added 16 ledger rows (7 `meta`)**, raising that pressure — the proposal is the next `/whats-open`'s first item |
| Docs-mode Implementer should bump BIBLE's `Last updated` in the same commit | story 3 Deviations | folded into row 238 (same lesson) |

## 8. Note on the state of the branch at close

The close lands on `feat/dlist-curation` **before** any merge: the operator chose to finish the book rather than ship story by story, so no staging deploy has happened and no story has faced a real signer. Consequences recorded here so a future reader does not misattribute:
- The epic `dlist-curation` is **complete but not retired** (all seven stories Done; the workflow retires an epic only once its branch has merged to the shared line). A harness-lint L2 waiver cites OPEN.md row 250; retirement (folders under `done/`, epic `Status: Done`, waiver removed) is the first act after the staging merge. **Done 2026-09-10:** PR #620 merged; retired on `close/dlist-curation`.
- Production promotion is **not** part of this close.
