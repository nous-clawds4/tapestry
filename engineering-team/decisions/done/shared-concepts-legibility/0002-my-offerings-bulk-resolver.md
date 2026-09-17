# ADR 0002: My offerings — a bulk resolver and a view of its own

**Status:** Accepted
**Date:** 2026-08-09
**Story:** `engineering-team/stories/shared-concepts-legibility/2-mine-only-self-declared.md`

## Context

The story asks for one place listing **every** concept this instance has offered, including any that
never reached the community relay. Completeness is the page's whole promise, which makes the failure
modes the design driver — a list that is quietly short is worse than the eyeball-scan it replaces.

**What exists.**

- `ui/src/pages/shared-concepts/SelfDeclaredSharedConcepts.jsx` lists **everyone's** declarations,
  sourced from `useCommunitySharedConcepts` (`ui/src/hooks/useCommunitySharedConcepts.js:46`), which
  pulls **every** kind-39998 off the relay and filters client-side. Measured today: 359 events to
  render a handful of rows.
- ADR 0001 shipped the single-coordinate answer: `GET /api/concept/:handle/sharing-state` over the
  pure core `src/lib/sharingState.js` (`carriesSelfPointer`, `resolveSharingState`), with
  classification applied at the handler seam. Its Consequences anticipated this story: *"the
  resolver is single-coordinate now but its pure core takes events, so a bulk caller is an extension
  rather than a rewrite."*
- Story 1's review left a non-blocking finding: the handler's local read swallows failure
  (`src/api/concept/sharingState.js:101`) where the relay read tri-states it.

**The measurement that shapes this.** At planning time this instance had **4** self-declared headers
in local strfry and **3** of them on `wss://dcosl.brainstorm.world`. The divergence is live, not
theoretical.

**Constraint — N calls will not do.** Reusing the single-coordinate endpoint per row costs N strfry
scans plus N relay round trips. Both stores can answer for *all* of one author's headers in one
query each, so the bulk shape is 2 queries regardless of N.

**Concepts.** Verified against `/api/concept-graph/summaries` (62 summaries):
`39998:11f23fe4…:shared-concept` and `39998:11f23fe4…:concept-header`. Illustrative only — "mine" is
the TA pubkey (BIBLE §31), resolved at runtime; three different values are in play across the
dev/staging/prod instances this session. No concept definitions change.

## Options considered

### Option A — client-side, N calls to the story-1 endpoint

Fetch my headers, then call `/sharing-state` once per self-declared coordinate.

*Pros:* zero new server code; reuses a shipped, tested endpoint verbatim.
*Cons:* N strfry scans and N relay round trips for a page whose row count grows with the instance's
ambition. Each `strfry scan` is a process spawn. Rejected on cost, not on taste.

### Option B — bulk endpoint over the same pure core *(chosen)*

`GET /api/my-offerings` runs one local scan and one relay query for `authors:[TA]`, then resolves
each row through the existing `resolveSharingState`.

*Pros:* 2 queries regardless of N; reuses the pure core and the seam idiom exactly as ADR 0001
predicted; the completeness rule lives server-side where it can be tested without a browser.
*Cons:* a second endpoint whose local/relay join must stay consistent with the single-coordinate one.

### Option C — widen the story-1 endpoint to accept many handles

`GET /api/concept/sharing-state?handles=a,b,c`.

*Pros:* one endpoint for both shapes.
*Cons:* the caller must already know its handles, so the page would still need a prior scan to find
them — the bulk case's actual question is *"which are mine?"*, which a handle list presupposes. It
would also collide with the `:handle` path param. Rejected as the wrong question.

## Decision

We chose **Option B**.

### The failure modes are asymmetric, and this time deliberately so

Story 1's review flagged that its handler tri-states the relay read but swallows the local one. Here
that asymmetry gets decided rather than inherited, and it lands in the same place — for a reason:

| Store fails | What we still know | Response |
|---|---|---|
| **Relay** unreachable | the complete local list — only *publication* is unknown | rows render, `published: null` per row, page says publication is unconfirmed |
| **Local** scan fails | nothing at all — the row set itself is unknown | **non-200**; the page shows an error, never an empty list |

The distinction is that a relay failure leaves a *useful partial answer* while a local failure leaves
*no answer*. Rendering an empty list on a local failure would assert "you have offered nothing" — the
page's promise is completeness, so that is the one lie it must never tell. **This does not fix
story-1's finding**, which stands as recorded against its own handler; it declines to reproduce it.

### One view, not a toggle

The existing directory answers *"what has the community offered?"* from the relay. This story answers
*"what have I offered?"* from two stores, and its rows include a state — declared-but-not-sent — that
cannot exist in the community view at all. Different question, different sources, different columns.
Folding both behind a toggle would give one page two contracts, which is the confusion this book
exists to remove. A sibling route keeps each page's contract legible and satisfies the story's
requirement that the directory survive.

## Consequences

- **Enables** the book's second frame bullet, and delivers the third on this surface: the page states
  which store each claim comes from.
- **Cheaper than the page it sits beside.** The relay query is bounded by *my own* authored headers
  (111 today) rather than every author's (359), because it can filter `authors:[TA]` server-side.
  Relay filters cannot express "has a b tag", so the self-pointer test still happens after the fetch
   — but on a set bounded by my own authorship.
- **Constrains:** two endpoints now compute sharing state. They share the pure core, but the
  local/relay join is written twice. A structural test should pin that both use
  `resolveSharingState` rather than re-deriving `published`.
- **Debt:** (1) `useCommunitySharedConcepts`'s fetch-everything remains for the community directory —
  untouched here; (2) the relay constant is hardwired a sixth time; (3) rows link to the concept
  page, which renders blank when the concept is absent from Neo4j — pre-existing, observed during
  story 1 (`cat` on staging), and reachable from here whenever a declared header has no graph node.
- **Firmware reinstall required?** **No.**

## Implementation notes

**New — `src/api/concept/myOfferings.js`**, registered in `src/api/index.js` beside the story-1 route:

- `GET /api/my-offerings` — **public read**, matching `/sharing-state` and the other read endpoints.
- Resolve the TA with `getOwnerAssistantPubkey()` (`src/utils/assistantKeys.js`); 500 if unavailable.
- Local: `strfryScan({kinds:[39998], authors:[TA]})` — the `selfDeclare.js:34` helper pattern. Newest
  per coordinate. **On throw, return non-200** — do not degrade to an empty list.
- Relay: the same filter against `wss://dcosl.brainstorm.world` via the `SimplePool` path
  `src/api/relay/fetchEvents.js` uses; preserve failure-vs-emptiness into `relayOk`/`relayError`.
- Rows: every local header where `carriesSelfPointer(ev, coord)` is true. For each, call
  `resolveSharingState({coord, disposition, wiredTo, relayEvent, relayOk})` with `disposition` and
  `wiredTo` built at the seam from `dispositionOf`/`classifyBValue` — **the same composition as
  `sharingState.js:107–119`; do not re-derive `published` locally.**
- Display fields come from the local event's tags (`names[1]`, `description`) — no Neo4j read, so a
  declared header with no graph node still lists.
- Response: `{ success, ta, relay, relayOk, relayError, offerings: [{ coord, name, description, declaredAt, published }] }`
  where `published` is `true|false|null`. Sort newest-declared first.

**New — `ui/src/pages/shared-concepts/MyOfferings.jsx`** + route `shared-concepts/mine` in
`ui/src/App.jsx`, nav entry in `ui/src/components/Layout.jsx` under the Shared Concepts section.

- Suggested nav label **"My Offerings"** — verb-anchored, per the rule the Registry rename set. The
  `shared-concept-vocabulary` story may revisit it; flagging rather than pre-empting.
- Per-row state, reusing story 1's wording so the two surfaces agree: `🤝 Shared` /
  `⚠️ Declared here — not yet sent` / `⏳ Unconfirmed` when `published === null`.
- When `relayOk` is false, a page-level line stating publication could not be confirmed — the
  per-row `⏳` alone would read as a per-concept quirk rather than one failed check.
- Rows link to `/tapestry/concepts/<coord>` — where story 1 put the state badge and the
  submit/re-submit affordance. That satisfies the story's final criterion without a second action.
- Empty state must distinguish "you have not offered anything yet" from an error.

**Not to be touched:** `useCommunitySharedConcepts`, `SelfDeclaredSharedConcepts.jsx`,
`src/api/concept/sharingState.js`, `src/lib/sharingState.js`, and every write path.

## Out of scope

- **Fixing story-1's local-read swallow** — recorded there, declined-to-reproduce here.
- **Retiring `useCommunitySharedConcepts`'s fetch-everything** — the community directory keeps it.
- **Concept-graph-sourced relay sets** — one more call site for that sweep.
- **Listing adopted (wired) concepts** — story Open question 1: offerings only.
- **A send action on this page** — story Open question 2: route to the concept page.
- **Caching the relay query** — measure first.
