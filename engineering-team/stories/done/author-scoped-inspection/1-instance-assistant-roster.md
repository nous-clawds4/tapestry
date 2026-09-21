# Story 1: The instance can say which assistants it controls, and for whom

**Status:** Done
**Created:** 2026-09-20
**Type:** Feature

## Background

Every other story in this book needs one fact the instance has never been able to state in one
place: **which assistant keys did I issue, and whose account does each one belong to?**

The instance holds all of them. The owner's assistant is created at first container startup; a
customer's is created at signup; an admin's is created on request. But each is reachable only one
at a time, by asking about a particular account — and the accessor that answers returns the
private key along with the public one, so it can never be the thing a page reads.

There is also no list of *who the accounts are* that pairs with it. The instance can list its
active customers, and it knows its owner and its admins, but nothing joins those rosters to the
assistants issued to them.

Affected: any reader of a surface that wants to say "these are mine" or "these are that person's"
on a multi-tenant instance. Today only the owner's assistant is addressable from the UI, which is
why Active b-tags shows the owner's view to everybody.

This is the read half of the direction BIBLE §31 § Scope states and marks not yet built.

## User-facing description

As a Tapestry instance, I want to say which assistants I control and which account controls each
one, so that my surfaces can offer "the owner's", "mine" and "this customer's" as real choices
instead of assuming everyone wants the owner's view.

## Acceptance criteria

- [ ] Given an instance with an owner, zero or more admins, and zero or more active customers,
      when the roster is read, then it contains exactly one entry per account known to the
      instance in those three roles, each carrying that account's pubkey and its role.
- [ ] Given an account that has an assistant key provisioned, when the roster is read, then that
      account's entry carries the assistant's **public** key.
- [ ] Given an account with **no** assistant key provisioned (an admin who never requested one),
      when the roster is read, then that account still appears, with its assistant key reported as
      absent — not omitted, and not an error.
- [ ] Given any instance, when the roster is read, then **no private key material** appears
      anywhere in the response — no private key, no nsec — for any account, in any role.
- [ ] Given the local dev instance (owner + 1 customer) and staging (owner + 5 customers), when
      the roster is read on each, then each returns that instance's own accounts and its own
      assistant pubkeys, with no value shared between the two deployments.

## Concepts touched

- `39998:<TA>:tapestry-assistant` — tapestry assistant. **Read-only context, not written by this
  story.** That concept's elements are nostr profiles corresponding to tapestry assistants in
  general — the future home for assistants this instance does *not* control. The roster answers a
  narrower and different question: assistants whose keys this instance holds. Do not conflate them.

## Out of scope

- Assistants this instance does not control. Nothing here learns who controls a foreign assistant.
- Provisioning, rotating, or repairing an assistant key.
- Inactive or mid-provisioning customers — the roster reports the instance's active roster, and
  the treatment of other statuses is the Architect's to decide and record, not a behavior this
  story specifies.
- Any per-account profile data (display pictures, names as published on the relay). Existing
  profile resolution already covers that from a pubkey; the roster supplies pubkeys.

## Open questions

- **Should this read be public or authenticated?** The mapping is already derivable by anyone with
  the relay: the customer roster endpoint publishes customer account pubkeys today, and every
  assistant pubkey signs public events under a NIP-05 that names its account. The precedent in
  `audits/shared-concepts-legibility/audit.md` is that reads revealing nothing an observer could
  not read off the relay ship public. Against that: this *collects* the mapping into one call, which
  is a convenience an enumerating attacker does not currently have, and worksheet W12 is an open
  problem about exactly that shape (a personalized-endpoint enumeration oracle). **The Architect
  decides and records it in the ADR**; the Product Owner's position is that the roster should carry
  no more than the already-public customer roster does, plus the assistant pubkeys.
- Whether the singular resolver W13 plans (`main pubkey → delegated key`) and this plural roster
  should share one implementation. Architect's call; W13 must not end up with a second, divergent
  mapping.

## Linked artifacts
- ADR: `engineering-team/decisions/author-scoped-inspection/0001-instance-assistant-roster-and-delegate-resolver.md`
- Test plan: `engineering-team/stories/author-scoped-inspection/1-instance-assistant-roster.test-plan.md`
- Review: `engineering-team/reviews/author-scoped-inspection/1-4-author-scoped-inspection.md` (PASS)
