# Epic: tag-event-inspector

**Created:** 2026-07-16
**Status:** Active

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

1. `stories/tag-event-inspector/1-tag-actions-menu-and-raw-event.md` — a `⋯` actions menu beside the tag name (Copy Note ID / Copy Note Addr / Show–Hide Raw Event) plus a default-hidden raw event panel on the tag detail page. **Draft** (book `audits/tag-event-inspector/`).

## Key facts / guardrails

- **A tag definition is a kind-39999 event authored by an ordinary user — not by the Tapestry Assistant.** The `stoicism` tag on `tags.brainstorm.world` is authored by vinney. Anyone may publish a tag (decentralized-first): no affordance in this epic may gate on the author being the TA, or on the author being known/trusted at all.
- **The `naddr` for a tag definition is composed from the tag element's own author pubkey + its slug** — `39999:<tag.authorPubkey>:<tag.slug>`, the coordinate already canonical at `ui/src/utils/publishProfileTag.js` (ADR 0022). **Not** the TA pubkey and **not** the ADR-0015 `LEGACY_*` literals: those govern only the `z`-tag concept-handle composition, a different thing. Kind 39999 is in the 30000–39999 addressable range, so a tag definition always has an naddr.
- **Never hardcode the TA pubkey** (CLAUDE.md § "Per-deployment TA pubkey"). It differs per deployment — the local stack's concept graph currently answers `e00ed090…`, while CLAUDE.md documents `82b75e47…` for this machine. That divergence is itself the argument: resolve at runtime or don't touch it.
- **A raw signed event is POV-invariant.** It is the event as published, identical from every point of view — not a per-POV projection. Inspection surfaces in this epic must not be POV-namespaced, POV-filtered, or POV-gated. (The taggings *around* it are per-POV; the definition event is not.)
- **Inspection needs no auth.** These are read affordances over public data. Unlike the Pin row on the same header, they must work signed out.
- **Emulate, don't diverge.** The `⋯` menu convention already exists (`NoteActionsMenu`): click-to-toggle, click-outside-close, menu stays open on select, transient flash line, `"<label> unavailable"` on a missing value. New inspection menus follow it. Improving the convention (e.g. Escape-to-close, which none of them handle) is a separate story that changes *every* menu, not one.
