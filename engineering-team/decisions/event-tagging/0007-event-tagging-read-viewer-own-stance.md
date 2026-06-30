# ADR 0007: Event-tagging read — the viewer's own stance ("mine" channel)

**Status:** Accepted
**Date:** 2026-06-30
**Story:** `engineering-team/stories/event-tagging/7-event-tagging-read-viewer-own-stance.md`

## Context

Story 6 surfaced a POV-first gap: `GET /api/event-tags/for-event` returns a note's tags **POV-trust-filtered**, with no carve-out for the viewer's own assertion — so a logged-in viewer the active POV doesn't rank ≥ `minRank` cannot see their own just-applied tag after a reload (it vanishes). Story 7 adds the durable "mine" channel that fixes it, mirroring how the pubkey-tagging read already surfaces the viewer's own contribution separately from the trust-filtered counts.

Facts that shape the design:

- **The classification already lives in the pure core (by deliberate decision).** ADR 0004 factored the read-time classification into `classifyEventTaggings` (`src/lib/event-tagging/classify.js`) — a dependency-free, SDK-extractable function — precisely so the wire/trust logic isn't re-inlined in the handler. Its per-candidate flow is: descriptor `z` present → header resolvable (else `unverifiable`) → header joins an **honored authority** (else excluded/illegitimate) → header names its tag → **`if (!trusted(c.pubkey)) continue;`** (`classify.js:89`, the trust filter) → polarity bucket → grouped into `tags`.
- **The viewer's own assertion is already in the candidate set.** `handleForEvent` (`src/api/event-tags/index.js:107-151`) scans `filterTagsAppliedToEvent({ target })` — `{ kinds:[39999], '#e':[noteId] }`, **namespace-agnostic, keyed on the target** — so it returns *every* assertion on the note, including the viewer's. The handler `dedupeReplaceable`s candidates **before** classify, and the assertion `d`-tag is deterministic per `(slug, target, asserter)` — so a viewer's apply-then-dispute is already collapsed to their **single latest** assertion upstream. The viewer's stance is present; it's only **dropped at line 89** when the POV doesn't trust them.
- **The precedent names this exact pattern.** The pubkey-tagging read threads a `viewerPubkey` query param and carves out `ev.pubkey === viewerPubkey` to surface the viewer's own contribution regardless of trust (`src/api/profile-tags/index.js:661,684,718`). "`viewerPubkey`" (the whose-own-contribution identity) is distinct from "`userPubkey`" (the which-POV-to-score-against identity); both already exist.
- **Two axes, only one to bypass.** "Counts for me" has two gates: **legitimacy** (the descriptor resolves to a header joining an honored `tagging-with-specific-tag` authority) and **trust** (the POV ranks the asserter). The story's "even if my view's trust scoring doesn't count me" is the **trust** axis only. A viewer who published via the Story-5 hook (dual-z `[canonical, local]`, header on the local relay) is **legitimate**; it's solely the trust filter that drops them. So `mine` bypasses **trust**, but still requires **legitimacy** (so each `mine` entry resolves to a real tag identity `authorPubkey:slug`).

No concept/firmware change → no reinstall.

## Options considered

### Option A — Add `viewerPubkey` to the pure core classifier; emit a `mine` channel (recommended)

`classifyEventTaggings({ candidates, headers, honoredAuthorities, isAsserterTrusted, viewerPubkey })` → `{ tags, unverifiable, mine }`. For each candidate that passes the legitimacy gates, compute its tag identity + polarity as today; additionally, **if `c.pubkey === viewerPubkey`, record it into `mine` regardless of trust**; include it in the counted `tags` only if `isAsserterTrusted(c.pubkey)` (unchanged). `viewerPubkey` absent → `mine: []`. The handler reads `req.query.viewerPubkey`, passes it through, and returns `mine` in the response.

- **Pros:** Keeps **all** tagging-classification logic in the one pure, tested, SDK-extractable place — consistent with ADR 0004's reason for the core existing. Single pass. A third-party SDK consumer gets "my stance" too. Legitimacy gating, tag-identity keying, and latest-wins (via upstream dedupe) are reused, not reimplemented. Purely additive: no `viewerPubkey` → identical output, so existing consumers and the counted tally are untouched.
- **Cons:** Additive change to the core function's contract (one optional param, one new return field) — covered by the existing core purity guard + read-api tests.

### Option B — Compute `mine` in the server handler, outside the core

The handler separately filters candidates by `c.pubkey === viewerPubkey`, re-resolves their headers, and builds `mine` itself.

- **Cons:** Re-implements the descriptor→header→honored-authority→tag-identity resolution that already lives in `classifyEventTaggings` — exactly the drift the core exists to prevent (the same reason ADR 0004 rejected an inlined handler). **Rejected.**

### Option C — Run `classifyEventTaggings` twice (real POV predicate for `tags`; a viewer-only predicate `pk => pk === viewerPubkey` for `mine`)

Reuse the classifier unchanged with a second predicate; relabel the second run's `tags` as `mine`.

- **Pros:** Zero change to the core function.
- **Cons:** Double-pass over the same candidates/headers; semantically awkward (a *community* classifier repurposed as a *personal* filter); the second run also recomputes `unverifiable`, which must be discarded. More surprising to a future reader than a first-class `viewerPubkey`/`mine`. **Rejected** in favor of A's explicit, single-pass contract.

## Decision

**Option A.** Add an optional `viewerPubkey` to `classifyEventTaggings` and emit a `mine` channel — the viewer's own per-tag stance, **legitimacy-gated but trust-unfiltered** — kept distinct from the POV-counted `tags`. The `for-event` handler threads `req.query.viewerPubkey` through and returns `mine`. Purely additive.

Resolved open questions from the story:

- **Open Q1 (unverifiable-own edge).** `mine` covers the viewer's stance on **legitimate, verifiable** taggings only (the header resolves and joins an honored authority — the normal case, including anything the viewer just published via the Story-5 hook). A viewer's own assertion whose **header is not locally resolvable** stays in the existing `unverifiable` bucket and is **not** added to `mine` — it can't be keyed to a tag identity, and surfacing the unverifiable bucket in the UI is already a separate deferred follow-up. This keeps Story 7 tight and targets the actual Story-6 reload bug (verifiable taggings).
- **Open Q2 (how the viewer is identified).** A dedicated optional `viewerPubkey` query param on `for-event` — distinct from the POV's `userPubkey` (a viewer may read under the house POV yet still be "the viewer"). Mirrors the pubkey-tagging pin carve-out. Malformed/absent → silently treated as no viewer (no `mine`).

## Consequences

- **Enables** Story 6 to render the viewer's own stance durably (read from `mine`), so a just-applied tag survives reload even when the POV doesn't count the viewer. Story 6's optimistic update becomes a latency nicety over a durable read.
- **Counted tally is provably unaffected.** The trust filter on the counted `tags` is unchanged; the viewer's untrusted assertion appears **only** in `mine`, never inflating `applications`/`disputes`. (Directly testable — AC "does not inflate the community tally.")
- **Backward-compatible.** No `viewerPubkey` → `mine: []` and byte-identical `tags`/`unverifiable`; existing consumers (and the pubkey-tagging read) are untouched.
- **Latest-wins is inherited, not added.** `mine` relies on the handler's existing `dedupeReplaceable` collapsing a viewer's apply→dispute flip to their latest assertion before classify. (Document this dependency in the core function so a future caller that skips dedupe understands the contract.)
- **SDK surface grows by one field.** `classifyEventTaggings` now also answers "what did *this* author assert," which is generally useful to any consumer.
- **Firmware reinstall required?** No.

## Implementation notes

- **`src/lib/event-tagging/classify.js`** — extend `classifyEventTaggings` signature to `{ candidates, headers, honoredAuthorities, isAsserterTrusted, viewerPubkey }` and return `{ tags, unverifiable, mine }`:
  - Reorder the per-candidate logic so the **legitimacy** gates (descriptor present, header resolvable, honored authority, header names its tag, polarity not neutral) run **before** the trust check, yielding the tag identity `{ authorPubkey, slug }` + bucket for every legitimate candidate.
  - If `viewerPubkey` is set and `c.pubkey === viewerPubkey`, push the candidate's stance into `mine` **regardless of trust**. Independently, include it in the counted `tags` **iff** `isAsserterTrusted(c.pubkey)` (unchanged behavior for the counted set).
  - `mine` shape: `[{ tag: { authorPubkey, slug }, stance: 'apply' | 'dispute', eventId, createdAt }]` — at most one entry per tag for the target (upstream dedupe guarantees a single latest assertion per `(tag, target, viewer)`). Empty array when `viewerPubkey` is absent/falsy.
  - Stays pure/dependency-free — the core purity guard continues to cover it.
- **`src/api/event-tags/index.js` → `handleForEvent`** — read `const viewerPubkey = isHexPubkey(req.query.viewerPubkey) ? req.query.viewerPubkey : undefined;` pass it into `classifyEventTaggings`, and add `mine` to the JSON response (`res.json({ ..., tags, unverifiable, mine })`). No change to the candidate scan, header resolution, authorities, or the POV predicate.
- **No other consumers change.** `headers-for-tag` and the pubkey-tagging read are untouched. (Story 6 will consume `mine`; that's the next story, not this one.)

## Out of scope

- **The note UI consuming `mine`** — Story 6.
- **Changing the counted classification / trust / authority rules** — unchanged; `mine` is purely additive.
- **The write path** — Story 5, unchanged.
- **Surfacing the `unverifiable` bucket (incl. an own-but-unverifiable assertion)** — separate deferred follow-up (logged in `_intake.md`).
