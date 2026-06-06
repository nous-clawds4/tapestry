# Review: Story 45 (UI) — People-tab live roster + Trust Signal

**Reviewer:** independent agent (separate context, adversarial; React-correctness focus).
**Date:** 2026-06-05
**Scope:** `pages/CommunityDetail.jsx` (roster effect, `handleAssert`, declaration People branch, `RosterRow`), `components/TrustSignal.jsx` (+CSS), `lib/roster.js` (`resolveTagElement`, `degraded`, `ok`), `events/publish.js` (`MEMBERSHIP_WRITE_RELAYS`), `pages/Found.jsx` (tag-element publish).

## Quality gates
- `node test/test.js` — **PASS** (roster-client 11/11, ui-people-roster 4/4, founding-publishes-tag-element 4/4, full suite green).
- `eslint` — clean. `npm run build` — success (133 modules).

## Verdict: PASS, no blocking issues.

Independently verified:
- **Roster effect** deps `[state.community, retryNonce]` read no value outside the array (v1 is house PoV — no per-viewer staleness); cancelled-guard correct in both `.then`/`.catch`; bespoke circles reset to `idle` via the early return; no render loop.
- **No TDZ** on `handleAssert`'s forward reference to `currentCommunity` — only read at click time (post-render), same pattern as the existing `communityATag`/`loadPosts`.
- **`handleAssert`** disable/clear logic matches the buttons (`'self'` vs target pubkey); `finally` always clears; double-submit guarded; `triggerRetry()` re-runs the roster effect (retryNonce is a dep).
- **degraded vs empty** wired right: `getRoster` never throws (internal catch → `ok:false` → `degraded:true`); `members:[] + !degraded` → "be the first", `degraded` → retry copy.
- **Crypto/policy:** builders pure; signing via `publishEvent`→NIP-07. Tag stays community-agnostic.
- **A11y:** trust dot paired with text (not color-alone); buttons labelled; `role="alert"` on errors; avatar cluster `aria-hidden` with the count in text.

## Addressed on review feedback
- Removed the **unread `viewerAssertions`** from `rosterState` (was dead state in v1 — endpoint isn't passed `viewerPubkey` yet).
- Added a comment on the **`claims[0]` read/write asymmetry** (writes target the first claim; reads union all — fine in v1, founding emits a single claim).
- Fixed the **avatar stack** to the conventional left-anchored order (most-trusted leftmost + on top) instead of `row-reverse`.

## Non-blocking (carried / by design)
- `RosterRow`'s untrusted branch is unreachable in v1 (members all cleared the gate); kept as data-driven forward-wiring for the applicant role, with a comment.
- "I'm in" always renders (no dedup) — harmless (replaceable d-tag supersedes); relabel to "You're in" when a `viewerPubkey` PoV lands.

## Outcome
Story 45 UI **largely DONE**. Follow-ups: discovery-grid trust signal (perf/batching), applicant role (`selfApplied` flag). Live data gated on the ops items (`VITE_PROFILE_API_BASE`/`VITE_TAG_RELAY`/CORS/`minRank`). Block 5 nearly complete — Story 47 (retire the interim posting gate) remains.
