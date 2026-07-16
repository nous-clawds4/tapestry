# Test Plan: Story 7 — Event-tagging read, the viewer's own stance ("mine" channel)

**Story:** `engineering-team/stories/event-tagging/7-event-tagging-read-viewer-own-stance.md`
**ADR:** `engineering-team/decisions/event-tagging/0007-event-tagging-read-viewer-own-stance.md`
**Date:** 2026-06-30

## Approach

One CJS suite — `test/event-tagging-read-viewer-stance.test.js` — wired into `test/test.js`, in the same three-layer shape as the Story-4 read-api suite (and reusing its fixture style).

Per ADR-0007 (Option A), the change is **additive** and lives almost entirely in the pure core: `classifyEventTaggings` gains an optional `viewerPubkey` and emits a `mine` channel (the viewer's own per-tag stance, **legitimacy-gated but trust-unfiltered**), kept distinct from the POV-counted `tags`. The handler thread-through is a thin two-line change. So:

1. **Classifier unit tests (the meat).** Drive `classifyEventTaggings({ …, viewerPubkey })` with synthetic candidates/headers — deterministic, no stack. This is where every AC about *what `mine` contains* and *what it must not affect* is proven.
2. **Source-contract.** The `for-event` handler reads a **hex-validated** `req.query.viewerPubkey`, passes it into `classifyEventTaggings`, and returns `mine` in the JSON response.
3. **HTTP smoke (skip-gated).** `for-event` still `400`s on bad input (regression) and a well-formed (even tag-less) target returns `200` carrying a `mine` array. Skips if `:7778` is unreachable / the route is absent.

## Coverage map

| Criterion (AC) | Test name | Layer |
|---|---|---|
| My applied tag reflected even when POV untrusts me | `mine: a viewer the POV does NOT trust still sees their own APPLIED tag in mine` | classifier |
| My disputed tag reflected, same condition | `mine: a viewer the POV does NOT trust still sees their own DISPUTED tag in mine` | classifier |
| Distinct from community count **+** no tally inflation | `mine: the viewer's untrusted stance is surfaced in mine but NEVER inflates the counted tally` | classifier |
| Latest-wins reflects a flip | `mine: reflects the current (deduped-latest) stance — a flipped dispute shows as dispute, not also apply` | classifier |
| Backward-compatible (no viewer) **+** additive for existing consumers | `mine: backward-compatible + additive — omitting viewerPubkey yields mine:[] and byte-identical tags/unverifiable` | classifier |
| How the viewer is identified (hex-validated `viewerPubkey`) + `mine` returned | `src: for-event threads a hex-validated req.query.viewerPubkey into classifyEventTaggings and returns mine` | source-contract |
| Endpoint returns `mine`; no input-validation regression | `http: for-event still 400s on bad input (regression) and a 200 response carries a mine array` | http (skip-gated) |

### Edge cases / ADR-resolved decisions (additional tests)

- **A TRUSTED viewer appears in BOTH the counted tally and `mine`** — `mine` is additive, not exclusive (so the chip can show "you applied" *and* the community count includes you). → `mine: a TRUSTED viewer appears in BOTH the counted tags and mine`.
- **ADR Open-Q1 — own *unverifiable* assertion is NOT in `mine`** (legitimacy gate; stays in `unverifiable`). → `mine: legitimacy-gated — the viewer's own UNVERIFIABLE assertion is NOT in mine`.
- **ADR — own assertion under an *un-honored authority* is NOT in `mine`** (legitimacy gate). → `mine: legitimacy-gated — the viewer's own assertion under an un-honored authority is NOT in mine`.
- **Empty cases** — viewer present but with no stance on the target ⇒ `mine:[]`; empty candidates ⇒ `mine:[]`, no throw. → `mine: empty when the viewer has no assertion on the target, and when there are no candidates`.
- **`mine` entry shape** — `{ tag:{authorPubkey,slug}, stance:'apply'|'dispute', eventId, createdAt }`. → `mine: each entry is { tag:{authorPubkey,slug}, stance, eventId, createdAt }`.

### A note on the three currently-green tests (invariant guards, by design)

The three "must NOT be in `mine`" cases (unverifiable-own, un-honored-own, empty) pass in the red phase because the absent feature yields an empty `mine`. They are **invariant guards**: they pin the legitimacy gate + emptiness conditions and will catch an **over-permissive** implementation (one that routes *every* viewer candidate into `mine`, ignoring the unverifiable/illegitimate/no-stance gates). They are expected to stay green through implementation. Every *feature-bearing* assertion (mine must be populated, correctly shaped, returned by the handler, and additive) is red until the code lands.

### Latest-wins (AC) — where it's actually proven

The classifier reflects the *single deduped-latest* candidate's stance (tested directly). The apply→dispute **collapse** itself is upstream: the handler's existing `dedupeReplaceable` keys on `(pubkey, d-tag)`, and an assertion's `d`-tag is deterministic per `(slug, target, asserter)` — so apply and dispute of one (tag, target, viewer) share a `d` and the latest wins. That `d`-collision is already proven in the **write-path** suite (`event-tagging-write-path.test.js` — "replaceability: re-apply and apply↔dispute reuse the same deterministic assertion d"). This story's test asserts the classifier faithfully surfaces whichever single candidate survives.

## Test infrastructure

- Runner: `node test/test.js`. No new framework, no build.
- Classifier + source-contract layers need **no stack** (pure function + file read). HTTP smoke targets `:7778`, skip-gated.
- To be created/changed by the Implementer: `viewerPubkey`/`mine` in `src/lib/event-tagging/classify.js`; the `req.query.viewerPubkey` thread-through + `mine` in the response in `src/api/event-tags/index.js` (`handleForEvent`).

## How to run

```
npm test
```

## Verification

The new tests fail with the current code. Confirmed on 2026-06-30 at commit `e83e3e79`:

```
--- event-tagging read viewer-stance tests (epic event-tagging, Story 7) ---
  FAIL  mine: a viewer the POV does NOT trust still sees their own APPLIED tag in `mine`
        the untrusted viewer's own apply must appear in `mine` (trust-unfiltered)
  FAIL  mine: a viewer the POV does NOT trust still sees their own DISPUTED tag in `mine`
        the untrusted viewer's own dispute must be in mine with stance 'dispute', got undefined
  FAIL  mine: the viewer's untrusted stance is surfaced in `mine` but NEVER inflates the counted tally
        the viewer still sees their own apply in `mine`
  FAIL  mine: reflects the current (deduped-latest) stance — a flipped dispute shows as dispute, not also apply
        exactly one mine entry per tag for the target, got 0
  FAIL  mine: a TRUSTED viewer appears in BOTH the counted tags and `mine` (mine is additive, not exclusive)
        a trusted viewer must ALSO see their stance in `mine`
  PASS  mine: legitimacy-gated — the viewer's own UNVERIFIABLE assertion is NOT in `mine` (stays in unverifiable)
  PASS  mine: legitimacy-gated — the viewer's own assertion under an un-honored authority is NOT in `mine`
  FAIL  mine: backward-compatible + additive — omitting viewerPubkey yields mine:[] and byte-identical tags/unverifiable
        with no viewerPubkey, `mine` must be an empty array (no viewer-stance information)
  PASS  mine: empty when the viewer has no assertion on the target, and when there are no candidates
  FAIL  mine: each entry is { tag:{authorPubkey,slug}, stance, eventId, createdAt }
        expected a mine entry
  FAIL  src: for-event threads a hex-validated req.query.viewerPubkey into classifyEventTaggings and returns `mine`
        handleForEvent must read req.query.viewerPubkey
  FAIL  http: for-event still 400s on bad input (regression) and a 200 response carries a `mine` array
        the for-event response must include a `mine` array

event-tagging-read-viewer-stance: 3 passed, 9 failed, 0 skipped
```

The 9 feature-bearing tests are red for the right reason: `classifyEventTaggings` has no `viewerPubkey`/`mine` yet, and the handler neither reads `viewerPubkey` nor returns `mine`. The HTTP layer **fails rather than skips**, confirming the local stack is up and the endpoint is genuinely exercised (it returns `200` with no `mine` key). The 3 green tests are invariant guards (above). The existing Story-4 read-api suite must stay green after the additive change (verified at Review).
