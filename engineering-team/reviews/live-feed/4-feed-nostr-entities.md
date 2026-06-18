# Review: live-feed — linkify NIP-21 `nostr:` entities in note content

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-18
**Diff:** `git diff origin/staging...HEAD` (commit `582d3770`, branch `feat/feed-nostr-entities`)
**Mode:** Conversational (non-harness) UI change — no formal story / ADR / test-plan. Story/ADR/test-plan
gates skipped per instruction; diff audited directly for correctness, security, consistency, edge cases.

## What it does
Parses NIP-21 `nostr:` URIs out of kind-1 note content on the public `/feed` and renders them as in-app
links. New pure parser `ui/src/utils/nostrEntities.js` (`parseNostrContent`), new renderer
`ui/src/components/NoteContent.jsx`, wired into `BrainstormFeed.jsx` (replacing `{item.content}`), `/event`
page extended to accept `?naddr=`, CSS for the link classes, tests T20–T24.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **live-feed-feed-page suite: PASS (26/26)**, live-feed-read-path: PASS (23/23).
      Full suite reports `Overall: FAIL`, but **every failing suite is a pre-existing backend-integration
      failure unrelated to this diff** (`fetch failed` against an unseeded local concept-graph / Meili /
      strfry stack): concept-graph, profile-tags, tag-detail, tag-index, profile-tag-polish, pin-a-tag,
      tl-publication-from-pins, customize-pin-curation, most-pinned-tag-index. **None of those test files
      is touched by this diff** — the only test file changed is `test/live-feed-feed-page.test.js`, which
      passes. The failures would reproduce identically on `origin/staging`. Not a blocker for this change.
- [x] `npm run test:playwright` — not run; change is browser-rendering but covered by the unit suite which
      executes the real ESM parser, plus the Implementer's browser verification. The renderer is a thin
      `<Link>` map with no logic worth a Playwright run.
- [x] _Build_ — Implementer reported `vite build` green; diff is additive ESM + CSS with no config changes.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._

## Security audit (user-controlled content)

1. **XSS / href injection — SAFE.** hrefs are always internal paths. Profile → `/user/<hex>` where `<hex>`
   is the decoded 32-byte pubkey (`[0-9a-f]` only). Event → `/event?id=<hex>` (decoded hex) or
   `/event?nevent=<bech32>` / `/event?naddr=<bech32>` where `<bech32>` is constrained to the data char-class
   `[02-9ac-hj-np-z]`. I verified that char-class contains **none** of `: / ? # < > & " ' space % @ . \`, so
   the dynamic portion cannot introduce a scheme (`javascript:` impossible — `:` is excluded and the prefix
   is the literal `nostr:`), break out of the path/query, or inject markup. Links are react-router `<Link to=>`
   (client-side nav only, never an external scheme), labels render as React-escaped text children. No vector.
2. **nsec / private-key exposure — SAFE, two-layer defense.** `ENTITY_RE` only matches the
   `npub|nprofile|note|nevent|naddr` prefixes, so `nsec` never matches in the first place; and even if it
   reached `entityToSegment`, the `switch` `default` returns `null` → plain text. Verified at runtime:
   `nostr:nsec1…` renders as `text`, preserved verbatim, never a link. T22 pins this.
3. **ReDoS — SAFE, linear.** `ENTITY_RE` is a single linear char-class with one `+` quantifier, no nesting,
   no alternation overlap that backtracks. A 200k-char pathological input matched in ~1ms.
4. **Decode safety — guarded on every branch.** `nip19.decode` is wrapped in try/catch (returns `null` on
   throw). Decode-shape branches confirmed against nostr-tools: `npub`/`note` → hex string in `data` (used
   directly); `nprofile` → `data.pubkey` (guarded `data?.pubkey`); `nevent` → `data.id` (guarded `data?.id`);
   `naddr` → object (href built from the original `bech32`, not the object). No path produces
   `/user/undefined` — every nullable field is guarded and falls back to plain text.
5. **Parser correctness — verified.** Probed null / undefined / number / object / `''` → all return `[]`
   (the `typeof !== 'string'` guard). Entity at start, at end, many (50) entities, repeated calls (shared
   `/g` regex is reset via `ENTITY_RE.lastIndex = 0` before the loop — the classic stale-lastIndex bug is
   guarded), `nostr:` with no valid entity, bad prefix, undecodable/bad-checksum → all fall back to plain
   text correctly. Common punctuation/whitespace terminators (`' ) . ! ? : , \n` and apostrophe-s) all
   correctly bound the match. No off-by-one in the slice/lastIndex loop.
6. **Architecture invariants — all respected.** Pure client-side parse/render. The feed read-path module
   (`src/api/feed/feedReadPath.js`) is **not** touched — the ADR's "no enrichment" stance holds and
   display-name resolution stays deferred (correctly noted as a read-path follow-up). No POV logic, no
   write-time gating, no hardcoded TA pubkey (grep clean). POV-first / decentralized-first /
   filter-at-view-time are not engaged by a display-only renderer.
7. **Consistency — matches existing patterns.** `nip19.decode` in try/catch mirrors `BrainstormSearch.jsx`.
   `<Link>` SPA nav matches the feed's author links. New CSS classes don't collide. `BrainstormEvent` is a
   placeholder that only echoes the identifier, so the `?id=`/`?nevent=`/`?naddr=` triplet is handled.

## Things tests can't catch
- [x] No secrets / no hardcoded TA pubkey in the diff (grep clean).
- [x] No `console.log` / debug / `TODO` / `debugger` / `alert(` in the diff.
- [x] No commented-out code.
- [x] Error/edge paths handled (decode throw, null shapes, empty input — all fall back to plain text).
- [x] No concurrency concern (synchronous pure function; shared regex `lastIndex` reset guarded).

## Findings

### BLOCKER
_None._

### SHOULD-FIX
_None._

### NICE-TO-HAVE
1. **`ui/src/utils/nostrEntities.js:26` — greedy match swallows a trailing word char / adjacent entity.**
   The data class `[02-9ac-hj-np-z]+` *is* the bech32 alphabet, which overlaps ordinary letters, so when an
   entity is immediately followed by alphanumerics with no boundary, the trailing chars get absorbed into the
   match, break the checksum, and the **whole** thing falls back to plain text (mention lost). Verified:
   `nostr:npub1…hello` → not linkified; two directly-concatenated `nostr:npub1…nostr:note1…` (no separator)
   → **both** lost. Real-world impact is low — notes almost always separate `nostr:` URIs with whitespace or
   punctuation (all common terminators `' ) . ! ? : , \n` and `'s` work correctly). Optional hardening if
   you want to be bulletproof: anchor the end with a lookahead such that the match stops at a non-bech32
   boundary, or special-case a following `nostr:`. Not blocking.

### NIT
1. **`ui/src/utils/nostrEntities.js:25` — the doc comment's justification is inaccurate.** It says excluding
   `1/b/i/o` from the class prevents "a trailing word character getting swallowed into the match." That's not
   what excluding those four chars does (it's the bech32 charset, required for *correct decoding*); it does
   **not** prevent trailing-word absorption — see NICE-TO-HAVE #1, where a trailing word *is* swallowed.
   Reword to "restricted to the bech32 charset so the decode is correct" and drop the swallowing claim.
2. **`ui/src/components/NoteContent.jsx:19` — `key={i}` (array index as React key).** Acceptable here: the
   segment list is rebuilt wholesale on each render and never reordered/spliced, so the index is stable. No
   action needed; noting for completeness.

## Verdict
**PASS**

All security-sensitive concerns (XSS/href injection, nsec exposure, ReDoS, decode safety) are sound and
verified at runtime. The relevant test suite passes 26/26; the `Overall: FAIL` is pre-existing
backend-integration failure in suites this diff does not touch. Architecture invariants are respected
(pure client-side, no read-path enrichment, no POV/TA coupling). The two greedy-match edge cases are rare
in practice and non-blocking; the inaccurate doc comment (NIT #1) is worth a one-line fix on the next pass
but does not gate merge.
