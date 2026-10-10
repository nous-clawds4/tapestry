# Test Plan: Story 3 — A personalized avatar for every Assistant, and the avatar panel's fix

**Story:** `engineering-team/stories/assistant-profile-checklist/3-a-personalized-avatar-for-every-assistant.md`
**ADR:** `engineering-team/decisions/assistant-profile-checklist/0003-the-stamped-avatar-for-the-signed-in-persons-own-assistant.md`
**Date:** 2026-10-09

## Coverage map

Node suite `test/assistant-stamped-avatar-for-everyone.test.js` (registered); browser tests AV1–AV6 in
`tests/brainstorm/assistant-profile-checklist-page.spec.js`. Words: `test/helpers/profileChecklistFixtures.js`
(`AVATAR_COPY`).

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 your own picture, your own Assistant | G1 a Customer, an Admin and the Owner pass the gate, named as `req.avatarPerson` · P1 the picture is the person's own newest kind 0's: local first; the profile relays only when the local relay holds no kind 0; another author's ignored · M1 the proxy serves the session person's picture, never a URL or pubkey from the request, with its image type | `test/assistant-stamped-avatar-for-everyone.test.js` | unit (DI) |
| AC-2 preview first | AV1 Make my personalized avatar: a stamped preview, Publish this avatar / Not now; nothing stored or published · AV3 Not now: nothing sent | `tests/brainstorm/…-page.spec.js` | browser |
| AC-3 the panel's fix publishes it | AV2 stored, then the profile republished with only the picture changed, and the answer asked again · AV7 the press-time read finds no profile: no profile is published, the panel says so (ADR 0002 Amendment 1) · D4 the page uses the shared flow and the `set-picture` fix | spec · `test/…-everyone.test.js` | browser · source |
| AC-4 the editor offers it to everyone | AV6 a Customer sees "Generate badged avatar" · D3 the editor uses `stampMyPicture` / `storeStampedAvatar`, not `/api/assistant/owner-avatar`, with story 3's "no picture" line | spec · node | browser · source |
| AC-5 no picture, or none that can be stamped | M2 no picture → 404 `no-picture` · M5 a host that fails → `unfetchable` · M6 HTML, SVG, over 5 MB → `not-stampable` · U1 `reasonOf` maps the codes; 401/403 refused; else failed · AV4 the three lines on the panel, no publish · D4 story 3's words in the copy module | node · spec | unit (DI, ESM) · browser |
| AC-6 the same safety rules, for more people | G2 refused before anything else: 401 `not-signed-in`, 403 `no-assistant`, a throwing key store · G3 the in-container operator acts as the Owner · G4 the exported gate refuses a visitor · M3 internal addresses and non-https are `unfetchable` with **no request leaving** (the real SSRF guard, global fetch stubbed) · M4 a redirect is followed once and through the guard; a public host redirecting to 127.0.0.1 makes one request only; two redirects refused · N1 32-hex content names · N2 at most 20 new files per person per rolling day; an existing name not counted; another person unaffected; a day later allowed · N3 older composites kept, PNG by its bytes, the path under `/generated/` · D1 the gate runs **before** multer on the store; the old route gone · D2 no `!isOwner(req)`, `guardedFetch`, no plain `fetch(` or request parameter in the proxy · AV5 a dev box: previewed and stored, not published, the no-public-address line | node · spec | unit (DI, temp dir) · source · browser |

## Edge cases

- [x] A redirect `Location` relative to the first URL (M4).
- [x] Cloud metadata (169.254.169.254), loopback, private network, `localhost`, `file:`, `ftp:`, `http:` (M3).
- [x] A response that never declares its length but streams past 5 MB (M6).
- [x] The limit's window boundary (N2), and re-storing identical bytes at the limit (N2).
- [x] A person whose profile exists locally but has no picture: no relay is asked (P1).

## Test infrastructure

- Node's runner through the gate. Stack-free: the gate, the picture lookup and the proxy are driven through injected
  dependencies. The SSRF cases run the **real** `guardedFetch` with `globalThis.fetch` replaced by a recorder, using IP
  literals so no DNS is needed. The store runs in temp directories.
- **Seams this plan pins where the ADR left names open:**
  - `createRequireOwnAssistant({ getAssistantPubkeyFor, getOwnerPubkey })`.
  - `getPersonPictureUrl(pubkey, { scanLocalKind0, queryRelaysKind0, getProfileRelays })`: the names
    `resolvePersonName` already uses.
  - `handleMyPicture(req, res, { getPersonPictureUrl, guardedFetch })`: the `(req, res, deps = {})` idiom of
    `handleAssistantAttention`.
  - `handleUploadAvatar(req, res, { baseDir, now })`: `baseDir` as `storeCompositeAvatar`'s, `now` for the window.
  - `reasonOf(status, body)` in `ui/src/utils/stampedAvatar.js`, which loads in Node, so its import of
    `compositeAvatar` carries `.js`.
- Browser: the picture proxy answers a real 1×1 PNG, so the browser genuinely stamps it; the store and the publish are
  recorded.

### Re-aimed existing tests (this story changes them on purpose)

- `test/stamped-composite-avatar.test.js`:
  - U2 and U6: 32-hex names.
  - S1: both routes behind `requireOwnAssistant`; 401 and 403.
  - S2: the proxy is `handleMyPicture`, still taking no URL from the request.
  - S6 and the H probes: `/api/assistant/my-picture`.
- `test/my-assistant-page.test.js`:
  - W8: the generator is rendered **without** a `status.isOwner` guard.
  - W9: the server's words may come through the shared flow's `message`.
- `tests/brainstorm/my-assistant-page.spec.js`:
  - B14: the Owner, an Admin and a Customer are each offered the generator.
  - B17: story 3's "no picture" line.
  - Its proxy mock moves to `/api/assistant/my-picture`.
- `tests/brainstorm/ta-composite-avatar.spec.js` and `tests/brainstorm/assistant-default-profile.spec.js`: the proxy
  mock moves to `/api/assistant/my-picture`.

## How to run

```
npm test
node test/assistant-stamped-avatar-for-everyone.test.js
BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:7799 \
  npx playwright test tests/brainstorm/assistant-profile-checklist-page.spec.js -g AV --project=chromium
```

## Verification

Confirmed failing on 2026-10-09 against the working tree on `a5ee992`:

```
assistant-stamped-avatar-for-everyone: 0 passed, 19 failed
  G1–G4  src/api/assistant/avatar.js must export createRequireOwnAssistant() / requireOwnAssistant() …
  P1     … must export getPersonPictureUrl()
  M1–M6  … must export handleMyPicture()
  N1     want ta-avatar-90dcea595a8aa92aa0cc0539a66977d6.png, got "ta-avatar-90dcea59.png"
  N2     MAX_NEW_AVATARS_PER_DAY: want 20, got undefined
  N3     two composites, both kept; got 403/403 — the handler still gates on the instance owner
  U1     ui/src/utils/stampedAvatar.js does not exist
  D1–D4  the routes, the owner gate, the editor and the page, as today

Re-aimed: stamped-composite-avatar 8 passed, 5 failed (U2, U6, S1, S2, S6 — the names, the gate, the route);
my-assistant-page 30 passed, 1 failed (W8 — the generator is still the Owner's only).

Browser (chromium, built UI, all /api mocked): AV1–AV6 fail — the profile page is the placeholder and the editor hides
the generator from a Customer; the re-aimed my-assistant-page B14–B17, ta-composite-avatar B1–B3 and
assistant-default-profile B3 fail because today's build still asks /api/assistant/owner-avatar.
```

### Review round 1 (2026-10-09)

AV7 was added for story 3 B1, the same defect as story 2 B1 reached through the `set-picture` press. It was confirmed
failing against the built UI on `dc67d8e` (chromium; pre-rebase — `97d69cf4` after the rebase): the avatar panel never shows "This instance did not answer;
nothing was published." because the profile is published. See story 2's test plan, § Review round 1.

### Review round 2 (2026-10-09)

Story 3's `set-picture` press goes through the same guard, so story 2's C16 covers R2-1 for it too (ADR 0002
Amendment 2). AV7 now also asserts that the press read the status.
