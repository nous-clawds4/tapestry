# Review: Story 1 — Single-letter tag filters in the Negentropy Sync panel

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-15
**Diff:** `git diff origin/staging..HEAD` (base `9c40ba80`, head `33f20c81` — story/ADR/tests/impl commits `c9f3e132..33f20c81`)

## Quality gates (run by reviewer, not trusted)

- [x] Story suite executed directly: **20/20 PASS** (`node -e "require('./test/sync-panel-tag-filters.test.js').run()"`).
- [x] Full `npm test`: our suite PASS; `Overall: FAIL` is the **known environmental failure** — 11 tag/pin/TL stack-dependent suites fail against the stale/empty local Docker stack (**OPEN.md #27**, practice precedented in `reviews/nip-reorg/*`). Independently re-verified this review: `profile-tags` fails **10 pass / 3 fail identically** on this tree and on a pristine `origin/staging` worktree (fresh differential, this session). Binding gate is CI `stack-free`, where these suites skip; the story suite is stack-free by design.
- [x] `npx vite build` — **PASS** (22.1s; chunk-size warnings pre-existing).
- [x] Adversarial spot-execution of exported helpers: `__proto__`/`constructor`/`#☃`/`##` keys all dropped (no prototype pollution — verified `({}).x` undefined after parse); `[null,{},[],'',0,'keep']` sanitizes to `['keep']`; newlines in values are JSON-escaped in the preview string.
- [x] _Lint / typecheck / build-step gates not configured — skipped per house rules._
- [ ] Playwright — not applicable (no Playwright surface for this panel; see test plan "Test levels" for the documented rationale and the manual-verification record in the story's `## Deviations`).

## Spec adherence
- [x] Every acceptance criterion has at least one passing test — coverage map in the test plan holds: AC-1 (U2,S1–S3), AC-2 (B3,S2), AC-3 (S4 + inline removal), AC-4 (U1,U7), AC-5 (U3–U5,S5), AC-6 (U6), AC-7 (U2), AC-8 (B1–B6).
- [x] No criterion silently dropped. The story's three open-question defaults (uppercase P/E/A validated; merge-on-duplicate; bech32 accepted) are implemented as approved.
- [x] No behavior beyond the story. The diff adds exactly: validation module, editor component + state + composition-point line + one settings-group block, backend key-class whitelist + exports, tests + wiring, and the phase docs.

## ADR adherence
- [x] Files match ADR §Implementation exactly: `ui/src/utils/tagFilterValidation.js` (new, pure ESM), `TagFilterEditor` module-scope in `RelaySettings.jsx` (TimestampPicker precedent, [RelaySettings.jsx:778–869](../../ui/src/pages/settings/RelaySettings.jsx)), state at :897, composition at :937, group between Authors and Time Range at :1163–1170; backend `TAG_FILTER_KEY_RE` + loop at [negentropySync.js:23–41](../../src/api/strfry/negentropySync.js) and exports at :361–363.
- [x] Layering respected: validation in the pure core, UI as a thin shell, server enforces shape not format (Option A as decided; Options B/C correctly not built).
- [x] No new dependencies — `nostr-tools` was already a dependency of both `ui/` and the server.

## Concept-graph integrity
- [x] No concept definitions changed; no firmware reinstall needed (ADR states this; confirmed — no `firmware/` diff).
- [x] No TA-pubkey literals anywhere in the diff (grep: only `aaaa…`/`bbbb…` fixtures inside tests; UI/server resolve nothing TA-related). ADR 0015's `LEGACY_*` constants untouched.
- [x] Handles referenced in docs remain `kind:pubkey:slug` form.

## Things tests can't catch
- [x] No secrets (test fixtures are freshly minted per run via `generateSecretKey`).
- [x] No leftover debug logging, commented-out code, or dev-harness remnants (grep clean; the temporary verification harness documented in story `## Deviations` is absent from the tree and from git history).
- [x] Error paths: malformed bech32, wrong-type bech32, mixed valid/invalid entries, empty values — all blocked with the offending value named; server side tolerates non-array/garbage values by dropping them.
- [x] Concurrency: no new async paths; `activeSync` single-flight logic untouched.
- [x] Security: values reach the process as argv array (no shell) via `spawn`/`execFile`; JSON.stringify escapes control characters; single-quote-in-value affects only the *display* preview string (ADR-documented accepted limitation, re-verified live).

## House rules check
- [x] Concept Graph API authority respected (no BIBLE re-derivation in code).
- [x] No new lint/typecheck/build tooling.

## Product-guide adherence
- Not applicable — no PRD traces to this story (bounded operator-tooling ask).

## Findings

### Blocking
None.

### Non-blocking
1. **[RelaySettings.jsx:815](../../ui/src/pages/settings/RelaySettings.jsx)** — a user who types `#x` into the letter box gets the length error (maxLength truncates to `#`, which then errors clearly). Optional improvement: strip a leading `#` before validating. Cosmetic; error copy already explains the rule.
2. **[tagFilterValidation.js:66](../../ui/src/utils/tagFilterValidation.js)** — `parseInt` normalization of an absurdly long `a`-coordinate kind (>2^53 digits) loses precision in the normalized string. Harmless (such a coordinate matches nothing on any relay); tighten to `\d{1,10}` only if it ever matters.
3. **Live Count/Start round-trip** against an updated backend is intentionally unverifiable on this machine (Docker stack serves the stale shared checkout; owner-gated UI) — B1–B6 pin the contract. **Ask:** verify Count + a scoped `#z` sync once on staging after merge (the story's own motivating command is the natural smoke test).

### Harness friction
1. **No book was opened at intake for this ask.** CLAUDE.md's "Books of work" says a new book opens `engineering-team/audits/<book-slug>/book.md` eagerly at intake; this session entered the engineering flow via `/plan-feature` (as CLAUDE.md's routing table directs) and nothing in `plan-feature.md` opens or checks for the book — so completion detection at review time found no anchor. Remedied this session by opening the book retroactively. Logged as OPEN.md #29 (`meta`): either `/plan-feature` should open/verify the book when none exists, or the routing table should send new asks through Phase 0 intake first.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection run: no `book.md` existed (see harness friction #1); book opened retroactively at `engineering-team/audits/sync-panel-tag-filters/book.md` with the operator's verbatim ask as acceptance frame — the single story satisfying it is now Done, so the book looks complete; `/close-book` offered to the operator (not auto-run).
