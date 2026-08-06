# ADR 0001: b-coverage audit + guided disposition — one pure value-form core, sibling owner-only endpoints on the selfDeclare spine, coverage in the existing ConceptList query, no new route

**Status:** Accepted
**Date:** 2026-08-06
**Story:** `engineering-team/stories/shared-concepts-adoption/1-b-coverage-audit-and-disposition.md`

## Context

The story ships the owner's three-action disposition discipline over concept headers, carrying the
W16 ruling (owner, 2026-08-06): the reserved sentinel `["b", "b-tag-deferred"]`. Facts established
at recon (stack live at `:7778`, TA runtime-resolved):

- **ConceptList** (`ui/src/pages/concepts/ConceptList.jsx:11-57`) is backed by one `useCypher`
  QUERY returning per-header rows **including `author`**, merged with `/api/audit/concepts-summary`
  health data; an author filter already exists. Adding coverage = one `OPTIONAL MATCH` collecting
  `b`-tag values into the same QUERY.
- **selfDeclare** (`src/api/concept/selfDeclare.js`) is the action template: `requireOwner` at
  `src/api/index.js:587`; provenance guard (TA-authored headers only); append-only re-sign;
  `loadTAKey → signAndFinalize → publishToStrfry → importEventDirect` (all from
  `normalize/helpers` — the OPEN.md #142 "good copy"); returns the signed event for client-side
  `publishToRelays` (`ui/src/pages/concepts/ConceptDetail.jsx:55-70`).
- **The phantom-node hazard has exactly one home.** `src/api/neo4j/eventSync.js:258-278` MERGEs a
  `NostrEvent {uuid: tag[1]}` for **any** truthy `b` value — the sentinel would mint a phantom node
  there. `helpers.importEventDirect` (`src/api/normalize/helpers.js:64-111`) derives **no** b-edges
  (writes generic tag nodes only, delete-and-recreate per import — so re-disposition naturally
  replaces graph tag state). One guard site; coverage reads are derivation-independent.
- **Tag nodes are generic** (`type` + `value` for every tag, both paths) — the sentinel is
  queryable in Neo4j without any edge existing.
- **First-person scope** (BIBLE §31): the prompt set is **TA-authored headers with no `b`**;
  foreign headers render coverage read-only (provenance: never re-sign another author's event —
  selfDeclare's shipped rule).
- **Constraints:** no new lint/build tooling; OPEN.md #143 pins `App.jsx`'s route count — this
  design deliberately **adds no route**; OPEN.md #142 — no new divergent sign/publish/import
  copies.

## Options considered

### Option A — pure value-form core + sibling endpoints + coverage in the existing query + inline panel (no route)

1. **`src/lib/bValueForms.js`** (zero-require CJS, the house pure-core pattern) — single owner of
   the wire ruling in code: `SENTINEL = 'b-tag-deferred'`,
   `classifyBValue(v) → 'a-tag' | 'event-id' | 'sentinel' | 'malformed'`,
   `dispositionOf(bValues, selfCoord) → {wired, selfDeclared, deferred}`.
2. **Chokepoint guard:** the eventSync b-branch derives `INHERITS_FROM`/`REFERENCES` **only** for
   `a-tag`/`event-id` forms (via the lib) — sentinel *and* malformed values still get their plain
   tag node, never a MERGE'd phantom. The general guard *is* the spec's closed value-form list, and
   hardens against garbage `b`s from any source.
3. **Endpoints** (both `requireOwner`, registered beside `:587`; both on the helpers spine; thin
   handlers over a shared header-fetch/re-sign core in a new `src/api/concept/bDisposition.js`):
   - `POST /api/concept/:handle/b-append {target}` — validates a-tag form + `target ≠ self-coord`
     (self is selfDeclare's lane); appends `["b", target, "pointer"]` (never inherit from this
     surface), **stripping any sentinel**; append-only for real tags; idempotent on repeat target;
     returns the signed event for community broadcast.
   - `POST /api/concept/:handle/b-defer {}` — appends the sentinel **only when no real `b` exists**
     (domain refusal otherwise); idempotent when already deferred; response never invites
     broadcast.
   - `selfDeclare.js` gains one carve-out: its `newTags` build strips the sentinel before appending
     the self-coord (comment cites this ADR — append-only protects real correspondence claims; the
     sentinel is a disposition marker).
4. **UI:** ConceptList QUERY gains `collect(DISTINCT bt.value) AS bValues`; a **Disposition**
   column renders chips (wired / self-declared / deliberately private / — ) via a thin UI mirror
   `ui/src/utils/bDisposition.js` (accepted dual-home of the constant+classifier, both pinned by
   tests); an **"Undispositioned (mine)"** filter (TA-authored ∧ no b, the §31 prompt set); each
   such row opens an inline **DispositionPanel** (component, **no new route — `App.jsx`
   untouched**) offering the three actions, with "Save & next" advancing to the next
   undispositioned row. Wire-external's target picker: a `useCommunitySharedConcepts` hook
   extracted from `ui/src/pages/shared-concepts/SelfDeclaredSharedConcepts.jsx` (the S1
   community-relay fetch) + a free-text a-tag fallback; wire/declare then `publishToRelays` per the
   ConceptDetail pattern; defer is local-only.
5. **Specs:** `protocols/drafts/inherit-from.md` value-forms amendment (a-tag | event id | **the
   reserved literal `b-tag-deferred`**, exactly one string, no variants); a "Deliberate
   non-affiliation" ruling paragraph in `protocols/drafts/shared-concepts.md`; worksheet **W16 →
   Graduated**.

- **Pros:** one code owner for the ruling; one guard site covering every ingest; coverage rides a
  query the page already makes (no N-scan); zero new routes (leaves #143 where it is); endpoints
  are per-action auditable with identical gating; F1 inherits `b-append` unchanged.
- **Cons:** the sentinel literal lives in two runtimes (server lib + UI util) — accepted,
  test-pinned; the eventSync-vs-helpers derivation divergence remains (pre-existing, #142-adjacent,
  documented not expanded).

### Option B — client-side coverage via strfry scans (the ActiveZTags pattern)

- **Cons (dispositive):** N headers × scan requests for data Neo4j already holds on nodes the page
  already queries; duplicates the chunking machinery for no gain; leaves coverage blind to
  graph-only state. **Rejected.**

### Option C — one polymorphic `POST /disposition {action}` endpoint

- **Cons (dispositive):** action-string dispatch obscures per-action validation (defer's
  no-real-b precondition vs append's target-form check), makes the security surface harder to pin
  structurally, and complicates F1's clean reuse of exactly the append primitive. **Rejected.**

### Option D — literal-only skip at the chokepoint

- **Cons (dispositive):** guards one string while every other malformed value keeps minting
  phantoms; the value-form guard implements the very form-closure the spec amendment ratifies.
  **Rejected.**

## Decision

**Option A.** The wire ruling gets one code owner (`bValueForms.js`), the hazard gets one guard at
its only site, the audit gets its data from the query the page already runs, and the flow adds no
route.

## Consequences

- **Enables:** F1 consumes `b-append` as-is; every b-surface gains a principled skip rule; the
  audit turns header inventory into community-dictionary supply (the owner's stated intent).
- **Constrains:** future `b` value forms must amend the lib + spec together; the sentinel literal
  is dual-homed (server/UI), pinned identical by a structural test.
- **Debt:** the two-import-path derivation divergence stays (#142-adjacent; consolidating it is
  that row's business, not this story's).
- **Firmware reinstall required?** **No** — no concept definitions change. **UI build required**
  (Vite) at deploy, per the standard flow.

## Implementation notes

- **New `src/lib/bValueForms.js`** — pure CJS, zero requires: `SENTINEL`,
  `A_TAG_RE = /^\d+:[0-9a-f]{64}:.+$/`, `EVENT_ID_RE = /^[0-9a-f]{64}$/`, `classifyBValue`,
  `dispositionOf(bValues, selfCoord)`.
- **`src/api/neo4j/eventSync.js:258`** — wrap the existing branch:
  `const form = classifyBValue(tag[1]); if (form === 'a-tag' || form === 'event-id') { …existing
  inherit/pointer derivation… }` — plain tag-node creation above stays untouched for all values.
- **New `src/api/concept/bDisposition.js`** — `resolveLatestOwnHeader(handle)` (the selfDeclare
  scan+latest+provenance-guard shape), `resignWithTags(header, newTags)` (helpers spine),
  `handleBAppend`, `handleBDefer`. selfDeclare MAY re-point its internal scan here only if the diff
  stays small; otherwise its copy stands (pre-existing).
- **`src/api/concept/selfDeclare.js:86`** — the `newTags` build filters
  `t[0]==='b' && t[1]===SENTINEL` before appending (requires the lib).
- **`src/api/index.js:587` area** — register both routes with `requireOwner`, comment citing this
  ADR.
- **`ui/src/pages/concepts/ConceptList.jsx`** — QUERY
  `OPTIONAL MATCH (h)-[:HAS_TAG]->(bt:NostrEventTag {type:'b'})` +
  `collect(DISTINCT bt.value) AS bValues`; Disposition column (chips), filter, panel wiring. **New
  `ui/src/components/DispositionPanel.jsx`** (or colocated) + **`ui/src/utils/bDisposition.js`**
  (UI mirror) + **`ui/src/hooks/useCommunitySharedConcepts.js`** (extraction;
  `SelfDeclaredSharedConcepts.jsx` re-points to it — behavior-preserving).
- **b-surface skips:** `ui/src/pages/shared-concepts/ActiveBTags.jsx`, `BTagDetail.jsx`, the
  SelfDeclared matcher — skip `SENTINEL` by name (import the UI util).
- **Specs:** inherit-from § "The `b` tag" value forms + reserved-literal sentence; shared-concepts
  new short § "Deliberate non-affiliation"; worksheet W16 status flip + Resolution (the W15
  format).
- **Test-surface guidance (Tester's lane):**
  - **U** — `classifyBValue` (all four classes; near-misses: 63/65-hex, `kind:pubkey:` with empty
    d-tag), `dispositionOf` (each state; multi-b combinations; sentinel+real-b never co-derived),
    strip logic.
  - **S** — both routes registered with `requireOwner`; eventSync derivation structurally bounded
    to the two valid forms; the sentinel literal byte-identical in `src/lib/bValueForms.js` +
    `ui/src/utils/bDisposition.js` + both spec files; **no absolute route-count assertions on
    App.jsx** (the #143 lesson — assert absence of disposition-named routes instead).
  - **H** — defer → header carries exactly one sentinel, re-defer idempotent, defer-with-real-b
    refused; declare-after-defer → sentinel gone, self-coord present; b-append foreign target →
    tag present (+ REFERENCES via the eventSync path where exercisable); coverage QUERY returns the
    four states; non-owner callers → 403/401.
  - **Playwright** — optional panel walk at the Tester's discretion.

## Out of scope

F1's queue and registry records; inherit-typed `b` authoring from any of these surfaces;
OPEN.md #143's re-pin; #142's full consolidation; any community-visible standalone statement beyond
the sentinel; batch disposition.
