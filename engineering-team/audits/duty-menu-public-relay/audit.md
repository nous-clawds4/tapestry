# Build Audit: The instance's public relay address, for the Duty Menu and Outbox Relays

**Book:** `duty-menu-public-relay`
**Mode:** Acceptance-frame (no PRD); Light trial, Bug lane
**Anchor:** `engineering-team/audits/duty-menu-public-relay/book.md` § Acceptance frame
**Confidence:** high for the code. The owner's republish on staging is the remaining live check (§5).
**Dates:** opened 2026-10-12, closed 2026-10-12

## 1. What shipped

- [x] **Scores and Lists come back.** `instanceRelayUrl()` (`src/api/assistant/profileDefaults.js`) names this
      instance's public relay: `BRAINSTORM_RELAY_URL` when public, else `wss://<public domain>/relay`, else none. The
      Duty Menu offer uses it (`dutyMenu.js` `resolveOfferInputs`). On staging and production the offer names
      `wss://<domain>/relay` for Lists and Concepts, and for Scores where the viewer gets them.
- [x] **Outbox Relays suggests the same address** first (`outboxRelays.js` `outboxSuggestions`).
- [x] **Nothing else changes.** A public `BRAINSTORM_RELAY_URL` still wins, and with no public domain there is still no
      own relay. Tests I9, I10, U39, U40, G7 and G8 pin this.
- [x] **On staging, then production.** Staging runs 651 and 654 succeeded. Production went out as PR #853 (a
      selective promotion from `promote/duty-menu-public-relay` at `6bab1e5a`), merge `6f75160a`, deploy run 150, smoke
      clean. Production's `/relay` answers NIP-11 publicly.

## 2. Epics & stories rolled up

### Epic: `duty-menu-public-relay`

| Story | Commits | Verdict | Rounds |
|---|---|---|---|
| #1 The instance's public relay address (Bug) | story `e7d73c9d` · impl `762d3508` · review r1 + premise `ab125cbd` · fix `865dbdbe` · review r2 `6bab1e5a` | PASS (round 2); Gate B approved by the owner | 2 |

## 3. As-built inventory

- **Code:**
  - `src/api/assistant/profileDefaults.js`: `instanceRelayUrl()`;
  - `src/api/assistant/dutyMenu.js` and `src/api/assistant/outboxRelays.js`: an `instanceRelayUrl` seam.
- **Tests:**
  - I8–I10 in `one-default-assistant-profile`;
  - U38–U41 in `assistant-duty-menu-check`;
  - W12–W13 in `assistant-duty-menu-publish`;
  - G6–G8 in `assistant-outbox-relays-page`;
  - 8 re-aims (U9, U10, U13, U14, U26, U28, U29, U32), whose "no public address" configs kept a public `STRFRY_DOMAIN`.
- **Undocumented work in the diff:** none.

## 4. Deviations from intent

| # | Specified | Built | Type | Rationale | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Intake diagnosis: `docker-compose.yml:82` `ws://tapestry:80/relay` | The real value is `ws://localhost:7777`, the tapestry container's entrypoint default | Premise corrected at Gate B | Review round 1 B1 | None: both are non-public, and the fix covers both | — |
| 2 | ADR assistant-duty-menu/0001 sub-decision 2 and ADR assistant-outbox-relays/0002 sub-decision 1 read the own relay from `BRAINSTORM_RELAY_URL` | They read it from `instanceRelayUrl()` | Superseded in part (Design note) | The accepted ADR text in `done/` is not edited (ledger `2026-10-11-implementer-edited-accepted-adr`). This audit records the supersession, and that ADR 0002's staging premise (`0002:41-45`) was false. | — | — |

## 5. Quality state at close

- **Gate after the flip and the epic close-out:** `20261012T023059Z-20536-2e11 [book-close-dmpr-rerun] … on 3d0b6d48+dirty — PASS, exit 0, 5753 passed, 0 failed, 582 skipped, 304/304 suites`.
  - **The first run was FAIL.** `20261012T022448Z-19090-8004` had one failure,
    `tagging-edges-realtime-wrapper` RW7, a timing window (a restart at 0.77 s against a 0.8 s floor) under load.
    This book doesn't touch that suite, and the suite passed alone (24/0). It is the known flake in ledger
    `2026-10-08-realtime-wrapper-timing-flake-under-load`, where this occurrence is appended.
- **Story gates:**
  - scoped gate exit 0;
  - round 2: `20261012T015922Z-32686-a952` (PASS, 5741/0, 303 suites);
  - PR #853's `stack-free` CI: success.
- **Not yet verified live:** the owner republishing on staging or production and seeing Lists, and Scores where they
  apply. Signed-in use is outside this container's reach.

## 6. Carry-forward register

- [ ] **The owner republishes the Duty Menu** on staging and production. Both read **out of date** until then.
      *Staging done, 2026-10-12.* Menu `6b5a73ca…` (02:58:53Z) is valid by § 6.1 and is the same newest version on
      staging's relay and dcosl. It offers `30382`, `30392`–`30394`, `39998` and `39999`, all at
      `wss://staging.brainstorm.world/relay`, and that relay holds events of each kind signed by the Assistant.
      Production is still to do.
- [ ] **AC-4's gap for a domain with a port, an IDN or an IPv6 literal** (ledger
      `2026-10-12-derived-relay-literal-domain-match`). No deployment is affected.
- [ ] **The Map vs menu relay for Scores** (ledger `2026-10-11-nip85-home-relay-without-copy`, unchanged by this book).
      The cross-book row `2026-10-12-duty-menu-code-cross-book-notes` item 2 is updated.

## 7. Process findings (harness)

| Finding | Source | Ports to the other flow? | Terminal state |
|---|---|---|---|
| 1. The original book's tests configured `BRAINSTORM_RELAY_URL` as a public URL. No test used a deployment's real values, so a rule that never fires on Docker passed review twice. | this close (the root cause of the defect) | Yes | OPEN.md row `2026-10-12-test-configs-not-from-deployments` (new, `meta`) |
| 2. In the Light Bug lane, a premise error (the wrong container's config, cited in the story, the code comment and the tests) had no rejection point before Gate B. Gate B caught it, at the cost of one round. | review round 2, Harness friction 2 | Bug lanes elsewhere | **Declined:** the trial's single gate did its job, the error changed no behavior, and adding a design gate to Bug lanes would undo the profile's point. Recorded here as a Light-trial observation. |
| 3. The fix was pushed to `staging` before Gate B (stop hook). Then a parallel book's failing tests entered the promotion PR, and a selective `promote/*` branch got the fix out. | review N2; this close | Yes | OPEN.md row `2026-10-07-staging-sessions-push-red-tests` (recurrence and workaround appended) |
| 4. **Light trial: followed or bent?** Followed, with one bend: the push before Gate B (finding 3). | trial protocol | — | Recorded (this row) |

## 8. Epic close-out

`duty-menu-public-relay`: story 1 Done and on production. The epic flips to **Done**, and its story and review folders
move under `done/`. There is no ADR folder (Design note).
