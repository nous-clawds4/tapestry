# ADR 0002: Guest custody — a self-hosted Keycast behind a seam

**Status:** Accepted (NosFabrica, 2026-10-15)
**Date:** 2026-10-15
**Story:** none: docs lane (Protocol-Spec workflow, docs-mode), recorded in the intake entry of 2026-10-15, "Event Index". Design record: `docs/EVENT_INDEX_DESIGN_HANDOFF.md`.

## Context

A visitor who isn't signed in to an app built on Event Index can RSVP and comment with an email address, and never has to see the word "nostr" unless they choose it. Their RSVPs and comments are ordinary signed events, so someone must hold a key for them: a **guest key**, custodial, one per person.

Guest identity is a separate service from the index, with its own secret, database, subdomain and phase gate, so that someone could run the directory without ever holding an email address. Apps register with it; tokens are scoped per app and never travel in a URL query; emails name the app the person was on; a 6-digit code works beside the link.

What the guest key signs is fixed by the wire format ([protocols/drafts/event-index.md](../../../protocols/drafts/event-index.md) § 6): a NIP-52 kind `31925` RSVP whose `d` is any unique id, a NIP-22 kind `1111` comment rooted at the event's address, NIP-09 withdrawals, and a kind 0 that says the account is custodial and was created by email. No email address appears on any relay.

**Keycast** (`divinevideo/keycast`, MIT, Rust; Divine's production login at `login.divine.video`), checked against its README and code on 2026-10-15:

- OAuth 2.0 authorization code with PKCE. The token exchange returns an access token and a NIP-46 bunker URL.
- Signing over HTTPS RPC (`POST /api/nostr`) or NIP-46, with a policy per authorization checked before every signature, revocable per device.
- Email and password accounts, with email verification and password reset; key generation or `nsec` import.
- Keys encrypted at rest with AES-256-GCM under a master key held in a file, Google Cloud KMS or AWS KMS.
- Multi-tenant: one deployment serves several domains, each isolated.
- Runs as one binary with Postgres and Redis. ATProto provisioning is optional.
- **Key export** is `POST /api/user/export-key`: it re-checks the account's password, requires a verified email, and returns the key as a plain `nsec` (`nsec` is the only `format` value it accepts).
- **No passwordless door**: no email-code or magic-link sign-in.

## Options considered

### Option A — Build our own custody service

- **For:** exactly the door wanted (email code, no password) from day one; nothing to adapt.
- **Against:** key custody, encryption at rest, OAuth, NIP-46 and per-app policy are a large surface to build and secure from nothing, for a service whose value is that it is boring and correct.

### Option B — A tenant on Divine's `login.divine.video`

- **For:** nothing to run; Divine's email users already hold custodial keys this way.
- **Against:** guests would become Divine identities, and custody of their keys would sit with another company. Event Index is a commons; its guests' keys shouldn't depend on one app company's service.

### Option C — A self-hosted Keycast behind a seam

Run Keycast ourselves on its own small server (the binary, Postgres, Redis, a master key file), not as a tenant of Divine's. Apps reach it only through standards, so that anything speaking them could replace it:

- **At the boundary, only standards:** OAuth 2.0 authorization code with PKCE for sign-in, NIP-46 for signing. Keycast's faster HTTPS signing may be used only inside the adapter.
- **A small guest account API for what has no standard:** start with an email (link and code), set a display name, export the key as `ncryptsec`, link a key, delete the account. Written once, in a spec of its own; Keycast's endpoints sit behind it in one adapter, and a replacement implements the same document.
- **One module per app** (in Brainstorm, a `GuestIdentity` interface with one Keycast implementation); no Keycast names outside it.

- **For:** custody, encryption, OAuth, NIP-46 and policies already built and in production; the seam keeps the choice reversible.
- **Against:** the door and the export don't match out of the box (below), and we run a service with Postgres and Redis.

## Decision

We chose **Option C**: a self-hosted Keycast behind a seam of standards plus one small guest account API, because it gets custody that already runs in production without tying guests to another company, and the seam keeps the choice reversible.

## Consequences

- **The passwordless door is a gap.** Keycast has email and password, and a password is too much to ask for an RSVP. First choice: add an email-code login to Keycast upstream (MIT; ask its maintainers first). If they decline, the door lives in our adapter. Decided at the start of the guest phase.
- **Export doesn't match either.** Keycast's export re-checks a password and returns a plain `nsec`. A guest who signed in with an email code has no password to check, and handing a plain `nsec` to a browser is what NIP-49's `ncryptsec` exists to avoid. So the guest account API's export needs its own confirmation (an email code) and must wrap the key in `ncryptsec` under a password the person chooses at that moment, inside the service, before it leaves; or Keycast gains both upstream along with the door. This was not in the Event Index design; it is recorded here and in the intake entry.
- **The wire format doesn't depend on Keycast.** Guest keys sign standard NIP-52 and NIP-22 events (event-index § 6); a guest's RSVP is indistinguishable on the wire from anyone else's, apart from the kind 0's custodial label. Replacing Keycast changes no event.
- **Visibility under Show and Tell.** A guest key has no trust standing, so a reader whose point of view filters by trust won't see its comments; RSVPs can count in an all-comers "N going" but not in "K you trust". How guest comments read to others is an open product question, not a wire question. An RSVP is something a guest does for their own reasons, so counting it for others is a reuse ([design-philosophies/show-and-tell.md](../../../design-philosophies/show-and-tell.md) § The reuse hazard): the door's copy should say that an RSVP is public.
- **Obligations the service carries regardless of engine:** email deliverability (SPF, DKIM, DMARC before the first message), rate limits per address and per IP, bounce handling, a report-and-remove path before comments open, and deletion that removes the email-to-key mapping and the key.
- **Firmware reinstall required?** No. Nothing in this repo changes.

## Implementation notes

Nothing in this repository implements it: the guest service is its own deployment, and its consumers are apps (Brainstorm-UI first). This repository carries only the wire format (event-index § 6) and this record.

- The guest account API spec is written with the guest service, in its own repository.
- Each consuming app gets one `GuestIdentity`-style module; no Keycast names outside it.
- No test-file changes.

## Out of scope

- The guest service's deployment, secrets and hosting details.
- How guest comments render to others (an open product question).
- Brainstorm-UI's email doors: its own issue and PRs.
