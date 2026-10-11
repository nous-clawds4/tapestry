# Review: Story 2 — Your Assistant publishes its Duty Menu

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-11
**Diff:** `git diff fc485945..6ac4aa87`, attributed commit by commit:
- Code: `6ac4aa87` (the implementation). It is the only commit in the range that touches `src/`, `ui/` or `BIBLE.md`, and it touches no `test/` or `tests/` file.
- Tests: `f6f976c7` (Phase 3) and `5dd50e29` (Amendment 2's re-aims and pins). Neither touches `src/` or `ui/`.
- ADR: `ee7f4074` (Amendment 1) and `8d3b4957` (Amendment 2, the story's § Copy line and § Deviations).
- Unrelated: `8728be4f`, `14455d42`, `8f49e16e`, `837538b1`, `e5e04aea` (book assistant-shared-categories) and `fc4d55ab` (ADR duty-menus-and-self-maps/0003 Amendment A1, proposed). They touch `engineering-team/`, `ledger/`, that book's tests and specs, and `ui/src/pages/assistant/{Index.jsx,actions.js}` and `ui/src/styles.css`. Nothing in them is part of this story.

**Story:** `engineering-team/stories/assistant-duty-menu/2-your-assistant-publishes-its-duty-menu.md` (ACs 1–6, § Copy with the Amendment 2 line, § Deviations)
**ADR:** `engineering-team/decisions/assistant-duty-menu/0002-the-assistant-signs-its-duty-menu-through-one-narrow-route.md` (Accepted; Amendments 1 and 2)
**Test plan:** `engineering-team/stories/assistant-duty-menu/2-your-assistant-publishes-its-duty-menu.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`, read with `npm run gate:status -- --run 20261011T231005Z-5819-2ddf`:
  `20261011T231005Z-5819-2ddf [reviewer-adm2] started 2026-10-11T23:10:05.289Z on 6ac4aa87 — PASS, exit 0, 5729 passed, 0 failed, 582 skipped, 303/303 suites`.
  This is the same count as the Implementer's `20261011T224046Z-6519-9541`. The touched suites, from this run:
  - `assistant-duty-menu-publish` 33 / 0;
  - `assistant-duty-menu-check` 61 / 0;
  - `assistant-duty-menu-page` 15 / 0;
  - `assistant-relay-list-publish` 32 / 0 / 1 skip (H-class, no stack);
  - `assistant-taggings-publish` 19 / 0 / 1 skip (H-class);
  - `admin-action-sweep` 9 / 0, `admin-action-sweep-access` 13 / 0, `admin-action-sweep-named` 6 / 0.
- [x] Browser: `ui/` at HEAD built with Vite into a scratch directory and served by a static SPA server, every `/api`
  route mocked by the spec. Ran `npx playwright test tests/brainstorm/assistant-duty-menu.spec.js --project=chromium`:
  **17 passed** (42.7 s). B1–B11 are unchanged and pass; B12–B16 are this story's.
- [x] `bash scripts/harness-lint.sh`: clean, 0 violations (run before this file existed). L1 will name the story until
  its status reads Done in the review commit.
- [x] Shared lines: `git fetch origin staging`, then `git merge-tree --write-tree HEAD origin/staging` →
  `ffa77683…`, exit 0. `origin/staging` is `6ac4aa87` (HEAD itself), and the tree is `HEAD^{tree}`, so there are no
  conflicts and nothing new upstream. `protocols/` has no commit in `fc485945..HEAD`. ADR
  duty-menus-and-self-maps/0003 A1 (`fc4d55ab`, proposed) only aligns § 4's `z` rule with § 6.1, and this instance's
  menus carry only Nous' `z`.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.

| AC | Where | Pinned by |
|---|---|---|
| AC-1 the button and its report | `DutyMenu.jsx:187` (enabled unless publishing, `'checking'`, or `current`, `:90`); `Report` `:36-51` (`describeServerPublish`, `relayLine`, `publishTone`); the notice for refusals and failed requests; `refresh()` only when `result.ok === true` (`:118`); the report kept in state | P7, P8, D4, D6, W9, W11, B12–B15 |
| AC-2 whose key, what is signed | handler `dutyMenuPublish.js:186-205`: 401 before any key (`:191`), keys first and 403 (`:102-103`), the body never referenced, 500 on a throw (`:204`); the menu built from `buildOffer(resolveOfferInputs(viewer))` (`:108`); `routeAccess.js:88-89` | P1–P7, S1, S2, S6 |
| AC-3 the event | `buildMenuTags` (`src/lib/duty-menu/index.js:150-156`); `created_at` (`:113`); the signer and § 6.1 checked before any write (`:117-120`) | L13, E1–E6 |
| AC-4 where it goes | local write first, nothing sent on failure (`:128-140`); the set (`:144-154`); the guard in one 3 s budget for event-named relays only (`:162-167`); the cap (`:153`); local-only (`:157-158`); the no-other-relay sentence (`:175`) | W1–W11, G1–G3 |
| AC-5 read here first | `dutyMenu.js:209-215`: one strict local scan; a version here ends the lookup; otherwise story 1's rounds run, and the scan still counts toward "finished" | U33–U37; re-aimed U15–U17, U19, U20, U31; U12/U25 (one scan) |
| AC-6 an empty menu says so | `DutyMenu.jsx:182-184` | D7, B16 |

## ADR adherence
- [x] Files changed match the ADR's implementation notes. The one extra file, `src/middleware/routeAccess.js`, is
  ratified by Amendment 2 item 1, and the entry's wording is the amendment's, verbatim.
- [x] Layering / module boundaries respected.
- [x] No new dependencies the ADR didn't authorize (`relayHostGuard.js` uses `net`, `dns` and `./ssrfGuard`).

By sub-decision:
1. **Route and module.** The route is registered at `src/api/index.js:607`, beside the outbox route, in that block's
   voice. The exports, the handler's order and `WORDS` all match (P1).
2. **Tags.** `buildMenuTags` gives `d`, Nous' `z` and `p`, then the duty rows in offer order. Content is `''` and there
   are no other tags.
3. **Author check.** `signed.pubkey` must equal the derived Assistant key and `isDutyMenu(signed, signed.pubkey)` must
   hold, or the route throws before `importEvent`. `isDutyMenu`'s doc comment gains the caller-duty sentence.
4. **The newest version.** `latest` comes from the same local-first lookup. `created_at` is
   `max(now, latest.created_at + 1)`. The earlier version's relays are `readMenuRows(latest)`, which reads them from an
   invalid version too (E4, W2).
5. **Where it goes.** The configured relays are the rows' relays, i.e. `BRAINSTORM_RELAY_URL`, which `outsideOnly`
   removes, and the Relay Settings DList fallback (`dutyMenu.js:102-110`). The event-named relays come in § 8.1's
   order, normalized, put through `outsideOnly`, de-duplicated against the configured set, then capped. The answer's
   shape matches.
6. **The guard moves.** `src/utils/relayHostGuard.js:15-61` is byte-identical to `relayListPublish.js:98-145` at
   `fc485945`, except one trailing blank line. `relayListPublish.js` still re-exports the same function object (G2),
   keeps `isPlainlyPrivate` and its imports, and its suite stays 32 / 0 / 1 with only S3 and A10 re-aimed.
7. **Local first.** As decided. Amendment 1 item 1 holds: there is one menu scan, and round 2 reuses its result.
8. **The page.** As decided, with the logged deviations: the `publishTone as reportTone` alias, and the button in the
   published panel.
9. **Docs.** `openapi.yaml`, both BIBLE §11 rows, and `attention.js`'s check list are done. See NB2 for the half of
   NB9 that was dropped.

- **Amendment 1, items 2–4.** A10 is re-aimed. No extra budget wraps the fan-out (`publishToRelays` has its own 8 s
  deadline). The profile publish set is read, never sent to (W2).
- **Amendment 2, items 1–3.** All three are implemented as written.
- **Unlogged deviations:** none found.

## Security (the reviewer's focus)
- **Session only; refusals first; body never read.** The viewer comes from `req.session` alone, with the same HEX64
  check as the precedent. No `req.body`, `req.query` or `req.params` appears in the module. P4's getter proves the
  body is never touched.
- **Signs one thing.** It signs a kind-39999 menu built from the server's own offer. It checks the signer and § 6.1
  before `importEvent` (E5: another key, Nous' `z` dropped, or a second `p` each give 500 with nothing written).
  `getAssistantKeys` only reads (`assistantKeys.js:20-26`), so the route cannot provision a key.
- **No other route gains signing power.** S2 walks `src/`, `bin/`, `setup/`, `scripts/` and `ui/src`. Only
  `index.js`, `routeAccess.js` and the client helper name the route. Taggings S2 now admits exactly one more file,
  `dutyMenuPublish.js`, for `privkeyBytesOf`, and still requires the original two.
- **The route-table entry** is `signed-in`, `kind: 'action'`, with a why. That is minimal, and the same as the outbox
  and identification-tags entries.
- **SSRF.** Every event-named relay (the Assistant's 10002, the earlier menu's rows, Nous' 10002) is normalized,
  capped at 50 and checked by `isPublicRelayHostWithin` in one 3 s budget before `publishToRelays`. Only the offer's
  row relays skip the guard (`:164`), and those come from the instance's config. Outside reads verify signatures
  (`relaySource.js:273-285`), so `latest`, and through it `created_at` and the earlier relays, is always the
  Assistant's own signed event.
- **The re-aimed sentinels stayed strict.**
  - Relay-list S3 is back to "only `index.js` names the module", with story 1's carve-out removed.
  - A10 now checks the Resolver rule in the guard's home, requires the route to import the guard, and still forbids
    `lookup(` and ssrfGuard's `isPublicHostname` across both files.
  - Duty-menu S2 adds only `routeAccess.js`.
  - S6 pins the entry's access, kind and why.
- **CSRF.** The posture is the same as the outbox route's: no Origin check and no token on either. See NB4.

## Concept-graph integrity
- [x] Handles are in `kind:pubkey:slug` form. The menu's `z` is `DUTY_MENU_HEADER`, Nous' handle from the lib, not a TA literal (S2: no 64-hex literal in the module).
- [x] Firmware reinstall called out (or performed) if concept definitions changed. No concepts change, so none is needed.
- [x] New code orients via `/api/concept-graph/summaries` rather than re-reading BIBLE.md. Nothing here derives concepts.

## Things tests can't catch
- [x] No secrets in committed files.
- [x] No leftover debug logging or `console.log`. The handler's `console.log`/`warn` are the outbox route's operational lines.
- [x] No commented-out code.
- [x] Error paths and edge cases handled where it matters. A failed local scan falls through to the rounds (U35). A
  write-relay lookup that throws counts as none (logged). The empty offer publishes `d`/`z`/`p` (E3).
- [x] Concurrency / race conditions considered. Two presses in the same second sign the same template, so the event
  ids are identical and strfry de-duplicates them. The button is disabled while publishing.
- [x] Security: input validation at boundaries, no obvious injection vectors. There is no input.

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling without an ADR.

## Product-guide adherence *(when the story traces to a PRD)*
No PRD. § Copy is checked against `dutyMenuCopy.js` (P7, D5), the server's `WORDS` (P1) and the summary sentences
(W1, W7, W9, W11). Every approved sentence matches verbatim. NB1 covers the one case § Copy has no words for.

## Findings

### Blocking
None.

### Non-blocking
1. **`src/api/assistant/dutyMenuPublish.js:175`; `test/assistant-duty-menu-publish.test.js:587-589`.** The person can
   be told something false when relays were named but every one failed the guard.
   - **The probe.** Profile relays configured, the Assistant's one write relay refused by the guard. The answer was:
     `"Your Assistant's Duty Menu was saved on this instance's relay only: no general-purpose, profile or WoT relays are configured."`
   - **Why it's wrong.** This route never sends to those relays, and in the probe they were configured. § Copy has no
     sentence for this case: its added line applies "when no relay outside this instance is named for it" (story
     `:113-114`). Amendment 2 item 3 calls the shared sentence wrong for a Duty Menu, yet keeps it for "every other
     case" (ADR `:305`), and W11's third control pins it as correct.
   - **When it happens.** When every event-named relay fails DNS within the 3 s budget; a DNS outage is enough. The
     per-relay lines below it read "not sent: not a public address", so the person is misled, not harmed. The
     implementation follows the ADR exactly, so this is not blocking.
   - *Ask:* a short Architect amendment that gives this case its own words. For example, widen item 3 to "no relay was
     sent to, and not local-only", or a sentence naming the address check. Amend § Copy and re-aim W11's third control
     with it, or file an OPEN row if deferred.
2. **`src/api/assistant/attention.js:51`.** "nothing is stored anywhere" still stands. `dutyMenu.js` keeps Nous' list
   in memory, now shared with the publisher. That was the second half of story 1's NB9. ADR 0002 sub-decision 9
   (`:206`) restated NB9's line 48 as "the answer shape", so this half was dropped without a decision. *Optional:* say
   "nothing is stored but the in-process Nous list", as `dutyMenu.js:27` does.
3. **ADR 0002 § Consequences (`:213`).** It says "the worst case before a first publish stays as story 1 left it".
   That isn't quite true.
   - The menu scan now runs in series before round 1 (`dutyMenu.js:212-215`). It used to run beside round 2's 8 s
     outside reads.
   - When strfry is slow (`LOCAL_SCAN_TIMEOUT_MS` = 5 s, `src/api/setup/status.js:36`) and holds no menu, the hub's
     worst case grows by up to 5 s: story 1's NB2 put it at about 24 s, so now about 29 s.
   - The steady state is much better.

   *Ask:* correct the sentence. Story 1's NB1 measurement row, if filed, covers it.
4. **CSRF, same as the outbox route.** Neither route checks Origin or a token.
   - The session cookie sets no `sameSite` (`bin/control-panel.js:232-241`).
   - `express.urlencoded({ extended: true })` (`:125`) lets a form post the outbox route's `relays[]`, so its body is
     no barrier either.
   - Here a forged cross-site POST can only publish the instance's own offer. But it can list an Assistant whose
     person chose not to publish (§ 12, "Listing").
   - ADR 0002 is silent on this, unlike the ADRs for three earlier signing routes.

   *Ask:* add this route, and the outbox route, to OPEN row 326's pointers.
5. **DNS rebinding.** The publisher now connects and sends to event-named relays (Nous' 10002 included, `ws://`
   allowed) after a c-ares check that the WebSocket connect does not reuse. This is the gap the outbox route accepted
   and story 1's NB11 raised for the reader. Ledger `2026-09-20-nip05-guard-leaves-dns-rebinding-open` names none of
   the three. *Ask:* add the outbox publish and the duty-menu reader and publisher to that row.
6. **`test/assistant-duty-menu-page.test.js:294`.** D6's `|\bcurrent\b` alternative matches any word "current" in the
   page, so that one check is near-vacuous by source. B12 pins the rule in a browser, so coverage holds. *Optional:*
   drop the alternative.
7. **`src/api/assistant/dutyMenuPublish.js:146-149`.** On a first publish (no menu here), `lookupPublishedMenu`'s hint
   round has already looked up both write-relay lists, and the route looks them up again. Nous' list is cached and the
   Assistant's read is local-first, so the cost is small. *Optional:* return the hint lists from the lookup.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. **New routes and the route table.** Nothing in the ADR template or the Architect role prompts for a new route's
   entry in the fail-closed route table (`src/middleware/routeAccess.js`, ADR security-auth-exposure/0005). ADR 0002
   named the route and its registration but not the entry. Implementation found it only through `admin-action-sweep`
   AC6a, which cost Amendment 2 and a Tester round. *Suggested `meta` row:* the template's Implementation notes ask,
   for every new route, for its `ROUTE_ACCESS` entry (access, kind, why).

## Verdict
**PASS**

The diff meets AC-1 to AC-6 as amended and conforms to ADR 0002, sub-decision by sub-decision, with both amendments.
The gate is green on `6ac4aa87` (5729 / 0), and the browser spec passes 17/17 against a fresh build.
- **The signing route is narrow.** It is session-bound, reads no body, and refuses before any key is read. It signs
  only a server-built kind-39999 menu, checked for its signer and § 6.1 before any write.
- **The SSRF ordering is right.** Every event-named relay is capped and DNS-guarded before connection. The moved
  guard is byte-identical.
- **The re-aimed sentinels stayed strict.**

The findings are a misleading summary sentence the ADR chose to keep, two documentation corrections, two
security-posture pointers for existing rows, and test and efficiency nits.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place. *Left to the main session, which commits this review and flips the status.*
- [ ] Completion detection: left to the main session; the result goes in the chat, never in this file.
