# Review: Story 3 — A personalized avatar for every Assistant, and the avatar panel's fix

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-09
**Diff:** `git show 224ea3b` on `staging` (local, unpushed). Tests: `50a6103`, with Tester-lane corrections `ac4ffbc`
and `ef81af6`.
**Story:** `engineering-team/stories/assistant-profile-checklist/3-a-personalized-avatar-for-every-assistant.md`
**ADR:** `engineering-team/decisions/assistant-profile-checklist/0003-the-stamped-avatar-for-the-signed-in-persons-own-assistant.md`
(amends ADR ta-avatar/0003)
**Test plan:** `engineering-team/stories/assistant-profile-checklist/3-a-personalized-avatar-for-every-assistant.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` (`GATE_LABEL=reviewer-profile-checklist`), read with `npm run gate:status -- --label reviewer-profile-checklist`:

  ```
  20261009T163208Z-6889-0b67 [reviewer-profile-checklist] started 2026-10-09T16:32:08.630Z on d5aa7309 — FAIL, exit 1, 5294 passed, 1 failed, 582 skipped, 285/285 suites; failed: harness-lint · /home/user/tapestry/tmp/gate-runs/20261009T163208Z-6889-0b67.json
  ```

  The only failure is `harness-lint`, with the single pre-existing `VIOLATION L10 commit:695fac4` (not this book's).
  This story's suites: `assistant-stamped-avatar-for-everyone` 19/0/0, `stamped-composite-avatar` 13/0/2 (live-probe
  skips, no stack) and `my-assistant-page` 31/0/0.
- [x] Playwright (chromium), built UI at `http://localhost:7799` (200; `dist/` current with HEAD's `ui/`). Ten specs:
  **119 passed, 3 skipped, 0 failed**. For this story: `assistant-profile-checklist-page.spec.js` AV1–AV6 ✓,
  `my-assistant-page.spec.js` 18 ✓ (B14–B17 re-aimed), `ta-composite-avatar.spec.js` 5 ✓ and
  `assistant-default-profile.spec.js` 8 ✓.
- [x] _Lint, typecheck and build not configured; skipped._

## Spec adherence

| AC | Tests (plan IDs) | Result |
|---|---|---|
| AC-1 your own picture, your own Assistant | G1, P1, M1 | pass |
| AC-2 preview first | AV1, AV3 | pass |
| AC-3 the panel's fix publishes it | AV2, D4 | pass, but its "every other field as it is published now" goes through story 2's `runFix` and fails on the same path (B1) |
| AC-4 the editor offers it to everyone | AV6, D3; my-assistant-page B14, W8 | pass |
| AC-5 no picture / unfetchable / not stampable | M2, M5, M6, U1, AV4, D4 | pass |
| AC-6 the same safety rules, for more people | G2, G3, G4, M3, M4, N1, N2, N3, D1, D2, AV5 | pass |

- [x] Every acceptance criterion has a passing test.
- [ ] No criterion is silently dropped. AC-3 inherits story 2's B1.
- [x] No behavior added that isn't in the story.

**Copy:** `PROFILE_CHECKLIST_COPY.avatar` (`ui/src/pages/assistant/profileChecklistCopy.js:107-115`) matches story 3 §
Copy verbatim. The editor's no-picture line (`ui/src/components/AssistantProfileEditor.jsx`, the `stamped.reason ===
'no-picture'` branch) is the panel's line, as the story asks.

## Security audit (the newly opened surface)

| Question | Answer | Where |
|---|---|---|
| Does the gate refuse before any fetch, parse or store? | **Yes.** 401 `not-signed-in` (no 64-hex authenticated session, and not `localTrusted`), 403 `no-assistant`, or 500 when the key store throws. All three come before `next()`. Registration puts the gate ahead of multer on the store. | `src/api/assistant/avatar.js:171-201`; `src/api/index.js:578-579`; D1, G2 |
| Does every hop, redirects included, go through `guardedFetch`? | **Yes.** Hop 0 and the single permitted redirect (`MAX_REDIRECTS = 1`, `Location` resolved against the current URL) each go through `d.guardedFetch`. `null` (not https or not public) and a throw are `unfetchable`. A second redirect is refused. M3 and M4 use the real guard with `fetch` stubbed: an internal-address redirect sends no second request. | `avatar.js:312-335` |
| Can a request name a URL or another person? | **No.** The proxy reads only `req.avatarPerson`, set by the gate from the session (or the Owner for the in-container operator), and `getPersonPictureUrl(person)` takes nothing else. The upload names no person. The editor is only ever mounted with `customerPubkey={user.pubkey}` (`ui/src/pages/assistant/EditProfile.jsx:54-57`). | `avatar.js:298-304, :386`; M1, D2 |
| Is the daily limit keyed on the session person, and can it be bypassed? | **Keyed on `req.avatarPerson`**, the lowercased session pubkey (`:179-180, :198`). `admitNewAvatar` is consulted only when the content name is new, before the write (`:127-133`). The store is synchronous, so parallel uploads cannot race the count. No request input changes the key. It is in memory and resets on restart, as ADR 0003 sub-decision 6 accepts. | `avatar.js:362-374, :394`; N2 |
| Is the stored file a PNG by its bytes, with a size bound? | **Yes.** It checks the 8-byte PNG signature on the buffer and a 2 MB cap in `storeCompositeAvatar`, and multer also caps it at 2 MB with a single file. | `avatar.js:109-117, :356-359`; N3 |
| Are the 32-hex names safe from path tricks? | **Yes.** The name is `ta-avatar-` plus 32 lower-hex characters of the SHA-256 plus `.png`, and is never request-derived. `hasStoredAvatar` checks the anchored regex before any `fs` call. | `avatar.js:121-123, :152-159`; N1, F1 |
| Is the TA pubkey hardcoded anywhere? | **No.** There is no 64-hex literal in the added lines. The Owner comes from `BRAINSTORM_OWNER_PUBKEY` at runtime. | — |

## Walk of the diff (story 3's files)

- `src/api/assistant/avatar.js`:
  - `getPersonPictureUrl` `:224-256`: local first. The profile relays (`aProfileRelays`) are asked only when the
    local relay holds no kind 0 by the person (Deviation 4, as AC-1 says), within `RELAY_BUDGET_MS`/`BACKSTOP_MS`. It
    copies nothing home and keeps no memo.
  - `handleMyPicture` `:291-352`: the three codes (`no-picture`, `unfetchable`, `not-stampable`). It treats Express's
    `next` as no deps (`:295`), and the image-type allow-list (no SVG) is unchanged.
  - `handleUploadAvatar` `:384-402`: 429 `too-many`, and its own `isOwner` gate is removed.
- `src/api/index.js:573-579`: `/api/assistant/owner-avatar` is gone. `my-picture` and `avatar` both sit behind
  `requireOwnAssistant`, and only the editor called the old route (ADR 0003 sub-decision 2).
- `ui/src/utils/stampedAvatar.js:17-69`: `reasonOf` maps the codes, 401/403 to `refused`, and anything else to
  `failed`. `stampMyPicture` maps a build throw to `not-stampable` with `stage: 'build'`. `storeStampedAvatar` returns
  `no-public-address` when the store gives no URL. Both catch everything, so the page's `fixing` state can never get
  stuck.
- `ui/src/components/AssistantProfileEditor.jsx`: the `status.isOwner &&` guard is gone, and the section stays inside
  the has-a-key branch. `generateComposite` and `useComposite` use the shared flow. The no-public-address early return
  comes before `updateField('picture', …)` (W16).
- `ui/src/pages/assistant/ProfileChecklist.jsx:129-206`: make (stores nothing), preview, "Not now" (discards),
  "Publish this avatar" (store, then `runFix('avatar', 'set-picture', { url })` at `:152`). With no URL the preview
  stays and the button gives way (Deviation 1: the line is said once).
- `ui/src/utils/compositeAvatar.js`: comment only.
- `src/api/openapi.yaml:399-438`: both routes are documented, with their codes, limits and gate.

## ADR adherence
- [x] Files and exports match ADR 0003's implementation notes (`createRequireOwnAssistant`, `requireOwnAssistant`,
  `getPersonPictureUrl`, `handleMyPicture`, `hasStoredAvatar`, `MAX_NEW_AVATARS_PER_DAY`). `allowNew` is the hook the
  ADR left to the Implementer (Deviation 3).
- [x] ADR ta-avatar/0003's D2, D3 and D4 still hold: no caller URL, no deletes, and a URL only when public.
- [x] No new dependencies. Compositing stays in the browser.

## Concept-graph integrity
- [x] No concepts touched. Composites are files, not nodes. No firmware reinstall is needed.

## Things tests can't catch
- [x] No secrets, debug logging or commented-out code.
- [x] Refusals come before work, and all failures are coded.
- [ ] The AC-3 publish inherits story 2's B1 (see below).
- [x] Principle 1: the person's own picture, for their own Assistant, from the session only.

## House rules check
- [x] Concept Graph API authority respected. No new tooling.

## Findings

### Blocking

1. **ui/src/pages/assistant/ProfileChecklist.jsx:152 → :108-113**: the same defect as story 2's B1, through the
   avatar's publish.

   **Failure path:** "Publish this avatar" stores the composite and then runs `runFix('avatar', 'set-picture', { url })`.
   If the press-time `GET /api/assistant/status` reads `hasProfile: false` because the local `strfry scan` failed
   (`src/api/assistant/profileState.js:45` resolves `null`) and no publish relay holds the profile, then
   `applyProfileFix` uses `status.defaults` as the base (`profileChecklistCopy.js:225`). The one writer then replaces
   the Assistant's real profile with the default plus the new picture. That breaks AC-3 ("with the picture set to the
   stored avatar's address and every other field as it is published now"), and the loss is irreversible.

   **Asked change:** the guard requested in story 2's review, B1. No story-3 file needs to change. On re-review I will
   check only that the guard covers `set-picture` and that a pin exercises it.

### Non-blocking (OPEN.md / ledger candidates)
1. **src/api/assistant/avatar.js:333-335 / :343**: the body read has no time limit.
   - The 5 s abort timer is cleared in the `finally` around the hop loop, before `readBounded` reads the body.
   - An upstream that answers with an allowed image type and then trickles its body can hold the request open, with up
     to 5 MB of buffered chunks, indefinitely.
   - This is pre-existing (ta-avatar/0003). It was reachable only by the Owner, and is now reachable by every
     provisioned Admin and Customer.
   - Ask: keep the abort armed until `readBounded` returns.
2. **src/utils/ssrfGuard.js:27-33**: the guard's header accepts the DNS-rebinding window partly because the guarded
   callers never return the response body to the caller. `my-picture` does return it (`avatar.js:346-348`). https with
   certificate validation still closes the practical path, so ADR 0003's "it is not widened here" is slightly
   overstated. Record it in the ssrfGuard header, or in the ADR's trade-offs.
3. **bin/control-panel.js:159**: the comment "Only the owner-gated upload writes here" is now stale. Every
   provisioned Admin and Customer can write there. This file is outside the diff, but its security comment now
   misleads.
4. **bin/control-panel.js:161-165**: `/generated` is served without `X-Content-Type-Options: nosniff`, while any
   provisioned Admin or Customer can now store up to 2 MB of bytes that merely start with the PNG signature (story 3
   Open question 1 accepted this). Browsers do not sniff `image/png` into HTML, so this is defense in depth only.
5. **src/api/openapi.yaml:399-438**: neither route documents the 500 the gate answers when the key store throws
   (Deviation 2).
6. **BIBLE.md:8**: the "Last updated" line credits §11 and §14 with "the stamped avatar becomes every person's own, at
   `GET /api/assistant/my-picture`", but neither section's body mentions the avatar routes. §11 never listed them, so
   ADR 0003's conditional did not require a row. Either add the two rows to §11, or drop the claim from the
   Last-updated line.

### Harness friction
1. None beyond story 1's note.

## On PASS
- Not applicable: CHANGES_REQUESTED. Status flips and the commit are the main session's, per the brief.

## Verdict
**CHANGES_REQUESTED**
