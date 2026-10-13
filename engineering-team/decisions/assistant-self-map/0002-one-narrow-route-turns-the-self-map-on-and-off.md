# ADR 0002: One narrow route turns the self-Map on and off, merging only the self-entries, with the choice in its own file

**Status:** Accepted (by the owner, 2026-10-12, "Ready for test design", with the gate points as proposed: the choice in
its own file, C1; the strict read before a merge, R1; the unreadable-file addition; the fan-out duplication left as a
follow-up); Amendment 1 approved (review round 1); Amendment 2 approved (review round 2); Amendment 3 approved (review round 3); Amendment 4 approved (review round 4)
**Date:** 2026-10-12
**Story:** `engineering-team/stories/assistant-self-map/2-turning-the-self-map-on-and-off.md`
**Extends:** ADR `assistant-self-map/0001`. Its check, should-say rule and self-Map lookup are reused. Its sub-decision 10
("no new route; nothing signs") was story 1's scope, and this story adds the route.

## Context

**The story.** Six ACs:
- **AC-1:** a remembered on/off choice per Assistant, off until pressed, which survives everything and is carried in the
  hub's answer.
- **AC-2:** **Turn on** while off, **Update now** and **Turn off** while on, with Turn off also shown while off
  whenever self-entries are still found. A press that would change nothing publishes nothing. The report has the Duty
  Menu's shape, and the page refreshes after a press.
- **AC-3:** the session decides whose Assistant signs. The request says only which button, and no other route signs
  a kind 10040 as an Assistant.
- **AC-4:** the new version is built from the newest version found. Only the self-entries are replaced; every other tag
  and the content are kept byte-for-byte, except a dropped `expiration`, and `created_at` is later than the last. If the
  reads don't finish, nothing is published.
- **AC-5:** off removes the self-entries and retracts nothing. If nothing is left, the new version is empty.
- **AC-6:** this instance's relay first, then § 9.2 Finding a self-Map's places, with the Duty Menu's relay rules.

**Orientation.** The stack is absent, so this followed the AGENTS.md §2 fallback (docs and grep). The story touches no
concept: `nostr-user` and `nostr-relay` are named only as roles. No firmware change is needed.

**What exists** (branch `feat/assistant-self-map` at `7b32926`, which merges `origin/staging` at `9a7735a`, with
`assistant-duties-settings` #1 implemented):

- **The Duty Menu's signing route**, `src/api/assistant/dutyMenuPublish.js` (ADR `assistant-duty-menu/0002`):
  - `createPublishDutyMenuHandler` reads the viewer from the session and refuses first: 401 not signed in, 403 no
    Assistant (`:183–191`, `:102–103`).
  - `publishDutyMenuFor` (`:99–177`) works in this order:
    - `getAssistantKeys(viewer)`, `privkeyBytesOf` and `getPublicKey`;
    - the offer, through `resolveOfferInputs` and `buildOffer`;
    - the newest version, read local-first;
    - `created_at = max(now, latest.created_at + 1)`;
    - `finalizeEvent`, then an author check;
    - `importEvent` to local strfry. If that fails, the route returns with nothing sent elsewhere;
    - otherwise the configured relays, sent as such, then at most `MAX_RELAYS` event-named relays, each
      DNS-guarded (`relayHostGuard`);
    - `summarizePublish` for the report.
  - Its route-table entry is `allow('signed-in', …)` (`src/middleware/routeAccess.js:88`). It is registered at
    `src/api/index.js:613`.
- **Story 1's check**, `src/api/assistant/selfMap.js`:
  - `checkSelfMap` (`:259–285`) runs, in order:
    - the offer;
    - the viewer's Map, through `lookupNewest` over `treasureMapRelays`;
    - `readUpkeep` and `lookupSelfMap` side by side;
    - `evaluateSelfMap`.
  - `lookupSelfMap` (`:218–247`) is local-first: when this instance's relay holds any version, nothing else is read.
    Its `latest` is "kept for story 2's merge" (`:214`).
  - `mapHints` (`:208–211`) takes element 3 from every viewer entry naming the Assistant, whether or not its key parses
    (story 1 review R3-N2).
  - `readUpkeep` gained `assistant-duties-settings` ADR 0001 sub-decision 6 (`:165–169`). This ADR doesn't touch it.
- **The pure library**, `src/lib/self-map/index.js`:
  - `readSelfEntries` (`:347–365`) reads the entries whose element 1 parses as a key and whose element 2 is a 64-hex key
    equal to the author. It drops the four spellings that name nothing (`NAMELESS_KEYS`, `:66`).
  - `sameSelfEntries` (`:367–375`) compares them as sets.
  - `buildShouldSay` (`:291–330`) builds what the self-Map should say.
- **The hub.** `src/api/assistant/attention.js:328–336` runs `checkSelfMap` beside the other checks. A throw becomes
  `SELF_MAP_CHECK_FAILED` (`selfMap.js:46–49`).
- **The page.** `ui/src/pages/assistant/AssistantTreasureMap.jsx` is read-only, with its words in
  `assistantTreasureMapCopy.js`. The Duty Menu page (`DutyMenu.jsx:97–118`) shows the press, report and refresh pattern.
- **Persistent state.**
  - `/var/lib/brainstorm` is the `tapestry-data` volume (`docker-compose.yml:33`).
  - `settings.json` there is written in place, not atomically (`src/config/settings.js:65–72`; ledger
    `2026-10-12-settings-json-written-in-place`).
  - `user-prefs/<pubkey>.json` takes any field from `PUT /api/user-prefs` (`src/api/settings/userPrefsApi.js:78`).
  - Atomic writers with a temp file and rename exist: `src/api/strfry/negentropyPresets.js:195–200` (with a lock,
    `:204–205`) and `src/pipeline/tagging-edges/state.js:52–72`.
- **Signature checks on reads.** `readRelayEvents` keeps only events of the asked kind and author whose signature
  verifies (`src/api/_shared/relaySource.js:273–288`). strfry verifies on import.
- **Cross-origin posture.** `cors({ origin: true, credentials: true })` (`bin/control-panel.js:117–122`), and the
  session cookie sets no `SameSite` (`:237–240`). Every session-bound POST shares this posture (OPEN.md row 326). This
  ADR neither widens nor narrows it.

**Constraints.**
- **CLAUDE.md principle 4.** The TA's kind 10040 is also this instance's own Treasure Map, so nothing regenerates it
  blind, and the choice is locally authored state (BIBLE §30: "treat any state a rebuild cannot reproduce as precious").
- **Shared line.** `selfMap.js` is shared with `assistant-duties-settings`, which landed its edit, and this ADR edits
  other functions in it.
- **§ 9.2, When it changes.** Each version's `created_at` MUST be later than the one it replaces. Two presses in the
  same second must therefore never both publish from the same base.
- **Story 1's sentinels.** `selfMap.js` and the library must not sign or write files (`test/assistant-self-map-check.test.js`
  S1). Signing and writing go in new modules.

## Options considered

### Where the choice lives

- **C1, its own file on the data volume (chosen).**
  - The file is `assistant-self-map.json`, keyed by Assistant pubkey, written atomically under a lock by one small
    module. Only the press writes it.
  - **For:** atomic; it survives restarts, upgrades, firmware reinstalls, strfry rebuilds and imports, none of which
    touch the volume; only this module can write it; story 3 can list the Assistants that are on.
  - **Against:** one more file on the volume, documented in BIBLE §15.
- **C2, `settings.json`** (`selfMap.on.<pubkey>`), as `assistant-duties-settings` stored the duties list.
  - **For:** the existing two-layer reader.
  - **Against:**
    - every customer's press would rewrite the whole override file in place (the open ledger row), risking every
      setting on a crash;
    - the Owner-gated `PUT /api/settings` could flip a customer's choice, which the story rules out;
    - the duties list is instance configuration, while this choice is per-Assistant.
- **C3, a property on the Assistant's `NostrUser` node in Neo4j**, "the definitive me".
  - **For:** principle 4's literal seat.
  - **Against:**
    - the hub's check would gain a Neo4j dependency;
    - `NostrUser` nodes are written by imports and resets that §30 lists as unaudited;
    - this is an instance operating choice, not graph knowledge.
- **C4, `user-prefs/<viewer>.json`.** Rejected: `PUT /api/user-prefs` merges any field, so the choice could change
  without a press (AC-1).

### What the press reads before it merges

- **R1, every place, with a strict finish (chosen).** The press reads this instance's relay and the outside round
  together, as `lookupSelfMap` asks them, and the newest version wins.
  - **When it is finished:**
    - the local scan succeeded;
    - and, when this instance's relay holds no version, at least one outside relay answered, or there was none to
      ask.
  - **For:** a strfry wipe, or a restore from an older backup, can't make the press build over an older version or over
    nothing, and so drop this instance's own Map entries.
  - **Against:** a press waits up to the relay budget (`RELAY_BUDGET_MS`, 8 s) for the outside round.
- **R2, story 1's local-first read, as the Duty Menu publish does.** It's faster, and every version this instance
  signs goes to its relay first.
  - **Against:** if local strfry was wiped and no outside relay answered, the press would build from nothing. A Duty
    Menu holds nothing else; a kind 10040 holds this instance's own Map.

### The route

- **P1, one route,** `POST /api/assistant/self-map` with the body `{ "on": true | false }`, strictly a boolean
  (chosen). One route-table entry, one handler. Turn on and Update now are the same action, `on`. Anything else in the
  body is a 400, and nothing changes.
- **P2, two routes with no body,** `…/self-map/on` and `…/self-map/off`, as the Duty Menu route reads none.
  - **For:** nothing in the request is read at all.
  - **Against:** two entries and two registrations for one bit. Neither shape changes the cross-origin posture above.

### Sharing the publish code

- **S1, a new module in the Duty Menu route's shape** (chosen). It reuses that route's primitives (`profilePublish`'s
  `summarizePublish`, `localFailureMessage` and `publishToRelays`; `relayHostGuard`; `outsideOnly`;
  `assistantWriteRelays`), and the Duty Menu route is untouched.
- **S2, extract one fan-out helper** shared by both routes. It removes about 40 duplicated lines, but it reopens
  shipped code under its own sentinels (`assistant-duty-menu-publish` S2). It's left as a follow-up (§ Consequences).

## Decision

**C1, R1, P1, S1.**
- **C1,** because the choice must survive everything and change only by a press.
- **R1,** because the press signs over this instance's own Map: a slower press is cheap, and a lost entry is not.
- **P1,** because it's one bit and one entry.
- **S1,** to keep shipped code still.

### Sub-decisions

1. **The choice store**, `src/api/assistant/selfMapChoice.js` (new; plain `fs`; no request access).
   - **Path.** `SELF_MAP_CHOICE_PATH = process.env.TAPESTRY_SELF_MAP_CHOICE_PATH || path.join(process.env.BRAINSTORM_BASE_DIR
     || '/var/lib/brainstorm', 'assistant-self-map.json')`, the same base as `settings.js:16–17`.
   - **Shape:** `{ "version": 1, "assistants": { "<assistant hex>": { "on": true, "changedAt": <unix seconds> } } }`.
   - **`readSelfMapChoice(assistantPubkey)`** answers `true`, `false` or `null`:
     - a missing file, or no entry for the Assistant, is `false` (AC-1: off until turned on);
     - an entry is `on === true`;
     - a file that exists but can't be read or parsed, or isn't the shape above, is `null` (unknown), logged once per
       call.
   - **`writeSelfMapChoice(assistantPubkey, on, nowSeconds)`**, under a module-level promise lock (as `withPresetsLock`,
     `negentropyPresets.js:204–205`):
     - it reads the file;
     - it **throws** when the file exists and is unreadable or the wrong shape, and never overwrites it;
     - otherwise it sets the entry `{ on, changedAt }` and writes atomically: a temp file, fsync, rename, then a directory
       fsync, after `tagging-edges/state.js` `writeAtomic` (`:52–72`).
     - Pubkeys are 64-hex, lower-cased; anything else throws.
   - **Nothing else writes it.** No route reads its contents back to a client except as this Assistant's `selfMapOn`.

2. **The check carries the choice** (AC-1). In `selfMap.js`:
   - **A new dep**, `readSelfMapChoice: (pk) => require('./selfMapChoice').readSelfMapChoice(pk)`. `checkSelfMap`
     calls it first, in a try, where a throw is `null`, and adds `selfMapOn` to whatever it returns, finished or
     unfinished.
   - **`SELF_MAP_CHECK_FAILED`** gains `selfMapOn: null`.
   - **Nothing else changes.** `done`, `pending` and `current` are unchanged (story AC-5: story 1's marking rules
     stand).

3. **Gathering, factored for the press.** `checkSelfMap`'s body, up to `evaluateSelfMap`, becomes an exported
   `gatherSelfMap({ viewer, assistantPubkey, forWrite }, deps)`, which answers `{ answer, lookup }`.
   - **`answer`** is what `checkSelfMap` answers today, without `selfMapOn`.
   - **`lookup`** is `lookupSelfMap`'s result, with `latest`. `checkSelfMap` is `gatherSelfMap` with `forWrite: false`,
     plus the choice.
   - **`lookupSelfMap({ …, forWrite })`** reads per R1 when `forWrite` is true:
     - **The scans.** The local scan and the outside round both run. The outside round is the same set as today: the
       viewer's Map hints, the Assistant's write relays, each guarded, and the offer's relays.
     - **The newest.** `newest` is taken over local ∪ answered.
     - **Unfinished**, with no version read:
       - `instance-unanswered` when the local scan failed;
       - `no-relay-answered` when local held none, the outside set was not empty, and no relay in it answered.
     - With `forWrite` false, the behaviour is byte-for-byte today's.
   - **`mapHints` reads only entries whose key parses** (`parseKey(t[0])` non-null). That is R3-N2: § 4.5 has readers
     treat such entries as absent.

4. **The merge, pure, in `src/lib/self-map/index.js`.** It has no I/O and doesn't sign. Three exports:
   - **`ownsTag(tag, author)`** is true when all of these hold. They are § 9's self-entries, including the ones readers
     ignore (story AC-4):
     - `tag` is an array;
     - `tag[0]` is a string whose kind slot, the text before its first colon, matches `KIND_SLOT`;
     - `tag[1]` is a string whose lower-case form equals `author`.

     That covers the `NAMELESS_KEYS` spellings and every unchecked key. A tag whose element 1 isn't a key, such as `p`,
     `d` or `expiration`, is never owned, whatever its element 2.
   - **`keptTags(event, author, { dropExpiration })`** is every tag of `event` that `ownsTag` rejects, in order, as the
     same arrays. With `dropExpiration`, any tag whose element 1 is `expiration` is left out.
   - **`buildSelfMapEvent({ latest, author, selfEntries, nowSeconds })`** answers `{ kind: 10040, created_at, tags,
     content }`:
     - `created_at` is `latest ? max(nowSeconds, latest.created_at + 1) : nowSeconds`;
     - `content` is `latest.content` when it is a string, else `''`;
     - `tags` are `keptTags(latest, author, { dropExpiration: selfEntries.length > 0 })`, with the new self-entries
       `[key, author, relay]` spliced in as one block, in `selfEntries`' order. The block goes where the found version's
       first owned tag stood, counted among the kept tags. When there was none, it goes after the last kept tag.
   - **When nothing is left.** With no `latest` and no `selfEntries`, it answers an empty event. The press never signs
     that (sub-decision 6 publishes nothing when nothing changes).

5. **The route**, `POST /api/assistant/self-map`, in `src/api/assistant/selfMapPublish.js` (new). It follows
   `dutyMenuPublish.js`'s seams, with every side effect behind `defaultDeps()`.
   - **`createSelfMapHandler(deps)`** handles a request, in this order:
     - the viewer, from the session, as `dutyMenuPublish.js:188–191`. Without one: 401 `not-signed-in`;
     - the body must be an object whose `on` is a boolean. Otherwise: 400 `bad-request`;
     - `setSelfMapFor({ viewer, on })`, then the answer.
   - **The answers:**

     | Case | Status | Body |
     |---|---|---|
     | Not signed in | 401 | `{ success: false, code: 'not-signed-in', error }` |
     | Bad body | 400 | `{ success: false, code: 'bad-request', error }` |
     | No Assistant here | 403 | `{ success: false, code: 'no-assistant', error }`, before any key is read past `getAssistantKeys` |
     | A read didn't finish (AC-4) | 503 | `{ success: false, code: 'not-read', error }`; the choice is unchanged |
     | Accepted | 200 | `{ success: true, result }` (sub-decision 6) |
     | A throw | 500 | `{ success: false, error }`, logged |

     The words are story § Copy's. A throw says "This instance did not answer; nothing was published." The 401 says
     "Sign in to change your Assistant's self-Map."
   - **Registration.** `src/api/index.js`, beside the Duty Menu publish (`:613`).
   - **Route table.** `'POST /api/assistant/self-map': allow('signed-in', "Your Assistant turns its own self-Map on or
     off and signs it from this instance's own check; bound to your session.")`.

6. **The press**, `applySelfMap({ viewer, assistantPubkey, privkeyBytes, on }, d)`, run inside
   `withAssistantLock(assistantPubkey, …)`. That is a module-level `Map` of promise chains, one per Assistant, exported
   so that story 3's automation serializes behind the same lock. `setSelfMapFor` resolves the key, as
   `dutyMenuPublish.js:102–105` does, then calls `applySelfMap`.
   1. **Read** (AC-4).
      - **`on`:** `gatherSelfMap({ forWrite: true })`. If `answer.finished` isn't true, or `lookup.finished` isn't
        true, it answers `not-read`.
      - **`off`:** the viewer's Map is tried for hints only, and an unfinished Map read means no hints. Then
        `lookupSelfMap({ forWrite: true })`. If that is unfinished, it answers `not-read`.
      - **The base.** `latest` must be the Assistant's own kind 10040 and pass `verifyEvent`. Otherwise it answers
        `not-read`. This is defence in depth: relay reads and strfry already verify, and only this instance holds the key.
   2. **Remember** the choice, with `writeSelfMapChoice(assistantPubkey, on, now)`. A throw is a 500, and nothing is
      published. The choice is recorded before any publish, so an accepted press holds even if a relay refuses (AC-1).
   3. **Target.** `on` gives `answer.shouldSay`; `off` gives `[]`. The found self-entries are
      `readSelfEntries(latest, A).selfEntries`, or `[]` without a `latest`.
   4. **Nothing to change.** When `sameSelfEntries(target, found)` holds, it answers `{ ok: true, on, published: false,
      unchanged, message, relays: { total: 0, success: 0, results: [] } }`. `unchanged` is one of:
      - `nothing-to-claim`, when `on` and the target is empty;
      - `already-current`, when `on` and the target isn't empty;
      - `nothing-claimed`, when `off`.

      `message` is § Copy's line for it.
   5. **Build and sign.** `buildSelfMapEvent`, then `finalizeEvent`.
   6. **The preservation check**, before anything is written. All of these must hold, or it throws and nothing is
      written:
      - `signed.pubkey` is A and `signed.kind` is 10040;
      - `sameSelfEntries(readSelfEntries(signed, A).selfEntries, target)`, and `signed`'s owned tags number exactly
        `target.length`;
      - `keptTags(signed, A)` equals `keptTags(latest, A, { dropExpiration: target.length > 0 })`, element by element;
      - `signed.content` equals the base's content.
   7. **This instance's relay first.** `importEvent(signed)`. If it fails, it answers `{ ok: false, stage: 'local',
      outcome: 'not-delivered', on, published: false, message: localFailureMessage(SUBJECT, reason), … }`, and nothing
      goes outward.
   8. **Fan out** (AC-6), as `dutyMenuPublish.js:141–171`:
      - `configured` is `outsideOnly` of the new self-entries' relays. They come from the offer, which the owner sets
        through Relay Settings or Assistant Duties, and are sent as such;
      - `named` is `outsideOnly` of `assistantWriteRelays` followed by the found version's self-entry relays (non-empty
        and normalizable). Those already configured are left out, the list is capped at `MAX_RELAYS`, and each relay is
        DNS-guarded within one `LOOKUP_BUDGET_MS`;
      - in local-only mode every row is `skipped`;
      - no Nous relays (§ 9.2 names none).
   9. **Answer.** `{ ok: true, on, published: true, outcome, message, localOnly, selfEntries: target.length, relays }`.
      - The summary is `summarizePublish({ subject: "Your Assistant's self-Map", … })`.
      - With no relay at all, the summary is § Copy's "There was no other relay to send it to." sentence, as
        `dutyMenuPublish.js:175` does.

7. **The page** (AC-2).
   - **The client**, `ui/src/utils/setAssistantSelfMap.js` (new):
     - `setAssistantSelfMap(on)` posts `{ on }` as JSON to `/api/assistant/self-map`, and answers `{ status, …data }`;
     - it throws when the answer isn't JSON, as `publishAssistantDutyMenu.js`;
     - it is the page's only network call.
   - **`assistantTreasureMapCopy.js` gains:**
     - § Copy's buttons, state lines, Owner note and "now claims no duties" line;
     - `selfMapStateLine(answer)`. For `selfMapOn` `true`: the on line. For `false`: the off line, or the "still claims
       duties" line when the check finished and found self-entries. Otherwise none;
     - `selfMapButtons(answer)`, which answers `{ turnOn, update: { shown, enabled }, turnOff }`:
       - **Off, or unknown (`null`):** `turnOn` is shown. `turnOff` is shown only when the check finished and found
         self-entries.
       - **On:** `update.shown`, enabled when `answer.current !== true`, and `turnOff`.
       - **No answer yet:** nothing is shown.
   - **`AssistantTreasureMap.jsx`**, in the published panel, under the entries:
     - the state line;
     - the Owner note, when `answer.instanceMap === true`;
     - the buttons, each disabled while any press is under way, the pressed one reading **Publishing…**;
     - the report, drawn as `DutyMenu.jsx`'s `Report`. `result.published === false` shows `result.message` alone, in
       the info tone. A Turn off that published adds the "now claims no duties" line.
   - **The status line** shows only when `answer.selfMapOn !== false`. While off, the state line replaces it (§ Copy).
   - **The refresh.** `attention.refresh()` runs after every `success: true` answer, because the choice may have
     changed even when nothing was published. A refusal changes nothing, so it does not refresh.

8. **Records.**
   - **`src/api/openapi.yaml`:**
     - the new path, with its body, the six answers and the result's fields;
     - the `/api/assistant/attention` block's `treasure-map` part names `selfMapOn`.
   - **BIBLE §11:**
     - a POST row for `/api/assistant/self-map`, in the Duty Menu row's style (`BIBLE.md:530`): what is signed, what
       is kept, the strict read, the relays and the lock;
     - the attention row's treasure-map part names `selfMapOn`.
   - **BIBLE §15:** one line naming `assistant-self-map.json` on the volume, its shape, that it is locally authored
     (§30), and that it is written only by the press.
   - **ADR 0001:** a one-line note under its Status: "Extended by ADR 0002 (story 2): the press, the choice, the
     `forWrite` read."

## Story deviations this ADR asks the owner to approve

- **An unreadable choice file.** It shows no state line, and a press then answers "This instance did not answer;
  nothing was published." The story doesn't cover this state. It arises only after a hand edit, because the store
  writes atomically.
- **The words are unchanged.** Every sentence the server and the page show is § Copy's.

## Consequences

- **What this enables.**
  - The owner can turn a self-Map on and off on staging and read it back from the relays.
  - Story 3 calls `applySelfMap` behind `withAssistantLock`, and lists the Assistants that are on from the choice
    file.
- **A slower press.** A press waits for the outside round, up to 8 s, plus the fan-out. The hub's check is unchanged,
  and still local-first.
- **What the merge never does:**
  - it never builds from a version it couldn't read, or from one this Assistant didn't sign;
  - it never keeps an `expiration` beside a self-entry;
  - it never reorders or rewrites another tag;
  - it never touches `content`.
- **"Every earlier version's relays"** (§ 9.2, a SHOULD) is met inductively. Each version goes to the found version's
  self-entry relays, so a removal reaches every relay that held the claim, as long as each earlier press reached its
  own. A relay that missed a removal keeps the older claim until a later version reaches it. Recording every relay ever
  named is left to story 3, if it wants it.
- **Duplication.** About 40 lines of fan-out mirror `dutyMenuPublish.js` (S2 above). **Follow-up:** a ledger row at
  Implementation, to extract one helper once both routes are stable.
- **Cross-origin posture** is the existing one for session-bound POSTs (OPEN.md row 326). The route neither widens nor
  narrows it.
- **Tests to re-aim (Phase 3, the Tester's lane).**
  - `test/assistant-self-map-page.test.js`:
    - D4 ("read-only, no button") becomes the new contract: one client helper, refresh after an accepted press, the
      three buttons;
    - P2 (the status line while off).
  - `test/assistant-self-map-check.test.js`:
    - S6 ("no self-Map route") pins the new entry instead;
    - S1 keeps `selfMap.js` and the library free of signing and file writes. That still holds: the writes and the
      signing live in the two new modules.
  - `test/assistant-taggings-publish.test.js` S2: `selfMapPublish.js` takes `privkeyBytesOf` from
    `identificationTaggings`, as `dutyMenuPublish.js` does, so it joins the allowed list.
  - `test/admin-action-sweep.test.js`: the route-table entry.
  - Any suite that deep-equals `SELF_MAP_CHECK_FAILED`, or the `treasure-map` answer, gains `selfMapOn`.
  - **New sentinels:** only `selfMapPublish.js` signs a kind 10040 with an Assistant's key; nothing calls it at Assistant
    creation or on a timer; the choice file is written only by `selfMapChoice.js`.
- **Firmware reinstall required?** No. No concept changes.

## Implementation notes

1. **`src/lib/self-map/index.js`.** Add `ownsTag`, `keptTags` and `buildSelfMapEvent` (sub-decision 4), and export
   them. `KIND_SLOT` is already there (`:27`). Update the header so it says story 2's writer lives here too.
2. **`src/api/assistant/selfMap.js`:**
   - `gatherSelfMap`, `lookupSelfMap`'s `forWrite`, `mapHints`' filter and `readSelfMapChoice` in `checkSelfMap`
     (sub-decisions 2 and 3);
   - `SELF_MAP_CHECK_FAILED` gains `selfMapOn: null`;
   - export `gatherSelfMap`;
   - leave `readUpkeep` alone (shared line);
   - update the header's "Read-only" line: the module still only reads, and the press lives in `selfMapPublish.js`.
3. **`src/api/assistant/selfMapChoice.js`** (new). Sub-decision 1. Export `readSelfMapChoice`,
   `writeSelfMapChoice` and `SELF_MAP_CHOICE_PATH`.
4. **`src/api/assistant/selfMapPublish.js`** (new). Sub-decisions 5 and 6.
   - Export `createSelfMapHandler`, `handleSelfMap`, `setSelfMapFor`, `applySelfMap`, `withAssistantLock`,
     `SELF_MAP_SUBJECT`, `CODES` and `WORDS`.
   - Load `nostr-tools` lazily, as `dutyMenuPublish.js:57–64`, for `getPublicKey`, `finalizeEvent` and `verifyEvent`.
   - The `defaultDeps` add `gatherSelfMap`, `lookupSelfMap`, `lookupViewerMap` (`status.lookupNewest` over
     `treasureMapRelays`), `writeSelfMapChoice` and `verifyEvent` to the Duty Menu's.
   - No 64-hex literal; no timer.
5. **`src/api/index.js`.** Register the route beside `:613`, with a one-line comment naming this story and ADR.
6. **`src/middleware/routeAccess.js`.** The entry in sub-decision 5, after `'POST /api/assistant/duty-menu/publish'`.
7. **UI.** `ui/src/utils/setAssistantSelfMap.js`, `assistantTreasureMapCopy.js` and `AssistantTreasureMap.jsx`
   (sub-decision 7). Update the page's header comment: it now has buttons and one network call.
8. **Records.** Sub-decision 8.
9. **Ledger.** Add a row for the fan-out duplication (§ Consequences).
10. **Tests** read the deployments' real values, as story 1's did (ledger
    `2026-10-12-test-configs-not-from-deployments`): the relay URLs staging serves, local-only mode both on and off, and
    the choice file both absent and present. Point the store at a temp path through `TAPESTRY_SELF_MAP_CHOICE_PATH`,
    or inject the deps.
11. **Where it ships.** Only `feat/assistant-self-map` → `staging`, by a PR after Review. Production goes with story 3
    (book § Path). No sandbox branch carries this code.

## Out of scope

- Keeping it true by itself, the stop points, and where a List retraction goes (story 3).
- Readers, counters and badges (stories 4 and 5).
- Extracting a shared fan-out helper (§ Consequences).
- A history of every relay a self-entry ever named.
- Any change to `readUpkeep`, the offer, the Duty Menu route, or `protocols/`.

## Amendment 1: fixes from review round 1 (2026-10-13)

**Status of A1:** approved by the owner at the Architecture gate of round 2, 2026-10-13, as written ("Ready for test
design"). The owner chose at the review gate to fold in all five non-blocking notes, Turn off while the check did not
finish included (items 2–6).

The review is `engineering-team/reviews/assistant-self-map/2-turning-the-self-map-on-and-off.md`. Item 1 is its
Blocking 1, and items 2–6 are its non-blocking 1–5.

### 1. The strict read: a failed discovery is never "nobody to ask" (Blocking 1)

**What was wrong.** Sub-decision 3 finished a `forWrite` read when this instance held no version and "there was none
to ask". But the outside set it asked was shrunk silently, in three ways:
- the Assistant's relay-list lookup, when it did not finish, became `[]` (`assistantWriteRelays`, `dutyMenu.js:119–125`,
  and `attempt(…, [])` in `selfMap.js`);
- a relay the DNS guard refused was dropped. `isPublicRelayHostWithin` never rejects, and a resolver error, a timeout
  and a private address all come back as `false` (`src/utils/relayHostGuard.js:24–61`);
- `outsideOnly` removes this instance's own relays.

So after a strfry wipe, with the publish relays or the resolver down, the read finished with no version, and Turn on
built over nothing. § Consequences' line that "a strfry wipe … can't make the press build over an older version or
over nothing" was false as written.

**The rule now.** With `forWrite`, when this instance's relay holds no version of the Assistant's kind 10040, the read
finishes only when all of these hold:
1. **The Assistant's relay-list lookup finished.** That means `lookupNewestReplaceable` answered `finished: true`, or
   `no-outside-relays` (there was nowhere to look, which is a real answer).
   - Any other unfinished reason is `no-relay-answered`: `local-unreadable`, or `outside-unreachable`.
   - So is a throw anywhere in this discovery. In the `forWrite` path, no `attempt(…, [])` fallback stands in for an
     answer.
2. **When the Assistant has outside write relays (W), at least one of them answered.** W is counted before the DNS
   guard: a write relay the guard refuses, for whatever reason, has not answered.
   - The write relays are where every version goes (sub-decision 6 step 8). So an answer from a hint or an owner-set
     offer relay does not stand in for them.
3. **When W is empty, the other outside relays (O) are empty, or at least one of them answered.** O is the hints
   (counted before the guard) and the offer's outside relays.

Otherwise the read is unfinished with `no-relay-answered`, and the press answers 503 `not-read` as before. When this
instance's relay holds a version, nothing changes: outside answers stay best-effort and the newest wins.

**The cost, accepted.** If a wipe left the Assistant with write relays that are all private, or that the resolver
can't reach, the press refuses until one answers. Refusing is the safe side of principle 4.

**The code.**
- **`src/api/assistant/dutyMenu.js` gains `assistantWriteRelayLookup({ assistantPubkey }, deps)`.** It answers
  `{ finished, relays }`, where `finished` is the lookup's `finished`, or true for `no-outside-relays`. `relays` is the
  write relays when finished, else `[]`.
- **`assistantWriteRelays` becomes `(await assistantWriteRelayLookup(…)).relays`.** Its answer is unchanged in every
  case, so the Duty Menu check and publish are unaffected.
- **`lookupSelfMap`'s `forWrite` path** calls the lookup directly with no fallback, keeps W and O apart, counts a
  guarded-out relay as not answered, and applies the rule above. The non-`forWrite` path is byte-for-byte as before.

### 2. "Nothing to change" also means nothing stale is left (non-blocking 1)

Sub-decision 6 step 4 changes as follows. When the target is **not empty**, the press publishes nothing only when all
of these hold:
- the self-entries found are the target, as before;
- the version found carries no `expiration` tag (§ 9.2, No expiration);
- the version's owned tags (`ownsTag`) number exactly the self-entries found. So it holds no duplicate self-entry,
  and no owned spelling that readers ignore, such as `39998:`.

Otherwise it publishes, and the merge drops the expiration and the stray owned tags.

When the target is **empty** (Turn off, or nothing to claim), the rule is unchanged: nothing is published when no
self-entry is found. An owned tag that readers ignore claims nothing, so it isn't worth a version of its own.

### 3. A 500 after the choice is remembered (non-blocking 2)

- **`isLocalOnly()` is read before the choice is written** (sub-decision 6, between steps 1 and 2). Nothing that can
  throw for configuration reasons runs after the write.
- **The page asks for the answer again after every press except a refusal.** A refusal is an answer with a refusal
  code: 400, 401, 403 or 503 `not-read`, none of which changes anything. So a 500, and a request that never answered,
  refresh the page, since the choice may have changed.
- **openapi's 500 entry** says that the choice may have been remembered.

### 4. Turn off shows whenever the self-Map found is unknown (non-blocking 3; owner, at the review gate)

Sub-decision 7's `selfMapButtons` changes for **off or unknown** (`selfMapOn !== true`):
- Turn on shows, as before.
- Turn off shows when a finished check found self-entries, **or when the check did not finish**. That includes a check
  that threw (`SELF_MAP_CHECK_FAILED`): the self-Map found is then unknown, and the Turn off press needs only the kind
  10040 (sub-decision 6 step 1). So no claim can be stuck behind a check that never finishes.

**On, and no answer yet,** are unchanged. **The state line is unchanged:** for an unfinished check while off it says
"Your Assistant's self-Map is off."

*This widens story 2 AC-2's "Turn off while off" rule. See § Story deviations (A1).*

### 5. The Owner's note reads the session (non-blocking 4)

The page shows the Owner's note when the signed-in viewer is the Owner (`user.classification === 'owner'`, from
`useAuth`), beside the buttons. It no longer reads `answer.instanceMap`, which a check that threw sets false. The
Owner's other line, "also this instance's own Treasure Map", still reads `instanceMap` and `published`, as story 1 has
it.

### 6. A dead seam goes (non-blocking 5)

`getConfiguredPublishRelays` leaves `selfMapPublish.js`'s `defaultDeps`: nothing in the module calls it.

### Story deviations (A1)

- **AC-2, "Turn off while off".** It also shows while off whenever the check did not finish (item 4). The owner chose
  this at the review gate, 2026-10-13. No words change.

### Tests (the Tester's lane, Phase 3)

- **New R-tests** (`test/assistant-self-map-publish.test.js`). Each is "nothing on this instance's relay" and gives 503
  `not-read` with nothing changed:
  - the relay-list lookup's relays don't answer;
  - the only write relay is refused by the DNS guard;
  - the write relays are silent while an owner-set typed offer relay answers empty.
- **One positive case:** no relay-list relays configured (`no-outside-relays`), no hints, and only this instance's
  relay on the offer. That read is finished, and the press builds from nothing.
- **New E-tests:**
  - "already current" with an `expiration` publishes, and the expiration goes;
  - "already current" with a stray `39998:` owned tag publishes, and the stray tag goes;
  - off with only a stray owned tag publishes nothing.
- **C-tests:**
  - `isLocalOnly()` throwing gives a 500 with no choice written;
  - a throw after the choice was written gives a 500.
- **V-tests** (`test/assistant-self-map-check.test.js`): `forWrite`'s discovery rule, items 1–3, directly on
  `lookupSelfMap`; and the non-`forWrite` path unchanged.
- **Re-aims and additions:**
  - Q3's cases: off or unknown with an unfinished check shows Turn off;
  - a browser spec: a 500 refreshes the answer;
  - a browser spec: the Owner's note after a check that threw;
  - the Duty Menu suite's `assistantWriteRelays` tests keep passing unchanged, as the refactor's guard.

### Consequences (A1)

- The strict read now refuses in the cases it used to finish wrongly. A press after a strfry wipe needs the
  Assistant's relay-list lookup to finish and one of its write relays to answer. *(Corrected by Amendment 2 item 3.)*
- `assistantWriteRelays`' callers see no change.
- **Firmware reinstall required?** No.

## Amendment 2: a relay list found nowhere needs every relay's answer (2026-10-13)

**Status of A2:** approved by the owner at the Architecture gate of round 3, 2026-10-13, as written ("Ready for
test design"), with R2-N3 and R2-N4 left out as item 6 proposes, each on its ledger row.

The review is `engineering-team/reviews/assistant-self-map/2-turning-the-self-map-on-and-off.md`, its Round 2. Item 1
is its R2-B1. Items 4 and 5 carry R2-N2 and R2-N1. Item 6 proposes where R2-N3 and R2-N4 go.

### 1. The relay list is "nowhere" only when every relay said so (R2-B1)

**What was wrong.** Amendment 1 item 1.1 counted the Assistant's relay-list lookup as finished whenever
`lookupNewestReplaceable` answered `finished: true`. That function answers `{ finished: true, event: null }` as soon as
*one* outside relay answers without the list (`src/api/assistant/attention.js:223–225`). That is right for a best-effort
read. For a press it is not: one configured publish relay that doesn't hold the list reads as "the Assistant has no
write relays". It could have been added after the list was published, dropped or refused it, or accept no such events.
W is then empty, rule 1.3 applies, and a wipe with the hints and the offer on this instance's own relay finishes with
no version. The write relays that hold the real one are never asked.

**The rule now.** With `forWrite` and no version on this instance's relay, item 1.1 reads:
1. **The Assistant's relay-list lookup finished.** That means one of:
   - the list was found, here or on an outside relay that answered. The newest found wins, as before.
   - there was no outside relay to look on (`no-outside-relays`).
   - **every** outside configured publish relay answered, and none held the list. This is new.

   Anything else is `no-relay-answered`: the list found nowhere while at least one relay did not answer, as well as
   `local-unreadable`, `outside-unreachable` and a throw.

Items 1.2 and 1.3 are unchanged. A list found on any relay is a positive answer. The case "found nowhere" is the one
that needs every answer, because a relay that didn't answer may be the one that holds it.

**The cost, accepted.** After a wipe, with no relay list anywhere, a press needs every configured outside publish relay
to answer: six public relays with the shipped settings (`src/config/defaults.json`: the general-purpose, profile and
WoT relays). A relay that is down refuses the press until it answers, or until the Owner removes it from the settings.
Refusing is the safe side of principle 4, as in Amendment 1. When the list is found, which is the usual case once the
Outbox Relays page has published it, nothing more is needed.

**The code.**
- **`lookupNewestReplaceable` (`attention.js:206`) takes an optional `everyRelay`, false by default.** With it, when no
  answering relay held the event and fewer relays answered than were asked, it answers
  `{ finished: false, reason: 'outside-unreachable' }`, its existing reason. Without it, every answer is as before.
  Its four other callers pass nothing and are unchanged: the outbox check, `assistantWriteRelays`, Nous' relay list
  and the relay-list publish.

  ```js
  if (found.length > 0) return { finished: true, event: newest(found), source: 'relay' };
  if (everyRelay && answered.length < relays.length) return { finished: false, reason: 'outside-unreachable' };
  return { finished: true, event: null, source: null };
  ```
- **`assistantWriteRelayLookup` (`dutyMenu.js:121`) takes the same optional `everyRelay` and passes it through.**
  `assistantWriteRelays` calls it without the flag, so the Duty Menu check and publish see no change.
- **`strictOutsideRound` (`selfMap.js:287`) calls the lookup with `everyRelay: true`.** With a version here, the lookup
  stays best-effort in effect: when it doesn't finish, W is not read, as before.

**Not chosen.**
- **Adding the configured publish relays to O.** The relay that answered without the list would answer the 10040 read
  empty too, and the read would finish. That doesn't close the case.
- **Answer counts on every `lookupNewestReplaceable` answer.** It changes the answer's shape for every caller and every
  suite that compares it.
- **A copy of the lookup in `selfMap.js`.** It would put the newest-replaceable rule in two places. The opt-in flag
  keeps it in one, and leaves its default path byte-for-byte.

### 2. A settings failure is not "nothing configured", so no new reader

Review round 2 asked whether the strict path must tell a relay-settings failure apart from "nothing configured".
- **It doesn't need to, because a settings read never throws.** `getSettings()` (`src/config/settings.js:76`) merges
  two layers that each catch their own read error and return `{}`:
  - `loadDefaults`;
  - `loadOverrides`, where a missing file also gives `{}`.

  So an unreadable or missing override file reads as the shipped defaults, whose publish relays are those six. It
  doesn't read as an empty list. `readConfiguredRelays`'s own catch (`profilePublish.js:75–80`) only guards against an
  injected reader.
- **Round 2's defensive branch stays.** `assistantWriteRelayLookup` reports "not finished" when reading the configured
  relays throws (story § Deviations, round 2). It costs nothing. The story's note stands; the branch can only be
  reached with an injected reader.
- **No press leans on the duty read failing too.** The reviewer's worry was that safety came from `resolveOfferInputs`
  throwing on the same failure. On a settings failure it doesn't throw either (`readAssistantDuties` reads the same
  `getSettings()`), and it doesn't need to.

**The limit, stated.** The strict read asks where the settings say to look. If the override file is lost in the same
event as strfry (the data volume restored without it, say), the read asks the shipped defaults. If the Owner had
replaced them, the Assistant's list may be on none of them. Then every default relay answers "nowhere", and a press
builds from nothing, while the real version still sits on relays the lost settings named. No press can find what
nothing on the instance names. A stricter reader that told a corrupt file from a missing one would need a new settings
API shared by every page. That costs more than this double loss is worth, so it is not built.

### 3. The guarantee, corrected

§ Consequences (A1) said: "A press after a strfry wipe needs the Assistant's relay-list lookup to finish and one of its
write relays to answer." With item 1.1 as Amendment 1 had it, that was false as written (review round 2, R2-B1). It now
reads:

> With no version on this instance's relay, a press reads every place a version could be:
> - the Assistant's write relays, as its relay list names them, and at least one of them must answer;
> - or, when no outside configured publish relay holds a relay list and every one of them said so, the hints and the
>   offer's outside relays, which must be empty or answer.
>
> It builds from nothing only when those places hold nothing.

*(Corrected by Amendment 3 item 2.)*

There are two known limits:
- the settings limit in item 2;
- a relay list found on one relay while a newer one, naming other write relays, sits only on relays that did not
  answer. The press then reads the older list's write relays. Each version goes to all the write relays named at
  publish time, so those relays hold the versions published while that list was current. What can be missed is a
  version published after a newer list dropped one of them. A loss would need a wipe, a changed list and a silent
  holder of the newer list all at once.

### 4. The records name Amendment 1 item 2 and this rule (R2-N2)

- **`src/api/openapi.yaml` (the press's description, around line 804).** After "publishes nothing when the self-entries
  found are already the target", it adds: "and, when that target is not empty, no expiration or other owned tag sits
  beside them". Its strict-read sentence adds that a relay list found nowhere counts only when every configured
  publish relay answered.
- **The BIBLE §11 row for `POST /api/assistant/self-map` (`BIBLE.md:531`).** It gets the same two additions in the same
  places.

### 5. Tests (the Tester's lane, Phase 3)

- **New R-test** (`test/assistant-self-map-publish.test.js`). Nothing on this instance's relay and no relay list here.
  One profile publish relay answers without the list and the other is silent, while the write relay holds a version.
  Turn on answers 503 `not-read`, with nothing changed: the choice is unchanged and nothing is written or sent. This is
  R2-B1's reproduction as a test.
- **One positive case:** the same world, with every publish relay answering and none holding the list, and the hints
  and the offer on this instance's own relay. The read finishes, and Turn on builds from nothing, as item 1.1 allows.
- **New V-tests** (`test/assistant-self-map-check.test.js`), directly on `lookupSelfMap` with `forWrite`:
  - the same two cases;
  - `assistantWriteRelayLookup` with `everyRelay`: `{ finished: false }` for a list found nowhere with one relay
    silent. Without the flag, its answer and `assistantWriteRelays`' are unchanged.
- **`lookupNewestReplaceable`'s flag, directly:**
  - with `everyRelay`, nothing held and one of two relays silent gives `outside-unreachable`; every relay answering
    empty gives `{ finished: true, event: null }`; a list on the one that answered is found;
  - without it, the first case is `{ finished: true, event: null }`, as today.

  The outbox and Duty Menu suites keep passing unchanged, as the default path's guard.
- **R2-N1, guard before connect.** In V8 (or a new V-test beside it) and R10, the relay reads include no host the DNS
  guard refused. A read that connects first and checks afterwards must fail them.

### 6. Where R2-N3 and R2-N4 go (left out, as the owner approved)

- **R2-N3:** while on, Update now stays disabled beside a stale expiration, because `current` compares self-entries
  only (`src/lib/self-map/index.js:527`). It is **left out**: `current` is story 1's rule and feeds the hub's done
  mark, and story 3's upkeep reads it too. So the right place is story 3's design. Only a version this press didn't
  build can carry an expiration, and an expired claim reads as not published, which re-enables the press. Ledger row
  `2026-10-13-self-map-current-ignores-expiration` carries it to story 3.
- **R2-N4:** Turn on looks the relay list up again for its send set (`selfMapPublish.js:222`), so a second lookup
  failing leaves W out though the strict read found it. It is **left out**: the send is best-effort, and this predates
  round 2. Carrying W through means a new field from `gatherSelfMap` to the press. Ledger row `2026-10-13-self-map-send-relooks-write-relays`
  carries it, beside the fan-out row `2026-10-12-self-map-press-duplicates-fanout`.

### Story deviations (A2)

None. No acceptance criterion or approved word changes. AC-4's "Never blind" is met in one more case.

### Consequences (A2)

- After a wipe, with no relay list anywhere, a press needs every configured outside publish relay to answer. With the
  list found, nothing changes.
- `lookupNewestReplaceable`, `assistantWriteRelayLookup` and `assistantWriteRelays` answer exactly as before for every
  caller that doesn't pass `everyRelay`.
- `attention.js` is a hub line shared with other books. The change is one optional input, and the Implementer rechecks
  the shared line before editing it (book § Shared lines).
- **Firmware reinstall required?** No.

## Amendment 3: the press keeps a copy of the last version, so it never builds over its own Map (2026-10-13)

**Status of A3:** approved by the owner at the Architecture gate of round 4, 2026-10-13, as written ("Ready for Test
Design"). The owner chose its two decisions before the draft, 2026-10-13:
- **Approach:** "Keep a local copy" (item 1), over "Every relay must answer" and keeping "at least one".
- **First press:** "Stay strict" (item 3).

The review is `engineering-team/reviews/assistant-self-map/2-turning-the-self-map-on-and-off.md`, its Round 3. Item 1
answers R3-B1, item 3 R3-B2, item 4 R3-N1, and item 5 R3-N2 and R3-N3.

### Why the rule changes shape, not strictness

Three review rounds each found one more place where one answer stood in for a silent relay that might hold the
version: the relay list (round 1), its "found nowhere" (round 2), and the write relays and hints (round 3). Each rule
was a guess about where a version might be, read over relays that come and go.

Story 2 is the only code that signs an Assistant's kind 10040 with its key (`selfMapPublish.js`; the NIP-85 scripts
publish a 10040 the person signs in their browser). So every version this instance makes passes through one press,
and a press can keep it. strfry lives on its own volume (`tapestry-strfry`, `/var/lib/strfry`), apart from the data
volume (`tapestry-data`, `/var/lib/brainstorm`, `docker-compose.yml:30–34`). A wipe of one leaves the other.

### 1. A copy of the newest version, on the data volume (R3-B1; the owner's "Keep a local copy")

**What is kept.** For each Assistant, the newest validly signed version of its kind 10040 that a press has seen or
signed. It is the whole signed event, and the copy keeps it as it is.

**Where.** In `/var/lib/brainstorm/assistant-self-map.json`, beside the choices, under one new top-level key:

```json
{ "version": 1,
  "assistants": { "<assistant hex>": { "on": true, "changedAt": 1760313600 } },
  "lastSigned": { "<assistant hex>": { "id": "…", "pubkey": "<assistant hex>", "kind": 10040, "created_at": 1760313600, "tags": [], "content": "…", "sig": "…" } } }
```

- The shape check (`version` 1, `assistants` an object) is unchanged. Today's `writeSelfMapChoice` writes the whole
  store back, so it keeps `lastSigned`.
- One file, one lock (`choiceLock`), one atomic write (temp file, fsync, rename, directory fsync, mode 0600). A
  self-Map's content may hold private entries, encrypted to the author, as strfry holds them.

**`src/api/assistant/selfMapChoice.js` gains two functions:**
- **`readSelfMapCopy(assistantPubkey)`** gives the stored event, or null. Null means none is kept, or the file can't be
  read (logged, as `readSelfMapChoice` does).
- **`writeSelfMapCopy(assistantPubkey, event)`** keeps the newer of the stored copy and `event`: the higher
  `created_at`, a tie to the lower id, as the lookups' `newest` rules. An older event changes nothing. It rejects:
  - a key that is not an Assistant key;
  - an event that isn't that key's kind 10040;
  - a file that is there but not the shape, which it leaves as it is;
  - a failed write.

**What the press does with it.** In `selfMapPublish.js`, inside the Assistant's lock:
1. **Read it with the rest (step 1).** The press reads the copy and checks it: kind 10040, author A, and `verifyEvent`
   true. A copy that fails is left out and logged, never used.
   - It passes the copy to the strict read as `stored`: `gatherSelfMap({ …, forWrite: true, stored })` for Turn on, and
     `lookupSelfMap({ …, forWrite: true, stored })` for Turn off.
   - In `lookupSelfMap`'s `forWrite` path, the version here is the newest of this instance's relay and `stored`:
     `here = newest([localNewest, stored])`. Everything after that is as Amendment 1 has it: with a version here, the
     outside round is best-effort, and the newest across all of them wins.
2. **Keep what was found, before the choice.** After the base passes its check, if it is newer than the copy, or there
   is no copy, it becomes the copy. This is a new step between steps 1 and 2. A failure answers 500 and changes
   nothing, since the choice comes after.
3. **Keep what is signed, before it is stored.** After the signed event passes its check (step 4), it becomes the copy,
   before the local import (step 5). A failure answers 500. Nothing has been stored or sent, though the choice may have
   been remembered, as openapi's 500 says.

   *(Corrected by Amendment 4 item 1: step 3 must not trust such a copy.)* The copy then may hold a version that a
   failed import never stored anywhere. That is harmless: the merge changes
   only self-entries, so it carries the same other tags and content as its base. Its `created_at` is later, and a
   later press dates its version after it.

**Why this closes the class.** Once a press has run here, the base of every later press is at least the newest version
any press saw or signed. A strfry wipe, or a restore from an older backup, can no longer make a press build from
nothing, or over an older version, whatever the outside relays answer. The press changes only self-entries. So this
instance's own Treasure Map entries and the content, everything AC-4 keeps, are always in the copy as they last stood
in any version a press here built on.

**What the copy is not.**
- It is not a view and not a cache of anything subjective. It is this instance's own last letter, kept so it survives
  strfry (CLAUDE.md principle 4, BIBLE §30).
- Story 1's check (`checkSelfMap`, the hub's read) doesn't read it. The check says what readers can find.
- Nothing else reads or writes it.

### 2. The guarantee, as it now stands (corrects Amendment 2 item 3)

Amendment 2 item 3's quoted guarantee ("It builds from nothing only when those places hold nothing") was false as
written (review round 3, R3-B1). So were its "cost, accepted" and § Consequences (A2), which scoped the cost to "after a
wipe" (R3-B2), and sub-decision 3's R1 "For:" line about a restore from an older backup. The comment at
`selfMap.js:33` ("So the press never builds over nothing") said the same thing. Each of these now reads as follows.

> **After this instance's first press for an Assistant,** a press never builds on anything older than the newest
> version a press here has seen or signed. That holds through a strfry wipe and through a restore from an older
> backup.
>
> **An Assistant's first press here** (no version on this instance's relay and no copy) reads under the strict rules:
> Amendment 1 items 1.1–1.3, with Amendment 2 item 1.

There are three limits, named:
1. **A first press after a wipe.** The strict rules accept one answering relay for the write relays and the hints. So
   a version signed before this instance's first press, by something other than this press, can be missed:
   - that means the Owner's Map that predates story 2;
   - the miss needs a wipe that also predates that first press;
   - and it needs one answering relay that doesn't hold the version while the one that does is silent.
2. **Versions signed elsewhere, later.** One signed with the Assistant's key outside this instance (the Owner's key in
   another client, say) and newer than the copy is found only as the outside round finds it. With a version here or a
   copy, that round is best-effort.
3. **The data volume lost along with strfry.** The copy and the settings go together, and nothing on the instance
   names where the version is (Amendment 2 item 2's limit).

The code comment at `selfMap.js:33` takes the same two paragraphs in short form.

### 3. A first press stays strict (R3-B2; the owner's "Stay strict")

Amendment 2's cost, stated in full:
- **It reaches every first press here of an Assistant with no published relay list.** Only the Outbox Relays page
  publishes one (`relayListPublish.js:126`). No wipe is needed.
- **Such a press needs every outside configured publish relay to answer.** That is six with the shipped settings. With
  one slow or down, it answers 503 `not-read` in story 2's words, and the person tries again.
- **After a wipe, an Assistant this instance has pressed for builds on its copy,** and needs no outside answer.

The owner accepted this at the draft: first presses keep Amendment 1 items 1.1–1.3 with Amendment 2 item 1, for every
Assistant. No Owner-or-not branch is added.

### 4. A settings read that throws refuses the press, and a test pins it (R3-N1)

Amendment 2 item 2 said a settings read never throws. It does throw for an override file holding the JSON `null`:
`deepMerge` calls `Object.keys(null)` (`src/config/settings.js:77`). Every other bad file reads as the shipped defaults.
On that input:
- `readConfiguredRelays` swallows the throw, so the relay-list lookup reads `no-outside-relays`;
- both presses still refuse before anything is written. `resolveOfferInputs` reads the same settings through
  `readAssistantDuties` and throws, so the press answers 500. That is `gatherSelfMap`'s first read for Turn on, and step
  1's offer read for Turn off.

This amendment makes that refusal the stated behaviour. A test pins it, so a change that broke the coupling would show.
With a copy, the strict read no longer depends on the settings at all for a wipe.

Hardening `loadOverrides` so that a non-object reads as `{}` would change shared settings code, which every page reads.
It is left to its own ledger row, `2026-10-13-settings-null-override-throws`, opened with this amendment.

### 5. The records

- **`src/api/openapi.yaml`, the press's description.** "every configured publish relay" becomes "every outside
  configured publish relay" (R3-N2). It says the press keeps a copy of the newest version on the data volume and builds
  on it after a wipe. Its over-long line is rewrapped (R3-N3).
- **BIBLE §11 row.** The same two changes.
- **BIBLE §15 (the data-volume file, line 1385).** It names `lastSigned`: the newest version a press has seen or
  signed, per Assistant, written only by `POST /api/assistant/self-map`, read only by it.
- **The comments.** `selfMap.js:32`, `:279`–`:280` and `dutyMenu.js:118` say "outside configured" (R3-N2), and
  `selfMap.js:33` says item 2's short form.

### 6. Tests (the Tester's lane, Phase 3)

- **The copy store** (`test/assistant-self-map-publish.test.js`, K-tests):
  - `readSelfMapCopy` and `writeSelfMapCopy` round-trip the event as it is;
  - only a newer event replaces it, by `created_at`, a tie to the lower id;
  - a choice write keeps `lastSigned`, and a copy write keeps the choices;
  - a file that isn't the shape refuses the write and is left as it is;
  - an unreadable file reads as null;
  - a bad key or a wrong event is refused;
  - writes share the choice lock.
- **The press** (R- and E-tests):
  - **After a wipe:** nothing on this instance's relay, the outside relays silent or empty, and a copy holding the full
    version. Turn on builds on the copy, keeping its other tags and content, dated after it. Turn off removes only the
    self-entries.
  - **Review round 3's world** (one write relay answering empty, the one that holds the version silent), with a copy:
    the press builds on the copy, never from nothing.
  - **An older restore:** an older version on this instance's relay, a newer one in the copy. The base is the copy.
  - **A newer version outside** than the copy: the base is the outside one.
  - **A copy that fails its check** (wrong author, bad signature): it is left out. With nothing else here, the first
    press rules apply, so outside silence gives 503.
  - **The copy is kept:**
    - after a publish, the copy is the signed event;
    - after "already current", the found version, when newer;
    - a 503 writes no copy;
    - a failing copy write answers 500, with nothing stored or sent.
  - **First presses unchanged:** R9–R15 pass as they are.
  - **R3-N1:** `readAssistantDuties` throwing, with the configured relays reading `[]` as the real reader does, gives a
    500 with nothing written, for both presses.
- **V-tests** (`test/assistant-self-map-check.test.js`): `lookupSelfMap` with `forWrite` and `stored`. The copy counts
  as a version here, the outside round is best-effort, and the newest across this instance's relay, the copy and the
  outside wins. Without `forWrite`, `stored` is ignored, so the hub's read is unchanged.
- **Records:** S5 or its like checks that openapi names the copy.
- No page or browser change.

### Story deviations (A3)

None to the acceptance criteria or the approved words. The copy is a new durable record on the data volume, kept in
service of AC-4 ("Never blind", "Nothing else is lost"). BIBLE §15 names it.

### Consequences (A3)

- A press after a strfry wipe, or after an older restore, builds on the copy. It needs no outside answer once a press
  has run here. Review round 3's R3-B1 class is closed for every Assistant pressed here before the loss.
- First presses keep the strict rules and their stated cost (item 3). The owner accepted it.
- `assistant-self-map.json` grows by one event per Assistant pressed. That is a few kilobytes each.
- Locally authored state, this instance's own Treasure Map entries and private content, no longer lives only in strfry
  and on outside relays (BIBLE §30).
- **Firmware reinstall required?** No.

## Amendment 4: "nothing to change" only when this instance's relay holds the version (2026-10-13)

**Status of A4:** approved by the owner at the Architecture gate of round 5, 2026-10-13, as written ("Ready for Test
Design").

The review is `engineering-team/reviews/assistant-self-map/2-turning-the-self-map-on-and-off.md`, its Round 4. Item 1
answers R4-B1 and R4-B2. Item 2 answers R4-N1, item 3 R4-N4, and item 4 R4-N5. Item 5 carries R4-N2 into the tests.

### 1. The press publishes nothing only over a version this instance's relay holds (R4-B1, R4-B2)

**What was wrong.** Step 3 ("nothing to change", `selfMapPublish.js:204–213`) compared the target with the base,
wherever the base came from. Amendment 3 made the copy a base (`selfMap.js:262`), and the copy can sit on no relay at
all:
- **After a failed local import (R4-B1).** The copy is the version that import never stored.
- **After a strfry wipe (R4-B2).** The copy is the last version, and this instance's relay holds none.

In both cases every later press answered `already-current`, `nothing-to-claim` or `nothing-claimed`, while this
instance's relay and its readers kept the older version or none.

Round 1's sub-case had the same root, though Amendment 3 didn't add it: an outside relay holds a newer version than
this instance's, already at the target, and nothing is ever stored here. Amendment 3 item 1 step 3's "That is harmless"
(line 779) was false as written. It missed this consequence of step 3.

**The rule now.**
- **The read says where the base is.** With `forWrite`, `lookupSelfMap`'s finished answer carries `onThisRelay`. It is
  true when `latest`'s id is among the Assistant's kind 10040s that this instance's scan returned in the same read;
  otherwise false, and false when there is no `latest`.
- **`published.source` says it honestly:** `'local'` when on this instance's relay, `'copy'` when only the copy holds
  it, `'relay'` otherwise. The same id held both here and in the copy is `'local'`.
- **Step 3 publishes nothing only when this instance's relay holds the base.** That means:
  - `latest` is null, or `onThisRelay` is true;
  - and the conditions before still hold: the self-entries found are the target, and nothing stale sits beside a
    target that isn't empty.

  Otherwise the press goes on as for any change: it builds, signs, checks, keeps the copy, stores the version on this
  instance's relay first, and fans out. Its report is a publish, in the existing words.
- **Both presses follow it.** Turn off over a base that isn't on this relay publishes a version with no self-entries,
  so this instance's relay stops claiming. Turn on with nothing to claim does the same over such a base, and the
  instance's own Map entries and content go back on its relay.

**Why this and not the others.**
- **Moving the signed-copy write after the import** would close only R4-B1. R4-B2 and the outside-newer case would stay
  open, and it would undo Amendment 3's clean 500 when the copy can't be written.
- **Re-storing the base as it is,** importing that event instead of signing a new one, would need a second store path,
  its own fan-out, and its own report words. Signing a new version reuses the one path every publish takes. Its
  `created_at` is later than the base's, as § 9.2 When it changes asks.

**The cost.** A press whose base isn't on this instance's relay always signs and sends a version, even when its
self-entries are already the target. That happens only after a failed import, a wipe, or an outside relay holding the
newest version. In each case it is what makes this instance's relay right again.

**The code.**
- **`src/api/assistant/selfMap.js`.** `lookupSelfMap`'s `forWrite` path keeps the ids of the local scan's events for
  the Assistant. Its finished answer adds `onThisRelay` and sets `published.source` as above. The path without
  `forWrite` is unchanged.
- **`src/api/assistant/selfMapPublish.js`.** Step 3's condition gains `(!latest || lookup.onThisRelay === true)`.
  `gatherSelfMap` already returns the lookup as it is.

### 2. A copy that fails the press's check can be replaced (R4-N1)

`writeSelfMapCopy` compared a newer event against the raw stored entry (`selfMapChoice.js:170`), while the press read
an entry that failed its check as no copy. So a malformed or damaged entry blocked every later write, and the safety net
was off for that Assistant.
- **The store reads a malformed entry as no copy, for reading and for writing.** A malformed entry is one that isn't
  an object with kind 10040, that key's pubkey, an integer `created_at` and a string `id`. The next write replaces it.
- **`writeSelfMapCopy(assistantPubkey, event, { replace })`.** With `replace: true` it keeps `event` whatever the
  stored entry is. Its refusals are as before.
- **The press passes `replace: true`** on its first copy write of a press when a copy was stored but failed the press's
  check: a broken signature, or another author. After that write the copy is valid again.

A validly signed copy with a far-future `created_at` is the Assistant's own event. It isn't replaced, and it would win
wherever readers look too.

### 3. The store's log names `lastSigned` (R4-N4)

When `lastSigned` is there but isn't an object, `readSelfMapCopy` logs "the self-Map copy (lastSigned) cannot be read",
not "the choice file cannot be read". The behaviour is unchanged:
- reading gives no copy;
- a copy write refuses and leaves the file as it is;
- a choice write keeps it.

A press that finds a version then answers 500 before the choice until the file is fixed, as with a choice file that
isn't the shape.

### 4. The records and the nits (R4-N5)

- **openapi's press description and the BIBLE §11 row.** "publishes nothing when the self-entries found are already the
  target" gains "and this instance's relay holds that version".
- **`selfMap.js:287`** is rewrapped near 120 characters.
- **The story's round 4 Deviation** ("The press goes on under the first-press rules") takes a correction from the
  Implementer: it holds only when this instance's relay also holds nothing.
- **Amendment 3 item 1 step 3's "harmless"** gets a pointer to this item.

### 5. Tests (the Tester's lane, Phase 3)

- **The press** (`test/assistant-self-map-publish.test.js`):
  - **A failed import, then a retry,** for Turn on and Turn off. The second press publishes, this instance's relay
    holds a version whose self-entries are the target (none for Turn off), and the report is a publish.
  - **A wipe, with a copy whose self-entries are already the target.** Update now publishes. This instance's relay
    holds a version with the target's self-entries and the copy's other tags and content.
  - **An outside version newer than this instance's, already at the target.** The press publishes, and this instance's
    relay converges.
  - **The unchanged answers still stand when this instance's relay holds the base.** E3, E4, E7 and E14 pass as they
    are.
  - **R4-N2:** a tampered copy newer than a valid version here. The press builds on this instance's version and
    publishes; it doesn't answer 503.
  - **A stored copy that fails the check** (a broken signature on this instance's own version, same id): the version
    found replaces it in the same press.
- **The store** (K-tests):
  - a malformed stored entry (`{}`, or a missing `id`) reads as no copy, and the next write replaces it;
  - `replace: true` overwrites a newer stored entry;
  - a `lastSigned` that isn't an object gives no copy on read, with a log line naming `lastSigned`. A copy write refuses
    and leaves the file as it is, and a choice write keeps it.
- **The read** (`test/assistant-self-map-check.test.js`): `onThisRelay` and `published.source` in four cases:
  - the base only here;
  - only in the copy;
  - only outside;
  - the same id here and in the copy, which is `'local'`.

### Story deviations (A4)

None to the acceptance criteria or the approved words. AC-2 ("so no claim can be stuck"), AC-3's read-back and AC-5 are
met in the cases review round 4 found.

### Consequences (A4)

- "Nothing to change" now means this instance's relay already holds the version that says it. A press over a base held
  only in the copy, or only outside, stores a new version here and fans it out.
- A damaged or malformed copy no longer turns the safety net off.
- **Firmware reinstall required?** No.
