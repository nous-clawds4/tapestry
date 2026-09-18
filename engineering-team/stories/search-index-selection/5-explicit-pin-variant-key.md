# Story 5: An explicit pin variant key

**Status:** Approved
**Created:** 2026-09-18
**Type:** Feature *(Light book; **wire-visible** — the variant rides the `d` tag, which is the
search backend's permanent subscription key. The irreversibility trigger "a wire format or
event shape" fires, so an **ADR is expected**. Gate A rules the lane.)*
**Epic:** `engineering-team/epics/search-index-selection.md` (story 5)
**Book:** `engineering-team/audits/search-index-selection/book.md` (acceptance-frame bullet 3,
"Per-pin curation" — the second half)
**Design target:** `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3) — § "Design note: per-pin
curation implies multiple pins per tag" (`:187-225`) and § "Why the address encodes identity
and not method" (`:229-243`).
**Split from:** `3-per-pin-membership-method.md` (Gate A ruling 8 — Part B, lifted verbatim).
**Sequencing:** **story 4** (the first-pin confirm step, epic item 4) shapes the same switcher
surface and should land **before or with** this story.

## Background

### The only way to hold two pins of one tag is to claim one is about a community

The variant key is *derived*, not stored: `contextSlugOfPin` reads a `39998:<runtimeTA>:<slug>`
`z` off the pin and returns the slug only when it is in `KNOWN_CONTEXT_SLUGS`
(`src/lib/event-tagging/pins.js:99-108`, set at `:23-28`); `pinVariantKey({ contextSlug })`
turns it into the `-in-<ctx>` suffix (`:39-41`) that discriminates all five `d`-tag schemes —
`tlDTag` / `noteTlDTag` / `itemTlDTag` (`:61-73`), plus `computePinEventDTag` (`ui/src/utils/
publishTagPin.js:58-59`) and `computeNoteBookmarkDTag` (`:357`). ADR
`feat-tags-modernization/0001` §2 already anticipated the generalisation — "future 'other ways
to pin the same tag' extend this one helper" (`pins.js:36-37`) — and pinned the suffix's single
job: **replaceability, and no reader parses it** (ADR `feat-tags-modernization/0001:192-193`).

The design doc names the conflation precisely: "context" bundles a **variant key** (lets pins
coexist and take distinct addresses) with a **semantic claim** (this pin is scoped to a
community), and an indexing-curation pin wants the first and not the second
(`docs/SEARCH_INDEX_DLIST_SELECTION.md:198-205`). The fix inverts the dependency: store the
variant on the pin; stamp the context `z` only when the variant genuinely names a community.
Existing contextual pins stay valid — they become variants whose slug happens to be in
`KNOWN_CONTEXTS` and which therefore also carry the `z`.

**Why this is irreversible.** The variant lands in the `d` tag, and the resulting
`30394:<TA>:tl-pin-items-…` address is exactly what the search backend subscribes to,
permanently (book acceptance frame; design doc `:229-239`). A variant slug chosen today cannot
be renamed later without silently changing a consumer's subscription.

Readers of the derived `d`-tag that this story touches:

| Reader | `file:line` | What it does |
|---|---|---|
| `enrichRowsWithTLStatus` | `src/api/profile-tags/index.js:1690`, d-tag at `:1715` | Derives each pin's TL `d`-tag to look up publish status. Reads the *variant* (`row.context` → `pinVariantKey`). |
| TL status endpoint | `src/api/trustedList/index.js:409-411` | Hand-composes the same `tl-pin-…` string via `pinVariantKey`. Variant only. |

### The UX constraint is binding, and it is a modelling problem

"A community context is a **place**. An arbitrary curation variant is a **saved recipe** …
Putting recipes in the same chip row as places is what would make it incomprehensible. Worth a
deliberate design round before building." (`docs/SEARCH_INDEX_DLIST_SELECTION.md:220-225`.)
That row is `ui/src/pages/Tag.jsx:556-575` — `orderedViewerPins` (`:173-177`) sorts the neutral
pin first ("Personal", `:559`) then contexts alphabetically by `contextNameOf` (`:170-172`), and
the row is hidden entirely below two pins (`:556`). The entry point is
`PinToContextModal` ("Pin to a community", `ui/src/components/PinToContextModal.jsx:21-22`,
`:64`) fed `KNOWN_CONTEXTS` from `Tag.jsx:601`, launched from `TagPinAffordance.jsx:77`
("Pin this tag within a community context"). The same place/label logic is duplicated in
`ui/src/components/PinnedListPanel.jsx:135` and `ui/src/pages/Pins.jsx:49`. This story does
**not** spend that design round (see Out of scope, and open question 6 for the minimum).

This stays a **read-time** change: nobody is gated from publishing anything (CLAUDE.md
invariants 2 and 3). No TA pubkey literal is introduced; the variant's context `z` keeps
composing from the runtime TA (`pins.js:47-49`).

## User-facing description

As a curator, I want to hold **several pins of the same tag** distinguished by a name I choose
rather than by claiming a community, so that I can run one strictly-curated list — the one a
search backend subscribes to — beside my ordinary lists, without pretending my curation is a
place.

## Acceptance criteria

- [ ] **AC-1 — a variant that is not a community.** A viewer can create a second pin of the
      same tag by naming a variant that is **not** in `KNOWN_CONTEXTS` (`pins.js:23-28`). The
      resulting pin coexists with the neutral pin, gets its own pin `d`-tag and its own
      30392/30393/30394 `d`-tags, and carries **no** context `z` (`pins.js:47-49`) — nothing
      on the wire claims it is about a community.
- [ ] **AC-2 — contextual pins are unchanged, byte for byte.** Every pin published to date —
      neutral or contextual — keeps its exact `d`-tags across all five schemes
      (`pins.js:61-73`, `publishTagPin.js:58-59`, `:357`), its `z` set, and its published list
      bytes. A pin whose variant *is* a known community slug still emits the context `z` and
      still resolves through `contextSlugOfPin` (`pins.js:99-108`). Newly created community
      pins are indistinguishable on the wire from ones created before this story.
- [ ] **AC-3 — variant uniqueness per (observer, tag).** Two pins of the same tag by the same
      observer cannot take the same variant slug, because they would collide on the address
      (`docs/SEARCH_INDEX_DLIST_SELECTION.md:213-215`). Attempting it is refused with a message
      naming the conflict, and no event is signed or published. Includes the case where the
      chosen name *slugifies* onto an existing variant (`src/lib/event-tagging/slug.js:11-17`),
      and the case where it slugifies onto a `KNOWN_CONTEXTS` slug or onto the neutral pin.
- [ ] **AC-4 — slug rules are the house rules.** The variant slug is derived by the canonical
      `slug()` (`src/lib/event-tagging/slug.js:11-17`); a name that slugifies to the empty
      string is refused; the stored variant is the slug, and any human-readable name is
      display-only.
- [ ] **AC-5 — the reader path resolves variants.** Every derived-`d`-tag reader keys off the
      stored variant rather than the derived context: `enrichRowsWithTLStatus`
      (`src/api/profile-tags/index.js:1690`, `:1715`), the TL status endpoint
      (`src/api/trustedList/index.js:409-411`), and the pin list the Tag page reads
      (`src/api/profile-tags/index.js:900`, `:905`). A non-community variant's TL publish
      status resolves correctly; the neutral pin is still the one with no variant (`:905`).
- [ ] **AC-6 — the minimum switcher UX.** The Pinned tab can reach a non-community variant's
      list without misrepresenting it as a place (`ui/src/pages/Tag.jsx:556-575`). The exact
      minimum is open question 6; whatever is chosen, **recipes are visually distinct from
      places** and the existing "Personal"-first ordering (`:173-177`) is preserved.

## Concepts touched

- `39998:<TA>:tag-pinning` — the pin element carrying the new variant (ADR-0015
  legacy-literal exception applies to the handle only; no new literal).
- `39998:<TA>:trusted-list` — the published 30392 / 30393 / 30394 family whose `d` tags the
  variant discriminates.
- `39998:<runtimeTA>:<contextSlug>` — the community-context concepts (`pins.js:47-49`), which
  become *one* populator of the variant rather than the only one.

## Edge cases

- **E1 — a variant slug that is a known community slug.** Must behave exactly like today's
  contextual pin: context `z` stamped, `contextSlugOfPin` resolves it, `-in-<ctx>` suffix (or
  whatever open question 4 rules). The two paths must not diverge.
- **E2 — a deployment extends `KNOWN_CONTEXTS` after a pin was published.** A variant that was
  a plain recipe yesterday becomes a community slug today. Behaviour must be defined and must
  **not** silently change an already-published pin's address or start/stop emitting a `z` on
  refresh (this is the cross-deployment hazard `contextSlugOfPin`'s known-set matching already
  creates — `pins.js:104-105`).
- **E3 — variant present in the blob but the pin also carries a context `z`, disagreeing.**
  Must resolve deterministically with the stored variant winning (it is what the `d` tag was
  composed from), never producing a `d`-tag the publisher did not compute.
- **E4 — a variant slug long enough to threaten the `d`-tag.** `d` tags already concatenate
  two 8-char prefixes plus the tag slug (`pins.js:61-73`); a length bound or its deliberate
  absence should be stated.
- **E5 — export / bookmark d-tags.** `computeNoteBookmarkDTag` (`publishTagPin.js:357`) takes
  the same variant; the NIP-51 export path must not fall back to the neutral address for a
  variant pin.
- **E6 — variant × per-pin membership method (story 3).** Two variant pins of one tag, each
  with its own `membershipMethod`, must fold independently and publish to distinct addresses.
- **Not covered:** rung 2 (`author ∈ <list>`); the full places-vs-recipes design round; naming
  the `worth-indexing-for-search` tag; what the search backend does with the list; migrating
  existing contextual pins to carry an explicit variant field (they keep deriving).

## Out of scope

- **The deliberate UX design round** for places vs recipes across the Pinned tab, the Pins page
  (`ui/src/pages/Pins.jsx:49`) and `PinnedListPanel` (`:135`). This story ships the *minimum*
  affordance (AC-6 / open question 6) and defers the rest; the design doc's warning
  (`:220-225`) is treated as binding, not as a to-do.
- **The per-pin membership method** — story 3, already approved.
- **The first-pin confirm step** — story 4; it shapes the same switcher surface and should land
  before or with this story, but its ACs are its own.
- **Retiring the instance-wide dial.** Story 3 settled it: it stays as the default.
- **Rung 2 and rung 3** of the guard ladder, and the filter-list picker.
- **Back-filling a variant field onto existing contextual pins.** Derivation stays the
  compatibility path.
- Any change to who may publish a tagging or a pin. Write-time gating is out of bounds.
- Renaming or re-parenting the concept handles (ADR-0015 exception territory).

## Open questions for Gate A

*(Numbering preserved from the story-3 draft these were lifted from — questions 1, 3, 5 and 8
were ruled at that story's Gate A and are recorded there.)*

2. **Where does `variant` live — the blob, or a pin tag?** Recommendation: **a dedicated `d`-
   adjacent tag on the pin event, `['variant', '<slug>']`**, not the `curationMethod` blob.
   Reason: the blob is *scoring* config and the variant is *identity* — the exact split ADR
   `feat-tags-modernization/0001` §1 made load-bearing ("context first (identity), then the
   curation (scoring)", `refreshPinnedTags.js:275-278`). Identity must be readable without
   parsing JSON, must be relay-filterable, and must not be buried in a field whose absence
   already means "fall back to a default". It also keeps the variant *out* of the blob that
   `parseCurationMethod` may silently fail to parse (`src/api/profile-tags/index.js:591-604`) —
   an unparseable blob must never silently collapse two pins onto one address. Alternative
   worth a ruling: the blob, for a single carrier.

4. **`d`-tag composition for a non-community variant.** Recommendation: **`-in-<ctx>` stays,
   unchanged, when the variant names a known community; a non-community variant takes a
   distinct prefix — `pinVariantKey({ variant, isContext })` returning `-in-<slug>` or
   `-v-<slug>`.** Reason: `-in-` is context-shaped English and the community case must stay
   byte-identical (AC-2), while a distinct prefix makes the two kinds of second pin
   distinguishable in a `d` tag *for humans and logs* without any reader parsing it — the
   suffix's one job stays replaceability (ADR `feat-tags-modernization/0001:192-193`).
   Alternative worth ruling: one general form `-v-<slug>` for everything new, accepting that
   the same variant name yields different addresses depending on whether it is a community —
   which I think is worse, because promoting a recipe to a community would move the address.
   Either way `pinVariantKey` (`pins.js:39-41`) stays the single composer for all five schemes.

6. **The minimum switcher UX (AC-6).** Recommendation: **keep one chip row, with recipes
   visually and semantically separated from places** — places keep the 📌 + community name
   (`Tag.jsx:559`); recipes render with a different glyph and a group label (e.g. a "Your
   curations" divider after the contexts), ordered neutral → places → recipes. Creation is
   *not* added to `PinToContextModal` ("Pin to a community",
   `PinToContextModal.jsx:21,64`) — a recipe is created from the curation dialog, where the
   method and constraint it exists to vary already live. That satisfies the design doc's
   warning (a recipe is never rendered *as* a place) at the cost of one divider, and defers
   the real information-architecture round. Alternative worth ruling: no switcher entry at all
   in this story (variants reachable only by URL), shipping the protocol half and leaving the
   whole UX to the design round — smaller, but then AC-1 is not verifiable through the UI.
   **Note:** story 4's confirm step lands on this same surface — rule the two together.

7. **Uniqueness enforcement point (AC-3).** Recommendation: **client refuses, and it is the
   only enforcement in this story** — the publisher knows the viewer's existing pins of the
   tag (`src/api/profile-tags/index.js:900-905` already returns them) and can refuse before
   signing, which is the only point where a *message* can be shown. Server-side dedupe is not
   a real backstop here: nostr replaceable-event semantics mean a colliding pin doesn't
   duplicate, it **overwrites** — so a collision silently destroys the earlier pin, which is
   precisely why it must be caught pre-signature. What the server *should* do is stay
   idempotent and never invent a variant. Ruling wanted on whether the refresh runner should
   additionally log/skip on a detected collision rather than publishing over an address.

## Scoped gate proposal *(Gate A to confirm)*

`npm test -- test/explicit-pin-variant-key.test.js test/pin-stack-composition.test.js test/context-scoped-pins.test.js test/per-pin-membership-method.test.js test/item-trusted-list.test.js test/note-trusted-list.test.js`

- `test/explicit-pin-variant-key.test.js` — **new**, this story's suite.
- Guards (must stay green, unchanged): `test/pin-stack-composition.test.js` (the variant/`d`-tag
  spine and the byte-identity guarantee), `test/context-scoped-pins.test.js` (contextual pins
  keep working, AC-2/E1), `test/per-pin-membership-method.test.js` (story 3 still composes, E6),
  `test/item-trusted-list.test.js` and `test/note-trusted-list.test.js` (the note/item runners'
  own addresses).
- **Deliberately excluded from the judge gate:** `test/tl-membership-method-selector.test.js`
  (`test/registry.js:205`) — layer-3, publishes through a live control panel and strfry
  (`:16-20`), so it **hangs without a live stack**. Operator-run at Gate B.

## Uniqueness invariant (operator, 2026-09-18 — binding on this story, not an open question)

A pin's own address is `tag-pin-<slug>-<tagAuthor8>-<viewer8>` plus the variant key, and every
Trusted List it produces derives its address from the same inputs. Replaceable-event semantics
mean a second pin at the same address **silently replaces** the first — pin and lists together.
That is the protection today (a viewer cannot hold two colliding neutral pins) and the trap
for variants. This story must therefore:

1. put the variant into **both** the pin's address and its lists' addresses by construction
   (as `contextSlug` already is — `pinVariantKey`, `computeTLDTag`, `itemTlDTag`);
2. have the **client refuse** a variant slug already in use for that (observer, tag) **before
   anything is signed** — the only enforcement point that prevents the stomp;
3. have the runner **skip any pin whose author is not the observer** (operator ruling
   2026-09-18, superseding the earlier "detect and skip both": a pin about your point of view must
   be yours — the write-time twin of the read-time rule that a list's signer must be the
   observer's designated assistant), logging once; and, for the residual case of two of the
   observer's OWN pins resolving to one address, detect + log + skip both rather than publish
   over the earlier list.

Stories 1–3 touch no address (the author constraint and the membership method ride the
`curationMethod` blob).

## Linked artifacts

- Design target: `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3), § "Design note: per-pin
  curation implies multiple pins per tag" (`:187-225`), § "Why the address encodes identity
  and not method" (`:229-243`)
- Ledger: `OPEN.md:363` (OPEN 307)
- Split sibling: `engineering-team/stories/search-index-selection/3-per-pin-membership-method.md`
- Precedent ADRs: `engineering-team/decisions/feat-tags-modernization/0001-pin-stack-composition.md`
  (the variant-key mechanism this story generalises);
  `engineering-team/decisions/contextual-pins/0001-context-scoped-pins.md` (the pin/TL identity
  model); `engineering-team/decisions/search-index-selection/0001-author-constraint.md`
- ADR: (filled in after Architecture phase — expected: `decisions/search-index-selection/0003-…`)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)

## Gate A rulings (operator, 2026-09-18)

Light lane **with an ADR** (the variant rides the pin's `d` tag and every derived list address —
the search backend's permanent subscription key). Scoped gate as proposed (new
`test/explicit-pin-variant-key.test.js` + guards `pin-stack-composition`, `context-scoped-pins`,
`only-me-curation`, `per-pin-membership-method`, `item-trusted-list`, `note-trusted-list`;
`tl-membership-method-selector` operator-run at Gate B). Sequenced after story 4 (lands first).

1. **The variant lives in a pin tag** `['variant', '<slug>']`, not the `curationMethod` blob —
   identity readable without JSON parsing, never collapsible by a malformed blob. **Operator's
   question, answered:** the `d` tag stays unique *by construction* — the variant becomes one
   more input to the same address composers (pin d-tag AND `tlDTag` / `noteTlDTag` /
   `itemTlDTag`), so pins differing only by variant get distinct addresses; two pins sharing a
   variant slug would share an address and REPLACE each other, which is exactly what the
   Uniqueness invariant's client-side refusal prevents before signing.
2. **Address form:** the community suffix `-in-<ctx>` stays byte-identical for `KNOWN_CONTEXTS`;
   recipes take a distinct prefix (`-v-<slug>`) via one generalised `pinVariantKey`, so promoting
   a recipe to a community can never move an address.
3. **Minimum switcher UX:** one chip row, recipes visually and semantically separated from places
   (own glyph + a "Your curations" divider, ordered neutral → places → recipes); a recipe is
   created from the curation dialog (story 4's create mode gains a "Save as a separate curation"
   name field), never from `PinToContextModal`. The full IA round is deferred.
4. (Invariant, amended 2026-09-18) client refuses a used slug pre-signature; the runner skips a
   pin whose author ≠ observer (C3 — ADR 0003 §3) and logs + skips both on a residual own-pin
   collision. Designated-assistant pins (10040) are a follow-up.
