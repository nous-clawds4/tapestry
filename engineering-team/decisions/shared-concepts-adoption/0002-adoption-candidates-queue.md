# ADR 0002: Adoption queue — pure arithmetic core + server-assembled read + an instance-private disposition ledger as a runtime concept

**Status:** Accepted
**Date:** 2026-08-06
**Story:** `engineering-team/stories/shared-concepts-adoption/2-adoption-candidates-queue.md`

## Context

F1 turns the S3 ∖ S2a arithmetic into a ratification surface. Facts at recon (stack live at
`:7778`, drift 0):

- **The observation base is client-side today** (`ui/src/pages/shared-concepts/ActiveZTags.jsx`):
  foreign headers enumerated, then chunked `#z` scans through the GET query string (the nginx
  URI-limit workaround, PR #493). Server-side `strfryScan`
  (`src/api/concept/bDisposition.js`) has **no URI limit** — direct CLI exec takes arbitrary
  filters.
- **Both adoption actions exist:** F5's `b-append` (gated, loopback-operable) and `create-element`
  (`src/api/normalize/index.js:1760`) — which uses caller-provided `json` **as-is** (additive
  fields ride free), signs as the TA, takes name-derived/nonce/caller d-tags, but **refuses
  same-name re-mints** (the dupe check) and carries no in-handler gate (default-deny covers
  remote; the browser path is how `ui/src/pages/shared-concepts/New.jsx` ships today).
- **The ensure idiom is available where producers live:** `invokeNormalizeHandler` +
  `handleCreateConcept`/`handleSaveSchema` (`src/api/normalize/index.js:2482-2507`) — all
  module-internal; normalize exports only `registerNormalizeRoutes`, so a producer that needs them
  lives **in that module** (the established pattern, second-brain ADRs 0004–0008).
- **The registry Index** lists elements z-tagged to `shared-concept` — ledger records stored *in*
  the registry would clutter the community-facing directory and the SelfDeclared "record"
  indicator.
- **F5's suite S4** guards App.jsx routes by the regex `/disposition|b-coverage|coverage-audit/i` —
  a route named `adoption-queue` does not match it (verified); the #143 absolute-count pin is
  already broken and stays that row's business.
- **Doctrine:** declines are first-person stances about *foreign* events (BIBLE §31) — local by
  construction, dated/attributed per the intake's house-style line for materialized state.

## Options considered

### Option A — pure arithmetic core + `GET /api/adoption-queue` + a sibling runtime concept for the disposition ledger

1. **`src/lib/adoptionQueue.js`** (zero-require CJS):
   `computeQueue({foreignHeaders, zCarriers, myBTargets, registryRecords, dispositionRecords,
   taPubkey})` → `{nominations, declined}`. The whole arithmetic in one testable place: S3 base
   (cross-author usage only — self-filed excluded, the PR #494 rule), **minus** wired (any of my b
   targets), **minus** recognized (registry-record identifiers match), **minus** latest-disposition
   = `declined`; per-nomination `{coord, name, author, eventCount, authorCount, usedByMe}`;
   `declined` = latest-per-target declined records (the Declined view's data). Latest-per-target by
   `created_at` (the monotonic-bump lesson noted).
2. **Queue read: `GET /api/adoption-queue`** — new small module `src/api/adoption/index.js`; five
   direct `strfryScan`s (foreign 39998 headers; `#z` carriers for their coords — no chunking
   needed server-side; TA-authored b-carriers for S2a; registry elements; ledger elements) piped
   through the core. **Public read** (sibling-instrument posture); no writes.
3. **The disposition ledger: a runtime-created sibling concept** — name `adoption disposition`,
   slug `adoption-disposition`, handle `39998:<TA>:adoption-disposition` (runtime-resolved;
   **never firmware**). Records are **append-only, dated, attributed**: `{name, slug, target
   (foreign a-tag), disposition: 'declined' | 'requeued', decidedOn}`; newest-per-target wins;
   un-decline mints `requeued` (nothing is ever deleted or republished — sidesteps
   `create-element`'s same-name refusal *and* honors the dated-derivations style). Recognition
   needs **no ledger record** — a registry record is its own evidence.
4. **Disposition producer: `POST /api/normalize/adoption-disposition`** `{target, disposition}` —
   lives in normalize/index.js beside its siblings; **F5-style gate first-line**
   (`isOwner || localTrusted`); validates `target` a-tag form (the F5 lib) + the two-word
   disposition enum; `ensureAdoptionDispositionConcept()` (the ensure idiom, lazily on first use);
   mints via `invokeNormalizeHandler(handleCreateElement, …)` with `random: true` d-tag and a
   dated unique element name (`adoption: <slug> — <disposition> <ISO-datetime>`).
5. **Actions from the page:** Adopt = twin picker (TA-authored 39998s via the public scan) →
   `POST b-append` on the twin → `publishToRelays` (the F5 panel pattern); Recognize =
   `create-element` exactly as New.jsx calls it, identifiers prefilled (no new surface, existing
   posture); Decline / Un-decline = the new producer.
6. **UI:** `ui/src/pages/shared-concepts/AdoptionQueue.jsx` + route `adoption-queue` + nav entry;
   queue table (usage counts, used-by-me badge, per-row action panel) + a Declined toggle view;
   empty state per the AC.

- **Pros:** the arithmetic is one pure function (U-tested exhaustively, H-tested through the
  endpoint); server assembly kills the chunking problem instead of duplicating it; the registry
  stays community-facing (zero UI skip rules); the ledger is exactly what §31 calls
  instance-private stance history; every write path reuses a shipped, gated primitive or the
  co-located producer idiom; F3 later consumes the same endpoint.
- **Cons:** another runtime concept (accepted — the drill-record precedent; ensure-on-first-use);
  the ledger grows append-only (bounded by owner actions; dated names make any future sweep
  trivial).

### Option B — ledger inside the registry concept (a `disposition` field on registry elements)

- **Cons (dispositive):** every registry surface (Index, the SelfDeclared "record" indicator,
  F5's picker) must learn to skip declined/requeued records — three-plus UI touches to protect the
  community-facing directory from private stance rows; conflates "the community should know I
  recognize this" with "my queue should stop nagging me"; supersede-by-republish fights
  `create-element`'s same-name refusal. **Rejected.**

### Option C — client-side assembly on the z-tags machinery + brain records for declines

- **Cons (dispositive):** the queue arithmetic — the feature's core — becomes browser-only and
  H-untestable; the chunked-scan workaround gets a second consumer instead of being obsoleted;
  brain records require a served goal (the drill-record lesson: planting one violates §5.9/§7.3).
  **Rejected.**

## Decision

**Option A.** One pure core owns the arithmetic; the server owns assembly; recognition stays a
registry act; declines live in an instance-private, append-only, dated ledger under a runtime
concept; every mutation reuses a shipped primitive or the producer idiom in its established home.

## Consequences

- **Enables:** F3 reads the same endpoint and refines the same population; the ledger pattern
  (dated stance records about foreign objects) is reusable for any future foreign-object
  disposition; the queue is fully H-testable via loopback.
- **Constrains:** the ledger concept's schema changes go through `save-schema` re-ensures;
  `computeQueue`'s exclusion rules are the single semantics — UI must not re-derive.
- **Debt:** none new; the create-element gate posture is pre-existing and untouched (noted for a
  future security sweep).
- **Firmware reinstall required? No** — the new concept is runtime-created (ensure idiom), never
  firmware-seeded. **UI build required** at deploy.

## Implementation notes

- **New `src/lib/adoptionQueue.js`** — pure CJS, zero requires: `computeQueue(inputs)`; helpers
  `latestPerTarget(records)`, `usageOf(carriers, coord, headerAuthor)` (cross-author counts +
  usedByMe given `taPubkey`).
- **New `src/api/adoption/index.js`** — `registerAdoptionRoutes(app)`: `GET /api/adoption-queue`;
  five `strfryScan`s (import the helper from `../concept/bDisposition.js` — no new copy); registry
  scan = `{kinds:[39999], '#z':[<registry handle>]}`, ledger scan likewise with the ledger handle;
  parse registry `identifiers` tolerant of malformed JSON (the SelfDeclared pattern); wire into
  `src/api/index.js`.
- **`src/api/normalize/index.js`** — `ADOPTION_DISPOSITION_*` constants +
  `ADOPTION_DISPOSITION_SCHEMA` (section `adoptionDisposition`; required
  `[name, slug, target, disposition, decidedOn]`); `resolveAdoptionDispositionConcept` /
  `ensureAdoptionDispositionConcept` (structural copy of the resource ensure at `:2503-2507`);
  `handleAdoptionDisposition` (gate → validate target via `classifyBValue === 'a-tag'` + enum →
  ensure → mint via `invokeNormalizeHandler(handleCreateElement, {concept, name: dated,
  random: true, json})`); register in `registerNormalizeRoutes`.
- **UI** — `AdoptionQueue.jsx` (fetch `/api/adoption-queue`; table + Declined toggle; per-row
  panel: twin picker fed by `/api/strfry/scan` with `{kinds:[39998], authors:[<taPubkey from
  useConfig>]}`, Adopt → `b-append` + `publishToRelays`, Recognize → `create-element` with the
  `sharedConcept` json as New.jsx builds it, Decline/Un-decline → the producer); route
  `adoption-queue` + nav under Shared Concepts (matches neither the F5-S4 regex nor any absolute
  pin).
- **Test-surface guidance (Tester's lane):**
  - **U** — every exclusion rule independently (wired / recognized / declined / self-filed-only
    usage); latest-per-target (declined→requeued sequences, same-second ties); counts + usedByMe;
    empty inputs.
  - **S** — routes registered (`adoption-queue` GET ungated; producer gated with the F5 pair);
    ensure + schema constants present; nav + route entries (absence-style assertions only); the
    ledger concept never appears under `firmware/`.
  - **H** — fixture foreign header + cross-author z-carrier (fixture keys, stable d-tags) →
    nomination appears with correct counts; decline → leaves queue + Declined lists it; requeue →
    returns; b-append a twin → leaves queue; registry record → leaves queue; remote
    unauthenticated producer POST → 401; full teardown.
- **Untouched:** ActiveZTags, the registry Index, SelfDeclared, F5's panel and suite,
  `create-element`, all F5 server code except the shared `strfryScan` import.

## Out of scope

F3 thresholds/dictionary; F2; batch actions; any wire marker for declines; create-element gate
hardening (pre-existing posture, noted); ledger export/backup semantics (joins the ADR-0008
families question when F3 materializes derived artifacts).
