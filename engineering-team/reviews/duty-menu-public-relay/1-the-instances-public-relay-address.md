# Review: Story 1 — The instance's public relay address

**Reviewer:** Claude (acting as Reviewer), Gate B of a Light (trial) Bug lane
**Date:** 2026-10-12
**Diff:** `git show c54bff32` (parent `e7d73c9d`, the story commit). It changes `src/api/assistant/{profileDefaults,dutyMenu,outboxRelays}.js`, four suites, and the story's § Deviations.
**Story:** `engineering-team/stories/duty-menu-public-relay/1-the-instances-public-relay-address.md` (AC-1 to AC-4, Design note, Edge cases, AC → handles, Scoped gate, Deviations)
**Book:** `engineering-team/audits/duty-menu-public-relay/book.md` (acceptance frame, Light Bug lane)
**ADRs the Design note supersedes in part:** `decisions/done/assistant-duty-menu/0001-*.md` sub-decision 2; `decisions/done/assistant-outbox-relays/0002-*.md` sub-decision 1
**Test plan:** the story's Edge cases and AC → handles (Light)

## Quality gates (run by reviewer, not trusted)

- [x] Scoped gate, the story's loop exactly as written. It ran in the foreground, with the exit code taken by brace-redirect and no pipe: `scoped exact exit=0`. A second run with per-suite counts printed:
  - `assistant-duty-menu-check` 65/0, `assistant-duty-menu-publish` 35/0, `assistant-duty-menu-page` 15/0;
  - `assistant-outbox-check` 29/0, `assistant-outbox-relays-page` 21/0;
  - `one-default-assistant-profile` 55/0, `recognizable-published-ta-profile` 8/0, `my-assistant-page` 31/0.
- [x] `npm test` (`GATE_LABEL=reviewer-duty-menu-public-relay-1`), read with `npm run gate:status -- --label reviewer-duty-menu-public-relay-1`:
  `20261012T013652Z-16978-866a [reviewer-duty-menu-public-relay-1] started 2026-10-12T01:36:52.134Z on c54bff32 — PASS, exit 0, 5741 passed, 0 failed, 582 skipped, 303/303 suites`.
  This matches the Implementer's counts (`20261012T012531Z-15429-f1b1`).
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`, exit 0. It ran before this file existed.
- [x] Playwright: not applicable. No `ui/` change.
- [x] _Lint, typecheck, build: not configured. Skipped._

## Spec adherence

### AC verdict table

| AC | Verdict | In code | Handles (all green) | Teeth (a mutation in a scratch copy of HEAD, not the repo) |
|---|---|---|---|---|
| AC-1: public address on Docker | **Met**. AC-1 states its premise wrongly; see B1 | `profileDefaults.js:109-116`; `dutyMenu.js:103` (the check, and the publisher through `resolveOfferInputs`); `outboxRelays.js:96-97` | I8, U38, W13, G6 | Pre-fix source (`e7d73c9d`) fails exactly I8, I9, I10, U38, W13 and G6, as the commit claims. Reverting `dutyMenu.js` fails U38 and W13; reverting `outboxRelays.js` fails G6. |
| AC-2: public relay URL wins | **Met** | `profileDefaults.js:113` | I9, U39, G8 (and the older U11) | Dropping the configured-URL branch fails I9, U39, G8 and U11. |
| AC-3: no public address, no rows | **Met** | `profileDefaults.js:114-115` (`describeInstance().isPublic`) | I10, U40, G7, and all eight re-aimed tests | Deriving without the publicness check fails I10, U40 and all eight re-aimed tests (U9, U10, U13, U14, U26, U28, U29, U32). G7 survives it, because `outboxRelays.js:91` drops plainly-private hosts on its own (N6). |
| AC-4: still this instance | **Met** for every spelling the plan names. There is a gap beyond the plan (N1) | `outsideOnly` is unchanged (`setup/status.js:215-219, 228`). `normalizeRelayUrl` keeps the trailing dot, so the derived host equals `STRFRY_DOMAIN` lower-cased | U41, W12, W13 | Removing outsideOnly's `STRFRY_DOMAIN` entry fails U41, W12 and W13. Stripping the trailing dot from the derived URL fails U41 and I8. |

- [x] Every AC has a passing test.
- [x] No AC is dropped. The scoped gate moved the suggestion handles to `assistant-outbox-relays-page` (G6–G8); this is logged and both suites are in the gate.
- [x] Nothing outside the story was added. W13 is one extra handle, and it is logged.

### Evidence table

| Claim | Who made it | How I checked | Result |
|---|---|---|---|
| Docker sets `BRAINSTORM_RELAY_URL` to `ws://tapestry:80/relay` (`docker-compose.yml:82`) | Story Background `:18-19`, AC-1 `:36`; `profileDefaults.js:105-106`; test comments | I read `docker-compose.yml`, `docker/entrypoint.sh`, `Dockerfile`, `.github/workflows/` and `BIBLE.md:1050-1056` | **False.** `:82` is in the `nostr-search-api` service (`:73-90`; BIBLE lists it under "nostr-search-api Environment Variables"). The `tapestry` service passes no `RELAY_URL` (`:15-29`). The entrypoint defaults it to `ws://localhost:7777` (`docker/entrypoint.sh:9`, exported `:46`). No workflow overrides it. The behaviour is unaffected, because both hosts are non-public. → B1 |
| On the real Docker shape, the fix gives the right address | — | Probe: `instanceRelayUrl` + `outsideOnly`, with `ws://localhost:7777` beside each deployment's domain | `wss://staging.brainstorm.world/relay` and `wss://tapestry.brainstorm.world/relay`, never read as outside. No test pins this shape (B1). |
| Nginx serves `/relay` publicly at that address | Story `:26-27`; `docker/nginx.conf:51-58` | Read-only, from outside: NIP-11 `GET https://<host>/relay`, then one websocket `REQ` (limit 1) each for kinds 30382, 30392, 39998 and 10002 | Both hosts answered 200 `application/nostr+json` (`strfry+nip50-proxy`). Every REQ returned an event and EOSE, on both. Scores, Lists and Concepts are readable there by strangers, so the menu will not be false. Bare-metal nginx also serves `/relay` (`setup/setup-nginx-deprecated.sh:56`). |
| Trailing dot and capitals keep AC-4 | Deviations `:118-121` | Probe over `outsideOnly` | Holds for `Staging.Brainstorm.World`, `staging.brainstorm.world.` and `STAGING.BRAINSTORM.WORLD.`. Fails for a port, an IDN or a bracketed IPv6 literal → N1 |
| Pre-fix failures: I8, I9, I10, U38, W13, G6 | Commit message | Ran the new suites over the `e7d73c9d` source in a scratch copy | Exactly those six fail. (S4 and R1 fail in the scratch copy at HEAD too: it lacks `BIBLE.md` and the page sources. They are environment artifacts, not this diff.) |
| The 8 re-aims kept their teeth | Deviations `:125-129` | Mutations: deriving without the publicness check, and keeping a private configured URL | All eight fail under both. N5 records the one shift: which own-relay route U13 and U32 now cover. |
| Blast radius is the three modules plus the outbox suggestions | Design note `:61-66` | `grep` for `instanceRelayUrl`, `isPublicHost`, `describeInstance`, `getInstanceDomain` and `resolveOfferInputs` | `instanceRelayUrl`'s only callers are `dutyMenu.js:70,103` and `outboxRelays.js:43,96`. `isPublicHost`, `describeInstance` and `getInstanceDomain` are byte-unchanged; their callers (`profileDefaults.js:68`, `assistant/index.js:74,134,245,398`, `profileChecklist.js:242`) behave as before. Profile defaults, setup, the TA profile and the profile checklist are untouched. The OpenAPI text ("this instance's relay at its public address", `openapi.yaml:303,333`) now describes Docker truthfully. |
| Merge onto the shared line is clean | — | `git fetch origin staging`, then `git merge-tree --write-tree HEAD origin/staging` | Clean, exit 0. Its tree `dcbb610d…` **equals `origin/staging^{tree}`**: the identical patch is already on `origin/staging` (N2). |
| The commit is unpushed | The Gate B brief | `git log HEAD..origin/staging`, the remote-tracking reflog, `gh run list` | **False.** It was pushed as `762d3508`, the same patch rebased onto `b25f89ac`. Reflog: "update by push" at 01:31:47 from this checkout; local HEAD did not move. `Deploy to Staging` run 38192243717 succeeded at 01:31:49Z → N2 |

## ADR adherence

- [x] The files match the Design note: one helper beside `describeInstance`, and both call sites take `ownRelay` and the first suggestion from it.
- [x] Layering holds. The seam reads the injected `getConfigFromFile` (`dutyMenu.js:70`, `outboxRelays.js:43`), so the publisher's `resolveOfferInputs(viewer)` with real deps reads the real config.
- [x] No new dependency.
- [ ] The two ADRs the note supersedes (`0001` sub-decision 2 at `:181-182`; `0002` sub-decision 1 at `:88-89`) still state the old rule. Outbox `0002:41-45` still states the premise this bug grew from ("on staging, `wss://staging.brainstorm.world/relay`"). Both are in `done/`. → N4

**Design-note classification: ratified.** It is a Design note, and no irreversibility trigger fires:
- The menu's tags keep their shape; only the relay values change.
- There is no auth default, schema or firmware change, dependency, routing or middleware change, header change, or cross-repo value.
- `/relay` is read from this repo's own nginx config; it is not changed.

The approach is sound. The rejected alternative's reason is real: 13 `BRAINSTORM_RELAY_URL` readers reach strfry from inside, e.g. `publishNip85.sh` and `stream/addToQueue.mjs`. But it names the wrong service (B1). The blast-radius sentence "`outsideOnly` already drops a relay whose host is `STRFRY_DOMAIN`" holds only for bare-host spellings (N1).

## Concept-graph integrity

- [x] No concept definitions, handles or firmware are touched. No reinstall is needed, and the TA pubkey is not involved.

## Things tests can't catch

- [x] No secrets. No debug logging: the tests restore `console`. No commented-out code.
- [x] Error paths: `new URL(configured)` only sees a normalized URL. A domain that doesn't normalize (for example, one with spaces) gives `null`, which fails closed and adds no row. A thrown config read is still the caller's `check-failed`, as before.
- [x] No concurrency or storage change. Principle 4 is unaffected. Principles 1–3: the instance's relay address is instance config, not a per-POV answer.

## House rules check

- [x] Concept Graph API authority: not engaged.
- [x] No new lint, typecheck or build tooling.

## Findings

### Blocking

1. **Premise error in the durable record and an unpinned real shape: `src/api/assistant/profileDefaults.js:105-106`, `test/one-default-assistant-profile.test.js:301-304,307`, `test/assistant-duty-menu-check.test.js:1092-1098`, `test/assistant-outbox-relays-page.test.js:207-209`, `test/assistant-duty-menu-publish.test.js:600,606`, story `:18-19,36,58-60`.**
   - **What is wrong.** The source comment says Docker deployments name the relay `ws://tapestry:80/relay`, and the tests cite `docker-compose.yml RELAY_URL` for it. That variable belongs to the `nostr-search-api` container. Every Docker deployment's `tapestry` container carries `BRAINSTORM_RELAY_URL="ws://localhost:7777"` (`docker/entrypoint.sh:9`, `config/brainstorm.conf.template:66`).
   - **Why it matters.**
     - The rejected alternative was weighed against this wrong model. "Change `RELAY_URL` in `docker-compose.yml`" would have redirected nostr-search's live ingestion, and would not have fixed the menu.
     - The comment invites the same mistake later.
     - The book-close audit will harvest the false cause.
     - No handle pins AC-1 on the value deployments actually carry. The code path is the same and my probe shows it works, but the regression test models a configuration no deployment has.
   - **Asked change** (no behaviour change):
     - Correct the comment at `profileDefaults.js:105-106`: on Docker, the `tapestry` container's `BRAINSTORM_RELAY_URL` is `ws://localhost:7777`, the entrypoint default.
     - Drop the `docker-compose.yml RELAY_URL` citation and the "Docker's ws://tapestry:80/relay" wording in the test comments and titles above. `tapestry:80` can stay as "an internal address".
     - Add `ws://localhost:7777` beside a public `STRFRY_DOMAIN` to I8 and to U38 (or G6).
     - Record the correction in the story's § Deviations: the Background's cause, AC-1's Given, and the rejected alternative. The honest alternative is a `RELAY_URL` for the `tapestry` service, rejected for the same reason. Put the note in Deviations, not as a Background rewrite.

### Non-blocking

1. **`profileDefaults.js:115` vs `setup/status.js:218-219` — AC-4 gap beyond the plan.**
   - **What happens.** `outsideOnly` matches `STRFRY_DOMAIN` as written, but the derived URL is canonicalized by `URL`. So a public `STRFRY_DOMAIN` that carries a port, an IDN or a bracketed IPv6 literal is read and sent to as an outside relay. Probe:
     - `relay.example.org:8443` gives `wss://relay.example.org:8443/relay`, read as outside;
     - `bücher.example` gives `wss://xn--bcher-kva.example/relay`, read as outside.
   - **Impact is low.** The cost is a self-read and a duplicate self-write that strfry de-duplicates. No deployment has such a domain: `DOMAIN_NAME` is an nginx `server_name` and certbot name, and `brainstorm.conf.template:69` already appends `:7474` to it.
   - **Optional.** Have `instanceRelayUrl` return `null` unless the derived host equals `STRFRY_DOMAIN.trim().toLowerCase()`, which fails closed and stays inside the blast radius. Or file a ledger row.
2. **Pushed and deployed before Gate B.** `origin/staging` already carries `762d3508`, an identical patch, deployed by run 38192243717. Two consequences:
   - The human should know that staging already runs this change.
   - The local `c54bff32` is now a duplicate. The fix-up and review commits belong on top of `origin/staging`; `git pull --rebase` drops the duplicate.
   
   This is not a code defect. See Harness friction 1.
3. **`ledger/2026-10-12-duty-menu-code-cross-book-notes.md` item 2 (on `origin/staging`, book `duty-menus-and-self-maps`)** says the menu takes its relay from `BRAINSTORM_RELAY_URL`, citing `dutyMenu.js:100–103`. That is stale now. Optional: add one dated line naming `instanceRelayUrl`. That book is docs-only, so no code collides.
4. **ADR `assistant-outbox-relays/0002:41-45,88-89` and ADR `assistant-duty-menu/0001:181-182`** still state the superseded rule, and `0002` still states the false staging premise. Both are in `done/`. The book-close audit should record the supersession, which the Design note already declares.
5. **Re-aims:**
   - **No teeth lost, but the route shifted.** U13's private half and U32's own-relay sentinel used to pin outsideOnly's `STRFRY_DOMAIN` route. Under the re-aim, `localhost` is "own" by three routes at once, so neither test isolates one route any more.
   - **Where that route is pinned now.** U41, W12 and W13 cover it; the mutation fails all three. This is recorded so that a later re-aim doesn't drop U41 thinking U13 still covers it.
6. **Tests:**
   - `test/assistant-duty-menu-publish.test.js:238`: the `isPublicHost` seam in `lowLevel` is dead now, because `dutyMenu.js` no longer reads it. Optional removal.
   - G7 is guarded twice (by the helper and by `outboxRelays.js:91`). I10 and U40 carry AC-3's teeth for the helper.

### Harness friction

1. **The commit reached the shared line and deployed before the Light Bug lane's only human stop.**
   - The remote-tracking reflog shows "update by push" two seconds after the commit, as a rebased copy; local HEAD did not move. The story commit `e7d73c9d` went the same way.
   - No in-repo git hook or script does this, so it looks like environment-level auto-push.
   - The Gate B brief believed the commit was unpushed.
   - Asked: an OPEN.md `meta` row. Under auto-push, Gate B on `staging` is a post-deploy review, and the profile should say so or the push should wait for the verdict.
2. **The premise error (B1) went through intake, epic, story, tests and source with no rejection point before Gate B.** The Bug lane has no Gate A and no J1, so nothing checks the diagnosis independently. This is a Light-trial observation for the book audit's §7.

## Light trial

- **Followed:** the lane's shape (Implementer, then Reviewer); one story file holding the Design note, edge cases, AC → handle lines and the scoped gate; the Implementer's judgment calls and the eight re-aims logged in § Deviations; the scoped gate green, and the full gate reported with its run id.
- **Bent:** the change was pushed and deployed to staging before Gate B (Harness friction 1). That was probably the environment's doing, not the Implementer's.
- **Provisional Design note:** the Bug lane carried a Design note for Gate B ratification. That is a sensible extension, and I don't count it as a bend.
- **Finding count:** this review has 1 blocking and 6 non-blocking findings, against a corpus median of 3. The probes beyond the plan found the premise error and the AC-4 port/IDN gap.

## Story status

Not flipped. The story stays **Status:** Approved, per the brief and the verdict. No completion detection runs on this verdict.

## Verdict

**CHANGES_REQUESTED**. One blocking finding (B1): correct the false Docker relay-URL premise in the source comment, the test framing and the story record, and pin the real `ws://localhost:7777` shape in I8 and U38 (or G6). There is no behaviour change to make. The fix itself is correct for staging and production.
