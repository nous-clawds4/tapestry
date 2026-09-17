# ADR 0003: Inverse queue — extend the adoption endpoint, classify at the seam, one page hosts the loop

**Status:** Accepted
**Date:** 2026-08-06
**Story:** `engineering-team/stories/shared-concepts-adoption/3-inverse-queue-publish-candidates.md`

## Context

F2 is a query inversion over shipped machinery: population = TA-authored headers with no b and
cross-author usage; accept = self-declare; decline = the F5 sentinel. Facts established at recon
(all surfaces read in-session; orientation standing; no concept definitions involved):

- The adoption endpoint's first scan already reads **all** 39998 headers and *discards* the
  TA-authored ones at projection (`src/api/adoption/index.js`).
- `strfryScanStream` takes any filter — the `#b` form verified against the live CLI.
- `src/lib/adoptionQueue.js` is **zero-require by its own U8 pin**; b-value semantics live in
  `src/lib/bValueForms.js` (the single owner).
- The F1 page's `doDeclare`/`doDefer` logic lives inline in `ui/src/components/DispositionPanel.jsx`.
- F1's H-suite pins the queue response as *arrays present* — **additive keys are safe**.

## Options considered

### Option A — extend `GET /api/adoption-queue`; classification at the handler seam; a sibling pure function; the page grows a three-view switch; shared action helpers extracted

1. **Endpoint (additive):** the response gains `publishCandidates` and `deferredInUse`;
   `nominations`/`declined` byte-compatible. Scan deltas: the headers scan projects **both**
   populations (foreign, and TA-authored **with their b tags**); the `#z` carrier scan covers the
   **union** of foreign and my coords in one filter; one **new `#b: [myCoords]` scan**
   (cross-author affiliation evidence — sentinel values can never match a coord, so no
   special-casing); registry/ledger scans unchanged.
2. **Classification at the seam:** the handler maps each of my headers through `dispositionOf`
   (bValueForms) to a `bState: 'none' | 'deferred' | 'real'` **before** the pure core sees it —
   both libs stay zero-require, and b semantics never leak into queue arithmetic.
3. **Sibling pure function** in adoptionQueue.js:
   `computePublishCandidates({myHeaders, zCarriers, bCarriers, taPubkey})` →
   `{candidates, deferredInUse}` — cross-author-only counts kept **distinguishable**
   (`filingEvents/filingAuthors` from z; `affiliationEvents/affiliationAuthors` from b);
   `bState 'none'` ∧ usage → candidate; `'deferred'` ∧ usage → deferredInUse; `'real'` → excluded
   (dispositioned); sort by total usage.
4. **UI:** the page's boolean `showDeclined` becomes a three-way view control (*Theirs to adopt* /
   *Mine to publish* / *Declined*); the mine view renders candidates with both evidence kinds and
   two actions; beneath it the **collapsed reveal** ("N kept-private headers have active usage —
   show") expands to deferred-in-use rows whose action is *Submit as a Shared Concept* (the
   sentinel-stripping un-defer path). **Extract `ui/src/utils/dispositionActions.js`** —
   `declareAndBroadcast(handle)`, `defer(handle)` — re-pointing DispositionPanel
   behavior-preserving, so the broadcast-fallback strings live once.
5. **F1 view untouched** (the story's AC); no new route.

- **Pros:** one fetch serves the whole loop; the discarded-headers waste becomes the feature's
  input; b semantics stay single-owned; F1's contract untouched by construction; both write paths
  already shipped and gated.
- **Cons:** the endpoint's response grows (accepted — one surface, one assembly); the union `#z`
  filter doubles that scan's result size (streamed, projected slim — immune to the #500 class by
  design).

### Option B — sibling `GET /api/publish-candidates`

- **Cons (dispositive):** re-scans headers and carriers the adoption endpoint just read, per page
  load, for a view that lives on the same page. **Rejected.**

### Option C — client-side assembly from existing instruments

- **Cons (dispositive):** re-imports the chunked-scan pattern the streaming endpoint just
  obsoleted; the arithmetic leaves its tested single owner. **Rejected.**

## Decision

**Option A.**

## Consequences

- **Enables:** the complete adoption loop on one page; F3 inherits one endpoint carrying both
  populations to trust-weight.
- **Constrains:** response-shape additions stay additive (F1's suite pins the existing arrays).
- **Debt:** none new.
- **Firmware reinstall required? No.** UI build at deploy, per standard.

## Implementation notes

- **`src/lib/adoptionQueue.js`** — add `computePublishCandidates` (pure; exported); `computeQueue`
  untouched.
- **`src/api/adoption/index.js`** — headers scan projects both lists (mine keep `b` tags in
  `keepTags`); union `#z` scan; new `#b` scan projected to `{pubkey, id, tags:[b-tags]}`; classify
  mine via `dispositionOf` at the seam; response
  `{success, nominations, declined, publishCandidates, deferredInUse}`.
- **`ui/src/utils/dispositionActions.js`** (new) — the two action helpers with the existing
  message strings; **`DispositionPanel.jsx`** re-points (behavior-preserving);
  **`AdoptionQueue.jsx`** — three-view control, mine table, collapsed reveal, empty state per AC.
- **Test-surface guidance (Tester's lane):**
  - **U** — population/exclusion per bState; both evidence kinds counted cross-author-only and
    distinguishably; deferred-in-use split; sorting; empty inputs.
  - **S** — additive response keys in the handler; the three-view control + reveal present;
    `dispositionActions.js` exists and the panel imports it; no new route (name-based).
  - **H** — my-header fixture (bare, stable d-tag, the `nextStamp` discipline — OPEN.md #144) +
    foreign z-carrier + foreign b-carrier (F1's throwaway key) → candidate with both evidence
    kinds; self-declare → leaves + header carries self-b; second fixture: defer → leaves + appears
    in deferredInUse; submit-from-reveal → sentinel stripped; F1's nominations/declined behavior
    unregressed; teardown bare.

## Out of scope

F3 trust-weighting; any F1-view or F5-surface change; wired-header nomination; batch actions.
