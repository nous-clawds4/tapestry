# Story 1: Tag actions menu and raw event inspector on the tag detail page

**Epic:** tag-event-inspector
**Status:** Draft
**Created:** 2026-07-16
**Type:** Feature

## Background

The tag detail page (e.g. `/tag/stoicism/225d62905785e379e70c258490dee2c8813db289c66f694a4a030bb9e60dc908` on `tags.brainstorm.world`) shows a tag's name, its description, a Pin button, and the profiles and notes carrying that tag. What it never shows is the thing all of that is derived from: **the signed nostr event that defines the tag**.

That event is a kind-39999 tag element published by an ordinary user — the `stoicism` tag is authored by vinney, not by the instance's Tapestry Assistant — carrying the slug in its `d` tag, the name and description as JSON content, and `z` tags binding it to the `tag` concept. Reading any of that today means leaving the product: hand-hitting a scan endpoint, or pasting the id into another nostr client. For a protocol whose premise is that assertions are public signed events anyone can audit, the definitional event being invisible on its own page is a gap. Operators debugging federation ("did this arrive with both `z` tags?"), developers learning the wire format, and readers deciding whether to trust a tag all want the same thing: *show me the event*.

The page also lacks the per-object action affordance every Profile and Note row on it already has — the `⋯` menu that copies identifiers. The tag, the page's primary object, has none.

**Who is affected:** anyone reading a tag detail page, signed in or signed out.

## User-facing description

As **someone reading a tag's page**, I want a three-dot menu beside the tag name that copies the tag's identifiers and toggles a view of the raw signed event that defines it, so that I can inspect, cite, and verify a tag's definition without leaving the page or having to trust the page's rendering of it.

## Acceptance criteria

*Seven criteria, but one affordance on one surface: a menu, its three items, and the panel one of them toggles. They are facets of a single user-visible capability, not a multi-subsystem story — so this is deliberately not split.*

- [ ] **AC-1 (menu presence, placement, and no auth gate):** Given a tag detail page whose tag has loaded, a `⋯` button is rendered floated to the right of the tag name, near the top of the page. It is present **whether or not the viewer is signed in** — inspection is a read affordance over public data, and unlike the Pin row in the same header it carries no login gate. Given a tag that has not loaded (or was not found), no menu renders — no dead affordance. Clicking the button toggles a dropdown open and closed; clicking outside it closes it. The button exposes an accessible name and its expanded state; the dropdown is exposed as a menu.

- [ ] **AC-2 (exactly three items, with these labels):** Given the menu is open, it offers exactly three items, in this order: **"Copy Note ID (event id)"**, **"Copy Note Addr"**, and a third whose label is **"Show Raw Event"** when the panel is hidden and **"Hide Raw Event"** when it is shown. No other items. Per the emulated convention, selecting an item leaves the menu open and reports the result in a transient in-menu message; the Show/Hide label flips in place on the same click that toggles the panel.

- [ ] **AC-3 (Copy Note ID):** Given the menu is open, when the viewer selects "Copy Note ID (event id)", then the clipboard contains exactly the tag definition event's 64-character hex event id — the same id in the page's URL — and a transient confirmation is shown. On a copy failure the viewer sees a visible failure message, not silence.

- [ ] **AC-4 (Copy Note Addr — encoded from the tag's own author, not the TA):** Given the menu is open, when the viewer selects "Copy Note Addr", then the clipboard contains a bech32 `naddr` for the tag definition which decodes to exactly kind `39999`, the **tag element's own author pubkey**, and the tag's **slug** (the value in its `d` tag). Concretely: for a tag authored by a non-TA pubkey — such as `stoicism`, authored by vinney — the copied naddr decodes to *that author's* pubkey, never the instance's TA pubkey and never a `LEGACY_*` literal. Kind 39999 is addressable, so this item is available for every tag definition; if either the author pubkey or the slug is missing, it degrades per AC-6 rather than emitting a wrong or partial address.

- [ ] **AC-5 (raw event panel — default hidden, toggles, and where it lives):** Given a freshly loaded tag detail page, the raw event panel is **hidden**; nothing about the page's existing layout shifts. When the viewer selects "Show Raw Event", the panel appears **below the tag header block (which ends with the Pin button when signed in) and above the Profiles|Notes switch**; selecting "Hide Raw Event" removes it. The panel's visibility is governed **solely by this toggle**: it is not scoped to a tab, so switching between the Taggings and Pinned tabs neither hides a shown panel nor shows a hidden one — there is no state in which the menu reads "Hide Raw Event" while no panel is visible. Signed out, with no Pin button present, the panel still lands between the header block and the Profiles|Notes switch. *(See open question (b): the ask's "below Pin, above Profiles|Notes" is an ordering constraint, honored here; strict adjacency to the Pin button is not, because two page-level elements already sit between them.)*

- [ ] **AC-6 (full signed event, and honest degradation when it is absent):** Given the panel is shown and the raw event is available, it renders the **complete signed event as published** — `id`, `pubkey`, `created_at`, `kind`, `tags` (every entry, including the `d` tag and both `z` tags), `content`, and `sig` — as formatted, readable JSON, with no field omitted, truncated, or reordered into a summary. The rendering is byte-faithful to the event as signed. Given the raw event is **not** available (e.g. a control panel that predates this story's data, or a response missing the field), then: the menu still opens; "Copy Note ID" and "Copy Note Addr" still work; selecting the raw-event item shows a visible "unavailable" message and opens no panel — following the emulated menu's existing `"<label> unavailable"` convention. Nothing throws, and no empty panel is shown that could be misread as "this tag has no definition".

- [ ] **AC-7 (non-regression and invariants):** The existing `⋯` menu on Profile and Note rows is unchanged — same items, same labels, same behavior — and this story adds no item to it. The Pin button, its login gate, the Taggings|Pinned tab strip, the Profiles|Notes switch, and the tagging rows all behave exactly as before, both signed in and signed out. **No TA pubkey literal is introduced**: no 64-hex pubkey constant, no import of `LEGACY_TA_PUBKEY` / `LEGACY_Z_TAG_PUBKEY`, and no TA lookup, is used to build the naddr or the panel. **The panel is POV-invariant**: the bytes shown do not vary with the active POV and are not filtered, namespaced, or gated by it — a signed event is the same event from every point of view.

## Product decisions (settled at Planning)

Settled here rather than left to the Implementer, since the ask says "emulate" and the emulated component's conventions answer these directly:

1. **Menu stays open on select.** The emulated `⋯` menu keeps its dropdown open and reports outcomes in an in-menu transient line rather than closing on click. Both copy items and the Show/Hide item follow that: the label flips in place, so a viewer can toggle straight back. Deliberate parity, not oversight.
2. **Degradation reports, it doesn't hide.** The emulated menu's convention for a value it cannot produce is to keep the item and flash `"<label> unavailable"` on select. AC-6 adopts it, rather than hiding or disabling the item — one convention for "can't do that", page-wide.
3. **Inspection is not login-gated** (AC-1). The Pin row beside it is, because pinning is an authored assertion; reading a public event is not.
4. **The panel is page-level, not tab-scoped** (AC-5). The toggle lives in the always-visible header, so the panel it controls must be visible from wherever that toggle can be reached.

## Concepts touched

- `39998:<this instance's TA>:tag` — **tag**. The concept whose element this page's subject *is*: the kind-39999 event the panel displays. Handle pubkey is per-deployment; resolve at runtime, never hardcode. The element's own `z` tags bind it to this concept under the ADR-0015 legacy literal — that composition is **read and displayed** by this story, never rewritten.
- `39998:<this instance's TA>:nostr-event` — **nostr event**. What the panel renders: the cryptographically signed event as published.
- `39998:<this instance's TA>:tag-pinning` — **tag pinning**. Adjacent only. The Pin affordance shares the header the new menu lands in; this story touches its layout neighborhood and must not touch its behavior (AC-7).

## Out of scope

- **Editing or republishing the tag definition.** Read-only inspection.
- **Raw-event inspection anywhere else** — Profile rows, Note rows, the tag index, the Pinned tab's contents. This story is the tag *definition* event on the tag *detail* page, full stop.
- **Adding a fourth "Copy Note Link" item** for parity with the Note row menu. The user named three items; the page URL already carries both slug and event id. See open question (c).
- **Making a copied naddr resolve on this instance's own `/event` page.** `/event` renders kind-1 only and answers a kind-39999 naddr with "kind ‹N› not yet supported" — so a copied naddr won't render here today (it remains valid for other clients). Known limitation, worth a separate story; the `event-page` book is closed.
- **Escape-to-close, or any other a11y improvement to the `⋯` convention.** No existing menu handles Escape. Adding it here alone creates divergence; adding it everywhere is a separate story against every menu.
- **Syntax highlighting, a collapsible JSON tree, or a copy-the-whole-blob button.** Plain formatted JSON is the bar.
- **Showing the tag's other related events** — taggings, pins, disputes, the concept header. The definition event only.
- **Client-side signature verification.** Displaying `sig` is not validating it.
- **Any change to the Pin row's login gate.**

## Open questions

Recorded with a recommendation each; none blocks Architecture. The operator can overrule any of them at the Planning gate.

- **(a) "Note" wording for an object that isn't a note.** "Copy Note ID" / "Copy Note Addr" say *Note*, but a tag definition is a kind-39999 tag element, not a kind-1 note. **Recommendation: keep the user's exact labels.** Three reasons: the user wrote them; the ask's stated intent is to *emulate* the row menus, and "Copy Note ID (event id)" is verbatim an existing item there; and "Note ID / Note Addr" is idiomatic nostr-speak for event id / event address, with the "(event id)" parenthetical already disambiguating. "Copy Event ID / Copy Event Addr" would be more precise — but adopting it *here only* puts two vocabularies for one operation on a single page, which is worse than one imprecise-but-consistent vocabulary. If precision wins, rename both surfaces together in a follow-up.

- **(b) Where exactly the panel goes.** "Below the Pin button and above the Profiles|Notes button" is ambiguous: the POV status banner and the Taggings|Pinned tab strip already sit between those two, and the Profiles|Notes switch lives *inside* the default tab's panel — which is hidden when the Pinned tab is active. **Recommendation: a page-level region, below the header block and the POV status banner, above the Taggings|Pinned tab strip — a sibling of the tab strip, not a child of the default tab's panel.** Justification: (i) the ordering the user asked for is honored in both the signed-in and signed-out branches; (ii) inside the default tab panel, the panel would *vanish* when the viewer switched to Pinned while the header menu still read "Hide Raw Event" — the toggle is in the always-visible header, so the thing it toggles must be too; (iii) the Pin row is login-gated, so anchoring literally "below Pin" is fragile — anchoring below the *header block* degrades correctly when signed out; (iv) below the POV banner rather than above it, so an expanded JSON blob can never push a page-level status notice out of view. The cost is that the panel is not strictly *adjacent* to the Pin button. Flagging that explicitly as the one place this deviates from a literal reading of the ask.

- **(c) naddr vs event id — two identities with different meanings.** The ask requests both, and both should ship. Worth stating the semantic consciously: the **event id pins this exact version** of the definition — if the author edits the tag's name or description and republishes, the id changes and the copied one may stop resolving; the **naddr is the durable identity** and always resolves to the *latest* version. Both are legitimately useful — the id for "cite exactly the bytes I read", the naddr for "point at this tag". **Recommendation: ship both, with the user's labels and no extra explanatory copy in the menu** — an inline semantics lecture in a three-item dropdown costs more than it teaches, and the audience reaching for a raw-event viewer generally knows the difference. Related, and also recommended **against** for now: a fourth "Copy Note Link" item (page URL), which the row menu has and the user did not ask for. Both are cheap to add later if the operator wants them.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
