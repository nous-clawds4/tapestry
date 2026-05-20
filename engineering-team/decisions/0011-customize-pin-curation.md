# ADR 0011: Customize pin curation method (pin-time + edit-from-/pins)

**Status:** Proposed
**Date:** 2026-05-20
**Story:** `engineering-team/stories/12-customize-pin-curation.md`

## Context

Story 12 exposes the `curation-method` JSON that Story 10 introduced
and Story 11 already honors per-pin. The wire shape is already
established; this story is mostly a UI surface (a curation editor
shared between pin-time and edit) plus a small generator extension
to honor `includeScoreInTL=true`.

### Concept-graph orientation

No new concepts. Per `/api/concept-graph/summaries`:

- `39998:<TA>:tag-pinning` (Story 10) — its JSON schema already
  declares the `curationMethod` property with the v1 fields
  (`observer`, `method`, `cutoff`, `includeScoreInTL`,
  `trustedList?`). The editor in this story is the first surface that
  exposes those fields to the user. **No firmware reinstall.**
- `39998:<TA>:tag` (Story 1) — read-only here.
- `39998:<TA>:web-of-trust` — Meili's `wot_rank_<obs8>` column is
  the lookup for AC-7's per-member scores.

### Existing primitives we reuse

- **`pinTag({ tag, curationMethod })`** at `ui/src/utils/publishTagPin.js:39–64`.
  Already accepts a `curationMethod` argument. The Story-10
  `defaultCurationMethod(viewerPk)` is invoked only when the caller
  omits `curationMethod` — so the wire path is already ready for
  customization. **Zero changes to this file required.**
- **kind-39999 replaceable semantics** — editing an existing pin is
  exactly "publish a new pin event with the same `d`-tag and updated
  curation values." `pinTag` already builds the `d`-tag
  deterministically as `tag-pin-<slug>-<tagAuthor8>-<viewer8>`, so a
  re-publish from the same (viewer, tag) automatically lands in the
  same addressable slot.
- **Story-11 refresh-on-pin pipeline** — `ui/src/pages/Tag.jsx:67`
  already fires `POST /api/trusted-list/refresh-pinned-tag` after a
  successful Pin publish. The same fire-and-forget shape covers AC-5.
- **`/api/profile-tags/pins`** — already returns each row's
  `curationMethod` (current values), so editing a pin already has
  pre-fill data without any new endpoint.
- **`refreshPinnedTags.js::runOnePin`** at
  `src/api/trustedList/refreshPinnedTags.js:124–202` — already reads
  `curation.includeScoreInTL` from the pin event; v1 just ignores it
  on the emit side. This story wires the emit branch.
- **`meiliFetchProfilesByPubkey`** (exported from
  `src/api/profile-tags/index.js`) — the existing bulk-Meili-lookup
  helper. Used by `aggregateProfilesTagged` for authors; reused for
  members when `includeScoreInTL=true`.
- **`buildAndPublishTL`**'s item shape
  (`src/api/trustedList/index.js:78–117`) — already emits
  `['p', pubkey, '', String(score)]` when `item.score != null`. No
  changes needed to the publisher; the generator just needs to set
  `items[i].score`.
- **Existing dialog pattern** at
  `ui/src/components/AddTagDialog.jsx:71–104` —
  backdrop + dialog box + close button + ESC-to-dismiss. Mirror the
  shape (different CSS prefix to avoid collisions).
- **NIP-19 decoding** via `nostr-tools/nip19` — already imported by
  `Tag.jsx`, `BrainstormSearch.jsx`, `PinDetail.jsx`. Used for AC-10's
  npub-vs-hex observer-field acceptance.

### CLAUDE.md invariants — what this story must honor

- **POV-first.** The `observer` field IS the POV for the generated TL.
  Per-pin observers stay per-pin; nothing here introduces a "global
  observer" or assumes a shared one.
- **Decentralized-first.** Any user can write any curation values.
  The form validates client-side for UX, but the network accepts
  whatever the user signs.
- **Filter at view time.** No new persistence beyond the existing
  kind-39999 pin events themselves. The editor reads from
  `/api/profile-tags/pins` (which itself derives from strfry) and
  writes a new pin event.

### Project rules

- No new lint/typecheck/build tooling.
- JS-without-build front end.
- No new firmware concept ⇒ no firmware reinstall.

### Open questions called out by the story (resolved below)

1. UI placement (inline / dialog / panel).
2. `/pins` Edit-affordance location.
3. `includeScoreInTL=true` + POV unresolvable UX.
4. Cutoff upper bound.
5. Observer input format (hex / npub / both).
6. AC-5 endpoint choice (`refresh-pinned-tag` vs `-for-viewer`).

## Options considered

### Option A — Shared `<CurationMethodDialog>` modal; three trigger points; replace-in-place via `pinTag()`; small generator extension for member scores

Five composable pieces.

**(1) Single shared dialog component** at
`ui/src/components/CurationMethodDialog.jsx`. Mirrors the visual
pattern of `AddTagDialog.jsx`: backdrop + dialog box +
`role="dialog"` + ESC-to-close. Props:

```jsx
<CurationMethodDialog
  tag={{ slug, name, eventId, authorPubkey }}
  initialCuration={{ observer, method, cutoff, includeScoreInTL }}
  mode="create" | "edit"
  viewerPubkey={user.pubkey}
  onSubmit={(customCuration) => Promise<void>}
  onCancel={() => void}
/>
```

Fields rendered:

- **Cutoff** — `<input type="number" min="1" step="1">`. Validation:
  must parse to integer ≥ 1; non-integer / ≤ 0 / non-numeric blocks
  submission with inline error. **No upper bound enforced** — high
  cutoffs are degenerate (TL becomes empty) but they're a legitimate
  signal a user might want. UI shows a small hint:
  `"Typical values: 1–10. Higher cutoffs require more endorsements
  per member."`.
- **Include rank scores in TL** — `<input type="checkbox">`. Default
  unchecked. Below it, a static helper line:
  `"Rank scores require a configured POV for the observer. If the
  observer's POV isn't resolvable, members appear in the list
  without scores."` The toggle stays interactive regardless of POV
  resolvability — accepting the user's intent and degrading silently
  on the generator side (AC-8). No eager client-side POV-resolution
  check.
- **Method** — `<select>` (or radio group) with all four
  documented options: `nip85:rank` (selectable, the default);
  `follows`, `trust-everyone`, `trusted-list` (visible-but-disabled
  with `(coming soon)` suffix). Submission with method ≠
  `nip85:rank` is impossible (the disabled option can't be
  selected).
- **Advanced disclosure** — `<details>` element collapsed by
  default. When expanded, shows:
  - **Observer pubkey** — `<input type="text">`. Default is
    `viewerPubkey` (the form pre-fills it). Accepts:
    - 64-char lowercase hex pubkey (used as-is)
    - `npub1...` (decoded via `nip19.decode`; rejected if not
      `type === 'npub'`)
    - empty (defaults to viewerPubkey on submit; useful for "reset to
      self")
    - whitespace is trimmed before validation
    Inline validation message on bad input:
    `"Must be a 64-char hex pubkey or a valid npub."`

Form-level submit button: `Pin with these settings` in `mode='create'`,
`Save changes` in `mode='edit'`. Below the submit, a Cancel button.

Behavior:

- **Submit** — assemble the `curationMethod` object from the form,
  call `onSubmit(curationMethod)`, on success call `onCancel()` to
  close. On error, display under the submit button without closing.
- **ESC** — same as Cancel.
- **Backdrop click** — close (Cancel).

**(2) Pin-time trigger** at `ui/src/pages/Tag.jsx`. The current
`handlePin` short-circuits straight to `pinTag({ tag })`. Replace
with: state for `showCurationDialog`. Pin button onClick now opens
the dialog. The dialog's onSubmit calls `pinTag({ tag,
curationMethod: customCuration })` followed by the same
`refetchHeader()` + fire-and-forget refresh that already exists.
Logged-out users still see no Pin button (AC-7 of Story 10 unchanged).

**(3) Edit triggers** at two surfaces:

- **`/pins` per-row** — a new `⚙️ Edit` button next to the existing
  per-row `Refresh now` + `🔗` share buttons. Disabled when
  `tlStatus.status === 'unsupported'` (the pin's existing curation is
  already broken; the user can't make it worse but also can't usefully
  edit a non-`nip85:rank` pin in v1 since the method picker is
  locked). On click, opens the dialog pre-filled with
  `row.curationMethod`.
- **`/pin/:dTag`** — a new `⚙️ Edit curation` button next to the
  existing `🔄 Refresh now` + `🔗 Share` in
  `ui/src/pages/PinDetail.jsx`'s actions row. Visible only when
  `canRefresh` (the viewer is the pin's observer). Pre-fills from
  `tl.observer + tl.cutoff + tl.minRank + tl.retracted` (the values
  the editor needs are derivable from the TL event's tags, with one
  exception: `includeScoreInTL` is NOT a tag on the kind-30392 — it's
  in the kind-39999 pin event. PinDetail needs to either fetch the
  underlying pin event OR call `/api/profile-tags/pins` once to get
  the pre-fill data. The latter is what the existing Refresh-now
  path already does in PinDetail — re-use it).

Both trigger paths call into the same dialog component with the same
`onSubmit` shape:

```js
async function handleEditSubmit(customCuration) {
  const signed = await pinTag({ tag, curationMethod: customCuration });
  await refetch();  // /pins or PinDetail's refetch
  // AC-5 — same fire-and-forget refresh as Story 11's refresh-on-pin.
  fetch('/api/trusted-list/refresh-pinned-tag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinEventId: signed.id }),
  }).catch(() => {});
}
```

**Why `refresh-pinned-tag` (per-pin) instead of `-for-viewer`** —
single pin scoping is faster, doesn't accidentally re-refresh
unrelated pins, and matches the shape Story 11 already established
for refresh-on-pin. The viewer-scope endpoint exists for the
explicit "Refresh all" button only.

**(4) Generator extension for `includeScoreInTL=true`** in
`src/api/trustedList/refreshPinnedTags.js::runOnePin`. After
`applyDisputesFunction` produces `members[]` and before
`buildAndPublishTL`:

```js
if (curation.includeScoreInTL === true && povSuffix) {
  // Bulk-fetch member Meili docs; attach wot_rank_<povSuffix> as score.
  const memberPubkeys = members.map((m) => m.pubkey);
  const memberDocs = await profileTags.meiliFetchProfilesByPubkey(memberPubkeys);
  const rankField = `wot_rank_${povSuffix}`;
  for (const m of members) {
    const doc = memberDocs.get(m.pubkey);
    if (doc && typeof doc[rankField] === 'number') {
      m.score = doc[rankField];
    }
  }
}
```

Then when building items:

```js
items: members.map((m) => ({
  tag: 'p',
  value: m.pubkey,
  ...(m.score != null ? { score: m.score } : {}),
})),
```

`buildAndPublishTL` already emits the correct `['p', pubkey, '',
<score>]` triple when `item.score != null`
(`src/api/trustedList/index.js:98–102`).

**Handling AC-8 (POV unresolvable):** the condition `curation.includeScoreInTL
=== true && povSuffix` is the guard. When `povSuffix` is null
(observer's POV not configured), the score-enrichment block is
skipped entirely; members still pass through with no `score`, and
the TL publishes normally without rank scores. **The TL does not
fail to publish.** AC-8 satisfied.

For consumers reading the TL: the existing `TrustedListDetail` page
at `ui/src/pages/grapevine/TrustedListDetail.jsx:50–144` already
handles per-item score: it reads `tag[3]` for `p` tags and renders a
score column when `hasScores` is true. So enabling
`includeScoreInTL` on a pin with a resolvable POV makes the score
column light up automatically.

**(5) Per-member score also surfaces in the JSON content body** —
the existing content shape is `{ members: [{ pubkey, endorsements,
disputes }] }`. Add an optional `score` field per member when
present:

```js
content: JSON.stringify({ members: members.map((m) => ({
  pubkey: m.pubkey,
  endorsements: m.endorsements,
  disputes: m.disputes,
  ...(m.score != null ? { score: m.score } : {}),
})) }),
```

The PinDetail page already reads `members[]` from the content body
(`ui/src/hooks/useTLDetail.js:65–73`); it can pick up the `score`
field at the same time. (Out of scope of this story to wire that
into the UI — it's a 3-line addition the future polish story owns.
Or trivially add it now since it's tiny. Implementer's call.)

**Pros:**

- Single dialog component for both pin-time and edit. Wire-shape
  consistency is automatic.
- `pinTag()` already accepts the customization arg — zero
  publish-path changes.
- AC-5 (auto-refresh-on-edit) reuses the same fire-and-forget shape
  Story 11 already established; no new endpoint, no new client logic
  beyond a `fetch().catch()`.
- AC-7's generator change is ~10 lines: one Meili bulk-fetch + one
  per-member attach + one conditional in the items map.
- AC-8's POV-unresolvable degrade is `if (... && povSuffix)` — one
  guard.
- The existing kind-30392 reader already handles per-item scores;
  AC-7's read-side surfaces light up automatically.
- The Advanced disclosure keeps the form approachable for the 90%
  case (just tweak cutoff) while still giving power users the
  observer override.

**Cons:**

- 3 trigger points (Tag.jsx, Pins.jsx, PinDetail.jsx) each need a
  small state addition. Manageable but not zero.
- The pin-time UX adds one click (open dialog → submit) where the
  current flow is one click (Pin directly). Mitigation: defaults
  match Story 10's defaults; submitting without changes produces
  the same pin as today.
- The Edit button on PinDetail needs to know the pin event id to
  emit the refresh; the existing Refresh-now path already has the
  workaround (look up via `/api/profile-tags/pins` + match by
  `tag.eventId + tag.slug`). Reuse it.
- Method picker shows 3 disabled options. Some users may wonder
  why they're there. Mitigation: "(coming soon)" copy.

### Option B — Inline expansion under the Pin button instead of a modal dialog

A `<details>` element or always-visible-but-collapsed panel under the
Pin button. Click Pin to expand → adjust → click "Pin" again to
submit.

**Pros:**
- No modal overlay.
- Fewer focus traps to manage.

**Cons (why rejected):**
- The Tag.jsx header is already busy (title, description, author,
  Pin button, /pins link, error surfaces). Inline expansion pushes
  the row list down on every interaction.
- The `/pins` edit case STILL needs a separate UI (inline expansion
  on a list row gets ugly fast). So the editor component would have
  to support two visual modes (header-inline vs row-inline).
- The dialog pattern is already established in this codebase
  (`AddTagDialog`, `ManageTagsDialog`); reusing it is cheaper than a
  new pattern.

### Option C — Separate "Pin with defaults" vs "Pin with options" buttons

Two buttons on the tag detail page. "Pin with defaults" goes direct;
"Pin with options" opens the dialog.

**Pros:**
- Keeps the one-click path for users who don't care about
  customization.

**Cons (why rejected):**
- Pin button becomes ambiguous ("which Pin am I clicking?").
- Twice the surface area in the header.
- Adds nothing the dialog doesn't already give: in Option A,
  submitting the dialog with unchanged defaults is the same wire
  result.

### Option D — All-in: every Pin must go through the dialog (no defaults shortcut)

What Option A does for new pins is actually this: the dialog is
mandatory. Option A pre-fills with the same defaults Story 10 used
for direct publishes, so submitting without changes is identical to
Story 10's behavior. So Option A IS Option D effectively. Listed
separately to document that the simplification was considered.

### Option E — Defer `includeScoreInTL` generator wiring to a follow-up story

Keep the toggle in the form (writes to the curation-method
JSON), but DON'T wire the cron-side emission. The pin's saved
value is durable but doesn't affect TLs until a follow-up story
ships the generator branch.

**Pros:**
- Cleaner scope split.

**Cons (why rejected):**
- The toggle becomes a confusing no-op until the follow-up ships —
  users flip it, save, and nothing changes downstream.
- The generator change is ~10 lines (Option A above). The
  follow-up story would be tiny.
- Including it now keeps the user mental model honest.

## Decision

**Option A.** Shared modal dialog used by three trigger points (Tag
page Pin button, `/pins` per-row Edit, PinDetail Edit). Editing
re-publishes via the existing `pinTag()` (kind-39999 replaceable,
same `d`-tag → in-place replacement). AC-5 auto-refresh reuses the
fire-and-forget pattern from Story 11. Cutoff is `min=1` number
input with no upper bound (typical range hint in copy). Observer
accepts hex AND npub. Method picker shows all four but only allows
`nip85:rank`. `includeScoreInTL=true` is wired through the generator
in the same story so the toggle has actual effect when POV is
resolvable; silently degrades when POV is unresolvable per AC-8.

Why: it's the smallest set of additions that reuses every existing
primitive (the publish path, the replaceable semantics, the
refresh-on-pin trigger, the kind-30392 reader's score column, the
modal pattern, the per-pin endpoint), keeps all three trigger
points sharing one dialog, and ships the toggle's actual effect in
the same story instead of leaving it stranded as a no-op.

## Consequences

**Enables:**
- Users can lower the cutoff (the most-requested adjustment for
  low-density data) — instantly fixes the "1-member TLs" issue.
- Per-pin observer override (rare but powerful — pin under
  someone else's POV without changing the rest of your session).
- Rank-bearing TLs (`includeScoreInTL=true`) light up the existing
  TrustedListDetail score column automatically.
- The editor surface is reusable for future stories: epic-Story-12's
  "trusted-list reference picker" can drop into the same Advanced
  disclosure when `method=trusted-list` is unlocked.
- Edit-in-place semantics validates the kind-39999 replaceable
  pattern end-to-end; future "edit pin" stories follow the same
  shape.

**Constrains / makes harder:**
- The cron's runOnePin gains one Meili bulk-fetch when any pin has
  `includeScoreInTL=true`. Cost: O(M) Meili lookups per such pin
  where M = member count. For v1 scale (low handfuls of pins, ≤100
  members each), this is unmeasurable. If thousands of pins enable
  the toggle, batch-fetching across pins is the optimization.
- Method picker UI shows 3 disabled options. Mitigation: clear copy.
- The first Pin from the tag detail page now requires one extra
  click (open dialog → submit). Mitigation: defaults preserved;
  power users can save without typing.

**Follow-ups / debt:**
- **Preset library** — "loose", "standard", "strict" presets that
  set cutoff/includeScoreInTL/etc. in one click. Useful follow-up
  once we have telemetry on which values people actually use.
- **Bulk edit** — apply curation changes to multiple pins at once.
  Multi-select on `/pins` + the same dialog.
- **`trustedList` field picker** — wired only when
  `method=trusted-list` is unlocked.
- **Score-surfacing in PinDetail's member list** — the JSON content
  body grows a `score` field per member; the PinDetail UI can
  display it inline (currently shows only endorsements/disputes).
  Tiny addition; could land here or in a follow-up at Implementer's
  discretion.
- **Validation on read side** — the cron currently trusts whatever
  curation values are in the pin event. A malformed cutoff (e.g.
  `cutoff: -1` published from another client) would produce a TL
  with all members. Defensive clamp in the generator is a sensible
  follow-up if abuse appears.

**Firmware reinstall required?** **No.** Pure code change.

## Implementation notes

Concrete guidance for the Implementer.

### Client — new component `ui/src/components/CurationMethodDialog.jsx`

Mirror the structure of `AddTagDialog.jsx`:

- Backdrop with `onMouseDown={onClose}` (close-on-outside-click).
- Dialog box with `onMouseDown={(e) => e.stopPropagation()}`.
- `role="dialog"` + `aria-label="Edit curation method"`.
- ESC keydown closes via `onClose`.
- Initial focus on the cutoff field.

State (all `useState`):

- `cutoff` — string (number input value).
- `includeScoreInTL` — boolean.
- `method` — string; forced to `'nip85:rank'`.
- `observer` — string (text input value).
- `advancedOpen` — boolean (the `<details>` open state, controlled).
- `error` — string | null (form-level error).
- `submitting` — boolean.

Helpers:

- `validate()` → returns `{ ok, errors }`:
  - cutoff: parseInt; ok if Number.isInteger and ≥ 1.
  - observer: empty (→ default to viewerPubkey on submit) OR
    64-char `[0-9a-f]{64}` hex OR `npub1...` that decodes to
    `type === 'npub'`.
  - returns errors keyed by field.
- `buildCurationMethod()` → returns the `{observer, method, cutoff,
  includeScoreInTL}` object, defaulting observer to `viewerPubkey`
  when empty.

Submit handler:

```js
async function handleSubmit() {
  setSubmitting(true); setError(null);
  const { ok, errors } = validate();
  if (!ok) { setError(errors.summary); setSubmitting(false); return; }
  try {
    await onSubmit(buildCurationMethod());
    onCancel(); // close on success
  } catch (e) { setError(e.message || 'Save failed'); }
  finally { setSubmitting(false); }
}
```

### Client — `ui/src/pages/Tag.jsx`

Add state:

```jsx
const [showCurationDialog, setShowCurationDialog] = useState(false);
```

Replace the current `handlePin` body so the Pin button opens the
dialog. The dialog's `onSubmit` does the actual `pinTag` call +
refetchHeader + fire-and-forget refresh — same shape as today's
`handlePin`, just invoked from inside the dialog's submit instead of
on the button click.

```jsx
<TagPinAffordance
  user={user}
  viewerPin={viewerPin}
  onPin={() => setShowCurationDialog(true)}  // opens dialog instead of direct publish
  onUnpin={handleUnpin}
  loading={pinning}
  error={pinError}
/>

{showCurationDialog && (
  <CurationMethodDialog
    tag={tag}
    initialCuration={defaultCurationMethod(user.pubkey)}
    mode="create"
    viewerPubkey={user.pubkey}
    onSubmit={async (custom) => {
      const signed = await pinTag({ tag, curationMethod: custom });
      await refetchHeader();
      fetch('/api/trusted-list/refresh-pinned-tag', { /* …same as today */ }).catch(() => {});
    }}
    onCancel={() => setShowCurationDialog(false)}
  />
)}
```

`defaultCurationMethod` is already exported from
`ui/src/utils/publishTagPin.js:19–26`.

### Client — `ui/src/pages/Pins.jsx`

Add state:

```jsx
const [editingPin, setEditingPin] = useState(null);
```

Add an `⚙️ Edit` button to each row's actions:

```jsx
<button
  type="button"
  className="bs-pins-row-edit"
  onClick={() => setEditingPin(row)}
  disabled={row.tlStatus?.status === 'unsupported'}
  title="Edit curation method"
>
  ⚙️
</button>
```

Conditional dialog mount:

```jsx
{editingPin && (
  <CurationMethodDialog
    tag={editingPin.tag}
    initialCuration={editingPin.curationMethod}
    mode="edit"
    viewerPubkey={user.pubkey}
    onSubmit={async (custom) => {
      const signed = await pinTag({ tag: editingPin.tag, curationMethod: custom });
      await refetch();
      fetch('/api/trusted-list/refresh-pinned-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinEventId: signed.id }),
      }).catch(() => {});
    }}
    onCancel={() => setEditingPin(null)}
  />
)}
```

### Client — `ui/src/pages/PinDetail.jsx`

Add state:

```jsx
const [editing, setEditing] = useState(false);
```

Add an `⚙️ Edit curation` button to the actions row, visible only when
`canRefresh` (mirrors the Refresh-now visibility rule). On click,
set `editing=true`.

The Edit dialog needs an `initialCuration` and a `tag` object. Two
fields aren't directly available from `useTLDetail` (the TL event
doesn't carry `includeScoreInTL` — that's a pin-event field):

- Re-use the Refresh-now lookup pattern from
  `PinDetail.jsx:64-80`: fetch `/api/profile-tags/pins` for the
  viewer, find the matching row by `tag.eventId + tag.slug`, use
  its `curationMethod` as the pre-fill.

Implementer can either inline that look-up (one extra fetch per
edit click — fine for v1) or refactor it into a shared helper. Not
prescriptive here.

### Server — `src/api/trustedList/refreshPinnedTags.js`

Modify `runOnePin` (line 124–202). After
`applyDisputesFunction` returns `members[]`:

```js
if (curation.includeScoreInTL === true && povSuffix) {
  const memberPubkeys = members.map((m) => m.pubkey);
  const memberDocs = await profileTags.meiliFetchProfilesByPubkey(memberPubkeys);
  const rankField = `wot_rank_${povSuffix}`;
  for (const m of members) {
    const doc = memberDocs.get(m.pubkey);
    if (doc && typeof doc[rankField] === 'number') {
      m.score = doc[rankField];
    }
  }
}
```

Then the items map:

```js
items: members.map((m) => {
  const item = { tag: 'p', value: m.pubkey };
  if (m.score != null) item.score = m.score;
  return item;
}),
```

And the content body (optional but cheap and useful):

```js
content: JSON.stringify({ members: members.map((m) => ({
  pubkey: m.pubkey,
  endorsements: m.endorsements,
  disputes: m.disputes,
  ...(m.score != null ? { score: m.score } : {}),
})) }),
```

That's the entire generator change.

### CSS

New file or additions to `ui/src/styles.css`:

- `.pcd-backdrop`, `.pcd-dialog`, `.pcd-head`, `.pcd-title`,
  `.pcd-close`, `.pcd-body`, `.pcd-field`, `.pcd-label`,
  `.pcd-input`, `.pcd-toggle`, `.pcd-select`, `.pcd-helper`,
  `.pcd-error`, `.pcd-advanced` (`details > summary` styling),
  `.pcd-actions`, `.pcd-submit`, `.pcd-cancel`. Reuse / mirror the
  existing `.ptd-*` palette from `AddTagDialog`-related styles.

- `.bs-pins-row-edit` — small ⚙️ button matching `.bs-pins-row-refresh`'s
  shape.

- `.bs-pindetail-edit` — full-width button matching `.bs-pindetail-refresh`.

### Tests (Tester writes; surfaces listed so the Implementer knows the contract)

**Contract / unit:**
- `defaultCurationMethod(viewerPk)` returns the documented Story-10
  default. (Unchanged from Story 10; no regression test needed
  unless the Tester finds a gap.)
- The form's `validate()` helper rejects bad cutoffs (negative, 0,
  fractional, non-numeric, empty), bad observers (non-hex, bad
  npub, too-short), and accepts the valid set
  (positive int cutoff; empty / hex / npub observer). If the
  validator is extracted to a pure function, it gets a small unit
  test.

**Publish-flow (live):**
- Pinning a tag with `cutoff=1, includeScoreInTL=true,
  observer=<viewer>` and a POV configured → published kind-30392
  has `p` tags carrying `[pubkey, '', <score>]` triples (AC-7).
- Same pin with POV unresolvable → published kind-30392 has bare
  `p` tags (no score), generator does not throw (AC-8).
- Editing an existing pin: publish a kind-39999 with the same
  d-tag and updated curation values; strfry resolves to the new
  event (replaceable); refresh-pinned-tag fires; published
  kind-30392 reflects new cutoff.
- Bad cutoff on the wire (e.g., cutoff=-1 from another client):
  out of scope. The defensive clamp is a follow-up; v1 trusts the
  signed event.

**UI (Playwright):**
- Pin button opens the dialog (not a direct publish).
- Dialog rendered fields: cutoff, includeScoreInTL toggle, method
  picker with 3 disabled options, Advanced expander with observer.
- Defaults match: cutoff=2, includeScoreInTL=false, observer=self.
- Submit with unchanged defaults produces the same wire event as
  Story 10's direct path (just verify the dialog's submit triggers
  a publish at all in the e2e env).
- Bad cutoff input → submit blocked, inline error shown.
- Bad observer input (`not-hex`) → submit blocked, inline error.
- npub observer input → decoded to hex and accepted.
- `/pins` per-row Edit button opens the dialog pre-filled with
  the row's current values.
- Editing then submitting fires both a `pinTag` publish and a
  `refresh-pinned-tag` POST.
- Cancel closes the dialog without publishing.

## Out of scope

- Methods other than `nip85:rank`.
- Per-pin schedule.
- Backfilling TLs at edit time beyond the AC-5 refresh-on-edit.
- A trusted-list reference picker for `method=trusted-list`.
- Multi-pin bulk edit.
- Audit log / change history.
- Preset library ("loose" / "standard" / "strict").
- Curation-method validation on the read side (defensive clamps).
- Surfacing the new `score` field in PinDetail's member list UI
  (the content body gets it for free; rendering it inline is a
  cheap follow-up).
- Eager client-side POV-resolution to gate the
  `includeScoreInTL=true` toggle. The helper-line wording is the
  v1 UX.
