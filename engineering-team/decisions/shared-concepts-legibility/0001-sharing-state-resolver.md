# ADR 0001: Resolve a concept's sharing state server-side, from two stores

**Status:** Accepted
**Date:** 2026-08-09
**Story:** `engineering-team/stories/shared-concepts-legibility/1-state-on-concept-page.md`

## Context

The concept page must show, before any click, whether a concept has been shared — where the owner
ruled that **"shared" means published to a public relay; declared locally is not enough**. That
ruling produces four display states plus an honest failure state, and the failure state is the one
that constrains the design: *a relay check that could not run must never render as "not shared."*

**What exists.**

- `ui/src/pages/concepts/ConceptDetail.jsx:13` runs one Cypher read for name / author / element
  count. It never reads affiliation markers, and its "Submit as a Shared Concept" button
  (`:189–198`) fires immediately — no confirmation surface, no state.
- `src/lib/bValueForms.js:37` already owns the classification: `dispositionOf(bValues, selfCoord)` →
  `{ wired, selfDeclared, deferred }`. `ui/src/utils/bDisposition.js` is its UI mirror, pinned
  byte-identical by a structural test. **No new classification logic is needed.**
- `POST /api/concept/:handle/self-declare` (`src/api/concept/selfDeclare.js`) decides idempotency by
  scanning **strfry** for `{kinds:[kind], authors:[TA], '#d':[dTag]}` and checking for a
  self-pointing b. It is owner-gated (`isOwner || localTrusted`) and refuses headers authored by
  anyone but this instance's TA (`:75`).
- `GET /api/relay/external` (`src/api/relay/fetchEvents.js`) proxies an arbitrary nostr filter to
  named relays via `SimplePool`, and **already distinguishes failure from emptiness**: a timeout
  returns `{success:false, error}` while a clean miss returns `{success:true, events:[]}`.

**The binding constraint.** The client wrapper `fetchFromRelays`
(`ui/src/utils/nostrPublish.js:26`) collapses that distinction — it returns `[]` both when the relay
answers "nothing" and when the fetch throws or reports failure. **A page built on it cannot satisfy
the story's fourth criterion.** The wrapper has **eight client call sites**
(`useCommunitySharedConcepts`, `useProfileActions`, `publishTagPin`, and four shared-concepts
pages), so changing its return shape is a wide blast radius for one page's need.

**Concepts.** Verified live against `/api/concept-graph/summaries` (62 summaries):

- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:shared-concept` — **shared
  concept**
- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:concept-header` — **concept
  header**

Both handles carry *this machine's* TA. Per the house rule they are illustrative only — the
implementation resolves the TA at runtime via `getOwnerAssistantPubkey()` server-side and
`useConfig().taPubkey` client-side. No concept definition changes.

## Options considered

### Option A — client hook with a strict relay helper

Add `fetchFromRelaysStrict` (or inline the `/api/relay/external` call) in a `useSharingState` hook;
read local markers by extending ConceptDetail's existing Cypher with the `HAS_TAG {type:'b'}`
pattern from `ConceptList.jsx:26`.

*Pros:* no server change; local markers ride the query the page already makes, so they cost nothing.
*Cons:* the two-part published rule lands in a React hook, testable only through the UI; a second
relay-fetch idiom appears alongside `fetchFromRelays`, inviting the next author to pick the wrong
one; the epic's next story (`mine-only-self-declared`) needs the same answer in bulk and would have
to reimplement it.

### Option B — server resolver endpoint over a pure lib *(chosen)*

`GET /api/concept/:handle/sharing-state` resolves the whole state and returns it. The rule lives in
a pure, zero-require `src/lib/sharingState.js`; the endpoint supplies the two stores' events.

*Pros:* matches the suite's established shape — `src/lib/adoptionQueue.js` and
`src/lib/trustedDictionary.js` are pure cores behind thin endpoints, unit-testable without a
browser; the badge reads the **same store the action reads**, so it cannot lie about what the button
will do; generalizes to the bulk case the next story needs.
*Cons:* a new endpoint and a second round trip beside the page's existing Cypher.

### Option C — widen `fetchFromRelays` to a tri-state return

*Pros:* fixes the swallow for everyone.
*Cons:* eight call sites, none of which asked for it, all of which currently rely on `[]`-on-failure.
A refactor of that reach does not belong inside a display story. Noted as a follow-up instead.

## Decision

We chose **Option B**.

The deciding argument is not layering taste, it is **agreement between the badge and the button**.
`self-declare` determines idempotency from strfry; if the badge derived "already shared" from a
different store, the two could disagree and the button's label would be wrong — the exact defect
this story exists to remove.

That yields a pleasing symmetry: both halves of the answer are the *same test applied to two
stores*.

| Question | Store | Test |
|---|---|---|
| Declared here? | local strfry | does this instance's copy carry a b-tag equal to its own coordinate? |
| Shared? | `wss://dcosl.brainstorm.world` | does the relay's copy carry a b-tag equal to its own coordinate? |

One predicate, `carriesSelfPointer(event, coord)`, answers both.

**Reading local state from strfry rather than Neo4j does not contradict invariant 4.** A b-tag is a
property of a signed event, and events are the proof axis; the graph is definitive for identity and
structure, which is not what is being asked here. (`ConceptList` derives the same chips from Neo4j
`HAS_TAG` — the two should agree, and a divergence is a real defect. Noted as a follow-up, not
resolved here.)

**Always query the relay, including when no local marker exists.** It costs the same single call,
keeps the rule uniform, and doubles as a divergence detector: a relay copy that is declared while
the local copy is not is precisely the local-state-loss case invariant 4 cares about.

## Consequences

- **Enables** an honest tri-state. `published: true | false | null` — with `null` meaning *not
  checked*, never *not shared*.
- **Enables** the next story: `mine-only-self-declared` wants "which of my declarations reached the
  community?" for many concepts. The resolver is single-coordinate now but its pure core takes
  events, so a bulk caller is an extension rather than a rewrite.
- **Constrains:** every concept-page load now makes one relay round trip through the proxy. Bounded
  by `FETCH_TIMEOUT_MS` and asynchronous to first paint — the page must render its existing content
  without waiting. If this proves slow, cache; do not silently skip the check.
- **Debt created:** (1) `fetchFromRelays`'s failure-swallow remains for its eight callers —
  Option C, deferred; (2) the strfry/Neo4j b-tag agreement is assumed, not asserted; (3) the relay
  constant is hardwired a fifth time — the story already scopes concept-graph-sourced relays out,
  and this ADR adds one more call site to that eventual sweep.
- **Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

**New — `src/lib/sharingState.js`** (pure, zero-require, the `adoptionQueue.js` idiom):

- `carriesSelfPointer(event, coord)` → boolean. True when the event has a `b` tag whose value,
  trimmed, equals `coord`. Third tag elements (`'pointer'`) are ignored — see the live wire form
  `["b", "39998:…:bengal-cat", "pointer"]`.
- `resolveSharingState({ localEvent, relayEvent, relayOk, coord })` → the response body below.
  Local classification delegates to `dispositionOf` from `src/lib/bValueForms.js` — do not
  reimplement it. `wiredTo` is the b values that classify as `a-tag`/`event-id` and are **not** the
  self coordinate.
- `published`: `relayOk === false` → `null`; else `relayEvent && carriesSelfPointer(relayEvent, coord)`.

**New — `src/api/concept/sharingState.js`**, registered in `src/api/index.js` beside the existing
`/api/concept/:handle/...` routes:

- `GET /api/concept/:handle/sharing-state` — **public read** (matches `/api/adoption-queue` and
  `/api/trusted-dictionary`; this reveals nothing an observer could not read off the relay). Note
  this differs deliberately from `self-declare`'s owner gate, which guards a *write*.
- Parse with the same `HANDLE_RE` as `selfDeclare.js:32`; 400 on a malformed handle.
- Local read: the `strfryScan` helper pattern from `selfDeclare.js:34`, filter
  `{kinds:[kind], authors:[pubkey], '#d':[dTag]}`, newest by `created_at`. Use the handle's own
  pubkey — **not** the TA — so the endpoint answers for any header; the TA restriction belongs to
  the write path.
- Relay read: the same filter against `wss://dcosl.brainstorm.world` through the `SimplePool` path
  `src/api/relay/fetchEvents.js` uses. Preserve the failure/emptiness distinction into `relayOk`.
- Response: `{ success, handle, local: { wired, selfDeclared, deferred, wiredTo }, published, relay, relayError }`.

**Changed — `ui/src/pages/concepts/ConceptDetail.jsx`:**

- New hook `ui/src/hooks/useSharingState.js` → `{ state, loading, refresh }`, fetching the endpoint.
  Render the page's existing content immediately; the badge resolves independently.
- Badge beside the existing `.concept-meta` items:

  | Resolved state | Badge |
  |---|---|
  | `published === null` | ⏳ Sharing state unconfirmed — could not reach the community relay |
  | `selfDeclared && published` | 🤝 Shared with the community |
  | `selfDeclared && !published` | ⚠️ Declared here — not yet on the community relay |
  | `!selfDeclared && !published` | Not yet shared |
  | `wired` | 🔗 Wired to \<name-or-coord\> |
  | `deferred` (alone) | 🔒 Kept private |

  Wired and self-declared **co-occur** — render every affiliation, do not switch on the first match.
  Link each `wiredTo` coordinate to `/tapestry/shared-concepts/header/:coord` (the story-9 raw-event
  route) so it is followable.
- Button label from state: `published === true` → **"Re-submit to the community"**; otherwise
  unchanged.
- Confirmation: reuse `ui/src/components/ConfirmDialog.jsx` — `{open, title, message, onConfirm,
  onCancel}`, already styled. Gate it on `published === true` only; a first-time submit stays
  one click. Message must carry both facts the owner named: this concept has already been
  submitted, and re-submitting is typically unnecessary.
- On a successful submit, call `refresh()` — no page reload.

**Not to be touched:** `fetchFromRelays`, `dispositionOf`, `bDisposition.js`, and the three
disposition endpoints. This story is read-and-display; the write path is already correct.

## Out of scope

- **Bulk resolution** — designed for, not built. `mine-only-self-declared`'s story.
- **Widening `fetchFromRelays`** (Option C) and its eight callers.
- **Asserting strfry/Neo4j b-tag agreement** — assumed here; a divergence is a separate defect.
- **Concept-graph-sourced relay sets** — scoped out by the story; this adds one call site to it.
- **Caching the relay check** — measure first.
- **The button rendering for non-owners and on other instances' headers** — carried forward by the
  story, uncovered by any criterion here.
