# ADR 0003: My-Assistant disposition — session-bound endpoints that sign only with the caller's own Assistant, and a List Headers panel

**Status:** Accepted
**Date:** 2026-10-01
**Story:** `engineering-team/stories/list-headers-disposition/3-disposition-on-my-assistant-rows.md`

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
