# ADR 0003: An explicit pin variant key — recipes beside places

**Status:** Proposed
**Date:** 2026-09-18
**Story:** `engineering-team/stories/search-index-selection/5-explicit-pin-variant-key.md`

## Context

A viewer can already hold several pins of one tag, but **only by claiming one of them is about
a community**. The variant key is *derived*, never stored: `contextSlugOfPin(pinEvent, taPubkey)`
(`src/lib/event-tagging/pins.js:99-108`) walks the pin's `z` tags for a `39998:<runtimeTA>:<slug>`
whose slug is in `KNOWN_CONTEXT_SLUGS` (`:23-28`), and `pinVariantKey({ contextSlug })` (`:39-41`)
turns that into the `-in-<ctx>` suffix threaded through **five** address schemes:

| Scheme | Composer | `file:line` |
|---|---|---|
| kind-39999 pin `d` | `computePinEventDTag` | `ui/src/utils/publishTagPin.js:58-60` |
| kind-30392 profile TL `d` | `tlDTag` | `src/lib/event-tagging/pins.js:61-63` |
| kind-30393 note TL `d` | `noteTlDTag` | `:66-68` |
| kind-30394 item TL `d` | `itemTlDTag` | `:71-73` |
| kind-30003 note-bookmark export `d` | `computeNoteBookmarkDTag` | `ui/src/utils/publishTagPin.js:356-358` |

The suffix's one job is **replaceability**, and no reader parses it (ADR
`feat-tags-modernization/0001:195-196`); the composer was explicitly written to be extended —
"future 'other ways to pin the same tag' extend this one helper" (`pins.js:36-37`).

The design doc names the conflation: "context" bundles a **variant key** (lets pins coexist at
distinct addresses) with a **semantic claim** (this pin is scoped to a community), and an
indexing-curation pin wants the first and not the second
(`docs/SEARCH_INDEX_DLIST_SELECTION.md:198-205`). The fix inverts the dependency: store the
variant on the pin, stamp the context `z` only when the variant genuinely names a community.

**Why this is irreversible.** The variant lands in the `d` tag, and the resulting
`30394:<TA>:tl-pin-items-…` address is exactly what a search backend subscribes to, permanently
(`docs/SEARCH_INDEX_DLIST_SELECTION.md:229-239`). A variant slug chosen today cannot be renamed
later without silently changing a consumer's subscription.

**The address is the enforcement surface.** Two pins sharing a variant slug do not duplicate —
they are one parameterized-replaceable event, so the second **silently replaces** the first, pin
and derived lists together (`docs/SEARCH_INDEX_DLIST_SELECTION.md:213-215`; the story's binding
Uniqueness invariant). `dedupeReplaceable` (`src/api/trustedList/refreshPinnedTags.js:100-109`)
keys on `(pubkey, d)`, so a stomped pin is not even visible to the server as a second event.

**The UX constraint is binding.** "A community context is a **place**. An arbitrary curation
variant is a **saved recipe** … Putting recipes in the same chip row as places is what would
make it incomprehensible" (`docs/SEARCH_INDEX_DLIST_SELECTION.md:220-225`). Today that row is
one flat chip list, `📌 {label}` per pin, neutral first then contexts alphabetically
(`ui/src/pages/Tag.jsx:174-181`, `:573-590`).

**Story 4 lands first and owns the surface being extended.** On HEAD `4da04bdf`, `handlePin`
already opens the interstitial rather than publishing (`ui/src/pages/Tag.jsx:275-281`), the
community path routes through the same dialog (`:289-296`), `publishContextPin` is factored out
(`:298-325`), and the dialog is mounted in create mode at `:627-636` with the blob build
extracted to the pure `ui/src/utils/curationDialogBuild.js`.

### Concepts touched (Concept Graph, local panel `http://localhost:8778`)

- `39998:<TA>:tag-pinning` — description: "A tag-pinning is an assertion by a nostr user that
  they personally pin a specific tag … Each element links the pinning user (event author) to a
  tag event id and carries a curation-method …". Its element schema documents the pin's wire
  tags (`tagEventId` — "Mirrors the event's `e` tag") and the `curationMethod` vocabulary
  (`firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json:36-41`). Neither the context
  `z` nor a variant is documented there today. (ADR-0015's legacy-literal exception applies to
  the handle only; no new literal is introduced.)
- `39998:<TA>:trusted-list` — the 30392/30393/30394 family whose `d` tags the variant
  discriminates.
- `39998:<runtimeTA>:<contextSlug>` — the community-context concepts (`pins.js:47-49`), which
  become *one* populator of the variant rather than the only one.

## Options considered

### Option A — the variant is a pin **tag**, with two distinct address prefixes and the carrier deciding the kind

`['variant', '<slug>']` on the kind-39999 pin, emitted **only for a recipe**. A community pin is
unchanged: context `z` only, no `variant` tag. Readers get a new
`variantOfPin(pinEvent, taPubkey) → { kind: 'context'|'recipe'|null, slug }` that checks the
`variant` tag first and falls back to `contextSlugOfPin`. `pinVariantKey` gains a second,
mutually-exclusive member and yields `-in-<ctx>` / `-v-<slug>` / `''`.

- Pros: identity is readable without parsing JSON and is relay-filterable (`#variant`); it can
  never be collapsed by an unparseable `curationMethod` blob (`parseCurationMethod`,
  `src/api/profile-tags/index.js:591-604`); community addresses stay byte-identical; **the kind
  is carried by the pin, not inferred from a deployment-local set**, so extending
  `KNOWN_CONTEXTS` later cannot move a published address (E2).
- Cons: one more wire tag to document and keep honest; two prefixes instead of one general form.

### Option B — the variant is a field in the `curationMethod` blob

`curationMethod.variant = '<slug>'`, exactly as `targetTypes` / `authorConstraint` /
`membershipMethod` were added.

- Pros: one carrier for everything a pin says about itself; no new tag.
- Cons: fatal — the blob is *scoring* config and the variant is *identity*, the split ADR
  `feat-tags-modernization/0001` §1 made load-bearing ("context first (identity), then the
  curation (scoring)", mirrored at `refreshPinnedTags.js:296-301`). A blob that fails to parse
  yields `null` and would silently collapse two pins onto one address — i.e. destroy a list.
  Identity must not be reachable only through `JSON.parse`. Not relay-filterable.

### Option C — one general address form `-v-<slug>` for every variant, communities included

- Pros: a single prefix; `variantOfPin` needs no kind at all.
- Cons: either community addresses move (violates AC-2 and breaks every published contextual TL)
  or the same slug yields different addresses depending on whether it is a community — so
  promoting a recipe to a community would move a permanent subscription address.

### Server collision policy — sub-options

- **C1 — skip both claimants, keep their `d`-tag in the roster, log loudly.**
- **C2 — publish the newest claimant.** Two claimants then alternate overwriting each other's
  list every cron cycle, and a stranger who names your pubkey as `observer` controls the
  *content* at your address.
- **C3 — a pin counts for an observer only if `pin.pubkey === observer` (self-pin wins; others
  are skipped and logged).** Resolves the realistic case outright. It IS publication policy, and the
  operator ruled it in (2026-09-18): "only you may publish lists in your own name" is the rule the
  address scheme already implies, and freezing (C1) punishes the victim.

## Decision

We chose **Option A**, with **C3** as the server policy — Option A per the story's Gate A
(rulings 1, 2), C3 per the operator's ruling of 2026-09-18 that supersedes the draft's C1 (the
story's invariant clause 3 is amended to match). Eight decisions follow.

### 1. The variant key, generalised

`src/lib/event-tagging/pins.js`:

```js
const VARIANT_SLUG_MAX = 40;

function pinVariantKey({ contextSlug, variantSlug } = {}) {
  if (variantSlug) return `-v-${variantSlug}`;   // a recipe
  if (contextSlug) return `-in-${contextSlug}`;  // a place — byte-identical to today
  return '';                                     // neutral — byte-identical to today
}
```

The two members are **mutually exclusive**: `variantSlug` wins when both are somehow present,
matching `variantOfPin`'s precedence so a reader can never compute an address the publisher did
not (E3). All five composers take **both** members; `tlDTag` / `noteTlDTag` / `itemTlDTag`
(`pins.js:61-73`) and their two client twins (`publishTagPin.js:58-60`, `:356-358`) simply widen
their destructure. There remains exactly **one** composer.

New reader, beside `contextSlugOfPin` (which stays, unchanged, as the context-only accessor its
existing callers and `test/context-scoped-pins.test.js:74-92` depend on):

```js
function variantOfPin(pinEvent, taPubkey) {
  const v = (pinEvent?.tags || []).find((t) => t[0] === 'variant' && typeof t[1] === 'string' && t[1]);
  if (v) return { kind: 'recipe', slug: v[1] };
  const ctx = contextSlugOfPin(pinEvent, taPubkey);
  if (ctx) return { kind: 'context', slug: ctx };
  return { kind: null, slug: null };
}
```

Its return value feeds the composers directly:
`pinVariantKey({ contextSlug: kind === 'context' ? slug : null, variantSlug: kind === 'recipe' ? slug : null })`.
The Implementer should export one adapter (`variantKeyArgs(variant)`) so no call site re-writes
that ternary.

**Can a recipe also be scoped to a context? Not in v1.** A recipe is not a place, and a composite
address (`-in-lfo-v-search`) doubles the parsing-ambiguity surface (see §3) and forces a
two-dimensional switcher on a row the design doc already calls at risk of being
incomprehensible (`:220-225`). The composite form is **reserved**, not forbidden: `pinVariantKey`
returning `-in-<ctx>-v-<slug>` is the forward path if the need appears, and nothing published
under this ADR blocks it.

**Slug rules.** Derived by the canonical `slug()` (`src/lib/event-tagging/slug.js:11-17`) —
lowercase, diacritics stripped, `[^a-z0-9]+` → `-`, trimmed — so the charset is `[a-z0-9-]` with
no leading/trailing hyphen. A name slugifying to `''` is refused (AC-4). **Bounded at 40 chars**
(E4): the pin `d` already carries the tag slug plus two 8-char prefixes, and 40 keeps the worst
realistic address comfortably under ~120 bytes while leaving room for a memorable name; the bound
is enforced client-side, pre-signature, with the same inline error as a duplicate. A slug
colliding with a `KNOWN_CONTEXT_SLUGS` member is **refused** client-side (AC-3) — not silently
promoted to a context, which would emit a community claim the curator did not make.

### 2. The pin (and list) event shape

The kind-39999 pin gains exactly one tag for a recipe, `['variant', '<slug>']`, and **no** context
`z`; every other tag is unchanged (`publishTagPin.js:160-172`). A community pin gains **nothing**:
it keeps the context `z` alone, so newly created community pins stay indistinguishable on the wire
from pre-story ones (AC-2).

**The published lists disclose the variant.** The 30392/30393/30394 gain
`['variant', '<slug>']` **only when the pin is a recipe** — beside the existing disclosures
(`['membership-method', …]`, ADR 0002 §2) and before the `z` block
(`refreshPinnedTags.js:395-416`, and the twins at `:621`, `:732`). Rationale: the variant is
already in the address, but **no reader parses the `d` suffix** by standing rule
(`feat-tags-modernization/0001:195-196`), so without the tag a consumer has no supported way to
read it; and ADR 0002 already established that every list discloses what actually produced it.
Contextual lists need nothing new — their context `z` (`refreshPinnedTags.js:415`) is the
disclosure. Purely additive, and it leaves contextual/neutral list tag arrays byte-identical.

### 3. Uniqueness enforcement — what each side can actually do

**Client (the only guard that prevents the stomp).** Before signing, the create dialog checks the
chosen slug against the viewer's existing pins of this tag. The data is already on the page:
`GET /api/profile-tags/by-id` returns `viewerPins` with `context` per pin
(`src/api/profile-tags/index.js:888-906`), consumed as `orderedViewerPins`
(`ui/src/pages/Tag.jsx:173-177`). Story 5 extends that row with `variant` (§4) and the dialog
refuses, inline, without signing anything, when the slug: (a) equals an existing pin's variant
slug; (b) equals an existing pin's context slug or any `KNOWN_CONTEXTS` slug; (c) is empty after
slugify; (d) exceeds 40 chars. The error names the conflicting pin.

**Server (a real but strictly narrower guard).** Be honest about the topology:

- *Same author, same tag, same variant* → **identical pin `d`** → the relay holds **one** event
  and `dedupeReplaceable` (`refreshPinnedTags.js:100-109`) sees one. The earlier pin is already
  gone. **No server check can detect this**; only the pre-signature refusal prevents it.
- What the server *can* detect is the class the client cannot see: **two distinct pin events
  whose derived list address is the same.** That is reachable, and not hypothetical:
  1. the TL address keys on `curationMethod.observer`, while the pin address keys on the pin's
     **author** (`tlDTag` vs `computePinEventDTag`) — so two *different* authors who both name
     the same `observer` (an editable field, `CurationMethodDialog` advanced section) hold two
     legitimately distinct pins that publish to **one** list address today, overwriting each
     other every cron;
  2. suffix ambiguity — a neutral pin on a tag whose slug is `foo-v-bar` and a recipe `bar` on
     the tag `foo` compose the same `tl-pin-<o8>-<a8>-foo-v-bar`. Pre-existing in the same shape
     for `-in-` (tag slug `foo-in-lfo`); this ADR does not widen it, because both prefixes are
     equally ambiguous and no reader parses them;
  3. 8-char prefix collisions between two observers or two tag authors (vanishingly unlikely,
     mechanically identical).

  Because all three list `d`-tags derive from the same inputs, a collision fires simultaneously
  across the 30392/30393/30394 family — one detector suffices.

**The check (C3, operator ruling 2026-09-18).** Two layers, both in `refreshPinnedTags.js`:

1. **Author-must-match, per pin, in every runner.** Right after the existing observer bail, each
   of `runOnePin` / `runOneNotePin` / `runOneItemPin` returns `{ status: 'skipped', reason:
   'author-observer-mismatch' }` when `pinEvent.pubkey !== observer`, logging once per pin id.
   A pin about someone else's point of view publishes nothing under that address, on this
   instance, ever. `refreshOnePinnedTagById` inherits the check for free (it calls the runners).
   The skipped pin's `d`-tag is **not** pushed onto the rosters — it never owned the address —
   so the legitimate owner's list is the only claimant and the sweep is untouched.
2. **The pre-pass sweep stays, narrowed.** `refreshAllPinnedTags` (`:753-780`, today a plain
   per-pin loop plus three `retractStaleTLs` calls — the grouping is NEW code) groups the
   deduped pins by computed `tlDTag`; after layer 1 the only collisions left are the
   residual ones (suffix ambiguity `foo-v-bar` vs `foo`+`bar`, and 8-char prefix collisions
   between two of the observer's OWN pins — both vanishingly rare and both the observer's own
   doing). For those, skip-both + keep-on-roster + loud `pin-variant-collision` log, as the C1
   draft specified, because between two of your own pins there is no principled winner.

Why C3 over the draft's C1: with C1 a stranger who names your pubkey as observer freezes your
list on your own instance for the cost of one signed pin — the victim pays. With C3 the
instance applies at write time the same check a subscriber applies at read time (the signer
must be the observer, or — cross-instance — the observer's 10040-designated assistant): a pin
about your point of view must be yours. **Designated-assistant extension** (a pin signed by a
key the observer's 10040 names) is noted as a follow-up (OPEN row), not built here — the
runner does not read 10040s today and the operator's day-one case is author === observer.

### 4. Readers — every derived-variant site, and what changes

| `file:line` | Today | Change |
|---|---|---|
| `src/lib/event-tagging/pins.js:39-41` | `pinVariantKey({contextSlug})` | gains `variantSlug` (§1) |
| `:61-73` | three TL composers | thread both members |
| `:99-108` | `contextSlugOfPin` | **unchanged**; joined by `variantOfPin` |
| `src/api/trustedList/refreshPinnedTags.js:478-513` | `retractStaleTLs` — retracts every `tl-pin-` list whose `d` is off the cycle's roster | **no code change**, but its behaviour under C3 is load-bearing: a skipped (author ≠ observer) pin's list is retracted on the next cycle — see Consequences; the Tester pins it (a stranger's pin ⇒ list retracted; the owner's pin present ⇒ list republished untouched) |
| `src/api/trustedList/refreshPinnedTags.js:301`, `:558`, `:674` | `contextSlugOfPin` in the three runners | `variantOfPin`; feed composer + conditional `z` (`:415`, `:621`, `:732`) — the `z` is emitted only for `kind === 'context'`; add the recipe disclosure tag (§2) |
| `:127-129` | `computeTLDTag` wrapper | widen the destructure (name and shape preserved — `test/restore-historical-data-and-fix-tl-author-filter.test.js:384-394` pins it) |
| `:445-470` | `refreshOnePinnedTagById` | no logic change; inherits variant-aware runners |
| `:753-780` | `refreshAllPinnedTags` | pre-pass collision detector (§3) |
| `src/api/profile-tags/index.js:900` | `context: contextSlugOfPin(ev2, TA_PUBKEY)` on `viewerPins` | add `variant: { kind, slug }`; keep `context` (back-compat; `viewerPin` at `:906` still "the pin with no context **and** no variant") |
| `:1651` | `context:` on the `/pins` rows | same addition |
| `:1715` | hand-composed `tl-pin-…` string | **delegate to `tlDTag`** and pass the row's variant (AC-5) |
| `src/api/trustedList/index.js:409-411` | hand-composed `tl-pin-…` via `pinVariantKey` | `variantOfPin` + `tlDTag`; this is the kind-30000/39089 export path, so a recipe exports from its own list |
| `ui/src/utils/publishTagPin.js:58-60`, `:74-78`, `:85-90`, `:356-358` | `contextSlug` only | thread `variantSlug` |
| `:153-176` (`pinTag`) | `context` → d-tag + `z` | accept `variant` (a `{name, slug}` recipe); emit `['variant', slug]`; **never** both a context and a variant |
| `:396` | `computeNoteBookmarkDTag(… no contextSlug)` | pass the active pin's variant (E5) — see Consequences, this also fixes a pre-existing contextual mismatch |
| `ui/src/components/PinnedListPanel.jsx:135-163`, `:293` | `contextSlug` → `computeTLDTag` / `itemTlDTag` / `computeNoteBookmarkDTag` | read `pin.variant`; label a recipe by its name, never with the community label logic at `:136-138` |
| `ui/src/pages/Tag.jsx:174-181`, `:573-590` | `contextNameOf`, `orderedViewerPins`, chip row | §5 |
| `ui/src/hooks/useTagMemberSets.js:56`, `:93` | hand-composed `tl-pin-…`, **no suffix at all** (OPEN 298) | **fixed here**: delegate to `tlDTag` with the pin's variant |
| `ui/src/pages/Pins.jsx:47-58` | `contextLabel` + ordering | show a recipe by name with the recipe glyph; do not route it through `KNOWN_CONTEXTS` |

OPEN 298 (`OPEN.md:354`) is **fixed by this story, not filed**: it is one call site inside the
blast radius, and leaving it would make recipes invisible to the same hook that already loses
contextual pins.

### 5. UI — one chip row, recipes separated (Gate A ruling 3)

- **Creation** lives in story 4's create-mode dialog (`ui/src/components/CurationMethodDialog.jsx`,
  mounted at `ui/src/pages/Tag.jsx:627-636`): an optional "Save as a separate curation" **name**
  field with a live `slug()` preview and the inline uniqueness/length check of §3. It is offered
  only when the viewer already holds a pin of this tag (the first pin is the neutral one), and it
  is mutually exclusive with `pinDialog.context` — a community pin never shows the field, which is
  how the "not in the same row, not the same act" ruling is enforced at the source.
  `PinToContextModal` ("Pin to a community", `ui/src/components/PinToContextModal.jsx:21-22`,
  `:64`) is **untouched**. Submission routes to a new `publishVariantPin(curation, variant)` in
  `Tag.jsx`, a sibling of `publishContextPin` (`:298-325`) — same await-refresh-then-select shape.
- **The switcher** (`Tag.jsx:573-590`) keeps one row and one ordering rule extended to three
  bands: neutral ("Personal") → places (alphabetical by `contextNameOf`) → recipes (alphabetical
  by name). A non-interactive `<span className="bs-pin-switcher-divider">Your curations</span>`
  separates the last place from the first recipe; recipes render with a distinct glyph (🧪) in
  place of 📌. Existing CSS is reused as-is — `.bs-pin-switcher`, `.bs-pin-switcher-chip`,
  `:hover`, `.is-active` (`ui/src/styles.css:6291-6316`) — plus one new `-divider` rule in that
  same block. The row still hides below two pins (`Tag.jsx:573`).
- Nothing else in the Pinned tab's information architecture moves; the deliberate places-vs-recipes
  design round stays deferred (story § Out of scope).

### 6. Composition — four independent fields

variant/context is **identity** (the `d` tag plus, for a context only, the discovery `z`);
`authorConstraint` is **eligibility** (applied inside the aggregation, before the fold);
`membershipMethod` is **scoring** (the fold itself). They compose with no interaction — this ADR
adds a fourth axis to the three ADR 0002 §6 already states are independent, at the same identity
stage the context occupies there. Concretely (E6): two recipe pins of one tag, each with its own
`membershipMethod` and `authorConstraint`, fold independently and publish to distinct addresses;
the day-one search-index pin is a recipe carrying
`{ authorConstraint: 'observer', membershipMethod: 'certainty' }`, and nothing special-cases it.

### 7. Migration and back-compat

- **Legacy contextual pins** carry no `variant` tag; `variantOfPin` derives `{kind:'context'}`
  from the `z` and `pinVariantKey` yields the same `-in-<ctx>`. All five addresses are
  byte-identical (`pin-stack-composition` AC-4; `test/context-scoped-pins.test.js:49-62` and
  `test/item-trusted-list.test.js:151` stay green unmodified).
- **Neutral pins**: no `variant`, no context `z` → `{kind:null}` → `''` → unchanged.
- **No back-fill.** Contextual pins keep deriving; nothing is republished or migrated.
- **E2 is closed by construction.** The *carrier* decides the kind, not membership in a
  deployment-local set: a recipe named `lfo` keeps `['variant','lfo']` and no `z`, so adding
  `lfo` to `KNOWN_CONTEXTS` tomorrow cannot move its address or start emitting a community claim.
  (The pre-existing cross-deployment hazard in `contextSlugOfPin`'s known-set matching,
  `pins.js:104-105`, is untouched and out of scope.)
- **E3**: a pin carrying both a `variant` tag and a context `z` resolves as a **recipe** (variant
  first) and its stray `z` is ignored — deterministic, and identical to what the client composer
  computed.

### 8. Firmware

`firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json` gains a `variant` property
beside `tagEventId` (`:29-35`) — `"The optional curation-variant slug … Mirrors the event's
'variant' tag. Present only for a named curation ('recipe'); a community-scoped pin instead
carries a 39998:<TA>:<contextSlug> z tag. The variant discriminates the pin's own d tag and every
Trusted List address it produces."` — and the concept description gains one sentence saying a
user may hold several pins of one tag, discriminated by variant. Description/additive edit to an
existing object: no structural validation change, no graph reshape.

### Invariant check

Read-time only. Nobody is gated from publishing: the client-side refusal governs **the viewer's
own** pre-signature UI, not anyone else's right to publish a pin, and the server never rejects an
event — it declines to *derive* a list from an ambiguous pair (CLAUDE.md invariants 2 and 3). The
answer to "who is this list true for?" is still "the pin's observer". No TA-pubkey literal is
introduced; the context `z` keeps composing from the runtime TA (`pins.js:47-49`).

## Consequences

- **Enables** the book's day-one need: a strictly-curated search-index list at its own permanent
  address, beside the curator's ordinary lists, with nothing on the wire claiming it is a place.
- **`['variant', …]` becomes a permanent wire contract** on kind-39999 and on recipe Trusted
  Lists, and `-v-<slug>` becomes a permanent address form. A future story that renames either owes
  a superseding ADR and a migration, because consumers subscribe to the address forever.
- **Two ambiguity surfaces are now permanent, and deliberately unfixed:** a tag slug containing
  `-in-` or `-v-` can compose the same list address as a suffixed pin on a shorter slug. Nothing
  parses the suffix, so the only consequence is the collision class the §3 detector exists to
  catch and log.
- **The kind-30003 note-bookmark export changes address for contextual pins** (`publishTagPin.js:396`
  currently omits the context entirely, while `PinnedListPanel.jsx:293` links to the contextual
  address — the reader and the writer already disagree, so today a contextual export is written to
  the neutral address and is unreachable from the UI). Threading the variant fixes the mismatch;
  the cost is that any 30003 exported from a contextual pin before this story stays at the neutral
  address, orphaned but untouched. Neutral pins' exports are unchanged. Alternative considered:
  thread only recipes and file the contextual half — rejected, since it leaves a known
  reader/writer disagreement in a path this story is already editing.
- **A pin about someone else's point of view is skipped, not published** (§3, C3) — a change to
  who may publish at an address, ruled in by the operator. Existing pins where author ≠ observer
  (if any exist on an instance) stop publishing on the next cycle **and any list they previously
  published is RETRACTED by the sweep** — `retractStaleTLs` (`refreshPinnedTags.js:478-513`)
  republishes every TA-signed `tl-pin-`-prefixed list whose `d` is *not* on the cycle's roster
  as `['status','retracted']` with empty membership (`:484`, `:488`, `:501-508`), and a skipped
  pin contributes no `d`. That is the intended outcome: an illegitimate list at an observer's
  address is withdrawn, at that permanent subscription address, with a visible status. If the
  observer holds their own pin of the tag, their pin is the sole claimant and their list is
  simply republished — nothing at the address changes. (J1 corrected the draft, which claimed the
  opposite.) **Follow-up worth an `OPEN.md` row:** honour a pin signed by the observer's
  10040-designated assistant.
- **A residual collision between two of the observer's OWN pins freezes both** (§3 layer 2) —
  loggable, never silent, and only reachable by suffix ambiguity or an 8-char prefix collision.
- **OPEN 298 (`OPEN.md:354`) closes here.**
- **New debt.** The places-vs-recipes information-architecture round is still owed
  (`docs/SEARCH_INDEX_DLIST_SELECTION.md:220-225`); this ADR ships one divider and one glyph and
  hard-codes the sequence neutral → places → recipes in two places (`Tag.jsx`, `Pins.jsx`) that
  the round will want to unify.
- **Firmware reinstall required? YES** — `POST /api/firmware/install`, because
  `firmware/…/tag-pinning/json-schema.json` is the only human-readable definition of the pin's
  wire shape and the graph copy drifts until it is reinstalled. Locally via the container loopback
  per AGENTS.md §6 (this dev panel is `http://localhost:8778`); on `tags.brainstorm.world` as part
  of the deploy, or the deployed graph will describe a pin shape one tag short.

## Implementation notes

Blast radius, in dependency order:

- `src/lib/event-tagging/slug.js` — **unchanged** (the canonical `slug()` is reused, not copied).
- `src/lib/event-tagging/pins.js` — `pinVariantKey({contextSlug, variantSlug})` (§1); export
  `VARIANT_SLUG_MAX`; add `variantOfPin(pinEvent, taPubkey)` and the `variantKeyArgs(variant)`
  adapter; widen `tlDTag` / `noteTlDTag` / `itemTlDTag` destructures. `contextSlugOfPin`,
  `contextHandle`, `KNOWN_CONTEXTS`, `trustedListZTags` untouched. Add exports to
  `src/lib/event-tagging/index.js`.
- `src/api/trustedList/refreshPinnedTags.js` — `variantOfPin` in `runOnePin` (`:301`),
  `runOneNotePin` (`:558`), `runOneItemPin` (`:674`); context `z` emitted only for
  `kind === 'context'` (`:415`, `:621`, `:732`); recipe disclosure tag beside
  `['membership-method', …]`; collision pre-pass + `status:'collision'` + roster preservation in
  `refreshAllPinnedTags` (`:753-780`).
- `src/api/profile-tags/index.js` — `variant` on `viewerPins` (`:900`) and `/pins` rows (`:1651`);
  `enrichRowsWithTLStatus` (`:1715`) delegates to `tlDTag`.
- `src/api/trustedList/index.js:409-411` — `variantOfPin` + `tlDTag`.
- `ui/src/utils/publishTagPin.js` — thread `variantSlug` through the four client composers;
  `pinTag` accepts `variant` and emits `['variant', slug]`; `:396` passes the active variant.
- `ui/src/utils/curationDialogBuild.js` — **no change** (the variant is not a `curationMethod`
  field; keeping it out is what keeps story 4's byte-identity sentinel meaningful).
- `ui/src/components/CurationMethodDialog.jsx` — the optional name field, slug preview, inline
  refusal; it reports the chosen `{name, slug}` to the caller *beside* the curation blob, never
  inside it.
- `ui/src/pages/Tag.jsx` — `publishVariantPin`; `variantNameOf` beside `contextNameOf`
  (`:170-172`); three-band `orderedViewerPins` (`:173-177`); divider + glyph in the chip row
  (`:556-575`); pass the dialog the viewer's existing variant slugs.
- `ui/src/components/PinnedListPanel.jsx`, `ui/src/pages/Pins.jsx`,
  `ui/src/hooks/useTagMemberSets.js` — read `pin.variant`; label recipes by name.
- `ui/src/styles.css` — one `.bs-pin-switcher-divider` rule inside the block at `:6291-6316`.
- `firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json` — §8.

**Also hand-composes both forms, neutral-only, outside the test lane:** `scripts/tl-ladder-validate.js:226,236` — unaffected by a neutral address, note it for the operator's kit.

**For the Tester (Phase 3 — not the Implementer's lane).** The new suite is
`test/explicit-pin-variant-key.test.js`. Suites that hand-compose a pin/TL `d`-tag and will need
re-aiming or an explicit unchanged-by-design assertion:
`test/context-scoped-pins.test.js`, `test/pin-stack-composition.test.js`,
`test/tl-weighted-sum-method.test.js` (`:219`, `:228` — hand-composes both a `tag-pin-` and a
`tl-pin-` d-tag; live-stack suite, operator-run),
`test/item-trusted-list.test.js`, `test/note-trusted-list.test.js`,
`test/per-pin-membership-method.test.js`, `test/restore-historical-data-and-fix-tl-author-filter.test.js`,
`test/customize-pin-curation-publish.test.js`, `test/pin-a-tag-publish.test.js`,
`test/tl-publication-from-pins-publish.test.js`, `test/nip51-list-export-from-pins-publish.test.js`,
`test/most-pinned-tag-index-publish.test.js`, `test/trusted-list-raw-view.test.js`,
`test/tag-detail-curated-view-and-pin-polish-publish.test.js`; and the two live-stack suites
outside the judge gate, `test/tl-certainty-method.test.js` and
`test/tl-membership-method-selector.test.js` (operator-run at Gate B).

## Out of scope

- The places-vs-recipes information-architecture round; the Pins page and `PinnedListPanel` get
  the minimum (a name and a glyph), not a redesign.
- Back-filling a `variant` tag onto existing contextual pins.
- Honouring a pin signed by the observer's 10040-designated assistant (the C3 extension; OPEN row).
- Rung 2 (`author ∈ <list>`), the filter-list picker, naming the `worth-indexing-for-search` tag,
  and what the search backend does with the list.
- Composite `context × recipe` variants (reserved, §1).
- `contextSlugOfPin`'s cross-deployment known-set hazard (`pins.js:104-105`).
