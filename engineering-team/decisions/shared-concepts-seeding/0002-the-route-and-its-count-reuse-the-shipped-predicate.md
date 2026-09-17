# ADR 0002: The route carries its state in the address, and its count reuses the shipped predicate

**Status:** Accepted
**Date:** 2026-08-11
**Story:** `engineering-team/stories/shared-concepts-seeding/4-share-from-shared-by-me.md`

## Context

Story #4 needs two things that look like one: a route from **Shared by me** to the not-yet-shared
concepts, and a destination that **arrives already narrowed**. The story is explicit that the second
is the substance — a bare anchor would land the owner on all 42 concepts with a control to find and
set herself.

### Why the destination cannot arrive narrowed today

`ConceptList` holds its filter in local component state (`ConceptList.jsx:70`,
`useState('')`). Nothing outside the component can set it, and it resets on every visit. ADR 0001
put *"Persisting the filter selection across navigation"* out of scope (`0001:199`) — a deferral, not
a decision against. **This ADR takes up what 0001 deferred.**

The mechanism is already house-standard: `react-router-dom` ^7.13.1, and `useSearchParams` is in use
on five pages (`BTagDetail.jsx`, `BrainstormProfile.jsx`, `AddNodeReview.jsx`, `brain/Rationale.jsx`,
`Tag.jsx`).

### What a count would cost, measured

`SharedByMe` fetches exactly one thing: `/api/shared-by-me` (`SharedByMe.jsx:40`). That answer
contains only **declared** concepts, so the page knows what *has* been put forward and nothing about
the wider population. A count of what has **not** been shared needs that population too.

But the gap is narrower than it appears. The page already holds the publication half — `coord →
published`, tri-state — which is the expensive half (a relay round trip). What it lacks is the cheap
half: the list of concept headers with their author and b-tag values. `useCypher(query, deps)`
(`ui/src/hooks/useCypher.js`) is a generic hook, so that is one small query, not a new endpoint.

### The constraint that decides the shape

Story #3 shipped `matchesState(row, state, ctx)` in `ui/src/utils/conceptStateFilter.js` — pure,
dependency-free, already the single definition of *not yet shared*. Any count computed by other means
would be a **second implementation of the same question**, free to drift from the list it advertises.
The story's whole lineage is about two surfaces not being able to contradict each other.

## Options considered

### Option A — `?state=` in the address, and a count from the shipped predicate

Two independent pieces:

1. **`ConceptList` reads and writes its state filter through `useSearchParams`.** The URL is the
   source of truth; changing the control rewrites it with `replace: true` so the dropdown does not
   spam browser history. An unrecognised value falls back to *All states* rather than rendering an
   empty page.
2. **`SharedByMe` gains one small Cypher** (headers: `uuid`, `author`, `bValues`) via `useCypher`,
   derives `_disp` with the existing `dispositionOf`, and counts with
   `matchesState(row, 'not-yet-shared', ctx)` — the *same function* the destination filters with,
   fed the publication map the page already has.

**Pros:** the count and the list it points at cannot disagree, because they are one function over
the same inputs — the same "true by construction" property that decided ADR 0001. Reuses two pure
utils already shipped and already tested. No server change, no new endpoint, no new dependency.
Bookmarkable and refresh-safe; back/forward behave. Answers AC-5, because the page now knows whether
the number is zero.

**Cons:** `SharedByMe` grows from one data source to two, which is a real cost on a page whose
present virtue is that it needs one. The Cypher is a second failure mode to handle honestly.

### Option B — the route with no count

**Pros:** the smallest possible change; `SharedByMe` keeps its single source.

**Cons:** AC-5 becomes unsatisfiable as written. Without knowing whether the number is zero, the page
cannot tell "33 waiting" from "you're done", so at the owner's stated goal state it would still
present an errand with nothing in it. The story anticipated this and made the count and AC-5 one
decision.

### Option C — a server endpoint returning the not-yet-shared count

**Pros:** one fetch; `SharedByMe` stays thin.

**Cons:** puts the definition of *not yet shared* in a second home, on the server, where it can drift
from the UI predicate that renders the list. ADR 0001 rejected the same shape for the same reason,
and `sharedByMe.js:23-25` records that sharing state was deliberately consolidated to one home.

### Option D — carry the filter in router state rather than the address

`navigate('/tapestry/concepts', { state: { stateFilter: 'not-yet-shared' } })`.

**Cons:** invisible to the address bar, so it does not survive a refresh, cannot be bookmarked or
shared, and back/forward behave inconsistently. It would satisfy AC-2 on the happy path and quietly
fail it the moment the owner reloads.

## Decision

We chose **Option A**.

The deciding argument is the same one that decided ADR 0001: a number advertising a list must not be
able to disagree with it. Computing the count with `matchesState` — the exact function the
destination filters with — makes agreement structural rather than a property two implementations
happen to share on the day they ship. Options B and C both give that up, B by having no number and C
by computing it somewhere else.

The second cost is accepted deliberately: `SharedByMe` becomes a two-source page. That is a genuine
loss, and it is worth it only because the second source is cheap (one small graph read, no relay
trip) and because the alternative is a page that cannot tell success from work-in-progress.

### Honesty rules for the count — the part most likely to be got wrong

**Zero is a claim of completion.** It says "you have shared everything", which is exactly the class
of statement this book exists to stop the product making carelessly. So:

1. **Cypher fails** → the population is unknown → show the route **with no number**. Never show `0`,
   never guess. The route is still useful; the claim is what must be withheld.
2. **Relay unreachable** (`relayOk === false`) → publication is unknown for declared concepts, and
   story #3's predicate withholds them, so any number computed here is a **lower bound**. Show the
   route **with no number** and let the destination — which already renders a withheld-count notice —
   explain. A number that silently undercounts reads as "you are closer to done than you are".
3. **Both sources good** → show the number.
4. **Number is genuinely zero** → do not render an errand. Say the backlog is clear (AC-5).

## Consequences

- **Enables** the book's first frame bullet, closing `shared-concepts-seeding` at 3 of 3.
- **Enables, incidentally,** every Concepts-list state becoming linkable — `?state=wired`,
  `?state=shared` and so on all work once the address is the source of truth. Not a goal; a
  side effect worth knowing, since other surfaces may want to link in later.
- **Constrains:** `SharedByMe` now depends on the graph as well as `/api/shared-by-me`. If the
  Concepts list's state vocabulary changes, both the URL contract and this count follow it — which
  is the intended coupling, since `STATES` (`conceptStateFilter.js:31`) is their shared definition.
- **Follow-up not taken:** the address now carries filter state, so a future story could make the
  author filter linkable the same way. Out of scope here.
- **Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

No server change. Two UI files plus the tests.

- **File: `ui/src/pages/concepts/ConceptList.jsx`**
  - Replace the local `stateFilter` state (`:70`) with `useSearchParams`-backed state. Read
    `?state=` on mount and on change; validate against `STATES` ids (`conceptStateFilter.js:31`) and
    fall back to *All states* on anything unrecognised — never render an empty page because of a
    typo'd link.
  - Write the param on selection with `{ replace: true }`. Omit the param entirely for the default
    (*All states*) rather than writing `?state=all`, so ordinary visits keep a clean address.
  - Nothing else about the filter changes — the predicate, the lazy publication fetch, and the three
    failure tiers are all untouched.
- **File: `ui/src/pages/shared-concepts/SharedByMe.jsx`**
  - Add one `useCypher` query returning concept headers with `uuid`, `author`, `bValues`. Keep it
    minimal — this page needs no counts, no schema joins, none of `ConceptList`'s aggregation.
  - Derive `_disp` per row with `dispositionOf` (`ui/src/utils/bDisposition.js`), build the
    `coord → published` map from the data already fetched, and count with
    `matchesState(row, 'not-yet-shared', { taPubkey, publishedByCoord, relayOk })`.
  - Render the route beneath the existing "N shared" line (`:113`), applying the four honesty rules
    above. The page is a report, not a prompt — this is a line, not a call-to-action banner.
  - Update `emptyMessage` (`:120`) so a first-time owner is pointed at this route rather than at the
    concept page (AC-4).
- **Do not** re-implement the state predicate, the disposition derivation, or the tri-state
  publication rule. All three have exactly one home and this page consumes them.

## Out of scope

- Any change to `/api/shared-by-me`, `src/lib/sharingState.js`, `conceptStateFilter.js`'s predicate,
  or what *not yet shared* means.
- Hosting the list or the share action on Shared by me (story: rejected).
- Bulk share.
- Making the Concepts list's **author** filter linkable.
