# Test Plan: Story 33 — Found a circle by declaring its definition

**Story:** `engineering-team/stories/communities-declaration/33-found-a-circle.md`
**ADR:** `engineering-team/decisions/communities-declaration/0029-community-declaration-shape-and-coexistence.md`
**Date:** 2026-06-05

## Coverage map

| Criterion | Test(s) | File | Level |
|---|---|---|---|
| AC-1 (publish a CD that exists/retrievable) | T1 (exports), T2 (kind-39998 + d=slug + name/description) | `test/found-a-circle.test.js` | unit (pure-fn) |
| AC-2 (founder lands on read-only detail) | T7 (build → publish → navigate to /community/<slug>) | same | source-regex |
| AC-3 (founder is a peer, no owner/admin label) | T3 (founder tag, no owner/admin tags), T10 (no owner/admin labels in Found.jsx) | same | unit + source-regex |
| AC-4 (belonging-bar as prose, not member list) | T4 (belonging tag present; no seed/member tags) | same | unit (pure-fn) |
| AC-5 (sign-in only at publish, state preserved) | T8 (gated on signedIn; inline sign-in at publish) | same | source-regex |
| AC-6 (specific publish-error copy) | T9 (imports + uses publishErrorCopy from lib/errors.js) | same | source-regex |
| AC-7 (strangler: existing circles undisturbed) | T5 (build.js untouched, no CD builder), T6 (normalized read path w/ model discriminator) | same | source-regex |

## Edge cases
- [ ] Empty/whitespace belonging-bar or name — builder should reject or the flow should block publish (Implementer's call; not yet a hard test — flagged).
- [ ] Slug derivation from name (reuse `lib/slug.js`) — covered by the existing slug suite; not re-tested here.
- [ ] A founded CD must not appear as a bespoke kind-39999 record (T5 guards the builder side; the read-union dedupe is exercised at integration/manual level).
- [ ] Mock-mode parity (dev keeps populated; prod publishes to the relay) — manual walkthrough below.

## Test infrastructure
- **Framework:** Node built-in runner (`node test/test.js`), source-regex + pure-function-eval style (matches `participate-kind1-reads-writes.test.js`).
- **Registered** in `test/test.js` as the `found-a-circle` suite.
- **Concept Graph API:** not required for these tests (the CD path reads/writes the relay directly per ADR 0029). The local stack is on `:8080`; the concept-graph API is at `http://localhost:8080/api/concept-graph/...` (not `:8877`).
- **Firmware:** no `POST /api/firmware/install` precondition (no concept-schema change for this story).
- **Fixtures:** none; pure-function tests construct inputs inline.

## Expected initial state (TDD)
All 10 tests **fail now** — `events/declaration.js` and `pages/Found.jsx` do not exist, and the read path has no `model:'declaration'` discriminator yet. Failures are meaningful (each names the missing export/module/wiring).

## How to run
```
npm test            # full suite incl. the found-a-circle suite
```
Browser/e2e (manual, post-implementation): `cd ui-communities && npm run dev` → found flow → publish → land on the new circle.

## Verification
- Each AC maps to ≥1 test (table above).
- After implementation: the `found-a-circle` suite is green, and **no prior suite regresses** (the bespoke `build.js` / `Create.jsx` stay untouched — T5 guards this).
