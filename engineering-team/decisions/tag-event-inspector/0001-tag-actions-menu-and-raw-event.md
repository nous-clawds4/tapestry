# ADR 0001: Tag actions menu + raw event inspector — serve the event from `by-id`, emulate the `⋯` menu as a sibling

**Status:** Proposed
**Date:** 2026-07-16
**Story:** `engineering-team/stories/tag-event-inspector/1-tag-actions-menu-and-raw-event.md`
**Builds on:** ADR-0022 (the `39999:<authorPubkey>:<slug>` tag coordinate this ADR encodes as an `naddr`), ADR-0015 (the `LEGACY_*_PUBKEY` named exception — **not** applicable here; see §"Citation hygiene"), ADR-0009 (the `viewerPin` additive-field precedent on the very endpoint this ADR extends), tag-federation ADR 0001 (the `federatedScan` read-union whose output this ADR serializes).

**Citation hygiene:** ADR ids are epic-scoped. Cite this as **tag-event-inspector ADR 0001**. This ADR introduces **no pubkey literal of any kind**. The `naddr` is composed from the *tag element's own author* (`tag.authorPubkey`, runtime data from the response body) — never the TA, never `LEGACY_TA_PUBKEY` / `LEGACY_Z_TAG_PUBKEY`. See D5 for why the ADR-0015 exception does not reach this feature.

## Context

The tag detail page (`ui/src/pages/Tag.jsx`, 406 lines) renders a tag's name, description, Pin affordance, and tagging rows — all derived from one kind-39999 tag-element event that the page never shows. Story 1 adds a `⋯` menu beside the tag name with three items (Copy Note ID / Copy Note Addr / Show–Hide Raw Event) and a default-hidden panel rendering the signed event.

**Facts verified in code and against the running stack (2026-07-16), not assumed:**

| Fact | Evidence |
|---|---|
| The tag definition is **kind 39999**, in the 30000–39999 addressable range ⇒ an `naddr` always exists. | Live fetch of `225d6290…c908` from `tags.brainstorm.world`; `d`-tag = `stoicism`. |
| The `d` tag **is** the slug. | Same event; re-confirmed against local tag `cpc-tag-s12b-1784175857927-1vizzi`. |
| The tag author is an **ordinary user**, not the TA. `stoicism` is authored by `2efaa715…7331` (vinney). | Same event's `pubkey`. |
| The canonical tag coordinate is `39999:${tag.authorPubkey}:${tag.slug}`. | `ui/src/utils/publishProfileTag.js:64` (**not** :67 — the orientation brief's line number was stale; verified by grep). |
| The full raw event is **already in hand** server-side and then projected away. | `src/api/profile-tags/index.js:770` (`const ev = events[0]`) → `:811-823` (response omits it). Live `by-id` response confirms: keys are `success`/`tag`/`author`/`viewerPin` only. |
| `strfryScan` emits **exactly** the 7 canonical NIP-01 fields — no extras. | Empirical: `docker exec tapestry strfry scan '{"ids":["5633f149…"]}'` → keys `['content','created_at','id','kind','pubkey','sig','tags']`; set-difference vs canonical = `[]`. |
| The remote leg (`dlistFetch` → nostr-tools `SimplePool.querySync`) attaches `verifiedSymbol` — a **`Symbol`**, which `JSON.stringify` drops silently. | `node_modules/nostr-tools/lib/cjs/pure.js:38` (`Symbol("verified")`), assigned `abstract-pool.js:178`. |
| `by-id` is **one call per tag-page mount**, not a per-row/list call. | Sole UI caller `ui/src/hooks/useTagDetail.js:50`; the list endpoint is `available-tags`, untouched. |
| Live `by-id` payload = **369 bytes**; the raw event = **641 bytes**. | `curl -w '%{size_download}'` against `localhost:7778`, local test tag. |
| `.bsp-note-menu` already floats right via `margin-left:auto` — which **requires a flex parent**. `.bs-tag-header` is **not** flex (block; margin/padding/border-bottom only). | `ui/src/styles.css:7551-7556` and `:4770-4774`. |
| `.cypher-query` is the in-repo precedent for a scrollable wrapped code block. | `ui/src/styles.css:1598-1610` (`white-space:pre-wrap; word-break:break-all; max-height; overflow-y:auto`). |
| No existing test asserts an exact key-set on the `tag` object ⇒ an additive field is safe. | grep for `Object.keys`/`deepEqual`/`toEqual` across `test/tag-detail*.test.js`, `test/pin-a-tag.test.js` → none. |

**Concept-graph orientation** (three-call pattern, `AGENTS.md` §3 — `/summaries` → `/node/:handle`):

- `39998:<TA>:nostr-event` — **nostr event**. The graph's own definition is the normative field list this ADR serializes: *"a cryptographically signed JSON object with fields: id (SHA256 of serialized content), pubkey (author's public key), created_at (Unix timestamp), kind (integer classifying the event type), tags (array of metadata arrays), content (arbitrary string payload), and sig (Schnorr signature). Defined in NIP-01."* Exactly seven fields — this is the authority for D1's whitelist, not my judgement.
- `39998:<TA>:tag` — **tag**. The concept whose element the panel displays.
- `39998:<TA>:tag-pinning` — **tag pinning**. Adjacent only (shares the header); must not change (AC-7).

The local graph answers `<TA>` = `e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36`, while CLAUDE.md documents `82b75e47…` for this machine. **That divergence is live proof of the no-hardcode rule** — and the reason D5 goes out of its way to keep the TA out of this feature entirely. No concept definitions change ⇒ **no firmware reinstall**.

## Options considered

### D1 — Where the raw event comes from

#### Option A — add `rawEvent` to the `/api/profile-tags/by-id` response *(chosen)*
The event is already at `index.js:770`. Serialization is the only new work.
**Pros.** Zero extra round-trips. No new loading/error/race states — the panel renders from data the page already has, so AC-6's "nothing throws" collapses to one null-check. Testable by the **existing** `test/tag-detail.test.js` HTTP-contract style — which matters disproportionately, see D-test. Additive and backward-compatible (ADR-0009 set this precedent with `viewerPin` on this same endpoint).
**Cons.** ~641 bytes on **every** tag-page view for a panel that is default-hidden and most views never open. Payload goes 369 → ~1010 bytes (~2.7×) — a large *relative* jump, small absolute.

#### Option B — lazy client fetch from `/api/strfry/scan?filter={"ids":[…]}` on first open
**Pros.** Pay-per-use — nothing on the 95% of views that never open the panel. No change to `by-id` at all.
**Cons.** An extra round-trip and a **`strfry scan` shell-exec per panel open** (`src/api/strfry/queries/scan.js` `exec`s a subprocess — a heavier per-view cost than 641 bytes of gzipped JSON). Introduces loading/empty/error/cancelled states, multiplying AC-6's degradation matrix precisely where the story demands robustness. Worst of all: it moves the only mechanically-testable half of this story out of the node harness — see below.

#### Option C — a new dedicated endpoint (e.g. `GET /api/profile-tags/raw-event`)
**Pros.** Clean separation; pay-per-use.
**Cons.** A whole new route, contract, and test surface to serve one field that an existing route already holds in memory. Unjustified.

**Decision: Option A**, with a **whitelisted projection** (see below).

The 641-byte objection is the honest cost and deserves a straight answer rather than a dismissal. It loses on four counts. (i) *Absolute scale*: 641 bytes is ~2 IP packets, gzips to a few hundred, and is dwarfed on the same page by the `profiles-tagged` call returning N profile rows with avatars — this is not the page's marginal byte. (ii) *Not a hot path*: `by-id` fires **once per mount**, not once per row; the list endpoint (`available-tags`) is untouched, so this cannot amplify across a list. (iii) *Partial double-count*: `tag.name`/`tag.description` are already parsed *out of* `ev.content`, so a chunk of those 641 bytes is duplicating bytes the response ships regardless — the genuinely-new payload is roughly the `sig` + `id` + `tags` array. (iv) *The states are the real cost*: Option B trades 641 bytes for an async state machine inside an inspector whose entire value proposition is "show me the bytes, faithfully." Buying byte-efficiency with a new class of failure modes is the wrong trade in a feature about trustworthiness.

**What exactly is serialized — a 7-field whitelist, not `ev` verbatim.** I inspected both legs of `federatedScan` rather than guessing:

- **Local leg** (`strfryScan`, `index.js:69-83`): `JSON.parse` of `strfry scan` stdout. Verified empirically — exactly the 7 canonical fields, zero extras.
- **Remote leg** (`dlistFetch`, `index.js:103-122`): nostr-tools `SimplePool.querySync`. Attaches `verifiedSymbol` = `Symbol("verified")` (`pure.js:38`, assigned `abstract-pool.js:178`). **Symbol-keyed properties are dropped by `JSON.stringify`**, so they cannot leak today either.

So *today* `res.json({ ...ev })` would in fact emit clean canonical JSON on both legs. **We whitelist anyway**, for reasons that survive that finding:

1. **AC-6 says "byte-faithful to the event as signed."** A whitelist of exactly the NIP-01 fields *is what "as signed" means* — the `id` is the SHA256 over a serialization of exactly `[0, pubkey, created_at, kind, tags, content]`. A pass-through's contract is instead "whatever the scan leg happened to attach," which is not the same statement and is not the one the AC makes.
2. **It is only accidentally clean.** The cleanliness rests on a Symbol-vs-string implementation detail in a third-party library. A nostr-tools upgrade that switches to a string key (`event.verified`), or a future strfry field, would silently start emitting a non-canonical field into a panel captioned "the raw signed event" — a correctness bug that no existing test would catch.
3. **Fixed key order.** Projecting in a declared order gives the panel a stable, canonical rendering rather than inheriting the relay's incidental key order. This *serves* AC-6's "no field reordered" (which forbids restructuring into a summary, not a specific key order) and makes the output diffable across the two legs.

```js
// src/api/profile-tags/index.js — near handleTagById
// The 7 canonical NIP-01 fields, in canonical order. Whitelist, never spread:
// `ev` originates from federatedScan's local (strfry) OR remote (nostr-tools)
// leg, and the panel's contract is "the event as signed", not "whatever the
// scan leg attached". See tag-event-inspector ADR 0001 D1.
function toRawEvent(ev) {
  return {
    id: ev.id,
    pubkey: ev.pubkey,
    created_at: ev.created_at,
    kind: ev.kind,
    tags: ev.tags,
    content: ev.content,
    sig: ev.sig,
  };
}
```

**Where it hangs: `tag.rawEvent`.** Chosen over a top-level `rawEvent` because `useTagDetail.js:60` already does `setTag(data.tag)` — nesting it under `tag` means the panel gets its data with **zero changes to the hook**. `tag` already carries event-level facts (`eventId`, `authorPubkey`, `createdAt`), so `rawEvent` is coherent there rather than a category error.

### D2 — Component structure

#### Option A — new sibling `ui/src/components/TagActionsMenu.jsx` *(chosen)*
Emulates `NoteActionsMenu`, **reusing the `bsp-note-menu*` CSS classes and `copyText`** verbatim.
**Pros.** Zero risk to the shipped feed menu (AC-7 asks for exactly that). The two menus act on different object types (kind-1 note vs kind-39999 tag element) with different items and — uniquely here — a *stateful* item (Show/Hide) that the note menu has no analogue for. Duplication is confined to the ~20-line kebab/click-outside/flash shell; the CSS, the clipboard helper, and the visual identity are genuinely shared, not copied.
**Cons.** The shell is duplicated. A future third menu makes extraction clearly right.

#### Option B — extract a shared `<ActionsMenu>` and refactor both onto it
**Pros.** DRY; one place to later add Escape-to-close.
**Cons.** Refactors a **shipped** surface (the feed menu) inside a story whose AC-7 is "the existing menu is unchanged" — converting a zero-risk story into a regression-testing exercise on an unrelated surface. Two call sites is also thin evidence for the right abstraction; the *third* menu is what reveals the seam. Premature.

#### Option C — generalize `NoteActionsMenu` with an `items` prop
**Pros.** No new file.
**Cons.** Same shipped-surface risk as B, plus it leaves a component named `NoteActionsMenu` rendering a tag's actions — the name becomes a lie. A generic menu should be *named* generically, which is Option B wearing a disguise.

**Decision: Option A.**

On the documented instinct at `engineering-team/stories/_intake.md:1136` — *"the first surface that needs a compact card / hidden actions menu adds an explicit prop to `NoteCard` rather than branching at the call site or forking"* — I read it and it **does not apply here**. It is scoped to **`NoteCard`**, and it addresses *layout variants of the same object type* (a kind-1 note rendered compact vs full). This story adds a menu for a *different object type* on a *different page*, with a different item set. Extending that note to mean "never write a second menu component" would over-read a `NoteCard`-specific note into a general prohibition on new components. Flagging it explicitly because a reviewer scanning intake will reasonably ask.

**To record in `_intake.md`** (the Implementer or Reviewer adds this; it is not a code change):

> **Extract a shared `<ActionsMenu>` shell** — `NoteActionsMenu` (`ui/src/components/NoteActionsMenu.jsx`) and `TagActionsMenu` (tag-event-inspector #1) now duplicate the kebab-button / click-outside-close / transient-flash shell (~20 lines). The CSS (`bsp-note-menu*`) and `copyText` are already shared; only the shell is duplicated. **Do it when a third `⋯` menu appears** — two call sites under-determine the abstraction, three reveal it. Natural companion: **Escape-to-close**, which no menu currently handles and which the tag-event-inspector epic explicitly deferred as a change that must land on *every* menu at once, not one. **Priority:** Low.

### D3 — Where the raw panel lives in the JSX

The story's open question (b) is settled here with exact line numbers against `ui/src/pages/Tag.jsx` (verified 2026-07-16):

```
line 227-250   <header className="bs-tag-header">  …h1 / desc / pin-row / error…  </header>
line 252       <PovStatusNotice status={povResolution} variant="banner" />
                                                     ← ★ INSERT THE PANEL HERE ★
line 254-282   {isPinned && (<div className="bs-tag-tablist" role="tablist">…</div>)}
line 286-292   <section className="bs-tag-rows" role="tabpanel" hidden={activeTab !== 'default'}>
line 294-313     <div className="bs-tag-view-switch">  ← the Profiles | Notes switch
```

**Decision: a page-level `<section>` inserted after line 252 (`<PovStatusNotice/>`) and before the line-254 tab-strip comment** — a **sibling of the tab strip**, not a child of the default `<section className="bs-tag-rows">` tabpanel. I concur with the PO's recommendation (b); the line numbers confirm its premises.

**The tab-visibility consequence — this is the whole reason for the placement.** The `bs-tag-rows` tabpanel at line 286 carries `hidden={activeTab !== 'default'}`. Had the panel gone inside it (the naive reading of "above the Profiles|Notes button", since that switch lives at line 294 *inside* that panel), then a viewer who opened the panel and switched to the **Pinned** tab would see the panel **vanish while the header menu still read "Hide Raw Event"** — the exact state AC-5 forbids ("there is no state in which the menu reads 'Hide Raw Event' while no panel is visible"). The toggle lives in the always-visible header (line 227-250, outside every tabpanel), so the thing it toggles must be too. Placement is forced by where the toggle is.

Ordering honored in both branches: signed in, `</header>` ends with the Pin row (line 234-246) ⇒ panel is below the Pin button and above the Profiles|Notes switch ✅. Signed out, the pin row is absent (`{user && tag && …}`) and the panel still lands between the header block and the switch ✅. **Below** `PovStatusNotice` rather than above, so a tall JSON blob can never push a page-level status banner out of view.

The one deviation from a literal reading of the ask — the panel is not strictly *adjacent* to the Pin button (`PovStatusNotice` and, when pinned, the tab strip sit between) — is inherited from AC-5 and flagged, not silently taken.

### D4 — Where the toggle state lives

#### Option A — `rawOpen` state in `Tag.jsx`, passed to the menu as props *(chosen)*
`const [rawOpen, setRawOpen] = useState(false);` in `Tag.jsx` (alongside the existing `notesMode`, `activeTab`, `viewOptionsExpanded`, … at lines 53-66). Passed down as `rawOpen={rawOpen}` and `onToggleRaw={() => setRawOpen(o => !o)}`.
**Pros.** The menu (header, line ~228) and the panel (line ~253) are **siblings**; their only common ancestor that can hold shared state is `Tag.jsx`. Default-hidden (AC-5) is just `useState(false)`. Matches the page's existing state-in-`Tag.jsx` convention exactly.
**Cons.** Two more props. Trivial.

#### Option B — state inside `TagActionsMenu`
**Cons.** The panel would have to render *inside* the menu component to read the state — putting a full-width page-level JSON panel inside a `position:relative` dropdown container that sits in the h1's flex row. It would inherit the dropdown's positioning context and land in the wrong place in the DOM order. Rejected. (Lifting via a callback while *also* keeping the boolean inside the menu would duplicate the source of truth — the classic two-sources-of-truth bug.)

**Decision: Option A.** State lives in `Tag.jsx`; the menu is presentational w.r.t. the panel.

**Does the menu close after a click? No — it stays open.** This is deliberate parity, verified in the emulated component: `NoteActionsMenu`'s handlers (`doCopy`, `copyLink`, `NoteActionsMenu.jsx:54-67`) only ever call `flashMsg` — **none** of them calls `setOpen(false)`. The menu closes on click-outside (`:28-34`) or on a second kebab click (`:74`), never on select. AC-2 codifies this ("selecting an item leaves the menu open"), and it is materially better for the Show/Hide item: the label flips in place (`{rawOpen ? 'Hide Raw Event' : 'Show Raw Event'}`) so the viewer can toggle straight back without reopening the menu. Do **not** add a `setOpen(false)` — that would diverge from the convention this story exists to emulate.

### D5 — `naddr` construction and the "if replaceable" conditional

**The exact call:**

```js
// TagActionsMenu.jsx
import { nip19 } from 'nostr-tools';

// The tag's stable coordinate is `39999:<tag.authorPubkey>:<tag.slug>`
// (ui/src/utils/publishProfileTag.js:64, ADR-0022). naddr encodes that
// coordinate — kind + the TAG ELEMENT'S OWN AUTHOR + the d-tag/slug.
let naddr = null;
if (/^[0-9a-f]{64}$/.test(tag?.authorPubkey || '') && tag?.slug) {
  try {
    naddr = nip19.naddrEncode({
      kind: 39999,
      pubkey: tag.authorPubkey,   // ← the tag element's author. NOT the TA.
      identifier: tag.slug,       // ← the d-tag value.
    });
  } catch { naddr = null; }
}
```

**The exact pubkey: `tag.authorPubkey`** — the tag element's own author, delivered as runtime data in the `by-id` response body (`index.js:818`, `authorPubkey: ev.pubkey`). For `stoicism` that is vinney's `2efaa715…7331`.

**The guard condition.** Signature verified: `naddrEncode(addr)` calls `hexToBytes(addr.pubkey)` (`nip19.js:189`) and `utf8Encoder.encode(addr.identifier)` (`:187`) — both **throw** on malformed/undefined input. So: guard on `authorPubkey` matching `/^[0-9a-f]{64}$/` **and** a truthy `slug`, plus a `try/catch` → `naddr = null`. The regex guard mirrors the established precedent at `publishProfileTag.js:55`, which validates the identical field before composing the identical coordinate. A `null` naddr then flows into the existing `doCopy(null, 'Addr')` path, which flashes `"Addr unavailable"` (`NoteActionsMenu.jsx:55`) — AC-6's degradation, for free, via the emulated convention.

**On the ask's "(if it is a replaceable event)".** Kind 39999 is inside the 30000–39999 **addressable/parameterized-replaceable** range, so for a tag definition this conditional is **always true** — the story's AC-4 says as much ("Kind 39999 is addressable, so this item is available for every tag definition"). The item is therefore rendered unconditionally; the guard above is defensive against *missing data*, not against a non-addressable kind. Do not build a kind-range branch — there is no reachable false case on this surface, and a dead branch would imply the page renders non-addressable events, which it does not.

**No TA literal is involved — and why ADR-0015's `LEGACY_*` constants do NOT apply here.** A reviewer will check this (CLAUDE.md § "Per-deployment TA pubkey"), so stating it precisely:

- **Two different composites are in play, and they are not interchangeable.** ADR-0015's named exception governs the **`z`-tag concept handle** — `39998:<LEGACY_Z_TAG_PUBKEY>:tag`, a pointer from an event to the *concept it instantiates* (`index.js:49,59-61`; `publishTagPin.js:47-48`). This feature composes the **`a`-coordinate** — `39999:<authorPubkey>:<slug>`, the address of the *tag element itself*. Different kind (39998 vs 39999), different pubkey role (concept owner vs event author), different purpose (classification vs addressing).
- **The `z`-tag literal is wire-binding; the coordinate is data.** ADR-0015 froze the `z` literal because changing it orphans historical events. Nothing analogous exists here: the naddr is *derived from the event we just fetched*, so it is correct by construction on every deployment.
- **Substituting either `LEGACY_*` constant, or the runtime TA, would be a bug** — it would emit an address for an event that does not exist (`39999:<TA>:stoicism` is not vinney's tag), and "Copy Note Addr" would yield a dead address on every tag not authored by the TA, i.e. essentially all of them. This is the same shape as the reference incident in CLAUDE.md (readers filtering on a pubkey the writer never used), which is why AC-7 names it.
- Therefore: `TagActionsMenu.jsx` **must not** import `LEGACY_TA_PUBKEY` / `LEGACY_Z_TAG_PUBKEY`, **must not** call `useConfig().taPubkey`, and **must not** contain a 64-hex constant. It needs no TA at all. The panel likewise renders the `z` tags it received as data — **read and displayed, never recomposed**.

### D6 — Styling

**Reuse `bsp-note-menu*` for the menu; new `bs-tag-raw-*` for the panel.** The menu is a deliberate visual clone (AC-1/AC-2 emulation) — reusing the classes *is* how "emulate" is enforced in CSS, and it guarantees the two kebabs cannot drift apart. The panel is a new tag-page element with no `bsp-` analogue, so it takes the page's `bs-tag-*` convention.

**Floating the kebab right of the h1.** `.bsp-note-menu` already declares `margin-left:auto; flex:none; align-self:flex-start` (`styles.css:7551-7556`) — but `margin-left:auto` only pushes right **inside a flex container**, and `.bs-tag-header` is a plain block (`:4770-4774`). So the h1 needs a **flex row wrapper**; then the existing class does the work unchanged:

```css
/* tag-event-inspector #1 — the h1 + ⋯ row. Flex so .bsp-note-menu's
   existing `margin-left:auto` floats the kebab right (styles.css:7551). */
.bs-tag-name-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
.bs-tag-name-row .bs-tag-name {
  min-width: 0;              /* flex items default to min-width:auto, which
                                refuses to shrink below content — a long tag
                                name would then force horizontal overflow. */
  overflow-wrap: anywhere;   /* long unbroken tag names wrap instead of pushing
                                the kebab off-screen. */
}
```

`<h1 className="bs-tag-name">` keeps its class and its `margin: 0 0 0.4rem` (`:4775-4780`) — harmless as a flex item. The wrapper goes *inside* `<header className="bs-tag-header">`, around the h1 only; `bs-tag-desc` / `bs-tag-pin-row` stay as sibling blocks below it, so the header's existing vertical rhythm is untouched (AC-7).

**The panel.** Modeled on the in-repo precedent `.cypher-query` (`:1598-1610`), which solves exactly this problem (a wrapped, scroll-capped code block):

```css
/* tag-event-inspector #1 — raw tag-definition event panel. */
.bs-tag-raw {
  margin: 0 0 1.5rem;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
}
.bs-tag-raw-title {
  font-size: 0.8rem;
  color: var(--text-muted, #94a3b8);
  margin: 0 0 0.5rem;
}
.bs-tag-raw-pre {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--text-primary, #e2e8f0);
  white-space: pre-wrap;     /* keep JSON.stringify's indentation, but wrap long
                                lines instead of scrolling horizontally. */
  word-break: break-all;     /* 64-char ids / 128-char sig have no break
                                opportunities; without this they overflow. */
  max-height: 60vh;          /* a pathological `content` can't swallow the page. */
  overflow-y: auto;
}
```

**No horizontal overflow at 1280px** (the constraint the closed `event-page` book enforced): the page sits in `.main-content { max-width: 1200px; padding: 24px 32px }` (`:125-131`). The two overflow risks are both closed above — (i) the `sig`/`id` hex runs and any long `content` string, handled by `white-space:pre-wrap` + `word-break:break-all`, so the `<pre>` **never** scrolls horizontally; (ii) a long tag name in the new flex row, handled by `min-width:0` + `overflow-wrap:anywhere`. Rendering wrapped is a *display* concern and does not compromise AC-6's byte-faithfulness — the text content is `JSON.stringify(tag.rawEvent, null, 2)`, unmodified.

## Decision

Summary of the six decisions:

| # | Decision |
|---|---|
| **D1** | **Option A** — `by-id` returns `tag.rawEvent`, a **7-field whitelist** (`toRawEvent(ev)`), never a spread of `ev`. Nested under `tag` so `useTagDetail` needs no change. |
| **D2** | **Option A** — new sibling `ui/src/components/TagActionsMenu.jsx`; reuse `bsp-note-menu*` CSS + `copyText`. Record the shared-shell extraction in `_intake.md` for when a third menu appears. |
| **D3** | Page-level `<section>` after `Tag.jsx:252` (`<PovStatusNotice/>`), **sibling of** the tab strip — never inside the `hidden`-toggled `bs-tag-rows` tabpanel. |
| **D4** | `rawOpen` state in `Tag.jsx`, passed down as `rawOpen` / `onToggleRaw`. The menu **stays open** on select (verified convention). |
| **D5** | `nip19.naddrEncode({ kind: 39999, pubkey: tag.authorPubkey, identifier: tag.slug })`. Guard: 64-hex `authorPubkey` **and** truthy `slug`, in a `try/catch`. **No TA literal, no `LEGACY_*`.** |
| **D6** | New `.bs-tag-name-row` flex wrapper (lets `.bsp-note-menu`'s existing `margin-left:auto` work); `.bs-tag-raw*` panel modeled on `.cypher-query`. `pre-wrap` + `break-all` + `min-width:0` close both 1280px overflow paths. |

## Architecture invariants (CLAUDE.md) — explicit findings

**POV-invariance (invariant #1 — "there is no 'the view,' only views from a perspective").** This feature is the *exception that proves the rule*, and it must be stated so a reviewer can check it. A signed nostr event is **not** a per-POV projection — it is the bytes the author signed, byte-identical from every point of view, and its `id` is a hash over those bytes. It therefore **must not** be POV-namespaced (no `rawevent_<8charsuffix>` column), **must not** be POV-filtered, and **must not** be gated on the POV's WoT. `handleTagById`'s scan is `federatedScan({ kinds:[39999], ids:[tagEventId] })` — an id lookup with no POV input (`index.js:766`), and `rawEvent` is projected straight off that result with no POV in its path. Note the sharp boundary: the **taggings around** the tag (the `profiles-tagged` rows, `wot_rank_<suffix>` sorting) are emphatically per-POV; the **definition event itself** is not. Applying invariant #1 here would be a category error — POV governs *whose assertions count*, not *what an event says*. Reviewer check: no `povSuffix` / `wotPov` / `viewerPubkey` anywhere in `rawEvent`'s path.

**Decentralized-first (invariant #2 — "publishing is permissionless; aggregation is opinionated").** The tag author is **arbitrary** — anyone may publish a kind-39999 tag element, and the live proof is that `stoicism` is authored by vinney (`2efaa715…`), not by any TA. Reflex-check #3 ("could anyone else publish their own version of this?") answers **yes**, so: the menu **must not** gate on the author being the TA, being known, being trusted, or being in the viewer's WoT. `TagActionsMenu` receives `tag` and renders — it performs **no authorship check whatsoever**. Nor is there an *auth* gate: inspection is a read over public data, so unlike the login-gated `bs-tag-pin-row` (`Tag.jsx:234`), the menu renders signed-out (AC-1). D5's naddr construction is the concrete expression of this — it encodes *whoever authored the event*, which is why hardcoding a TA there would be both a no-hardcode violation and a decentralization violation at once.

**Filter at view time (invariant #3).** Nothing is denormalized or precomputed. `rawEvent` is a projection of a scan result computed per request, and the panel's visibility is pure client state. Nothing is stored.

**Firmware reinstall required? No.** No concept definitions change; the `tag` / `nostr-event` / `tag-pinning` concepts are read-only context here.

## Test strategy

Being explicit about the three layers, and honest about the environment.

**1. Testable by the existing `node test/test.js` HTTP-contract suite — the API half (D1).** This is the layer Option A buys, and the argument is load-bearing: `test/tag-detail.test.js` already covers `/api/profile-tags/by-id` in exactly the right style (`fetchJson` against `BRAINSTORM_BASE_URL || http://localhost:7778`, with a `controlPanelReachable()` guard). New assertions belong there and cost nothing structurally:
   - `by-id` for a known tag returns `tag.rawEvent` present, an object.
   - `tag.rawEvent` has **exactly** the 7 canonical keys — a set-equality assertion, which is what makes the whitelist (not the spread) mechanically enforced. This is the test that would have caught the nostr-tools-upgrade failure mode in D1.
   - `tag.rawEvent.id === tag.eventId` and `=== the requested tagEventId`; `tag.rawEvent.kind === 39999`; `tag.rawEvent.pubkey === tag.authorPubkey`.
   - `tag.rawEvent.tags` contains a `['d', <tag.slug>]` entry — the slug/d-tag identity AC-4's naddr depends on.
   - The existing 400/404 contracts still hold (additive change).
   - Local fixture available: eventId `5633f149de1dd8635d9b45c77ab44c7decf2ad179b76898340ed1be2537e975d` (slug `cpc-tag-s12b-1784175857927-1vizzi`, author `c06d93c9…`), one of 7449 local kind-39999 events.

**2. Needs Playwright — the UI half (D2–D6).** The node harness **cannot transpile JSX** (recorded at `_intake.md`, the `NoteCard` render-test note), so every AC touching the menu or panel lands in `tests/brainstorm/*.spec.js`, following the established route-mocking pattern (`tag-detail-write.spec.js:50`, `pin-a-tag.spec.js:48` both already mock `**/api/profile-tags/by-id**` — the mock simply gains a `rawEvent`). Coverage: kebab renders right of the h1 and **signed out** (AC-1); exactly three items in order, labels flip Show↔Hide (AC-2); menu **stays open** on select; click-outside closes; clipboard content for id (AC-3) and naddr — decode it and assert kind/pubkey/identifier, with a **non-TA author fixture** so a TA-hardcode regression fails loudly (AC-4); default-hidden, toggles, and — the placement regression that D3 exists to prevent — **panel stays visible across a Taggings↔Pinned tab switch** (AC-5); all 7 fields rendered, and the `rawEvent`-absent mock degrades to `"Raw Event unavailable"` with no panel and no throw (AC-6).

**3. Verify-by-driving only.** Visual placement/overflow at 1280px (D6) and the real clipboard against a real browser — per `/verify`, drive the local stack at `http://localhost:7778/tag/cpc-tag-s12b-1784175857927-1vizzi/5633f149de1dd8635d9b45c77ab44c7decf2ad179b76898340ed1be2537e975d`.

**Known-FAIL local environment — do not misread the gate.** A full local `npm test` reports **Overall:FAIL for environmental reasons** (11 tag/pin/TL suites; `OPEN.md` #27) because the local Neo4j graph is near-empty. Nobody should claim a green local suite, and a tail-view of the output will hide this. The binding gates are: **(a)** a **differential** comparison against the `origin/staging` baseline — same suites failing before and after, no *new* failures; and **(b)** CI's stack-free run (`.github/workflows/test.yml`, required on `main`). Behavior that depends on a populated WoT/graph is verified on **staging**, and the tag data is richest on `feat/tags` — which is where this ships per the book's plan.

## Implementation notes

Concrete, in dependency order. The Implementer should not need to re-derive anything above.

- **`src/api/profile-tags/index.js`** — add `toRawEvent(ev)` (the 7-field whitelist, code in D1) near `handleTagById` (declared :757). In the `res.json` at **:811-823**, add `rawEvent: toRawEvent(ev)` as a field of the `tag` object (after `createdAt`, :819). Additive; no other response field changes. Do **not** touch the `viewerPin` scan, the `author` block, or `available-tags`.
- **`ui/src/hooks/useTagDetail.js`** — **no change**. `setTag(data.tag)` (:60) already carries `rawEvent` through.
- **`ui/src/components/TagActionsMenu.jsx`** — **new**. Model on `NoteActionsMenu.jsx` (98 lines): copy the `menuRef` + `mousedown` click-outside effect (:28-34), `flashMsg` (:49-52), `doCopy` (:54-62), and the `bsp-note-menu` / `-btn` / `-dropdown` / `-item` / `-flash` markup (:69-97) including `aria-label` / `aria-haspopup="menu"` / `aria-expanded` / `role="menu"` / `role="menuitem"` / `role="status"`. Props: `{ tag, rawOpen, onToggleRaw }`. Compute `naddr` per D5. `if (!tag?.eventId) return null;` — the no-dead-menu guard, mirroring `:47` and satisfying AC-1's "tag not loaded ⇒ no menu". Items, in order: `Copy Note ID (event id)` → `doCopy(tag.eventId, 'Event ID')`; `Copy Note Addr` → `doCopy(naddr, 'Addr')`; then the toggle → label `{rawOpen ? 'Hide Raw Event' : 'Show Raw Event'}`, `onClick` = if `!tag.rawEvent` then `flashMsg('Raw Event unavailable')` else `onToggleRaw()`. **No `setOpen(false)` in any handler** (D4). *(Note the emulated convention: `doCopy`'s second arg is the flash noun, not the item label — `doCopy(x,'Event ID')` flashes "Event ID copied", and `doCopy(null,…)` flashes "Event ID unavailable" for free.)*
- **`ui/src/pages/Tag.jsx`** —
  - import `TagActionsMenu`; add `const [rawOpen, setRawOpen] = useState(false);` beside the existing state (:53-66).
  - **:228-230** — wrap the `<h1 className="bs-tag-name">` in `<div className="bs-tag-name-row">`, with `<TagActionsMenu tag={tag} rawOpen={rawOpen} onToggleRaw={() => setRawOpen(o => !o)} />` as its second child. Leave `bs-tag-desc` (:231), `bs-tag-pin-row` (:234) and the error line (:247) exactly as they are — **outside** the new wrapper.
  - **after :252** (`<PovStatusNotice/>`), before the :254 tab-strip comment — insert the panel, page-level:
    ```jsx
    {rawOpen && tag?.rawEvent && (
      <section className="bs-tag-raw" aria-label="Raw tag definition event">
        <p className="bs-tag-raw-title">Raw event — kind 39999 tag definition</p>
        <pre className="bs-tag-raw-pre">{JSON.stringify(tag.rawEvent, null, 2)}</pre>
      </section>
    )}
    ```
    The `tag?.rawEvent` conjunct is belt-and-braces with the menu's own guard (AC-6: no empty panel that could read as "this tag has no definition").
- **`ui/src/styles.css`** — append `.bs-tag-name-row` (+ its `.bs-tag-name` overrides) and `.bs-tag-raw` / `-title` / `-pre` per D6. **Do not modify** any `.bsp-note-menu*` rule — the feed menu shares them (AC-7).
- **`engineering-team/stories/_intake.md`** — add the shared-`<ActionsMenu>`-extraction entry from D2.

## Out of scope

- **Extracting the shared `<ActionsMenu>` shell** — deferred to the third menu (D2); recorded in `_intake.md`.
- **Escape-to-close** — no menu handles it; a convention change belongs in a story that touches *every* menu.
- **Making a copied `naddr` resolve on this instance's `/event` page** — `/event` renders kind-1 only and answers a kind-39999 naddr with "kind ‹N› not yet supported". The naddr this ADR emits is valid for other clients; making it resolve here is a separate story (the `event-page` book is closed).
- **Re-parenting the `tag` concept off the ADR-0015 `LEGACY_*` literal** — untouched. This ADR only *reads and displays* `z` tags. A reviewer seeing `LEGACY_*` constants removed in this story's diff must reject (CLAUDE.md).
- **Raw-event inspection on any other surface**, syntax highlighting / JSON tree / copy-blob button, signature verification, and the "Note" vs "Event" vocabulary question (story open question (a) — recommendation: keep the user's labels; renaming is a follow-up across both surfaces).
- **Any change to `available-tags`**, the Pin login gate, or the `profiles-tagged` POV path.
