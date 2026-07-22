# Epic: Developers pages (multipage)

**Status:** Active
**Provenance:** Operator request 2026-06-19, following the Open-Ranking ship — the `/developers` page (single NIP-50 page) needs to document ORE too, so it's restructured into a hub + per-feature pages.

## What this is
Restructure `/developers` from a single NIP-50 page into:
- **`/developers`** — a hub: short intro, links to each feature page, and the existing "Open-source" GitHub links.
- **`/developers/nip-50`** — the existing NIP-50 relay-search content (relay URL, quick-start, WoT search extensions, auto-provisioning).
- **`/developers/open-ranking`** — a new ORE overview: capability-doc URL, the `/stats/pubkey` + `/search/pubkeys` endpoints, `graperank`/`graperank-personalized` algorithms, worked POST examples + responses (final field set), a field reference, and links to the ORE spec + repo.

Each feature page links back to the hub. Additive, frontend-only (React routes + components); no backend/data change. URLs/examples are host-derived so the same pages work on staging and prod.

## Stories
`stories/developers-pages/`:
1. **multipage-developers** — the hub + the two feature pages + routing + shared dev-page chrome.
2. **hub-trusted-assertions-and-relay-tools** — expands the hub to four cards, adding placeholder pages for **Trusted Assertions** (`/developers/trusted-assertions`) and **Relay Tools** (`/developers/relay-tools`). Requested 2026-07-21 alongside the `about-brainstorm-search` epic, which routes "via other nostr clients" traffic into this hub.

## Out of scope
- Other protocol pages beyond the four now on the hub (future feature pages continue to slot in the same way).
- Real documentation for the Trusted Assertions and Relay Tools pages — story 2 ships placeholders only; the actual integration docs are future work (one story each).
- Any backend, API, or data change; any change to the ORE endpoints themselves.
- ADR + failing-tests ceremony (lightweight docs-UI treatment, operator-approved); verification is browser-based.
