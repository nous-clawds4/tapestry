# ADR 0003: Scannable presence panel — status-light summary and disclosure

**Status:** Accepted
**Date:** 2026-09-07
**Story:** `engineering-team/stories/treasure-map-relay-presence/3-scannable-presence-panel.md`

## Context

Presentation-only. No new endpoint, no new data, no change to what any row means.

The five criteria: collapsed by default and openable; the closed summary names the most serious
finding by a fixed precedence rather than counting; a differing version's creation time is visible
without hovering; no summary is asserted while the check is still running; nothing already working
is disturbed.

### What exists

- `ui/src/pages/grapevine/TreasureMapRelayPresence.jsx:133-140` computes today's summary inline:
  `${holding + (inLocal ? 1 : 0)} of ${targets.length + 1} hold a copy`. It is a coverage count —
  precisely what the story rejects — and it lives in JSX, so it is unreachable from a test.
- `describe()` (`:44-70`) already computes the differing version's timestamp via `whenText()` and
  passes it as `detail`, which the row renders **only** as `title={detail}` (`:290`). The data the
  story wants visible is already computed; it is the rendering that hides it.
- The Map's own creation time is `new Date(event.created_at * 1000).toLocaleString()`
  (`TrustedAssertions.jsx:185`), and `whenText()` already uses the same call — so "the same form as
  the Map's own creation time" needs no new formatter.
- **The disclosure idiom is settled on this page**: `const [open, setOpen] = useState(false)` plus a
  `{open ? '▾' : '▸'}`-prefixed control — `TreasureMapManualEdit.jsx:22,63` (the closest sibling,
  also default-closed), `TlOptInCard.jsx:123`, `TrustedAssertions.jsx:214`.
- The epic's three previous pure helpers all live in `ui/src/utils/treasureMap.js` and are
  ESM-imported directly by the suites: `buildPresenceTargets`, `compareMapVersions`,
  `planRelaySync`.

### The one genuinely non-obvious question

AC-2 fixes the precedence (divergent → missing → unreachable → ok) and AC-4 forbids asserting a
summary while relays are still answering. These interact, and the interaction is not decided by
either criterion on its own: **what should the summary say when one relay has already come back
divergent and three are still pending?**

Reading AC-4 literally — "still checking" beats everything — would suppress the single most
important finding for as long as the slowest relay takes, which on a dead relay is ~10s. That
inverts the story's whole point.

The resolution turns on what AC-4 actually prohibits: *an all-clear* and *a count that is about to
change*. A divergence is neither. It is already true, it is already actionable, and it cannot be
revoked by a later answer — no relay reporting in can make an existing divergence go away. A
count of missing relays **can** change (3 missing may become 2), and an all-clear obviously can,
which is why both must wait.

## Options considered

### Option A — A pure `summarizePresence()` beside the epic's other helpers; local collapse state

`summarizePresence(localEvent, rowStates)` in `ui/src/utils/treasureMap.js` returns a level, the
counts behind it, and no formatting. The panel holds `useState(false)` for the disclosure and
renders the level. The timestamp moves from `title` into visible text in the status cell.

- **Pros.** The precedence rule — the entire substance of this story — becomes a pure function
  testable without React, matching how the epic's other three helpers are tested. The disclosure
  reuses the page's established idiom rather than inventing one. The timestamp change is a
  render-site edit, since the value is already computed.
- **Cons.** One more export on a util module that now has five. The component must map level →
  wording/colour, so copy still lives in JSX (deliberate: wording is presentation, precedence is
  logic, and only the latter needs pinning).

### Option B — Compute the summary inline in the component

Keep it where it is, just change the text and add the precedence branches.

- **Pros.** Smallest diff; nothing new to import.
- **Cons.** The precedence rule stays unreachable from a test, exactly as the current coverage
  count is. This story's value *is* that rule — including the pending/divergent interaction above,
  which is the kind of ordering bug that survives review and shows up in production. Rejecting
  this is the main architectural choice here.

### Option C — Extract a reusable `<CollapsiblePanel>` primitive

Introduce a shared disclosure component and use it here.

- **Pros.** Four hand-rolled disclosures already exist on this page family; a shared one would
  consolidate them.
- **Cons.** Speculative for this story — there is no second consumer *in this change*, and
  adopting it for the existing four is a refactor with its own regression surface across shipped
  panels. Worth doing as its own chore if the count keeps growing; not on the back of a summary
  line.

## Decision

We chose **Option A**.

The precedence rule is the deliverable, so it belongs where it can be tested directly; every other
part of this story is rendering. Option C is a reasonable future refactor and is recorded as such.

**The ordering, normatively** — this is the contract Phase 3 pins:

| # | Condition | Level | Rationale |
|---|---|---|---|
| 1 | any relay holds a different version | `divergent` | Already true and already actionable; a later answer cannot revoke it, so it need not wait for the check to finish. |
| 2 | else, any relay still pending | `checking` | Blocks exactly what AC-4 forbids: an all-clear, or a count that may still fall. |
| 3 | else, any relay missing the Map | `missing` | Actionable in one click (story 2). |
| 4 | else, any relay unreachable | `unreachable` | Coverage unknown; the user cannot fix it. |
| 5 | else | `ok` | Explicit all-clear. |

Note that `divergent` sits **above** `checking` while every other finding sits below it. That
asymmetry is the decision, and it follows from AC-4 prohibiting premature *all-clears and counts*
rather than prohibiting all early reporting.

The **local strfry row participates** in the summary: it is one of the locations the panel
reports, and `localEvent` is the comparison base, so a summary that ignored it would disagree with
the rows beneath it.

## Consequences

- **Enables.** The panel is quiet when nothing is wrong, and the closed line is a status light.
  `summarizePresence` is reusable by any future surface that wants a one-line verdict over the
  same row states.
- **Constrains.** The level vocabulary (`divergent | checking | missing | unreachable | ok`)
  becomes a contract between the helper and the panel; adding a level is a coordinated change.
- **A behavior change users will notice:** the panel no longer shows its rows on load. Anyone who
  relied on seeing them immediately now needs one click. That is the story's intent, and the
  status light is what makes it safe — but it is a real change, not a pure addition.
- **Not addressed:** the open/closed choice is not remembered across loads (story-level defer), and
  the four hand-rolled disclosures on this page family stay hand-rolled (Option C).
- **Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

**1. `ui/src/utils/treasureMap.js` — add `summarizePresence(localEvent, rowStates)`**

```
rowStates: Array<{ status: 'pending'|'present'|'absent'|'unreachable', event: {id, created_at}|null }>
→ { level: 'divergent'|'checking'|'missing'|'unreachable'|'ok',
    counts: { divergent, missing, unreachable, agreeing, pending, total } }
```

- A row counts as **divergent** when `status === 'present'` and
  `compareMapVersions(localEvent, row.event)` is not `'same'` — reuse it rather than re-deriving.
  With no `localEvent`, a present row is not divergent (there is nothing to differ from); it
  counts as agreeing only when local also has the Map.
- **missing** = `status === 'absent'`; **unreachable** = `status === 'unreachable'`;
  **pending** = `status === 'pending'` or the row is absent from the input entirely.
- Return counts even when they are not the headline — the panel may mention a lower condition
  alongside a higher one (AC-2's second sentence).
- Pure and total: never throws on a malformed or empty `rowStates`; empty input → `ok` with zero
  counts is wrong, so return `level: 'ok'` only when `total > 0`; an empty panel has nothing to
  report and should return `ok` with `total: 0` for the caller to suppress. Phase 3 will pin this.

**2. `ui/src/pages/grapevine/TreasureMapRelayPresence.jsx`**

- `const [open, setOpen] = useState(false);` — default closed, matching
  `TreasureMapManualEdit.jsx:22`.
- Header becomes the toggle, using the page idiom: `{open ? '▾' : '▸'}` before the title, whole
  header clickable, `cursor: 'pointer'`.
- Build `rowStates` from `targets` + `rows`, **prepended with the local row**
  (`{ status: inLocal ? 'present' : 'absent', event: localEvent }`), and pass to
  `summarizePresence`. Render the returned level through a local `SUMMARY` map of
  `{ text, color }` — wording and colour stay in the component. Use the file's existing palette:
  amber `#f59e0b` for `divergent`, green `#3fb950` for `ok`, inherited/dim for the rest.
- The summary renders in the header in **both** states, so the status light is always visible; the
  rows are what collapse.
- Gate only the row list (and the all-missing caution at `:255-259`) behind `open`. The header,
  including the summary, always renders.
- **Timestamp:** in the row's status cell, render `detail` as a second, smaller, dimmer line
  beneath `text` instead of only as `title`. Keep `title` as well — it costs nothing and preserves
  the hover for truncated values. `describe()` already returns the value; do not add a formatter.

**3. No other file changes.** `TrustedAssertions.jsx` is untouched — the panel's props are unchanged.

## Out of scope

- Remembering the disclosure state across page loads.
- A shared collapsible primitive, and any change to the other four disclosures (Option C).
- Any change to row semantics, the relay set, the probe, or story 2's sync behavior.
- Changing the Map header's own "Created …" line.
