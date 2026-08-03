# Acceptance script — tagging in Brainstorm-UI (NosFabrica)

Manual end-to-end verification **through this app's UI**, layered on top of `core/ACCEPTANCE.md`
(which must also pass for every capability rung built — it covers the wire shapes, batching,
trust behavior, and degraded modes; this doc doesn't repeat them).

Sections mirror the interview floors (Start.md §2 Q1); check through the floor recorded in
`DECISIONS.md` — later sections only if built. Prereqs: the app on `npm run dev` (or a deploy)
with the kit's `CONFIG.json`; for floor B+ a NIP-07 signer (identity **A**); for floor C+ a
second identity **B**. "Chip row" = the protocol tag chips in SharePage's reserved slot.

## Floor A — Read-only

- [ ] A profile known to be tagged on the reference instances (browse tags.brainstorm.world to
      find one) shows the same tags, with matching net counts, as chips on its `/p/<npub>` page.
- [ ] The chip row renders for a **logged-out** visitor (fresh incognito window) — pure relay
      reads, no session, no `authenticatedFetch` involvement (network tab: no `/api/*` calls
      fired by the tag surfaces, no storage wipe / redirect).
- [ ] The chip row visually matches its neighbors (role chips / TopicChips): same scale,
      spacing, truncation behavior on a long tag list; `data-testid="share-tags"` present.
- [ ] The existing role chips ("Developer" etc.) and "Posts about" TopicChips still render
      exactly as before — coexistence, no regression.
- [ ] An untagged profile shows no empty-state artifact — the row is simply absent, layout
      intact.
- [ ] If note tag chips were built (C2): a tagged note shows its chips where SharePage renders
      that note; an unreachable tag relay leaves notes rendering normally, chips absent.

## Floor B — Self-tagging (the anchor flow)

- [ ] As **A**, logged in, on **A's own** `/p/` page: a "tag yourself" affordance is visible
      (per the Q2/placement decision). On someone else's profile — or logged out — it is NOT
      (owner + signer gating).
- [ ] Opening the picker: existing protocol tags load and search-by-name filters them; the
      curated starter suggestions (Q5) appear; profile-applicable tags lead, content-applicable
      reachable but secondary.
- [ ] A applies an existing tag to themself → signer prompts once → chip appears immediately
      (optimistic/`mine`), survives a full reload, and is visible in a logged-out window.
- [ ] Re-applying the same tag does not duplicate; the chip count stays 1 (A's own single
      assertion).
- [ ] A removes their stance (dispute toggle on their own chip) → the chip drops per the net-≤0
      rule but A still sees their own stance state honestly (dimmed/struck, not vanished);
      re-applying restores it. Relay holds ONE assertion from A, latest polarity.
- [ ] Create-new: A searches a nonsense string → "Create tag" → name (+ optional description) →
      applied to self in one flow; the new chip renders; the tag is discoverable in the picker
      afterwards. Cancelling the signer mid-flow reports honestly, no dangling assertion
      (core C5 wire checks).
- [ ] **Q2 decision honored** — coexist: role chips untouched beside protocol chips; bridge:
      saving roles in the customizer also publishes matching self-tags (verify one on-wire);
      migrate: the one-time conversion ran only with the owner's consent and the role row's
      replacement renders equivalently.
- [ ] `npm run check`, `npm test`, `npm run build` clean; existing SharePage tests pass.

## Floor C — Tagging others

- [ ] As **A**, on **B's** profile: the tag affordance is available (signed-in, non-owner);
      A applies a tag to B → chip appears with count 1, visible to B and to logged-out
      visitors.
- [ ] As **B**, the same chip shows a stance surface; B disputes → net count drops (core C4
      replace semantics verified on-wire); B applying a different tag to A works symmetrically.
- [ ] A's own-profile flows from floor B are unaffected.
- [ ] Trust filtering is live on others' tags: the core C7 `minRank` crank drops scored
      asserters' chips while `mine` keeps the viewer's own stance visible.

## Floor D — Full surface

- [ ] Note-tagging affordance wherever the app renders notes with actions; applying a tag to a
      note round-trips (chip on the note, core C3 event-assertion wire check).
- [ ] Clicking any tag chip navigates to its tag page (`/tags/…`); name + description shown;
      tagged **people** and tagged **notes** listed (net > 0 only), rendered with the app's
      native profile-item and note components.
- [ ] Deep-linking a tag-page URL in a fresh logged-out window works (route registered, decode
      handles the address form(s) accepted).
- [ ] A tag with existing usage on the reference instances shows a populated page (cold-start
      via the hub).

## Hygiene (any floor)

- [ ] No 64-hex literals in the new source (grep `client/src` for `[0-9a-f]{64}`) — everything
      via `config/tagging.ts`.
- [ ] Tag relays configurable per the Q4 decision (env key present in all four registration
      points, or documented alternative); unset env falls back to `CONFIG.json`.
- [ ] `DECISIONS.md` records every interview answer and any mid-build changes.
