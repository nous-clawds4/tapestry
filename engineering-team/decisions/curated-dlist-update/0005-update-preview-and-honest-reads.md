# ADR 0005: The Update preview — honest reads, and one planner over the panel's verdicts

**Status:** Accepted (§7's entries and §8's closing line superseded by `curated-dlist-update` ADR 0006)
**Date:** 2026-09-13
**Story:** `engineering-team/stories/curated-dlist-update/5-update-list-preview.md`
**Amended by:** Amendment 1 (2026-09-13): §7's precedence — the header's own states decide before pending reads.
Amendment 2 (2026-09-13): the panel waits for my list and names its gaps (§6); a failed vote source names the votes.
**Supersedes in part:** `curated-dlist-update` ADR 0004 (§2, one vote filter per source; §3, `useTrustWeights`
unchanged; §4's words for a failed vote source, by Amendment 2; §7's reading of "the shared list read cleanly") and
`my-curated-dlists` ADR 0003 (sub-decision 8, the Update list button as a disabled placeholder). See Decision §9.

> **Superseded in part (2026-09-13):** §7's entries gain their pins — copy and refresh entries carry `version`, the original's current id; delete entries carry `copyId`; and the upgrade is `{ dropsMarker }`, not `true` — and §8's closing line, "Nothing is signed: publishing isn't built yet.", goes — `curated-dlist-update` ADR 0006.

## Context

The story's acceptance criteria, in short:
- **AC-1:** on my own list, Update list opens a preview that writes nothing. Read-only lists keep Update disabled.
- **AC-2:** the preview's top names the Scoring Method, the point of view and the cutoff, and says they apply in this
  browser.
- **AC-3:** it proposes, in groups:
  - copy;
  - refresh;
  - delete;
  - keep-flagged (the original can't be found, or it was edited and the new version doesn't qualify);
  - the older header's upgrade;
  - skipped, with scores.

  With nothing to do, it says the list is up to date.
- **AC-4:** any failed or incomplete read means the preview proposes nothing, and says what couldn't be read. That
  covers:
  - a relay refusing the connection;
  - a one-source shared list;
  - my list's items;
  - capped votes;
  - weights, including Follow List with no follow list and an unreachable rank provider;
  - hundreds of candidates, covered all or not at all.
- **AC-5:** the preview's verdicts equal the Curation method panel's, and the panel shows the same "couldn't check".
- **AC-6:** nothing scheduled, nothing on the header, nothing signed. Simple Lists keeps its scores, but may now warn
  when its weights couldn't be read.

The Planning gate decided three things:
- the epic's story 5 is split: this is the preview, and story 6 publishes;
- with any read incomplete, the preview proposes nothing at all;
- an edited original is judged on its new version: a refresh if it qualifies, otherwise the copy stays, flagged. A
  copy is never deleted because of an edit.

**Facts from the code (read this session).**
- **The placeholder.** `UpdateListButton` (`ui/src/pages/grapevine/CuratedDListItems.jsx`) renders a disabled
  `<button>Update list</button>`. On my own lists it adds "Update list isn't built yet."; on read-only lists it says
  where Update runs (story 3).
- **The reads.** `ItemsSection` reads:
  - my list through `useListItems([myCoord], listRelay)`;
  - the shared list only while "Also show candidates to copy" is on;
  - votes only for candidate ids (`useItemVotes`);
  - weights for those candidates' authors and voters (`useTrustWeights`).

  It then judges the candidates with `candidateVerdicts` (story 4, ADR 0004).
- **The lookups.** `lookupListItems` and `lookupItemVotes` (`ui/src/utils/treasureMap.js`) each send one filter per
  source. They report `local` / `relay` as 'ok' | 'failed' | 'skipped', and `truncated` for the local scan only.
- **Copies.** ADR 0001 §4–§6: a copy is my assistant's kind-39999 item under my header.
  - A copy of a kind-39999 original carries `["q", "39999:<author>:<d>", …]`.
  - Every copy carries `["q", "<id of the version copied>", …, "<author>"]`.
  - When the original is edited, the copy is unchanged, and a refresh re-copies at the same address with a new
    version `q`.

  Story 2 judges "already copied" by `q` alone (`curatedItemRows`).
- **The header.** `describeCurationHeader` reports `notes: ['older-link']` for the older link and `problems` for the
  rest. `sharedListUnavailable(lookup, info)` gives `checking` / `failed` / `missing` / `no-pointer` / `deferred`, or
  null.
- **Row 280.** `/api/relay/external` (`src/api/relay/fetchEvents.js`) runs `SimplePool.querySync`, which resolves
  empty when a relay refuses the connection. The endpoint then answers `{ success: true, events: [] }` (`:48–63`).
  - It has 13 UI callers.
  - It has two server callers (`src/firmware/install.js:1072`, `:1113`; `src/api/concept/pullClassThread.js`).
  - nostr-tools and ws are required at module level, so the module can't be loaded outside the container.
- **The connect-observing primitive already exists.** `probeRelayForEvent` (`src/api/_shared/relaySource.js:147–212`):
  - connects with `Relay.connect`, which throws on DNS failure, TCP refusal, a non-relay host or a blackholed IP;
  - retries once, within `CONNECT_TIMEOUT_MS`;
  - reads until EOSE within `QUERY_TIMEOUT_MS`;
  - keeps only events with a valid signature, re-checking kinds and authors;
  - takes its dependencies by parameter.

  But it answers with the newest event only. Its comment says the three querySync-shaped helpers must not be unified.
  The relay-presence handler (`src/api/relay/presence.js`) injects the probe (`deps.probe`) and requires its source
  lazily. That is the house idiom for testing server relay code.
- **Weights** (`ui/src/hooks/useTrustWeights.js`):
  - With Follow List, no kind 3 for the point of view in local strfry gives every weight 0 and no error (`:43–57`).
  - The rank read drops an unsuccessful answer (`data.success ? … : []`, `:113`).
  - The client aborts the rank read at 8 s.
- **Ceilings** (story 4's review, Non-blocking 3 and 4):
  - an id costs about 73 URL characters, and nginx's default request line is 8 KB;
  - the community relay advertises `max_limit` 10000, above `VOTES_LIMIT` (5000).
- **Pins to re-aim (the Tester's, Phase 3).** These tests pin the disabled Update and its "isn't built yet" line:
  - `curated-dlist-update-curation-method` S8;
  - `curated-dlist-update-read-only-curation` S4 and R1;
  - `my-curated-dlists-items` S3.
- **Drift:** the branch is 28 commits behind `origin/staging`, and none of those commits touches these files.

**Concepts.** No concept changes. For orientation, the story touches:
- `39998:<TA>:list` (live here: `39998:11f23fe4…:list`);
- `39998:<TA>:tapestry-assistant`.

Votes (kind 7) and deletion requests (kind 5) have no concept handles.

**POV reflex checks.**
- **Who is this true for?** This viewer, with this browser's method, point of view and cutoff. The preview says so.
- **Where does trust come from?** The chosen Scoring Method, computed from the point of view at read time.
- **Could anyone else publish their own version?** Yes. Votes from anyone are read ungated. The strict read keeps every
  signed event and drops only what fails signature verification.
- **What changes when the POV changes?** The plan is recomputed on the next load. Nothing is stored except the cutoff
  (story 4).

Principle 4: there is no graph write.

## Options considered

### Option A — A strict relay read, opted in; the fixes in the curation util; one pure planner over the panel's verdicts (chosen)
- **The server.** `/api/relay/external` gains an opt-in strict mode, backed by a connect-observing reader of every
  event: a sibling of `probeRelayForEvent`. Only the curation reads and the rank read opt in.
- **The util.** It batches and caps the vote reads, reports a capped relay answer, and lets the panel's summary name a
  partial shared-list read.
- **The planner.** A pure `updatePlan` groups the preview from the same verdicts the panel shows.
- **The page.** The items section shares its reads between the panel and the preview.
- **Pros:**
  - The fix reaches exactly the reads Update depends on. Every other caller of the endpoint is untouched.
  - Every rule is a pure function a Node suite can pin.
  - AC-5 holds by construction: one set of reads, one verdict function.
- **Cons:**
  - Row 280 stays open for the endpoint's other callers.
  - A strict read of a dead relay takes up to the connect budget, with one retry, before it answers.

### Option B — Make the endpoint honest for every caller
- **Pros:** closes row 280 at once.
- **Cons:** it changes the behaviour of 13 UI surfaces and two server paths. Firmware install and the class-thread pull
  would start failing where they now proceed on "not found". That is a wider change than this story's ACs, with no
  tests of its own. Rejected; row 280 keeps it.

### Option C — Probe each relay with `/api/relay/presence` before reading
- **Cons:** an extra request per read, and a race (a relay can drop between the probe and the read). The probe also
  answers about one event, not a set. Rejected.

### Option D — Compute the plan on the server
- **Cons:** the method, point of view and cutoff are per browser (`TrustContext`, and story 4's cutoff). Moving them
  couples the server to one browser's settings, for the reason ADR 0004 rejected its Option C. Rejected.

### Option E — Let the preview read its own data, apart from the panel
- **Cons:** it doubles the reads, and two reads made at different moments can disagree, which breaks AC-5's equality.
  Rejected in favour of sharing the items section's reads.

## Decision

We chose **Option A**.

1. **A strict relay read (server).**
   - **`readRelayEvents(relayUrl, filter, opts)`** in `src/api/_shared/relaySource.js`, beside `probeRelayForEvent`.
     - It follows the probe's steps: `Relay.connect` with one bounded retry inside `CONNECT_TIMEOUT_MS`, then a
       subscription until EOSE inside `QUERY_TIMEOUT_MS`.
     - It keeps **every** event with a valid signature, whose kind and author match the filter as the probe
       re-checks them.
     - It answers `{ status: 'ok' | 'unreachable', events, error }`.
     - Any of these is `unreachable`, never an empty `ok`: a failed connection, a subscription the relay closes
       before EOSE, or no EOSE within the budget.
     - It is injectable (`{ connect, verify, connectTimeoutMs, queryTimeoutMs }`), in the module's DI-by-parameter
       idiom.
     - The module's comment about helpers becomes "four", and names this one's distinct outcome: every event, from a
       relay proven reachable.
   - **`GET /api/relay/external?…&strict=1`.** `handleFetchExternalEvents(req, res, deps = {})` reads each ws/wss relay
     in parallel through `deps.readRelay || relaySource.readRelayEvents`. The whole read is bounded by
     `FETCH_TIMEOUT_MS`, and events are merged by id.
     - When every relay is unreachable, it answers `{ success: false, events: [], error: "Could not read <relay>:
       <reason>[; …]", relays, unreachable }`.
     - Otherwise it answers `{ success: true, events, count, relays, unreachable }`. For a multi-relay request,
       `unreachable` may be non-empty.
   - **Without `strict`, the endpoint is unchanged.** Its nostr-tools and ws requires move into the non-strict path,
     the presence handler's idiom, so the module loads without them.
2. **The curation reads opt in.** `useListItems`' and `useItemVotes`' `fetchRelay` add `&strict=1`. An unreachable
   community relay therefore reads as `relay: 'failed'`, never as an empty list.

   `useCurationHeaders`, `useTreasureMap` and the other callers keep the endpoint's old answer. Row 280 records them.
3. **Votes are batched, and a capped answer is reported** (`lookupItemVotes`).
   - `VOTES_IDS_PER_READ = 50`: the ids go in chunks. Each chunk is one filter, `{ kinds: [7], '#e': chunk, limit:
     VOTES_LIMIT }`, sent to each source.
   - The answers are merged by event id, local first.
   - A source is `failed` when any of its chunks failed.
   - `truncated` is set when the local scan reports it for any chunk, or when a relay chunk answers with `VOTES_LIMIT`
     or more events.
   - No ids still asks nothing.
4. **Items: a capped relay answer is reported** (`lookupListItems`).
   - The record gains `relayTruncated`: the relay answered with `LIST_ITEMS_LIMIT` or more items.
   - The items section's source notes add one sentence for it.
   - The planner treats it as incomplete.
5. **Weights fail, instead of reading as "nobody"** (`useTrustWeights`; AC-4, AC-6). Scores don't move on either page.
   - **The rank read.** It adds `&strict=1`. An unsuccessful answer sets `error` ("Couldn't read the rank provider
     <relay>: <error>"), with every weight null, as the catch path already does.
   - **Follow List with no kind 3 for the point of view here.** It sets `error` ("No follow list for the point of view
     in this instance's strfry"). The weights stay 0, so Simple Lists' scores don't move; its footnote shows the
     warning it already shows for other weight errors.
   - Nothing else in the hook changes. The Trusted List's author gap is a separate task.
6. **The panel's summary names a partial shared-list read.** This supersedes ADR 0004 §7's reading, as recorded in
   story 4's Deviation 3.
   - `candidateVerdicts` gains `incomplete`: a list of other reads that came back incomplete.
   - When the list is non-empty, the decided verdicts stay, because they are honest for the candidates that were read.
     But the summary is `incomplete`, and its `reason` names those reads.
   - `ItemsSection` builds the list from the shared list's record:
     - "the shared list on this instance's strfry" (`local: 'failed'`);
     - "the shared list on the community relay" (`relay: 'failed'`);
     - "every item on the shared list (more than one read returns)" (`truncated` or `relayTruncated`).
7. **The planner: `updatePlan(input)`** in `ui/src/utils/treasureMap.js`. It is pure and never throws.
   - **Inputs.** `{ assistantPubkey, header, mine, shared, verdicts }`.
     - `header` is `{ state, olderLink, problems }`, from `sharedListUnavailable` and `describeCurationHeader`.
     - `mine` and `shared` are `lookupListItems` records; `shared` is undefined while unread.
     - `verdicts` is `candidateVerdicts`' result over **every** shared item, with the §6 `incomplete` list.
   - **Copies** are my assistant's items on my list that carry a `q` (ADR 0001 §5). A copy's original is found this
     way:
     - by its address `q`: the shared item at that coordinate, which is its current version;
     - otherwise by its version `q`: the shared item with that id.

     A copy is **edited** when its original is kind 39999 and the current version's id is not the copy's version `q`.
   - **Candidates** are shared items that no copy references, by the same rule as `curatedItemRows`.
   - **`checking`** while anything is pending: the header, either list, or the verdicts.
   - **`blocked`**, with every reason, when any of these holds:
     - the header is `failed`, `missing`, `no-pointer` or `deferred`, or has a problem other than the older link;
     - my list's read failed on a source, or was cut off (`truncated` or `relayTruncated`);
     - the shared list's read was the same;
     - the verdicts' summary is `incomplete` (votes, weights, or §6).
   - **`ready`**, with these groups:
     - **copy:** candidates that qualify;
     - **skipped:** candidates that don't, with score and cutoff;
     - **refresh:** copies whose original is edited and qualifies;
     - **delete:** copies whose original is not edited and doesn't qualify;
     - **keep, flagged:** copies whose original isn't found (`not-found`), and copies whose original is edited and
       doesn't qualify (`edited-not-qualifying`);
     - **unchanged:** a count of copies whose original is not edited and qualifies;
     - **upgrade:** `header.olderLink`.

     `upToDate` means no copy, refresh, delete or upgrade.
   - **Output.** `{ state, reasons, copy, refresh, delete, keepFlagged, unchanged, upgrade, skipped, upToDate }`.
     - Each entry names its item: `name`, `routeId`, `score`.
     - A copy's entry also carries its own `copyRouteId`.
     - A kept entry carries `why`.
8. **The page.**
   - **`UpdateListButton({ curator, canCurateHere, open, onToggle })`.**
     - On my own lists it is enabled (`onClick={onToggle}`), with no "isn't built yet" line.
     - On read-only lists it is exactly as story 3 left it.
   - **`ItemsSection`**:
     - holds `previewOpen`;
     - reads the shared list while `showCandidates || previewOpen`;
     - reads votes for every shared item: the candidates, plus my copies' originals;
     - reads weights for their authors and voters;
     - computes two verdict sets from the same reads and the same `incomplete`: the panel's over the candidates (as
       now), and the preview's over every shared item;
     - renders `<UpdatePreview …/>` under its header while `previewOpen`.
   - **The detail page** passes `headerState` to `ItemsSection` on my own lists: `sharedListUnavailable(lookup, info)`,
     `info.notes` and `info.problems`.
   - **`UpdatePreview`** (new, `ui/src/pages/grapevine/UpdatePreview.jsx`) shows:
     - the method line: "Scoring Method: …", "Point of view: …", "Cutoff (≥) …", and "These apply in this browser and
       are not written onto the list." (AC-2);
     - "⏳ Checking…";
     - when blocked: "Nothing to propose — couldn't check <reasons>." (AC-4);
     - when ready, the groups headed "Copy", "Refresh", "Delete", "Keep, flagged", "Upgrade" and "Skipped", each with a
       count and its items. The kept reasons are "its original can't be found" and "its original was edited; the new
       version doesn't qualify yet". The upgrade line is "Your assistant's header uses the older link; Update will
       switch it to “pointer”.";
     - when there's nothing to do: "Your list is up to date.";
     - always, at the end: "Nothing is signed: publishing isn't built yet." (story 6).
9. **Superseded in part.** Each gets a Status parenthetical and a one-line note citing `curated-dlist-update` ADR 0005
   by short name:
   - `curated-dlist-update` ADR 0004 (§2's one filter per source; §3's "`useTrustWeights` unchanged"; §7's
     "read cleanly");
   - `my-curated-dlists` ADR 0003 (sub-decision 8, the disabled Update placeholder).

   OPEN.md row 280 is updated to say that strict mode exists and which reads opt in. It stays open for the rest.

## Consequences
- **Enables** story 6. The plan is the list of writes, and the preview's groups become its confirmation.
- **Constrains:**
  - Strict reads answer slower when a relay is down: the connect budget, one retry, then "couldn't check".
  - The preview needs the shared list read, so opening it reads what "Also show candidates to copy" reads.
- **Debt, recorded:**
  - the endpoint's non-strict callers (row 280);
  - a relay whose own limit is below ours still answers a capped read as complete;
  - the rank read carries every pubkey in one GET, so past about 110 pubkeys it fails honestly;
  - two copies of one original are each judged on their own;
  - the Trusted List's author gap (a separate task).
- **Firmware reinstall required?** No. No concept definitions change.

## Implementation notes
1. **`src/api/_shared/relaySource.js`** — `readRelayEvents` (§1), and the helpers comment.
2. **`src/api/relay/fetchEvents.js`**
   - `strict` mode.
   - `handleFetchExternalEvents(req, res, deps)`.
   - The requires move inside the non-strict path.
   - The doc comment names the strict answer.
3. **`ui/src/hooks/useListItems.js`, `ui/src/hooks/useItemVotes.js`** — `&strict=1` (§2).
4. **`ui/src/hooks/useTrustWeights.js`** — §5 only.
5. **`ui/src/utils/treasureMap.js`**
   - `VOTES_IDS_PER_READ` and the chunked `lookupItemVotes` (§3);
   - `relayTruncated` in `lookupListItems` (§4);
   - `candidateVerdicts`' `incomplete` (§6);
   - `updatePlan` (§7).
6. **`ui/src/pages/grapevine/CuratedDListItems.jsx`** — `UpdateListButton`, `ItemsSection`'s reads and two verdict
   sets, the `relayTruncated` source note (§4, §8).
7. **`ui/src/pages/grapevine/UpdatePreview.jsx`** (new) — §8.
8. **`ui/src/pages/grapevine/CuratedDListDetail.jsx`** — `headerState` to `ItemsSection` (§8).
9. **Docs** — the §9 notes and OPEN.md row 280.
10. **Local check (cycle-local).**
    - **Deploy.** The server and UI both change, so copy `src/api/_shared/relaySource.js` and
      `src/api/relay/fetchEvents.js` into the container and restart `brainstorm`, then copy the UI build.
    - **Sign in** through the fetch stub as staging's customer (assistant `253d40c4…`), and open `dog-breed`. Its two
      local candidates and its older-link header should give:
      - under Trust Everyone at cutoff 1: "Copy (2)" and the upgrade;
      - at cutoff 2: "Skipped (2)" and the upgrade.
    - **Force a failed read** by having the stub answer the strict read as `success: false`. That should give "Nothing
      to propose — couldn't check …", and the same "couldn't check" in the panel.
    - **Confirm nothing is written:** no POST in the stub's log.
    - **Simple Lists:** unchanged scores.
    - **The endpoint:** one strict read of a refusing relay (for example `ws://127.0.0.1:9`) answers `success: false`.

**Testable seams (the Tester's call, Phase 3).**
- **Server:**
  - `readRelayEvents` with an injected `connect` / `verify`: unreachable, a fake relay's events and EOSE, an early
    close, a timeout, a bad signature, a mismatched kind;
  - `handleFetchExternalEvents` with `deps.readRelay`: all unreachable → `success: false`; some unreachable → `success:
    true` and `unreachable`; events merged by id; non-strict unchanged (the source still uses querySync); the module
    loads without the container's paths.
- **Util:**
  - the chunked vote read — the chunk size, combined statuses, and a relay cap reading as `truncated`;
  - `relayTruncated`;
  - `candidateVerdicts`' `incomplete`;
  - `updatePlan` — every group, every blocked reason, edited against unedited, not found, the upgrade, up to date,
    checking, garbage.
- **Structural:**
  - the hooks' `strict=1`;
  - `useTrustWeights`' two new errors;
  - `UpdateListButton` enabled on my own lists only;
  - `UpdatePreview`'s phrases;
  - `ItemsSection`'s reads and its two verdict sets;
  - the detail page's `headerState`;
  - nothing written.
- **Docs:** §9's notes.
- **Re-aims:** story 4's S8, story 3's S4 and R1, and `my-curated-dlists-items` S3.

Regression is the full `npm test`. Known reds: OPEN.md row 191, and `summaries-element-count` L5 (another session's
subsets). Run single suites through `require('./test/<name>.test.js').run()`.

## Out of scope
- Signing and publishing the plan (story 6): copies, refreshes, deletion requests, the header upgrade.
- Story 6's carry-forwards: R2-2, the 409 sentence, and whether relays honor kind-5 deletions.
- The endpoint's other callers (row 280), and the header endpoint's `fetchFromRelays` (row 245).
- Batching the rank read.
- The Trusted List's author (a separate task).
- A schedule; the method on the header.

## Amendment 1 (2026-09-13, from Test Design, approved at its gate)

Found while writing story 5's tests. §7 lists "checking while anything is pending" before "blocked". A header in one of
these states leaves no shared list to read:
- `failed`;
- `missing`;
- `no-pointer`;
- `deferred`.

The shared list is then never read. Under §7's order, the preview would say "Checking…" forever instead of saying why it
proposes nothing, which breaks AC-4.

The same holds for a list read that failed or was cut off: the verdicts depend on it, so they never complete.

The corrected order:
1. **The header decides first.** A header in one of those states, or with a problem other than the older link, makes
   the plan `blocked` at once, with its reason, whatever else is still pending. A header still `checking` makes it
   `checking`.
2. **Then the two list reads.**
   - Either still in flight → `checking`.
   - Either failed on a source, or cut off → `blocked`, without waiting for the verdicts. If the verdicts are also
     incomplete, their reason joins.
3. **Then the verdicts.** Pending → `checking`; incomplete → `blocked`.
4. **Then `ready`.**

Nothing else in §7 changes.

## Amendment 2 (2026-09-13, from the Implementation gate, approved at its Architecture gate)

The Implementer found this (story 5's Deviations), and the operator chose at the Implementation gate to close it before
Review.

AC-5's second bullet says: where the preview proposes nothing because a read failed, the panel shows the same
"couldn't check". §6 gives the panel only the shared list's gaps, but which shared items are candidates depends on my
list. `curatedItemRows` drops the ones my assistant's copies reference (`ui/src/utils/treasureMap.js:584–595`). So:
- when my list's read fails or is cut off, originals already copied can come back as candidates;
- the panel then shows a complete-looking "N of M" while the preview proposes nothing;
- the same happens, briefly, while my list is still being read.

1. **The panel waits for my list and names its gaps.** On my own lists, while candidates are shown:
   - until my list's read is in, the panel's verdicts are `checking`;
   - its `incomplete` list carries my list's gaps after the shared list's (§6), in `listReadGaps`' words:
     - "your list on this instance's strfry" (`local: 'failed'`);
     - "your list on the community relay" (`relay: 'failed'`);
     - "every item on your list (more than one read returns)" (`truncated` or `relayTruncated`).
   - As in §6, the decided verdicts stay, and the summary is `incomplete`, naming the gaps.
   - The preview's verdicts keep §6's list. The planner already waits for my list and blocks on its gaps, naming them
     itself (§7, Amendment 1).
2. **A failed vote source names the votes.** `candidateVerdicts` words a failed vote source as "the votes on this
   instance's strfry" or "the votes on the community relay". ADR 0004 §4 had "this instance's strfry" and "the community
   relay".
   - The preview's reasons then end "…; the votes on the community relay", not a bare "the community relay" after two
     list reasons.
   - The panel reads "Verdicts incomplete — couldn't check the votes on the community relay."
   - Two failed sources still join with "and".
3. **How AC-5's second bullet is met.** Whenever the preview proposes nothing because a read failed, the panel's summary
   is incomplete too. The two can name different reads:
   - the preview names every read it depends on;
   - the panel names the reads its own verdicts depend on. When the votes or the weights failed, it names those alone,
     as in story 4.

   The header's states are not reads the panel depends on. With no shared list to read, the candidates box already says
   why (ADR 0003 note 1). A header problem blocks the preview, but it is not a failed read.

**Implementation notes.**
- `ItemsSection` (`ui/src/pages/grapevine/CuratedDListItems.jsx`): the panel's `candidateVerdicts` call waits for
  `myList` and receives my list's gaps. The preview's call is unchanged.
- `candidateVerdicts` (`ui/src/utils/treasureMap.js`): the two words for a failed vote source.
- ADR 0004: its Status parenthetical and its superseded-in-part note gain §4's words for a failed vote source.
- Local check:
  - with the stub failing only the strict read of my list, the preview proposes nothing and names "your list on the
    community relay"; the panel says "Verdicts incomplete — couldn't check your list on the community relay.", and the
    candidates still show;
  - with every strict read failing, the preview's last reason reads "the votes on the community relay".

**Testable seams (the Tester's call).**
- `listReadGaps(record, 'your list')`: its three phrases, and no phrase for garbage.
- `candidateVerdicts`' words for each failed vote source, and for both.
- In `ItemsSection`: the panel's verdicts wait for my list and receive its gaps, while the preview's keep §6's list.

Nothing else changes, and no concept is touched.
