# Story 6: NIP-05 green checkmark must reflect real verification

**Status:** Approved
**Created:** 2026-05-17
**Type:** Bug

## Background
On profile pages, a green ✅ next to a user's NIP-05 identifier signals to viewers that the identifier is verified — i.e. the identifier's domain attests that this pubkey owns `name@domain`. Currently the ✅ is shown solely because the `nip05` field in the user's kind-0 metadata is non-empty. No domain lookup is performed, and the domain-attested pubkey is never compared to the profile's pubkey. Consequently, unverified, misconfigured, stale, or deliberately impersonated identifiers all display as "verified." This misleads every viewer and is an impersonation vector: anyone can set `someone@well-known-brand.com` in their profile and appear verified. Affects all viewers of profile pages on prod (brainstorm.world) and staging. Tracked as GitHub issue #151.

## User-facing description
As someone viewing another user's profile, I want the green NIP-05 checkmark to appear only when that user's NIP-05 identifier has actually been verified against its domain, so that I can trust the checkmark as a genuine identity signal and not be misled by unverified or impersonated identifiers.

## Acceptance criteria
Testable from the outside.

- [ ] Given a profile whose `nip05` resolves, at its domain, to **the same pubkey as the profile**, when the profile page renders, then the green ✅ is shown next to the identifier.
- [ ] Given a profile with a non-empty `nip05` that does **not** verify — name absent at the domain, domain lists a *different* pubkey, malformed response, or domain unreachable/times out — when the profile page renders, then the identifier is shown as **plain text with no ✅ and no warning indicator**.
- [ ] Given a profile with no `nip05` field, when the profile page renders, then no identifier line and no checkmark is shown (unchanged from today).
- [ ] While verification is in flight, the ✅ is **not** shown — fail-closed: the checkmark appears only after a confirmed positive match (no spinner/intermediate UI required).
- [ ] All of the above hold on **both** the `/user/:pubkey` profile detail page **and** the Brainstorm profile page; the existing search-results "✅ NIP-05 Verified" badge is unchanged.

**Concrete verification:** the two pubkeys cited in issue #151 (`b17e0293…` and `ff18165a…`) must display **no checkmark** after the fix.

## Concepts touched
- NIP-05 identifier verification — per the Nostr NIP-05 spec: `name@domain` is verified only if `https://domain/.well-known/nostr.json?name=<name>` maps `<name>` to the profile's own pubkey. (Concept Graph API was unreachable during planning; a `kind:pubkey:slug` handle can be resolved downstream if one exists.)

## Out of scope
- The search-results / suggestions "✅ NIP-05 Verified" badge — already gated on real server-side verification; unchanged.
- Adding any positive "verified" indicator to surfaces that today show NIP-05 as plain text with no checkmark (search list, suggestions, admin view, the Identity-table row) — no false claim there; deferred.
- An explicit "unverified" / ⚠️ marker, or a distinct "domain unreachable" state — explicitly decided against; unverified renders as neutral plain text.
- How brainstorm.world publishes *its own* NIP-05 registry (the provider side) — unrelated, unchanged.
- Caching/performance tuning of the verification lookup — left to Implementation, beyond the fail-closed guarantee above.

## Open questions
- None blocking. *How* verification is performed (where it runs, reuse of existing logic, caching) is deliberately left to the Implementer; the PO prescribes only observable behavior.

## Linked artifacts
- GitHub issue: https://github.com/nous-clawds4/tapestry/issues/151 — close when this reaches `main` (prod)
- ADR: N/A — Architecture phase skipped (Standard bug, unambiguous root cause)
- Test plan: `engineering-team/stories/6-nip05-checkmark-verification.test-plan.md`
- Review: `engineering-team/reviews/6-nip05-checkmark-verification.md` — **PASS** (2026-05-17)
