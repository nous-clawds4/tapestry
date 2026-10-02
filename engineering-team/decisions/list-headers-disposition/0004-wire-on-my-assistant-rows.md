# ADR 0004: Wire on My Assistant rows — a third action on ADR 0003's handler, a pure composeWire, and a pick-list fetched once per panel session

**Status:** Accepted
**Date:** 2026-10-01
**Story:** `engineering-team/stories/list-headers-disposition/4-wire-on-my-assistant-rows.md`

## Context

Story 4 adds **Wire to an external shared concept** to the List Headers panel, under story 3's rule. The design it
extends is ADR 0003 with its Amendment 1. That ADR is now accepted and shipped locally (`36f82e87`, PASS at
round 3).

**The handler**, `src/api/list-headers/myAssistantDisposition.js`, runs these steps:

| Step | What it does |
|---|---|
| 0 | `sameHost(req)` |
| 1 | `requireAuth` |
| 2 | the caller's own Assistant keys |
| 3 | parse the handle, which must be kind 39998 |
| 4 | the handle's pubkey must be the caller's Assistant |
| 5 | the latest header |
| 5b | that header must verify: author, kind, first `d`, signature |
| 6 | compose |
| 7–9 | sign with the caller's keys, then strfry, then the graph |

Each action is one entry in `ACTIONS` (`:31-34`): `{ compose(header, selfCoord), done, already }`.
`createMyAssistantDispositionHandler` refuses an unknown action when it is built.

**Concept Headers' Wire**, `handleBAppend`, `src/api/concept/bDisposition.js:151-178`, does this:
- **the target** is `(req.body.target || '').trim()`;
- **it refuses with 400** unless `classifyBValue(target) === 'a-tag'`;
- **it refuses with 400** when the target is the header's own address (`'the self-pointing b is self-declare's lane'`);
- **`already-wired`** when any b already has `t[1] === target`, whatever its type;
- **otherwise** the new tags are `[...stripSentinel(tags), ['b', target, 'pointer']]`;
- **it answers `wired`**, and the browser broadcasts with `outcomeMessage({ verb: 'wire' })`, whose fresh and already
  messages for all three outcomes already exist (`src/lib/broadcastOutcome.js`).

The owner decided (story 4) that a pasted target can be **any header address**, as there. No check that it is a known
Shared Concept.

**The body is parsed app-wide** (`bin/control-panel.js:121`, `express.json`), and the UI posts JSON. The same-host
check runs before anything reads the body.

**Concept Headers' panel** (`ui/src/components/DispositionPanel.jsx:18, 67-99`) draws the Wire section from
`useCommunitySharedConcepts()`:
- `rows === null` shows "Searching the community relay…";
- otherwise it lists one button per Shared Concept: its name, its description as `title`, and a click that puts its
  address in the field;
- the hook (`ui/src/hooks/useCommunitySharedConcepts.js`) reads kind-39998 self-declared headers from
  `wss://dcosl.brainstorm.world` **on every mount**.

The List Headers panel is keyed by row (ADR 0003), so **Next undecided →** remounts it. Kept inside the panel, the
hook would hit the public relay once per row: up to 168 times walking the Owner's Assistant's undecided rows on this
machine.

**Concepts.** `39998:<TA>:list` headers are re-signed, as in story 3. No concept, schema or firmware change.

## Options considered

### Option A — `b-append` as a third `ACTIONS` entry, the target checked before the lookup; `composeWire` in the shared module; the pick-list held by an unkeyed host

**Server**
- `ACTIONS['b-append']` reads and checks `req.body.target` as a new step **4b**, after the author check and before the
  lookup. A target that isn't a header address, or is the header's own address, is refused (400) without touching the
  relay.
- Composition is a new `composeWire(header, selfCoord, target)` beside the other two.
- Everything else, including 0, 5b and the verify-before-"already" rule, is unchanged and shared.

**UI**
- A `wireAndBroadcast(handle, target)` beside the other two actions.
- A Wire section in the panel that checks the target client-side before asking.
- The community list fetched by a small host component that stays mounted across **Next** and passes the rows down.

*Pros:*
- **One handler shape for all three actions,** so the rule can't diverge between them.
- **The tag rules stay in their one module,** pinned to Concept Headers' by a third parity test.
- **One relay read per panel session,** not per row.

*Cons:*
- The panel file gains a host component.

### Option B — a separate wire handler module

*Pros:* none that A lacks.

*Cons:* it would re-state steps 0–5b, the part of story 3 that took two review rounds to get right. Rejected.

### Option C — call `useCommunitySharedConcepts` inside the keyed panel, as Concept Headers does

*Pros:* the smallest diff.

*Cons:* a public-relay fetch for every row walked with **Next**, and the list flickers back to "Searching…" on each
one. Rejected for this page. Concept Headers keeps its own behaviour.

## Decision

We chose **Option A**. Wire becomes one more entry in the handler that already enforces the owner's rule, with its tag
rule in the shared module. The only new structure is the host that keeps the pick-list across **Next**.

## Consequences

- **All three actions now share one verified path,** and story 5 (**Me** rows) inherits `composeWire` with the other
  two.
- **The target is not checked to be a Shared Concept,** by the owner's decision. Any address passes except the
  header's own, including another of the caller's own Assistant's headers. That's the same as Concept Headers.
- **Target errors are answered before the relay is read,** so a typo costs no lookup. The verify step (5b) still runs
  before an `already-wired` answer, so the browser never re-broadcasts an unverified event.
- **The pick-list is fetched when the panel first opens,** kept while **Next** walks rows, and dropped when the panel
  closes. Reopening fetches again.
- **Firmware reinstall required?** No.

## Implementation notes

**`src/lib/headerDispositionCompose.js`**
- Add `composeWire(header, selfCoord, target)`:
  - when the target equals `selfCoord`, return `{ refused: 'self' }` (a guard; the handler refuses earlier);
  - when some tag has `t[0] === 'b' && t[1] === target`, return `{ already: true }`;
  - otherwise return `{ tags: [...stripSentinel(tags), ['b', target, 'pointer']] }`.
- It doesn't mutate its input. Export it.

**`src/api/list-headers/myAssistantDisposition.js`**
- **The route.** `ROUTES['b-append'] = '/api/list-headers/my-assistant/:handle/b-append'`.
- **The action.** `ACTIONS['b-append'] = { prepare, compose, done: 'wired', already: 'already-wired' }`.
- **`prepare(req, selfCoord)`** returns the input or the refusal:
  - `{ target: String((req.body && req.body.target) || '').trim() }` normally;
  - `{ error: 'The target must be a header address (kind:pubkey:d-tag)' }` unless `classifyBValue(target) === 'a-tag'`
    (from `../../lib/bValueForms`);
  - `{ error: "That's this header's own address — use Submit as a Shared Concept instead" }` when it equals
    `selfCoord`.
- **`compose(header, selfCoord, input)`** is `composeWire(header, selfCoord, input.target)`.
- **The two existing actions** gain no `prepare`, and their compose ignores the third argument.
- **Step 4b, in the handler:** after the author check and before the lookup,
  `const prep = spec.prepare ? spec.prepare(req, selfCoord) : {}`. `prep.error` answers
  400 `{ success: false, error: prep.error }`. Compose is then called as `spec.compose(header, selfCoord, prep)`.
- `register(app)` now mounts three routes.

**`ui/src/utils/myAssistantDisposition.js`**
- Add `wireAndBroadcast(handle, target)`:
  - POST `{ target }` to `…/b-append`;
  - then `publishToRelays(data.event, CONCEPT_PUBLISH_RELAYS)`;
  - return `{ message: outcomeMessage({ outcome: classifyBroadcast(result), verb: 'wire', already: data.result === 'already-wired' }), event: data.event }`.
- `postDisposition` gains an optional body.

**`ui/src/pages/lists/ListHeaderDispositionPanel.jsx`**
- **A named export, `ListHeaderDispositionHost`.**
  - It calls `useCommunitySharedConcepts()` once and renders
    `<ListHeaderDispositionPanel key={row.routeId} {...props} communityRows={rows} />`.
  - `Index.jsx` renders the host where it now renders the panel, with no `key` on the host. The host passes the key
    to the panel, so **Next** still resets the panel's state while the list survives.
- **The panel takes `communityRows` and renders the Wire section** below the two buttons, while `!acted`. It is
  modelled on `DispositionPanel.jsx:67-99`:
  - the label **🔗 …or wire to an external shared concept**;
  - a text input (placeholder `kind:pubkey:d-tag — pick below or paste`);
  - a **Wire** button, disabled when `busy` or the trimmed field is empty;
  - **"Searching the community relay…"** while `communityRows === null`;
  - otherwise one button per row: `title = description || address`, the label `name || address`, and
    `onClick = setTarget(address)`.
- **Clicking Wire** with an empty field does nothing. Otherwise it checks client-side first, using `classifyBValue`
  from `ui/src/utils/bDisposition.js`, and shows the same two sentences as the server, *without a request*:
  - a target that isn't an address gets `"The target must be a header address (kind:pubkey:d-tag)"`;
  - `row.routeId` gets the own-address sentence.

  Otherwise it runs `wireAndBroadcast(row.routeId, target)` through the existing `run`.
- **`Index.jsx`:** swap the panel element for `ListHeaderDispositionHost`, with the same props, and no other change.

**Seams for the Tester** (Phase 3 decides the suites)
- **Composition:** the `composeWire` cases, plus a third parity test against `handleBAppend`, in the same child
  harness. Its stub request carries a `body`, so the target can be supplied there. Cases:
  - undecided;
  - the marker only;
  - the marker and a wiring;
  - already wired to the target, with any b type;
  - wired to another target;
  - self-declared.
- **The handler through `deps`:**
  - `b-append` passes every story-3 refusal: H13's foreign Origin, H1/H2's no session, H3, H4, H5, H6 and H14's
    verification;
  - **step 4b** refuses (400) a non-address, an empty target, or the header's own address, before `scanLatest` is
    called;
  - **`wired`:** the right key, the tags, and the order of sign, relay, graph;
  - **`already-wired`**, which still verifies first;
  - **a second target keeps both.**
- **S3 now expects three routes.** That is a Phase 3 re-aim.
- **Browser:** M1–M11 stand. The WebSocket mock must answer a `REQ` for kind 39998 with fixture Shared Concepts and
  `EOSE`, so the pick-list fills. New cases:
  - the Wire section and the "Searching…" state;
  - picking fills the field;
  - Wire, with the outcomes;
  - already wired;
  - a second target;
  - the client-side refusals, which make no request;
  - **Next** keeps the list without a second `REQ`.

## Out of scope

- Checking a target against known Shared Concepts (the owner's decision).
- **Me** rows (story 5).
- Changing Concept Headers' panel or `useCommunitySharedConcepts`.
