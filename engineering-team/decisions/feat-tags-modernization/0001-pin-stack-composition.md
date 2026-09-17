# ADR 0001: Pin-stack composition — contextual pins × TL membership methods, and context as a third `z`

**Status:** Accepted
**Date:** 2026-09-17
**Story:** `engineering-team/stories/feat-tags-modernization/2-pin-stack-integration.md`

## Context

The step-1 bulk merge (`1f4fa6f7`, worktree `/home/vcavallo/src/tapestry-tags`, branch
`integrate/staging-into-tags-2026-09`) took **staging's** copy of the two pin-stack files
wholesale as an interim:

| File | Interim state (staging's) | What `feat/tags` had |
|---|---|---|
| `src/api/trustedList/refreshPinnedTags.js` | `resolveMembershipMethod` / `round6` / the `count`\|`input`\|`certainty` fold, `rigor` tag; **no context** | context recovery + discriminated `d`-tags; **no methods** |
| `ui/src/utils/publishTagPin.js` | ADR shared-concepts-adoption/0004 dual-`z` writer (`localTaPubkey`); **no context** | `context` + `taPubkey` context stamp; **no dual-`z`** |

Everything else contextual-pins shipped **survived the merge intact** (verified by grep on the
merged tree): `src/lib/event-tagging/pins.js` (`pinVariantKey`, `contextHandle`,
`contextSlugOfPin`, `contextPinsToTags`, `KNOWN_CONTEXTS`); the plural read path
(`src/api/profile-tags/index.js:856, 1607, 1668` — `viewerPins`, context-aware pin rows);
the NIP-51 export d-tag resolution (`src/api/trustedList/index.js:409–411`); `Tag.jsx`'s pin
switcher, `PinToContextModal`, and its `handlePinToContext` caller; `usePinnedNotes` (already
reading kind-30393 under `contextSlug`); `useEventTagging`'s debounced
`refresh-pinned-tags-for-viewer`. So the integration is **narrow**: re-land context in the two
files the merge overwrote, plus the one panel call site that lost its threading
(`ui/src/components/PinnedListPanel.jsx:166` calls `usePinnedNotes(tag, user?.pubkey, noteMethod)`
— no observer-from-pin, no `contextSlug`).

**Concepts — verified live** (control panel `localhost:8778` on this machine, TA
`82b75e47…973833`, `/api/concept-graph/summaries` → 58 concepts):
- `39998:<TA>:lfo` — "lfo community context" — **present** (elements 0, sets 1).
- `39998:<TA>:tapestry-web-of-trust` — "tapestry & web of trust community context" — **present**.
- `39998:<TA>:tag-pinning` — present (the pin's base `z`, composed from the ADR
  event-tagging/0015 legacy literal, not this pubkey).
- `39998:<TA>:trusted-list` and `39998:<TA>:trusted-list-for-tag` — **absent**. The
  `dlist-item-tagging` two-`z` TL convention has not landed on this branch (it lives on
  `origin/feat/dlist-item-tagging`; `grep "'z'"` on the merged runner finds only the pin-side
  read at `refreshPinnedTags.js:261`). Today a published TL carries **zero** `z` tags.

**Interim-tree defects this ADR's implementation closes** (the ten red assertions):
`test/context-scoped-pins.test.js` 23/32, and one red in
`test/restore-historical-data-and-fix-tl-author-filter.test.js` (`Tag.jsx` passes
`taPubkey` + `context`; staging's blunt key-based guard rejects any `taPubkey`).

**Two live hazards of the interim tree, found while reading it** (not in the story; both argue
for shipping this before the branch is deployed anywhere):
1. `runOnePin` on a *contextual* pin now computes the **neutral** `d`-tag, so a contextual pin
   and the neutral pin of the same tag publish to the same replaceable 30392 coordinate —
   last writer wins, and the two lists silently overwrite each other.
2. `retractStaleTLs` diffs on the full `Set(currentDTags)`; the interim runner never emits a
   `…-in-<context>` d-tag, so every pre-existing contextual TL is absent from `wanted` and a
   single `refreshAllPinnedTags` cron pass **retracts it** (empty-membership replacement). The
   loss is recoverable (TLs re-derive on the next refresh after the fix), but the interim tree
   must not run a cron refresh against real data. Whether any deployment currently serves this
   branch — **I could not verify**; `tags.brainstorm.world` is expected to still serve
   `feat/tags`.

**Binding operator rulings** (book `engineering-team/audits/feat-tags-modernization/book.md`
§ Decision log): **D1** — contextual pins promote to staging; the two features are orthogonal
(context = *which pin produces which list*; method = *how members are scored*); the runner
resolves context, then applies the method; context becomes a third `z` on a contextual TL; and
this ADR **accepts** `contextual-pins/0001` (shipped and reviewed, still marked *Proposed*).
**D2** — the Pinned tab's "update the note list" is a server recompute, not a client bookmark
publish. This ADR designs around those, it does not reopen them.

## Options considered

### Option A — Orthogonal composition: context resolves first and feeds identity only _(chosen)_

`runOnePin` / `runOneNotePin` recover `contextSlug = contextSlugOfPin(pinEvent, TA_PUBKEY)`
**before** any scoring, then hand it only to the `d`-tag composer and the new context `z`.
`resolveMembershipMethod()` and the fold are untouched and never see `contextSlug`. Two
independent axes, joined at the publish call:

```
pin event ──contextSlugOfPin──> contextSlug ──> pinVariantKey ──> d-tag (identity)
                                            └─> contextHandle  ──> context z (discovery)
settings  ──resolveMembershipMethod──> method ──> membershipFolds[method] ──> members (scoring)
```

- **Pros:** neutral pins produce **byte-identical** events to today (`pinVariantKey({})` → `''`,
  no extra `z`), so the whole membership-method ladder is provably unaffected (AC-4). Each new
  method is a new entry in the `membershipFolds` map and needs no context awareness; each new
  discriminator extends `pinVariantKey` alone. Matches the shipped shape of both features.
- **Cons:** two concepts a reader must hold at once; the `d`-tag string is assembled from two
  independently-evolving helpers, so the client/server copies must be kept honest (addressed by
  the shared composer below).

### Option B — Context as a dimension *of* the membership method

Make the context part of the method registry (`certainty-in-lfo`, or a method that takes a
context argument and both scopes the assertion set and scores it).

- **Pros:** one axis; one selector; a context could eventually change *scoring* (e.g. weight
  LFO-member taggings higher) with no new machinery.
- **Cons:** conflates identity with computation. The method is **pipeline-global operator
  config** (`trustedLists.membershipMethod`, `src/api/trustedList/membershipMethods.js`); the
  context is **per-pin, author-declared**. Folding them makes the registry a cross-product
  (N methods × M contexts) that the settings UI cannot represent, forces every future method to
  re-derive the `d`-tag discriminator, and breaks the `['membership-method', …]`/`rigor` wire
  vocabulary, which names the *math* that ran. It also mis-sites POV: contextual weighting is a
  trust-input question (a per-POV GrapeRank interpretation), not a list-identity question.
  **Rejected** — and explicitly so, because this is the collapse the operator's D1 ruling exists
  to prevent.

### Option C — Context only in the `d` suffix, no `z`

Keep `-in-<context>` as the sole carrier of context (the shape as shipped on `feat/tags`).

- **Pros:** zero wire change; smallest diff; coexistence already works.
- **Cons:** **unqueryable.** `d` is not usefully filterable as a substring and
  `dlist-item-tagging/0002` forbids readers from parsing it (`d`-tag opacity is exactly what
  makes the empty-suffix back-compat safe). "Trusted Lists about X in LFO" would require
  scanning every TA-signed 30392 and string-matching — the same dead end that ADR forbids for
  the `source-tag`/`observer` multi-letter tags. **Rejected.**

### Option D — A composite context-scoped per-tag TL header

Instead of a third `z`, publish a per-(tag, context) TL header
(`39999:<TA>:tl:<slug>-tls-in-<context>`) and point the contextual TL's per-tag `z` at it, so the
conjunction "about X **and** in context C" is a single relay filter (see the `#z` union caveat in
Consequences).

- **Pros:** makes the conjunction one native filter; no client-side intersection.
- **Cons:** mints a fourth event class and a per-(tag × context) header population; loses the
  clean "the context `z` is the same handle the pin already stamps" symmetry; and cannot be built
  here at all — the per-tag TL header does not exist on this branch (`trusted-list-for-tag` is
  absent from the graph). **Rejected for now**; it is the natural revisit if the conjunction ever
  becomes a hot query.

## Decision

**Option A**, with these bindings.

**1. Call order in the runner (exact).** In both `runOnePin` and `runOneNotePin`, immediately
after the `lookupTag` success guard and **before** POV resolution / aggregation / method
dispatch:

```js
const contextSlug = contextSlugOfPin(pinEvent, TA_PUBKEY);   // null for a neutral pin
```

Then, unchanged, `resolvePov` → `aggregateProfilesTagged` → `resolveMembershipMethod()` →
`membershipFolds[membershipMethod]()`. `contextSlug` is consumed only by the `d`-tag composer and
the context `z` in `extraTags`. It is never passed to `resolveMembershipMethod`,
`applyDisputesFunction`, `curateNotes`, or any fold.

**2. Composed signatures** (`contextSlug` / `context` are **optional trailing** members of the
existing options objects; omitting them reproduces today's output byte-for-byte):

```js
// src/lib/event-tagging/pins.js — NEW, the single source of both strings
tlDTag({ observer, tagAuthorPubkey, tagSlug, contextSlug })      // tl-pin-<obs8>-<author8>-<slug><variant>
noteTlDTag({ observer, tagAuthorPubkey, tagSlug, contextSlug })  // tl-pin-notes-<obs8>-<author8>-<slug><variant>

// src/api/trustedList/refreshPinnedTags.js
computeTLDTag({ observer, tagAuthorPubkey, tagSlug, contextSlug })   // → tlDTag(...)

// ui/src/utils/publishTagPin.js
computeTLDTag({ observer, tagAuthorPubkey, tagSlug, contextSlug })       // → tlDTag(...)
computeNoteTLDTag({ observer, tagAuthorPubkey, tagSlug, contextSlug })   // → noteTlDTag(...)
computePinEventDTag({ tagSlug, tagAuthorPubkey, viewerPubkey, contextSlug })
computeNoteBookmarkDTag({ viewerPubkey, tagAuthorPubkey, tagSlug, contextSlug })
pinTag({ tag, curationMethod, localTaPubkey, context, taPubkey })
```

`pinTag` keeps **both** TA parameters, with distinct meanings, and they are not merged:
`localTaPubkey` is staging's ADR-0004 personal-stamp param (emits the second
`39998:<localTA>:tag-pinning` `z`); `taPubkey` is the contextual-pins runtime-TA param used
**only** to compose `contextHandle(taPubkey, context.slug)`. The base `z` stays
`TAG_PINNING_HANDLE` off `LEGACY_TA_PUBKEY` (ADR event-tagging/0015). A contextual pin from a
signed-in user therefore carries three `z`: legacy `tag-pinning`, local `tag-pinning`, context.
`contextSlugOfPin` is safe against that middle one because it accepts a
`39998:<runtimeTA>:<slug>` `z` **only** when `<slug>` is in `KNOWN_CONTEXT_SLUGS`, and
`tag-pinning` is not — the disambiguation is load-bearing now that the dual-`z` writer puts a
runtime-TA-prefixed `z` on every pin.

**AC-4's guarantee, stated plainly:** for a pin with no context stamp, `contextSlugOfPin` returns
`null`, `pinVariantKey({ contextSlug: null })` returns `''`, and no context `z` is emitted — so
every `d`-tag, tag array, and content JSON the pipeline publishes is **identical to the
pre-change bytes**. No method-ladder behavior can change.

**3. Context as a third `z` on contextual TLs (30392 and 30393).** A contextual TL adds exactly
one tag: `['z', contextHandle(taPubkey, contextSlug)]` — i.e. `39998:<runtimeTA>:<contextSlug>`,
composed by the **existing** `contextHandle` in `src/lib/event-tagging/pins.js` (never
hand-formatted, never the legacy literal — contexts are greenfield, per contextual-pins/0001).
A neutral TL adds nothing. Under `dlist-item-tagging/0002` a contextual TL will carry **three**
`z` (concept `trusted-list`, per-tag `tl:<slug>-tls`, context) and a neutral one **two** — but
see the "not yet two" consequence below: on *this* branch a contextual TL carries **one** `z` and
a neutral TL **none**, and that is correct and forward-compatible, because the context `z` is
additive and order is not load-bearing.

The `-in-<context>` `d` suffix keeps exactly one job: **replaceability** (distinct pin/TL/export
identity so neutral and contextual lists coexist). No reader parses it.

**The queryable form, with an honest correction to the story's illustrative filter.** NIP-01
ANDs across filter *keys* and ORs *within* one key, and there is only one `#z` key — so
`{kinds:[3039x], "#z":[<perTagHeader>, <contextConcept>]}` is a **union**, not the conjunction
AC-3's prose implies. The conjunction is one relay round-trip plus a local predicate:

```json
{"kinds": [30392, 30393], "authors": ["<TA>"], "#z": ["39998:<TA>:lfo"]}
```

= "every Trusted List in the LFO context" (an axis that does not exist today at all), then narrow
in the client by the per-tag `z` (once `dlist-item-tagging` lands) or by `source-tag`. Symmetric
alternative: filter on the per-tag `z` and keep only events whose tags include the context handle.
Either way: no new endpoint, no `d` parsing, and pure-relay portability for a third party such as
the LFO client. The conjunction-in-one-filter option is Option D, deferred.

**4. The restore-historical caller guard (AC-2).** The guard becomes the `feat/tags` shape: in
`ui/src/pages/Tag.jsx`, a `pinTag({...})` call may include the `taPubkey` **key** only when the
same call also includes `context`; a bare `taPubkey` on a neutral pin still fails; and the
positive assertion that `TAG_PINNING_HANDLE` is composed from `LEGACY_TA_PUBKEY` is kept (and
strengthened) rather than being proxied by "no `taPubkey` parameter anywhere". This is the right
shape under both governing ADRs: **0015**'s actual intent is that the *`tag-pinning` handle* must
never be composed from a runtime pubkey (historical pin visibility on non-dev deployments) — a
property now asserted directly, not inferred from a parameter list; **shared-concepts-adoption/
0004** already established that a runtime TA may ride into this publisher as a *value* under a
differently-named param (`localTaPubkey`), so a blunt token ban is both wrong and already
amended. The context stamp is greenfield, has no historical corpus to orphan, and MUST use the
runtime TA or discovery breaks on every non-dev deployment. Pairing `taPubkey` with `context`
encodes exactly that: the runtime TA is admissible only for the thing that requires it.

**5. Client/server parity for the note-TL `d`-tag (AC-6): one composer, two thin wrappers.**
`noteTlDTag` (and `tlDTag`) live in `src/lib/event-tagging/pins.js` — already CommonJS,
dependency-free, re-exported from `src/lib/event-tagging/index.js`, and already vite-aliased as
`@tapestry/event-tagging` (the client imports `KNOWN_CONTEXTS` from it in `Tag.jsx` and
`Pins.jsx`; the server requires the same folder in `profile-tags/index.js` and
`trustedList/index.js`). The server's `computeTLDTag` and `runOneNotePin`, and the client's
`computeTLDTag`/`computeNoteTLDTag`, all delegate. `usePinnedNotes` keeps importing
`computeNoteTLDTag` from `ui/src/utils/publishTagPin` — no call-site churn. The alternative
(keep two literal copies and prove parity with a shared-fixture test only) was rejected: a test
detects drift, a single composer makes drift impossible, and this exact string has already
drifted once across this merge.

## Consequences

**Blast radius — every file the Implementer touches:**
- `src/lib/event-tagging/pins.js` — **add** `tlDTag`, `noteTlDTag`; export both from
  `module.exports` (and thus from `index.js`'s spread). No change to existing helpers.
- `src/api/trustedList/refreshPinnedTags.js` — import `pinVariantKey`/`contextSlugOfPin`/
  `tlDTag`/`noteTlDTag` from `../../lib/event-tagging` (the merge dropped the first two from the
  require); `computeTLDTag` delegates; `runOnePin` + `runOneNotePin` recover `contextSlug` before
  scoring and pass it through; both add the context `z` to `extraTags` when `contextSlug`;
  `runOneNotePin` uses `noteTlDTag` and threads the pin cutoff into `curateNotes` (the merged
  `curateNotes` at `src/lib/event-tagging/taggings.js:125` already takes `cutoff = 0`);
  `refreshOnePinnedTagById` runs **both** `runOnePin` and `runOneNotePin`. `resolveMembershipMethod`,
  `round6`, the `membershipFolds` map, the `rigor` tag, `retractStaleTLs`, `enumeratePinnedTags`
  are **unchanged**.
- `ui/src/utils/publishTagPin.js` — import `pinVariantKey`/`contextHandle`/`tlDTag`/`noteTlDTag`;
  thread `contextSlug` through the four `compute*DTag` helpers; `pinTag` gains `context` +
  `taPubkey` (guard: `context && !taPubkey` → throw a message that does **not** begin with
  `if (!taPubkey`, so the ADR-0015 negative regex stays satisfiable — assert on the composed
  condition, e.g. `if (context && !taPubkey)`); emit the context `z` after the two
  `tag-pinning` `z`; keep `localTaPubkey`'s dual-`z` line and `publishNoteBookmarkSetForPin`'s
  `localTaPubkey` exactly as staging has them; delete the "no TA-signed note-TL yet (#336)"
  comment and the interim "story 2 appends pinVariantKey" note.
- `ui/src/components/PinnedListPanel.jsx` — restore the `pin` prop / `activePin` selection (the
  `Tag.jsx` call site at :504–510 already passes `pin={selectedPin}`), `contextSlug`/`contextName`,
  `contextSlug` into `computeTLDTag` + `computeNoteBookmarkDTag`, and
  `usePinnedNotes(tag, observer, noteMethod, contextSlug, noteCutoff)`; re-pin **with** the pin's
  context in `handleEditSubmit` while **keeping** `localTaPubkey: taPubkey` on the neutral branch.
- **Not touched, verified already correct:** `src/api/profile-tags/index.js`,
  `src/api/trustedList/index.js`, `src/lib/event-tagging/pins.js`'s existing helpers,
  `ui/src/hooks/usePinnedNotes.js`, `ui/src/hooks/useEventTagging.js`, `ui/src/pages/Tag.jsx`,
  `ui/src/components/PinToContextModal.jsx`, `ui/src/pages/Pins.jsx`,
  `src/api/trustedList/membershipMethods.js`, `firmware/**`.
- **Deliberately NOT restored from `feat/tags`:** the Story-12 `includeScoreInTL` Meilisearch
  `wot_rank` enrichment in `runOnePin`. Staging retired it (ADR trusted-lists/0002 point 3 and
  `0003`) — the score slot's meaning is now singular, the active method's score. A diff
  reintroducing `meiliFetchProfilesByPubkey` into `runOnePin` is a regression, not a recovery.

**What a neutral pin can and cannot observe.** Can: nothing new — same `d`-tags, same tag arrays,
same content, same method behavior, same exports. Cannot: it cannot see, enumerate, or be found
by any context axis; `contextSlugOfPin` returns `null` for it forever, and a `#z` context scan
never returns it. That asymmetry is the feature (explicit declared affiliation only — Stamping);
it also means "all pins of tag X" and "all pins of tag X in context C" stay different queries,
and no code may infer the second from the first.

**Republish story for the few existing contextual TLs.** TLs are replaceable and re-derive; the
first `refreshAllPinnedTags` (or per-pin refresh) after this lands republishes every contextual
30392/30393 at its `…-in-<context>` `d`-tag **with** the context `z`. No migration job, no
backfill script. Existing contextual **pins** need nothing at all: context lives in the pin's
`z` stamp, so pins published by `feat/tags` before the merge remain fully interpretable after it
— only the writer regressed, never the reader. Two operational notes: (a) until this lands, do
not run a cron refresh on this branch against real data (the retraction hazard above); (b) after
it lands, one refresh cycle is the whole "migration", and pre-existing contextual TLs that were
retracted in the interim come back populated.

**The `z` count is 1, not 3, on this branch** — and that is fine. `dlist-item-tagging/0002`'s two
`z` (`39998:<TA>:trusted-list` + `39999:<TA>:tl:<slug>-tls`) are not implemented here
(`trusted-list`/`trusted-list-for-tag` are absent from the live graph; the runner emits no `z`).
This ADR adds the context `z` **independently and additively**, so when that epic lands by
ordinary merge (book D3 cadence), the counts become 3 (contextual) / 2 (neutral) with no rework:
the only interaction is the union-vs-conjunction caveat recorded above. Any review or test that
asserts "a contextual TL has exactly three `z`" on *this* branch is wrong; the correct assertion
is "a contextual TL carries the context `z`; a neutral one does not."

**New debt / follow-ups:**
- The conjunction "TLs about X in context C" needs a client-side intersection until (and unless)
  Option D is taken. Record it as such; don't paper over it with a `#z` array.
- Contextual **exports** (kind-30000/30003) are context-aware in the `d`-tag
  (`src/api/trustedList/index.js:409–411`, `computeNoteBookmarkDTag`) but carry no context `z`.
  Out of scope here; if export discovery by context is ever wanted, mirror this decision.
- The panel's `Profiles` side still re-exports via `syncPinnedExportsForTag` only on the neutral
  branch — a contextual pin's curation edit recomputes the TA-signed TL but does not re-export
  the client-signed footprint. Inherited from contextual-pins/0001; unchanged.
- **Firmware reinstall required?** **No.** No concept definitions change. Both context concepts
  (`39998:<TA>:lfo`, `39998:<TA>:tapestry-web-of-trust`) are already in `firmware/active/` **and**
  already installed on this machine's graph (verified). A deployment that has never installed the
  merged firmware needs `POST /api/firmware/install` for those two concepts to resolve as graph
  nodes — but the context `z` is relay-filterable regardless, so discovery does not depend on it.

**`contextual-pins/0001` is hereby Accepted** (AC-5): it shipped, was reviewed, and its Option B
+ Amendment I are the shape this ADR composes onto. The Implementer flips its `**Status:**` line
from `Proposed` to `Accepted` and adds a one-line note pointing here. Its retraction invariant
(`retractStaleTLs` must diff on the full `Set(currentDTags)`; never collapse the enumerator by
`(obs, author, slug)`) carries forward **unchanged and still load-bearing** — a reviewer seeing
such a collapse MUST reject.

## Implementation notes

Concrete, in the order I'd land them:

1. `src/lib/event-tagging/pins.js` — add and export:
   `function tlDTag({ observer, tagAuthorPubkey, tagSlug, contextSlug })` →
   `` `tl-pin-${observer.slice(0,8)}-${tagAuthorPubkey.slice(0,8)}-${tagSlug}${pinVariantKey({ contextSlug })}` ``
   and `noteTlDTag(...)` → the same with the `tl-pin-notes-` prefix. Pure; no new imports.
2. `src/api/trustedList/refreshPinnedTags.js` — as enumerated in Consequences. Keep the
   `contextSlug` recovery on the line *after* the `lookupTag` guard in both runners, with the
   comment naming the ordering rule ("context first, then the method — identity vs scoring").
3. `ui/src/utils/publishTagPin.js` — as enumerated. Keep both TA params; keep the legacy handle
   composition literal (`` TAG_PINNING_HANDLE = `39998:${LEGACY_TA_PUBKEY}:tag-pinning` ``).
4. `ui/src/components/PinnedListPanel.jsx` — restore the `activePin`/`contextSlug` threading.
5. Flip `engineering-team/decisions/contextual-pins/0001-context-scoped-pins.md` to
   **Accepted** with a pointer to this ADR.

**Boundary note for the operator (story 2 vs story 3).** One assertion in
`test/context-scoped-pins.test.js` — *"the Pinned panel reads notes under the pin's observer +
context, **and updates via server refresh**"* — bundles a story-2 read change with the story-3
(D2) write change: its second half greps `PinnedListPanel.jsx` for
`refresh-pinned-tag … refetchPinnedNotes`, i.e. `handleRepinNotes` switching from
`publishNoteBookmarkSetForPin` to the server refresh. The story's *Out of scope* assigns that to
story 3, but AC-1 demands 32/32 here. **Recommendation:** story 2 carries the ~10-line
`handleRepinNotes` switch (D2 already ratified the end state; the endpoint exists on both
branches; leaving it means the panel displays the TA-signed 30393 while its update button writes
a client 30003 — a real inconsistency), and story 3 keeps the *user-facing* pinned-panel work:
the pin switcher polish, per-context labels/state, and the drift indicator. **Fallback** if the
operator prefers a strict split: the Tester splits that assertion in two and story 3 owns the
second half. Either way this is a Phase-3/PO call, not an implementation liberty.

**Test re-aims this ADR requires — Phase 3, the Tester's lane, never Phase 4.** The shared
composer moves three string literals out of the two files whose *source text* today's
assertions grep, so three assertions in `test/context-scoped-pins.test.js` must be re-aimed to
follow the delegation (same intent, new location):
- *"publishTagPin: computeTLDTag + computeNoteBookmarkDTag thread pinVariantKey"* — `computeTLDTag`
  will delegate to `tlDTag`; re-aim to "threads the discriminator (directly or via the shared
  composer)". `computeNoteBookmarkDTag` keeps `pinVariantKey` inline.
- *"Story 2: a client note-TL d-tag helper composes tl-pin-notes-… with the discriminator"* — the
  `tl-pin-notes-` literal now lives in `pins.js`; assert `computeNoteTLDTag` is exported and
  delegates to `noteTlDTag`, and assert the literal + discriminator in `pins.js`.
- *"refreshPinnedTags: TL d-tags thread pinVariantKey and context is recovered from the pin"* —
  keep the `contextSlugOfPin` half as-is; re-aim the `pinVariantKey` half to the composer import.
The three assertions whose intent must **not** be softened: the retraction set-based invariant,
`contextSlugOfPin`'s legacy-`z` disambiguation, and `pinTag` stamping via `contextHandle` (runtime
TA) rather than the legacy literal. The best new test to add is AC-6's parity fixture: one table
of `{observer, tagAuthorPubkey, tagSlug, contextSlug}` rows asserting the client helper and the
server helper return the same string — now trivially true, and the guard against re-duplication.

## Out of scope

- The Pinned panel's *user-facing* context UX beyond restoring the threading — story 3 (D2).
- The `dlist-item-tagging` two-`z` TL convention (concept `z` + per-tag TL header, lazy
  `ensureTLHeader`, the two new firmware concepts). Lands by ordinary merge from
  `origin/feat/dlist-item-tagging` per book D3; this ADR only guarantees additivity.
- Option D (a context-scoped per-tag TL header making the conjunction a single filter).
- A context `z` on the client-signed kind-30000/30003 exports.
- User-created contexts, more than one context per pin, sub-context breadth (`s`-tag) expansion,
  and community-derived POV — all still deferred by contextual-pins/0001.
- Choosing a canonical cross-deployment namespace for the context concepts (the federation seam
  question `dlist-item-tagging/0002` leaves open).
