# Review: Story 1 — Event-tagging protocol core + spec

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-25
**Diff:** working tree vs `c3900a8a` (test-design commit) — new `src/lib/event-tagging/` + edits to `protocols/drafts/event-taggings.md`, `protocols/README.md`, `protocols/drafts/tags.md`
**Story:** `engineering-team/stories/event-tagging/1-protocol-core-and-spec.md`
**ADR:** `engineering-team/decisions/event-tagging/0001-protocol-core-and-spec.md`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/event-tagging-core.test.js` → **12 passed, 0 failed** (re-run independently).
- [x] `node test/event-tagging-spec.test.js` → **5 passed, 0 failed** (re-run independently).
- [~] Full `npm test` (`node test/test.js`) — the harness parses and wires both new suites (`node --check` clean; tally lines 625–626). The remaining suites are HTTP-integration against the local stack (`:7778`/`:8877`), which this pure-construction story does not touch; not run here.
- [x] _Lint / Typecheck / Build not configured — skipped (per CLAUDE.md, JS-without-build)._

## Spec adherence
- [x] Every acceptance criterion has a passing test (AC-1…AC-10 mapped in the test plan; all green).
- [x] No criterion silently dropped.
- [~] One justified deviation from the *draft example* (not the protocol): tag-element representation moved to content-based (`{tag:{slug,name,description}}`) + `d=slug`, matching the real `tag` concept and `tags.md` § "Tag definitions" — see Non-blocking #2. Operator-approved (`d=slug`).

## ADR adherence
- [x] Files match the ADR's Implementation notes: `src/lib/event-tagging/{handles,slug,builders,filters,index}.js`; spec finalized in place; README indexed; `tags.md` pointer flipped.
- [x] Module boundary respected — dependency-free, CJS, single source of truth (purity test enforces no app `require`, no `import`, every `require` a sibling `./`).
- [x] No new dependencies. `taPubkey` is a parameter everywhere; **no 64-hex literal in source** (grep clean) — CLAUDE.md "never hardcode TA pubkey" honored.
- [ ] **Pubkey-format validation does not match the ADR's specified guard** — see Blocking #1.

## Concept-graph integrity
- [x] Handles in `kind:pubkey:slug` form throughout (`handles.js`).
- [x] **No firmware reinstall** — correct; this story changes no concept definitions (the two new concepts are seeded in Story 3). ADR consequence honored.
- [x] N/A — pure construction; no graph reads.

## Things tests can't catch
- [x] No secrets; no debug `console.log`; no commented-out code in the core.
- [ ] **Error paths: validation asymmetric** — `asserterPubkey` is guarded, but the two pubkeys that *compose addressable handles* are not (Blocking #1).
- [x] Concurrency N/A (pure functions, no shared state).
- [x] Local-only build invariant respected: the core has **no publish surface at all** — purity test bans `PUBLISH_RELAYS`/`nostrPublish`/`SimplePool`/`fetch(`/`wss:`. Nothing here can reach a relay.

## House rules check
- [x] Concept Graph authority respected (handles composed, not invented).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking

1. **`src/lib/event-tagging/builders.js:75` (and `buildTaggingHeader`, no line)** — **Pubkey validation guards the wrong pubkey relative to the ADR.** The ADR (Implementation notes) says: *"Validate `polarity ∈ {1,-1}` and pubkeys match `/^[0-9a-f]{64}$/`; throw on malformed (**mirrors `publishProfileTag.js:54`**)."* But `publishProfileTag.js:54` specifically guards the **tag-element author** pubkey — because a malformed author pubkey silently composes a bad `a`-coordinate (the legacy-set-regrowth / "lost tags" failure class CLAUDE.md and that file's comment call out). The implementation instead validates only `asserterPubkey` and leaves the **handle-composing author pubkeys unguarded**:
   - `buildEventTaggingAssertion`: `headerAuthorPubkey` flows into `taggingHeaderAddr(headerAuthorPubkey, slug)` → the descriptor `z` tag. A malformed value silently yields `39999:<garbage>:tagging:<slug>-tagging` — an assertion discoverable by no one.
   - `buildTaggingHeader`: `tagAuthorPubkey` flows into `tagElementAddr(tagAuthorPubkey, slug)` → the `a` tag. **No validation at all** in this builder.

   This is the exact silent-failure mode the mirrored guard exists to prevent, and it lands in the **foundational SDK module** Stories 4/5 and a third-party dev will copy — so the gap propagates.

   **Asked change:** add `requireHex64(...)` for the handle-composing author pubkeys — `headerAuthorPubkey` in `buildEventTaggingAssertion` and `tagAuthorPubkey` in `buildTaggingHeader` — alongside the existing `asserterPubkey` guard, throwing on malformed (no silent fallback). Add a test asserting each throws on a malformed author pubkey (extend `test/event-tagging-core.test.js`). `taPubkey` may stay unguarded (runtime-config sourced, non-fatal per the borrowed pattern) — but note that choice in a comment.

### Non-blocking

1. **`protocols/drafts/tags.md:19`** — The family-tree bullet still reads `**nostr-event-tag** *(planned)*`, but the spec now exists and the "Event tagging" section was flipped to point at it. Optional: drop "(planned)" and link `event-taggings.md` so the two references agree. (Line 5 "the planned event-tagging direction" is inside the repo-metadata `Sources` block — historical, leave as-is.)
2. **`src/lib/event-tagging/builders.js:34` / spec** — The tag-element example/shape was corrected from the draft's tag-based (`["name",…],["description",…]`) to content-based (`{tag:{…}}`), matching the real `tag` concept and `tags.md`. This is a deviation from the *literal draft example* but the correct, consistent choice (operator-approved `d=slug`). Recorded for the audit trail; no change requested.
3. **`src/lib/event-tagging/builders.js:84`** — If a caller passes both `target.id` and `target.address`, `id` silently wins. Acceptable; optionally document the precedence in the JSDoc.
4. **`buildTaggingHeader` `names`** — expects an array; a string would spread into characters. Low risk (callers are Stories 4/5), but a one-line type guard or JSDoc `@param {string[]} names` would harden the reference module.

## What's right (so the kickback is scoped)
Everything else conforms: exact wire shapes + tag ordering (ADR-faithful, tested), the three discovery filters, determinism (no wall-clock, no `pubkey`/`created_at`), zero coupling, and a spec that faithfully preserves David's indirect per-tag-header structure while gaining the metadata header, normative polarity/d-tag, read-time/POV "candidates" framing, firmware-seeding note, relationship section, and corrected queries. The kickback is **one guard + one test**.

## Re-review (2026-06-26)

Blocking #1 addressed:
- `src/lib/event-tagging/builders.js:58` — `buildTaggingHeader` now `requireHex64(tagAuthorPubkey, …)`.
- `src/lib/event-tagging/builders.js:86` — `buildEventTaggingAssertion` now `requireHex64(headerAuthorPubkey, …)` alongside the existing `asserterPubkey` guard. `taPubkey` left unguarded by design (runtime-config sourced, non-fatal), documented in-comment.
- `test/event-tagging-core.test.js` — new test `builders reject malformed handle-composing author pubkeys` exercises `''`, `undefined`, `npub1…`, uppercase, and truncated values against both builders.

Re-run independently: **event-tagging-core 13/13**, **event-tagging-spec 5/5**. Purity guard still green (new comments introduce no banned substrings). Non-blocking items (tags.md `(planned)`, JSDoc nits) remain optional and untaken.

## Verdict
**PASS** — Blocking #1 resolved; the single ask (symmetric author-pubkey validation + test) is in. Originally CHANGES_REQUESTED (see above); now PASS.
