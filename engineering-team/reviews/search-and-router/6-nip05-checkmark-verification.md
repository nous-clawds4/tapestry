# Review: Story 6 — NIP-05 green checkmark must reflect real verification

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-17
**Branch:** `fix/nip05-verification` → `staging` (PR pending)
**Diff:** `git diff origin/staging...HEAD` — three commits ahead:
- `e522d073` story: nip05-checkmark-verification
- `93c18764` test: failing tests for nip05-checkmark-verification (story #6)
- `c0a15a61` impl: nip05-checkmark-verification (story #6)

**Classification:** Bug / Standard / Product Owner + Tester + Implementer + Reviewer (Architecture skipped — unambiguous root cause, proven helper pattern already in-repo; recorded in story §"Linked artifacts").

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. Five suites + Configuration Loading all green (32/32):
  - Configuration Loading: PASS
  - treasure-maps-router-preset: 5/5
  - scheduled-search-and-house-scores-refresh: 12/12
  - strfry-router-first-boot-config: 3/3
  - per-query-neo4j-timeout-safety-net: 8/8
  - **nip05-checkmark-verification: 4/4** (T1, T2 now pass; R1, R2 sentinels still green)
- [x] `node -c src/api/nip05.js` — **PASS** (syntax OK).
- [x] UI build — **PASS**. Production Vite build run during the local cycle compiled the new hook + both edited pages with no JSX/syntax errors; `useNip05Verification` confirmed present in the deployed bundle. (This is the appropriate build-gate evidence for ESM/JSX; `node -c` does not parse JSX.)
- [x] Local end-to-end cycle — **PASS** on the running stack (container port :7778; the cycle-local skill's `:8080` assumption is stale for this container — noted as a non-blocking skill bug below). `/api/nip05/verify`: genuine match → `{"verified":true}`; wrong pubkey (impersonation) → `{"verified":false}`; name-absent → `false`; unreachable domain → `false`; bad/missing input → `false`. Real outbound HTTPS fetch + pubkey comparison exercised.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build step not configured (Vite invoked manually in the cycle) — n/a._

## Spec adherence (vs. story #6 acceptance criteria)

- [x] **AC-1 (verified → ✅).** `handleNip05Verify` ([src/api/nip05.js:154](src/api/nip05.js#L154)) returns `{verified:true}` only when the domain attests the same pubkey ([line 163](src/api/nip05.js#L163)); the hook prepends `'✅ '` only when `nip05Verified` is true ([UserDetail.jsx:84](ui/src/pages/users/UserDetail.jsx#L84), [BrainstormProfile.jsx:228](ui/src/pages/BrainstormProfile.jsx#L228)). T1/T2 pin the presence-only gate gone; local cycle proved the positive path live.
- [x] **AC-2 (present but unverified → plain text, no ✅, no warning).** Hook returns `false` for mismatch/absent/malformed/unreachable/timeout (`verifyNip05Identifier` fail-closed catch, [src/api/nip05.js:125](src/api/nip05.js#L125)); JSX renders `{false && '✅ '}` → React renders nothing, leaving the bare `{profile.nip05}` text. No warning glyph added. Local cycle confirmed all four negative cases return `false`.
- [x] **AC-3 (no nip05 → nothing, unchanged).** The outer `{profile?.nip05 && …}` guard is preserved verbatim on both surfaces — when absent, the whole element short-circuits. Invariant intact; deliberately not pinned in-runner (would over-constrain a refactor — per test plan).
- [x] **AC-4 (fail-closed, no spinner).** `useState(false)` default ([useNip05Verification.js:16](ui/src/hooks/useNip05Verification.js#L16)); `setVerified(false)` first thing in the effect ([line 20](ui/src/hooks/useNip05Verification.js#L20)) so a previously-verified profile cannot bleed a ✅ onto a new one; `true` only on `res.ok && data?.verified === true` ([line 38](ui/src/hooks/useNip05Verification.js#L38)). No intermediate/spinner UI. Server adds `Cache-Control: no-store`.
- [x] **AC-5 (both surfaces; search badge unchanged).** Both pages changed identically. R1 green and `git diff --name-only` confirms `BrainstormSearch.jsx` is **not in the diff** — the server-verified pinned badge is untouched.
- [x] **Concrete #151.** Local strfry/Neo4j has no kind-0 data for the two #151 pubkeys, so the rendered-DOM check is **deferred to staging smoke** per the test plan's "Not covered" (N1) — anticipated, not a gap. The impersonation→`false` mechanism that *is* #151 was proven live at the API layer in the local cycle.

No criterion silently dropped. No behavior added beyond the story (no ⚠️/unverified marker — explicitly out of scope and absent from the diff).

## ADR adherence

- [x] **No ADR required.** Architecture intentionally skipped per CLAUDE.md harness rules for Standard-strictness Bug. Story records the skip.
- [x] **No new dependencies.** `git diff --name-only origin/staging...HEAD` shows no `package.json`/`package-lock.json`. The endpoint uses global `fetch`/`AbortController` (already used by the existing `verifyNip05` helpers) and React hooks (existing) — no new imports.
- [x] **Layering respected.** Server logic lives in the module that already owns NIP-05 routes (`src/api/nip05.js`); client logic is a hook in `ui/src/hooks/` mirroring `useProfiles`. No leakage into shared `lib/` or unrelated modules.

## Concept-graph integrity

- [x] N/A. No concept definitions, schemas, firmware JSON, or `kind:pubkey:slug` handles touched. Concept Graph API was unreachable during the cycle but is irrelevant to a UI/API correctness bug. No firmware reinstall needed.

## Things tests can't catch

- [x] **No secrets.** Diff contains only public Nostr pubkeys / a public registry name.
- [x] **No leftover debug logging.** The single `console.warn('useNip05Verification fetch error:', err)` ([line 44](ui/src/hooks/useNip05Verification.js#L44)) mirrors the existing `useProfiles` error-log pattern — intentional, not cruft.
- [x] **No commented-out code.** Comments in `src/api/nip05.js` explain the *why* (the deliberate non-dedup decision, the fail-closed contract) per tone rules — not narration.
- [x] **Error paths.** Fail-closed at every layer: input-type guards + `HEX_PUBKEY_RE` at the boundary ([src/api/nip05.js:158](src/api/nip05.js#L158)), `resp.ok` check, `try/catch → null/false`, `res.ok` check client-side. Verified live.
- [x] **`{nip05Verified && '✅ '}` is not the `{0 && …}` footgun.** `nip05Verified` is a strict boolean from `useState(false)`, so the falsy branch is `false` (React renders nothing), never a stray `0`.
- [~] **Concurrency.** Module-level `verificationCache` Map is shared across mounts; same key concurrently → two idempotent fetches writing the same value (no harmful race). The two surfaces are on different routes, never co-mounted. Acceptable; see Non-blocking #2.
- [~] **Security (SSRF).** Genuine finding — see Blocking analysis below; ruled **non-blocking** for this story with reasoning.

## House rules check

- [x] Concept Graph API authority respected (N/A — no concept code).
- [x] No new lint/typecheck/build tooling.
- [x] No firmware reinstall needed (no concept definitions changed).
- [x] Existing pattern followed (server-side verification, consistent with the trusted meili search path; hook mirrors `useProfiles`).

## Story scope items verified untouched

- [x] **Provider side** (`handleNip05Lookup`, serving our own `.well-known/nostr.json`) — diff hunk shows it as context only; **unchanged**.
- [x] **Existing `verifyNip05` copies** (`src/api/admin/index.js:18`, `src/api/search/profiles/meili/index.js:26`) — confirmed not in the diff. The Implementer correctly resisted consolidation (out of scope, no ADR).
- [x] **Search badge + plain-text surfaces** — `BrainstormSearch.jsx` not in diff; R1/R2 green.

## Findings

### Blocking

_None._

### Non-blocking

1. **[src/api/nip05.js:125–142](src/api/nip05.js#L125) — unauthenticated SSRF surface (pre-existing pattern, constrained oracle). Recommend a repo-wide follow-up; not a blocker for this story.**
   `handleNip05Verify` is registered with no auth middleware ([line 171](src/api/nip05.js#L171)) and `verifyNip05Identifier` fetches `https://<domain>/.well-known/nostr.json` where `domain` comes from `NIP05_LOOKUP_RE` ([line 31](src/api/nip05.js#L31)). That regex's domain group `[\w_-]+(\.[\w_-]+)+` matches IP literals and internal names (`169.254.169.254`, `db.internal`), so an attacker can make the server issue requests to internal/link-local hosts.
   **Why non-blocking:** (a) scheme is hardcoded `https://` and there's a 5s timeout, so most internal/metadata targets (HTTP-only or invalid TLS) just fail → `false`; (b) the fetched body is **never returned** — the endpoint yields only a boolean derived from a pubkey match, i.e. at most a constrained existence/timing oracle, not content exfiltration; (c) **this is the third instance of an already-deployed, accepted pattern** — byte-identical logic already lives in `src/api/search/profiles/meili/index.js:26` (reachable via *public* search) and `src/api/admin/index.js:18` (owner-gated). This story therefore does **not** raise the system's existing risk posture, and consolidating/guarding the three copies (e.g. block RFC1918/link-local/loopback resolution) is explicitly **out of scope** per the story. Blocking an in-scope, well-tested security *fix* on a pre-existing systemic issue would be miscalibrated. **Action:** filed as a separate follow-up (see handoff) — recommend an SSRF guard applied once across all three call sites, plus a decision on whether `/api/nip05/verify` should be rate-limited given it's unauthenticated.

2. **[ui/src/hooks/useNip05Verification.js:40](ui/src/hooks/useNip05Verification.js#L40) — `false` is cached for the page session.** A transient verify failure (network blip, 5s timeout under load) caches `false` for the lifetime of the page session; a genuinely-verified profile would then show no ✅ until a full reload. This is consistent with the fail-closed spec (never *wrongly* green) and the story left caching to Implementation, so it's acceptable — but a short negative-result TTL (or not caching `false`) would make it self-healing. Optional; mention on the next touch.

3. **No in-flight de-dup in the hook.** Two simultaneous verifications of the same key issue two fetches. The two surfaces are on different routes (never co-mounted), so in practice this is at most one redundant request on a fast re-mount. Not worth code now.

4. **cycle-local skill staleness (not this diff).** The skill's `$WT`/`localhost:8080` assumptions don't match this container (publishes :7778/:80; repo isn't a worktree here). I adapted and verified on the correct port. Worth a one-line skill fix in a future ops touch — flagged for awareness, outside story #6.

## Verdict

**PASS** — the diff matches every story #6 acceptance criterion (each has a passing source test, a green out-of-scope sentinel, or a documented staging-smoke deferral consistent with the approved test plan); no ADR required by classification; reviewer-run `npm test` is 32/32 green; the live local cycle proved the verification logic end-to-end including the impersonation→`false` case that is the core of #151; out-of-scope surfaces (provider side, the two existing helpers, the search badge, plain-text renders) are confirmed untouched; no new dependencies; minimal, on-scope change.

The SSRF finding is real and named precisely, but it is a **pre-existing, systemic, already-deployed pattern** that this story explicitly scoped out of consolidating, and is mitigated here to a constrained boolean oracle — non-blocking, with a repo-wide follow-up filed.

**Recommended next steps:** standard deploy chain — `cycle-staging`, then the test plan's "Not covered" staging smoke (N1: both #151 pubkeys show **no ✅**; N2: a `@brainstorm.world` registry identity shows ✅; N3: no pre-confirmation ✅ flash; N4: no-nip05 profile unchanged) as the **authoritative behavioral gate**, then `cycle-prod`. Close issue #151 when the fix reaches `main` (prod), since the bug reproduces on prod.
