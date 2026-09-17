# Review: Story 1 — Treasure-Map TL-advertisement convention

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-27
**Diff:** `git diff 106c5de0...HEAD` (commits `93db858f` ADR, `1b07ea99` spec section; docs-mode —
numbered form because the story is storied, claims-adherence table per the review template's
docs-mode variant)

## Quality gates (run by reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh` — **clean (0 violations)**; only pre-existing waivers.
- [x] Links resolve: `protocols/README.md` row → `drafts/trusted-lists.md` (exists);
      spec section → ADR `tl-treasure-map/0001` (exists, **Accepted**); story ↔ ADR ↔ review
      paths mutually consistent.
- [x] Cross-references accurate: section slots between "Completeness & the partial signal" and
      "Current members of the family"; kinds cited (`30392`–`30395`) match the draft's own kind
      table; example relay matches `defaults.json` `aTrustedListRelays[0]`.
- [x] `npm test` — not run: no code or test surface in this diff (docs-mode); the changed files
      are two markdown docs + harness artifacts. Scoped gate for this story per Gate A is the
      docs-mode review itself.

## Claims-adherence table *(docs-mode variant — one row per substantive claim)*

| # | Claim (spec section / ADR) | Evidence |
|---|---|---|
| 1 | 10040 entries today are shaped `["30382:rank", <pubkey>, <relay>]` | Upstream NIP-85; both in-repo readers assume it: `ui/src/pages/grapevine/SearchPreferences.jsx` `parseMetrics` (`startsWith('30382:')`), `src/utils/customerManager.js` `extractRelayPubkeyFromKind10040` (exact `"30382:rank"`) |
| 2 | TL family is `30392`–`30395`, `+10` of NIP-85's `3038x` | The draft's own "Kinds" table (unchanged above the new section) |
| 3 | Bare-kind first element is mechanically distinguishable from existing entries | Parse rule (split on `:`, all-digits single segment); no existing 10040 producer or reader in-repo emits/expects a bare kind — grep `10040` over `src/` + `ui/src/` returns the two readers in row 1 only |
| 4 | New entry breaks no existing reader | Both row-1 readers filter before parsing; a bare `"30392"` matches neither predicate (verified in source this session) |
| 5 | `10040` is replaceable ⇒ full tag set + fresh `created_at` on update | NIP-01 replaceable range (10000 ≤ kind < 20000); the page's own search takes the newest event (`TrustedAssertions.jsx` sorts by `created_at`) |
| 6 | Relay hint source `settings.aRelays.aTrustedListRelays[0]` exists, default `wss://nip85.brainstorm.world` | `src/config/defaults.json` (`aTrustedListRelays: ["wss://nip85.brainstorm.world", "wss://dcosl.brainstorm.world"]`) |
| 7 | Runtime-resolved via `/api/relays` | `src/api/relays/index.js` `handleGetRelays` (public, serves `settings.aRelays`); `ui/src/context/ConfigContext.jsx` fetches it into `aRelays` |
| 8 | Replace-not-append and local+external publish were operator decisions | Gate A exchange, 2026-08-27 (recorded in book.md acceptance frame) |
| 9 | README row still marks the draft 📝 pre-NIP, working copy here | Row edited for scope phrase only; status and source-of-truth cells untouched |

## ADR adherence
- [x] Files changed match ADR implementation notes exactly: the two named files, section placed
      at the named location, Decision §§1–5 carried into spec voice, worked example + reservation
      note present.
- [x] No new dependencies; no code touched.

## Concept-graph integrity
- [x] No concept definitions changed; no firmware reinstall required (ADR states it; diff
      confirms — no `firmware/` or concept files in the diff).

## Things tests can't catch
- [x] No secrets, no debug output, no commented-out matter in the diff.
- [x] Adversarial probe — premise: could the *generic-entry* rule collide with a future upstream
      NIP-85 metric literally named as digits (e.g. `"30382:30392"`)? No: the rule keys on the
      *first* element being a single all-digits segment; kind:metric entries always carry two
      segments. Probe: does declaring the family (`30392`–`30395`) overcommit kinds `30393`–`30395`
      that have no advertisement consumer? No behavior is promised for them — the section states
      Tapestry "currently exercises" only `30392`; acceptable.
- [x] Collateral damage outside the diff: none — grep-verified reader set (rows 1/3/4).

## House rules check
- [x] TA pubkey nowhere hardcoded; the section prescribes runtime resolution (matches CLAUDE.md).
- [x] No new tooling.

## Findings

### Blocking
None.

### Non-blocking
1. **protocols/drafts/trusted-lists.md (new section)** — the section does not state what a
   *writer* should do when `aTrustedListRelays` later gains a better first entry (stale hints in
   published Maps). Acceptable: Maps are user-owned and replaceable; re-publish is the remedy.
   Noted for the named-entry future ADR.

### Harness friction
1. None this story. *(The session-start digest's "stack absent" false-negative predates the book
   and is already queued for an OPEN.md `meta` row at session end.)*

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection: book `tl-treasure-map` — frame bullet 5 (convention ratified) now
      met; bullets 1–4 and 6 open (stories 2–3). Book not complete; recorded in chat.
