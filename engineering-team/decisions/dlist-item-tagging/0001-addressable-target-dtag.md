# ADR 0001: Addressable-target assertion `d`-tag — hash the full coordinate

**Status:** Proposed
**Date:** 2026-09-10
**Story:** `engineering-team/stories/dlist-item-tagging/2-addressable-target-dtag-collision.md`

> **Gate note.** The story is still **Draft** — it has not passed its human gate. This ADR is
> drafted ahead of that gate so the gate can weigh a concrete design; it stays **Proposed**
> until the story is approved and the ADR is ratified together. Nothing here is implemented.

## Context

The event-tagging spec (`protocols/drafts/event-taggings.md` § "The assertion d-tag (normative)",
lines 189–201) makes an assertion's `d` deterministic so each asserter holds exactly one live
stance per (descriptor, target):

```
d = event-tag-<descriptor>-<target8>-<asserter8>
```

For an `e` target, `<target8>` = first 8 hex of the event id. For an `a` target, the spec — and
the reference implementation `src/lib/event-tagging/builders.js:149–150`, pinned by
`test/event-tagging-core.test.js:117–130` — takes `<target8>` from the **author-pubkey segment**
of the coordinate (`address.split(':')[1].slice(0,8)`). Every addressable event by one author
therefore collapses to the same `<target8>`: one asserter applying one tag to two items by the
same author mints two events at the **same replaceable address**, and the relay keeps only the
later one. ADR `event-tagging/0001` (Implementation notes, "target8 = … the author-pubkey
segment") chose this rule explicitly because it needed no hashing; this ADR **supersedes that
single bullet** and nothing else in 0001.

Why it matters now: DList items are addressable (kind-39999, `<kind>:<author>:<d>`) and a list's
items are frequently by the same author (the `github-accounts` list has four of seven items under
`b83a28b7…`). Story 3 (tag a DList item) cannot ship on top of the current rule.

### Acceptance criteria (quoted)

- AC-1: two addressable targets, same author, different `d`, same asserter + tag → **different** `d` tags.
- AC-2: same (tag, target, asserter) built twice → **same** `d` (deterministic; republishing replaces).
- AC-3: `e` targets unchanged (`event-tag-<slug>-<id8>-<asserter8>`).
- AC-4: spec states the new `a` rule, records the old rule as superseded with the date, states the compatibility posture.
- AC-5: this ADR records the options (hash of full coordinate; author8 + d-slug; full coordinate verbatim), consequences incl. relay `d` length limits, and verifies the read side keys on `#a`, never on parsing `d`.
- AC-6: the pinned test is updated and a new regression test covers AC-1.

### Concepts touched (from the Concept Graph, port 8877)

- `39998:<TA>:nostr-event-tag` — "applies a specific Tag to a specific event (referenced by the e or a tag) … descriptor referenced indirectly via a z-tag … polarity 1/-1". Its **definition does not mention the `d` derivation**; that lives only in the spec + builder. So this story changes the wire rule, not the concept schema.
- `39998:<TA>:tagging-with-specific-tag` — the per-tag header; its `d` (`tagging:<slug>-tagging`) is untouched.

### Constraints established by reading the code

1. **Readers never parse `d`; they key on `#a` / `#e`.** Verified:
   - `src/lib/event-tagging/filters.js:28–36` `filterTagsAppliedToEvent` → `{kinds:[39999], '#a':[address]}` / `'#e'`.
   - `src/lib/event-tagging/classify.js:130–136` `targetOfCandidate` reads the `a`/`e` tag value, not `d`.
   - `src/api/event-tags/index.js:160–161` scans with `core.filterTagsAppliedToEvent`; its only `d` use is `dedupeReplaceable` (`:79–86`, latest-wins per `(pubkey, d)` — relay replaceable semantics, opaque to the string's shape) and header lookups by `#d` on the *header* coord (`:172, :471, :531, :604` — header `d`, not assertion `d`).
   - `grep -rn 'event-tag-\|target8' src/ ui/src/` — the only producer of the string is `builders.js`; every other hit is a test fixture or a `/^event-tag-/` **prefix** check (`test/event-tagging-write-path.test.js:62, :238`) which the new rule preserves.
   - Nothing under `ui/src` builds or parses an assertion `d` (`ui/src/hooks/useEventTagging.js:49` calls `applyEventTagging` from `@tapestry/event-tagging`; the `d` is composed inside the core).
2. **The core is dependency-free, CJS, and shared by both runtimes.** `src/lib/event-tagging/` is `require`d by the server and the node test runner, and imported in the browser via the `@tapestry/event-tagging` Vite alias (`ui/vite.config.js:12,24,32`). The purity guard (`test/event-tagging-core.test.js:235–248`) bans any `require` that isn't a `./sibling`, bans ESM `import`, and bans the **substrings** `crypto`, `http`, `wss:`, `fetch(`, `Date.now`. So `require('crypto')` / `node:crypto` is off the table inside the core, and any new core file must avoid those substrings even in comments.
3. **Builders are synchronous and pure** (`{kind,tags,content}` as a function of inputs). `applyEventTagging` (`apply.js:155`) calls `buildEventTaggingAssertion` synchronously inside a plan-building loop; making the builder async ripples into `apply.js`, the hook, and every test fixture.
4. **Existing hash precedent is a runtime-split twin**: `src/lib/dtag.js` `hash8` (sync, `node:crypto`) vs `ui/src/utils/dtag.js` `hash8` (async, `SubtleCrypto`). ADR `event-tagging/0001` deliberately avoided hashing in the core *to avoid that twin*. Any hashing option must not reintroduce it.
5. **Sync SHA-256 is available on both sides outside the core**: `node:crypto` server-side; `@noble/hashes/sha2.js` (`sha256`, sync) is present in `ui/node_modules` (v2.0.1, transitively via `nostr-tools 2.23.3`) and in root `node_modules` (v1.7.1). Neither is imported by any `ui/src` or `src/lib` file today.
6. **Relay tag-value limit**: `setup/strfry.conf.template:39` `maxTagValSize = 1024` (strfry's default). A `d` that exceeds it is rejected by the relay. Coordinates in the wild are already long — a live example on tags.brainstorm.world: `30023:2efaa715…:https://tomgruber.org/writing/ontology-of-folksonomy.htm-1778765623` (a 68-char `d` segment containing `:` and `/`).
7. **The pubkey-tag sibling** (`ui/src/utils/publishProfileTag.js:63`) derives `d = profile-tag-<slug>-<targetPubkey8>-<author8>`: 8 hex of a fixed-width identifier. The `e` case mirrors it. The design goal is for the `a` case to keep that *shape* — 8 hex of *something that uniquely identifies the target*.
8. **Origin drift (workflow step 0)**: `feat/dlist-item-tagging` is 26 commits behind `origin/staging`. None of the files this ADR touches (`builders.js`, `event-taggings.md`, `event-tagging-core.test.js`) are known to have moved; surfaced for the gate, not a blocker.

### Compatibility evidence (read-only census, 2026-09-10)

Script: `/tmp/claude-1000/-home-vcavallo-src-tapestry/4fe408ea-745c-4d36-82b1-d945df28e961/scratchpad/count-a-assertions.mjs` (discovers each relay's `nostr-event-tag` concept handles via `kinds:[39998], #d`, then scans `kinds:[39999], #z:[handles]`; a-target = has `a`, no `e`).

| Relay | assertions (all) | `e`-target | `a`-target (old rule) | (asserter, descriptor) groups with >1 `a` | of which same coord author (**live collision**) |
|---|---|---|---|---|---|
| `wss://tags.brainstorm.world/relay` | 108 | 101 | **7** (all `d` embed the coord author8) | 0 | **0** |
| `wss://staging.brainstorm.world/relay` | 0 | 0 | 0 | 0 | 0 |
| `wss://tapestry.brainstorm.world/relay` | 0 | 0 | 0 | 0 | 0 |
| local (`ws://localhost:8877/relay`; `:8777` refuses the handshake — strfry sits behind nginx) | 79 | 79 | 0 | 0 | 0 |

All 7 old-rule events are by a single asserter (`2efaa715…`, 5 distinct 30023 article targets + duplicates across descriptors). **No asserter has ever hit the collision.** The blast radius of the rule change is seven events on one non-production instance.

## Options considered

### Option A — `target8 = sha256(<full a-coordinate>)` first 8 hex  *(chosen)*

```
d = event-tag-<descriptor>-<hex8(sha256(utf8("<kind>:<author>:<d>")))>-<asserter8>
```

Hash the coordinate string **byte-for-byte as it appears in the `a` tag** (no normalization), take the first 8 hex chars. The `e` branch stays `id.slice(0,8)`.

- **Pros.** Fixed 8-char width — total `d` length is bounded by the slug alone, identical to the `e` case, so no `maxTagValSize` exposure and no new length class. Same *shape* as the `e` case and the pubkey-tag sibling ("8 hex of the target's identifier"): for an `e` target the identifier *is* a sha256 (the event id), so `a` targets now use the same primitive. Unambiguous: kind, author, and `d` all participate, so two different kinds by the same author with the same `d` (a collision Option B has) are distinct. Deterministic (AC-2), collision-free for any two distinct coordinates modulo 32-bit truncation (same odds as the `e` case today). Trivially re-implementable by any third party from the spec sentence alone.
- **Cons.** Needs SHA-256 inside a core that bans `crypto` and must run sync in Node and the browser (see sub-options). `d` becomes opaque for the `a` case (you can't eyeball which item it targets) — but nothing reads `d` for that; the `a` tag carries it. 8 hex = 32 bits: birthday collisions within one asserter's stances on one descriptor are ~1 in 4 billion per pair, the same exposure the `e` case has accepted since ADR 0001.

**How to get SHA-256 into the core (sub-options for A):**

- **A-i — a tiny pure-JS SHA-256 sibling module** `src/lib/event-tagging/sha256.js` (~60 lines: constants table, message schedule, one `sha256Hex(string)` export that UTF-8-encodes via a hand-rolled encoder or the global `TextEncoder`, which exists in Node ≥ 11 and every browser). Sync, zero imports, CJS, same file for both runtimes, passes the purity guard as long as the source avoids the banned substrings. Correctness is oracle-tested against `node:crypto` in the test suite (Tester's lane).
- **A-ii — inject `sha256Hex` as a builder/`applyEventTagging` dep**, supplied by the server (`node:crypto`) and the hook (`@noble/hashes/sha2.js`). Keeps hand-written hash code out of the repo, but makes a *protocol-normative* derivation the caller's responsibility: two callers with different hash impls (or one that forgets the dep) mint different addresses for the same stance, silently breaking replaceability. It also changes `buildEventTaggingAssertion`'s signature for every caller and fixture, and reintroduces exactly the "twin implementations to keep in sync" burden ADR 0001 avoided — now split across three places (server, hook, tests).
- **A-iii — `@noble/hashes` as a core dependency.** Rejected outright: violates the purity guard's sibling-only `require` rule and the "third-party dev copies the folder wholesale" goal from ADR 0001.

**Chosen: A-i.** The determinism of a replaceable address is a property of the protocol, not of the caller; it belongs inside the single source of truth. Sixty lines of SHA-256 with a `node:crypto` oracle test is far cheaper than a dep-injection contract that every future consumer (Jumble kit, NosFabrica kit, communities) has to get right.

### Option B — `target8 = <author8>-<d segment>` (readable)

```
d = event-tag-<descriptor>-<author8>-<coord d>-<asserter8>
```

- **Pros.** Human-readable; no hashing; trivial change to the builder.
- **Cons.** **Unbounded length**: the coordinate's `d` is arbitrary (the live 68-char URL-ish example above; kind-30023 `d`s are often slugs of titles, DList item `d`s are `slug-hash8`). Combined with the descriptor slug it can approach or exceed `maxTagValSize = 1024`, and other relays may cap lower. **Still collides** across kinds: `30023:X:foo` and `39999:X:foo` produce the same `d`; fixing that means embedding the kind too, growing the string further. **Delimiter ambiguity**: coord `d`s may contain `-`, `:`, `/`, spaces, and non-ASCII, so the `d` is no longer even loosely parseable into its fields (a property `event-tag-<slug>-<8hex>-<8hex>` has today and the pubkey-tag sibling relies on for its own shape). Breaks the "8 hex of an identifier" symmetry with the `e` case and `profile-tag-…`.

### Option C — full coordinate verbatim in `d`

```
d = event-tag-<descriptor>-<kind>:<author>:<d>-<asserter8>
```

- **Pros.** Maximally explicit; no hashing; no cross-kind collision.
- **Cons.** Everything in B's length and delimiter columns, worse: 64-hex author plus kind plus full `d` — a coordinate whose own `d` is anywhere near 1024 bytes yields an assertion the relay rejects, so some *valid* targets become untaggable. Colons inside a `d` value are legal but hostile to every `kind:pubkey:d` splitter in the codebase (`src/api/event-tags/index.js:62 isACoord`, the header regexes at `:172` etc.) should anyone ever address an assertion by coordinate. Duplicates information the `a` tag already carries.

### Option D — keep the rule; accept the collision

- **Pros.** Zero change; the 7 existing events keep their addresses.
- **Cons.** Fails AC-1 and blocks Story 3 outright: on `github-accounts` a user's second tagging of a `b83a28b7…` item erases the first. Not a real option; listed to make the cost of *not* changing explicit.

### Option E — hash both branches (`e` and `a`) uniformly  *(rejected, noted for completeness)*

Deriving `target8 = hex8(sha256(target identifier))` for `e` targets too would be prettier. Rejected because AC-3 forbids touching the `e` rule and there are **180 `e`-target assertions** live (101 on tags, 79 local) whose addresses would all silently orphan.

## Decision

We chose **Option A, sub-option A-i**: `<target8>` for an `a` target is the first 8 hex characters of the SHA-256 of the UTF-8 bytes of the full coordinate string, computed by a dependency-free sync `sha256Hex` sibling inside `src/lib/event-tagging/`. It is the only option that keeps `d` fixed-width (no `maxTagValSize` exposure), keeps the "8 hex of the target's identifier" shape shared with the `e` case and the pubkey-tag sibling, distinguishes kinds, and keeps the derivation inside the single source of truth so every consumer of the core — server, browser, the integration kits — mints the same address.

What we trade away: opacity of the `a`-case `d` (acceptable — nothing reads it), and ~60 lines of hand-written SHA-256 in the core (acceptable — oracle-tested, never changes).

## Consequences

- **Enables** Story 3: one asserter can hold independent stances on every item of a DList regardless of item authorship.
- **Wire-format change (irreversible, spec-level).** Every assertion on an `a` target minted after this lands has a different address from one minted before. The `e` rule, header `d`, `z` tags, `a` tag and polarity are unchanged, so **`#a`/`#e`/`#z` discovery and all read paths keep working without modification** (verified above — readers never parse `d`).
- **Compatibility posture — no migration, no migrator.** The 7 old-rule events (all on tags.brainstorm.world, one asserter, 0 collisions) stay valid, discoverable by `#a`, and bucketed identically by `classifyEventTaggings` / `indexByTag`. If that asserter re-asserts the same (tag, target) under the new rule, the old event is orphaned rather than replaced: same polarity → the POV sees two agreeing candidates from one pubkey (the API's `dedupeReplaceable` keys on `(pubkey, d)` and treats them as distinct; `classify.js` `mine` is latest-wins per (tag/target) so the viewer's own stance is correct, but the *counted* buckets are not deduped per asserter); flipped polarity → one apply and one dispute from the same pubkey both count. **Follow-up (not this story):** harden `classify.js` counted buckets to latest-wins per `(asserter, descriptor, target)` — cheap, spec-aligned ("one live stance per (descriptor, target)"), and closes the orphan case for good. Record as an `_intake.md` / OPEN row at implementation time. Staging, production, and local carry **zero** old-rule events, so the posture costs nothing there.
- **Spec + README.** `protocols/drafts/event-taggings.md` § d-tag gains the new rule, a dated "superseded 2026-09-10" note for the old author-segment rule, and one sentence of compatibility posture. `protocols/README.md:60` status row for Event Taggings gets this story appended to its "Story" column. The protocol author (David) owns the upstream draft — **notifying him is a named follow-up**, not a precondition.
- **Supersedes** the single "target8 = … author-pubkey segment" bullet in ADR `event-tagging/0001` Implementation notes (and that ADR's "no crypto in the core" rationale, now satisfied by a dependency-free sibling rather than by avoiding hashing). Everything else in 0001 stands.
- **New core file** `sha256.js` is subject to the purity guard: no `require` beyond siblings, no ESM, and — because the guard is a substring check — the source must not contain the tokens `crypto`, `http`, `wss:`, `fetch(`, `Date.now`. Comments must be written accordingly ("SHA-256 digest", not "cryptographic hash").
- **Constrains** nothing about `e` targets, headers, tag-elements, or the pubkey-tag sibling (`profile-tag-…` is a different kind of assertion and keeps its rule).
- **Does not change the concept graph.** `39998:<TA>:nostr-event-tag`'s description does not encode the `d` rule.
- **Firmware reinstall required?** **No.** No concept definition changes.

## Implementation notes

**`src/lib/event-tagging/sha256.js`** (new, CJS, zero imports)
- `sha256Hex(str)` → 64-char lowercase hex. UTF-8 encode the input (global `TextEncoder` is acceptable — present in Node ≥ 11 and browsers; or a ~10-line manual encoder if the Implementer prefers zero globals), standard FIPS 180-4 SHA-256 (64-entry K table, 8 IVs, 512-bit blocks, padding with 64-bit big-endian bit length). Use `>>>` / `| 0` for uint32 arithmetic. No `Buffer` (browser).
- Export `{ sha256Hex }` and also `hex8(str)` = `sha256Hex(str).slice(0, 8)` for readability at the call site.

**`src/lib/event-tagging/builders.js`** `buildEventTaggingAssertion` (~`:149–150`)
- Replace `target8 = (target.address.split(':')[1] || '').slice(0, 8)` with `target8 = hex8(target.address)`, hashing the address **exactly as supplied** (the same string placed in the `a` tag). Do not trim, lowercase, or reorder.
- Keep `id.slice(0, 8)` for the `e` branch untouched (AC-3).
- Update the inline comment and the file header ("Dependency-free: the only imports are sibling modules" still holds).
- Export nothing new from `index.js` unless the Tester's plan asks for `sha256Hex` to be reachable for the oracle test (exposing it via `index.js` is fine and harmless).

**`protocols/drafts/event-taggings.md`** § "The assertion d-tag (normative)" (~`:189–201`)
- `<target8>` bullet becomes: *the first 8 characters of the target's identifier: the **event id** for an `e` target, or the **lowercase hex SHA-256 of the UTF-8 bytes of the full coordinate string `<kind>:<author>:<d>`**, exactly as written in the `a` tag, for an `a` target.*
- Add: *Superseded 2026-09-10: the `a`-target rule previously used the author-pubkey segment of the coordinate, which collides across an author's addressable events. Assertions published under that rule remain valid — readers discover assertions by `#a`/`#e`, never by parsing `d` — but are not replaced by re-assertions under the current rule.*
- Keep the `e` sentence and the header `d` sentence verbatim; keep the spec-test invariants (`event-tag-` literal, `tagging:…-tagging`, no `//` in JSON blocks).

**`protocols/README.md:60`** — append `dlist-item-tagging #2` to the Story column.

**`ui/`** — no change. The hook already goes through `applyEventTagging`; Vite's `commonjsOptions.include` already covers `src/lib/event-tagging/**`, so the new sibling is bundled automatically. Verify once via cycle-local that the prod build resolves it (first new file in the aliased tree since ADR 0001).

**Tests** (Phase 3, Tester's lane — listed so the ADR's shape is checkable, not as instructions to the Implementer): the pinned addressable expectation at `test/event-tagging-core.test.js:117–130` must move to the new value (compute the expected `d` with `node:crypto` in the *test*, never in the core); a new AC-1 regression builds two same-author/different-`d` targets and asserts distinct `d`s; an oracle test compares `sha256Hex` to `node:crypto` for the empty string, a short ASCII coordinate, a >55-byte coordinate (padding boundary), a >64-byte one, and a coordinate with non-ASCII in `d`; the purity guard must keep passing with the new file present.

## Out of scope

- Any change to the `e`-target rule, the header `d`, the pubkey-tag `profile-tag-…` rule, or the concept definitions.
- A migrator or NIP-09 deletions for the 7 old-rule events.
- The read-side per-asserter latest-wins hardening in `classify.js` (named follow-up).
- Upstream ratification with the protocol author (named follow-up).
- Story 3's UI.
