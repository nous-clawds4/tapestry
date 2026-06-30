# ADR 0005: Event-tagging write path

**Status:** Proposed
**Date:** 2026-06-30
**Story:** `engineering-team/stories/event-tagging/5-event-tagging-write-path.md`

## Context

The client publish logic for the 1/2/3-publish sequences. The proven pubkey template is `ui/src/utils/publishProfileTag.js` + `ui/src/hooks/useProfileTags.js` `createTag` (`:106`): NIP-07 signing (`window.nostr`), `publishOrThrow` (throws only if *both* local and external fail), and dual-z (`[canonical legacy literal, runtime local TA]`).

Facts that shape this design:

- **The pubkey path INLINES the wire shape** (`publishProfileTag.js` builds the tag layout by hand; its docstring calls *itself* the "single source of truth"). Story 1 deliberately built a **dependency-free core** (`src/lib/event-tagging`, CJS) as *the* single source of truth so the UI, server, and third parties never drift, and the operator made SDK-extractability a hard requirement. So Story 5 must **consume the core**, not re-inline — which makes "how the Vite UI imports the CJS core" the first cross-boundary consumption (Story 1 deferred this seam to the first UI consumer; that is now).
- **References are addressable coordinates, not signed ids** (story Background): the header's `a` and the assertion's descriptor `z` are `kind:pubkey:slug`, derivable from pubkey+slug up front. So all needed events can be **built and signed before any publish** (sign-all-then-publish → cancelling any signer prompt publishes nothing). The dependency is on **publish order**, not signed ids.
- **`publishOrThrow` already composes with the Story-2 guard.** It calls `publishEverywhere`, whose external arm now returns `skippedByGate` when the local-only guard is on (Story 2). With the guard on, `publishOrThrow` succeeds on the local write alone — so reusing it makes every publish local-only automatically.
- **The existing-vs-new distinction collapses the discovery.** A brand-new tag (typed name) definitionally has no header → always 3 publishes; only an *existing* tag (picked author+slug) needs the Story-4 `headers-for-tag` read to choose between 1 (header exists) and 2 (no header).
- **The core builders are pure** (`{kind,tags,content}`, no `pubkey`/`created_at`); the caller adds those and signs. The orchestration (sequence decision + ordered publish) does no I/O itself if signing/transport/discovery/clock are **injected** — so it can be a pure, CJS-testable function in the core (like `classifyEventTaggings`), with the browser specifics in a thin hook.

No concept/firmware change → no reinstall.

## Options considered

### Where the orchestration lives

**Option A — Pure orchestrator in the core + thin React hook (recommended).** `applyEventTagging({...inputs, deps})` in `src/lib/event-tagging`: decides the sequence, builds via the core, signs all, publishes in order stopping on failure, returns what landed. `deps = { findHeaders, sign, publish, now }` are injected. A thin `ui/` hook supplies the real deps (`window.nostr`, `publishOrThrow`, `fetch` of the Story-4 reads, runtime TA).
- **Pros:** The risky logic (sequence choice, sign-all, ordered stop-on-failure, header pick) is pure → deterministically CJS-testable with injected fakes (no browser). SDK-extractable: a third party gets the orchestration too. Satisfies the core purity guard (no `window`/`fetch`/`Date` literals — all injected).
- **Cons:** One more core export; the hook must thread deps.

**Option B — Logic in the React hook.** Rejected: couples the sequence/failure logic to React + `window.nostr`, untestable without a browser, not SDK-extractable.

**Option C — Inline the wire shape in the UI (pubkey-path style).** Rejected: duplicates the wire shape (core + UI) — the exact drift Story 1's core exists to prevent; defeats the operator's SDK requirement.

### How the Vite UI consumes the CJS core

**Option D — Vite `resolve.alias` to the single core (+ `server.fs.allow`, `build.commonjsOptions.include` as needed) (recommended).** One source of truth; the hook imports the core through the alias.
- **Pros:** No logic duplication; realizes Story-1's intent.
- **Cons:** First cross-`ui/`-boundary import of a CJS tree — needs a Vite config tweak and a build verification (CJS interop). Contained.
- **Fallback (still single-source):** a one-line ESM shim in `ui/src/` that imports the aliased core and re-exports — the single place to massage interop if the raw alias is fussy. Inlining remains rejected.

### Sign timing

**Option E — Sign all, then publish (recommended).** Enabled by the addressable-coordinate property. Cancelling any signer prompt → nothing published (clean all-or-nothing abort). vs sign-publish-each (interleaved; a mid-sequence cancel leaves a published prefix).

## Decision

**A + D + E.** A pure `applyEventTagging` orchestrator in the core (deps injected), consumed by a thin React hook that supplies `window.nostr` signing, the guarded `publishOrThrow`, the Story-4 reads, and `taPubkeys = [LEGACY, runtime TA]`. The UI imports the core via a Vite alias (single source of truth; no inlining). Sign-all-then-publish; publish in dependency order, stop on first failure, return what landed.

## Consequences

- **Enables** Story 6 to call one hook method per user action (apply/dispute, existing or new tag) without knowing the object graph.
- **First cross-boundary core consumption:** `ui/vite.config.js` gains an alias (+ `fs.allow`/`commonjsOptions` as the build requires). The Implementer **must verify the Vite build resolves + transforms the CJS core** via `cycle-local` (build `dist`, smoke the bundle) — this is the one real integration risk; the ESM-shim fallback is the contingency.
- **Local-only by construction:** publishing through `publishOrThrow`/`publishEverywhere` inherits the Story-2 guard — no external publish while the guard is on. (Test the write path with the guard on.)
- **Partial failure is graceful:** ordered tag→header→assertion, stop on failure → only reusable leftovers (orphan tag-element, or tag+header), never an assertion without its header. The orchestrator returns `{ sequence, published[], failedAt? }` so the hook/UI can retry only the missing tail.
- **Replaceability is free:** the deterministic assertion `d` means re-apply/flip republishes at the same address (latest-wins) — no dedup logic needed.
- **Firmware reinstall required?** No.

## Implementation notes

### Core: `applyEventTagging` in `src/lib/event-tagging` (pure, deps injected)
```
applyEventTagging({
  tagInput,        // { name, description } (new)  OR  { authorPubkey, slug } (existing, picked)
  target,          // { id } (kind-1 note → e)  OR  { address } (addressable → a)
  polarity,        // 1 | -1
  asserterPubkey,  // current user (64-hex)
  taPubkeys,       // [canonical, local] — app-supplied; passed to the core builders
  deps: {
    findHeaders,   // async ({tagAuthorPubkey, slug}) => [{ author, ... }]  (Story-4 headers-for-tag)
    sign,          // async (unsigned) => signed   (window.nostr.signEvent)
    publish,       // async (signed) => result      (publishOrThrow — guarded)
    now,           // () => unix seconds            (injected for determinism/purity)
  },
}) => { sequence: 'a'|'b'|'c', published: [{ kind, address, id }], failedAt?: { kind, error } }
```
Logic:
1. **Resolve tag identity + sequence.** If `tagInput.name` → new tag: `slug = slug(name)`, `tagAuthor = asserterPubkey`; plan = `[tagElement, header, assertion]` (always 3 — a new tag has no header). Else existing: `tagAuthor = tagInput.authorPubkey`, `slug = tagInput.slug`; `headers = await findHeaders(...)`; `chosen = pickHeader(headers)`; if `chosen` → plan `[assertion]` (1, descriptor = chosen header), else plan `[header, assertion]` (2, header authored by asserter).
2. **`pickHeader(headers)`** (pure, deterministic): prefer a header under the canonical authority; tie-break by `author` ascending. Documented so the choice is stable and testable.
3. **Build** each plan item via the core builders (`buildTagElement` / `buildTaggingHeader` / `buildEventTaggingAssertion`), passing `taPubkeys`; wrap each into a full unsigned event `{ ...built, pubkey: <author/asserter>, created_at: now() }`.
4. **Sign all** in order via `sign`; if any rejects, **throw before any publish** (nothing published).
5. **Publish in order** via `publish`; on the first failure, stop and return `{ sequence, published: [...landed], failedAt }`. Else return `{ sequence, published }`.
- Pure: no `window`/`fetch`/`Date`/`crypto` literals (all injected) → passes the core purity guard.

### UI: thin hook `ui/src/hooks/useEventTagging.js` (or util `publishEventTag.js`)
- Imports the core via the Vite alias. `taPubkeys = [LEGACY_TA_PUBKEY, ...(validRuntimeTA ? [runtimeTA] : [])]` — `LEGACY_TA_PUBKEY` an app constant (ADR-0015 lineage, as in `publishProfileTag.js:15`); runtime TA from `useConfig().taPubkey`; missing/malformed local omits the local z (non-fatal, mirrors `createTag`).
- `deps`: `findHeaders` → `fetch('/api/event-tags/headers-for-tag?...')`; `sign` → `window.nostr.signEvent` (throw a clear error if `!window.nostr`); `publish` → `publishOrThrow` (guarded `publishEverywhere`); `now` → `() => Math.floor(Date.now()/1000)`.
- Exposes `applyTag(tagInput, target)` / `disputeTag(tagInput, target)` (polarity ±1). Surfaces `{ sequence, published, failedAt }` for the UI.

### Vite seam
`ui/vite.config.js`: add `resolve.alias` for the core (e.g. `'@tapestry/event-tagging' → path.resolve(__dirname, '../src/lib/event-tagging')`), `server.fs.allow: ['..']`, and `build.commonjsOptions.include` covering the core path if the build needs it. Verify with `cycle-local`. Fallback: ESM re-export shim under `ui/src/`.

## Out of scope
- **UI rendering / affordance / note-surface wiring** — Story 6 (consumes this hook).
- **Revoke / NIP-09 deletion** — polarity flip covers "change stance"; hard delete later.
- **External publishing** — the guard keeps it local; flipping is the operator's release decision.
