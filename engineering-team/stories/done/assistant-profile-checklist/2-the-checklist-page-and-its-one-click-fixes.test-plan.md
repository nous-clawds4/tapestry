# Test Plan: Story 2 — The checklist page at `/assistant/profile`, and its one-click fixes

**Story:** `engineering-team/stories/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.md`
**ADR:** `engineering-team/decisions/assistant-profile-checklist/0002-the-checklist-page-fixes-through-the-one-writer.md`
**Date:** 2026-10-09

## Coverage map

Node suite `test/assistant-profile-checklist-page.test.js` (registered); browser suite
`tests/brainstorm/assistant-profile-checklist-page.spec.js` (C-tests; its AV-tests belong to story 3). Words and canned
answers: `test/helpers/profileChecklistFixtures.js` (`PAGE_COPY`, `PANELS`).

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 the page | D1 `ACTION_PAGES.profile` is `<ProfileChecklistPage />` · D2 the page reads the one answer, draws the panels from `PROFILE_ITEMS`, links back and to the editor · C1 back link, title, description, the seven panels top to bottom, the editor link, no "Placeholder page." · C13 375 px, no sideways scroll | `test/…-page.test.js`, `tests/brainstorm/…-page.spec.js` | source · browser |
| AC-2 who sees what | D2 the sign-in button and the hub's no-assistant line · C2 a visitor and a viewer with no Assistant: panels, no badges, no fixes | same | source · browser |
| AC-3 states and words | P2 every approved page word is in `PROFILE_CHECKLIST_COPY` · P3 every panel's title and description · P4 `panelState` (coming-soon, unknown, checking, could-not-check ×5, done, needs-attention) · P5 `panelLine` — each done line and each reason's line · P6 `panelLine` — no public address, could not check (domain, relays, local relay, this instance), Checking…, nothing for no-profile or a visitor · P7 `summaryText` · C3 badges and lines on screen, "2 items need attention" · C4 "Your Assistant's profile is complete." · C5 Checking… while the answer is on its way | same | unit (ESM) · browser |
| AC-4 one-click fixes | P8 `fixFor` — each offered fix and its label; none for no public address, no profile, local-only / no relays, could not check, done, the avatar, the banner · P9 `applyProfileFix` — republish, set-website, fill-name-about (only empty fields), publish-default, set-picture; the default as base when there is no profile; non-strings and spaces · D3 the press reads `/api/assistant/status`, posts the one writer, nothing else signs · C6 Set website posts only the website changed · C7 Fill in the default About text · C8 the three republish fixes post the fields unchanged · C10 no profile: the notice's "Publish the default profile" posts the default, no panel fix · C11 a dev box: no NIP-05 / website / client-tag fix, the no-public-address line · C14 the press-time read finds no profile: Set website posts nothing, says so, asks again · C15 the press-time read finds a profile: Publish the default profile posts nothing, says so, asks again (ADR 0002 Amendment 1) · C16 the press-time read found only an older outside copy (`profileSource: 'relay'`): Publish to outside relays posts nothing (ADR 0002 Amendment 2) | same | unit (ESM) · source · browser |
| AC-5 honest results; one at a time | P10 `describeProfilePublish` (published with relays, a refused local write, a refusal, no answer) · D3 `relayLine` / `publishTone` · D4 one in-flight state disables the fix buttons · C6 the relays' answers on the panel · C9 every fix button disabled while one publishes, "Publishing…" · C12 a refused local write shows the writer's words, no ✅ | same | unit (ESM) · source · browser |
| AC-6 re-checked | D3 `refresh()` · C6 / C12 the attention answer is asked again after the press, success or failure | same | source · browser |

## Edge cases

- [x] The profile disappears between the answer and the press (`status.hasProfile` false): the pure function's base is the
      default (P9), but the press publishes nothing, since a failed local scan reads the same way (C14, C15; ADR 0002
      Amendment 1, review round 1).
- [x] Published fields that are not strings, a name of spaces (P9).
- [x] The one writer refuses (403) or its local write fails (500) (P10, C12).
- [x] The press's status read fails: "This instance did not answer; nothing was published." (P10's request-failed line).
- [x] A slow publish: the other buttons wait (C9).
- [x] A case-only file-name clash in `ui/src/pages/assistant` (P1).

## Test infrastructure

- Node's runner through the gate. `profileChecklistCopy.js` is loaded as ESM in Node, as `identificationTagsCopy.js` is.
- **Seams this plan pins where the ADR left them open:**
  - `panelLine(item, row, phase, action)` takes the same arguments as `panelState`.
  - `applyProfileFix(fix, { status, instance, fields, url })`. `fields` is `PROFILE_CONTENT_FIELDS` handed in by the page; a
    module that imports the list itself may ignore it.
  - `describeProfilePublish(nothing)` answers the request-failed line.
  - Each panel is a region named by its title (a `<section aria-labelledby>`, as the Identification Tags page's cards).
- **Words the ADR named but did not quote.** For cases story 2 § Copy has no line for, ADR 0002 points at the
  Identification Tags page's existing words:
  - a press whose status read failed: "This instance did not answer; nothing was published.";
  - a panel with no row, a failed fetch, or a failed check: "Could not check: this instance did not answer." (ADR 0002
    sub-decision 2 paraphrases it as "This instance did not answer."; the suite pins the existing words, as the ADR intends);
  - a profile the local relay could not read: "Could not read this instance's relay."
- Browser: Playwright against a served built UI with every `/api` route mocked. The publish, the status read and the
  attention answer are recorded per scenario.
- Concept Graph: not used. Firmware: none.

### Re-aimed existing tests

- `tests/brainstorm/assistant-management-page.spec.js` B8 skips `/assistant/profile`: it is no longer a placeholder
  (as it already skips `/assistant/identification-tags`).

## How to run

```
npm test
node test/assistant-profile-checklist-page.test.js
BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:7799 \
  npx playwright test tests/brainstorm/assistant-profile-checklist-page.spec.js --project=chromium
```

## Verification

Confirmed failing on 2026-10-09 against the working tree on `a5ee992`:

```
assistant-profile-checklist-page: 0 passed, 14 failed
  P1–P10 ui/src/pages/assistant/profileChecklistCopy.js does not exist …
  D1     ACTION_PAGES must map profile to <ProfileChecklistPage />; it reads: 'identification-tags': <IdentificationTagsPage />,
  D2     ui/src/pages/assistant/ProfileChecklist.jsx does not exist
  D3     no GET /api/assistant/status?customerPubkey=…; no applyProfileFix(…); no fetch('/api/assistant/publish-profile', …); …
  D4     one useState(null) in-flight value (ADR 0002 calls it fixing) must disable the fix buttons

assistant-profile-checklist-page.spec.js C-tests (chromium, built UI, all /api mocked): C1–C12 failed — the placeholder
page has no panels, no states and no fixes; C13 (375 px) passes before and after, a regression guard.
```

### Review round 1 (2026-10-09)

The review found that a press trusted the press-time status read's `hasProfile`, which a failed local scan also makes
`false` (story 2 B1). Three browser pins were added to `tests/brainstorm/assistant-profile-checklist-page.spec.js`:
C14, C15 and story 3's AV7. All three were confirmed failing against the built UI on `dc67d8e` (chromium; the
pre-rebase hash — the same commits are `844911e2` and `97d69cf4` after the rebase onto `0ee7e350`):

```
C14  getByRole('region', { name: 'Website' }).getByText('This instance did not answer; nothing was published.') — not found
C15  locator('main .bs-profile-check-notice').getByText('This instance did not answer; nothing was published.') — not found
AV7  getByRole('region', { name: 'A personalized avatar' }).getByText('This instance did not answer; nothing was published.') — not found
```

### Review round 2 (2026-10-09)

The review (R2-1) found a second way in: a press-time read that fell back to an outside relay holding an **older** copy
answers `hasProfile: true`, `profileSource: 'relay'`, which Amendment 1's guard let through. C16 was added, and C15 and
AV7 now also assert that the press read the status (a round-2 non-blocking note). C16 was confirmed failing against
the built UI on `18cddc6c` (chromium), before the fix:

```
C16  getByRole('region', { name: 'Visible to other nostr apps' }).getByText('This instance did not answer; nothing was
     published.') — not found (the older copy was posted)
C14, C15, AV7  pass (3 passed)
```
