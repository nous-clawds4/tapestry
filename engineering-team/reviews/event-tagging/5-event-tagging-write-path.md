# Review: Story 5 — Event-tagging write path

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-30
**Diff:** `git diff dff8070a..HEAD` (impl commit `7f67763b`, tests `d5b5d8b1`)
**Story:** `engineering-team/stories/event-tagging/5-event-tagging-write-path.md`
**ADR:** `engineering-team/decisions/event-tagging/0005-event-tagging-write-path.md`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/event-tagging-write-path.test.js` — **19 passed, 0 failed**.
- [x] `node test/event-tagging-core.test.js` — **15 passed, 0 failed** (the core purity guard now scans `apply.js` too — still green, so the orchestrator is literal-/IO-free).
- [x] Vite build resolves + transforms the CJS core (ADR's one flagged integration risk): build exit 0; with the hook temporarily wired into the entry, the bundle contained core-only strings (`tagging-with-specific-tag`) → the `@tapestry/event-tagging` alias genuinely resolves and the CJS→ESM interop works.
- [x] Full `node test/test.js` → `Overall: FAIL`, but **no event-tagging suite fails** (core 15 / spec 5 / firmware-seed 11 / read-api 11 / write-path 19, all green). The 4 failing suites are unrelated to this diff — see *Non-blocking #3*.
- [ ] _Lint / typecheck / build tooling — not configured; none added (CLAUDE.md honored)._

## Spec adherence (acceptance criteria → test)

- [x] **1-publish (existing header)**, apply + dispute → `sequence 'a'` tests. `apply.js:136-139` references the chosen header coord; polarity passes through.
- [x] **2-publish (tag exists, no header)** ordered → `sequence 'b'` test. `apply.js:140-149` mints the header (asserter-authored, `a` → tag-element) before the assertion.
- [x] **3-publish (brand-new tag)** ordered → `sequence 'c'` test. `apply.js:114-126` tag-element → header → assertion, each referencing the prior.
- [x] **Sequence chosen by discovery** → two tests (existing tag flips `a`/`b` on `findHeaders` result; new tag never reads). `apply.js:132-149`.
- [x] **Ordered publish, stop on failure → only harmless partial states** → `apply.js:168-180` returns the landed prefix + `failedAt`; test asserts the assertion-without-header state is unreachable.
- [x] **Local-only** → split honestly per the test plan: orchestrator transports only via injected `publish` (purity guard bans `fetch`/`wss`); the hook wires the **guarded** `publishOrThrow` (`useEventTagging.js:4,52`); runtime guard behavior owned by the Story-2 suite.
- [x] **NIP-07 signing** → sign-all-then-publish abort test; hook raises a clear error if `!window.nostr` (`useEventTagging.js:30-32`).
- [x] **Dual-z federation** → test asserts canonical+local concept-z on all three event types; hook composes `[LEGACY, runtime TA]` (`useEventTagging.js:38`).
- [x] **Replaceability / flip** → re-apply and apply↔dispute reuse the same deterministic `d`/address (test); inherited from the core builders.
- [x] **Malformed input refused, not published** → throws before any sign/publish; asserted to be a genuine validation error, not a missing-function artifact.
- [x] No behavior added beyond the story. UI rendering / affordance correctly **deferred to Story 6** (the hook is imported by no component yet — confirmed).

## ADR adherence

- [x] **Decision A + D + E** realized exactly. Pure `applyEventTagging` orchestrator in the core with `deps = { findHeaders, sign, publish, now }` injected (`apply.js:91-183`); thin hook supplies the browser deps (`useEventTagging.js`); Vite alias seam (`vite.config.js:11-22`); sign-all-then-publish.
- [x] **Signature + return shape** match the ADR implementation notes verbatim: `{ sequence:'a'|'b'|'c', published:[{kind,address,id}], failedAt? }`.
- [x] **`pickHeader`** is pure, deterministic, documented (`apply.js:51-71`) — canonical-authority preference then author-ascending tie-break, as the ADR specified for open-question 2.
- [x] **Layering / literal-free core**: the canonical literal lives **only** in the app hook (`grep` confirms no `82b7…` in `src/lib/event-tagging/`); the generic core takes `taPubkeys` as a parameter → SDK-extractable, as Story 1 intended.
- [x] **No new dependencies.** `package.json` unchanged; `vite.config.js` change is config-only.
- [x] **Firmware reinstall** — none required (no concept change), matching the ADR.

## Concept-graph integrity

- [x] All handles in `kind:pubkey:slug` form, produced by the Story-1 composers; the uniform `39999:<pubkey>:<d>` address rule (`apply.js:105-108`) is correct for tag-element, header, and assertion.
- [x] No concept definitions changed → no reinstall.
- [x] The canonical literal is the **federation anchor**, consistent with the already-approved Story-4 read side (`src/api/event-tags/index.js:21` `CANONICAL_AUTHORITY`). The per-deployment/runtime TA is resolved via `useConfig().taPubkey` (`useEventTagging.js:34`) — never hardcoded. CLAUDE.md "never hardcode the runtime TA" is honored.

## Things tests can't catch

- [x] No secrets. The only hardcoded pubkey is the public canonical TA literal (sanctioned federation anchor).
- [x] No leftover debug logging / `console.log` / commented-out code in the diff.
- [x] Error paths handled: missing deps (`apply.js:92`), malformed asserter (`:97`), signer rejection (sign-all abort), publish failure (stop-on-failure with `failedAt`).
- [x] Concurrency: orchestrator is a single linear async sequence with no shared mutable state; deterministic given fixed `now()`.
- [x] Input validation at the boundary: asserter guarded up front; builders guard pubkeys/polarity/target.

## House rules check

- [x] Concept Graph API authority respected (no re-derivation of concept handles).
- [x] No new lint/typecheck/build tooling.
- [x] Per-deployment TA rule honored (runtime TA via config; canonical literal is the named federation-anchor exception, matching Story 4).

## Findings

### Blocking
_None._

### Non-blocking
1. **`apply.js:92,132`** — `findHeaders` is omitted from the required-deps guard and falls back to `[]` when absent. The hook always supplies it, so this is harmless today, but a future caller that forgets `findHeaders` would silently force `sequence 'b'` (mint a duplicate header) for an existing tag instead of failing loud. *Optional:* require `findHeaders` in the guard, or document the `[]` fallback as intentional.
2. **`apply.js:33-49`** — for `sequence 'b'` the minted header's display `names`/`description` are synthesized from the slug via `titleizeSlug` (e.g. `"Tagging of an event as Existing Tag"`), which diverges cosmetically from the spec's exact example (article "an", pluralized form) and from the tag-element's real display name. Display-only (the read-side classifier ignores header `names`), deterministic per author, and not a correctness issue — noting for awareness. *Optional:* carry the tag's real display name through the existing-tag path if Story 6 surfaces it.
3. **Cross-epic, not this story** — `b-tag-primitive` and `b-tag-seeds` scope-guards now fail because the event-tagging **Story 3** firmware seed added `nostr-event-tag` + `tagging-with-specific-tag`, which carry a `communityReference`; those guards assert "exactly 4 concepts." Pre-existing before this session, untouched by Story 5 (no firmware change here). The other two full-suite failures (`tl-publication-from-pins`, `most-pinned-tag-index-publish`) are live-stack publish suites with the stack down. **Recommend an `OPEN.md` row** to reconcile the b-tag scope-guards with the event-tagging epic's concepts.

### Deferred (by design, not a gap)
- The ADR's "verify via `cycle-local`" is satisfied for its *stated* risk (CJS-core resolution in the Vite build — verified by the bundle probe). The end-to-end **publish-with-guard-on smoke** is not run here because Story 5 ships no affordance to drive it; the live click-through naturally lands in **Story 6**, which wires the hook onto a note surface.

## Verdict

**PASS**

The implementation matches the ADR contract exactly (pure orchestrator + injected deps + Vite-alias seam + sign-all-then-publish), every acceptance criterion has a passing test (19/19), the core stays literal-free and pure, and the one real integration risk (CJS-in-Vite) is build-verified. The non-blocking items are a defensive-guard nicety, a cosmetic display-name detail, and a pre-existing cross-epic scope-guard tension that is out of this story's scope.
