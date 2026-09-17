# ADR 0001: Addressable-target assertion `d`-tag — hash the full coordinate

**Status:** Accepted
**Date:** 2026-09-10 (drafted Proposed; amended and Accepted the same day after operator discussion — see "Decision")
**Story:** `engineering-team/stories/dlist-item-tagging/2-addressable-target-dtag-collision.md` (Approved)

> **Amendment note (2026-09-10).** The first draft chose sub-option A-i (a hand-rolled SHA-256
> sibling inside the core). In discussion the operator overrode two things: (1) the `d` keeps
> **readable decoration** (`author8` + a bounded `d16` slice of the coordinate's `d`) in front of
> the hash, and (2) the core does **not** ship a SHA-256 — the hash is an **injected dependency**,
> exactly like the signer. The "Options considered" section is preserved as written for the
> record; the "Decision" section below is the binding one and supersedes the earlier choice of A-i.

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
9. **Who actually calls the builder today** (re-verified 2026-09-10 for the injection decision): `buildEventTaggingAssertion` is called from `src/lib/event-tagging/apply.js:155` only; `applyEventTagging` is called from `ui/src/hooks/useEventTagging.js:49` only. **No server module builds assertions** — `src/api/event-tags/index.js`, `src/api/trustedList/refreshPinnedTags.js`, and `refreshApplicabilityLists.js` `require` the core for read/curate helpers exclusively. Direct builder callers outside `src/lib` are tests: `test/event-tagging-core.test.js`, `test/event-tagging-write-path.test.js`, `test/tag-applicability.test.js`. `integration-kits/` does not exist on this branch.

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

*(Preserved as drafted. The sub-option chosen at draft time, A-i, was overridden in discussion — see "Decision".)*

### Option A — `target8 = sha256(<full a-coordinate>)` first 8 hex  *(chosen, as the uniqueness segment)*

```
d = event-tag-<descriptor>-<hex8(sha256(utf8("<kind>:<author>:<d>")))>-<asserter8>
```

Hash the coordinate string **byte-for-byte as it appears in the `a` tag** (no normalization), take the first 8 hex chars. The `e` branch stays `id.slice(0,8)`.

- **Pros.** Fixed 8-char width — total `d` length is bounded by the slug alone, identical to the `e` case, so no `maxTagValSize` exposure and no new length class. Same *shape* as the `e` case and the pubkey-tag sibling ("8 hex of the target's identifier"): for an `e` target the identifier *is* a sha256 (the event id), so `a` targets now use the same primitive. Unambiguous: kind, author, and `d` all participate, so two different kinds by the same author with the same `d` (a collision Option B has) are distinct. Deterministic (AC-2), collision-free for any two distinct coordinates modulo 32-bit truncation (same odds as the `e` case today). Trivially re-implementable by any third party from the spec sentence alone.
- **Cons.** Needs SHA-256 inside a core that bans `crypto` and must run sync in Node and the browser (see sub-options). `d` becomes opaque for the `a` case (you can't eyeball which item it targets) — but nothing reads `d` for that; the `a` tag carries it. 8 hex = 32 bits: birthday collisions within one asserter's stances on one descriptor are ~1 in 4 billion per pair, the same exposure the `e` case has accepted since ADR 0001.

**How to get SHA-256 into the core (sub-options for A):**

- **A-i — a tiny pure-JS SHA-256 sibling module** `src/lib/event-tagging/sha256.js` (~60 lines: constants table, message schedule, one `sha256Hex(string)` export that UTF-8-encodes via a hand-rolled encoder or the global `TextEncoder`, which exists in Node ≥ 11 and every browser). Sync, zero imports, CJS, same file for both runtimes, passes the purity guard as long as the source avoids the banned substrings. Correctness is oracle-tested against `node:crypto` in the test suite (Tester's lane). *(Draft-time choice; overridden.)*
- **A-ii — inject `sha256Hex` as a builder/`applyEventTagging` dep**, supplied by the server (`node:crypto`) and the hook (`@noble/hashes/sha2.js`). Keeps hand-written hash code out of the repo, but makes a *protocol-normative* derivation the caller's responsibility: two callers with different hash impls (or one that forgets the dep) mint different addresses for the same stance, silently breaking replaceability. It also changes `buildEventTaggingAssertion`'s signature for every caller and fixture, and reintroduces exactly the "twin implementations to keep in sync" burden ADR 0001 avoided — now split across three places (server, hook, tests). *(The final decision is a form of A-ii; the "forgets the dep" risk is closed by a fail-loud guard, and the "different impls" risk is judged nil because SHA-256 is SHA-256 — see Decision.)*
- **A-iii — `@noble/hashes` as a core dependency.** Rejected outright: violates the purity guard's sibling-only `require` rule and the "third-party dev copies the folder wholesale" goal from ADR 0001.

**Draft-time pick was A-i** on the argument that the determinism of a replaceable address is a property of the protocol and belongs inside the single source of truth. The operator's counter-argument, which carried: the *spec text* is the source of truth, not the JS; every nostr publisher already has SHA-256 in hand (event ids are SHA-256), so injecting it costs nobody anything, while sixty lines of hand-written hash code is a permanent maintenance and audit liability in a folder meant to be copied wholesale.

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

### Rejected in discussion (2026-09-10), briefly

Raised while settling the final shape; none survived:

- **`author8-<d>` verbatim** (Option B's readable form as the whole target segment) — unbounded length; the DList-item case alone (`slug-hash8` `d`s) is fine, but the rule has to hold for 30023 URL-ish `d`s too.
- **`head8 + tail8` of the `d`, or a sampled fingerprint** — bounded, but *lossy without a hash*: two `d`s sharing head and tail (or the sampled positions) collide, and there is no way to reason about the odds. A truncated SHA-256 gives 32 bits uniformly; a sample gives whatever the input happens to give.
- **FNV-1a** (a tiny non-cryptographic hash that *would* fit in the core) — introduces a **second hash convention** into a codebase that already standardizes on `hash8` = first 8 hex of SHA-256 (`src/lib/dtag.js`, `ui/src/utils/dtag.js`). The `ui/src/utils/dtag.js` file itself carries the warning: the sync FNV-like helper there is explicitly *not* for d-tag generation, "always use `hash8()` to match the server".
- **Core-shipped SHA-256** (A-i) — unnecessary once injection is accepted, and a permanent audit surface in a copy-wholesale folder.

## Decision

For an `a` target, the assertion `d` is:

```
d = event-tag-<slug>-<author8>-<d16>-<hash8>-<asserter8>
```

- **`<author8>`** — the first 8 hex of the coordinate's author-pubkey segment (as today). **Readable decoration only.**
- **`<d16>`** — the first 16 characters of the coordinate's `d` segment, **verbatim** (no slugging, no escaping, no lowercasing), truncated. **Readable decoration only.** The cut is what keeps `d` bounded — and therefore keeps *tagging-of-taggings* flat at every depth (see Consequences). A shorter `d` yields a shorter `d16`; an empty `d` yields an empty `d16` (`…-<author8>--<hash8>-…`), which is still a valid `d`.
- **`<hash8>`** — the first 8 hex of SHA-256 over the **full coordinate string** `<kind>:<author>:<d>` **exactly as carried in the `a` tag** (UTF-8 bytes; no trimming, normalization, or reordering). **This is the only segment that carries uniqueness.** It is the house `hash8` convention already used for DList item/set `d`-tags (`src/lib/dtag.js` `hash8`, `ui/src/utils/dtag.js` `hash8`).
- **`<asserter8>`** — unchanged. **The `e`-target rule is unchanged** (`event-tag-<slug>-<id8>-<asserter8>`, AC-3).
- **Normative reader rule:** readers **MUST NOT** parse `d` back into fields. `<d16>` is user-controlled text that may itself contain hyphens (and colons, slashes, spaces, non-ASCII), so the string is irreversible by construction; `<author8>` and `<d16>` are for a human eyeballing a relay dump, nothing more. The **`a` tag is authoritative** for the target; `d` is only the replaceability key. (Already the case for every reader in this codebase — Constraint 1 — now stated in the spec rather than merely observed.)

**Implementation shape — the hash is an injected dependency.** The dependency-free core ships no SHA-256. `buildEventTaggingAssertion` gains a `hash8` option, `(str) => 8-hex-string`, injected exactly as the signer is injected into `applyEventTagging` today. Rationale recorded from discussion:

1. Every nostr publisher already has SHA-256 — event ids *are* SHA-256 — so the cost of supplying it falls on nobody. There is no "different impl" risk worth designing around: SHA-256 is a fixed function; a caller that supplies something else is simply non-conformant with the spec sentence, which is the same status as a caller that composes the `d` by hand.
2. The **spec text is normative, not the JS.** The core is a reference implementation of the wire shape; the derivation rule lives in `protocols/drafts/event-taggings.md`, which is what a third-party client reads.
3. The purity guard (`test/event-tagging-core.test.js:235–248`, bans the `crypto` substring and any non-sibling `require` in core files) **stays intact, unchanged.**
4. The "forgot the dep" failure mode from A-ii's cons is closed by a fail-loud guard (below), not by shipping hash code.

**Sync builder, async-tolerant orchestrator — decided.** Of the two shapes the discussion left open (builder becomes async vs. caller pre-computes), we take the second, in this specific form:

- `buildEventTaggingAssertion` **stays synchronous and pure**: `hash8` is a *sync* `(str) => 8-hex` function. Direct callers (tests, any future server caller) pass a sync closure over `node:crypto`.
- `applyEventTagging` accepts `deps.hash8` that may be **sync or async** (`(str) => 8-hex | Promise<8-hex>`). Because `applyEventTagging` is already async and the target address is known before the plan is built, it resolves the hash **once, up front** — `const h = await deps.hash8(target.address)` for an `a` target — and hands the builder a sync closure pinned to that exact string. This keeps `apply.js`'s plan loop and `wrap` (`apply.js:106–109`) untouched, keeps every builder fixture sync, and lets the browser hook pass the existing async SubtleCrypto `hash8` from `ui/src/utils/dtag.js` **as-is**, with no new browser code and no `@noble/hashes` import.

**Fail loud.** Mirroring `requireHex64` (`builders.js:31`): when the target is an `a` coordinate and `hash8` is not a function, the builder throws `event-tagging: hash8 dep is required to build an a-target assertion (SHA-256 first-8-hex over the full coordinate)`; when it returns anything other than `/^[0-9a-f]{8}$/`, the builder throws (a `requireHex8` helper, same style). `applyEventTagging` additionally requires `deps.hash8` to be a function in its entry check (`apply.js:93–95`), uniformly with `sign`/`publish`/`now`, so a misconfigured caller fails before any discovery or signer prompt — an `e`-only caller that omits it would otherwise pass until its first `a` target, which is exactly the silent-orphan failure the guard exists to prevent.

**Call sites that must supply `hash8`** (from Constraint 9):

| Call site | Supplies | Runtime |
|---|---|---|
| `ui/src/hooks/useEventTagging.js` (`applyEventTagging` deps, `:49–66`) | `hash8` from `ui/src/utils/dtag.js` (async, SubtleCrypto) | browser — the **only production caller today** |
| `src/lib/event-tagging/apply.js` (`buildEventTaggingAssertion` call, `:155`) | the sync closure over the pre-resolved value | both (core plumbing, not a supplier) |
| any server caller of `buildEventTaggingAssertion` / `applyEventTagging` under `src/api/event-tags/*` or elsewhere in `src/` | `hash8` from `src/lib/dtag.js` (sync, `node:crypto`) | Node — **none exist today**; the rule binds the first one |
| `test/event-tagging-core.test.js`, `test/event-tagging-write-path.test.js`, `test/tag-applicability.test.js` (direct builder / orchestrator calls) | a `node:crypto` closure in the test | Node (Tester's lane) |
| `integration-kits/*` | n/a on this branch (folder absent); any kit that vendors the core must document the dep alongside `sign` | — |

What we trade away: the derivation is no longer executable from the core alone (a copy-wholesale consumer must wire one more dep — the same class of obligation as `sign`), and the `d` is now a mixed readable/opaque string rather than the pure `8hex-8hex` shape. Both accepted in discussion.

## Consequences

- **Enables** Story 3: one asserter can hold independent stances on every item of a DList regardless of item authorship.
- **Worked example** (values computed with `node:crypto` from the repo root, `direnv exec . node -e …`, and re-verified 2026-09-10 while amending):

  | `a` coordinate | `hash8` |
  |---|---|
  | `39999:b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450:vcavallo-1i6dn0p` | `086cb8ff` |
  | `39999:b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450:aburra16-io3q45` | `878ce18a` |

  Asserter `<asserter8>` tagging both `github-accounts` items with `white-hat-hacker`:

  ```
  event-tag-white-hat-hacker-b83a28b7-vcavallo-1i6dn0p-086cb8ff-<asserter8>
  event-tag-white-hat-hacker-b83a28b7-aburra16-io3q45-878ce18a-<asserter8>
  ```

  Same `author8`, distinct `hash8` → distinct addresses (AC-1). Under the old rule both were `event-tag-white-hat-hacker-b83a28b7-<asserter8>`. (`vcavallo-1i6dn0p` is exactly 16 chars, so `d16` happens to be the full `d`; `aburra16-io3q45` is 15.)
- **Recursion — tagging a tagging.** Assertions are themselves kind-39999 addressables, so they are valid `a` targets. Bob disputes Alice's assertion above (Alice = `aaaaaaaa…`):

  ```
  target a = 39999:<alice>:event-tag-white-hat-hacker-b83a28b7-vcavallo-1i6dn0p-086cb8ff-aaaaaaaa
  d        = event-tag-disputed-claim-aaaaaaaa-event-tag-white--<hash8(alice's full coord)>-<bob8>
  ```

  `d16` = `event-tag-white-` (16 chars, trailing hyphen included — hence the `--`). Properties: **length is flat at every depth** (slug + 8 + 16 + 8 + 8 + separators, regardless of how long the target's own `d` was); **uniqueness is exact** (the hash covers the full target coordinate); **`d16` readability degrades with depth** — every nested target's `d16` starts `event-tag-`, so from depth 2 on the decoration says only "this targets a tagging". **Accepted; no prefix-stripping rule.** A stripping rule would be a second spec rule to get wrong for a segment that is decoration by definition.
- **Length bound.** Worst case `d` = `event-tag-` (10) + slug + 1 + 8 + 1 + 16 + 1 + 8 + 1 + 8 = slug + 54 chars (plus UTF-8 width of `d16` if non-ASCII, ≤ 64 bytes). Far under `maxTagValSize = 1024`; no new length class, and the bound no longer depends on the target at all.
- **Wire-format change (irreversible, spec-level).** Every assertion on an `a` target minted after this lands has a different address from one minted before. The `e` rule, header `d`, `z` tags, `a` tag and polarity are unchanged, so **`#a`/`#e`/`#z` discovery and all read paths keep working without modification** (verified above — readers never parse `d`; now also normative).
- **Compatibility posture — no migration, no migrator. Census stands as is.** The 7 old-rule events (all on tags.brainstorm.world, one asserter, 0 collisions) stay valid, discoverable by `#a`, and bucketed identically by `classifyEventTaggings` / `indexByTag`. If that asserter re-asserts the same (tag, target) under the new rule, the old event is orphaned rather than replaced: same polarity → the POV sees two agreeing candidates from one pubkey (the API's `dedupeReplaceable` keys on `(pubkey, d)` and treats them as distinct; `classify.js` `mine` is latest-wins per (tag/target) so the viewer's own stance is correct, but the *counted* buckets are not deduped per asserter); flipped polarity → one apply and one dispute from the same pubkey both count. **Follow-up (not this story):** harden `classify.js` counted buckets to latest-wins per `(asserter, descriptor, target)` — cheap, spec-aligned ("one live stance per (descriptor, target)"), and closes the orphan case for good. Record as an `_intake.md` / OPEN row at implementation time. Staging, production, and local carry **zero** old-rule events, so the posture costs nothing there.
- **Spec + README.** `protocols/drafts/event-taggings.md` § d-tag gains the new rule *including the MUST NOT parse sentence*, a dated "superseded 2026-09-10" note for the old author-segment rule, and one sentence of compatibility posture. `protocols/README.md:60` status row for Event Taggings gets this story appended to its "Story" column. The protocol author (David) owns the upstream draft — **notifying him is a named follow-up**, not a precondition.
- **Supersedes** the single "target8 = … author-pubkey segment" bullet in ADR `event-tagging/0001` Implementation notes. That ADR's "no crypto in the core" rationale is **upheld, not overturned** — the core still contains no hashing; it is supplied by the caller. Everything else in 0001 stands.
- **Builder/orchestrator contract change.** `buildEventTaggingAssertion` gains a required-for-`a` `hash8` option; `applyEventTagging` gains a required `deps.hash8`. Every direct caller in `test/` and the hook must be updated in the same change. The core's dep contract string in `apply.js:94` becomes `{ findHeaders, sign, publish, now, hash8 }`.
- **Purity guard unchanged.** No new core file; `builders.js` and `apply.js` gain code that must avoid the banned substrings (write "SHA-256 digest" / "hash8", never the banned token, in comments).
- **Constrains** nothing about `e` targets, headers, tag-elements, or the pubkey-tag sibling (`profile-tag-…` is a different kind of assertion and keeps its rule).
- **Does not change the concept graph.** `39998:<TA>:nostr-event-tag`'s description does not encode the `d` rule.
- **Firmware reinstall required?** **No.** No concept definition changes.

## Implementation notes

**`src/lib/event-tagging/builders.js`** `buildEventTaggingAssertion` (~`:121–169`)
- Signature: `({ headerAuthorPubkey, slug, target, polarity, asserterPubkey, taPubkeys, hash8 })`. `hash8` is `(str) => string` and is consulted **only** on the `a` branch.
- `a` branch (~`:148–150`): replace the author-segment `target8` with
  - `author8 = (address.split(':')[1] || '').slice(0, 8)`;
  - `d16 = address.split(':').slice(2).join(':').slice(0, 16)` — the `d` segment is everything after the second colon (coordinate `d`s may themselves contain `:`; Constraint 6's live example does), verbatim, truncated to 16 UTF-16 code units (JS `slice`; this is the spec's "16 characters");
  - `if (typeof hash8 !== 'function') throw …` (message above); `h = hash8(address)` on the address **exactly as placed in the `a` tag**; `requireHex8(h, 'hash8 result')`;
  - `targetSeg = \`${author8}-${d16}-${h}\``.
- `e` branch untouched (AC-3). The final composition stays `event-tag-${slug}-${targetSeg}-${asserter8}`.
- Add `requireHex8(value, label)` beside `requireHex64` (`:31`), `/^[0-9a-f]{8}$/`.
- Update the inline comment and the file header: the core is still dependency-free; the SHA-256 is supplied by the caller for the same reason the signer is.

**`src/lib/event-tagging/apply.js`** `applyEventTagging` (~`:89–95, :155–157`)
- Entry check (`:93–94`): add `typeof deps.hash8 !== 'function'` to the guard; update the message and the JSDoc at `:10` and `:89` to list `hash8`.
- Before the plan is built (anywhere after target validation, before `:155`): `const targetHash8 = target && typeof target.address === 'string' ? await deps.hash8(target.address) : null;` — `await` is a no-op for a sync supplier.
- At `:155`, pass `hash8: (s) => { if (s !== target.address) throw new Error('event-tagging: hash8 closure called with a different string than it was resolved for'); return targetHash8; }`. The guard is defensive only (the builder hashes the same address it places in the tag), but it documents the pin.

**`ui/src/hooks/useEventTagging.js`** (`:49–66`)
- `import { hash8 } from '../utils/dtag';` and add `hash8` to `deps`. No other change; SubtleCrypto is async and `applyEventTagging` awaits it.

**Server** — no production caller exists today (Constraint 9). If one is added under `src/api/event-tags/*` (or anywhere in `src/`), it supplies `hash8` from `src/lib/dtag.js` (`const { hash8 } = require('../../lib/dtag')`) — the sync `node:crypto` implementation that already mints DList `d`-tags. Do **not** write a third `hash8`.

**`protocols/drafts/event-taggings.md`** § "The assertion d-tag (normative)" (~`:189–201`)
- Replace the `a`-target `<target8>` bullet with the five-segment rule above: `author8` and `d16` as readable decoration, `hash8` as the first 8 lowercase hex characters of the SHA-256 of the UTF-8 bytes of the full coordinate string `<kind>:<author>:<d>` exactly as written in the `a` tag, and the sentence: *Readers MUST NOT parse `d` into its fields; `d` is user-influenced text and is irreversible by construction. The `a` (or `e`) tag is authoritative for the target.*
- Add: *Superseded 2026-09-10: the `a`-target rule previously used only the author-pubkey segment of the coordinate, which collides across an author's addressable events. Assertions published under that rule remain valid — readers discover assertions by `#a`/`#e`, never by parsing `d` — but are not replaced by re-assertions under the current rule.*
- Include the worked example rows from Consequences (the two `github-accounts` items) and, optionally, the recursion example.
- Keep the `e` sentence and the header `d` sentence verbatim; keep the spec-test invariants (`event-tag-` literal, `tagging:…-tagging`, no `//` in JSON blocks).

**`protocols/README.md:60`** — append `dlist-item-tagging #2` to the Story column.

**Tests** (Phase 3, Tester's lane — listed so the ADR's shape is checkable, not as instructions to the Implementer): the pinned addressable expectation at `test/event-tagging-core.test.js:117–130` moves to the new five-segment value with `hash8` supplied from `node:crypto` *in the test*; a new AC-1 regression builds the two `github-accounts` coordinates above and asserts distinct `d`s with the expected `086cb8ff` / `878ce18a` segments; an AC-2 determinism check builds one twice; a fail-loud test asserts the builder throws on an `a` target with no `hash8`, and that `applyEventTagging` throws at entry without `deps.hash8`; a recursion test builds the "tagging a tagging" case and asserts the `d` length equals the depth-1 length for the same slug; every existing fixture that calls the builder or orchestrator (`event-tagging-write-path.test.js`, `tag-applicability.test.js`) gains the dep; the purity guard must keep passing (no `crypto` token lands in `builders.js` / `apply.js`).

## Out of scope

- Any change to the `e`-target rule, the header `d`, the pubkey-tag `profile-tag-…` rule, or the concept definitions.
- A migrator or NIP-09 deletions for the 7 old-rule events.
- The read-side per-asserter latest-wins hardening in `classify.js` (named follow-up).
- Upstream ratification with the protocol author (named follow-up).
- A prefix-stripping or any other readability rule for nested `d16`.
- Story 3's UI.
