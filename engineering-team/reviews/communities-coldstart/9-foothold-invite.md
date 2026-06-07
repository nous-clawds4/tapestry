# Review: Story 9 — Extend a foothold invite (issuing side)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-07
**Diff:** working tree (uncommitted) over `feat/communities` @ `6b7522a0`
**Story:** `engineering-team/stories/communities-coldstart/9-foothold-invite.md`
**ADR:** `engineering-team/decisions/communities-coldstart/0039-foothold-invite.md` (Option C)

## Quality gates (run by reviewer, not trusted)

- [x] `node test/test.js` — **PASS**. Overall PASS; `foothold-invite suite: PASS (6 passed, 0 failed)`. No regressions across all 56 suites.
- [x] Lint — `npx eslint src/events/build.js src/events/fetch.js src/pages/CommunityDetail.jsx` → **exit 0** (confirmed via explicit `$?`).
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped (JS-without-build, per house rules)._

## Spec adherence (ACs)

- [x] **AC1** signed-in member creates invite + shareable link. `handleCreateInvite` (`CommunityDetail.jsx:435-453`) builds via `buildFootholdInvite`, publishes to `MEMBERSHIP_WRITE_RELAYS`, surfaces `${origin}/community/${slug}?invite=${code}` in a read-only, select-on-focus input (`CommunityDetail.jsx:711-719`). Covered by T1 (event shape) + T3/T4 (wiring + `?invite=`).
- [x] **AC2** states the invite vouches for the recipient, peer voice. Lede: "Your invite vouches for them. They can join even if no one else here knows them yet." (`CommunityDetail.jsx:699`) — verbatim from the design guide §"Foothold invite". No "approve"/"admit" in the new copy. Covered by T6 (distinctive "invite vouches for them").
- [x] **AC3** issuer sees their invites. `fetchFootholdInvites` populates `issuedInvites` (`CommunityDetail.jsx:297-306`), rendered as a list (`:720-726`), and the optimistic append on create (`:451`). Covered by T5.
- [x] **AC4** empty state before any invite. "You haven't invited anyone yet. An invite is how a new person gets their first foothold." (`CommunityDetail.jsx:727`) — verbatim from the design guide. Covered by T5.
- [x] **AC5** failed creation → inline error + retry; nothing silently half-created. `inviteState.error` rendered with `role="alert"` and an inline Retry button (`CommunityDetail.jsx:704-708`); error copy "Couldn't create the invite. Retry?" matches the style guide; both the `!result.ok` and `catch` paths reset `creating:false` and never append to the list. Covered by T3 + review.
- [x] **AC6** signed-out → sign-in prompt (no disabled control). `!signedIn` branch renders a `Sign in to invite someone in` button calling `onSignIn` (`CommunityDetail.jsx:728-730`); no disabled control is shown. Covered by review.

## ADR adherence (ADR-0039, Option C)

- [x] Files match the implementation notes: `events/build.js` (`buildFootholdInvite`), `events/fetch.js` (`fetchFootholdInvites`), `pages/CommunityDetail.jsx` (panel + handler + `makeInviteCode`), `CommunityDetail.module.css`.
- [x] **Invite event shape** (`build.js:277-296`): kind-39999; `a`=communityATag; `d`=`invite-${code}` (addressable, so Story 10 can fetch by code); `p`=issuer; `z`=`39998:${LEGACY_Z_TAG_PUBKEY}:foothold-invite`; `content:''`. Guards on all three inputs. `LEGACY_Z_TAG_PUBKEY` imported from `events/assertion.js` (`build.js:1`). `created_at` via module-scope `nowSec()`.
- [x] **`z` marker is the foothold-invite convention, not `:nostr-user-tag`** — confirmed against `assertion.js:30-32` (`NOSTR_USER_TAG_Z_TAG` is what the roster counts; tag is `:tag`). The roster engine ignores `:foothold-invite`, so no membership-count pollution. Matches ADR Consequences §"Firmware reinstall? No."
- [x] **Link shape** `${location.origin}/community/${slug}?invite=${code}` (`CommunityDetail.jsx:449-450`) with the stable `?invite=` param Story 10's accept reads.
- [x] **Scope boundary** — issuing only. No accept/redemption flow, no carried-vouch fulfillment, no `buildMembershipAssertion` invocation for the recipient. Self-contained and correct.
- [x] **No new dependencies / no engine change.** Reuses existing `publishEvent`, `MEMBERSHIP_WRITE_RELAYS`, `collectFromRelay`, `DEFAULT_RELAYS`, `publishErrorCopy`. No new tooling.

## Concept-graph integrity
- [x] `z` handle is in `kind:pubkey:slug` form (`39998:<pubkey>:foothold-invite`). Community `a` coordinate is the existing circle handle.
- [x] No concept definitions changed → no firmware reinstall needed (ADR confirms: app-level relay convention, not a graph concept).
- [x] N/A — no `/summaries` re-derivation; pure event builder.

## Code-quality / things tests can't catch
- [x] **Code-gen purity.** `makeInviteCode` is module-scope (`CommunityDetail.jsx:46-49`) — `crypto.randomUUID`/`Date.now`/`Math.random` live outside render, mirroring the Stories 4/5/8 lesson and `makeOptimisticReaction`. eslint react-hooks/purity clean.
- [x] **Build-time safe.** No `Date.now`/`Math.random` in render scope; `nowSec()` and `makeInviteCode()` are invoked only in handlers/builders.
- [x] **`fetchFootholdInvites` correctness** (`fetch.js:134-148`): filters kind-39999 by `#a`+author, then requires `z.endsWith(':foothold-invite')`. Other kind-39999 events for that author+circle (membership assertions `:nostr-user-tag`, tag-elements `:tag`, bespoke posts) are excluded by the `z` guard. Returns `{code, createdAt, id}`, newest-first. `USE_MOCK`/missing-input guard returns `[]`.
- [x] **Gating** on `canCompose` (`CommunityDetail.jsx:560-562`, `:697`) — a real member for declaration circles, joined for bespoke. Non-members render nothing; signed-out gets the sign-in prompt. Reasonable per ADR ("gate on canCompose — a member").
- [x] **Edge cases.** Unusual/undefined `location` → `origin=''` yields a graceful relative link, no crash (`CommunityDetail.jsx:449`). Rapid/duplicate create guarded by `inviteState.creating` early-return (`:436`); each create mints a fresh random code (multi-use default, simplest — matches ADR scope). Circle coordinate uses `circleATag(currentCommunity, viewer)`, the same helper used elsewhere, so bespoke-vs-declaration kind is handled by existing logic.
- [x] No secrets, no leftover `console.log`, no commented-out code, no stray TODOs in the Story 9 diff.
- [x] **CSS** is token-based throughout (`--space-*`, `--border`, `--bg-input`, `--text-*`, `--radius-md`) — `CommunityDetail.module.css:253-299`. Reused `.publishError`/`.parentLink` classes exist (`:460`, `:499`).
- [x] **Real-source tests.** T1–T2 extract-and-eval the genuine `buildFootholdInvite` with the loader injecting `LEGACY_Z_TAG_PUBKEY` + `nowSec` (matches `membership-assertion.test.js`). They exercise shipped code, not a copy. The Tester's rescope of T6 to the distinctive "invite vouches for them" phrase is sound — the original whole-file approve/admit guard would have collided with the pre-existing roster-row "no one you trust vouches for them" copy and the "never approve/admit" comment, neither of which is Story 9's.

## House rules check
- [x] Concept Graph API authority respected (no domain-concept changes).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
None.

### Non-blocking
1. **`CommunityDetail.jsx:451`** — the optimistic append uses `id: code` as the React key, while `fetchFootholdInvites` uses the nostr event `id`. The two effects each `setIssuedInvites` to a fresh array (no merge), so there is no duplicate-key collision in practice; the only effect is that an invite's key changes from `code` to event-id after the next fetch. Cosmetic; safe to leave. Optional: key the optimistic entry by `code` consistently in both shapes if you want stable identity.
2. **Design guide §"Foothold invite"** mentions a calm issuer reminder ("Your vouch stands behind this person"). It is not rendered. AC2 is satisfied by the lede alone (it states the invite vouches for the recipient), and the reminder is flavor, not an AC — so this is not blocking. Optional: add it as a second line for full design-guide fidelity. (Caught nothing in tests because no AC requires it.)
3. **`fetch.js:140`** — the `z` extraction `(tags.find(...) || [])[1] || ''` is correct but slightly dense; a one-line comment would aid the next reader. Optional.

## Verdict
**PASS** — The diff matches the story (all six ACs covered with passing tests), the ADR (Option C event shape, `z` convention, link param, issuing-only scope, no engine change), and the test plan (6/6, real-source T1–T2, justified T6 rescope). Quality gates clean: full suite PASS with no regressions, eslint exit 0. The two `coldstart` book-doc edits (`book.md` Q-resolutions) and the untracked `LEGACY_CIRCLE_CLEANUP.md` are out-of-story bookkeeping and do not affect the verdict. No blocking issues; the three non-blocking notes are optional polish.
