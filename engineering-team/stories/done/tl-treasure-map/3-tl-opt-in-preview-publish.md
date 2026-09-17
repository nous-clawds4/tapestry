# Story 3: TL opt-in, preview, and publish

**Status:** Done
**Created:** 2026-08-27
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A approved 2026-08-27 in the
book's kickoff exchange; scoped gate (the new suite + the three guard suites named at Gate A):
`node -e "Promise.all(['./test/tl-treasure-map-optin-publish.test.js','./test/global-publish-gate.test.js','./test/strfry-write-assertion-bracket.test.js','./test/treasure-maps-router-preset.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"`)*

## Background
Stories 1–2 ratified the Treasure-Map TL-advertisement convention (ADR `tl-treasure-map/0001`)
and made the Map's entries legible. What remains is the book's point: a Brainstorm customer whose
Map today delegates only Trusted Assertions can opt in to have **this instance's Tapestry
Assistant publish their pubkey Trusted Lists** — one `["30392", <local TA>, <relay>]` entry,
everything else preserved, previewable before signing.

## User-facing description
As a signed-in Brainstorm customer whose Treasure Map was found, I want the page to tell me
whether my pubkey Trusted Lists are delegated and to whom, and — when they aren't delegated to
this instance's Assistant — to offer, preview, sign, and publish the updated Map, so that my TLs
start being published on my behalf without disturbing anything else in my Map.

## Acceptance criteria
- [x] AC-1: Given a found Map, a status card states one of three things: pubkey-TL support
      **absent**, **external** (generic `30392` entry pointing at a non-local pubkey, shown), or
      **local** (pointing at this instance's TA). No judgment renders while `taPubkey` is
      unresolved. The generic entry is found by ADR §4's first-occurrence rule; only an entry
      with a valid delegate counts (story 2's demotion rule); named `30392:<name>` entries are
      inert for this check.
- [x] AC-2: In the **absent** and **external** states the card asks, verbatim: "Would you like
      the local Tapestry instance to publish your Trusted Lists for pubkeys on your behalf? If
      so, you will need to update your Treasure Map so external clients can find your Trusted
      Lists." with a Publish affordance. In the **local** state there is no prompt and no
      publish affordance. *(Copy amended at the operator's pre-close cosmetic pass, 2026-08-27 —
      originally "…publish your pubkey Trusted Lists on your behalf?")*
- [x] AC-3: Whenever the Publish affordance is visible, a preview of the exact updated
      **unsigned** kind-10040 is available: every other tag preserved verbatim in order, the
      first generic `30392` entry replaced in place (later generic duplicates dropped — the
      writer normalizes to at most one, ADR §3) or the new entry appended when none exists;
      relay hint from `aRelays.aTrustedListRelays[0]` (empty string when unconfigured);
      `content` preserved; fresh `created_at`.
- [x] AC-4: Confirming publishes: NIP-07 signature as the signed-in user (drift-guarded via
      `getActiveSignerOrThrow`), then `publishOrThrow` → local strfry + the external publish
      relays, inheriting the deployment's local-only publish gate (`skippedByGate`) unchanged.
      On success the page re-runs its search and the card lands in the **local** state.
- [x] AC-5: Failures surface in the card (signer declined / drifted extension / every relay
      failed) without corrupting page state; the Map on screen stays the found event until a
      publish succeeds.
- [x] AC-6: Story 2's Map Entries panel, the no-Map-found path, and the raw-event toggle are
      unchanged.

## Design note *(Light profile — provisional here, ratified at Gate B)*
- **Chosen approach:** extend `ui/src/utils/treasureMap.js` with two pure functions —
  `findGenericTlDelegation(tags, kind=30392)` (first-occurrence generic entry with a valid
  delegate, else null) and `upsertGenericTlTag(event, kind, pubkey, relay)` (returns the updated
  unsigned event: first generic entry replaced in place, later generic duplicates dropped, all
  other tags copied verbatim in order, `created_at: max(now, old+1)` so a skewed-clock old Map
  can never outrank the replacement). New `ui/src/pages/grapevine/TlOptInCard.jsx` renders the
  three-state card, the verbatim prompt, a collapsible JSON preview of the upsert result
  (recomputed per render), and the publish flow: `getActiveSignerOrThrow()` →
  `window.nostr.signEvent(unsigned)` → `publishOrThrow(signed)` (reused from
  `utils/publishProfileTag.js` — carries the both-fail-throws contract and, via
  `publishEverywhere`, the local-only gate). `TrustedAssertions.jsx` mounts the card between the
  local-strfry status block and Map Entries, passing the found event and `onPublished={search}`.
- **Rejected alternative:** compose/sign/publish server-side (a new API endpoint) — rejected:
  the Map is the **user's** event and must be signed by their NIP-07 extension in the browser;
  the server never holds their key, and every existing user-signed surface (profile tags, pins)
  composes client-side through the same guard/publish utils.
- **Blast radius:** `ui/src/utils/treasureMap.js` (additive), new `TlOptInCard.jsx`,
  `ui/src/pages/grapevine/TrustedAssertions.jsx` (mount + one prop). Consumers of
  `classifyEntry` (story 2's panel) untouched — new exports only. `publishOrThrow`,
  `signerGuard`, `nostrPublish` are consumed, not modified.
- **Wire fidelity:** the emitted entry is exactly ADR §1's shape; replace-not-append and
  duplicate-normalization are ADR §3's writer semantics; this story adds no wire decisions.

## Edge cases & not-covered
- **E1 (not derivable from any AC):** the found Map's `created_at` may lie in the future (skewed
  publisher clock) — a replacement stamped with plain `now` would be **silently ignored by every
  relay** (replaceable events keep the newest). `upsertGenericTlTag` stamps
  `max(now, old.created_at + 1)`.
- E2: wild duplicates — two generic `30392` entries → the writer emits exactly one, at the first
  entry's position.
- E3: a named `30392:<name>` entry with no generic entry → status **absent** (named entries are
  inert, ADR reservation).
- E4: a bare `30392` entry with a malformed delegate → status **absent** (story 2's demotion
  rule; this pins the review's carried-forward finding).
- E5: `aTrustedListRelays` unconfigured → the entry ships with an empty-string hint, shape
  preserved (ADR §5); the preview shows it honestly.
- E6: extension account drifted from the session → `getActiveSignerOrThrow` refuses before
  signing (signerGuard's own tested behavior; consumed, not re-tested).
- E7: external relays all fail but local strfry accepts → success (`publishOrThrow` contract —
  the strfry router redistributes; R-sentinel pins the contract's source).
- **Not covered:** NIP-07 extension UI interactions (extension-owned); live relay sockets
  (SimplePool behavior is `nostrPublish`'s lane, gate-guarded by `global-publish-gate`);
  logged-in browser flow (B-class, operator at Gate B — same boundary as story 2).

## AC→handle lines
- AC-1 → U6, U7, S1, R5, S5
- AC-2 → S1, U6
- AC-3 → U1, U2, U3, U5, S2
- AC-4 → S1, S3, R3, R4
- AC-5 → S1, S6
- AC-6 → R1, R2
- E1 → U4 · E2 → U3 · E3 → U6 · E4 → U6 · E5 → U5 · E7 → R4

U* = behavioral tests of `findGenericTlDelegation` / `upsertGenericTlTag` via dynamic
`import()`. S* = source-structure assertions on the card and page wiring. R* = regression
sentinels (story-2 panel, no-Map path, `skippedByGate` gate hook, `publishOrThrow` both-fail
contract) — pass before and after.

## Linked artifacts
- ADR: `engineering-team/decisions/tl-treasure-map/0001-treasure-map-tl-advertisement-convention.md`
  (consumed, not authored here)
- Test suite: `test/tl-treasure-map-optin-publish.test.js` (+ guard suites named in the scoped
  gate above)
- Review: `engineering-team/reviews/tl-treasure-map/3-tl-opt-in-preview-publish.md`

Link by path only — never record verdicts or round history in this file.
