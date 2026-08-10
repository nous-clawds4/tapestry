# Build Audit: Shared Concepts Legibility

**Book:** `engineering-team/audits/shared-concepts-legibility/book.md`
**Date:** 2026-08-10
**Branch / commit range:** `15b7d753` → `47dd7bf1` on `feat/shared-concepts-legibility` (17 first-parent commits, excluding the one keep-both merge from staging). Shipped to production in two waves: PR #524 → #525 (`30ae4cf1`) and PR #526 → #527 (`9d50fd1a`, deploy `31358518017`).
**Provenance:** Acceptance-frame — owner-confirmed at book open, 2026-08-09
**Confidence:** high — all four frame bullets met, every story reviewed PASS, everything smoke-verified on staging *and* production against live data rather than fixtures.

> The Build Audit is the **as-built record** — what the product *is* now, factual and source-linked. It does not propose changes — that's the seed's job.

## 1. What shipped

The book began as a walkthrough, not a spec: the owner drove the Shared Concepts feature as a new user would and could not answer *"have I already shared this concept?"* — about their own instance, in a feature they built. Everything below descends from that.

- **A concept's page states its sharing state before anything is clicked** — *not yet shared* / *shared* / *declared here but not yet sent* / *unconfirmed* / *wired to X* / *kept private*, with the submit button's wording and a confirmation step derived from that state — `stories/done/shared-concepts-legibility/1-state-on-concept-page.md`
- **"Shared" now means published to a public relay**, not merely declared locally — an owner ruling that produced a genuinely tri-state answer and an explicit *declared-here-but-not-sent* state — ADR `0001`
- **My Offerings** — one page listing every concept this instance has offered, *including any that never reached the relay*, backed by the new public read `GET /api/my-offerings` — `2-mine-only-self-declared.md`
- **A vocabulary that distinguishes offering, adopting and cataloguing** — `View Shared Concepts` → **Shared Concepts Registry** (nav `Registry`), `Create New Shared Concept` → **Add to Registry**, `Self-declared Shared Concepts` → **Community Offerings** — doc lane, `reviews/done/shared-concepts-legibility/shared-concept-vocabulary.md`
- **A naming rule, written down:** *workflow surfaces are named for the verb; wire inspectors are named for the tag.* `Active b-tags` / `Active z-tags` were reviewed under it and deliberately **kept**.

## 2. Epics & stories rolled up

### Epic: `shared-concepts-legibility`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 state-on-concept-page | Sharing-state badge + state-derived button + re-submit confirmation + in-place refresh; new pure core `src/lib/sharingState.js`; public read `GET /api/concept/:handle/sharing-state` | Done | `reviews/…/1-state-on-concept-page.md` (PASS) |
| #2 mine-only-self-declared | `GET /api/my-offerings` bulk resolver (two queries regardless of N) + the My Offerings page | Done | `reviews/…/2-mine-only-self-declared.md` (PASS) |
| — shared-concept-vocabulary | Two renames, nine cross-references, the naming rule | Done (doc lane — no story file by design) | `reviews/…/shared-concept-vocabulary.md` (PASS, after one round) |

## 3. As-built inventory

**User-facing.** New page **My Offerings** at `/tapestry/shared-concepts/mine`. Concept detail pages gain a sharing-state line, a state-derived submit label, and a `ConfirmDialog` on re-submit. Nav now reads: **Registry · Add to Registry ·** *Active b-tags · Active z-tags ·* **My Offerings · Community Offerings · Adoption Queue · Trusted Dictionary**. Page descriptions rewritten on Registry, Add to Registry, Community Offerings; the Community Offerings detail page retitled.

**Endpoints.** Two new **public reads** — `GET /api/concept/:handle/sharing-state` (single coordinate) and `GET /api/my-offerings` (bulk, own TA). Both public deliberately: they reveal nothing an observer could not read off the relay. **No write path was added or altered**; `POST /api/concept/:handle/self-declare` retains its owner gate (verified 401 unauthenticated on both staging and production after each deploy).

**Domain.** Concepts touched: `39998:<TA>:shared-concept` and `39998:<TA>:concept-header` — read only. **No concept definitions changed; no firmware reinstall anywhere in this book.** The TA pubkey is resolved at runtime everywhere (`getOwnerAssistantPubkey` server-side, `useConfig().taPubkey` client-side); no 64-hex literal appears in any new file. Three distinct TA values were exercised this session — dev `11f23fe4…`, staging `8e901369…`, production `919ba08a…` — which is what made the per-deployment rule testable rather than theoretical.

**Data & contracts.** `published` is a **tri-state** `true | false | null` across both endpoints, with `null` meaning *the relay could not be asked*. The rule has exactly one home (`src/lib/sharingState.js`), pinned by a structural test across both handlers. Wire vocabulary unchanged — the self-pointing `b` tag remains the declaration, and `b-tag-deferred` remains the keep-private sentinel.

**Libraries & tests.** New pure zero-require core `src/lib/sharingState.js` (`carriesSelfPointer`, `resolveSharingState`), joining the `adoptionQueue` / `trustedDictionary` idiom. Two new suites — `state-on-concept-page` (20) and `my-offerings` (14) — both registered with the five-touch pattern, **neither minting fixtures**.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 1 — "can tell whether she has already shared" | *Shared* redefined to require **relay publication**; local declaration is not enough | interpretation (owner-ratified) | Owner ruling 2026-08-09, overruling the PO's cheaper local-only recommendation (story 1 Open question 1) | Two states exist that the draft lacked — *declared-here-not-sent* and *unconfirmed* — and the answer is now true rather than merely local | Every concept-page load makes one relay round trip; §6 |
| 2 | — (not in frame) | A **failed relay check renders as "unconfirmed", never "not shared"** | added (consequence of #1) | Story 1 AC-4; ADR 0001 | Silence from the relay cannot masquerade as a negative | — |
| 3 | Frame bullet 2 — "one place" | A **new page**, not a filter on the existing directory | interpretation | ADR 0002: the two answer different questions from different stores, and one page with two contracts is the confusion the book was undoing | Community Offerings keeps its contract; My Offerings gets its own | — |
| 4 | — (not in frame) | **Asymmetric failure handling** in the bulk read: relay failure → rows render `null`; local failure → **503**, never an empty list | interpretation | ADR 0002 Decision — a relay failure leaves a useful partial answer, a local failure leaves none, and "you have offered nothing" is the one lie a completeness page must not tell | An unreadable local store surfaces as an error rather than a false all-clear | — |
| 5 | Frame bullet 4 — "words distinguish offering, adopting, cataloguing" | Two labels renamed; **two deliberately kept** under a new rule | interpretation | Vocabulary review — for a raw-tag inspector the mechanism *is* the question | The section is legible without hiding what the wire tools are | — |
| 6 | Book scope note: "`seeding-path` … there is no way to offer a concept nobody else uses" | **The scope note was factually wrong.** The capability existed all along in two places; only the Adoption Queue's *nomination* view is demand-gated | constraint-discovered (analyst error) | Owner `/discuss` 2026-08-10; corrected in `47dd7bf1` | None to the product — the error was in the docs, not the code. It would have misled the next session into rebuilding an existing capability | Successor book; §7 |
| 7 | Book queue: `disposition-filter-on-concepts` listed under this epic | **Not built**; reassigned to the seeding successor | deferred (owner-scoped) | Owner `/discuss` 2026-08-10 — filtering to "not yet offered" is the bulk half of *seeding*, not of legibility | The Concepts list still cannot compose author + disposition | Successor book |
| 8 | — (not in frame) | The **naming rule** itself, recorded in the epic and pinned in a docblock at the spot where a future contributor would break it | added-beyond-scope | Vocabulary review | The rule outlives the two renames it justified | — |

**Undocumented work** — none. Every diff hunk traces to a story, an ADR, or the doc lane. The vocabulary pass has no story file **by design** (strictness table: doc/one-liner → Implementer + Reviewer), which is documented-by-design rather than undocumented — and is itself the source of process finding 8 below.

## 5. Quality state at close

- **Test gate:** `npm test` → **`Overall: PASS`**, every suite `0 failed`, **53 skipped** (the established baseline), read from a complete 4142-line capture. The two new suites: 20/20 and 14/14, zero skips. `harness-lint` clean (verified by exit code).
- **Verified in production, not just staging:** `/api/my-offerings` on `tapestry.brainstorm.world` returns one offering (`nostr relay`, `published: true`) under prod's own TA; `sharing-state` correct; `POST self-declare` still 401; search 200.
- **Known open issues:** OPEN.md **#150** (live-publisher scan-count flake — fired twice in this book, remedy sharpened), **#157** and **#158** (both opened by this book), **#152** (local wire-archaeology), and **#159** (new at this close — see below).
- **Debt rolled up from ADRs and reviews:** story 1's handler swallows a local-read failure where it tri-states the relay one (`sharingState.js:101`, review 1 NB-1) — ADR 0002 declined to reproduce it but did not fix it; `fetchFromRelays`'s failure-swallow persists for its **eight** other callers; the community directory still fetches every author's headers (359 events) to render a handful of rows; the community relay constant is now hardwired in **six** places; `MyOfferings.stateOf` maps a non-tri-state value to *not yet sent* — the unsafe direction for this feature's own principle (review 2 NB-2); and two endpoints now compute sharing state, sharing a core but joining local↔relay twice.

## 6. Carry-forward register

- [ ] **The seeding successor** (owner-scoped 2026-08-10, frame ratified): the `declareAndBroadcast` reporting bug — it reports *"Submitted as a shared concept"* regardless of whether the broadcast reached the relay, because it discards `publishToRelays`'s result including `skippedByGate` (`dispositionActions.js:26`); an **"Offer a concept…"** affordance on My Offerings; and `disposition-filter-on-concepts` as the bulk sweep.
- [ ] **Story 1's local-read swallow** (review 1 NB-1) — the symmetry pass ADR 0002 declined to bundle.
- [ ] **`fetchFromRelays` tri-state** (ADR 0001 Option C, deferred) — eight callers.
- [ ] **`stateOf`'s unsafe fall-through** (review 2 NB-2) — treat anything not exactly `true`/`false` as unknown.
- [ ] **Concept-graph-sourced relay sets** — the owner named this as the eventual shape; six call sites now.
- [ ] **The blank concept page** (OPEN.md #159, new) — reachable from a My Offerings row, and on this instance the *only* not-yet-sent row is such a case.
- [ ] **The community directory's fetch-everything** — untouched by this book.
- [ ] **Bulk sharing-state for other surfaces** — the resolver generalizes; nothing else consumes it yet.

## 7. Process findings (harness)

Retro instrument at close (`scripts/harness-stats.sh`, 2026-08-10): 857 phase commits · 164 reviews decided · kick-back rate 1% · churn 2 · books 3 open / 33 closed. This book: 3 units of work, 3 PASS verdicts, **one kick-back** (the vocabulary pass).

| Finding | Source | Terminal state |
|---|---|---|
| Piping a full gate through `tail` destroys the diagnosis *and* replaces the runner's exit code — third sighting; the previous book's audit declined it twice as "one-session practice" | review 1 § HF 1 | **OPEN.md row 157** (opened by this book) |
| Two further self-inflicted shell maskings at this close: an `&&` chain took `tail`'s status and committed over a lint violation; zsh consumed `:c` in `$TA:cat-breed`, producing a false 400 that briefly read as a production regression | this close | **OPEN.md row 157** amended by citation — same genus, now five instances across two books |
| The review gate makes `harness-lint` red by construction between writing a PASS review and flipping the story | review 1 § HF 3 | **OPEN.md row 158** (opened by this book) |
| …recurred one story later, again inside the reviewer's own quality gate — the one place guaranteed to trip it | review 2 § HF 1 | **OPEN.md row 158** amended by citation |
| Row 150's own remedy ("re-run standalone") is **insufficient** on router-connected instances — the isolated re-run also failed (+2, corpus climbing ~10 events between runs); only quiescing `strfry-router` cleared it | reviews 1 and 2 (third and fourth sightings) | **OPEN.md row 150** amended — sharpened remedy, two independent confirmations |
| First observed run in which **both** suites of the row-150 pair failed together — the case the row anticipated but had never seen | review 2 | folded into the **row 150** amendment |
| Row 151's "check `origin/staging`'s tip before minting" convention prevented an exact repeat of the #148 collision on its first real test — staging held 154–156 against a local tip of 153 | keep-both merge `76a4d3a7` | **Declined** as a new row. The convention worked as designed; its first successful use is recorded here, and is the evidence its ratification deserves |
| The **doc/label lane produces a review with no story**, which harness-lint L4 forbids by construction — a lane the strictness table endorses should not need a filename workaround to satisfy lint | vocabulary review § HF 1 | **OPEN.md row 16** amended by citation (same L4 tension, different cause) |
| An analyst overstatement — a narrow finding ("the Adoption Queue's nomination view is demand-gated") generalized into a false claim ("there is no way to offer a concept nobody else uses") — was **restated into three durable docs** and would have sent a future session rebuilding an existing capability | owner `/discuss` 2026-08-10; deviation §4 #6 | **Corrected** at source in commit `47dd7bf1`, with the mechanism spelled out in all three. **Declined** as a row: the actionable shape is single-sourcing a finding instead of restating it in three places, which harness-lint L5 already enforces for constants; extending it to prose is not proposed here |
| `gh pr merge` offered `--admin` to bypass a `BLOCKED` production merge caused by a still-running required check | prod promotion, PR #527 | **Declined** — the block was correct and transient. Recorded as practice: wait for checks; `--admin` exists to bypass exactly the protection that was working |

Portability check (Direction ↔ human-gated): 157, 158 and the row-150 sharpening are suite- and gate-level, so they apply to either flow. The L4/doc-lane collision is flow-agnostic. The overstatement finding is analyst-shaped and applies wherever a role writes durable prose.
