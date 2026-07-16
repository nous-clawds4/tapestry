# Test Plan: Story 4 — Event-tagging read API

**Story:** `engineering-team/stories/event-tagging/4-event-tagging-read-api.md`
**ADR:** `engineering-team/decisions/event-tagging/0004-event-tagging-read-api.md`
**Date:** 2026-06-29

## Approach

One CJS suite — `test/event-tagging-read-api.test.js` — wired into `test/test.js`. Three layers.

**The testability decision (Tester-imposed, justified below).** `profile-tags` is tested purely by HTTP against the live `:7778` (status + shape), because its logic is trivial (direct `a`-read). The event-tagging read logic is *not* trivial — it resolves the indirect descriptor and applies a **3-state classification** gated by a **reader-chosen authority set** and a **POV trust predicate**. Those are exactly the bug- and sovereignty-prone parts, and HTTP-against-uncontrolled-relay-data cannot deterministically assert "counted under authority A, illegitimate under B" or "unverifiable surfaced, not dropped". So the Implementer must factor the read-time classification into a **pure function** —

```
classifyEventTaggings({ candidates, headers, honoredAuthorities, isAsserterTrusted })
  -> { tags: [ { tag:{authorPubkey, slug}, applications:[entry…], disputes:[entry…] } … ],
       unverifiable: [ { eventId, authorPubkey, descriptor, createdAt } … ] }
   entry = { eventId, authorPubkey, polarity, createdAt }
```

— a pure, dependency-free function (it takes already-fetched events + the honored-authority list + a trust predicate; no I/O). It belongs in the Story-1 core (`src/lib/event-tagging`) as the read-side complement to the filter builders — same SDK-extractable, dependency-free contract (the core purity guard already covers it). The HTTP handler becomes thin: scan → dedupe → resolve headers → `resolvePov`-derived predicate → `classifyEventTaggings`. This makes the sovereignty/3-state ACs deterministically testable in-process, and gives a third-party reader the same logic.

1. **Classifier unit tests (deterministic — the meat).** Import `classifyEventTaggings` and drive it with synthetic event fixtures.
2. **Source-contract.** Routes wired; module requires the CJS core + `resolvePov`; no hardcoded single authority (authorities parameterized; default includes the runtime TA); classifier exported.
3. **HTTP smoke (skip-gated).** `GET /api/event-tags/for-event` validates input (`400`, not `500`) and the route exists — skips if `:7778` unreachable or the route isn't wired yet.

## Coverage map

| Criterion | Test | Layer |
|---|---|---|
| Indirect descriptor resolved → tag | `classify: resolves descriptor (assertion z→header→tag), counts under applications` | classifier |
| 3-state classification | `classify: counted / illegitimate (header not honored) / unverifiable (header absent)` | classifier |
| Unverifiable ≠ illegitimate (not dropped) | `classify: candidate with no resolvable header is surfaced in unverifiable, never dropped` | classifier |
| Legitimacy authority is a parameter (sovereignty) | `classify: same input, honoredAuthorities flips counted↔excluded; splinter readable when honored` | classifier |
| Namespace-agnostic candidate set | `classify: candidates with different nostr-event-tag concept-z are both classified by descriptor` | classifier |
| Polarity bucketing + per-tag grouping | `classify: polarity 1/-1/0/absent → applied/disputed/dropped/applied, grouped by tag` | classifier |
| POV-filtered at read time | `classify: isAsserterTrusted predicate drops out-of-trust asserters` | classifier |
| Empty / non-tagging input | `classify: empty candidates → empty result; a candidate with no descriptor z is skipped` | classifier |
| Endpoints wired | `src: src/api/index.js registers /api/event-tags/for-event + /headers-for-tag` | source-contract |
| Reuse + parameterized authority | `src: module requires ../../lib/event-tagging + ../_shared/pov; reads req.query.authorities; default authority includes runtime TA (no single hardcoded gate)` | source-contract |
| Malformed/empty target | `http: for-event with no/malformed target → 400 (skip if route absent/unreachable)` | http smoke |
| applicable tags reuse | (documented: clients use existing `/api/profile-tags/available-tags`; no new endpoint — asserted by absence, see notes) | — |

## Edge cases
- [ ] A candidate carrying a descriptor whose header is present **but** joins only an un-honored authority → **illegitimate** (absent from `tags`, absent from `unverifiable`).
- [ ] The *same* candidates+headers under `honoredAuthorities=[A]` vs `[B]` produce different counts — proving the data is re-interpreted, not erased.
- [ ] A splinter authority's header counts when that authority is honored (sovereignty: a divergent publisher is readable).
- [ ] `polarity` exactly `0` (or any value in `(-0.5, 0.5)`) is dropped; absent `polarity` defaults to applied.
- [ ] Two distinct tags on one target → two grouped entries, each with its own applications/disputes.
- [ ] HTTP smoke skips (not fails) when `:7778` is down, so the aggregate run isn't environmentally red.

## Test infrastructure
- Runner: `node test/test.js`. No new framework, no build.
- Classifier + source-contract layers need **no stack** (pure function + file reads). HTTP smoke targets `:7778`, skip-gated.
- To be created by the Implementer: `classifyEventTaggings` in `src/lib/event-tagging`; `src/api/event-tags/index.js` (`/for-event`, `/headers-for-tag`); routes in `src/api/index.js`.

## How to run
```
npm test
```

## Verification
Classifier + source-contract tests fail with current code (classifier/module/routes absent); HTTP smoke skips (route not wired). Captured at red-phase commit.
