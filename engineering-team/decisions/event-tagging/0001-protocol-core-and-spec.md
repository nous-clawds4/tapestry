# ADR 0001: Event-tagging protocol core library + spec finalization

**Status:** Proposed
**Date:** 2026-06-25
**Story:** `engineering-team/stories/event-tagging/1-protocol-core-and-spec.md`

## Context

Story 1 establishes the **contract** for the event-tagging epic before any firmware, server, UI, or publishing: a generic NIP-style spec in `protocols/` and a **dependency-free, framework-agnostic core library** that constructs the protocol's three event shapes and its discovery filters. Everything later (read API, write path, UI) consumes this core rather than re-deriving the wire shape. The operator requires the core be **SDK-extractable** — a third-party dev adding kind-1 tagging to their own app must lift it wholesale.

We implement **David's `event-taggings.md` literally** — indirect tagging via a `z`-tag descriptor and a per-tag `tagging-with-specific-tag` header (PR #325). The AI-reviewer's "collapse to direct z→tag" redesign is explicitly rejected per the operator.

Constraints pulled from the codebase and house rules:

- **Two runtimes, two module systems, no build step for shared code.** Root project is **CommonJS** (`package.json` has no `"type":"module"`); the server and the test runner (`node test/test.js`) both `require`. The UI is a **separate ESM package** (`ui/package.json` `"type":"module"`, Vite). This split is exactly why `dtag.js` exists as **twin files** — `src/lib/dtag.js` (CJS) ⟷ `ui/src/utils/dtag.js` (ESM).
- **But the dtag twin is forced by runtime-specific crypto** — server `crypto` (sync) vs browser `SubtleCrypto` (async) `hash8`. **Our core needs no crypto:** the assertion d-tag is pure string-slicing (`profile-tag-<slug>-<t8>-<a8>` in `ui/src/utils/publishProfileTag.js:58`), no hashing. So our core can be a **single runtime-agnostic source of truth**, avoiding the twin-file sync burden.
- **Zero deps / zero app coupling, no I/O, no signing** (story ACs). `taPubkey` is a **parameter**, never hardcoded (CLAUDE.md "Per-deployment TA pubkey — NEVER hardcode"). The core builds **unsigned** events; the caller adds `pubkey`/`created_at` and signs.
- **The two new concepts are not seeded** (concept-graph check confirms no `nostr-event-tag` / `tagging-with-specific-tag`). The core only *composes their handles as strings* — it doesn't require them to exist; Story 3 seeds them.
- **The existing `nostr-user-tag` wire shape is the sibling to mirror** (`ui/src/utils/publishProfileTag.js:71–87`, `protocols/drafts/tags.md:47–62`): kind-39999, deterministic `d`, `z`→concept, `polarity` ±1, content mirror.
- **`tags.md` already reserves us a slot** — its "Event tagging (planned)" section (`tags.md:94–96`) and the `nostr-event-tag` family member (`tags.md:19`) point forward to this spec. Worksheets [W4] (e-vs-a), [W3] (polarity arc), [W10] (taggings-family naming) are the open-question anchors.
- **Pre-existing slug discrepancy.** `src/lib/dtag.js:slug` strips diacritics (NFD); the pubkey feature's `useProfileTags.js` `slugify` (createTag) does **not**. Tag-elements are shared between user-tagging and event-tagging (same `39998:<TA>:tag` concept), so slug derivation must be uniform. This ADR picks the canonical (`dtag.js`) slug and flags the divergence for the write-path story.
- **protocols/ conventions** (`protocols/README.md`): every spec opens with a `> **Repo metadata**` block (Status / Canonical / Sources) + `---` + `Title\n=====`; the boundary rule keeps stack details out (handles are written as "the deployment's `…` concept", never literal pubkeys); the file stays in `drafts/` as 📝 pre-NIP. The current `protocols/drafts/event-taggings.md` lacks the metadata header and several normative bits.

No concept definitions change in this story → **no firmware reinstall**.

## Options considered

### Option A — Single canonical dependency-free **CJS** module in `src/lib/event-tagging/`; spec links to it as the reference impl

A small folder of pure modules (`builders.js`, `filters.js`, `handles.js`, `slug.js`, `index.js`), CommonJS, zero imports. `require`d natively by the CJS test runner now and the CJS server later (Story 4); consumed by the Vite UI later (Story 6) via interop or a thin ESM shim. The generic spec in `protocols/` is the *documentation* and points to this module as its reference implementation — **no third code copy**.

- **Pros:** One source of truth (no twin-file drift — justified because no runtime-specific APIs). Native `require` for the two CJS consumers that exist first. Self-contained folder a third-party dev copies wholesale. Matches `src/lib/dtag.js` placement. Deterministic, unit-testable in isolation.
- **Cons:** The ESM/Vite UI must consume CJS (interop or one-line shim) — a Story-6 detail, not now. `src/lib` *reads* as stack-internal, but the file imports nothing, so extraction is unaffected.

### Option B — Twin files like `dtag.js` (`src/lib/event-tagging.*` CJS + `ui/src/utils/eventTagging.*` ESM)

Mirror the established `dtag.js` pattern: two near-identical copies, one per runtime, kept in sync by the "must match exactly" doctrine.

- **Pros:** Exactly matches an existing precedent; each runtime imports natively.
- **Cons:** Permanent sync burden for **zero benefit** — unlike `dtag.js`, nothing here is runtime-specific, so the two copies would be byte-identical but for the export footer. Two "SDK seeds" muddies which one a third-party dev copies. Rejected: the only reason the precedent duplicates does not apply to us.

### Option C — Author the core *inside* `protocols/` and import it from app code

Put the reference module under `protocols/reference/event-tagging/` and have the server/test/UI import from there.

- **Pros:** Code sits literally beside the spec; maximally obvious as the SDK seed.
- **Cons:** `protocols/` is a **docs** directory, deliberately off the app's import graph (`README.md` boundary rule). Making server/test/UI depend on files under `protocols/` couples runtime code to the docs tree and crosses the Vite package boundary awkwardly. Rejected: violates the directory's stated role.

## Decision

**Option A.** A single dependency-free **CommonJS** core under `src/lib/event-tagging/`, unit-tested by the existing CJS runner, with the generic spec finalized **in place** at `protocols/drafts/event-taggings.md` (📝 pre-NIP) pointing to that module as its reference implementation.

Rationale: it is the one option that serves all four consumers (CJS test runner now; CJS server and ESM/Vite UI later; third-party copy-paste) from a single source of truth, *because* the module has no runtime-specific dependencies — the precise condition that forces `dtag.js` to duplicate is absent here. Keeping the spec in `protocols/` (docs) and the code in `src/lib/` (runtime) honors the directory boundary while still giving the dev a self-contained folder to lift.

## Consequences

- **Enables** Stories 3–6 to consume one audited wire-shape source: read filters (Story 4), publish builders (Story 5), and the UI (Story 6) all call the same functions. Determinism (no `Date.now()` in the core) makes input→exact-JSON tests trivial.
- **Constrains** the UI (Story 6) to consume CJS — resolved there by a thin ESM re-export shim or Vite alias (recorded below), **not** a byte-duplicated twin.
- **Follow-ups / debt:**
  - The `slug` divergence (`useProfileTags.slugify` vs canonical) must be reconciled when the write path creates tags (Story 5). Flagged, not fixed here.
  - The `<target8>` field of the assertion `d`-tag is undefined in the draft for addressable targets; this ADR defines it (below) and the spec records it normatively.
  - External SDK packaging (publishing an npm/ESM build) is a future concern; the core stays plain CJS for now.
- **Firmware reinstall required?** **No.** This story changes no concept definitions. (Story 3 seeds the two new concepts and *will* require a reinstall.)

## Implementation notes

### Module layout — `src/lib/event-tagging/` (CommonJS, zero imports)

All builders return a **partial unsigned event** `{ kind, tags, content }` (no top-level `pubkey`/`created_at` — the caller/signer adds those; this keeps the core pure and deterministic). All filter builders return **plain nostr filter objects**.

**`handles.js`** — pure handle composers (take `taPubkey`/pubkeys as params):
- `conceptTag(taPubkey)` → `39998:${taPubkey}:tag`
- `conceptNostrEventTag(taPubkey)` → `39998:${taPubkey}:nostr-event-tag`
- `conceptTaggingWithSpecificTag(taPubkey)` → `39998:${taPubkey}:tagging-with-specific-tag`
- `tagElementAddr(authorPubkey, slug)` → `39999:${authorPubkey}:${slug}`
- `taggingHeaderAddr(authorPubkey, slug)` → `39999:${authorPubkey}:tagging:${slug}-tagging`

**`slug.js`** — `slug(name)` byte-identical to `src/lib/dtag.js:slug` (lowercase, NFD diacritic strip, non-alnum→`-`, trim). Self-contained copy (no `require` of dtag) so the module is extractable.

**`builders.js`:**
- `buildTagElement({ name, description, taPubkey })` → `{ kind:39999, tags:[ ['d', slug(name)], ['z', conceptTag(taPubkey)] ], content: JSON.stringify({ tag:{ slug:slug(name), name, description: description||'' } }) }`. (Mirrors the existing tag-element shape; content is required by the `tag` concept's processors.)
- `buildTaggingHeader({ tagAuthorPubkey, slug, name, description, taPubkey })` → `{ kind:39999, tags:[ ['d', `tagging:${slug}-tagging`], ['names', name, <plural?>], ['description', description], ['z', conceptTaggingWithSpecificTag(taPubkey)], ['a', tagElementAddr(tagAuthorPubkey, slug)] ], content:'' }`. (Simultaneously a list header — `names`/`description`/`d` — and a list item — `z`+`a` — exactly per the draft's "Awesome Tag Taggings" header. Caller passes `slug` of the already-resolved tag-element; the builder does not re-slug.)
- `buildEventTaggingAssertion({ headerAuthorPubkey, slug, target, polarity, asserterPubkey, taPubkey })` where `target` is `{ id }` (kind-1 note → emits `['e', id]`) **or** `{ address }` (addressable → emits `['a', address]`). Returns:
  ```
  { kind:39999, tags:[
      ['d', `event-tag-${slug}-${target8}-${asserterPubkey.slice(0,8)}`],
      [targetTag…],                                   // ['e', id] | ['a', address]
      ['z', conceptNostrEventTag(taPubkey)],
      ['z', taggingHeaderAddr(headerAuthorPubkey, slug)],
      ['polarity', String(polarity)] ],
    content:'' }
  ```
  - `target8` = `id.slice(0,8)` for `{ id }`; `address.split(':')[1].slice(0,8)` (the author-pubkey segment) for `{ address }`. Deterministic, no crypto. Defined normatively in the spec.
  - Validate `polarity ∈ {1,-1}` and pubkeys match `/^[0-9a-f]{64}$/`; throw on malformed (mirrors `publishProfileTag.js:54`). No e-only/silent fallbacks.

**`filters.js`** (return plain filter objects; results are **candidates**, POV-filtered at read time in Story 4):
- `filterTaggingsUsingTag({ headerAuthorPubkey, slug })` → `{ kinds:[39999], '#z':[ taggingHeaderAddr(headerAuthorPubkey, slug) ] }`
- `filterTagsAppliedToEvent({ target })` → `{ id }` ⇒ `{ kinds:[39999], '#e':[ id ] }`; `{ address }` ⇒ `{ kinds:[39999], '#a':[ address ] }`
- `filterTaggingHeadersForTag({ tagAuthorPubkey, slug, taPubkey })` → `{ kinds:[39999], '#a':[ tagElementAddr(tagAuthorPubkey, slug) ], '#z':[ conceptTaggingWithSpecificTag(taPubkey) ] }` (the per-tag headers that exist for a tag — the reverse-lookup the draft describes).

**`index.js`** — re-export all of the above.

### Spec finalization — `protocols/drafts/event-taggings.md` (edit in place, keep David's structure)

Keep the indirect-header protocol **unchanged**. Complete it to spec-grade:
1. Prepend the standard metadata block (`> **Repo metadata** Status: 📝 pre-NIP / Canonical: not yet published / Sources: PR #325, this ADR, `tags.md`) + `---` + `Event Taggings\n=====` title.
2. Add a **Polarity** section by reference to `tags.md:64–66` (`"1"` apply / `"-1"` dispute / absent = apply; graded interval reserved → W3). Note polarity is multi-letter ⇒ not relay-filterable ⇒ dispute-exclusion is a read-time POV op.
3. Promote the **deterministic `d`-tag** forms to normative lines: assertion `event-tag-<slug>-<target8>-<asserter8>` (define `<target8>` as above) and header `tagging:<slug>-tagging`. **Remove the `//` comments** from the JSON examples (invalid JSON — hygiene, not a design change).
4. Add a **read-time / POV framing** paragraph: discovery filters return *candidates*; whether a tagging "counts" is a per-POV WoT computation at read time (invariants #1/#3), not global truth.
5. Add a **Relationship to other specs** section linking `tags.md` (the `nostr-event-tag` family member it realizes) and naming W4/W10. Flip `tags.md:94–96` "Event tagging (planned)" to a pointer at this spec.
6. Add a **firmware-seeding note**: the two TA-authored DList headers (`nostr-event-tag`, `tagging-with-specific-tag`) are seeded by the per-deployment TA (Story 3); handles are written as "the deployment's `…` concept", never literal pubkeys.
7. **Correct the worked-example discovery queries** so they are internally consistent **within David's structure** (the draft's first query references a header that is never declared, and lists a contradictory "direct tagging" query). This is example-correctness, *not* the reviewer's structural collapse — the per-tag-header design stays.
8. Index the spec in `protocols/README.md`.

### Testing seam (for the Tester, Story 1)
Pure `require('../src/lib/event-tagging')` in the CJS harness; assert each builder's exact `{kind,tags,content}` against fixed inputs (a fixed `taPubkey`, pubkeys, slug, target) and each filter's exact object. No relay, no signing, no `Date.now()`. A coupling test asserts the module's source contains no `require(` of app paths and no `PUBLISH_RELAYS`/network references.

## Out of scope

- **UI consumption mechanism** (ESM shim vs Vite alias) — Story 6.
- **Server read consumption** and POV trust scoring — Story 4.
- **Signing, publishing, the 3-publish orchestration, the global publish gate** — Stories 2/5.
- **Firmware seeds** for the two concepts — Story 3.
- **Reconciling the `slug` divergence** in `useProfileTags.js` — Story 5.
- **Ratifying the spec out of `drafts/`** into a published NIP — future, via the protocol-spec workflow.
