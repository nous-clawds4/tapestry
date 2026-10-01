# ADR 0004: A NIP-05's status comes from the existing verify endpoint, told in three states; profile links are plain links outside the toggles

**Status:** Accepted
**Date:** 2026-10-01
**Story:** `engineering-team/stories/done/my-assistants/4-nip05-validity-and-profile-links.md`

## Context

Story 4 adds two things to `/assistants`:
- **AC-1 to AC-3: a NIP-05's status.** **Verified**, **Not valid** or **Couldn't check**, beside each NIP-05 in the
  Assistants list and in "On your Treasure Map, but not tagged". It says it's checking while the check runs, and
  never shows **Not valid** from a check that got no readable answer.
- **AC-4 to AC-6: a View profile link** from every Assistant to `/user/<pubkey>`, opening in a new tab:
  - in an open row;
  - in the not-tagged section;
  - in an open duty on the Duties tab.

  Pressing it doesn't open or close a row.

**What exists:**
- **`GET /api/nip05/verify?nip05=&pubkey=`** (`src/api/nip05.js:155-174`) answers `{ verified: boolean }`, fail-closed:
  - `verifyNip05Identifier` (`:132-153`) fetches `https://<domain>/.well-known/nostr.json?name=<name>` through
    `guardedFetch` (`src/utils/ssrfGuard.js:258-268`): `https:` only, a non-public host refused, redirects refused,
    and a 5 s abort;
  - it returns the attested pubkey or `null`. **`null` covers everything at once:** a malformed identifier, a refused
    host, a network error, a timeout, a non-2xx (including a 3xx), a body that isn't JSON, and a listing without the
    name. So today's answer can't separate "the domain says no" from "the domain didn't answer". That's exactly the
    distinction AC-1 needs.
- **The profile pages' check:** `useNip05Verification` (`ui/src/hooks/useNip05Verification.js`, used by
  `BrainstormProfile.jsx` and `users/UserDetail.jsx`) reads only `verified`, and shows a mark or nothing. The story
  leaves those pages unchanged.
- **Other copies of the check:** Meili search (`src/api/search/profiles/meili/index.js`) and admin
  (`src/api/admin/index.js`) each keep their own. They're out of scope.
- **The profile route:** `/user/:pubkey` (`ui/src/App.jsx:149`, `BrainstormProfile`) shows `ProfileTagsSection` and
  `AuthoredTaggingSection`. It's where the main avatar menu sends profiles (`profileBase: '/user'`,
  `ui/src/components/BrainstormUserMenu.jsx:104`).
- **The page's markup:** a row's main line is its toggle `<button>` (story 2), so nothing interactive can sit inside
  it. A Duties row's line is a toggle too. The not-tagged section's items aren't toggles.
- **Profile data on the page:** each card's `nip05` is the profile's text, or `'—'` when it has none
  (`ui/src/pages/assistants/myAssistants.js:131`). The real identifier isn't kept apart from the placeholder.

**Open rows this relies on:**
- `2026-09-20-nip05-verification-no-longer-follows-redirects`: a domain behind a 30x fails the lookup. Under this
  design it reads **Couldn't check**, which is honest (no readable listing was reached), and more visible than
  today's missing checkmark.
- `2026-09-20-nip05-guard-leaves-dns-rebinding-open`: the guard's accepted gap. This design adds no new fetch path;
  it reuses `guardedFetch` as is.
- `2026-09-20-public-endpoints-have-no-rate-limiting`: the endpoint stays unthrottled. A page view makes one lookup
  per distinct (profile, NIP-05) on the page, a few to a few dozen, each bounded by the 5 s abort.

**Concepts:** none change. `39998:<TA>:nostr-user-tag` (here `39998:11f23fe4…:nostr-user-tag`) is only where the
profile page's tags come from. **Firmware:** untouched.

## Options considered

### Option A — the verify endpoint gains a `status`, classified on the server; the page asks per NIP-05

- **The server:**
  - the lookup is split so it says what happened: a malformed identifier, a readable listing (and what it lists for
    the name), or no readable answer;
  - `GET /api/nip05/verify` adds `status: 'verified' | 'invalid' | 'unchecked'` beside `verified`, with `verified`
    unchanged.
- **The page:** asks once per distinct (pubkey, NIP-05) and caches definite answers. It shows Checking… until then.
- **Pros:**
  - one classification, on the server, beside the guard;
  - additive, so the profile pages and the SSRF suite keep their contract;
  - GET only, so the page still only reads (story 1's A11);
  - each row's status arrives on its own, and a slow domain holds up only its own status.
- **Cons:**
  - one request per NIP-05;
  - the lookup function is restructured. Its public contract holds, and the SSRF suite pins it.

### Option B — statuses come in the list's read (`GET /api/assistant/my-assistants`), or in a batch endpoint

- **Pros:** one request for the list.
- **Cons:**
  - the list read doesn't fetch profiles, the browser does (ADR 0001), so it doesn't know the NIP-05s;
  - the not-tagged section's profiles are fetched later still;
  - folding lookups into the list read would hold every row behind the slowest domain (up to 5 s), against story 1's
    "rows appear once, promptly";
  - a batch endpoint would need a POST or a long query string, a second shape for the same check, and the
    classification anyway.

### Option C — the browser fetches each domain's `/.well-known/nostr.json` itself

- **Cons:**
  - many domains don't send CORS headers, so a CORS failure can't be told from "unreachable", and "Not valid" could
    never be trusted;
  - it bypasses the server's guard and its single implementation.
- **Rejected.**

## Decision

**Option A.** It's the smallest honest change: the server already does the lookup behind the guard, and only its
answer is too coarse. Classifying there and adding a field keeps every existing reader as it is, and lets the page
tell the three states apart without guessing.

Sub-decisions:

1. **The lookup says what happened** (`src/api/nip05.js`). A new `lookupNip05(nip05Address)` returns
   `{ outcome, pubkey }`:
   - **`'malformed'`:** the identifier doesn't match `NIP05_LOOKUP_RE`.
   - **`'unreachable'`:** no readable listing was reached. That covers:
     - `guardedFetch` answering `null` (a refused host, or not `https:`);
     - the fetch throwing (a network error, or the 5 s abort);
     - a non-`ok` response, including any 3xx (the redirect row) and 404/5xx;
     - a body that isn't JSON;
     - JSON whose `names` isn't a plain object.
   - **`'answered'`:** `names` is an object. `pubkey` is `names[name]`, else `names[name.toLowerCase()]`, when that is
     64-hex; otherwise `null` (the domain answered, and lists no usable key for that name).

   `verifyNip05Identifier(x)` keeps its contract, implemented on the new function: the attested pubkey when
   `'answered'` with a pubkey, else `null`. Nothing about what is fetched, the guard, the timeout or `redirect:
   'manual'` changes.
2. **The endpoint answers a `status` too** (`handleNip05Verify`). It still sends `Cache-Control: no-store`.

   | Case | `status` | `verified` |
   |---|---|---|
   | `'answered'`, and the pubkey equals the requested one (case-insensitive) | `'verified'` | `true` |
   | `'malformed'`; or `'answered'` with no pubkey, or a different one | `'invalid'` | `false` |
   | `'unreachable'`; a missing or non-64-hex `pubkey` parameter; anything thrown | `'unchecked'` | `false` |

   The rule: `verified === (status === 'verified')`. `useNip05Verification` and every existing reader are unaffected.
3. **The view-model** (`ui/src/pages/assistants/myAssistants.js`), pure and Node-testable:
   - **`nip05StatusOf(answer)`:** an answer's `status` when it is one of the three, else `'unchecked'`. A missing
     answer, a non-object, or an unknown status is never `'invalid'`.
   - **`profilePath(pubkey)`:** `/user/${pubkey}`.
   - **`cardFields` gains `nip05Id`:** the profile's NIP-05 text, or `null` when it has none. The shown `nip05` keeps
     its `'—'` placeholder. A status is checked only when `nip05Id` is set.
   - **`COPY`:** § Copy's strings, plus the link's accessible name (sub-decision 5).
4. **The page asks and shows** (`ui/src/pages/assistants/Nip05Status.jsx`, new):
   - **The hook,** `useNip05Status(pubkey, nip05Id)`, returns `null` with no NIP-05, `'checking'` until an answer,
     then `nip05StatusOf(...)`.
     - It GETs `/api/nip05/verify`.
     - A failed request or a non-2xx is `'unchecked'`.
     - It keeps a module-level cache keyed `${pubkey}|${nip05Id}` for `'verified'` and `'invalid'` only, so an
       `'unchecked'` is retried by the next mount, and a page refresh after a press doesn't refetch.
     - In-flight requests for the same key are shared.
   - **The component,** `<Nip05Status pubkey nip05Id />`, renders nothing for `null`. Otherwise it renders one inline
     element after the NIP-05 value:
     - its text is § Copy's word, with "✓" for Verified;
     - a marker class per state (`is-verified`, `is-invalid`, `is-unchecked`, `is-checking`), so states are told
       apart by text, not colour alone;
     - § Copy's explanation as its `title`.

     It's text, not a control, so it may sit inside a row's toggle button (AC-3, AC-6).
   - **Where:** the row's NIP-05 field (`AssistantRow.jsx`), after the value, for every row including the Local one;
     and the not-tagged section's NIP-05, in its "URL · NIP-05" line (`MapOnlySection.jsx`). Not the search results
     (story § Out of scope).
5. **The profile link** (`ui/src/pages/assistants/ProfileLink.jsx`, new):
   - **The element:** `<a href={profilePath(pubkey)} target="_blank" rel="noopener noreferrer">`, visible "View
     profile" plus an `aria-hidden` "↗".
   - **The accessible name, through `aria-label`:** "View profile of {name} (opens in a new tab)".

     **This changes § Copy's "View {name}’s profile (opens in a new tab)".** The owner accepted the change at the ADR
     gate (2026-10-01), along with two readings of the story's AC-1: a 404 or other non-listing answer reads Couldn't
     check, and so does a domain behind a redirect.
     Speech-input users say what they see, so a link's accessible name should contain its visible words ("label in
     name"). "View {name}’s profile" breaks the visible "View profile" in two.
   - **It's a plain `<a>`,** not a router `Link`: it opens a new tab, so client-side routing adds nothing.
   - **Where, always outside any toggle:**
     - an open row's panel actions, beside Manage on Treasure Map (`AssistantRow.jsx`), for every row;
     - each not-tagged item's actions, before its Tag buttons (`MapOnlySection.jsx`);
     - each Assistant line of an open duty (`DutiesTab.jsx`), so the Preferred and every Alternate each get one.

     Since none sits in a toggle, pressing one can't open or close a row (AC-6).
6. **Styles** (`ui/src/styles.css`): the status as a small inline label beside the NIP-05:
   - Verified in the On-Treasure-Map green (`#047857`);
   - Not valid in the page's warning amber (`#92400e`);
   - Couldn't check and Checking… in the faint grey.

   The link uses the Duties tab's link style. Nothing changes width at 375 px (story 1's A9; story 3's M9).

## Consequences

- **What it enables:**
  - a NIP-05 that doesn't match its domain is visible on the page, as Not valid;
  - a domain that can't be read is visible as Couldn't check, including domains behind a redirect (the redirect
    row), which today just show no mark.
- **What it constrains:**
  - `lookupNip05` becomes the one place that says what a NIP-05 lookup found. A later story that makes the profile
    pages three-state, or folds the Meili and admin copies into it, starts there;
  - the endpoint's response gains a field, which clients must ignore if they don't use it. All current ones do.
- **Debt and follow-ups:**
  - The page makes one lookup per distinct NIP-05 per page load, with no server-side caching. With no rate limiting
    anywhere (`2026-09-20-public-endpoints-have-no-rate-limiting`), nothing new is opened, but nothing is bounded
    either.
  - The other two copies of the check still answer a boolean.
- **Firmware reinstall required?** No.

## Implementation notes

- **`src/api/nip05.js`:** `lookupNip05` (sub-decision 1), `verifyNip05Identifier` on top of it, and `handleNip05Verify`
  adding `status` (sub-decision 2). Export `lookupNip05`. Keep `guardedFetch`, the timeout and the regexes as they
  are.
- **`src/api/openapi.yaml`:** `GET /api/nip05/verify` isn't documented there today. Add it, with `verified` and
  `status`.
- **`ui/src/pages/assistants/myAssistants.js`:** `nip05StatusOf`, `profilePath`, `nip05Id` on cards, and the `COPY`
  strings.
- **`ui/src/pages/assistants/Nip05Status.jsx` and `ProfileLink.jsx`** (new), wired into `AssistantRow.jsx`,
  `MapOnlySection.jsx` and `DutiesTab.jsx`. Neither file holds a 64-hex literal.
- **`ui/src/styles.css`:** the status label and the link.
- **For the Tester:**
  - **Node:**
    - `lookupNip05` and `handleNip05Verify` against a stubbed fetch, one case per row of sub-decision 2's table:
      - malformed;
      - a refused host;
      - a 3xx, a 404 and a 500;
      - a thrown fetch, and a timeout;
      - a non-JSON body;
      - `names` missing, and `names` not an object;
      - the name absent, a non-hex value, a different key, the same key in another case, and the lowercase-name
        fallback;
      - a bad `pubkey` parameter.
    - The rule `verified === (status === 'verified')`. `verifyNip05Identifier`'s contract is unchanged.
    - The view-model: `nip05StatusOf` on good and bad answers (never `'invalid'` from a failure), `profilePath`, and
      `nip05Id`.
    - No 64-hex literal in the new files.
    - `test/nip05-ssrf-guard.test.js` must still pass unchanged.
  - **Browser:** `/api/nip05/verify` mocked per NIP-05.
    - The three states, plus Checking… while an answer is held (sampled: no verdict while held).
    - **A failed request (500, or a network abort) shows Couldn't check, never Not valid.**
    - The list and the not-tagged section; no status with no NIP-05; none in the search results.
    - Profile links in the three places: `href`, `target="_blank"`, `rel`, and the accessible name. A link in an open
      duty for each Alternate.
    - Pressing a link leaves `aria-expanded` unchanged.
    - 375 px.
    - One request per distinct NIP-05 across a refresh.

## Out of scope

- The profile pages' own NIP-05 mark, and the Meili and admin copies of the check.
- Following redirects, closing DNS rebinding, and rate limiting: the three open rows above.
- A server-side cache of lookups.

## Amendment 1 (2026-10-01, after review 1): a status belongs to the NIP-05 it was checked for; how often the page asks

**Why.** Review 1 (`engineering-team/reviews/done/my-assistants/4-nip05-validity-and-profile-links.md`) found:
- **NB1:** a status shown can belong to the previous NIP-05 for one render. When a drawn row's NIP-05 changes (a
  refresh re-reads profiles), the row shows its old verdict beside the new identifier, or beside "—", until the effect
  runs. That's a verdict the page doesn't have, which AC-1 and AC-2 forbid.
- **NB2:** the Context and Consequences each say "one lookup per distinct (profile, NIP-05) per page load", while
  sub-decision 4 keeps re-asking an unchecked answer. The owner chose at review 1's gate (2026-10-01) to fix both
  before shipping.

**Sub-decision 4, made exact.** A status is keyed to the (pubkey, NIP-05) it was asked for. When drawn for a pair, it
shows:
- that pair's kept answer, if any;
- otherwise "Checking…";
- with no NIP-05, nothing.

It never shows an answer for another pair, not even for one render.

**How often the page asks, stated exactly** (this replaces the Context's and Consequences' "one lookup per distinct
(profile, NIP-05) per page load"):
- **A definite answer (verified, invalid):** once per page load.
- **Couldn't check:** asked again each time the status is drawn again, for example after a tab round trip, but not
  on a refresh that keeps it drawn. A domain that was down can then come back.
- **Requests in flight** for the same pair are shared, so there is never more than one per pair at a time.

**NB3.** The rebinding row's "never returned to the caller" now has an exception: `status` says whether the fetched
URL served a NIP-05 listing. With `https:` and certificate validation, a rebind still learns nothing about an internal
service. The row now says so.

**Tests.**
- N7 records every DOM state while a drawn row's NIP-05 changes, in the list and in the section. It fails on any
  verdict beside a NIP-05 not yet checked, or beside "—".
- N6 pins the retry: a Couldn't check is asked once on load, not on the refresh, and once more after a tab round trip.
