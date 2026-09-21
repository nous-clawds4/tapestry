# ADR 0002: Author-scoped views on Active b-tags

**Status:** Accepted
**Date:** 2026-09-20
**Story:** `engineering-team/stories/author-scoped-inspection/2-every-author-on-active-b-tags.md`,
`3-narrow-by-person-and-by-author-type.md`, `4-mark-self-declaration-rows.md`

## Context

Three stories land on one page and one fetch, so they share an ADR. Stories 2 and 3 are the
shipping pair; story 4 is independent and included here because it edits the same two shared
components.

**Fact 1 — the narrowing is one line of the existing fetch.** `ActiveBTags.jsx:66` calls
`queryRelay({ authors: [taPubkey], kinds: B_CARRIER_KINDS })`. Dropping `authors` widens it. On
this dev instance that moves the scan from 170 to 271 events and the table from **13 rows to 17**;
the four new rows are authored by `253d40c4…`, `82b75e47…` (two) and `919ba08a…`.
*(Re-measured at implementation; Planning recorded 12 -> 16. The delta of four is unchanged.)*

**Fact 2 — the self-declaration rule is already written down, twice.** `dispositionOf(bValues,
selfCoord)` in `src/lib/bValueForms.js:41` returns `selfDeclared` when a b value equals the
carrier's own coordinate, and `ui/src/utils/bDisposition.js:29` mirrors it for the browser. Story 4
must use that rule, not re-derive `v === coord` inline.

**Fact 3 — `DataTable` has no per-row hook.** `ui/src/components/DataTable.jsx:141` renders
`className={onRowClick ? 'clickable' : ''}` and nothing else. Story 4 needs one.

**Fact 4 — the app is dark-only.** `ui/src/styles.css:6` defines `:root` with dark values and the
file contains **zero** `prefers-color-scheme` or `data-theme` rules. Story 4's AC-5 as written
("light and dark theme") describes a theme that does not exist. The real constraint it was reaching
for is the one that does bite: `.data-table tbody tr:hover { background: var(--bg-tertiary); }`
(`:371`) will fight any row background tint, and whichever rule is later in source wins. *This ADR
restates AC-5 accordingly; the story should be amended at this gate rather than tested as written.*

**Fact 5 — the assistant badge is bound to one pubkey.** `Avatar.jsx:27` computes
`isTA = pubkey === taPubkey` from `ConfigContext`, where `taPubkey` is the **owner's** assistant.
With several assistants in one column, exactly one would be badged and the rest would render as a
truncated pubkey with a `?` letter tile — worse than badging none, because it reads as a
distinction that is not there.

**Fact 6 — the b-tag target lookup is unrelated.** The second effect
(`ActiveBTags.jsx:106–152`) fetches targets from `wss://dcosl.brainstorm.world` to fill *name
(shared)* and *author (shared)*. It never decides which rows exist, and nothing here changes it —
though it now over-fetches across a larger target set, noted under Consequences.

## Options considered

### Option A — Widen the fetch; filter in the client; roster in a context

One scan with no `authors`, one client-side row build, both selectors as pure predicates over the
built rows. The roster (ADR 0001) is fetched once into a React context beside `ConfigContext`, so
the person selector, the author-type predicate and `Avatar`'s badge all read one source.

**Pros.** Filtering at view time is invariant #3, stated. Changing either selector re-renders with
no refetch, so the controls feel instant. One fetch regardless of selection. The roster-in-context
is needed for the selector anyway, which makes fact 5's fix nearly free.
**Cons.** The scan is larger than before and stays unbounded (a known, deferred finding). The
client holds every author's rows even when showing one person's.

### Option B — Server-side author filtering, refetch per selection

Pass the selected person's pubkeys as `authors` and re-scan on every change.

**Pros.** Smaller responses. Naturally bounded.
**Cons.** A refetch on every selector change, including back to "Everyone", which is the slow one.
It also pushes a *view* decision into the query — the thing invariant #3 warns against — and would
make the author-type filter (a property of the roster, not of the relay) impossible to express in
a nostr filter at all. Rejected.

### Option C — Widen the fetch; filter in the client; thread the roster as props

As A, but the roster is fetched by `ActiveBTags` and passed down.

**Pros.** No new context; the blast radius is one page.
**Cons.** `Avatar` is three levels down inside `DataTable`'s render, so the badge fix (fact 5)
would need prop-threading through a shared component used by 25 pages — the exact cost
`ConfigContext` exists to avoid (ADR ta-avatar/0001 made the same call for `taPubkey`).

## Decision

We chose **Option A**.

**On fact 4 — AC-5 restated.** The criterion becomes: *the distinction is visible both at rest and
on hover.* This is the constraint the dark-only stylesheet actually imposes, and it catches the
real defect (a tint swallowed by, or swallowing, the hover feedback). Implemented as two rules
placed **after** `:371` so ordering is explicit rather than incidental.

**On fact 5 — badge scope, deliberately partial.** `Avatar`'s badge predicate widens from "is the
owner's TA" to "is an assistant this instance controls", and `AuthorCell`'s unnamed-fallback widens
the same way. The **picture-borrowing does not widen**: a non-owner assistant with no kind-0 falls
through to the lettered tier exactly as any unnamed pubkey does today. Borrowing each controller's
face would need a second batched profile fetch keyed by controller, which buys polish this book
does not need. Recorded as a follow-up, not built. ADR `ta-avatar/0001` is **extended, not
superseded** — the owner's assistant behaves identically, as the n=1 case of the wider rule.

**On the two selectors.** They are independent predicates composed by intersection, and an empty
intersection renders an explanatory empty state rather than disabling a control. Keeping both
enabled preserves the two-axis model; **Mine + Assistants** ("what my assistant filed") and
**Mine + People** ("what I signed myself") are the combinations that justify it.

**On vocabulary.** Settled by the owner at the story gate: **Showing:** `Everyone` · `Owner` ·
`Mine` · *each customer*; **Signed by:** `Anyone` · `Assistants` · `People` · `Everyone else`. The
detail-panel note reads `* self-declaration` — matching `carriesSelfPointer` and the Community
Offerings surface. An earlier draft said `* self-referencing`; that string must not appear.

## Consequences

- **Enables.** The page becomes an honest wire inspector, and every narrowing is a view over one
  fetch. `rowClassName` and the panel `note` are available to the other 24 `DataTable` pages and
  to Active z-tags without further design.
- **The deferred scan finding gets heavier.** Dropping `authors` roughly 1.6× the scan here and
  removes the tightest bound the page had. The scan still passes no `limit` and still uses
  `queryRelay` rather than `queryRelayBounded`, so a truncated result would render as a complete
  list with no indication. **Unchanged by choice** — the owner deferred it this session — but this
  ADR is where it stops being theoretical. It should be the first item raised at the book close.
- **The community-relay lookup over-fetches more.** The merged a-tag filter takes the cross-product
  of kinds × authors × d-tags across a larger target set. Rows still re-match precisely
  (`ActiveBTags.jsx:143–147`), so this costs bytes, not correctness.
- **Assistant badges appear on surfaces this book never opened.** Any page rendering `<Avatar>` for
  a customer's assistant now badges it. This is a correctness fix — those avatars were
  mis-rendering as ordinary users — but a repo-wide visual diff here is **intended**, not leakage.
- **Constrains.** The selectors narrow by **authorship**, a property of the event. Nothing here is
  POV-namespaced and nothing derived from a selection is stored (invariants #1 and #3). A later
  request to "show only trusted authors" is a different axis and must not be bolted onto these.
- **Publishing stays permissionless.** Foreign-authored events are displayed, never validated for
  authorship (invariant #2).
- **New debt.** Controller-face borrowing for non-owner assistants; Active z-tags adopting the two
  new props; `descriptionOf`/`singularName` still duplicated across three files (pre-existing, ADR
  `shared-concepts-row-detail/0001`).
- **`npm run build` in `ui/` is required**, and the built bundle reaches the container by
  `docker cp` — there is no source bind mount (ADR 0001 § Implementation notes).
- **Firmware reinstall required?** **No** — no concept definitions change.

## Implementation notes

**New file: `ui/src/context/AssistantRosterContext.jsx`**
- `AssistantRosterProvider` fetches `/api/assistant/roster` once on mount, exactly as
  `ConfigContext.jsx:25–51` fetches its four. Exposes `useAssistantRoster()` →
  `{ assistants, viewer, loading }`.
- Mount it in `ui/src/App.jsx` **inside** `AuthProvider` (it depends on the session) and **outside**
  the router, beside the existing providers.

**New file: `ui/src/utils/authorScope.js`** — pure ESM, no React, no fetch. One home for the rules;
tests load it with `pathToFileURL` + dynamic `import()`, the idiom `test/add-node-as-element-restore.test.js:48` uses.
- `assistantPubkeys(assistants)` / `accountPubkeys(assistants)` → `Set`.
- `classifyAuthor(pubkey, assistants)` → `'assistant' | 'person' | 'external'`. An account holding
  **both** roles cannot occur (an assistant pubkey is never an account pubkey), but if the roster
  ever reports one, `'assistant'` wins — deterministic, not incidental.
- `personPubkeys(assistants, accountPubkey)` → the pair `[account, assistant]`, assistant omitted
  when `null`.
- `matchesScope(eventPubkey, { person, authorType }, assistants)` → boolean. Intersection of the
  two predicates; `person: null` and `authorType: 'anyone'` are the no-op values.

**File: `ui/src/pages/shared-concepts/ActiveBTags.jsx`**
- `:66` — `queryRelay({ kinds: B_CARRIER_KINDS })`. Drop `authors`. The `if (!taPubkey) return`
  guard at `:59` goes with it: the page no longer waits on the owner's assistant to render.
- Row build — carry `authorPubkey: ev.pubkey` and `selfDeclared`, the latter from
  `dispositionOf([t[1]], coord).selfDeclared` (`ui/src/utils/bDisposition.js`), **not** an inline
  `===`. Keep the existing sentinel skip at `:75` unchanged.
- Columns — insert `author (local)` **before** `name (shared)`, rendered with `<AuthorCell
  pubkey={row.authorPubkey} profiles={profiles} />`. Relabel the existing `sharedAuthor` column so
  the two read as a pair. Add local authors to the `useProfiles` set at `:154–158`.
- Two `<select>` controls above the table, following the inline-styled pattern at
  `AdoptionQueue.jsx:252–260` (`var(--bg-primary, …)` / `var(--border, …)`), each with a muted
  one-line legend. Person options come from `assistants` — never a hardcoded role list (ADR 0001
  § Consequences). Default: `viewer.accountPubkey` when present, else the owner's row.
- The no-assistant notice renders when `viewer` is present and `viewer.assistantPubkey` is `null`.
- Empty state — when `matchesScope` yields nothing, pass an `emptyMessage` naming both selections.
- `:194` — the subtitle still says *"locally-authored nostr events"*. Rewrite it; story 2 AC-4.

**File: `ui/src/components/DataTable.jsx`**
- New **optional** prop `rowClassName` — `(row) => string | undefined`, appended to the existing
  `clickable` class at `:143`. Omit it and the output is byte-identical; pin that in the test plan,
  as `shared-concepts-row-detail/0001` did for its two props. Document it in the JSDoc block at
  `:3–33` alongside `filterKeys` and `renderExpanded`.

**File: `ui/src/components/TagDetailPanel.jsx`**
- New **optional** prop `note` — rendered immediately after `<CopyButton>` at `:24`, inside the
  same flex row, in `.text-muted`. Omitted → unchanged markup.

**File: `ui/src/styles.css`**
- Two vars in `:root` (`:6–20`), beside the existing palette:
  `--row-self-declared: rgba(188, 140, 255, 0.07);`
  `--row-self-declared-hover: rgba(188, 140, 255, 0.13);`
  (`--purple` `#bc8cff` at low alpha — a hue the table uses nowhere else, so it reads as a mark
  rather than as status. Deliberately **not** `--orange`/`--red`: story 4 AC-1 forbids reading as
  a warning.)
- Two rules placed **after** `.data-table tbody tr:hover` at `:371`, so source order is a decision
  and not an accident:
  ```css
  .data-table tbody tr.row-self-declared { background: var(--row-self-declared); }
  .data-table tbody tr.row-self-declared:hover { background: var(--row-self-declared-hover); }
  ```
- One inset left rule, which hover cannot touch (the table is `border-collapse: collapse` at
  `:343`, so a `<tr>` border would not render reliably — an inset shadow on the first cell does):
  ```css
  .data-table tbody tr.row-self-declared td:first-child { box-shadow: inset 3px 0 0 var(--purple); }
  ```

**File: `ui/src/components/Avatar.jsx`** — `:27`, widen `isTA` to consult the roster. Keep the
`taPubkey` fast path so the owner's assistant is still badged before the roster resolves. Picture
candidates at `:34` and the label at `:43` are unchanged for non-owner assistants.

**File: `ui/src/components/AuthorCell.jsx`** — `:27`, the `unnamed` fallback reads
`'Tapestry Assistant'` for any roster assistant. `title={pubkey}` unchanged.

## Out of scope

- The unbounded/untruncated scan (deferred by the owner; raise at book close).
- The `ui/src/utils/bDisposition.js:8` comment claiming malformed values are skipped by every b
  surface — this page still lists them as "cannot locate event" and that is unchanged here.
- Active z-tags, the b-tag detail (pair) page, and every other `DataTable` caller.
- Persisting either selection; sorting or filtering by self-declaration; controller-face borrowing.
- Any change to the community-relay target lookup, or to which b values count.
