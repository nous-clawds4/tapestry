# Review: live-feed — resolve mention names (show `@name` instead of `@npub` in note content)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-18
**Diff:** `git diff origin/staging...HEAD` (commit `54c5e4ae`, branch `feat/feed-mention-names`)
**Mode:** Conversational (non-harness) change — no formal story / ADR / test-plan. Gates skipped per
instruction; diff audited directly for correctness, security, architecture-fit, and edge cases. This is the
natural follow-on to review #4 (feed-nostr-entities), which deferred display-name resolution to the read path.

## What it does
Feed profile mentions (`nostr:npub…` / `nostr:nprofile…`) now render the mentioned person's display name
(`@alice`) instead of a raw `@npub1…`. Resolution is server-side in the read path: `enrichAuthors` extracts each
note's mentioned pubkeys (new `extractMentionPubkeys` + lazy `loadNip19`), resolves their display names from the
SAME local kind-0 strfry scan it already does for authors (one scan covers authors + mentions), and attaches a
per-item `mentions` map `{ pubkey: displayName }` containing only locally-resolvable names. Client `NoteContent`
renders `@<name>` when present, else falls back to the truncated npub the parser already produced; the exact npub
stays on hover (`title`). `BrainstormFeed` passes `item.mentions`.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **live-feed-read-path: PASS (27/27)**, **live-feed-feed-page: PASS (27/27)** (the two
      suites this diff touches). Full suite reports `Overall: FAIL`, but I confirmed every failing suite is a
      **pre-existing backend-integration failure unrelated to this diff.** Method: ran the full suite on a clean
      `origin/staging` worktree (with this repo's `node_modules` symlinked in) — it produced the *identical* set
      of failing suites (concept-graph, profile-tags, tag-detail-publish, profile-tag-polish, pin-a-tag,
      tl-publication-from-pins, customize-pin-curation-publish, most-pinned-tag-index-publish — all "fetch
      failed" / "preconditions not met" against an unseeded local Meili/strfry/firmware stack). **None of those
      test files references any of the five changed files** (grep-verified: `feedReadPath` / `NoteContent` /
      `BrainstormFeed` appear in none of them). Not a blocker for this change.
- [x] `npm run test:playwright` — not run. The change is browser-rendering, but the renderer is a thin
      `<Link>`-label swap with no logic worth a Playwright run; it's covered by the unit suite (T25 asserts the
      page wiring + the `@${name}` lookup) plus the Implementer's reported browser verification (resolved →
      `@Alice Resolved`, unresolved → `@npub1…`, npub on hover, no console errors).
- [x] _Build_ — I ran `npx vite build` in `ui/` myself: **green** (`✓ built in 1m 51s`, no errors). The
      pre-existing chunk-size warnings are unrelated.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._

## Architecture invariants (the scrutiny target)

1. **POV-first — RESPECTED.** Display names come from each profile's own self-asserted kind-0 (`display_name ||
   name`). A kind-0 display name is not a POV-dependent judgement (trust, rank, "does this count") — it's the
   subject's own claim about itself, identical under every POV. So there is no per-POV truth being collapsed:
   resolving it globally is correct, and it mirrors the *existing* author enrichment (lines 240–244) byte for
   byte — same scan, same `display_name || name || null` derivation, same Map. No `wot_*` column, no per-POV
   namespacing is warranted or smuggled in.
2. **Decentralized-first — RESPECTED.** No write-time gating; the read path accepts any signed kind-0/kind-1.
   A mention whose kind-0 we don't hold locally is simply *omitted* from the map (M2 pins this), and the UI
   falls back to the npub — exactly the decentralized-first degradation. Nothing requires a "known" or
   "approved" author.
3. **Filter-at-view-time — RESPECTED.** Names are resolved on read from raw kind-0 events, not precomputed or
   denormalized into a stored column. Nothing is cached per (POV × target).
4. **No hardcoded TA pubkey** — grep-clean on the changed file (no 64-hex literal, no `82b75e47…`). The TA-pubkey
   ADR-0015 / runtime-helper rules are not engaged by this diff.

## Security & robustness audit

1. **`loadNip19` fallback (container + host/CI) — SOUND.** Tries the container absolute path first, then bare
   `require('nostr-tools')`, then `null`. Both `require`s are individually try/caught, so a missing path can't
   throw out of the function. The null-cache is correct: `_nip19` starts `undefined`; the guard is
   `if (_nip19 !== undefined) return _nip19;`, so once it's set to `null` (both requires failed) it returns the
   cached `null` and never retries — and `extractMentionPubkeys` no-ops (`if (!nip19) return []`). In test/CI the
   bare require resolves (the suite itself does `require('nostr-tools')`), so resolution is live there. Degrades,
   never throws.
2. **`extractMentionPubkeys` regex — SOUND & linear.** `/nostr:((?:npub|nprofile)1[02-9ac-hj-np-z]+)/g` matches
   only npub/nprofile — `nsec`/`note`/`nevent`/`naddr` are excluded by construction (M4 pins nsec). Single
   linear char-class, one `+`, no nested quantifier / overlapping alternation → no ReDoS. I stress-tested it:
   a 2M-char adversarial token matched in ~3ms; 50k separate tokens in ~6ms.
3. **Decode safety — guarded.** `nip19.decode` is wrapped in try/catch (undecodable → skip). `npub` →
   `dec.data` (hex string, guarded `dec.data`); `nprofile` → `dec.data.pubkey` (guarded `dec.data &&
   dec.data.pubkey`). No path pushes `undefined` into the lookup set.
4. **Server/client pubkey agreement — VERIFIED at runtime.** The server derives the pubkey for npub from
   `dec.data` and for nprofile from `dec.data.pubkey`; the client parser (`nostrEntities.js:42–45`) derives
   `seg.pubkey` the same way. I confirmed both yield the identical 64-char hex for the same token, so the
   client's `mentions[seg.pubkey]` lookup matches the server's map key. They also share the *same* greedy-match
   behavior, so when a glued/over-matched token fails decode, **both** sides drop it and fall back to the npub in
   lockstep — no divergence where one side shows a name and the other a broken key.
5. **Scan-filter growth (the one real edge to weigh) — ACCEPTABLE, degrades gracefully.** `enrichAuthors` now
   feeds `[...authors, ...mentions]` (deduped) into the single `strfry scan '<json>'` arg. The feed is capped at
   50 notes, but a kind-1 note's content is large (relays commonly allow 16–128 KB), and a hostile followed
   author could stuff a note with thousands of *unique* npubs (~69 B each) that won't dedup. At ~67 B/author in
   the JSON filter, a pathological 50-note feed could push the single shell argument past Linux's per-arg
   `MAX_ARG_STRLEN` (128 KB) and `execSync` would throw `E2BIG`. **But the scan is wrapped in `try { … } catch {
   events = []; }` (lines 231–233), so the worst case is "no names resolve" (authors fall back to null, mentions
   fall back to npub) — the feed never crashes.** This is acceptable: the failure is bounded, graceful, and only
   reachable via deliberately abusive content. See NICE-TO-HAVE #1 for an optional cap.
6. **Client XSS — SAFE.** `label = name ? `@${name}` : seg.label` is rendered as React text children
   (auto-escaped), never `dangerouslySetInnerHTML`. `to`/`title` are unchanged from the prior (already-audited)
   safe values.

## Correctness — map construction & contract

- **Per-note isolation — correct.** `mentionsByNote` is built `notes.map(...)` and consumed in the final
   `notes.map((n, i) => …)` at the same index `i`; the arrays are co-indexed, so note *i*'s mentions come only
   from note *i*'s content.
- **No author/mention cross-contamination.** The `profiles` Map is keyed purely by `ev.pubkey`; a pubkey that is
   both an author (of one note) and a mention (in another) resolves to one shared profile — correct, not a bug.
- **Newest-kind-0-wins still holds.** The dedupe `if (prev && prev.created_at >= ev.created_at) continue;` is
   unchanged and keyed by pubkey, so merging authors + mentions into one scan doesn't perturb it.
- **Only resolved names included.** `if (mp && mp.displayName) mentions[pk] = …` omits unknown profiles *and*
   profiles with falsy display names (empty `display_name` falls through `display_name || name || null` to
   `null`), so the UI npub fallback fires consistently with author handling. M2 pins omission; M3 pins the
   empty-`{}` shape.
- **Read-path contract — additive, intact.** `mentions` is added only to items in the OK/EMPTY `items` array;
   `NO_SOURCE` / `FOLLOW_LIST_UNAVAILABLE` carry no items, so the four-status union is unchanged. The module
   header doc (lines 13–16) is updated to the new item shape and is accurate.
- **Client undefined-safety.** `NoteContent` guards `mentions && seg.pubkey`, so an absent `item.mentions`
   (e.g., a stale response) falls back to `seg.label` without throwing — belt-and-suspenders over the read
   path's always-`{}` guarantee.

## Concept-graph / house rules
- [x] No concept definitions touched → no firmware reinstall needed.
- [x] No handles constructed; no `kind:pubkey:slug` strings introduced.
- [x] No new lint/typecheck/build tooling; no new runtime dependency (reuses `nostr-tools`, already present).
- [x] Concept Graph API authority not engaged (display-name resolution is plain kind-0, not a concept).

## Things tests can't catch
- [x] No secrets / no hardcoded TA pubkey in the diff (grep-clean).
- [x] No `console.log` / `debugger` / `TODO` / `FIXME` introduced (grep-clean).
- [x] No commented-out code.
- [x] Error/edge paths handled (nip19 unavailable, undecodable ref, missing kind-0, empty content, scan throw).
- [x] No concurrency concern: `enrichAuthors` is sequential; the module-level `_nip19` cache is set
      idempotently and is safe under Node's single-threaded model. The regex is a fresh `/g` literal created
      per call inside `extractMentionPubkeys`, so there is no shared-`lastIndex` reuse bug.

## Findings

### BLOCKER
_None._

### SHOULD-FIX
_None._

### NICE-TO-HAVE
1. **`src/api/feed/feedReadPath.js:224` — no cap on the mention pubkey set fed to the strfry scan.** A
   deliberately abusive note (thousands of unique npubs) could push the single `execSync` filter argument past
   Linux's 128 KB `MAX_ARG_STRLEN`, throwing `E2BIG`. It degrades safely (the `try/catch` zeroes the scan, so
   names just don't resolve), so this is not blocking — but a small belt: cap total looked-up pubkeys (e.g.,
   slice the deduped `lookup` to a few hundred, or cap mentions-per-note before flattening). Optional hardening.
2. **`src/api/feed/feedReadPath.js:201` — the mention regex inherits the same greedy over-match as the client
   parser** (review #4 NICE-TO-HAVE #1): an entity glued to following bech32-charset letters over-matches and
   fails decode, dropping the mention. This is *consistent* with the client (both drop in lockstep → npub
   fallback on both sides), so it's not a defect introduced here — noting only so the two parsers are fixed
   together if the client one ever is.

### NIT
_None new._ (The inaccurate `1/b/i/o` doc-comment justification flagged in review #4 was **not** carried into
this change's comments — the new `extractMentionPubkeys` comment is accurate.)

## Verdict
**PASS**

Architecture invariants are respected — display-name resolution from self-asserted kind-0 is genuinely not
POV-scoped and mirrors the existing author enrichment exactly (same scan, same derivation); decentralized-first
degradation (omit unknown → npub fallback) and filter-at-view-time are both honored; no hardcoded TA pubkey, no
write-time gating. Security is sound: nip19 load degrades-not-throws with a correct null-cache, the regex is
linear and npub/nprofile-only, decode is guarded, server/client pubkeys agree at runtime, and the client label
is React-escaped. The two relevant suites pass 27/27; the `Overall: FAIL` is pre-existing backend-integration
failure (reproduced identically on `origin/staging`) in suites this diff does not touch. The one real edge —
unbounded scan-filter growth from abusive content — fails closed via the existing `try/catch`, so it's a
non-blocking hardening suggestion, not a gate.
