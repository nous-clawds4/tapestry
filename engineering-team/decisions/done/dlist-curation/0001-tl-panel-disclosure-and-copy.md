# ADR 0001: Trusted Lists panel — disclosure header with a three-state status line, and the motivating copy

**Status:** Accepted
**Date:** 2026-09-10
**Story:** `engineering-team/stories/dlist-curation/1-tl-panel-copy-and-collapse.md`

## Context

The story's acceptance criteria, quoted back:

- **AC-1 (copy)** — in the absent and external states the prompt reads, verbatim: "Tags of pubkeys
  greatly enrich Vespa search on brainstorm.world. For this to work, a kind 30392 Trusted List
  should be published for each Tag. Would you like the local Tapestry instance to publish your
  Trusted Lists for pubkeys on your behalf? If so, you will need to update your Treasure Map so
  external clients can find your Trusted Lists."
- **AC-2 (collapsed by default)** — every load of a found Map renders the panel as one line: the
  title "Trusted Lists for Pubkeys (30392)" and a status indicator, nothing else — in all three
  states, including local.
- **AC-3 (three-state indicator)** — local / external (short pubkey shown) / absent, judged against
  the signed-in user's assistant, never the owner's; no state before that assistant resolves.
  Labels: "✅ Your Tapestry Assistant" · "⚠️ Another publisher · <8>…<4>" · "○ Not set".
- **AC-4 (expand / collapse)** — the header line toggles by mouse or keyboard; the expanded body is
  today's body, behaving exactly as before; open state not remembered across loads.
- **AC-5** — a viewer with no provisioned assistant still gets no panel.
- **AC-6** — relay presence, Map Entries, the raw-event toggle, the hand-edit panel, the no-Map
  path untouched.

**The card today** (`ui/src/pages/grapevine/TlOptInCard.jsx`): two return branches — a green
"local" card (`:65-84`) and an amber absent/external card (`:86-165`) — each rendering its own
`<h4>` title through the shared `titleStyle` (`:63`). The three-way status is an inline ternary
(`:46`) over `findGenericTlDelegation(event.tags, 30392)` and `useAuth().user.assistantPubkey`;
the null-assistant guard (`:44`) returns nothing before any judgment. The prompt paragraph is at
`:107-109`. There is no disclosure: the whole body always renders. The page mounts the card once,
`<TlOptInCard event={event} onPublished={search} />` (`TrustedAssertions.jsx:246`), after the
raw-event toggle and before the hand-edit panel.

**The disclosure idiom is settled on this page** — ADR `treasure-map-relay-presence/0003`
("Scannable presence panel"): local `useState(false)`; the header is a *real control*
(`role="button"`, `tabIndex={0}`, `aria-expanded`, Enter/Space with `preventDefault`), prefixed
`▾`/`▸`, and doubles as the status light ("a light you have to open the panel to see is not a
light"); the body renders under `{open && …}`. Reference implementation:
`ui/src/pages/grapevine/TreasureMapRelayPresence.jsx:238-262`. That ADR considered and deferred a
shared `<CollapsiblePanel>` primitive: "worth doing as its own chore if the count keeps growing;
not on the back of a summary line" — the four hand-rolled disclosures stay hand-rolled.

**Sentinels that must survive** (the Tester re-aims nothing here; this is a check, not a plan):
`test/tl-treasure-map-optin-publish.test.js` S1 asserts `card.includes(PROMPT)` where `PROMPT` is
the *old* two-sentence prompt (`:34`) — the new copy contains it verbatim as a suffix, so S1 holds
unchanged; S5 pins `useAuth`/`assistantPubkey` and bars `taPubkey` (OPEN.md row 188); S6 pins the
in-card error surface; S10 pins page order (raw toggle → card → hand-edit); and three other suites
(`treasure-map-panel-summary`, `treasure-map-relay-presence`, `treasure-map-relay-sync`) assert
only that the page still mounts `<TlOptInCard`. None of these constrain the card's internal shape
beyond what the story wants kept.

**Concept orientation.** The story names `39998:<TA>:tapestry-assistant` (local handle resolved
at runtime, `/api/assistant/pubkey`; `/neighbors` shows the standard concept scaffolding —
superset, concept graph, JSON schema, properties). The story reads the assistant's *identity*
only; no concept definition, schema, or property changes. *(Orientation gotcha for the record:
in zsh, `$TA:tapestry-assistant` applies the `:t` modifier to the variable and silently mangles
the handle — brace it, `${TA}:tapestry-assistant`.)*

**Constraints.** Per-deployment, per-user assistant baseline (never the owner's TA); no
persistence of open state (story); JS-without-build, no new tooling; the epic's pure helpers live
in `ui/src/utils/treasureMap.js` and are ESM-imported by the suites.

## Options considered

### Option A — In-card disclosure using the settled idiom, plus a pure status-descriptor helper

The card owns `const [open, setOpen] = useState(false)`. Both state branches collapse into **one
shell**: a header control rendering `▸/▾ Trusted Lists for Pubkeys (30392)` on the left and the
status label on the right, and `{open && (<body/>)}` carrying today's per-state body verbatim
(minus its own `<h4>`, which the header now owns). The three-way judgment and the label text move
into a pure helper, `describeTlDelegation(delegation, assistantPubkey)` in
`ui/src/utils/treasureMap.js`, beside `findGenericTlDelegation`.

- **Pros.** Smallest blast radius: one page file untouched, one card edited, one additive export.
  Matches ADR 0003 exactly (same control semantics, same keyboard handling, header-as-light).
  AC-3's vocabulary and labels become a pure function the suite can exercise by ESM import
  (U-class), rather than regex over JSX — the same reason ADR 0003 pulled `summarizePresence`
  out of the panel. The null-assistant guard stays where it is, so AC-5 is inherited, not
  re-implemented.
- **Cons.** A fifth hand-rolled disclosure on this page family; story 5's DList panel will
  hand-roll a sixth unless the extraction chore lands first.

### Option B — Extract a shared `DisclosurePanel` component now

New `ui/src/components/DisclosurePanel.jsx` (header control + `{open && children}`), used by the
card in this story and by the DList Curation panel in story 5.

- **Pros.** No duplication in story 5; one accessibility implementation to get right.
- **Cons.** Supersedes ADR 0003's explicit deferral on the back of a copy-and-collapse story; a
  shared component has a wider reviewer footprint and invites migrating the other four
  disclosures (a regression surface across shipped panels); the story states sharing is not
  required. The right vehicle is the chore ADR 0003 already named — it can precede story 5 if the
  operator wants it.

### Option C — Page-level wrapper around the card in `TrustedAssertions.jsx`

Leave the card alone; wrap the mount site in a disclosure.

- **Pros.** Card untouched.
- **Cons.** The collapsed line needs the delegation status, which only the card computes — the
  page would duplicate `findGenericTlDelegation` plus the assistant baseline, or the card would
  need a new prop contract to report it; AC-5's "no panel at all" would have to be re-implemented
  on the page; the header-as-light idiom is broken in two places. Rejected.

## Decision

We chose **Option A**. The deliverable is a status line and a fold; both belong to the card that
already knows the status, and the one piece of logic worth testing directly — the three-state
descriptor and its labels — moves to the epic's helper module where the suites already reach.
Option B is recorded, as ADR 0003 recorded it, as a standalone chore; it is not taken here.

## Consequences

- **Enables.** The page scans as a list of status lines; the DList Curation panel (story 5) can
  copy the same header contract line-for-line, and `describeTlDelegation` is reusable by any
  surface that wants the same verdict (e.g. a Map Entries badge).
- **A behavior change users will notice.** The opt-in prompt and the publish button are one click
  further away on every load, including for users who have not delegated yet. That is the
  story's intent; the status label is what makes it safe, so its wording is load-bearing.
- **Constrains.** The label strings and the `status` vocabulary (`absent | external | local`)
  become a contract between the helper and the card; Phase 3 pins them.
- **Debt / follow-ups.** The shared-disclosure chore (ADR 0003 Option C, here Option B) is now
  two panels closer to earning itself — flag it in the book close if story 5 hand-rolls a sixth.
  Open-state persistence stays deferred (story).
- **Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

**1. `ui/src/utils/treasureMap.js` — add `describeTlDelegation(delegation, assistantPubkey)`**
(additive export, next to `findGenericTlDelegation`; JSDoc in the file's style):

```js
/** The collapsed-line verdict for the pubkey-TL delegation. Null when there is no baseline to
 *  judge against (assistant unresolved) — the caller renders nothing, never a guess. */
export function describeTlDelegation(delegation, assistantPubkey) {
  if (typeof assistantPubkey !== 'string' || assistantPubkey === '') return null;
  const pk = delegation && typeof delegation.pubkey === 'string' ? delegation.pubkey : null;
  if (!pk) return { status: 'absent', label: '○ Not set', tone: 'none' };
  if (pk === assistantPubkey) return { status: 'local', label: '✅ Your Tapestry Assistant', tone: 'ok' };
  return { status: 'external', label: `⚠️ Another publisher · ${pk.slice(0, 8)}…${pk.slice(-4)}`, tone: 'warn' };
}
```
Never throws; a delegate-less row reads `absent` (consistent with `findGenericTlDelegation`,
which already returns null for such rows). `tone` is the card's color key
(`ok` → `#3fb950`, `warn` → `#f59e0b`, `none` → muted), so the card carries no label text.

**2. `ui/src/pages/grapevine/TlOptInCard.jsx`**

- Import `describeTlDelegation`; add `const [open, setOpen] = useState(false)` beside the existing
  `showPreview` state. Keep the `if (!event || !assistantPubkey) return null;` guard (`:44`) —
  then `const desc = describeTlDelegation(delegation, assistantPubkey);` and derive
  `const status = desc.status;` in place of the inline ternary (`:46`). Everything downstream
  (`handlePublish`, `preview`, `relayHint`, the error state) is unchanged.
- **One shell instead of two cards.** A single outer `<div>` whose border/background follow the
  status as today (green for `local`, amber otherwise). Inside it, in order:
  1. **Header control** — copy the control semantics from `TreasureMapRelayPresence.jsx:238-253`:
     `role="button" tabIndex={0} aria-expanded={open}`,
     `aria-label={`Trusted Lists for Pubkeys (${KIND_PUBKEY_TL}) — ${desc.label}`}`, `onClick`
     toggling `open`, `onKeyDown` handling Enter / Space / `'Spacebar'` with `preventDefault`,
     `cursor: 'pointer'`, `marginBottom: open ? '0.5rem' : 0`. Left: the `<h4>` (existing
     `titleStyle`, `margin: 0`) reading `{open ? '▾' : '▸'} Trusted Lists for Pubkeys
     ({KIND_PUBKEY_TL})`. Right: `<span>{desc.label}</span>` colored by `desc.tone`. This is the
     **only** `<h4>` in the file — delete the two per-branch titles (`:73`, `:93`).
  2. **Body** under `{open && (…)}` — the current per-state content, verbatim: the `local`
     branch's ✅ "Published by your Tapestry Assistant." row with the relay (`:74-83`); the
     absent/external branch's status sentence (`:95-106`), the prompt paragraph, the preview
     toggle + `<pre>` (`:113-136`), the publish row (`:138-151`), the error block (`:153-163`).
- **Copy (AC-1).** Replace the paragraph text at `:108` with the four-sentence copy from AC-1,
  verbatim, as one string in the JSX (the old two sentences remain a contiguous suffix, so the
  existing S1 sentinel keeps passing without edits).
- Do **not** touch: `getActiveSignerOrThrow`, `publishOrThrow`, `upsertGenericTlTag`,
  `aTrustedListRelays`, `useAuth().user.assistantPubkey`; `taPubkey` must not appear (row 188).

**3. `ui/src/pages/grapevine/TrustedAssertions.jsx`** — untouched. The mount and its position
(`:246`) are pinned by S3/S10.

**4. Phase 3 guidance (the Tester's lane — not implemented here).** A new suite in the house
three-class pattern, e.g. `test/dlist-curation-tl-panel.test.js`: **U** — `describeTlDelegation`
by ESM import: null baseline → null; the three states and their exact labels; delegate-less
delegation → `absent`; never throws on garbage. **S** — the card holds `useState(false)` for the
fold, renders a control with `aria-expanded`, handles Enter and Space, gates the body with
`{open &&`, carries the four-sentence copy verbatim, and has exactly one `<h4>`; no `taPubkey`.
**R** — `tl-treasure-map-optin-publish`, `treasure-map-panel-summary`,
`treasure-map-relay-presence`, `treasure-map-relay-sync` pass before and after. Suggested scoped
gate: the new suite plus those four.

## Out of scope

- A shared disclosure primitive (Option B) — a standalone chore, per ADR 0003.
- Remembering open/closed state across loads.
- Any change to the relay-presence panel, the hand-edit panel, or the publish path.
- The DList Curation panel and the Map Entries class (stories 5–6 of this epic).
