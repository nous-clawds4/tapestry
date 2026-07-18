# Epic: tag-event-inspector

**Created:** 2026-07-16
**Status:** Active (**reopened 2026-07-16**, same day as its retirement, by story #2)

> **Why it reopened.** It was retired at the `tag-event-inspector` book close on the strength of its one story shipping to production. That was premature: the epic's goal is the events behind tag **surfaces**, plural, and one story on one object type does not meet it. The book's own return edge said as much within hours — `audits/tag-event-inspector/prd-seed.md` lists raw-event inspection on **Profile rows** as *"the obvious generalization, deliberately not taken"* and asks outright whether this is *"a page feature or a product pattern"*. Story #2 answers: a pattern. Note the epic reopened while its **first book stayed closed** — that book's four-bullet acceptance frame was fully met and remains met. Story #2 is a new bounded ask under a new book (`audits/profile-tagging-inspector/`). An epic may span books; a met frame is not reopened.

## Goal

**Make the signed nostr events behind tag surfaces directly inspectable in-product.** A tag detail page renders a name, a description, and a pile of taggings — all of it derived from events anyone can fetch and verify, none of which the page will show you. This epic closes that gap, starting with the event that matters most: the **tag definition** itself.

Scope of the epic is inspection affordances on tag surfaces — read-only views of the underlying events, plus the identifier-copying actions that let a reader cite or resolve them elsewhere. It is not a protocol epic and not an editing epic.

## Why it matters

Tapestry's premise is that assertions are public, signed, and auditable by anyone. A UI that renders those assertions while hiding the events they came from asks the reader to trust the rendering — exactly the posture the protocol exists to avoid. Concretely, three readers want the same thing today and all three have to leave the product to get it:

- **Operators** debugging federation — "did this tag arrive with both `z` tags, or just one?" The tags-federation census (2026-07) turned on questions of exactly this shape.
- **Developers** learning the wire format — the tag family's on-the-wire shape is currently learnable only from source or a raw relay scan.
- **Readers** deciding whether to trust a tag — who authored this definition, and when?

The `⋯` menu on Profile and Note rows already established the per-object action affordance on these very pages. The tag — the page's *primary* object — doesn't have one.

## Stories

1. `stories/done/tag-event-inspector/1-tag-actions-menu-and-raw-event.md` — a `⋯` actions menu beside the tag name (Copy Note ID / Copy Note Addr / Show–Hide Raw Event) plus a default-hidden raw event panel on the tag detail page. **Done** — review PASS, shipped to production (book `audits/tag-event-inspector/`, closed). *(This line read "Draft" until 2026-07-16; the story was Done and shipped. Corrected at the #2 reopen.)*
2. `stories/tag-event-inspector/2-tagging-raw-event-inspector.md` — the raw signed events behind a **profile row's `+N −M`**: a Show/Hide Raw Event item on the row's `⋯` menu (now reachable at every width, not only below 769px) toggling a per-row panel that renders every assertion the row's counts are derived from. **Done** — review PASS (book `audits/profile-tagging-inspector/`, closed). *(This line read "Approved" until 2026-07-17; corrected at the #3 open, mirroring the #1 correction before it.)*
3. `stories/tag-event-inspector/3-note-tagging-raw-events-inspector.md` — the raw signed events behind a **note's tag chips**: a "Show/Hide Raw Tagging Events" button in the chip popover, beside Apply/Dispute, toggling a per-(note, tag) panel between the note body and the chips row that renders every assertion the popover's counts are derived from — on every note surface. **Approved** (book `audits/note-tagging-inspector/`).

## Key facts / guardrails

- **A tag definition is a kind-39999 event authored by an ordinary user — not by the Tapestry Assistant.** The `stoicism` tag on `tags.brainstorm.world` is authored by vinney. Anyone may publish a tag (decentralized-first): no affordance in this epic may gate on the author being the TA, or on the author being known/trusted at all.
- **The `naddr` for a tag definition is composed from the tag element's own author pubkey + its slug** — `39999:<tag.authorPubkey>:<tag.slug>`, the coordinate already canonical at `ui/src/utils/publishProfileTag.js` (ADR 0022). **Not** the TA pubkey and **not** the ADR-0015 `LEGACY_*` literals: those govern only the `z`-tag concept-handle composition, a different thing. Kind 39999 is in the 30000–39999 addressable range, so a tag definition always has an naddr.
- **Never hardcode the TA pubkey** (CLAUDE.md § "Per-deployment TA pubkey"). It differs per deployment — the local stack's concept graph currently answers `e00ed090…`, while CLAUDE.md documents `82b75e47…` for this machine. That divergence is itself the argument: resolve at runtime or don't touch it.
- **An event's bytes are POV-invariant; which events are in view may not be.** *(Amended 2026-07-16 at the #2 reopen — the original wording collapsed two different claims into one and, read literally, forbade story #2. Both halves below are binding.)*
  - **The bytes: always POV-invariant.** An event is the bytes its author signed, identical from every point of view, and its `id` is a hash over them. No inspection surface in this epic may POV-namespace, POV-filter, POV-annotate, or POV-gate *the contents of an event*. Rendering the same event differently to two POVs would be a category error — POV governs *whose assertions count*, never *what an event says*.
  - **The set: depends on what the panel is a panel of.** Story #1 shows a tag's **definition** event — one event, reached by id, no POV in its path, so the set is POV-invariant too. Story #2 shows the assertions behind a row's `+N −M` — and that number is per-POV, so the set behind it is per-POV **by construction**. That is not a violation of POV-first; it is an expression of it. Such a set must be computed at read time from the active POV, never precomputed or stored per POV (invariant #3).
  - The test to apply: *what is this panel a panel of?* The bytes of one named event → POV plays no part. The evidence behind a per-POV number → the POV defines the set, and the bytes inside each block still don't move.
- **Inspection needs no auth.** These are read affordances over public data. Unlike the Pin row on the same header, they must work signed out.
- **Emulate, don't diverge — but emulate the *right* menu.** The `⋯` convention exists (`NoteActionsMenu`): click-to-toggle, click-outside-close, menu stays open on select, transient flash line, `"<label> unavailable"` on a missing value. New inspection menus follow it. Improving the convention (e.g. Escape-to-close, which none of them handle) is a separate story that changes *every* menu, not one.
  - *Amended 2026-07-16 at the #2 reopen:* the page carries **two** `⋯` conventions, not one, and they legitimately disagree. The header/feed menu is a small anchored dropdown and **stays open** on select. The **tag row's** overflow menu is a different component that becomes a full-viewport bottom sheet under 769px and **already closes** after a successful Apply/Dispute. A row menu that stayed open would sit on top of the very panel it just opened — the stays-open rule exists to let a viewer toggle straight back, and covering the target defeats its purpose. So: emulate the convention of the menu you are extending, not whichever one shipped first. Story #2 closes on select at both widths (story Product decision #1). Recorded as deliberate so a reviewer does not read it as drift.
