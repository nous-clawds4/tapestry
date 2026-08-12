# Story 1: security.txt, robots.txt, and honest 404s

**Status:** Done
**Created:** 2026-08-11
**Type:** Feature

## Background

safescan.io has placed most of the `*.brainstorm.world` estate on a list of unsafe URLs. The owner
suspected the instances "look like clones of each other." A probe of all 18 live hosts on 2026-08-11
confirmed a concrete shared defect rather than a cosmetic resemblance.

For the six hosts served from this repo, the SPA catch-all at `bin/control-panel.js:309` returns
`dist/index.html` for **every** unmatched path. Consequences a reputation scanner can observe:

| Probe | Current response |
|---|---|
| `/robots.txt` | `200 text/html` — the SPA shell |
| `/.well-known/security.txt` | `200 text/html` |
| `/.env`, `/wp-login.php`, `/nonsense-xyz` | `200 text/html` |
| `/` on tapestry vs staging | byte-identical (same md5) |

Nothing on these domains ever 404s, the served HTML is ~400 bytes of contentless SPA boilerplate, and
no host carries machine-readable ownership or contact information. Six sibling domains with that
profile match the standard automated fingerprint for a bulk-generated clone farm.

The same defect exists in `NosFabrica/Brainstorm-UI` and on the five strfry relays; those are handled
outside this repo. See `engineering-team/audits/site-trust-signals/book.md`.

## User-facing description

As a security researcher or reputation-scanner operator, I want each Brainstorm host to publish a
standard, machine-readable statement of who runs it and how to reach them — and to respond honestly
when I request a path that does not exist — so that I can tell a deliberately-operated fleet of
sibling deployments apart from a bulk-generated clone farm.

## Acceptance criteria

- [ ] Given any tapestry-fleet host, when `GET /.well-known/security.txt`, then a valid RFC 9116
      document is returned with `Content-Type: text/plain; charset=utf-8`.
- [ ] Given a request for that file, when the response is rendered, then `Canonical` names the
      **requesting** host (derived from configuration, not hardcoded), so the file is valid on all
      six deployments and on any third-party fork.
- [ ] Given that document, then it contains exactly one `Expires` field, in the future, and at least
      one `Contact` field.
- [ ] Given that document, then it carries the full-estate ownership attestation listing every
      official hostname across all four fleets.
- [ ] Given the production host, when `GET /robots.txt`, then crawling is permitted.
- [ ] Given any non-production host, when `GET /robots.txt`, then the response is `Disallow: /`.
- [ ] Given a probe path (`/.env`, `/wp-login.php`, `/config.json`, `/backup.sql`), when requested,
      then the response status is **404**, not 200.
- [ ] Given an unhandled path under `/.well-known/`, when requested, then the response is **404**.
- [ ] Given any existing SPA route (`/`, `/user/:pubkey`, `/tapestry/concepts/:uuid/elements`,
      `/developers/nip-50`, …), when requested directly, then the SPA shell is still served with 200
      so client-side routing continues to work on refresh.
- [ ] Given an API route under `/api/`, when requested, then behavior is unchanged.
- [ ] `SECURITY.md` exists at the repo root and is reachable at the URL named by `Policy`.

## Concepts touched

None. This story operates at the HTTP layer and touches no concept-graph concepts, no nostr event
kinds, and no POV-dependent state. It is deliberately outside the four architecture invariants:
the response is identical for every viewer because it is an assertion about *the operator of the
server*, not about any POV's view of the graph.

## Out of scope

- The `NosFabrica/Brainstorm-UI` fleet and the five strfry relays — same defect, different repos,
  tracked in the book.
- NIP-11 `contact`/`pubkey` enrichment on the relays.
- Any request to safescan.io for delisting or review. That is the owner's to send, and it should
  follow this work rather than precede it.
- Server-side rendering or any other change to make the SPA's *content* crawlable. Real, but a much
  larger piece of work.
- Retiring the five stale DNS references found in the repo (`lists.`, `npub.`, `wot.`,
  `nip85-staging.brainstorm.world`, `relay-staging.brainstorm.world`) — filed separately.
- PGP-signing the security.txt (`Encryption` field). Optional under RFC 9116; adds key-management
  burden with little benefit while `Contact` is a GitHub advisory URL.

## Open questions

None outstanding. Resolved with the owner at intake on 2026-08-11:

- **Contact** → GitHub private vulnerability reporting. Enabled on the repo the same day
  (`gh api --method PUT repos/nous-clawds4/tapestry/private-vulnerability-reporting` → `{"enabled":true}`).
- **Scope** → security.txt *and* crawler hygiene (robots.txt + genuine 404s), not security.txt alone.
- **robots.txt policy** → production indexable, five non-production hosts `Disallow: /`.
- **Trust anchor** → `SECURITY.md` in each repo; the full estate list is repeated in every
  security.txt across all fleets.
- **Rollout** → staging → main first, then cherry-pick to the four sandbox branches.

## Linked artifacts
- ADR: `engineering-team/decisions/site-trust-signals/0036-security-txt-and-honest-404s.md`
- Test plan: `engineering-team/tests/site-trust-signals/1-security-txt-and-honest-404s.md`
- Review: `engineering-team/reviews/site-trust-signals/1-security-txt-and-honest-404s.md`
