# Build Audit: Seeding — making it easy to offer a concept, and honest about whether it landed

**Book:** `shared-concepts-seeding`
**Opened:** 2026-08-10 · **Closed:** 2026-08-11
**Provenance:** Acceptance-frame (no PRD), ratified in-session at open
**Confidence at close:** **High** — the frame was written before the work, all four stories carry
story + review artifacts, and every frame bullet was verified on the rendered page in production.

## 1. What shipped

Four stories, all Done, all reviewed PASS, **all live in production**. The book took the sharing
capability that already existed and made it *findable* and *truthful* — it deliberately did not
rebuild the act of sharing.

| # | Story | Verdict | In prod |
|---|---|---|---|
| 1 | `honest-broadcast-reporting` | PASS | ✅ |
| 2 | `retire-the-offering-vocabulary` | PASS *(1 kick-back)* | ✅ |
| 3 | `disposition-filter-on-concepts` | PASS *(1 kick-back)* | ✅ |
| 4 | `share-from-shared-by-me` | PASS | ✅ |

## 2. Epics & stories rolled up

### Epic: `shared-concepts-seeding`

1. **honest-broadcast-reporting** — `declareAndBroadcast` awaited `publishToRelays` and discarded
   its result, then reported "Submitted as a shared concept" whether or not anything reached the
   relay. The outcome rule was extracted to `src/lib/broadcastOutcome.js` and consumed through the
   `@tapestry/broadcast-outcome` alias by `ui/src/utils/dispositionActions.js:2`.
2. **retire-the-offering-vocabulary** — "offering" named a category the owner had ruled out on
   2026-08-06: a concept put forward but not published. Retired in favour of **shared** and
   **didn't reach the community**, the latter a failure to retry rather than a resting state.
3. **disposition-filter-on-concepts** — the Concepts list gained a state selector; *Not yet shared
   (mine)* composes with the author filter. ADR 0001.
4. **share-from-shared-by-me** — a route from Shared by me into that filtered list, and a Concepts
   page whose filter travels in the address so the destination arrives narrowed. ADR 0002.

## 3. As-built inventory

**New modules**
- `src/lib/broadcastOutcome.js` — `classifyBroadcast` + `outcomeMessage`; the single home for "what
  did this publish result mean".
- `ui/src/utils/conceptStateFilter.js` — `STATES`, `needsPublication`, `normalizeState`,
  `matchesState`, `summarizeNotYetShared`, `unconfirmedCount`. Pure, dependency-free.

**Changed surfaces**
- `ui/src/pages/concepts/ConceptList.jsx` — state selector replacing a single checkbox; publication
  fetched lazily; filter state carried in the address.
- `ui/src/pages/shared-concepts/SharedByMe.jsx` — renamed from the "offering" era, tri-state
  reporting, the route and its count, revised empty state.
- `ui/src/utils/dispositionActions.js` — honest outcome reporting.

**New suites** — `honest-broadcast-reporting` (15), `retire-offering-vocabulary` (10),
`not-yet-shared-filter` (17), `share-from-shared-by-me` (15). All registered; all stack-free except
where noted, so all gate in CI.

**ADRs** — `0001` (the filter joins the bulk sharing answer), `0002` (the route and its count reuse
the shipped predicate). Both turn on the same argument: one definition, one home, so two surfaces
cannot contradict each other.

## 4. Deviations from intent

- **The frame's bullet 1 was reduced in scope, deliberately.** "Share a concept from the page about
  what she has shared" shipped as a **signpost**, not as a second list with its own share control.
  Ratified in `/discuss` 2026-08-11: hosting the list there would duplicate the Concepts page and
  make one surface answer two questions. The owner explicitly preferred the signpost after both
  options were laid out. **Not a silent narrowing** — the errand still completes, one page over.
- **The queued intake entry for story #3 was wrong and was overruled.** It recommended filtering on
  the row's local disposition chip ("cheapest — the data is already on every row"). That predated
  this book's vocabulary settlement; following it would have let the Concepts page and Shared by me
  give contradicting answers to "have I shared this?". Recorded in story #3's Background.
- **ADR 0001 said "all changes in one file"; two shipped.** Test Design showed a predicate living
  inside a React component can only be checked by source grep, which cannot distinguish a correct
  predicate from a plausible one. Ratified at the Phase-3 gate and recorded in the ADR.
- **ADR 0002 implied two exports; the test plan named them.** `summarizeNotYetShared` and
  `normalizeState` were described in ADR prose but not named as API. Surfaced in the test plan and
  ratified at the gate.
- **Nothing in the frame was dropped.** All three bullets met.

## 5. Quality state at close

- Full `npm test` **Overall PASS** at close, `strfry-router` running and unquiesced, zero `FAIL`
  lines.
- `scripts/harness-lint.sh` clean.
- Two Review kick-backs, both on **honesty of what the UI claimed**, neither on mechanism:
  story #2 shipped a page named "Shared by others" that listed the instance's own shares, and a
  count reading "4 shared" over a row that had not reached the community; story #3 rendered an empty
  *Shared (mine)* list during a relay outage, silently asserting "you have shared nothing".
- **Every frame bullet was verified on a rendered page, on three corpora** — local (45 waiting),
  staging (35), production (33) — each number matching its own destination row count.
- **Out-of-band:** OPEN.md row 150 (the six-sighting strfry write-assertion flake) was fixed during
  this book under its own epic `test-suite-hermeticity`, and is live. Not part of this frame; it
  made every gate in the book's second half cheaper.

## 6. Carry-forward register

**Product-facing** (also in `prd-seed.md`)

| Item | Source |
|---|---|
| **Bulk share** — select many and share in one action. The owner's stated goal ("everything in firmware needs a community shared concept… the rest in due time") makes a 33-item queue a 33-trip errand today. | Story #4 Out of scope |
| **A concept declared-but-unpublished has no in-place retry** on the Concepts list — it shows its state and sends you to the concept page. | Story #4 Out of scope |
| **Adoption is gated at the other end too** — a freshly shared concept never gets *nominated* on other instances, because nominations derive from z-tag usage and a new offering has none. | Book scope notes, unresolved |

**Engineering-facing**

| Item | Source | Live? |
|---|---|---|
| `ConceptDetail.jsx:114-122` still holds an inline copy of the outcome rule; `dispositionActions.js` uses the extracted module. Two homes, and the review recorded they already disagree. | Review #1 NB-1 | **Yes — verified at close** |
| `SharedByMe.jsx:81` guards on `population.length > 0`, which cannot tell a still-loading `[]` from a genuinely empty one. `useCypher` already returns `loading`. Observed in production as a visible no-number flicker. | Review #4 NB-1 | Yes |
| `unconfirmedCount`'s JSDoc now documents `summarizeNotYetShared` — the new function was inserted between the block and its function. | Review #4 NB-2 | Yes |
| `SharedByMe.jsx:174` empty-state copy references "the link above" in a state where the link is replaced by the clear message. | Review #4 NB-3 | Yes |
| `ConceptList.jsx` — a failed publication fetch cannot be retried without a reload; the outage notice's *wording* still branches on a state literal though its trigger no longer does. | Review #3 NB-2, NB-4 | Yes |
| `SelfDeclaredDetail.jsx` filename no longer matches its page's name. | Review #2 NB-1 | Yes |
| **Resolved during the book:** `ctx.relayOk` was carried but unread (Review #3 NB-3) — `summarizeNotYetShared` now reads it. | — | Closed |

**Not observable anywhere.** *Not yet shared* and *Undispositioned* select identical sets on all
three deployments, because no corpus contains a concept declared locally but absent from the relay —
the population story #1 exists to surface. The distinction is proven at predicate level only. A
fixture instance carrying one would let the book's central distinction be seen rather than argued.

## 7. Process findings (harness)

**Disposition rule: every lesson ends in exactly one of — ratified harness commit · OPEN.md `meta`
row · recorded decline. No fourth state.**

| # | Finding | Disposition |
|---|---|---|
| 1 | **Tests over a pure module do not reach the call site, and a test written for a known defect may not fail against it.** Three times in this book: story #3's `U10` passed against the broken page (the defect was in the page gate, not the util); story #4's first `S2` grepped for tokens that already existed and passed against code with no validation at all; story #4's `U6` is green while `SharedByMe.jsx:81` collapses the very distinction it protects. | **OPEN.md row 169** (new) |
| 2 | **The deploy chain is blocked when the network path filters a deploy target.** `staging.brainstorm.world`, `brainstorm.world` and `scores.brainstorm.world` are blocked by xFi Advanced Security via `safebrowse.io`; the safe-to-merge gate correctly refused to merge (exit 2, no usable answer) and the promotion halted. Recognising it took a full diagnostic pass. | **OPEN.md row 170** (new) |
| 3 | **A GitHub required check-run stuck `in_progress` after its run reported `completed/success`,** blocking a production promotion until the job was re-run. | **DECLINED** — one occurrence, external to this repo, and the remedy (`gh run rerun <id>`) is recorded here and in the session. A ledger row for a third-party flake seen once would add noise to an inbox already at 54 open lessons. Revisit if it recurs. |
| 4 | **Row 150's flake was fixed rather than endured.** Six sightings, ~83% spurious-red measured at intake, a router stop/start per gate. Fixed under `test-suite-hermeticity` #1; row 150 flipped DONE with its "quiesce and re-run" guidance explicitly withdrawn. | **Ratified harness commit** (`45590ccd`, promoted `2128de24`) |
| 5 | **Kick-back to Implementation requiring a *new* test has no lane** (`workflows/4-implementation.md:38` forbids modifying tests to make them pass; adding a test that pins a new defect is the opposite). Reasoned out correctly in the moment but written nowhere. | **Folded into OPEN.md row 167** — same shape, same fix, same file |
| 6 | **The Tier 4 visual lost its owner across a kick-back** (story #2) and was the only guard that caught both blocking findings. | **Already OPEN.md row 160**, opened during this book |

### Escalation, for the owner

`/whats-open` reports **55 open harness lessons, oldest 40 days**, past both triggers, so the rule
says propose a harness story at triage. Two observations before the proposal, because the second
matters more than the first.

**The banner may be the defect.** It fires at "≥3 open or >30 days" — thresholds set when the ledger
was small and now permanently tripped. The owner has seen it every session for weeks. A warning that
is always on is not a warning. **Retuning the thresholds so the banner can go quiet — or escalating
on newly-aged rows rather than the standing total — is plausibly worth more than triaging the rows
it points at.**

**Most `meta` rows are not debt.** They are lessons recorded so a future session does not repeat
them, and in that form they work: row 150 sat for four days and was fixed because its record was good
enough to act on; row 160 changed how this book's verifications were run. They sit in a column
labelled "open", which implies an obligation that mostly is not one.

**Proposal — a one-time sort, not a recurring duty.** A story (working title only; **no such command
exists and none is expected of the owner**) that reads the ledger's `meta` rows once and sorts them
into (a) *dead* — describing harness behaviour that has since changed, (b) *duplicate* — folded into
a surviving row, (c) *live* — kept with a named next action. Paired with the threshold change above,
it would let the escalation mean something again. **Not created here; needs owner ratification, and
declining it is a reasonable answer** — changing nothing loses none of what the ledger currently
provides.

### Surfaced while answering the owner at the close gate, recorded because nothing else records it

Neither of these belongs to this book; both are real and unowned, and the close is the first time
anyone has counted them.

- **5 handoff docs still marked `🔴 OPEN`** (`docs/*HANDOFF*.md`). That marker means a previous
  session left instructions nobody picked up. `/whats-open` lists them every run; none has been
  dispositioned.
- **26 remote branches unmerged into `origin/main`.** Most are likely merged work whose branches were
  never deleted, but no one has checked, and a stale branch list makes the genuinely-unmerged ones
  invisible.

**Disposition: neither gets a ledger row here.** Both are already surfaced by `/whats-open` on every
run, so a row would duplicate a working surface rather than add one — the same reasoning that
declined finding 3. Recorded here so the counts exist somewhere, and so a future close can say
whether they moved.
