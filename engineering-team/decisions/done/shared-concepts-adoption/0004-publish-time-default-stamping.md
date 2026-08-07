# ADR 0004: Stamping — finish the ADR-0003 conditional for pins/TLs; a pure pointer-target selector in the b-semantics home; create-element consults the graph

**Status:** Accepted
**Date:** 2026-08-06
**Story:** `engineering-team/stories/shared-concepts-adoption/4-publish-time-default-stamping.md`

## Context

Facts at recon (stack live; orientation standing): the **profile-tag writer is the finished
pattern** — `['z', LEGACY]` + `hasLocalTa ? ['z', '39998:<localTa>:nostr-user-tag']`
(`ui/src/utils/publishProfileTag.js:83-84`, the W11 shape). The **pin writer** builds
`['z', TAG_PINNING_HANDLE]` only, at two sites (`ui/src/utils/publishTagPin.js:130`, `:368`), with
the runtime TA already documented as `useConfig().taPubkey` in its header comment. The **TL
writer** (`src/api/trustedList/index.js:445`) z's `TAG_PINNING_Z_TAG` (TLs derive from pins — same
concept), server-side where `getOwnerAssistantPubkey()` is at hand. **create-element**'s tag
assembly is one array (`src/api/normalize/index.js:1852`) with `['z', headerUuid]`; the header's
current b tags are **in the graph** (`HAS_TAG → NostrEventTag {type:'b'}` with `value`/`value1`),
kept fresh by `importEventDirect`'s delete-and-recreate on every re-sign.

**Type semantics** (ADR 0029): absent element-3 reads as `"pointer"`; `"inherit"` is deference, not
affiliation — and the spec's floor draws shared stamps from *declared affiliation (pointer)*, so
the resolver takes **pointer-typed and untyped** targets only (an inherit-only holder adds a
pointer-b if they want the stamp — one more b, their declaration). **Self-declared headers** carry
a self-pointing b — the selector must **exclude the self coordinate** (already the personal stamp).
The **sentinel** fails the a-tag form and drops out for free. Cap: the ratified ~5 (W11's exact cap
deliberately implementation-chosen).

**Sweep-candidate map** (the follow-up story's input, confidence-tagged): `NewDListItem.jsx`
(client-signed publish — *confirmed writer*); tapestry create/republish drafts (client-built —
*confirmed*); `DListItemNeo4j.jsx` (*unmapped*); `NewElement.jsx`/`NewProperty.jsx` (z-greps hit
but no publish/create-element call found — *possibly display-side only; map at sweep planning*).

## Options considered

### Option A — parity by the finished conditional; a pure selector in bValueForms; create-element reads the graph

1. **Pin parity:** both pin-writer sites gain
   `...(hasLocalTa ? [['z', '39998:<taPubkey>:tag-pinning']] : [])` — the profileTag conditional
   verbatim; `taPubkey` plumbed from `useConfig()` at the call sites. Legacy literal untouched
   (ADR 0015).
2. **TL parity:** the TL builder adds the personal tag-pinning handle beside `TAG_PINNING_Z_TAG`,
   from `getOwnerAssistantPubkey()` (runtime-resolved, per the house rule).
3. **The selector — pure, in the b-semantics home:** `selectPointerTargets(bTagRows, selfCoord,
   cap)` in `src/lib/bValueForms.js` — rows are `{value, type}`; keep `classifyBValue(value) ===
   'a-tag'` ∧ type ∈ {absent, `'pointer'`} ∧ `value ≠ selfCoord`; dedupe; cap (**5**, a constant
   with a comment citing W11's deferred exact-cap). Zero-require preserved; U-testable
   exhaustively.
4. **The seam:** create-element, after resolving the concept header, reads the header's b tag rows
   by Cypher (one `OPTIONAL MATCH` — the graph is the local truth and the module's native I/O) and
   replaces `['z', headerUuid]` with `[headerUuid, ...selected].map(h => ['z', h])`.
   Unwired/deferred concepts produce exactly today's single z — behavior unchanged by
   construction.
5. **Consumers not touched:** pins/TLs need no resolver (their concept is fixed); the already-dual
   writers unchanged.

- **Pros:** the parity fix is the shipped pattern character-for-character; stamp semantics live
  beside their kin (type gate + form gate + self-exclusion are b-semantics); the seam's data
  source is the store create-element already lives in, freshened by the very re-signs that change
  the answer; every AC has one obvious owner.
- **Cons:** the selector's `{value, type}` row shape is a second projection of b tags (accepted —
  it mirrors the graph's `value`/`value1` columns directly).

### Option B — resolver reads strfry instead of the graph

- **Cons (dispositive):** a second I/O path for data the module already has in Cypher-reach,
  slower (child exec per element creation), and no fresher — `importEventDirect` updates the graph
  in the same request that changes a header. **Rejected.**

### Option C — a server resolver endpoint consumed by client writers too

- **Cons (dispositive):** no client writer in this story needs resolution (pins are
  fixed-concept); building the endpoint now is the sweep story's decision to make with its writer
  map in hand. **Rejected as premature.**

## Decision

**Option A.**

## Consequences

- **Enables:** items under wired concepts are born discoverable from both sides; the sweep story
  inherits a tested selector plus the confidence-tagged writer map above; pins/TLs become findable
  under the owner's personal handles.
- **Constrains:** future b-semantics changes hit `selectPointerTargets` beside `classifyBValue` —
  one home; the cap constant's change is a one-line, spec-annotated edit.
- **Debt:** none new; the sweep list's *unmapped/possibly-display-side* entries are the follow-up's
  first task.
- **Firmware reinstall required? No.** UI build at deploy (the pin writer is client-side).

## Implementation notes

- **`src/lib/bValueForms.js`** — add `STAMP_CAP = 5` + `selectPointerTargets(rows, selfCoord,
  cap = STAMP_CAP)`; export both.
- **`ui/src/utils/publishTagPin.js`** — both unsigned-event builders gain the conditional personal
  z; plumb `taPubkey` through the two exported functions' params from their call sites'
  `useConfig()` (mirror `publishProfileTagAssertion`'s `localTaPubkey` param shape).
- **`src/api/trustedList/index.js`** — the TL builder adds the personal handle via
  `getOwnerAssistantPubkey()`.
- **`src/api/normalize/index.js` `handleCreateElement`** — one
  `OPTIONAL MATCH (h)-[:HAS_TAG]->(bt:NostrEventTag {type:'b'})` collecting
  `{value: bt.value, type: bt.value1}` rows (in the existing header-resolution query or a sibling
  read); map through `selectPointerTargets`; build the z list.
- **Test-surface guidance (Tester's lane):**
  - **U** — `selectPointerTargets`: pointer/absent kept, inherit excluded, self excluded,
    sentinel/malformed dropped, cap enforced, dedupe, empty rows.
  - **S** — both pin sites carry the conditional (line-based); the TL builder carries the personal
    handle; the legacy literals byte-present (the ADR-0015 guard); create-element references the
    selector.
  - **H** — a wired fixture concept header (pointer-b to a foreign fixture coord; the F2 fixture
    idioms + `nextStamp`), create-element under it → the element carries both z's; unwired
    concept → single z (regression); deferred header → single z; pin/TL rows where operable via
    loopback, else S-level.
  - **No absolute counts anywhere** (OPEN.md #143).

## Out of scope

The client-writer sweep (the candidate map above is its input); clouds; re-stamping; the registry
ordering field; any `LEGACY_*` change.
