# ADR 0002: Tag and withdraw from the browser; the read carries what they need

**Status:** Accepted
**Date:** 2026-09-30
**Story:** `engineering-team/stories/my-assistants/2-tag-and-untag-from-the-page.md`

## Context

Story 2 turns `/assistants` from a list into the place to manage it:
- search for a profile and tag it as either kind of Assistant (AC-1, AC-2);
- open a row (AC-3) to change its tag (AC-4) or remove it (AC-5).

The Brainstorm buttons stay disabled until Nous' definition is found (AC-6). Every press says what happened, and a
failed or half-done press never claims success (AC-7). Remove **withdraws**: a retraction, never a dispute (book
decision 7).

**What exists** (ADR my-assistants/0001, story 1):

- **The read,** `GET /api/assistant/my-assistants` (`src/api/assistant/myAssistants.js`).
  - It's session-scoped and read-only, and answers `{ success, signedIn, local, rows: [{ pubkey, local, tags: [{ key, name }] }] }`.
  - Its rule already honours NIP-09 retractions by `e` (an id) and by `a` (an address, at or after the event), and
    keeps only the newest stance per (tag, profile).
  - So a withdrawal published as a kind 5 is read back correctly with no change to the rule.
- **The two tags,** `src/lib/my-assistant-tags/index.js`: `{ key, name, slug }`. The Tapestry slug is read from
  `src/lib/identification-tags`, whose `REQUIRED_TAGGINGS` entry also carries the definition's author (Nous,
  `15f7dafc…`). Book decision 4: Nous authors the Brainstorm definition too, at slug `my-brainstorm-assistant`.
- **The page,** `ui/src/pages/assistants/Index.jsx`, with the pure view-model `ui/src/pages/assistants/myAssistants.js`.
  Its phases are loading, signed-out, error and ready. Each load shows the loading line until the rows and the
  profiles settle.

**What the app already has for writing taggings:**

- **`publishProfileTagAssertionWithReport({ tag: { slug, authorPubkey, eventId }, targetPubkey, polarity,
  localTaPubkey, relays })`** (`ui/src/utils/publishProfileTag.js:64-110`). It's the one tagging wire shape, and
  `IdentificationTags.jsx:195-201` uses it:
  - it builds the tagging with the publisher's `d`, `p`, `a` and `e` (the definition's address and the event id
    being applied), the canonical and local `z`, and `polarity`;
  - it checks the extension against the session (`getActiveSignerOrThrow`, `ui/src/utils/signerGuard.js`), throwing
    a `SignerMismatchError` with its own words;
  - it throws "No NIP-07 extension detected…" without one;
  - it returns `publishEverywhere`'s `{ local, external }`.
- **`describeTaggingPublish` / `relayLine` / `publishTone`** (`ui/src/utils/taggingPublishReport.js`): the summary
  line and per-relay words the Identification Tags page shows. AC-7 asks for these words.
- **`useProfileTags.revoke`** (`ui/src/hooks/useProfileTags.js:150-164`): the app's only retraction today. It's a
  kind 5 with one `e`, content `'revoked'`, through `publishOrThrow`. It's tied to that hook and reports nothing.
- **`publishEverywhere`** (`ui/src/utils/nostrPublish.js:222`): the local relay (`POST /api/strfry/publish`) and
  `PUBLISH_RELAYS` in parallel. The outside leg is gated by `isExternalPublishAllowed()` (`:106`), which reads
  `/api/publish-policy` and **fails open**: an unanswered policy means "publish outside".
- **Profile search:** `GET /api/search/profiles/meili?q&limit&offset&wotPov&userPubkey`, as `TagSomeoneModal.jsx:95-135`
  calls it (2-character minimum, debounced, 10 results, a sequence guard against stale answers). Each hit carries
  `pubkey`, `npub`, `name`, `display_name`, `nip05` and `website`. It ranks by POV, so a brand-new Assistant can be
  missing. Hence AC-1's paste-a-key path.

**Concepts:** the same as ADR 0001, `nostr-user-tag`, `tag`, `tapestry-assistant` and `nostr-user`. No definitions
change.

## Options considered

### Option A — The read carries what the actions need; the browser signs and publishes

- `GET /api/assistant/my-assistants` adds, for a signed-in viewer:
  - **`definitions`:** each tag's definition, with its address, whether it was found, and the id of its newest
    event (the `e` a new tagging points at);
  - **per row, `retract`:** for each tag key the row carries, every one of the viewer's tagging events for that
    (tag, profile), as ids and addresses.
- The page signs in the browser with the viewer's extension:
  - **applies** go through `publishProfileTagAssertionWithReport`;
  - **withdrawals** go through one new sibling in the same file, a kind 5 naming those ids and addresses;
  - **a change** is an apply, then a withdrawal.
- After each press the page re-reads the list, keeping the rows on screen, and reports in `describeTaggingPublish`'s
  words.

- **Pros:**
  - No new endpoint, and no signing on the server: the viewer's key never leaves their extension, as with every
    tagging in the app.
  - Every wire shape stays in `publishProfileTag.js`.
  - The definition used for AC-6 is the one the apply points at, from the same relay set the list reads (ADR 0001
    sub-decision 2). So "found" and "used" can't disagree.
  - Withdrawing by both ids and addresses retracts every version the viewer has, including at other addresses. The
    read already honours both.
- **Cons:**
  - The read grows two fields and one more scan.
  - A change is two signatures, so it can half-succeed. AC-7 asks for that to be said, not hidden.

### Option B — A server write route that publishes the viewer's events

The page sends "tag X as brainstorm", and the server builds the event and asks the client to sign it, or asks to
sign it itself.

- **Pros:** one round trip per action.
- **Cons:**
  - The server can't sign as the viewer, and shouldn't hold their key.
  - A build-here-sign-there route duplicates the wire shape `publishProfileTag.js` owns (ADR profile/0022).
  - It adds an authenticated write surface (security-auth-exposure's default-deny) for something the browser
    already does safely.

### Option C — Look the definitions and the viewer's events up from the browser

The page reads `/api/profile-tags/by-id` for each definition, and its own taggings from relays.

- **Pros:** the read stays as it is.
- **Cons:**
  - Two more round trips, plus a second relay set: the browser's `PUBLISH_RELAYS`, not the tag-federation read union.
    "Found" could then disagree with the list.
  - The viewer's other-address tagging events are visible only to the server's scan.

## Decision

We chose **Option A**. It keeps the key in the extension and the wire shapes in their one file. And because one read
answers both "what's listed" and "what to sign against", a press can't act on a different picture than the page
shows.

Sub-decisions:

1. **The read's answer grows two additive fields** (ADR 0001's fields are unchanged, and story 1's suites still hold):

   ```
   signed in → { success, signedIn, local, rows: [{ pubkey, local, tags: [{ key, name }],
                                                    retract: { <key>: { ids: [<id>…], addresses: [<39999:viewer:d>…] } } }],
                 definitions: { brainstorm: { address, found, eventId|null },
                                tapestry:   { address, found, eventId|null } } }
   ```

   - **`retract[key]`** lists **all** of the viewer's kind 39999 taggings of that profile under that tag: every
     version myAssistantRows saw for the pair, applies and disputes alike, after its slug and signer checks. A row
     has a `retract` entry for each tag it carries, and the untagged Local row has `retract: {}`.
   - **`definitions`** comes from one more `federatedScan({ kinds: [39999], authors: [<authors>], '#d': [<slugs>] })`
     in the same handler, the newest per address. `found` is true when an event exists at
     `39999:<author>:<slug>`; `eventId` is that event's id.
   - A failed definitions scan (the local leg throws) fails the whole read, as the taggings scan does (500, ADR 0001
     sub-decision 1).

2. **The tag list gains each definition's author.** `MY_ASSISTANT_TAGS` entries become `{ key, name, slug, author }`.
   Both authors are the `author` of identification-tags' `my-tapestry-assistant` entry (Nous): read from there, never
   re-typed, so no new 64-hex literal appears. `definitionAddress(tag)` returns `39999:<author>:<slug>`.

3. **Withdrawal is one new export beside the apply:**

   ```js
   publishTaggingWithdrawalWithReport({ ids, addresses, relays })
   ```

   It goes in `ui/src/utils/publishProfileTag.js`.
   - It signs `{ kind: 5, tags: [['e', id]…, ['a', address]…, ['k', '39999']], content: 'withdrawn' }`, after
     `getActiveSignerOrThrow()`.
   - It returns `{ signed, result }` from `publishEverywhere`, and never throws on delivery, as the apply doesn't.
   - It throws, before signing, when `ids` and `addresses` are both empty.

   `useProfileTags.revoke` is left as it is: it's another surface's contract.

4. **The actions, in order.** One press at a time on the whole page. While one is publishing, every action button
   is disabled, and the pressed one reads **Tagging…**, **Changing…** or **Removing…**.
   - **Tag** (AC-2): one apply, `polarity: 1`, against `definitions[key]`.
   - **Change** (AC-4): the apply of the other tag first, then the withdrawal of `retract[current]`. Apply first means
     a half-done change leaves the profile listed with both chips, which is true and recoverable, never with none.
   - **Remove** (AC-5): one withdrawal naming every id and address in `retract`, across the tags the row carries.

   Each step is reported with `describeTaggingPublish`, with these subjects:
   - an apply: the tag's name;
   - a withdrawal: `Withdrawal of <name>` (`Withdrawal of My Tapestry Assistant and My Brainstorm Assistant` when the
     row carries both).

   A thrown error (no extension, a signer mismatch, a refused signature) becomes a refusal line in its own words,
   and nothing is published. A change whose apply was refused does not withdraw.

5. **The re-read keeps the page steady.** After every press, the page reads the list again (a *refresh*): the rows,
   then the profiles of any new pubkeys.
   - The rows stay on screen until the new answer is in. There's no loading line, and none of story 1's
     loading-state rules change, since those govern the first load only.
   - A refresh that fails leaves the rows as they were and adds a note to the result: the action's report stands,
     and the list couldn't be re-read.
   - The open row stays open if it's still listed.

6. **The result area.** One region on the page, below the search card and above the count, with `role="status"`,
   replaced on each press. It shows the summary line(s) and, under each, the per-relay lines (`relayLine`), toned
   by `publishTone`. A refusal shows as an error line.

7. **Search** (AC-1) is a card above the count, for signed-in viewers only.
   - It asks `/api/search/profiles/meili` the same way `TagSomeoneModal` does: debounced 250 ms, at least 2
     characters, `limit: 10`, the viewer's POV, and a sequence guard.
   - If the query decodes as an `npub1…` (nostr-tools `nip19`) or is 64-hex, that key is offered first as an
     exact match. Its card comes from `fetchProfilesChunked` (name, NIP-05 and URL with story 1's fallbacks), and it
     isn't duplicated if the search also returns it.
   - Every pubkey already in `rows`, the untagged Local row included, is filtered out.
   - The count line and the no-match line are § Copy's.
   - A search error shows a short line in the card, and never blocks the page.

8. **Availability** (AC-6), per tag, not only Brainstorm.
   - A tag's Tag and Change-to buttons are disabled when `definitions[key].found` is false, or when `definitions` is
     missing from the answer.
   - The first disabled one in the search card, and the one in an open row, carry the § Copy reason with the tag's
     name.
   - Today only Brainstorm can be missing. The same rule covers Tapestry at no cost.

9. **Rows open** (AC-3). Each row's main line becomes a `<button aria-expanded>`. Click, Enter and Space toggle it,
   and one row is open at a time.
   - The open row shows a panel with **Change to …**, when the row carries exactly one tag, and **Remove Tag**.
   - **The untagged Local row has no actions in this story, so it isn't a toggle**: no button, no chevron. Its
     prompt stays visible, as in story 1. Story 3 makes it openable when it gains duties. This reads AC-3's "a row"
     as "a row with something to open". The Implementer logs it under § Deviations, and the gate is asked to
     confirm it.
   - Story 1's markup contract stands: the row's `<li>` contains the name element and badges. The button sits
     inside the `<li>`, and the prompt link stays outside the button (no nested interactives).

10. **The pure parts live in the view-model** (`ui/src/pages/assistants/myAssistants.js`), Node-loadable as in
    ADR 0001 sub-decision 5:
    - `searchCandidates({ query, hits, exact, rows })` → the offered results, in order;
    - `parseExactKey(query)` → a hex pubkey or null;
    - `rowActions(row, definitions)` → `{ change: { toKey, label, enabled, reason } | null, remove: { label } }`;
    - `withdrawalOf(row)` → `{ ids, addresses, subject }`;
    - `tagAvailability(definitions)` → `{ brainstorm: { enabled, reason }, tapestry: … }`.

    The orchestration is a small, non-pure module, `ui/src/pages/assistants/assistantActions.js`:
    - `tagProfile`, `changeTag` and `removeTags`;
    - each takes `{ applyTagging, withdrawTaggings }` dependencies (defaulting to the two publishers above);
    - each returns `{ reports: [...], refused?: string }`.

    So the sequencing in sub-decision 4 is testable in Node with fakes.

## Consequences

- **What it enables.**
  - Story 3's untagged-on-the-map section can reuse `tagProfile` and the result area unchanged.
  - Any future surface that withdraws taggings can use `publishTaggingWithdrawalWithReport`.
- **What it constrains.**
  - **Two signatures for a change.** Extensions may prompt twice. Accepted: it's the only way to keep the two
    tags' events independent.
  - **The external-publish gate fails open** (`isExternalPublishAllowed`). Any browser test that presses Tag,
    Change or Remove **must** mock `/api/publish-policy` as `{ allowExternalPublish: false }`, and should also block
    WebSockets (`page.routeWebSocket`). Otherwise a stubbed signature goes to real relays.
  - **No live publish smoke on the Mac Studio's stack.** Its router uploads kind 39999 taggings with the canonical
    `z` to `wss://dcosl.brainstorm.world` (OPEN.md rows `2026-09-27-test-fixture-taggings-on-prod-relays` and
    `2026-09-30-npm-test-step-leaks-fixtures`). `/cycle-local` for this story checks the read and the page with
    mocks only. A live press is the owner's, on staging, with a real extension, or on a scratch stack
    (`scripts/scratch-stack.sh`).
- **What it leaves.**
  - Withdrawal makes strfry delete the named events locally, so the profile pages' Tagging Activity stops showing
    them as well.
  - Outside relays that ignore NIP-09 keep them, and the read still hides them for this viewer (ADR 0001
    sub-decision 2).
- **Firmware reinstall required?** No.

## Implementation notes

- `src/lib/my-assistant-tags/index.js`:
  - add `author` to each entry, from `REQUIRED_TAGGINGS`' `my-tapestry-assistant` entry;
  - export `definitionAddress(tag)`.
- `src/api/assistant/myAssistants.js`:
  - `myAssistantRows` also returns `retract` per row (sub-decision 1). The rule that picks the newest stance is
    unchanged; `retract` gathers every candidate event for the pair before the newest is chosen;
  - a pure `definitionsFrom(events)` builds the `definitions` map;
  - the handler runs the definitions scan in parallel with the taggings scan, and returns `definitions`;
  - update the header comment's answer shape, and the `openapi.yaml` entry beside it.
- `ui/src/utils/publishProfileTag.js`: add `publishTaggingWithdrawalWithReport` (sub-decision 3).
- `ui/src/pages/assistants/myAssistants.js`: the pure functions of sub-decision 10, plus the new strings in story 2's
  § Copy.
- `ui/src/pages/assistants/assistantActions.js` (new): the orchestration (sub-decision 10).
- `ui/src/pages/assistants/Index.jsx`:
  - the search card, the result area, the row toggle and panel, and the busy state;
  - the refresh path (sub-decision 5) beside story 1's load.

  Split it into `AssistantSearch.jsx` and `AssistantRow.jsx` in the same folder if it passes ~300 lines.
- `ui/src/styles.css`: the `.bsd-ma-*` block gains the search card, the result list, the row button and chevron, the
  panel, and the action buttons, at the blueprint's measurements.
- **For the Tester (Phase 3):**
  - Server: `retract` and `definitions` through `myAssistantRows` and `definitionsFrom` with fixtures, and the
    handler through injected `scan`. Story 1's R and U tests must pass unchanged.
  - View-model: the pure functions, with plain objects.
  - Orchestration: `assistantActions.js`, with fake publishers. Check the order (apply before withdraw), no withdraw
    after a refused apply, and the subjects.
  - `publishTaggingWithdrawalWithReport`: the event shape, with a stubbed `window.nostr` and `fetch`.
  - Browser (Playwright): a stubbed `window.nostr` via `addInitScript`, `/api/strfry/publish` mocked, and
    `/api/publish-policy` mocked to `{ allowExternalPublish: false }`, with WebSockets blocked. A mocked read that
    answers the post-press state is enough to prove the refresh.

## Out of scope

- Story 3's duties, on-map status, untagged-on-the-map section and Duties tab.
- A server write route, server-side signing, or any change to `useProfileTags.revoke`.
- Undo, confirmation dialogs, disputes, and bulk actions.
- Publishing Nous' My Brainstorm Assistant definition: the book's § Before shipping.
