# ADR 0003: The stamped avatar becomes the signed-in person's own: their picture, their Assistant, every role, fetched through the SSRF guard

**Status:** Accepted (approved 2026-10-09)
**Date:** 2026-10-09
**Story:** `engineering-team/stories/assistant-profile-checklist/3-a-personalized-avatar-for-every-assistant.md`
**Amends:** ADR ta-avatar/0003 (*who* may stamp and store, and how the picture is fetched; its D2–D4 stand)

## Context

Story 3 opens the stamped avatar to everyone with an Assistant on this instance and gives the
checklist's avatar panel its fix. In short:

- **AC-1.** The picture stamped is the signed-in person's own: the server reads their newest kind 0
  from this instance's relay, else from the relays this instance reads profiles from. No request can
  name a picture, a URL or another person. The Owner's flow is unchanged.
- **AC-2.** Preview first, on the panel and in the editor.
- **AC-3.** The panel's **Publish this avatar** stores it and republishes the person's own Assistant's
  profile through the one writer with only the picture changed; per-relay report; re-check.
- **AC-4.** The editor's stamped-avatar section is shown to everyone with an Assistant.
- **AC-5.** No picture, an unfetchable one, or one that cannot be stamped: said plainly, no publish.
- **AC-6.** Refusals before anything is fetched or stored; PNG by its bytes, bounded size, never delete,
  survives redeploy; on a dev box, preview yes, publish no.

Settled at approval: no per-person quota; the Architect weighs a simple rate limit (sub-decision 6).

### Concept-graph orientation

As in ADR 0001: the stack is absent (AGENTS.md §2 fallback). Composites are files on the volume, not
nodes (confirmed against a live graph for ta-avatar #3, ADR ta-avatar/0003). **No concept changes. No
firmware reinstall.**

### Codebase facts this design rests on (verified on `374a6ec`)

- **The two routes, Owner-only.** `GET /api/assistant/owner-avatar` and `POST /api/assistant/avatar`
  (`src/api/index.js:576-578`; `src/api/assistant/avatar.js`):
  - Both refuse with 403 unless `isOwner(req) || req.localTrusted` (`avatar.js:185-187, 270-272`).
  - The proxy reads the **Owner's** kind 0 `picture` from the local relay only
    (`getOwnerKind0PictureUrl`, `:121-140`). It fetches it with a plain `fetch`, following at most one
    redirect that it validates only as http(s) (`parseFetchableUrl`, `:153-158`; loop `:214-232`). It
    allows raster types only, at most 5 MB, and streams the bytes back same-origin. A missing picture is
    404 `code: 'no-picture'`. Every other failure is 404 with a sentence and no code.
  - The store runs `uploadMiddleware` (multer, memory, 2 MB) **before** the handler's gate, so a refused
    caller's body is parsed first (`index.js:578`). `storeCompositeAvatar` (`:87-118`) checks the PNG
    magic bytes and the size, and names the file `ta-avatar-<sha256[0:8]>.png`. When the name exists it
    writes nothing and returns the existing file's URL. It never deletes, and it returns a publishable
    URL only on a public instance (D4).
- **Why it is Owner-only** (assistant-profile #4 AC4): the proxy reads the Owner's picture, so "an
  Admin's assistant would wear the Owner's face, and a Customer is refused". The editor hides the
  section unless `status.isOwner` (`AssistantProfileEditor.jsx:383-…`, pinned by
  `test/my-assistant-page.test.js` W8 `:606`).
- **The plain `fetch` was safe only because the Owner chose the URL.** With any signed-in person
  choosing their own `picture`, it would let a Customer make this instance fetch an internal address
  (`http://127.0.0.1:7778/…`, a cloud metadata address, a private-network host) and see whether it
  answered with an image. `guardedFetch(url, options)` (`src/utils/ssrfGuard.js:258-268`) refuses
  anything but https to a host that is and resolves to a public address, and never follows a redirect
  (`redirect: 'manual'`).
- **The person's profile, local first.** `profileState.scanLocalKind0(pubkey)` (newest local kind 0,
  `null` on a miss) and `profileState.queryRelaysKind0(relays, pubkey, { maxWait })` (signatures
  verified by the pool). `resolvePersonName` (`profileDefaults.js:132-…`) already asks the profile
  relays (`readConfiguredRelays(['aProfileRelays'])`) only on a local miss, within
  `RELAY_BUDGET_MS`/`BACKSTOP_MS`, and copies nothing home ("the person's profile is their letter").
- **Whose Assistant.** `getAssistantPubkeyFor(pubkey)` (`src/utils/assistantKeys.js:99`): the Owner →
  the instance TA, anyone else → their own, or null.
- **The browser half.** `buildCompositeAvatar(blob)` (`ui/src/utils/compositeAvatar.js`) draws the
  512 px composite from a same-origin blob and returns `{ blob, dataUrl }`. It throws on an image it
  cannot decode.
- **Tests that pin today's routes** (Tester's lane): `test/stamped-composite-avatar.test.js` (the
  `!isOwner(req)` gate count `:193-200`, `/api/assistant/owner-avatar` registered `:255-256`, live 401/403
  probes `:59-60, 277-281`); `test/my-assistant-page.test.js` W8 (`:606-…`);
  `tests/brainstorm/ta-composite-avatar.spec.js` (mocks the proxy).

### Constraints

- **ADR ta-avatar/0003 D2:** no URL from the caller; the picture comes from a kind 0, read on the server.
  **D3:** never delete a stored composite. **D4:** a publishable URL only when a stranger could fetch it.
  All three stand.
- **Principle 1.** The person's own picture, for their own Assistant, from the session only.
- **Principle 4.** Stored composites are on the persisted volume and are never deleted.
- **House stack.** No native image library (compositing stays in the browser), no new dependency.

## Options considered

### Option A — Generalize the two routes to the session's person, gate before parsing, fetch through the SSRF guard (chosen)

The proxy serves the signed-in person's own picture. The store accepts a composite from anyone with an
Assistant here. Both check "signed in, with an Assistant here" first. The remote fetch goes through
`guardedFetch`, hop by hop.

**Pros:** the smallest change that makes the rule "your picture, your Assistant", with ta-avatar/0003's
mechanics intact. The editor and the panel share one browser flow.
**Cons:** every role can now write into a world-readable directory (bounded below), and the proxy
becomes reachable by every role (bounded by the guard).

### Option B — Composite on the server

The server fetches the picture and stamps it with a native image library.

**Pros:** no proxy streaming bytes to the browser.
**Cons:** a native dependency in the Docker image, and the preview would no longer be the very pixels
published. ADR ta-avatar/0003 rejected it for both. Rejected again.

### Option C — Let the browser fetch the person's picture directly

**Cons:** a cross-origin image taints the canvas unless the host sends CORS headers, which most image
hosts do not. That is why the proxy exists. Rejected.

## Decision

We chose **Option A.**

### Sub-decisions

**1. One gate for both routes: `requireOwnAssistant` (new middleware in `avatar.js`).**

- It needs a session with `authenticated === true` and a 64-hex `pubkey`, and
  `getAssistantPubkeyFor(pubkey)` must be 64-hex. Then it sets `req.avatarPerson = pubkey` and calls
  `next()`.
- No session → 401 `{ code: 'not-signed-in' }`. A session with no Assistant here → 403
  `{ code: 'no-assistant' }`. In both cases nothing is fetched, parsed or stored.
- `req.localTrusted` with no session acts as the Owner (`BRAINSTORM_OWNER_PUBKEY`), as today, for the
  in-container operator.
- Registration: `app.get('/api/assistant/my-picture', requireOwnAssistant, handleMyPicture)` and
  `app.post('/api/assistant/avatar', requireOwnAssistant, uploadMiddleware, handleUploadAvatar)`. **The
  gate runs before multer**, so a refused body is never read into memory.

**2. The proxy is renamed for what it serves: `GET /api/assistant/my-picture`.**

- It serves the signed-in person's own picture, for stamping. `GET /api/assistant/owner-avatar` is
  removed: its only caller is the editor, which moves to the new route in the same change. One route
  with an honest name is better than a route named "owner" that serves anyone.
- `handleOwnerAvatar` becomes `handleMyPicture`, and `getOwnerKind0PictureUrl` becomes
  `getPersonPictureUrl(pubkey, deps)`. The new function reads the newest local kind 0
  (`profileState.scanLocalKind0`). Only when the local relay holds **no** kind 0 does it read the newest
  from `readConfiguredRelays(['aProfileRelays'])` (`profileState.queryRelaysKind0`, under
  `RELAY_BUDGET_MS`, with the `BACKSTOP_MS` backstop). It returns the `picture` string or `null`. It
  copies nothing home and keeps no memo, because this runs only on a press.

**3. Every hop of the fetch goes through `guardedFetch`.**

- The original URL and the one permitted redirect are each fetched with `guardedFetch(url, { signal,
  headers: { accept: 'image/*' } })`.
- A `null` (not https, or not a public host) or a thrown fetch ends the attempt as `unfetchable`.
- A 3xx is followed at most once (`MAX_REDIRECTS = 1`), resolving its `Location` against the current
  URL. The type allow-list, `readBounded` and the 5 MB cap are unchanged.
- **This applies to the Owner too.** An `http://` picture, or one on a private host, can no longer be
  stamped by anyone. The Owner loses nothing reachable by strangers, and keeps one rule for every role.

**4. The proxy says which failure, in three codes the UI maps to story 3's words.**

| HTTP | `code` | When | Story 3 line |
|---|---|---|---|
| 404 | `no-picture` | no kind 0, or no `picture` | No picture |
| 404 | `unfetchable` | not https/public, a refused or failed hop, too many redirects, a non-ok answer, a network error or timeout | Can't fetch |
| 404 | `not-stampable` | a type outside the allow-list, or more than 5 MB | Not stampable |

`error` keeps a sentence for the logs and the editor's existing "Could not get your profile picture to
stamp: {error}" line. The browser maps a `buildCompositeAvatar` throw to `not-stampable` too.

**5. Longer composite names: 32 hex characters of the SHA-256 (128 bits).**

- Today's 8-hex names (32 bits) were fine while only the Owner could store. Once anyone with an
  Assistant can, a name can be claimed first. A person who can predict another's composite bytes
  (drawn from public pictures, in a browser engine they can run) could, with about 2³² work, craft a
  different PNG with the same 8-hex prefix and store it first. The victim's store would then be a
  no-op (`existsSync` → keep), and their Assistant's URL would serve the attacker's picture.
- 128 bits makes that infeasible. `filename = 'ta-avatar-' + sha256.slice(0, 32) + '.png'`.
- Existing 8-hex files stay where they are and keep being served. `COMPOSITE_AVATAR_FILE_RE` (ADR 0001)
  accepts 8–64 hex, so a profile pointing at an old composite still reads as done.

**6. A simple per-person rate limit on new files.**

- In memory: at most `MAX_NEW_AVATARS_PER_DAY = 20` newly written files per person in a rolling 24 h,
  keyed by `req.avatarPerson`. A store whose name already exists writes nothing and is not counted.
- Over the limit → 429 `{ code: 'too-many', error: 'Too many new avatars today. Try again tomorrow.' }`.
  The UI shows it through its existing failure line.
- It resets on a restart. That is enough: it caps an accident or a casual loop. The rest of the abuse
  surface is bounded by the session requirement (each writer is a known account on this instance), the
  2 MB cap, and the PNG check. The Owner is under the same rule. The counter is a `Map` with its
  timestamps pruned on each check.

**7. One browser flow, shared by the editor and the panel: `ui/src/utils/stampedAvatar.js` (new).**

- `stampMyPicture()` → `{ ok: true, composite }` or `{ ok: false, reason, message }`. It fetches
  `/api/assistant/my-picture`, maps the code (sub-decision 4; a 401/403 → `refused`), then calls
  `buildCompositeAvatar`, mapping a throw to `not-stampable`.
- `storeStampedAvatar(blob)` → `{ ok: true, url, path }` or `{ ok: false, reason, message }`, with
  `reason` in `no-public-address` (stored, but `url` is empty), `too-many`, `refused`, `failed`.
- `reasonOf(status, body)` is exported pure for the Node suites.

**8. The editor shows the section to everyone with an Assistant.**

- The `status.isOwner &&` guard on the stamped-avatar section goes. The section is already inside the
  branch that has a key, so it shows for every person with an Assistant.
- `generateComposite` and `useComposite` call `stampMyPicture` and `storeStampedAvatar`.
- Its "no picture" notice becomes story 3's line ("Your nostr profile has no picture to stamp yet. Add
  one in your nostr app, then come back."). Its fallback offer (the branded image) and every other word
  stay.

**9. The avatar panel's fix** replaces ADR 0002's editor link on `ProfileChecklist.jsx`.

- When the avatar panel needs attention (any reason but `no-profile`), it offers **Make my personalized
  avatar**. While working it reads **Stamping your picture…**.
- On success it shows the 512 px preview with **Publish this avatar** and **Not now**. Not now discards
  the preview; nothing is stored.
- **Publish this avatar** calls `storeStampedAvatar`. When it returns a `url`, the panel runs ADR 0002's
  `runFix('set-picture', { url })`: the one writer, only the picture changed, the per-relay report,
  then `refresh()`.
- With no `url` (no public address), the preview stays and the publish button gives way to the page's
  "No public address" line.
- The failures use story 3 § Copy: No picture, Can't fetch, Not stampable. `too-many`, `refused` and
  `failed` use the server's sentence.
- Only one press at a time: the avatar's buttons share ADR 0002's `fixing` state.

**What we trade away**
- Every role can store files in a world-readable directory, bounded by the gate, the PNG check, 2 MB and
  20 new files a day.
- The Owner can no longer stamp an `http://` or private-host picture.
- A short DNS-rebinding window remains between `guardedFetch`'s resolution check and the fetch's own
  resolution, as for every `guardedFetch` caller (`ssrfGuard.js` header). It is not widened here.

## Consequences

- **Enables:** every role can complete the checklist's avatar item; the editor and the panel make the
  same pixels by the same path.
- **Constrains:** an `/api/assistant/owner-avatar` bookmark or script stops working (no known external
  caller).
- **New debt, named:** the rate limit is per process and resets on restart. A durable or global quota
  is a later story if storage use shows a need.
- **Firmware reinstall required?** No.

## Implementation notes

- `src/api/assistant/avatar.js`:
  - add `requireOwnAssistant(req, res, next)` (deps injectable through a factory,
    `createRequireOwnAssistant(deps)`, so the suites need no session store or key store);
  - `getPersonPictureUrl(pubkey, deps)`; `handleMyPicture` (was `handleOwnerAvatar`), reading
    `req.avatarPerson`, every hop through `guardedFetch`, the three codes;
  - `storeCompositeAvatar`: 32-hex names; a new `opts.countNew(person)` hook, or the handler checks the
    limit before storing and records after a real write. The Implementer picks; the suites pin "an
    existing name is not counted";
  - `handleUploadAvatar` reads `req.avatarPerson` for the limit; its own `isOwner` gate goes, because
    the middleware gates;
  - exports: `requireOwnAssistant`, `createRequireOwnAssistant`, `handleMyPicture`,
    `getPersonPictureUrl`, `hasStoredAvatar` (ADR 0001), `MAX_NEW_AVATARS_PER_DAY`, plus today's.
- `src/api/index.js`: the two registrations of sub-decision 1; `/api/assistant/owner-avatar` removed.
- `ui/src/utils/stampedAvatar.js` (new): sub-decision 7.
- `ui/src/components/AssistantProfileEditor.jsx`: sub-decision 8.
- `ui/src/pages/assistant/ProfileChecklist.jsx` and `profileChecklistCopy.js`: sub-decision 9, with
  story 3 § Copy in `PROFILE_CHECKLIST_COPY.avatar`.
- Documents: `src/api/openapi.yaml` (the two routes, if listed; add them beside `/api/assistant/status`
  if not), and BIBLE §11 if it lists the avatar routes. The Implementer checks both.
- **For the Tester:** re-aim the pins listed under § Codebase facts: the gate count and the route name
  in `stamped-composite-avatar.test.js`, W8 in `my-assistant-page.test.js`, and the proxy mock in
  `ta-composite-avatar.spec.js`. Add: an Admin and a Customer stamp their own picture; a request cannot
  name a person or URL; an internal-address picture is `unfetchable` without any request leaving for
  it (inject the fetch); the gate runs before multer; the 32-hex name; the limit, with an existing name
  not counted.

## Out of scope

- The background image (the same idea for the banner).
- Automatic re-stamping, external hosting, deleting old composites, a durable quota.
