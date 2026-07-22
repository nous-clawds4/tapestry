# Story 2: Developers hub — Trusted Assertions + Relay Tools cards

**Status:** Done
**Created:** 2026-07-21
**Type:** Feature (UI / docs)

## Background

The `/developers` hub ([ui/src/pages/developers/Hub.jsx:17,24](../../../ui/src/pages/developers/Hub.jsx)) currently shows two cards — NIP-50 and Open Ranking — from story 1. Two further integration surfaces exist but are undocumented, so a developer landing on the hub sees an incomplete menu.

This is the extension story that epic's own out-of-scope note reserved: *"Other protocol pages (future feature pages slot into the same hub)."* Sub-pages inherit chrome from the shared `DevPage.jsx` wrapper, so each new page is a content component plus a route.

Requested alongside the `about-brainstorm-search` epic (operator, 2026-07-21), because `/about-brainstorm-search` routes "via other nostr clients" traffic into this hub. Built lightweight (no ADR / failing tests; browser-verified), matching story 1.

## User-facing description

As a nostr-client developer, I want the `/developers` hub to show all four integration surfaces — including the ones whose docs are still being written — so that I can see the full menu of what Brainstorm offers and know what's coming.

## Acceptance criteria

Browser-testable on the rendered SPA.

- [ ] **`/developers` renders four cards** in order: **NIP-50**, **Open Ranking**, **Trusted Assertions**, **Relay Tools** — each styled consistently with the existing two. The "Open-source" GitHub links section still renders.
- [ ] **`/developers/trusted-assertions` renders** via the shared `DevPage` chrome, showing the placeholder copy below and a "← Developers" back-link.
- [ ] **`/developers/relay-tools` renders** via the shared `DevPage` chrome, showing the placeholder copy below and a "← Developers" back-link.
- [ ] **Existing pages unchanged:** `/developers/nip-50` and `/developers/open-ranking` render exactly as before.
- [ ] **Deep-linking** directly to each new sub-route loads the page (SPA catch-all; no server change).
- [ ] **Additive / isolated:** frontend only. No console errors. No backend, API, or data change.

### Placeholder copy — Trusted Assertions (draft, operator to review)

> Trusted Assertions are kind 30382 nostr events carrying web-of-trust scores — rank, verified follower counts, and related metrics — published by a trust authority about other pubkeys. Because they are ordinary signed nostr events, any client can fetch them, verify who signed them, and apply its own trust perspective without depending on this instance.
>
> Documentation coming soon.

Grounded in [BIBLE.md:1502](../../../BIBLE.md) (Trust Assertions glossary entry) and §PoV source map (:1629).

### Placeholder copy — Relay Tools (draft, operator to review)

> [Relay Tools](https://relay.tools) is a nostr relay hosting service. Your Relay Tools relay draws a personalized whitelist of pubkeys from Brainstorm over an API and uses it to screen out spam — so the people your web of trust vouches for are the ones who can write to your relay.
>
> Documentation coming soon.

Present tense: the integration **is live today** (operator confirmed 2026-07-21). No endpoint URL or hostname is published here — the page names "Brainstorm" generically, and the concrete API surface waits for the real documentation story. See Open questions 1–2.

## Concepts touched

Referenced in copy only; no code reads the concept graph in this story.

- **Trust Assertions (kind 30382)** — described on the Trusted Assertions page. Not a concept-graph node; defined in BIBLE glossary (:1502).

## Out of scope

- **Real documentation** for either new page — both are placeholders. Writing the actual Trusted Assertions and Relay Tools integration docs is future work (one story each, slotting into this same hub).
- Any change to `/developers/nip-50` or `/developers/open-ranking` content.
- Any backend, API, or data change; any change to the Open Ranking endpoints.
- Building the Relay Tools whitelist API integration itself. This story documents a direction; it ships no integration code.

## Open questions

None blocking. Resolved during planning (2026-07-21):

1. ~~Is the Relay Tools ↔ Brainstorm whitelist integration live, or aspirational?~~ — **Live today**, operator-confirmed. Copy is present tense accordingly. (Asked because the operator's initial description mixed present tense with "we envision synergy... in the future"; a public page must not describe an unshipped integration as real.)
2. ~~Which host serves the whitelist API?~~ — **Deliberately unnamed.** The operator initially said `brainstorm.world`, which is now the NosFabrica deployment (Tapestry prod is `tapestry.brainstorm.world`), so the page says "Brainstorm" generically and publishes **no endpoint or hostname**. The concrete API surface is deferred to the real documentation story — do not add a URL here without operator confirmation of the host.
3. **Should the Relay Tools card link to `https://relay.tools` directly**, or only from the sub-page? Non-blocking; implementation assumes card → sub-page → external link, consistent with the other three cards.

## Linked artifacts

- ADR: none (lightweight docs-UI treatment, operator-approved 2026-07-21)
- Test plan: none (browser-verified)
- Review: none — lightweight docs-UI treatment (operator-approved 2026-07-21); reviewed at book scope in `engineering-team/audits/about-brainstorm-search/audit.md`
