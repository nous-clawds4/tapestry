# Story 4: Negentropy syncs are run by the owner and admins; signed-in people keep the POV sync

**Status:** Done
**Created:** 2026-10-10
**Type:** Bug (security / access control)
**Epic:** `security-auth-exposure`
**Book:** `audits/negentropy-sync-access/`

## Background

A negentropy sync makes this instance run `strfry sync` against a relay the request names, with a filter and a
direction (`down`, `up` or both). Before this story the routes that start one were gated as follows:

- `POST /api/negentropy-sync`, `-wot`, `-profiles`, `-personal` (the legacy control panel, `public/pages/home.html` and
  `control-panel.html`) and `POST /api/strfry/negentropy-sync`: on the auth middleware's `authenticatedEndpoints`
  list (`src/middleware/auth.js`), so **any signed-in session** could run any sync. Sign-in is open to any nostr key.
- `GET /api/strfry/negentropy-sync/stream` starts a sync from its query string; `/count` connects to the named relay;
  `/status` reports the active sync. They are GETs, so the middleware's default-deny for unauthenticated mutations
  (ADR security-auth-exposure/0002) never applied, and no handler checked the caller: **a visitor who was not signed in
  could start a sync, in either direction, with any relay.** Live on staging and production until 2026-10-10.
- The saved presets' four POSTs (`/api/strfry/negentropy-presets*`) were already guarded by `requireOwnerOrLocal`, whose
  `isOwner` is the owner-or-admin alias; their list GET was readable by anyone (story 6 guards it).
- The registered sync tasks could also be started or scheduled by any signed-in session through the task-control
  routes, without choosing a relay or filter; story 6 closes that.

Three pages use `POST /api/strfry/negentropy-sync` for ordinary signed-in people: Brainstorm Search, Search Preferences
and Brainstorm Settings each download one author's kind 30382 Trusted Assertions from that author's NIP-85 relay, so a
chosen point of view's scores reach this instance (principle 1, POV-first).

The owner decided on 2026-10-10 (book `negentropy-sync-access`): owner and admins manage syncs; signed-in people keep
the narrow POV sync; ship as a hotfix, record after.

## User-facing description

As the owner of a Brainstorm instance, I want only me and my admins to be able to make this instance sync with other
relays, so that a stranger cannot point it at a relay of their choosing or push its events elsewhere. People who sign
in to use search should still be able to bring their own point of view's scores here.

## Acceptance criteria

- [x] **AC-1** A visitor who is not signed in is refused 401 by every negentropy-sync route, and no sync starts:
      `POST /api/strfry/negentropy-sync`, `GET …/stream`, `GET …/status`, `GET …/count`, and the four legacy POSTs.
- [x] **AC-2** A signed-in person who is not the owner or an admin is refused 403 by the stream, status and count
      routes and by the four legacy POSTs.
- [x] **AC-3** Such a person may run `POST /api/strfry/negentropy-sync` only with `dir: "down"` and a `filter` of
      exactly `{ kinds: [30382], authors: [<one lowercase 64-hex pubkey>] }`; any other direction, kind, author count
      or extra filter key is refused 403.
- [x] **AC-4** The owner, an admin, or a direct-local caller (`req.localTrusted`, the loopback task scripts) may run
      any sync on every route, as before.
- [x] **AC-5** The three POV pages keep working for ordinary signed-in people: each sends exactly the AC-3 shape.
- [x] **AC-6** The saved presets stay managed by the owner and admins (and direct-local callers); their list GET is
      guarded the same way (story 6).
- [x] **AC-7** The OpenAPI entries for the documented sync routes state the rule and the 401/403 refusals.

## Concepts touched

None. No concept-graph, event-kind or firmware change.

## Out of scope

- **Which relays.** The POV sync may still name any `ws(s)://` relay; whether it should be limited to public addresses
  (as the Outbox Relays publish is, ADR assistant-outbox-relays/0003) is ledger row `2026-10-10-pov-sync-relay-scope`.
- The `authenticatedEndpoints` list in the middleware stays; the routes' own guard decides (a comment there says so).
- Relay Settings' UI for people who are not owner or admin (the sync panel now answers them 403).

## Open questions

None open. Decisions are recorded in the book.

## Deviations

- **The first record claimed more than shipped.** It said only these eight routes start a sync and ticked "only the POV
  sync" while the task-control routes could still start the sync tasks, and it said every preset route was guarded.
  Review round 1 caught both; stories 6 (task control, presets list) and these corrections close them.

- **Shipped before the record.** By the owner's choice the code and tests went out as a hotfix (PR #837, merge
  `8fbd68d0`; `staging` `dc318717`) and this story, its test plan and ADR 0004 were written after, from the shipped
  diff. The review is the first independent read.

## Linked artifacts

- ADR: `engineering-team/decisions/security-auth-exposure/0004-one-guard-for-negentropy-syncs.md`
- Test plan: `engineering-team/stories/security-auth-exposure/4-negentropy-sync-owner-and-admins.test-plan.md`
- Tests: `test/negentropy-sync-access.test.js`
- Code: `src/api/strfry/negentropyAccess.js`, `src/api/strfry/negentropySync.js`, `src/api/index.js`,
  `src/middleware/auth.js` (comment), `src/api/openapi.yaml`
- Ledger: `2026-10-09-negentropy-sync-access-scope` (closed by this story), `2026-10-10-pov-sync-relay-scope`
