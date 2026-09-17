# PRD Seed: Treasure Map Trusted-List Delegation

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/tl-treasure-map/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high
**Date:** 2026-08-27

> A reverse-engineered baseline in PRD shape, built from what shipped. A *strawman for the
> product team*, not a ratified spec — sections tagged `[FROM FRAME]`, `[INFERRED]`, or
> `[UNKNOWN — product input needed]`. Adopt as the starting point for `/discover` on the next
> phase and validate each section.

## 1. Product vision

`[FROM FRAME]` A Brainstorm customer — whose Treasure Map (kind 10040) is managed at
brainstorm.world and whose rank/followers Trusted Assertions are published by the Brainstorm
Assistant — can come to their Tapestry instance and redirect **Trusted-List publishing** to that
instance's own Tapestry Assistant, by amending their Map rather than abandoning it.
`[INFERRED]` The larger arc: the Treasure Map stays the single entry point to a user's
Grapevine, while the *publishers* behind each delegation become pluggable per kind — Tapestry
instances compete on being worth delegating to. `[UNKNOWN]` Whether TL delegation is a stepping
stone to migrating TA delegation (rank/followers) to Tapestry instances too.

## 2. Personas

- `[FROM FRAME]` **The Brainstorm customer** — has a Map, signs with a NIP-07 extension, wants
  the one-click path with a preview before anything publishes.
- `[INFERRED]` **The power user / protocol operator** — hand-edits the raw 10040 (story 4 was an
  operator request); wants no nanny between them and the wire, but accepts re-stamped
  `id`/`sig`/`created_at`.
- `[INFERRED]` **The consuming client** (npub.world-class readers, federating instances) — reads
  Maps by the ratified parse rule; never sees two competing generic entries. Behavior inferred
  from the spec section; no such client has shipped the rule yet (carry-forward).

## 3. Scope (as-built)

`[FROM FRAME]` Enumerated Map entries with classification, avatars, local-vs-external badges;
the salient three-state answer for generic pubkey-TL delegation; opt-in prompt → preview →
NIP-07 sign → publish (local + external relays, deployment gate honored); no-Map path unchanged.
`[INFERRED]` (operator-added during the book): summary-card removal and "how it is → what to do"
page ordering; retitled card with amended copy; the manual raw-event editor in all states.
Out of scope, explicitly: named-entry overrides (reserved, inert), non-pubkey TL kinds' UI
(30393–30395 defined by the convention, not exercised), production promotion.

## 4. Domain model

`[INFERRED]` from the ADR + spec (no concept-graph changes):
- **Treasure Map** — kind `10040`, replaceable, owner-signed; entries
  `["<kind>[:<name>]", <pubkey>, <relay>]`.
- **Generic TL entry** — bare decimal kind (`"30392"`): one publisher for *all* the owner's
  lists of that kind; at most one per kind; first occurrence wins for readers; replaced in
  place, never duplicated, by writers.
- **Trusted List family** — `30392`–`30395` (`+10` of NIP-85's `3038x`), TA-signed
  (`protocols/drafts/trusted-lists.md`).
- **Relay hint** — where the advertised publisher's lists live; Tapestry fills it from
  `settings.aRelays.aTrustedListRelays[0]`; empty-string when unconfigured.
- **Re-stamp policy** — any Map update drops `id`/`sig` and stamps
  `created_at = max(now, old+1)` so replaceable-newest-wins can never silently discard it.

## 5. Design rules (as-built)

`[INFERRED]` from the shipped UI and the operator's in-book direction:
- **"How it is, then what to do about it"** — status/facts above (entries, raw event), actions
  below (opt-in card last on the page; preview above the publish button in the card).
- **Never judge before the baseline resolves** — no local/external verdict until the runtime TA
  pubkey loads; no TA pubkey or relay literals anywhere (per-deployment).
- **Preview before publish** — the exact unsigned event is always inspectable wherever a publish
  affordance is visible; the manual editor shows the *found* event, the opt-in preview shows the
  *derived* one, and the two are deliberately separate surfaces.
- **Escape hatches don't nanny** — well-formed destructive edits publish; validation stops only
  malformed shapes, with human-readable errors.
- Section titling: `Trusted Lists for Pubkeys (30392)` — kind numbers visible to the user.
  `[UNKNOWN]` whether kind-number-forward naming is the durable product voice or a
  developer-audience convenience.

## 6. Carry-forward & open questions

Promoted from audit §6: inverse-partial publish notice; named-entry override ADR; cross-repo
parse-rule adoption (Brainstorm client); verify TL propagation to the hinted relay; sibling
deploy-workflow concurrency (OPEN.md 183); S9 assertion strengthening; production promotion.

## 7. What product must validate

- [ ] `[UNKNOWN]` The **no-Map path**: today it routes to a WoT provider for Grapevine
      calculation. Should a user with *no* Map be offered a minimal bootstrap Map (TL entry
      only) instead?
- [ ] `[UNKNOWN]` The **external→local switch** messaging: is silently replacing the external
      delegate's entry (with the one-line disclosure) enough, or does the product want the
      external publisher named/linked more prominently before the switch?
- [ ] `[UNKNOWN]` Should opting in also *trigger* an immediate TL publication by the local TA
      (so the relay hint is instantly true), or is advertise-first acceptable?
- [ ] `[UNKNOWN]` When (if ever) to surface the other family kinds (30393–30395) and named-entry
      overrides in the UI.
- [ ] `[INFERRED→validate]` That consuming clients (starting with the Brainstorm client) will
      adopt the parse rule — the convention's value depends on it.
