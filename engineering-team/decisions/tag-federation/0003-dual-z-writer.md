# ADR 0003: Dual-z writer — stamp canonical + local `z` on new tags/taggings (W11 applied)

**Status:** Proposed
**Date:** 2026-06-17
**Story:** `engineering-team/stories/tag-federation/3-dual-z-writer.md`
**Builds on:** ADR-0015 (the `LEGACY_*_PUBKEY` named-exception concepts + the literal `82b75e47…` *coordinate*), ADR-0022 (the `nostr-user-tag` hybrid `e`+`a` parent reference), tag-federation ADR 0001 (Half-1 read-union on the **canonical** z), tag-federation ADR 0002 (the per-concept pointer-`b` seed — the "map" the local z roots against), and `community-reference` ADR 0033 (W11 cloud-formation frame, design-only / resolver-gated).
**Citation hygiene:** ADR ids are epic-scoped. Cite this as **tag-federation ADR 0003**. Every `82b75e47…` in this ADR is the ADR-0015 legacy *coordinate string* (the canonical-z data literal), **never** a hardcoded signing key. The **local** z is always the *runtime* instance TA (`useConfig().taPubkey`) — never a literal.

## Context

Today a newly created **tag element** (`useProfileTags.createTag`, `ui/src/hooks/useProfileTags.js:103-129`) and a newly published **tagging assertion** (`publishProfileTagAssertion`, `ui/src/utils/publishProfileTag.js:45-81`) each carry exactly **one** `z` tag — the **canonical** z, composed from the ADR-0015 legacy literal:

- `createTag` stamps `['z', TAG_HANDLE]` where `TAG_HANDLE = \`39998:${TA_PUBKEY}:tag\`` and `TA_PUBKEY = '82b75e47…'` (`useProfileTags.js:6-7,114`).
- `publishProfileTagAssertion` stamps `['z', NOSTR_USER_TAG_HANDLE]` where `NOSTR_USER_TAG_HANDLE = \`39998:${TA_PUBKEY}:nostr-user-tag\`` and `TA_PUBKEY = '82b75e47…'` (`publishProfileTag.js:15-16,71`).

The canonical z makes these events network-visible (Half-1 / ADR 0001 federates and read-unions on `#z = 39998:82b75e47…:<slug>` — see the server read filters `NOSTR_USER_TAG_Z_TAG`/`TAG_Z_TAG` at `src/api/profile-tags/index.js:59-61`, used *only* as `#z` scan keys, never to publish). But the **local** instance's own concept list is keyed on the **local** z, `39998:<thisInstanceTA>:<slug>`, which new events never carry — so each instance's local `nostr-user-tag` list stays empty even as its users tag people. Story 2 (ADR 0002) seeds the local header's pointer-`b` to the canonical header (the "map"); this story makes the **writer** stamp the **local** z so locally-authored activity actually lands in the local list (the "membership").

This is the implementation of **W11** ("cloud formation / multi-z stamping"). The full W11 *protocol practice* (consensus-ranked clouds, rotation, caps) is ratified design-only in `community-reference` ADR 0033 and is **resolver-gated** — out of scope here. This ADR applies W11's **floor**: the rule that a published list item carries its **personal/canonical `z` (required, ≥1)** plus additional `z` stamps, and that **`z` order is not load-bearing** (ADR 0033: "consumers MUST NOT depend on it"). Concretely, for the tag stack: exactly **two** z's — canonical + local.

### Concepts touched (no schema change)

- `tag` / `nostr-user-tag`: gain a second `z` per event. Canonical z = `39998:82b75e47…:<slug>` (unchanged, ADR-0015 literal). Local z = `39998:<runtime taPubkey>:<slug>` (NEW). Both headers already exist in the live graph (`/api/concept-graph/node/39998:82b75e47…:{tag,nostr-user-tag}`); ADR 0002 verified the local header exists and gains the pointer-`b` on reinstall. **No json-schema or property change** — this is purely a wire-tag addition on user-signed events. **No firmware reinstall is required *by this ADR*** (Story 2 already triggers the reinstall for the `b` seeds).

### Constraints

- **Canonical z stays the ADR-0015 literal** (`82b75e47…`) — the named-exception data coordinate that keeps historical activity visible across non-dev deployments. **Local z MUST resolve the runtime instance TA** (`useConfig().taPubkey`, backed by `/api/assistant/pubkey`) — never hardcoded (CLAUDE.md "Per-deployment TA pubkey — NEVER hardcode"; AC-6).
- **Additive only.** The second z MUST NOT regress the ADR-0022 hybrid `e`+`a` shape (AC-3) or Half-1's canonical-z read-union (AC-4). No migration/backfill of existing single-z events (AC-5).
- **POV-first / decentralization** (CLAUDE.md): unchanged. A z stamp is membership-in-a-concept, carries zero consensus weight, and gates nothing at write time.
- **No new lint/build tooling** (JS-without-build). UI is ESM (`ui/package.json:5` → `"type": "module"`); the root test runner is CJS + Playwright — ESM UI utils are not `require()`-able from it (prior-story constraint; see Verification).

## Options considered

The genuinely-open seams are **(a) where/how the local z is added** and **(b) whether to factor the two-coordinate composition into a shared helper**. Two cross-cutting threads also need a decision: **how the writer obtains `taPubkey`** and **the exact stamping rule (W11)**.

### Option A — add the local z inline at each of the two writers; thread `taPubkey` as an explicit function argument (chosen)

`createTag` and `publishProfileTagAssertion` each build the local handle inline next to the existing canonical handle and append a second `['z', …]` entry. The runtime `taPubkey` is read via `useConfig()` at the React layer (the hook `useProfileTags` and the page `Tag.jsx`) and passed **into** the pure writer functions as a new named arg (`localTaPubkey`). The pure functions never call a hook — they stay testable, side-effect-light, and honor the existing "single source of truth for the wire shape" comment block.

- **Pros:** Mirrors exactly how the codebase already does z composition (a per-file `…_HANDLE` const + an inline `['z', HANDLE]` push). The canonical literal stays put as the ADR-0015 exception; only the local handle is computed. Keeping `taPubkey` as a function arg (not a hook call inside the util) preserves the pure-function boundary the ESM-vs-CJS test reality needs (source-contract regex + any pure unit). Two writers, two ~2-line edits, plus arg-threading at the two call sites — small, reviewable, no new module. Both z's are emitted *by construction*, which is exactly what the dev-box degenerate case (below) needs to be testable.
- **Cons:** The two-coordinate shape (`canonical = literal`, `local = runtime`) is duplicated across the two files. Mitigated: it's two short, identical idioms already living beside three sibling literals (`publishTagPin.js` is the third), and each writer's wire shape is deliberately co-located per the existing file-level doc contract.

### Option B — factor a shared `dualZ(slug, localTaPubkey)` helper into a new util, imported by both writers

A single function returns `[['z', \`39998:82b75e47…:${slug}\`], ['z', \`39998:${localTaPubkey}:${slug}\`]]`.

- **Pros:** DRY; one place defines "two z's, canonical-then-local"; one place to extend if W11's cap grows beyond two (ADR 0033's eventual `k`).
- **Cons:** Premature. ADR 0033's multi-z cap is resolver-gated and **explicitly deferred** — building the generalized cloud-stamper now would either be a stub or pull resolver concerns into a write-time util that has none. It also **co-locates the ADR-0015 literal with a runtime value in a new shared module**, inviting a future refactor to "unify" them into one runtime lookup — the precise regression the named exception forbids (a reviewer would have to re-derive the split every time). The existing pattern deliberately keeps each writer's wire shape self-contained and commented; a new cross-writer util erodes that. Rejected for now; revisit if/when ADR 0033's resolver lands and a real third stamp appears.

### Option C — read `taPubkey` inside the util via a module-level fetch of `/api/assistant/pubkey`

The util fetches the runtime TA itself, removing the threading.

- **Cons:** Adds a network round-trip and async/caching surface to a pure wire-builder; `ConfigProvider` already fetches `/api/assistant/pubkey` once app-wide (`ui/src/context/ConfigContext.jsx:20-24`) and exposes it via `useConfig()` — re-fetching duplicates that and breaks the pure-function testability. Rejected.

## Decision

**Option A.** Add the local z **inline at each of the two writers**, keeping the canonical z as the unchanged ADR-0015 literal; obtain the runtime `taPubkey` via `useConfig()` at the React layer and **thread it as an explicit `localTaPubkey` argument** into the pure writer functions. No new shared module (Option B deferred to the W11/ADR-0033 resolver work).

### The W11 stamping rule (this story's design deliverable)

For a new **tag element** (kind 39999, `createTag`) and a new **tagging assertion** (kind 39999, `publishProfileTagAssertion`), the event's `tags` array carries **two `z` tags** for its concept:

1. **canonical** — `['z', '39998:82b75e47…:<slug>']` — the ADR-0015 literal; unchanged; the network-identity coordinate Half-1 federates and read-unions on. **Always present (required, ≥1).**
2. **local** — `['z', '39998:<runtime taPubkey>:<slug>']` — `<runtime taPubkey>` = `useConfig().taPubkey`; NEW; the membership coordinate that lands the event in *this* instance's local concept list.

Both are emitted together, by construction, on every new tag/tagging (they always co-occur). **Ordering is canonical-then-local by convention but is NOT load-bearing** — `z` is a NIP-01 single-character indexed tag, multi-value; relays index each value independently and readers `#z`-scan/union per value (confirmed: every server reader filters on a single `#z` value and unions results — `src/api/profile-tags/index.js:179,237,306,…`; none enumerate or order-compare the writer's z array). The rule is stated generally (the reusable "≥1 personal z + additional z stamps, order-free" convention from ADR 0033), but the **implementation is scoped to the tag writer's two coordinates only** — no cloud, no cap, no rotation (those stay resolver-gated in ADR 0033).

### Open-question resolutions

- **OQ-1 (z ordering & multiplicity):** Order does **not** matter. `z` is NIP-01 multi-value indexed; readers union per-value and are order-insensitive (verified across `src/api/profile-tags/index.js`). We emit **canonical-then-local** purely for diff/readability stability. Multiplicity here is exactly **two** (one canonical + one local); the general W11 cap (>2) is ADR-0033 resolver-gated and out of scope.
- **OQ-2 (composition with the ADR-0022 hybrid `e`+`a`):** **No collision.** `z` and `a` are different tag names indexing different namespaces. The `a`-coordinate keeps its ADR-0022 author semantics — `['a', '39999:<tagAuthorPubkey>:<slug>']` (kind **39999**, the tag-element *author*'s pubkey) — while the new local z is `['z', '39998:<instanceTA>:<slug>']` (kind **39998**, the *instance* TA). Different kind prefix, different pubkey role, different tag name. The dual-z is purely additive: the assertion writer keeps `d`/`p`/`a`/`e`/`polarity` and its `content` JSON mirror byte-for-byte; we only append one `z` (AC-3).
- **OQ-3 (writer surface scope):** **Client-only.** The only paths that *publish/sign* kind-39999 tag/tagging events are the two client writers (`publishProfileTagAssertion` and `createTag`). The server `src/api/profile-tags/index.js` references the z handles **solely as `#z` read filters** (`:59-61` consts → `:179/237/306/…` scans); it never signs or publishes a tag/tagging, so there is **no server-side writer to change**. (`publishTagPin.js` `pinTag` is the *tag-pinning* concept, out of this story's scope per AC-1/AC-2 which name tag + tagging only.)
- **OQ-4 (local-header existence dependency):** The local z assumes `39998:<localTA>:<slug>` exists. **Confirmed:** firmware install materializes the TA-authored local header for each concept (verified live in ADR 0002 — all three local headers exist on this box, e.g. `nostr-user-tag` id `7df925f7…`). Story 2's seeded pointer-`b` is appended **to** that header and does **not** change its address/existence — `b` is an added wire tag on the same header, not a re-keying. So the local z always has a header to join.

## Consequences

**Enables:**
- New tags/taggings land in the publishing instance's **local** concept list (`39998:<instanceTA>:nostr-user-tag`) while staying network-visible via the canonical z (AC-1, AC-2, AC-4). The dual-z "map" (ADR 0002) + "membership" (this) together make the local `/tapestry` concept browser correct on every instance.

**Constrains / debt:**
- Two writer files now duplicate the canonical-literal-+-runtime-local idiom (accepted; Option B deferred until ADR-0033's resolver makes a shared multi-z stamper non-premature).
- The two call sites (`useProfileTags`, `Tag.jsx`) must thread `localTaPubkey`; a future caller that forgets it would drop the local z (no network regression — canonical still ships). Mitigation: a dev-time guard/log when `localTaPubkey` is absent/malformed, mirroring the existing `authorPubkey` guard at `publishProfileTag.js:54-56` (do **not** hard-throw — a missing local TA must not block the canonical publish; AC-5/decentralization).
- **No migration** (AC-5): old single-z events stay canonical-only and network-visible; they will not retroactively appear in local lists. Accepted per story Out-of-scope.

**Firmware reinstall required?** **No** — no concept/schema/manifest change in *this* ADR (the writer adds a wire tag to user-signed events; the schema is unchanged). The reinstall that seeds the pointer-`b` belongs to Story 2 (ADR 0002).

## Implementation notes

Concrete, file:line-anchored. The Implementer edits two writer files and two call sites; the Tester writes source-contract regex tests (ESM constraint) + Playwright live-verify.

### 1. `ui/src/hooks/useProfileTags.js` — tag-element writer (`createTag`, `:103-129`)

- Add a runtime TA read at the top of the hook: `const { taPubkey } = useConfig();` (import `useConfig` from `../context/ConfigContext`). `ConfigProvider` is mounted app-wide (`ui/src/main.jsx:11`), so this is in-context.
- In `createTag`, compose the local handle from the runtime value and append the second z. The canonical `TAG_HANDLE` (`:7`, the `82b75e47…` literal) is **unchanged**.

Before (`:112-115`):
```js
tags: [
  ['d', slug],
  ['z', TAG_HANDLE],
],
```
After:
```js
tags: [
  ['d', slug],
  ['z', TAG_HANDLE],                          // canonical (ADR-0015 literal) — unchanged
  ['z', `39998:${taPubkey}:tag`],             // local (runtime instance TA) — W11, tag-federation ADR 0003
],
```
- Guard (non-fatal, mirrors `publishProfileTag.js:54-56`): if `taPubkey` is missing/malformed, skip the **local** z and `console.warn` — never block the canonical publish. (The Tester decides whether to assert the warn path.)
- Thread `taPubkey` into the assertion writer too — `buildAndPublishAssertion` (`:71-74`) calls `publishProfileTagAssertion`; pass `localTaPubkey: taPubkey` (see §2).

### 2. `ui/src/utils/publishProfileTag.js` — tagging-assertion writer (`publishProfileTagAssertion`, `:45-81`)

- Extend the signature to accept `localTaPubkey`: `publishProfileTagAssertion({ tag, targetPubkey, polarity, localTaPubkey })`.
- Append the local z **after** the canonical `NOSTR_USER_TAG_HANDLE` (`:16,71`, the `82b75e47…` literal — unchanged). The ADR-0022 `a`/`e`/`d`/`p`/`polarity` lines and the `content` JSON are **untouched** (AC-3).

Before (`:66-73`):
```js
tags: [
  ['d', dTag],
  ['p', targetPubkey],
  ['a', tagAddress],
  ['e', tag.eventId],
  ['z', NOSTR_USER_TAG_HANDLE],
  ['polarity', String(polarity)],
],
```
After:
```js
tags: [
  ['d', dTag],
  ['p', targetPubkey],
  ['a', tagAddress],
  ['e', tag.eventId],
  ['z', NOSTR_USER_TAG_HANDLE],               // canonical (ADR-0015 literal) — unchanged
  ['z', `39998:${localTaPubkey}:nostr-user-tag`], // local (runtime TA) — W11, tag-federation ADR 0003
  ['polarity', String(polarity)],
],
```
- Same non-fatal guard: missing/malformed `localTaPubkey` → omit the local z + warn; never block. (The existing `authorPubkey` guard hard-throws because a missing `a` would re-grow the legacy set; a missing *local z* has no such cost — canonical still ships — so it must **not** throw.)

### 3. Call sites — thread the runtime `taPubkey`

- **`ui/src/hooks/useProfileTags.js`** — `buildAndPublishAssertion` (`:71-74`): pass `localTaPubkey: taPubkey` (already read in §1) into `publishProfileTagAssertion`. `applyTag`/`disputeTag`/`createTag` flow through this and through §1; no other change needed in `ProfileTagsSection.jsx` (it consumes the hook's returned callbacks).
- **`ui/src/pages/Tag.jsx`** — `handleApply`/`handleDispute` (`:~95-103`) call `publishProfileTagAssertion` directly. Add `const { taPubkey } = useConfig();` at the component top and pass `localTaPubkey: taPubkey` in both calls.

### 4. Testability hooks (ESM-vs-CJS reality)

The two writers are ESM under `ui/` and are **not** `require()`-able from the CJS root runner (`package.json:13` → `node test/test.js`) — same constraint as prior tag stories. Therefore:
- **Source-contract regex tests** (CJS-friendly `readFileSync` over the two files): assert each writer's `tags` array contains **both** a canonical `['z', '39998:82b75e47…:<slug>']` literal/const reference **and** a runtime-composed `['z', \`39998:${…}:<slug>\`]` whose interpolation is `taPubkey`/`localTaPubkey` (not a literal). Assert the canonical literal is still present (no accidental replacement) and the ADR-0022 `a`/`e` lines are intact in `publishProfileTag.js` (AC-3 regression guard). Assert no new `82b75e47…` literal was introduced for the *local* handle (AC-6 anti-hardcode).
- **Playwright live-verify** (against the running dev stack) per §Verification.

## Verification plan (live, on the dev stack)

1. Log in via NIP-07; create a new tag and/or apply a tagging through the UI (profile chip popover or `/tag/:slug` page).
2. Fetch the published kind-39999 event from the local relay and assert it carries **two `z` tags**: the canonical `39998:82b75e47…:<slug>` **and** the local `39998:<localTA>:<slug>`; and (for the assertion) that the ADR-0022 `['a','39999:<author>:<slug>']` + `['e',<id>]` shape is intact (AC-3).
3. Load the local concept list `39998:<localTA>:nostr-user-tag` (the `/tapestry` browser or `/api/profile-tags` `#z`-scan) and confirm the new tagging now appears in it (AC-4) — while remaining network-visible (canonical z).

### ⚠️ Dev-box degenerate-z caveat (important)

On **this dev box the local TA equals the canonical coordinate** (`/api/assistant/pubkey` → `82b75e47…`, verified in ADR 0002). So the two z handles are **identical strings** here — the writer emits `['z','39998:82b75e47…:<slug>']` twice. This is the same self-loop collapse Story 2 flagged. The distinct-value case only manifests on a **non-dev** instance (different runtime TA).

Therefore the test must assert the writer **emits both z coordinates by construction** — i.e. that **two** `['z', …]` entries are produced and that the *second* one is composed from the **runtime `taPubkey` argument** (not a literal) — rather than asserting the two values differ. The source-contract regex (one canonical-literal z + one runtime-interpolated z) proves the mechanism regardless of whether the two resolve equal on this box. A reviewer/Tester verifying on a non-dev TA (or by stubbing `taPubkey` to a different value in a unit harness if/when one exists) would then see two distinct values; on the dev box, "two z entries, second one runtime-sourced" is the assertion of record.

### David verification breadcrumb (AC-7)

The PR description carries the explicit note (consistent with Story 2's "one pointer-`b` per header" breadcrumb): **"each new Tag and Tagging now carries TWO `z` tags — canonical (`82b75e47…`, network identity, unchanged) + local (runtime instance TA, NEW for the local list); existing single-z events are not migrated."** Plus the reversal breadcrumb: removing the second `['z', …]` line from each writer reverts to single-z behavior with no data migration.

## Out of scope

- The full W11 cloud practice — consensus-ranked clouds, rotation, the cap `k`, re-stamping (all resolver-gated in `community-reference` ADR 0033).
- Migrating/backfilling existing single-z events (AC-5; none).
- The pointer-`b` seed / manifest / firmware reinstall (Story 2 / ADR 0002).
- Adding the local z to `tag-pinning` (`publishTagPin.js`) — this story scopes to tag + tagging (AC-1/AC-2); pinning's dual-z, if wanted, is a follow-up.
- Lazy client self-re-emit of pre-change events to gain the local z (would be the ADR-0022-style optional, eventual path; not built here).
