# Epic: Event Tagging (kind-1 notes)

**Status:** Active
**Provenance:** Operator request 2026-06-25 (this session). Protocol approved in PR #325 (`protocols/drafts/event-taggings.md`) — **David's draft + Vinney's approval, NOT the AI reviewer's collapse**. Builds atop the `note-surfaces` / `live-feed` shared note seam (`NoteCard` + `enrichNotes`), which explicitly deferred "tagging notes" to a later epic — this is that epic.

## ⚠️ Build-time invariant — LOCAL DEV RELAY ONLY (non-negotiable)

**Throughout the entire build of this epic — every story, every phase, all automated testing, and all operator manual testing — no event may be published anywhere except the local dev strfry relay.** No external/production relay. Ever. Until the operator *explicitly* lifts this for a named, gated step.

- **Why:** the build signs with the operator's dev pubkey. An event that escapes to a public relay can be picked up and *depended upon* by live users (it becomes part of their concept graph / WoT inputs), and it puts the dev pubkey on the open network as something others rely on "forever." Neither is reversible.
- **The hazard in the borrowed code:** `publishEverywhere` (`ui/src/utils/nostrPublish.js`) fans out to 5 hardcoded production relays (`PUBLISH_RELAYS`) in parallel with the local write. The `nostr-user-tag` path uses it. The event-tagging write path **must not** — it uses a local-only publish (e.g. `publishToLocalStrfry` only). Any code path, test, or fixture that can reach `publishToRelays` / `PUBLISH_RELAYS` during this epic is a defect.
- **Manual testing** stays on the **local dev stack** (`:7778` / `:8080`), not staging or prod, while this invariant is in force.
- **This is the dev-time face of a single GLOBAL publish gate** (operator decision 2026-06-25): external publishing is **off unless a deployment explicitly opts in.** Default (dev, no flag) = local strfry only, for **all** publishes — not just event-tagging, so the existing `nostr-user-tag` path is covered too, and automated tests cannot blast events to live relays. A deployment turns external publishing on via **per-deployment server config** (e.g. an `ALLOW_EXTERNAL_PUBLISH` value in the in-container `brainstorm.conf`, surfaced to the client through the existing config-endpoint pattern that already carries the TA pubkey / relays) — **not** by editing the deploy YAML, which only SSHes and redeploys. The opt-in is an explicit *release* decision, never the mere fact of `env != dev`.
- **Enforcement mechanism** (the gate location, whether the external fan-out is routed server-side so the browser cannot bypass it when off, test assertions of no external egress) is the Architect's call in Story 2 — but the *guarantee* is a hard acceptance gate on every story that writes, and the Reviewer must reject any diff that can publish externally with the gate off.

## What this is

Decentralized, permissionless tagging of **kind-1 notes** (and, generally, any nostr event) — the event analog of the `nostr-user-tag` (pubkey-tagging) feature. A viewer can, on any surface that renders a kind-1 note:

- **Apply or dispute** a tag that already exists on the note (polarity ±1).
- **Add a tag used elsewhere** but not yet on this note (search existing tags).
- **Add a brand-new tag** that doesn't exist at all (create the tag, then apply it).

It follows the **`event-taggings.md` protocol literally**: indirect tagging via a `z`-tag carrying the descriptor, with a per-tag "tagging-with-specific-tag" header. The target event stays in `e` (kind-1 notes) / `a` (addressable targets); the descriptor is referenced indirectly through the header coordinate `39999:<tagAuthor>:tagging:<slug>-tagging`.

**SDK foresight (operator requirement):** the wire-construction and discovery logic is built as **framework-agnostic, dependency-free, copy-pasteable core modules** that map 1:1 to a generic NIP-style spec in `protocols/`. Another developer adding kind-1 tagging to their own app must be able to lift the core wholesale, with no dependency on Tapestry's stack. The React/server code are thin adapters over that core.

## Stories (proposed decomposition)

`stories/event-tagging/`:

1. **protocol-core-and-spec** — the generic, stack-agnostic NIP spec in `protocols/` + a dependency-free core library that builds the three event shapes (tag-element, tagging-header, tagging-assertion) and the discovery filters, with unit tests. Foundational; the SDK seed. Imports nothing from the app.
2. **global-publish-gate** — a single global gate making external publishing **opt-in**: default (dev) publishes local-only for *all* publish paths; a per-deployment config flag enables the external fan-out. Touches the shared publish util (so it also covers the existing `nostr-user-tag` path). Likely an ADR. **Must land before any write-path testing.** Independent of #1.
3. **firmware-seed-event-tagging-concepts** — seed the two new DList concepts (`nostr-event-tag`, `tagging-with-specific-tag`) in firmware + reinstall, so taggings aggregate into the concept graph. Depends on the spec (#1) for the exact handles/shape.
4. **event-tagging-read-api** — server endpoints: taggings-for-event (POV-filtered apply/dispute, read-time trust), applicable/available tags, and tagging-header discovery for a tag. Depends on #3.
5. **event-tagging-write-path** — client publish flows for the three sequences (apply/dispute = 1 publish; add-existing-tag-needing-header = 2 publishes; create-new-tag = 3 publishes), built on the core (#1) and the gate (#2). Depends on #1, #2, #3.
6. **event-tag-affordance-on-note-surfaces** — wire the apply/dispute + search-existing + create-new affordance into **all** kind-1 note render sites (profile notes feed, single-note/thread, search/feed results). Depends on #4, #5.

**Dependency order:** #1 and #2 are foundational and independent of each other; #2 gates all write testing; #3 after #1; #4 after #3; #5 after #1+#2+#3; #6 after #4+#5.

## Out of scope (whole epic)

- Tagging non-kind-1 events as a product surface (the protocol/core is general, but the UI targets kind-1 notes). Tagging tags/DLists is covered by the protocol but not given a UI here.
- Changing the existing `nostr-user-tag` (pubkey) tagging feature.
- The AI-reviewer's "collapse to direct z→tag" redesign — explicitly rejected; we implement David's indirect-header protocol.
- Ranking/scoring changes; pinning event-tags (analog of tag-pinning) — possible later.

## Concepts (referenced, not re-defined)

- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag` — tag (the descriptor applied).
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-event` — the target event (kind-1 note).
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag` — sibling spec the protocol reconciles against.
- **NEW** `39998:<TA>:nostr-event-tag` — the DList of event taggings (seeded in #2).
- **NEW** `39998:<TA>:tagging-with-specific-tag` — per-tag tagging-header type (seeded in #2).

> Handles above use the **local** Tapestry Assistant pubkey. The Architect must re-resolve against the **target instance's own** runtime TA (never hardcode), per CLAUDE.md "Per-deployment TA pubkey — NEVER hardcode". The z-tag-composition legacy literal (ADR 0015) governs only the canonical concept handles, not author filters.
