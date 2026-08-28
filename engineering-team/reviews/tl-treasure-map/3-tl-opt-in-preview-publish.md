# Review: Story 3 — TL opt-in, preview, and publish

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-27
**Diff:** `git diff 00436e1f...HEAD` (story+tests `4bfa18e6` → impl `c9e39d08`), branch
`feat/tl-treasure-map-optin` (off staging after PRs #568/#569)

## Quality gates (run by reviewer, not trusted)

- [x] Scoped gate (story's Type-block command: new suite + 3 guard suites, brace-redirect,
      foreground) — **TOTAL_FAIL=0, EXIT=0** (17 + 8 + 6[2 H-class env skips, pre-existing] + 5).
      The J3 judge independently reproduced the identical result.
- [x] `cd ui && npm run build` (vite) — **EXIT=0**.
- [x] Browser (localhost:7778, rebuilt bundle): route loads, **zero console errors**; logged-out
      prompt renders. Logged-in flow is Gate B's (NIP-07 challenge; same boundary as story 2).
- [x] `bash scripts/harness-lint.sh` — clean at review commit.
- [ ] Full `npm test` — deferred to book close per workflows/light-profile.md (imminent — this
      is the book's last story; the close runs the full registry).

## Spec adherence

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 three-state card, first-occurrence, demotion-aware, named-inert, loading-guarded | ✅ | U6/U7 (behavioral); S5 (guard); S1 (helpers wired); card computes `status` from `findGenericTlDelegation` |
| AC-2 verbatim prompt + Publish only in absent/external; nothing in local | ✅ | S1 (exact sentence); the `local` branch returns the green card only — no prompt, no buttons |
| AC-3 preview = exact updated unsigned event (verbatim tags, replace-in-place, dedup, relay hint, content, fresh created_at) | ✅ | U1/U2/U3/U5 (behavioral, deep-equality); S2; preview memo renders `upsertGenericTlTag` output; publish recomposes fresh so `created_at` stamps at publish time |
| AC-4 drift-guarded NIP-07 sign → publishOrThrow → gate inherited → re-search | ✅ | S1 (chain imports), S3 (`onPublished={search}`), R3 (`skippedByGate` hook intact), R4 (both-fail contract intact) |
| AC-5 failures surfaced, no state corruption | ✅ | S6 (catch + error render); handler sets error, leaves `event` untouched; button disabled while publishing |
| AC-6 panel / no-Map path / raw toggle unchanged | ✅ | R1/R2 green; diff adds 4 lines to the page, deletes none |

- [x] No criterion silently dropped; no behavior beyond the story.

## ADR adherence
- [x] Emitted entry is exactly ADR §1's shape (U1/U2 assert `['30392', <pk>, <relay>]` by deep
      equality); replace-not-append and at-most-one normalization are §3 (U2/U3); the salient
      check applies §4's first-occurrence rule (U7); relay hint source and empty-string fallback
      are §5 (U5, `aRelays.aTrustedListRelays[0]`). No wire decisions added — the skew-proof
      `created_at` sits inside §3's "fresh created_at" (J1 concurred).
- [x] Consumed-not-modified holds: `publishOrThrow`, `signerGuard`, `nostrPublish` absent from
      the diff (J3 verified).

## Concept-graph integrity
- [x] No concept definitions changed; no firmware reinstall; no new handles.

## Things tests can't catch
- [x] Rules of hooks: every hook (`useConfig`, 3× `useState`, 2× `useMemo`) precedes the early
      `return null` — no conditional-hook hazard.
- [x] Replaceable-event identity: the unsigned event carries `pubkey: authorPk` (the
      drift-guarded session signer), and the found Map is searched `authors:[user.pubkey]`, so
      the replacement targets the user's own `(kind, pubkey)` slot — never someone else's.
- [x] Injection: delegate pubkey is validated hex before slicing; preview JSON and error
      messages render as React text nodes.
- [x] Post-publish refresh: `search()` hits local strfry first; the event just landed there via
      `publishToLocalStrfry`, so the card flips to **local** without relay-propagation delay.

## House rules check
- [x] TA pubkey runtime-resolved; relay hint runtime-resolved; R5 enforces no literals.
- [x] No new tooling; no new dependencies.

## Gate-A classification (ratified)
**Design note, no ADR — correct.** Strictly an implementation of ADR 0001's ratified semantics;
J1 walked every trigger against this story and none fire. Ratified per light-profile.md Gate B.

## Findings

### Blocking
None.

### Non-blocking
1. **TlOptInCard.jsx (publish flow)** — the inverse partial failure (local strfry rejects,
   external relays accept) satisfies `publishOrThrow`, but `search()` then re-finds the *old*
   local event and the card re-prompts despite a successful external publish. Rare (requires
   local strfry down under a serving app); self-heals when the router/negentropy pulls the event
   back. A `result.local.success === false` notice would close the gap — deferred, candidate for
   the book's audit §6.
2. **TlOptInCard.jsx (mount contract)** — the card assumes `event` is the session user's own Map
   (true at its only mount site, where search filters `authors:[user.pubkey]`). A future caller
   passing someone else's Map would compose the *user's* replacement from *foreign* tags. The
   `pubkey: authorPk` stamp keeps the signature honest; noted for any future reuse.

### Harness friction
1. None new this story (row 181 already covers the scoped-gate syntax; nothing else misled).

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection: with story 3 done, **every acceptance-frame bullet is met** pending
      (a) the operator's Gate-B visual ratification and (b) staging verification after this
      story's PR — production promotion stays outside the frame. The book looks complete;
      `/close-book` is to be **offered** at Gate B, never auto-run.
