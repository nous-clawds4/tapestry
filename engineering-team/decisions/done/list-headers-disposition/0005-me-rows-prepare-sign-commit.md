# ADR 0005: Me rows — the server prepares the new version, the person's browser signer signs it, the server checks it is exactly that change before saving

**Status:** Accepted
**Date:** 2026-10-01
**Story:** `engineering-team/stories/done/list-headers-disposition/5-disposition-on-me-rows.md`

## Context

Story 5 puts the three actions on **Me** rows: kind-39998 headers the signed-in *account* wrote. Book decision 1 says
the person's own browser signer (NIP-07) signs them. The instance never sees the person's private key, and it saves
nothing but the chosen action's own change, signed by that account. The owner also decided that **Next** walks Me rows
and Assistant rows separately.

**What exists after stories 3 and 4.**

*The Assistant handler* is `src/api/list-headers/myAssistantDisposition.js`. Its steps:

| Step | What it does |
|---|---|
| 0 | `sameHost` |
| 1 | `requireAuth` |
| 2 | the caller's Assistant keys |
| 3 | the handle (kind 39998) |
| 4 | the author is the caller's Assistant |
| 4b | the Wire target's `prepare` (type, Cc/Cf, ≤1024 bytes, `39998:` form, own address by parts) |
| 5 | the latest header |
| 5b | that header verifies (author, kind, first `d`, signature) |
| 6 | compose with `src/lib/headerDispositionCompose.js` |
| 7 | sign with the Assistant key |
| 8 | strfry, then the read-back by id, then the graph |

Its building blocks are module-level, but not exported: `sameHost`, `firstD`, `HANDLE_RE`, `HEADER_KIND`, `ACTIONS`
(each action's `prepare` and `compose`, plus its `done` and `already` words), and `defaultDeps()` (`verify`,
`scanLatest`, `publishLocal`, `isStored`, `importToGraph`, `requireAuth`, `now`).

*The browser signer:*
- the app signs with `window.nostr` (NIP-07);
- `ui/src/utils/signerGuard.js` provides `getActiveSignerOrThrow(expected = getSessionPubkey())`. It throws
  `'No NIP-07 extension detected.'` without a signer, and a `SignerMismatchError` with a ready-made sentence when the
  signer's active account isn't the signed-in session;
- `AuthContext` keeps that session pubkey current (`ui/src/context/AuthContext.jsx:40`);
- `signEvent` rejects when the person declines.

*The panel* (`ui/src/pages/lists/ListHeaderDispositionPanel.jsx`):
- its actions are `fn(handle) → { message, event }` passed through `run`;
- **Next** is `nextUndecided(afterId)` in `Index.jsx`, filtered to `authorRole === 'my-assistant'`;
- the host holds the Wire pick-list.

*Client-signed publishing elsewhere.* `POST /api/strfry/publish` with `signAs: 'client'` checks the signature only
(`src/api/strfry/commands/publishEvent.js:74-91`). It has no session binding, no exact-change check, no read-back,
and no same-host check, so it can't meet story AC 4 as it stands.

*Sharing the rules with the browser.* `ui/vite.config.js` already bundles three CJS libraries from `src/lib` through
aliases. So bundling the composition module into the browser is possible. Whether it's wise is Option B below.

**Concepts.** Only `39998:<TA>:list` headers are re-signed. No concept, schema or firmware change.

## Options considered

### Option A — prepare, sign, commit: the server composes, the browser only signs

1. `POST /api/list-headers/me/:handle/<action>/prepare` (body: `{ target }` for Wire).
   - It runs steps 0, 1, 3, 4 (with the *session account* as the author), 4b, 5, 5b and 6. There is no key lookup:
     the Me path never touches a private key.
   - It answers one of:
     - the "already" result, with the stored, verified event, so nothing needs signing;
     - a domain refusal;
     - `{ result: 'sign', template }`, where the template is `{ kind, content, tags, created_at, pubkey }` for the new
       version.
2. **The browser:**
   - `getActiveSignerOrThrow()` checks there is a signer and that its account is the session's;
   - `window.nostr.signEvent(template)` signs;
   - the browser checks that `signed.pubkey` is the session's.
3. `POST …/<action>/commit` (body: `{ event, target? }`).
   - It runs steps 0–6 **again from a fresh lookup**, so the server re-derives the change itself.
   - It accepts the signed event only if every one of these holds:
     - it is an object;
     - `event.pubkey` is the session account;
     - `event.kind === 39998`;
     - `event.content` equals the current header's content;
     - `event.tags` deep-equal the freshly composed tags;
     - `event.created_at` is an integer, greater than the current header's, and no more than 600 s ahead of now;
     - the event verifies (a JSON round-trip).
   - Then step 8 runs unchanged: strfry, then the read-back, then the graph.

*Pros:*
- **The rules stay server-only, in the one composition module.** The browser never composes, so it can't compose
  from stale page data or disagree with the server.
- **The commit re-derives everything,** so a signed event that is anything but this action's change to the *current*
  header is refused. That's AC 4's "nothing but the person's own change".
- **Every check that can fail without the signer runs before the prompt:** another site, the session, the author,
  the stored header, a bad target, already done. A doomed request never prompts the person.
- **The "already" cases never prompt** (AC 2).

*Cons:*
- **Two requests per action.** The steps run twice, which is cheap: a strfry read by id and a composition.
- **A header that changes between prepare and commit gets 409.** The person reopens it. That's honest, and only
  happens under concurrent edits.

### Option B — the browser composes with the shared module (bundled by a Vite alias) and sends one signed event

*Pros:* one request.

*Cons:*
- the browser composes from the page's copy of the header, which may be stale;
- the server must still re-derive and compare, so the rules run in two places;
- the "already" and refusal logic would need browser copies;
- a doomed request (an unverifiable stored header, say) is only found *after* the person has signed;
- `bValueForms.js` would join the aliased CJS set.

Rejected.

### Option C — reuse `POST /api/strfry/publish` with `signAs: 'client'`

*Cons:* no session binding, no exact-change check, no read-back, no same-host check. AC 4 can't be met without
rebuilding those inside a route that other features depend on. Rejected.

## Decision

We chose **Option A**.
- **The composition rules stay single-sourced on the server.** The browser does the one thing only it can do: sign.
- **Every check that can fail without the signer runs before the prompt,** so a doomed request never asks the person
  to sign.
- **The commit trusts nothing it didn't derive itself.**
- **It reuses the Assistant handler's checked building blocks unchanged.** They are exported, not rewritten.

## Consequences

- **The Me path never looks up, receives or holds a private key.** The structure test can pin that:
  - `getAssistantKeys` and `privkey` are absent from the new module;
  - so are the old bypasses (`isOwner`, `localTrusted`, the Owner-only key helpers).
- **The Assistant handler doesn't change behaviour.** It only gains a `module.exports` of the pieces above. Story 3
  and 4's tests, including their structure guards on that file, stay as they are.
- **The person sees one signer prompt per action,** after all the server-side refusals. Declining, having no signer,
  or a signer on another account each give a sentence with nothing saved. The account mismatch uses the existing
  `SignerMismatchError` text.
- **Me and Assistant walks stay separate** (owner decision): **Next** keeps the role of the row the panel was opened
  on.
- **A signed event that fails the commit check is simply not used.** It was signed but never published, so no harm
  is done.
- **The read-back hardening items** (OPEN.md row `2026-10-01-list-headers-readback-hardening`) apply here too,
  through the shared `isStored`. They stay filed.
- **Firmware reinstall required?** No.

## Implementation notes

**`src/api/list-headers/myAssistantDisposition.js`**
- No logic change. Add to `module.exports`: `sameHost`, `firstD`, `HANDLE_RE`, `HEADER_KIND`, `ACTIONS` and
  `defaultDeps`.

**New `src/api/list-headers/meDisposition.js`**
- **`createMeDispositionHandler(action, phase, deps = {})`.**
  - `phase` is `'prepare'` or `'commit'`; `action` is one of `ACTIONS`' keys. An unknown pair throws when the
    handler is built.
  - `d = { ...defaultDeps(), ...deps }`. Only `requireAuth`, `scanLatest`, `verify`, `publishLocal`, `isStored`,
    `importToGraph` and `now` are used. Never `getAssistantKeys` or `sign`.
- **Shared steps, in this order, for both phases:**
  - **0.** `sameHost(req)`, or 403 `'a request from another site is refused'`.
  - **1.** `sessionPubkey = d.requireAuth(req, res)`, which has answered 401 if missing.
  - **3.** Match `String(req.params.handle || '')` against `HANDLE_RE`, or 400. A kind other than 39998 gets 400
    (the same sentences as the Assistant handler).
  - **4.** A handle pubkey other than `sessionPubkey` gets 403 `'You can only disposition headers you wrote'`.
  - **4b.** `spec.prepare ? spec.prepare(req, selfCoord, { pubkey: sessionPubkey }, dTag) : {}`. `prep.error` gets
    400.
  - **5.** `header = d.scanLatest({ kinds: [39998], authors: [sessionPubkey], '#d': [dTag] })`, or 404.
  - **5b.** The same four checks as the Assistant handler, with `sessionPubkey` as the author: on failure, 409 with
    the same sentence.
  - **6.** `composed = spec.compose(header, selfCoord, prep)`:
    - `refused` gets 200 `{ success: false, error }`;
    - `already` gets 200 `{ success: true, result: spec.already, event: header }`.
- **`prepare`, after step 6:** 200
  `{ success: true, result: 'sign', template: { kind: 39998, content: header.content || '', tags: composed.tags, created_at: nextCreatedAt(header.created_at, d.now()), pubkey: sessionPubkey } }`.
- **`commit`, after step 6.** `ev = req.body && req.body.event`.
  - **The account:** when `ev` isn't an object, or `ev.pubkey !== sessionPubkey`, answer 403
    `"That version wasn't signed by the account you're signed in with, so nothing was saved"`.
  - **The change:** answer 409 `"The signed version isn't exactly this action's change to the current header, so nothing was saved"`
    unless all of these hold:
    - `ev.kind === 39998`;
    - `ev.content === (header.content || '')`;
    - `JSON.stringify(ev.tags) === JSON.stringify(composed.tags)`;
    - `Number.isInteger(ev.created_at) && ev.created_at > header.created_at && ev.created_at <= d.now() + 600`.
  - **The signature:** when `!d.verify(ev)`, answer 400 `"The signed version doesn't verify, so nothing was saved"`.
  - **Then step 8,** exactly as in the Assistant handler: `publishLocal`, then `isStored` (502 not kept, or 502
    couldn't confirm), then `importToGraph`. Then 200 `{ success: true, result: spec.done, event: ev }`.
  - **At commit time,** `composed.already` or `composed.refused` from step 6 means the header changed since prepare.
    Answer 409 with the change sentence, not "already", because the person signed something that is no longer
    needed.
- **`register(app)`** mounts `POST /api/list-headers/me/:handle/<action>/<phase>` for the three actions × two phases,
  each with its own handler.
- **`src/api/index.js`:** one more `require('./list-headers/meDisposition').register(app)`, beside the Assistant
  module's. Deploy to the drifted container by adding only that line, as in story 3.

**New `ui/src/utils/meDisposition.js`**
- **`submitAsMe(handle)`, `keepPrivateAsMe(handle)` and `wireAsMe(handle, target)`,** each returning
  `{ message, event }`:
  1. POST `…/prepare` (with `{ target }` for Wire). A `success: false` throws `data.error`.
  2. **When the result is an "already" one:** for Submit and Wire, re-broadcast `data.event` and return
     `outcomeMessage({ …, already: true })`; for Keep private, return the existing "Already kept private…" sentence.
     No signer is touched.
  3. **When the result is `'sign'`:**
     - `await getActiveSignerOrThrow()`, mapping `'No NIP-07 extension detected.'` to
       `"Signing your own headers needs a NIP-07 browser signer — nothing was saved"`. `SignerMismatchError` keeps its
       own text;
     - `signed = await window.nostr.signEvent(data.template)`. A rejection maps to
       `"Signing was cancelled in your signer — nothing was saved"`;
     - when `signed.pubkey !== getSessionPubkey()`, throw the mismatch sentence;
     - POST `…/commit` with `{ event: signed, target }`. A `success: false` throws.
  4. **Then,** for Submit and Wire, `publishToRelays(…, CONCEPT_PUBLISH_RELAYS)` and `outcomeMessage` with
     `verb: 'submit'` or `'wire'`. For Keep private, the "Kept private…" sentence.

**`ui/src/pages/lists/ListHeaderDispositionPanel.jsx`**
- A `signer` prop, `'me'` or `'my-assistant'`.
- The panel picks `submitAsMe`, `keepPrivateAsMe` and `wireAsMe` for `'me'`, and the existing three for
  `'my-assistant'`. Nothing else in the panel changes.

**`ui/src/pages/lists/Index.jsx`**
- `rowSigner(row)` is `row.kind === 39998 ? authorRole(row.author, user) : null`, keeping only `'me'` and
  `'my-assistant'`.
- The **Disposition…** button shows when `rowSigner(row)` is set.
- The host and panel get `signer={rowSigner(panelRow)}`.
- `nextUndecided(afterId, signer)` filters to `rowSigner(r) === signer`, so **Next** never crosses between Me and
  Assistant rows.

**Seams for the Tester** (Phase 3 decides the suites)
- **The handler through `deps`,** for both phases and all three actions:
  - every refusal in steps 0–6, with the session account as the author;
  - **prepare** answers the template, or "already" with no template;
  - **commit's checks**, each refused with nothing saved:
    - a non-object event;
    - another pubkey;
    - another kind;
    - changed content;
    - an extra or missing tag;
    - the wrong b-type;
    - a stale or far-future `created_at`;
    - a bad signature;
    - a header that changed between prepare and commit;
  - **commit success** runs relay, read-back, graph in that order;
  - **the read-back 502s.**
- **Structure:**
  - the new module never mentions `getAssistantKeys`, `privkey`, `sign(` or the old bypasses;
  - `sameHost` runs before `requireAuth`;
  - the Assistant module's export list.
- **Browser,** with a stubbed `window.nostr` (`addInitScript`, the hermetic sign-in recipe), counting `signEvent`
  calls:
  - the button on Me rows;
  - the three actions each sign once;
  - "already" never signs;
  - no signer, a declined prompt and a mismatched account each show their sentence, with no commit;
  - **Next** stays within Me rows.
- **Live:** extend L1 (no session from inside the container gets 401) to the six new routes. A real Me signature
  can't be driven without the Owner's key, so it's proven at handler level with a test key.

## Out of scope
- Wiring a kind-9998 header by event id.
- Batch signing.
- Choosing a signer.
- Concept Headers.
- The filed read-back hardening items.

## Amendment 1 (2026-10-01, review round 1)

Story 5's review (`engineering-team/reviews/done/list-headers-disposition/5-disposition-on-me-rows.md`) found one blocking
defect: the panel outlives a sign-out. The owner then decided, at that gate (2026-10-01), that all three non-blocking
items ride along.

Everything above stands except where a rule below adds to it or replaces it.

### What changes, and why

1. **The panel exists only while its row is the viewer's (blocking 1).**
   - Signing out in the page, or signing in as someone else, leaves `panelId` set. So `rowSigner(panelRow)` becomes
     `null`, and two things go wrong:
     - `nextUndecided(afterId, null)` matches every row that isn't the viewer's, so **Next** opened another person's
       row for a signed-out viewer;
     - the panel's actions are `undefined`, so its buttons throw.
   - **The rule:**
     - the panel is shown only while `rowSigner(panelRow)` is set;
     - when it stops being set, `panelId` is cleared, so the panel doesn't come back by itself at the next sign-in.
       This is the same rule as the Author selector's reset in ADR 0001 Amendment 1;
     - `nextUndecided` never matches a missing signer.
2. **The stored-header refusal has its own sentence on Me rows (non-blocking 3; replaces "the same sentence" in
   step 5b).**
   - On a Me row there is no Assistant. At commit, the person has already signed, so "nothing was signed" would be
     untrue.
   - The 409 reads `"The stored header couldn't be verified as yours, so nothing was saved"`, in both phases.
3. **A header dated too far ahead is refused before anyone signs (non-blocking 1).**
   - The relay accepts ordinary publishes up to 900 s ahead, and `strfry import` doesn't check timestamps at all. So a
     person's own header can be dated more than 600 s ahead.
   - In that case `nextCreatedAt(header.created_at, now)` exceeds the commit's limit of now + 600. The person was
     prompted to sign a version no commit could accept, and then got a misleading "isn't exactly this action's change".
   - **The rule:** in both phases, when `nextCreatedAt(header.created_at, d.now()) > d.now() + 600`, answer **409**:
     `"The stored header is dated more than 10 minutes ahead, so a newer version can't be saved yet — nothing was saved"`.
   - **Where it runs:**
     - in prepare, after the "already" and refusal answers and before the template;
     - in commit, after the account check and the header-changed check, and before the exact-change check.
   - So an "already" answer is unaffected, and a doomed request never prompts.
4. **Every failure inside the signer says nothing was saved (non-blocking 2).**
   - `getActiveSignerOrThrow()` calls `getPublicKey()`. Only a missing signer was mapped. A decline there, or any odd
     rejection (a string, `undefined`), reached the panel raw. A non-`Error` even made the panel's own `catch` throw,
     which left it stuck busy.
   - **The rule, in `signAsMe`:**
     - no signer gives the no-signer sentence;
     - a `SignerMismatchError` keeps its text;
     - **anything else** from `getActiveSignerOrThrow()` gives `"Signing was cancelled in your signer — nothing was saved"`,
       the same as a rejection from `signEvent`.
   - **The panel's `run`** always clears `busy`. It shows `err.message` when there is one, and otherwise
     `"That didn't work — try again."`. That sentence makes no claim about what was saved, because `run` also serves
     the Assistant actions.

### Implementation notes (additions)

**`ui/src/pages/lists/Index.jsx`**
- `nextUndecided` becomes:
  ```js
  const nextUndecided = (afterId, signer) => (signer ? filteredRows.find(r =>
    rowSigner(r) === signer && r.disposition === MARKS.undecided.state && r.routeId !== afterId) : null) || null;
  ```
- The host renders only when `panelRow && rowSigner(panelRow)`.
- An effect clears the panel when its row stops being the viewer's:
  ```js
  useEffect(() => { if (panelRow && !rowSigner(panelRow)) setPanelId(null); }, [panelRow, user]);
  ```

**`src/api/list-headers/meDisposition.js`**
- Two new constants: `UNVERIFIED_HEADER` (§2) and `TOO_FAR_AHEAD` (§3).
- Step 5b answers `409 UNVERIFIED_HEADER`.
- The §3 check uses the existing `MAX_AHEAD_SECONDS`, at the two places named above.

**`ui/src/utils/meDisposition.js`**
- `signAsMe`'s first `catch`:
  - `err instanceof SignerMismatchError` → rethrow;
  - `err && err.message === 'No NIP-07 extension detected.'` → `NO_SIGNER`;
  - otherwise → `DECLINED`.

**`ui/src/pages/lists/ListHeaderDispositionPanel.jsx`**
- `run`'s `catch` becomes:
  ```js
  catch (err) { setBusy(false); setMessage(err && err.message ? err.message : "That didn't work — try again."); }
  ```

**Tests (Phase 3 decides the suites):**
- **Browser:**
  - act on a Me row, then sign out: the panel is gone and no other row's panel can open;
  - sign out with the panel open: the panel is gone, with no page error;
  - sign back in: the panel doesn't come back;
  - a decline at `getPublicKey`, and a non-`Error` rejection: the cancelled sentence, `busy` cleared, no commit.
- **Node:**
  - the §2 sentence in both phases;
  - the §3 refusal in both phases, with no template, no prompt and nothing written. A header exactly at the limit
    still prepares.
