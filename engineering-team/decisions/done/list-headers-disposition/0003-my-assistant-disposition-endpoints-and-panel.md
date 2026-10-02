# ADR 0003: My-Assistant disposition — session-bound endpoints that sign only with the caller's own Assistant, and a List Headers panel

**Status:** Accepted
**Date:** 2026-10-01
**Story:** `engineering-team/stories/done/list-headers-disposition/3-disposition-on-my-assistant-rows.md`

## Context

Story 3 lets a signed-in person run **Submit as a Shared Concept** and **Keep private** on any kind-39998
header their own Assistant wrote, from List Headers. The rule this book exists for: *nobody can trigger
somebody else's Assistant to publish anything*. Its pieces, from book decisions 2 and 4 and the implied rule:
- no session, no signer;
- no admin override;
- only the caller's own Assistant.

**The existing actions and why they can't be reused as they are.**

`POST /api/concept/:handle/self-declare` (`src/api/concept/selfDeclare.js`) and `/b-defer` / `/b-append`
(`src/api/concept/bDisposition.js`):
- gate on `isOwner(req) || req.localTrusted` (`selfDeclare.js:54`, `bDisposition.js:40`). `isOwner` admits
  admins (`src/middleware/auth.js:291`);
- sign with the Owner's Assistant only: `loadTAKey()` then `signAndFinalize()` (`src/api/normalize/helpers.js:27-51`);
- accept only headers whose author is the Owner's Assistant (`bDisposition.js:116-126`).

Concept Headers must keep that behaviour in this book (OPEN.md row
`2026-10-01-concept-headers-disposition-owner-signer` records its later fix). So the List Headers actions need
their own endpoints.

**The rules those endpoints apply, which the new ones must keep.**
- **Self-declare** (`selfDeclare.js:85-97`):
  - when the latest header already has `['b', <own address>]`, the answer is `already-declared` and nothing is
    signed;
  - otherwise the new tags are every earlier tag, minus any `b-tag-deferred` marker (`stripSentinel`), plus
    `['b', <own address>, 'pointer']`.
- **Keep private** (`bDisposition.js:181-206`):
  - when the header has a real b (a-tag or event id), the answer is HTTP 200 `{ success: false }` (the house
    "domain refusal");
  - when the marker is already there, the answer is `already-deferred`;
  - otherwise the new tags are every earlier tag plus `['b', 'b-tag-deferred']`.
- **Both:**
  - `created_at = max(now, previous + 1)`, so a re-sign always replaces the previous version
    (`bDisposition.js:138-149`);
  - the new version goes to local strfry (`publishToStrfry`) and is imported into Neo4j
    (`importEventDirect(signed, selfCoord)`, `helpers.js:64`, which replaces the node's tags). Principle 4:
    the graph is the definitive "me".
- **The browser,** not the server, sends a submitted header to `wss://dcosl.brainstorm.world`:
  - it uses `publishToRelays` and reports through `classifyBroadcast` / `outcomeMessage`
    (`src/lib/broadcastOutcome.js`, aliased `@tapestry/broadcast-outcome`);
  - the `submit` verb's `fresh` and `already` messages for `published` / `kept-local` / `not-delivered`
    are exactly story AC 5's three outcomes;
  - Keep private is never broadcast (`ui/src/utils/dispositionActions.js:43-51`).

**The precedent for "the caller's own Assistant".** `POST /api/dlist-curation/header`
(`src/api/dlist-curation/index.js:243-249`):
- `requireAuth(req, res)` (`src/api/trustedList/index.js:186-198`) admits only a session with
  `authenticated === true` and a 64-hex `pubkey`;
- `getAssistantKeys(sessionPubkey)` (`src/utils/assistantKeys.js:20-26`) returns the owner slot for the Owner,
  and that account's own relay keys for anyone else;
- `sign(template, privkeyHex)` is injected;
- every side effect goes through `createAuthorCurationHeaderHandler(deps)`, so the branch logic is tested
  stack-free.

**How a no-session call from inside the container is refused.**
- The auth middleware stamps a no-session loopback call `req.localTrusted = true` and lets it through
  (`auth.js:361-363`). It doesn't create a session.
- `requireAuth` therefore answers 401. That's book decision 2 by construction, as long as the new handlers
  never read `req.localTrusted`.
- An authenticated session of any role falls through the middleware to the handler. None of the new paths
  matches its owner-only lists (`auth.js:368-430`).

**The page** (after stories 1 and 2):
- `useAuth().user` carries `{ pubkey, assistantPubkey }` (ADR 0001);
- `listHeaderDisposition(ev)` (ADR 0002) gives each row a state word and marks;
- rows come from the `headers` state, which holds raw events.

ADR 0001's Consequences already said this story should add the "whose row is this?" predicate to
`ui/src/utils/viewerAuthorScope.js`.

**Concepts.** Only `39998:<TA>:list` headers are re-signed. No concept, schema or firmware change.

## Options considered

### Option A — new session-bound endpoints, a pure tag-composition module, a List Headers panel

- **Server.**
  - A new module registers `POST /api/list-headers/my-assistant/:handle/self-declare` and `…/b-defer`.
    Story 4 adds `…/b-append`.
  - Each handler, in order: `requireAuth`, then the caller's own keys, then the handle's author must be those
    keys' pubkey, then the latest header, then the composition, then sign with *those* keys, then strfry,
    then Neo4j.
  - The tag rules move into a pure CJS module both handlers call. Story 5's browser signing will need the
    same rules.
- **UI.**
  - A new panel component for List Headers: two actions now, Wire in story 4.
  - A new small actions module mirroring `dispositionActions.js`.
  - A **Disposition…** button in the 🧭 cell of the caller's own Assistant's rows.
  - The row updates from the returned event.

*Pros:*
- **The rule lives in one handler shape that can't express the old bypasses.** It has no `isOwner`, no
  `localTrusted`, and no Owner-only key loader. A source guard can pin those absences.
- **Concept Headers' files aren't touched.**
- **The composition rules get one home that the next two stories and the later Concept Headers fix can all
  share.**
- **Every refusal and the signer identity are testable stack-free** through injected dependencies, as
  curation's are.

*Cons:*
- **For one book, two endpoint families apply the same tag rules.** The old one inline, the new one through
  the pure module. A parity test pins the new module to the old handlers' cases. The Concept Headers fix
  retires the inline copy.

### Option B — give the existing three endpoints a per-session signer

Change the gate to `requireAuth` and the signer to `getAssistantKeys(session)` in `selfDeclare.js` and
`bDisposition.js`.

*Pros:* one endpoint family.

*Cons:* it *is* the Concept Headers fix. It changes what Concept Headers' buttons do today:
- admins lose the ability to sign as the Owner's Assistant;
- loopback scripts stop working;
- Concept Detail and the Adoption Queue change with them.

The owner put that fix in a later book. Rejected for this book.

### Option C — sign in the browser for Assistant rows too

The browser would get the Assistant's key, or ask a signing endpoint, and publish through
`/api/strfry/publish` `signAs: 'client'`.

*Cons:*
- the Assistant's private key would have to reach the browser, or a generic "sign this for me" endpoint
  would exist. Both are wider than this story's need;
- the server would lose the composition rules, so a crafted request could publish arbitrary tags under the
  person's Assistant.

Rejected.

## Decision

We chose **Option A**. It is the only option that applies the owner's rule without changing Concept Headers.
Its handler shape (session first, the caller's own keys, the author check, then signing) is the curation
precedent the codebase already trusts. Pulling the tag rules into a pure module now also gives stories 4 and 5,
and the eventual Concept Headers fix, one place to read them.

## Consequences

- **Enables** story 4: one more handler action (`b-append`, with `composeWire`) and one more panel button.
  It also enables story 5: the same pure composition, signed in the browser for **Me** rows.
- **The endpoints are the future home for Concept Headers.** Its fix can point its panel at these routes and
  delete `selfDeclare.js` / `bDisposition.js`'s inline rules. Until then the parity test keeps the two in
  step.
- **Admins and the Owner act only on their own Assistant's rows.** For the Owner that's the instance's
  Assistant, the same one Concept Headers uses. An admin's own Assistant is their customer-relay key. An
  admin can no longer act on the Owner's Assistant's rows *from this page*. They still can from Concept
  Headers until its fix.
- **No server-side broadcast.** Like Concept Headers, the browser sends the signed event to the community
  relay, and the deployment's local-only setting is honoured there (`publishToRelays` reports
  `skippedByGate`).
- **Safer lookup than the precedent.** The latest header is read with the spawn-based
  `strfryScanStream(filter)` (`bDisposition.js:70-99`, exported), not the shell-quoted `strfryScan`. The
  handle's d-tag comes from the URL, so no shell sees it.
- **No Assistant key leaves the handler.** Responses carry the signed event only. Errors never include key
  material, and nothing logs it.
- **"Next undecided" uses the page's filtered order, not DataTable's internal sort.** That internal state
  isn't visible to the page. The story says "on the page"; the visible-order nuance is accepted.
- **Story 2's `…:null` link quirk is left alone.** The panel reuses `routeId`, the same handle the page links
  with. For a d-less header that fails the server's handle pattern and is refused. No such header exists
  locally or on staging.
- **Firmware reinstall required?** No.

## Implementation notes

**Server**

- **New `src/lib/headerDispositionCompose.js`** (pure CJS; requires only `./bValueForms`):
  - `composeSelfDeclare(header, selfCoord)`:
    - returns `{ already: true }` when some tag is `['b', selfCoord, …]`;
    - otherwise returns `{ tags: [...stripSentinel(header.tags), ['b', selfCoord, 'pointer']] }`.
  - `composeKeepPrivate(header)`:
    - returns `{ refused: 'this header already carries a real b — deferral applies only to unaffiliated headers' }`
      when any b value classifies as `a-tag` or `event-id`;
    - else `{ already: true }` when a b value is `SENTINEL`;
    - else `{ tags: [...header.tags, ['b', SENTINEL]] }`.
  - `nextCreatedAt(prevCreatedAt, now)` returns `Math.max(now, (prevCreatedAt || 0) + 1)`.
  - It never mutates `header.tags`.
- **New `src/api/list-headers/myAssistantDisposition.js`.**
  - `createMyAssistantDispositionHandler(action, deps = {})`, where `action` is `'self-declare' | 'b-defer'`.
    Every side effect is injected:

    ```
    requireAuth(req, res)            → sessionPubkey | null   (default: trustedList.requireAuth)
    getAssistantKeys(sessionPubkey)  → { pubkey, privkey } | null   (default: utils/assistantKeys)
    scanLatest(filter)               → newest event | null   (default: strfryScanStream + newest by created_at)
    sign(template, privkeyHex)       → signed event   (default: nostr-tools finalizeEvent, container path as dlist-curation)
    publishLocal(event)              (default: normalize/helpers publishToStrfry)
    importToGraph(event, uuid)       (default: normalize/helpers importEventDirect)
    now()                            → unix seconds
    ```
  - The handler body runs in this order and stops at the first answer:
    1. `requireAuth` → 401 (it has already answered).
    2. `keys = getAssistantKeys(sessionPubkey)`. Missing, or no `pubkey` / `privkey`, answers 403
       `{ error: 'You have no Tapestry Assistant on this instance' }`.
    3. Parse `decodeURIComponent(req.params.handle)` against `^(\d+):([0-9a-f]{64}):(.+)$`. No match answers
       400. A kind other than 39998 answers 400 `'only kind-39998 list headers can be dispositioned'`.
    4. A handle pubkey other than `keys.pubkey` answers 403
       `'You can only disposition headers your own Assistant wrote'`.
    5. `header = scanLatest({ kinds: [39998], authors: [keys.pubkey], '#d': [d] })`. None answers 404.
    6. Compose:
       - `refused` answers 200 `{ success: false, error }`;
       - `already` answers 200 `{ success: true, result: 'already-declared' | 'already-deferred', event: header }`.
    7. `signed = sign({ kind: 39998, content: header.content || '', tags, created_at: nextCreatedAt(header.created_at, now()) }, keys.privkey)`.
    8. `await publishLocal(signed)`, then `await importToGraph(signed, selfCoord)`. A thrown error answers 500
       with its message, never key material.
    9. Answer 200 `{ success: true, result: 'declared' | 'deferred', event: signed }`.
  - The module must not reference `isOwner`, `isOwnerOrAdmin`, `localTrusted`, `loadTAKey`,
    `signAndFinalize`, `getOwnerAssistantKeys` or `getOwnerAssistantPubkey`.
  - `register(app)` mounts the two routes. Export the factory, `register` and the route paths.
- **`src/api/index.js`.** Call the new module's `register(app)` beside the existing
  `/api/concept/:handle/self-declare` registration (`index.js:650`). Nothing else in that file changes.

**UI**

- **`ui/src/utils/viewerAuthorScope.js`.** Add `authorRole(authorPubkey, user)`:
  - returns `'me'` when it equals a valid `user.pubkey`;
  - returns `'my-assistant'` when it equals a valid `user.assistantPubkey`;
  - otherwise returns `null`. Pure, no fallback, as ADR 0001.
- **New `ui/src/utils/myAssistantDisposition.js`.**
  - `submitAndBroadcast(handle)` and `keepPrivate(handle)` POST to the two routes.
  - Submit then calls `publishToRelays(data.event, CONCEPT_PUBLISH_RELAYS)`. Import the relay list from
    `./dispositionActions`, an existing export, unchanged. It catches into `result = null` and returns
    `{ message: outcomeMessage({ outcome: classifyBroadcast(result), verb: 'submit', already: data.result === 'already-declared' }), event: data.event }`.
  - `keepPrivate` returns `{ message: data.result === 'already-deferred' ? 'Already kept private — nothing new was signed.' : 'Kept private — this header is marked as deliberately unaffiliated.', event: data.event }`.
    It never broadcasts.
  - Both throw `new Error(data.error)` on `success: false`.
- **New `ui/src/pages/lists/ListHeaderDispositionPanel.jsx`.**
  - Modelled on `ui/src/components/DispositionPanel.jsx`: same frame and header line, and the same
    `run`/`finish` busy and message pattern.
  - Props: `{ row, onActed(event), hasNext, onNext, onClose }`.
  - Buttons:
    - **🤝 Submit as a Shared Concept**;
    - **🔒 Keep private**, disabled when `row._dispositionMarks` includes the wired or self-declared mark,
      with `title` = the refusal sentence above.
  - After an action it shows the message and **Next undecided →** (when `hasNext`) and **Done**.
  - No Wire section (story 4).
- **`ui/src/pages/lists/Index.jsx`.**
  - **The 🧭 cell.** After the marks, when `row.kind === 39998 && authorRole(row.author, user) === 'my-assistant'`,
    render `<button className="btn" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }} onClick={e => { e.stopPropagation(); setPanelId(row.routeId); }}>Disposition…</button>`,
    as `ConceptList.jsx:256-262` does.
  - **Panel state.** `const [panelId, setPanelId] = useState(null)`. The panel's row is
    `rows.find(r => r.routeId === panelId)`. Render the panel above the table when that row exists.
  - **Acting updates the row.** `onActed(event)` replaces the header in `headers` whose
    `(kind, pubkey, d)` matches the event's, when the event's `created_at` is newer. The `rows` memo and
    story 2's classifier then show the new marks without a reload.
  - **Next.** `nextUndecided(afterId)` is the first of `filteredRows` where `kind === 39998`,
    `authorRole(author, user) === 'my-assistant'`, `disposition === 'undecided'` and `routeId !== afterId`.
- **Not changed:** `DispositionPanel.jsx`, `dispositionActions.js` (only imported from), `ConceptList.jsx`,
  `selfDeclare.js`, `bDisposition.js`.

**Seams for the Tester** (Phase 3 decides the suites)

- **Handler, stack-free through `deps`.**
  - Every refusal row in steps 1–6.
  - That `sign` receives the *session's* Assistant's privkey: for a customer session, never the Owner's.
  - That `publishLocal` and `importToGraph` are never called on a refusal or an `already`.
  - That a request with `req.localTrusted = true` and no session gets 401.
  - The source guard on the forbidden identifiers.
- **Composition, pure.** Plus parity with the old inline rules: the same header inputs give the same tag
  outputs as `selfDeclare.js` / `bDisposition.js` would.
- **Browser, network-mocked:**
  - the button appears only on the caller's own Assistant's 39998 rows;
  - the panel's messages for each `result` and broadcast outcome;
  - Keep private is disabled with its reason;
  - the row's marks update after an action;
  - **Next undecided →**.
- **Live,** only as refusals and only against a scratch stack or with no side effects:
  - a guest session (verify-user, then sign 22242, then login-user, with a throwaway key) gets 403 (no
    Assistant);
  - a no-session in-container loopback POST gets 401;
  - the header's sha is unchanged afterwards.

  A real Owner-session sign can't be driven without the Owner's key, so the signer identity is proven at the
  handler level.

## Out of scope

- Wire (story 4) and **Me** rows (story 5).
- Any change to Concept Headers' endpoints, panel or actions.
- Server-side broadcasting.
- Fixing the page's `…:null` link for d-less headers.

## Amendment 1 (2026-10-01, review round 1)

The story 3 review (`engineering-team/reviews/done/list-headers-disposition/3-disposition-on-my-assistant-rows.md`)
found two security gaps in this design and one usability gap. This amendment closes them. Everything above
stands except where a rule below adds to it.

### What changes, and why

1. **Check the header before re-signing it.**
   - Step 5 trusted the relay's latest header. But events can enter the relay unverified: `src/api/io.js:363`
     imports with `strfry import --no-verify`.
   - So a forged event claiming to be the caller's Assistant would be re-signed with the real key. The
     re-signed version would carry the forger's content and tags.
   - Before composing, the handler now refuses (409, nothing signed) unless:
     - `header.pubkey === keys.pubkey`;
     - `header.kind === 39998`;
     - the header's *first* `d` tag equals the URL's d-tag (a multi-`d` event can't stand in for another
       address);
     - the event verifies.
   - The check runs before both answers, `already-*` as well as a re-sign. Otherwise an `already` answer would
     hand an unverified event to the browser to broadcast.
2. **Refuse cross-site requests first.**
   - The session cookie sets no `sameSite` (`bin/control-panel.js:210-219`), and CORS reflects any origin with
     credentials (`:114-119`).
   - The newer signing routes guard this per endpoint with `sameHost(req)`:
     `src/api/dlist-curation/update.js:107-115` (ADR curated-dlist-update/0006 §1), copied into
     `src/api/tagging-edges/index.js:147`, both "until ledger row 326 centralises it".
   - This handler gets the same check, copied verbatim with the same comment, as its first step, before
     `requireAuth`.
   - **A third copy, not a new shared module.** Row 326 owns centralising it. A shared module used by only one
     of three callers would be a fourth state, not a fix.
3. **Decode the handle once.** Express already decodes `req.params`. The extra `decodeURIComponent` turned a
   d-tag of `a%41` into `aA`, and a lone `%` into a 500. The handler now uses `req.params.handle` as Express
   gives it.
4. **Bring the panel into view.**
   - The panel renders above the table. On a real list it opened up to 12,136 px above the viewport.
   - The page scrolls the window, and the 48 px `.app-header` is `position: fixed`
     (`ui/src/styles.css:643-655`). Two other options were rejected:
     - `block: 'start'` would tuck the panel under the header;
     - `position: sticky` doesn't work here, because `.main-content` has `overflow-y: auto`
       (`styles.css:136-141`) and so becomes the sticky container though it isn't the element that scrolls.
   - The panel scrolls itself to the centre of the viewport when it mounts:
     `scrollIntoView({ block: 'center' })`, with no `smooth`, so it's immediate and testable.
   - **Next undecided →** remounts the panel (it is keyed by `routeId`), so the same effect runs again.

### Implementation notes (additions)

**`src/api/list-headers/myAssistantDisposition.js`**
- A `sameHost(req)` function, copied verbatim from `dlist-curation/update.js:107-115` with the "copied until
  ledger row 326 centralises it" comment, as in `tagging-edges/index.js:142-146`.
- **The handler order becomes:**
  - **0.** `if (!sameHost(req)) return res.status(403).json({ success: false, error: 'a request from another site is refused' })`.
  - **1 to 3.** As before, except step 3 matches `HANDLE_RE` against `String(req.params.handle || '')`, with
    no `decodeURIComponent`.
  - **4 and 5.** As before (the author check, then the lookup, then 404 when nothing is found).
  - **5b.** When `header.pubkey !== keys.pubkey || header.kind !== 39998 || firstD(header) !== dTag || !d.verify(header)`,
    answer 409
    `{ success: false, error: "The stored header couldn't be verified as your Assistant's, so nothing was signed" }`.
    Log which check failed, by name only, with no event body and no key.
  - **6 to 9.** As before.
- **A new injected dependency,** `verify(event)` → boolean. The default is
  `require(NOSTR_TOOLS_PATH).verifyEvent(JSON.parse(JSON.stringify(event))) === true`, inside a try/catch that
  returns `false` (the `src/api/strfry/commands/publishEvent.js:88` form).
- `firstD(event)` is the value of the first tag whose name is `d`, or `null`.

**`ui/src/pages/lists/ListHeaderDispositionPanel.jsx`**
- A `ref` on the panel's outer `div`.
- `useEffect(() => { ref.current?.scrollIntoView?.({ block: 'center' }); }, [])`.
- Nothing else changes in the panel or the page.

### Consequences (additions)

- **A forged or foreign event in the relay can no longer be laundered through this endpoint.** It answers 409,
  and the person sees the refusal in the panel. The live relay holds no such event today (284 headers checked,
  0 failing verification), so the check costs nothing on real data.
- **Requests with no `Origin` header still reach the session check:** `curl`, and in-container calls. That's
  the house rule (`update.js:102-106`), and it changes nothing for book decision 2: such calls still have no
  session.
- **After Done, the window stays where the panel was,** so a person who opened a row far down the list is now
  near the top. **Next undecided →** carries batch work. Restoring their place is not built.
- **The same unverified-lookup gap exists in Concept Headers' handlers** (`bDisposition.js:128-129`,
  `selfDeclare.js`). It is reported privately and left to its deferred fix, as is their panel's identical
  placement (`ConceptList.jsx:350` above `:397`).
- **Firmware reinstall required?** No.

### Seams for the Tester (additions)

- **The handler, through `deps`:**
  - a foreign `Origin` gets 403 before `requireAuth` is even called; a same-host `Origin` and a missing
    `Origin` both proceed;
  - a lookup that returns a forged signature (`verify` → false), another author, kind 9998, or a first `d`
    that differs from the URL each gets 409 with nothing signed, saved or imported, for both actions;
  - an `already` answer also requires verification.
- **The existing H tests' `request()` helper** passes `encodeURIComponent(handle)` as `req.params.handle`,
  which is the raw path, not what Express hands over. It must pass the *decoded* handle. That is a Phase 3
  re-aim, not an Implementer edit. Add a case where a d-tag containing `%41` is looked up exactly as given.
- **Structure:** `sameHost` is called before `requireAuth` in the handler body, and the module contains no
  `decodeURIComponent`.
- **Browser:** with 60 or more of the viewer's own Assistant's rows, clicking **Disposition…** on the last row
  leaves the panel's heading inside the viewport, and so does **Next undecided →** from there.
