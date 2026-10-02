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

## Amendment 1 (2026-10-01, review round 1)

Story 4's review (`engineering-team/reviews/list-headers-disposition/4-wire-on-my-assistant-rows.md`) found the Wire
target unbounded (blocking 1). The owner then decided, at that gate (2026-10-01):
- both recommended ride-alongs go in: the relay read-back, and comparing addresses by parts;
- Wire targets must be **list headers only**.

Everything above stands except where a rule below adds to it.

### What changes, and why

1. **The target is bounded (blocking 1).**
   - The relay rejects any tag value over 1024 bytes (`maxTagValSize = 1024` in the container's strfry config), and
     `strfry import` still exits 0 (`publishEvent.js:84`, `dlist-curation/update.js:311`).
   - So an unbounded target let the graph import a version the relay never stored, and the panel reported success.
   - `prepare` now requires, in this order:
     - `typeof req.body.target === 'string'`;
     - after trimming, no character in Unicode categories **Cc** (control) or **Cf** (format, such as an RTL override);
     - at most **1024 UTF-8 bytes**;
     - the list-header address form below.
2. **Targets are list headers (owner decision).**
   - The target must match `^39998:([0-9a-f]{64}):(.+)$` exactly. So the kind is the literal `39998`: `039998` and
     other kinds are refused.
   - A kind-9998 header has no `kind:pubkey:d-tag` address: it isn't replaceable and has no `d`. So "list headers
     only", for an address, means kind 39998.
   - Wiring to a 9998 header by event id stays out of scope, as it is on Concept Headers.
3. **The own-address check compares parts (owner ride-along).** The target is the header's own address when its
   pubkey equals the caller's Assistant pubkey **and** its d-tag equals the URL's d-tag. With the canonical-kind rule
   in 2, a leading-zero self-pointer is refused as "not a list header's address" before this check even runs.
4. **Read back from the relay before writing the graph (owner ride-along, all three actions).**
   - After `publishLocal(signed)`, the handler re-reads the event by id: `isStored(id)`.
   - **Stored:** it goes on to `importToGraph`, as before.
   - **Not stored:** it answers **502**,
     `"The relay didn't keep the new version, so nothing was saved"`, and does **not** touch the graph.
   - **The read itself fails:** it answers **502**,
     `"Sent to the relay, but couldn't confirm it was kept — the graph wasn't changed"`, and does not touch the graph.

   This is the read-back rule of `dlist-curation/update.js:309-326`, where a read that fails claims nothing. It
   applies to Submit, Keep private and Wire alike, because the silent-rejection gap was never specific to Wire.

### Implementation notes (additions)

**`src/api/list-headers/myAssistantDisposition.js`**

`prepare` for `b-append` becomes:

```js
prepare: (req, selfCoord, keys, dTag) => {
  const raw = req.body ? req.body.target : undefined;
  if (typeof raw !== 'string') return { error: NOT_A_LIST_HEADER };
  const target = raw.trim();
  if (/[\p{Cc}\p{Cf}]/u.test(target)) return { error: BAD_CHARACTERS };
  if (Buffer.byteLength(target, 'utf8') > MAX_TARGET_BYTES) return { error: TOO_LONG };
  const t = target.match(/^39998:([0-9a-f]{64}):(.+)$/);
  if (!t) return { error: NOT_A_LIST_HEADER };
  if (t[1] === keys.pubkey && t[2] === dTag) return { error: OWN_ADDRESS };
  return { target };
}
```

- **The messages are module constants:**
  - `MAX_TARGET_BYTES = 1024`;
  - `NOT_A_LIST_HEADER = "The target must be a list header's address (39998:pubkey:d-tag)"`;
  - `TOO_LONG = 'The target is too long — the relay keeps tag values of at most 1024 bytes'`;
  - `BAD_CHARACTERS = "The target contains characters an address can't have"`;
  - `OWN_ADDRESS`, the existing sentence.
- **Step 4b's call becomes** `spec.prepare(req, selfCoord, keys, dTag)`.
- **A new injected dependency,** `isStored(id)` → `true` / `false`, or a throw when the read fails. The default is
  `(await require('../concept/bDisposition').strfryScanStream({ ids: [id] })).some((e) => e && e.id === id)`.
- **Steps 8 and 9 become:**
  1. `await d.publishLocal(signed)`;
  2. `let stored; try { stored = await d.isStored(signed.id); } catch { return 502 couldn't-confirm }`;
  3. `if (!stored) return 502 not-kept`;
  4. then `await d.importToGraph(signed, selfCoord)` and the `done` answer.

  The two 502s carry no key and no event body.
- `classifyBValue` is no longer needed by the module. Remove its import if nothing else uses it.

**`ui/src/pages/lists/ListHeaderDispositionPanel.jsx`**
- The client-side check mirrors `prepare` in the same order, with the same sentences.
- The byte length uses `new TextEncoder().encode(t).length`.
- The own-address check compares `row.author` and the row's d-tag (from `row.routeId`'s third part) against the
  parsed target's pubkey and d.
- None of these four refusals sends a request.

**`src/lib/headerDispositionCompose.js`**
- `composeWire`'s guard returns
  `{ refused: "That's this header's own address — use Submit as a Shared Concept instead" }`, a sentence rather than
  `'self'` (the review's non-blocking 4). It still can't be reached through the handler.

### Consequences (additions)

- **The graph can't get ahead of the relay through these endpoints:** a version the relay didn't keep is never
  imported. The person sees a refusal, not "Saved here".
- **Wire refuses addresses of other kinds** (notes, list elements, profiles) that Concept Headers' Wire accepts.
  That's the owner's decision, and the panel says why.
- **Each re-sign costs one more relay read by id.** That's cheap: the local strfry, read by id.
- **The pick-list is unchanged.** Every Shared Concept it offers is already kind 39998
  (`useCommunitySharedConcepts.js`: `SELF_DECLARED_KINDS = [39998]`).
- **Firmware reinstall required?** No.

### Seams for the Tester (additions)

- **`deps()`** must inject `isStored`, "stored" unless a test says otherwise. The default reads strfry from the
  container path.
- **Handler cases:**
  - non-string targets (a number, an array, an object with a `toString`, `null`, a missing body);
  - a Cc character (NUL, ESC, TAB inside the address), and a Cf character (U+202E, U+200B);
  - exactly 1024 bytes, which passes the size check, and 1025 bytes, which is refused, including multibyte
    characters so bytes ≠ characters;
  - kind 1, kind 39999, `039998`, and kind 9998;
  - the own address, given with the same parts.

  Each is answered 400 before the lookup.
- **Read-back, for each of the three actions:**
  - not stored gives 502 with no `importToGraph`;
  - a throwing read gives 502 with no `importToGraph`;
  - stored gives the old success path.
- **Browser:** the panel's mirrored refusals (one per message), each with no request, plus a server 502 shown in
  the panel with the row unchanged.
