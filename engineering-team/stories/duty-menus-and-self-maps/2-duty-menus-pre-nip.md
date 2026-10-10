# Story 2: The Duty Menus pre-NIP

**Status:** Approved
**Created:** 2026-10-10
**Type:** Doc

## Background

A Tapestry instance that gives a duty to an external Assistant has no way to learn whether that Assistant offers the duty,
or on which relay it would publish it
([`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`](../../../docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md) § 1). Today
the `/treasure-map` page writes an empty relay for any Assistant it doesn't run, and that breaks readers (OPEN.md row
`2026-10-10-external-assistant-relay-left-empty`).

The owner settled the answer: each Assistant key publishes a **Duty Menu**, one item under a shared header that Nous
publishes (handoff D4, D8–D10). Story 1 made the self-pointing `b` that header relies on normative. This story writes the
Duty Menu spec itself.

## User-facing description

As an implementer of a Tapestry or Brainstorm instance, or of another NIP-85 provider, I want one spec that says how an
Assistant key publishes what it offers and where, and how a reader finds and interprets it, so that any instance can fill
a Treasure Map entry's relay for an Assistant it doesn't run, show what each Assistant offers, and list the service
providers its community trusts.

## Acceptance criteria

- [ ] **AC1, exists and indexed.** `protocols/drafts/duty-menus.md` exists with the standard metadata header (📝 pre-NIP;
  Sources naming the handoff and this story's ADR), and `protocols/README.md` gains its index row.
- [ ] **AC2, the header.** The spec defines the single shared Duty Menu header:
  - published by Nous, named by pubkey;
  - offered as a self-declared Shared Concept, citing `inherit-from.md`'s Self-declaration rule;
  - declares the item tags it requires (the Assistant, the duty rows) and allows (name, description, a storefront link,
    per-duty details).

  It says how a person adds Duty Menu to their own dictionary by affiliating their header with Nous', and that those
  declarations must be on Nous' header before anyone adopts it.
- [ ] **AC3, the item.**
  - One replaceable item per Assistant key, at a fixed identifier.
  - **Every** menu, storefront and per-customer alike, points at Nous' header (D9).
  - Each duty row is a Treasure Map key plus a relay, with at most one row per key.
  - Rows mean *offered*, never *active*.
  - Only the key's own item counts.
  - Per-duty details are allowed; price and tier never are (D5).
- [ ] **AC4, reading a menu.**
  - Which row answers a given duty follows the Treasure Map's most-specific rule (`treasure-maps.md` § 6), and no matching
    row means not offered.
  - It gives how to find one key's menu knowing only its pubkey, and how to list all menus under the header, filtered per
    point of view.
  - It covers storefront versus per-customer menus, the link between them, and how a reader tells them apart. One key per
    algorithm means one menu per key (D7).
  - The storefront menus under the header, read through their authors' kind 0 profiles and filtered per point of view,
    form a directory of service providers. This is the owner's addition, 2026-10-10, and may be non-normative.
  - A provider that publishes no storefront stays out of that directory; its per-customer menus never pose as storefronts.
- [ ] **AC5, fits with the rest.**
  - It states the boundary: the menu says *offered*, and the key's own Treasure Map says *active*. Self-Maps themselves
    are story 3, so this spec does not define them.
  - `protocols/worksheet.md` W1 notes that Nous holds the Duty Menu header, a Shared Concept rather than a per-deployment
    copy.
  - No "canonical" or "consensus" in normative text (`docs/NIP_REORG_DESIGN_HANDOFF.md` D2).
- [ ] **AC6, gates and scope.**
  - Links resolve, `harness-lint` is clean, and the stack-free `npm test` shows no regressions.
  - `protocols/` changes are limited to `duty-menus.md`, `README.md` and `worksheet.md`.

## Concepts touched

None changed (docs-mode). The Duty Menu concept comes into being when Nous publishes the header; the spec names its
address.

## Out of scope

- Self-Maps, and reserving `duty-menu` in `treasure-maps.md` § 4.6: both story 3.
- Nous actually publishing the header (outside the repo; publishing is the author's act).
- Any code.
- Private duties (handoff Q4) and NosFabrica adoption (handoff Q6).
- A bare `["z", "duty-menu"]` meeting point (handoff Q5): left out, owner 2026-10-10, because Nous' header is the one
  meeting point (D9).
- A new mechanism for finding a storefront before joining (handoff Q7): the storefront is the provider's main-key menu
  under Nous' header, and its kind 0 website is an ordinary hint (NIP-85's discovery appendix). Owner, 2026-10-10.

## Open questions

None blocking. The Architect settles the rest within the handoff's § 4 shapes.

## Linked artifacts

- ADR: [`engineering-team/decisions/duty-menus-and-self-maps/0002-the-duty-menus-pre-nip.md`](../../decisions/duty-menus-and-self-maps/0002-the-duty-menus-pre-nip.md)
- Test plan: skipped (docs-mode)
- Review: (filled in after Review phase)
