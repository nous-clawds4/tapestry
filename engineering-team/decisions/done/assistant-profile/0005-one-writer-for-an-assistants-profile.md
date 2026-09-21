# ADR 0005: One writer — only `publish-profile` signs an assistant's profile, for the signed-in person's own assistant, from the fields they publish

**Status:** Accepted
**Date:** 2026-09-21
**Story:** `engineering-team/stories/done/assistant-profile/5-one-writer-for-assistant-profiles.md`

## Context

The story retires every way to write an assistant's kind 0 except the My Assistant page's publish. In short:

- **AC1.** The dashboard offers no way to write the assistant's profile. Its only assistant action leads to the
  My Assistant page.
- **AC2.** The legacy NIP-85 and customer pages no longer publish one. Where they showed the assistant panel,
  they show at most its read-only status and a link to the page.
- **AC3.** Any request to sign an assistant kind 0 other than the page's publish action — the generic
  sign-as-assistant endpoint included — is refused with an explanation, and no event is written anywhere.
- **AC4.** No route lets an Admin change the instance Tapestry Assistant's profile. They still manage their own
  assistant's.
- **AC5.** No existing published profile changes.

**Settled with the owner on 2026-09-21, before this ADR:**

1. `publish-profile` refuses a publish with no content. It also refuses a publish of anyone's assistant but the
   caller's own — the Owner's publishes included.
2. The in-container operator gets no route of their own. They publish from the page.
3. The status endpoint's key-holder disclosure (ledger `2026-09-21-status-reveals-assistant-key-holders`) stays
   out of this story and gets its own.
4. A TA-signed kind 5 through the generic signer stays with OPEN.md #269. This ADR names it as a known gap.

### Concept-graph orientation

- The local graph (TA `e00ed090…`) answers `/summaries` with 9 concepts. None of them models an assistant or
  its profile. ADRs 0003 and 0004 found the same on staging (`39998:8e901369…:nostr-user`, with class-thread
  wiring only).
- As the story says, no concept is touched. **No firmware reinstall.**

### Codebase facts this design rests on (verified on `47f32791`)

**The story's Background is partly out of date.** Stories 1 and 3 changed "🎲 Surprise me". It is now "✨ Use
the default profile", it is Owner-only, and it posts `publish-profile` with no content (ADR 0003
sub-decision 6). The writers today:

| Writer | Who can reach it | Whose assistant | Route |
|---|---|---|---|
| The My Assistant page (`ui/src/components/AssistantProfileEditor.jsx:238-262`) | anyone signed in who has an assistant | their own (`customerPubkey={user.pubkey}`) | `publish-profile`, with `content: form` |
| The dashboard's "✨ Use the default profile" (`ui/src/pages/Dashboard.jsx:29, :51-55, :752-770`) | the Owner (a UI gate) | their own: the TA | `publish-profile`, no content |
| The `/legacy/nip85.html` panel (`public/pages/nip85.html:69-112, :204-235`) | any session | the signed-in person's own (the `/api/auth/status` pubkey, `:156-164`) | `publish-profile`, no content |
| The `/legacy/customer.html` panel (`public/pages/customers/customer.html:126-170, :917-948`) | a signed-in person on the customers list (`:386-392`) | their own (`:1100-1136`) | `publish-profile`, no content |
| The generic signer (`src/api/strfry/commands/publishEvent.js:35-60`) | an Owner or Admin session (`isOwner` is owner-or-admin, `src/middleware/auth.js:276-293`), or the in-container operator (`req.localTrusted`) | always the TA (`getOwnerAssistantKeys()`, `:44`) | `POST /api/strfry/publish` with `signAs: 'assistant'`, any `kind` |
| The committed April build under `public/kg/` (`assets/index-DeRPuVlD.js`) | only a dev stack that bind-mounts the repo: `.dockerignore:14` keeps it out of images, and staging and production answer `/kg/` with the SPA shell (checked 2026-09-21) | the TA | the generic signer, `kind: 0` — the original robohash "Surprise me" |

**Whose assistant.** Every in-app writer sends the signed-in person's own pubkey. Only the API lets the Owner
publish someone else's assistant (`src/api/assistant/index.js:189-195`).

**The surviving writer.** `createPublishProfileHandler` (`index.js:178-322`) is ADR 0002's seam.

- It authorizes `sessionPubkey === customerPubkey || sessionPubkey === ownerPubkey`. It reads
  `req.session.pubkey` without checking `authenticated` (`:192-195`); the status handler does check it
  (`:373-374`).
- When `content` is absent, it builds the one default (`:229-235`, ADR 0003). `hasUserContent` is
  `Boolean(content && typeof content === 'object')`, so an array counts as content.
- Then it finishes the profile, signs it, writes it to the local relay first, maps the NIP-05, sends it to the
  publish relays and reports each one (`:237-315`, ADRs 0002 and 0003).

**The in-container operator cannot use it today.**

- An in-container call carries no session.
- An unset owner reads as `null` (`getConfigFromFile`'s default, `src/utils/config.js:16`), so the check
  still refuses it: `undefined !== null`.
- Its only route to an assistant kind 0 is the generic signer.

**The generic signer signs `event.kind` as given** (`publishEvent.js:52-59`), and writes to the local relay
only (`:84-102`).

- Checked with the installed nostr-tools: `finalizeEvent` throws for a kind that is not a number (`"0"` and
  `null` give "can't serialize event with wrong or missing properties").
- `-0` and `0.0` are signed as `0`.
- So `event.kind === 0` is exactly "this would be signed as a kind 0".

**No other server signer can reach kind 0.** `src/` has 67 signing call sites (`signAndFinalize(` or
`finalizeEvent(`). Apart from the two above:

- normalize's callers fix `39998` or `39999`, or map a graph node's kind with `node.kind || 39999`
  (`src/api/normalize/index.js:4538`), which turns `0` into `39999`;
- trusted lists accept only `30392`–`30395` (`src/api/trustedList/index.js:119`);
- the NIP-85 publishers sign `30382`;
- dlist-curation signs its header, its curation copies, and the deletions of those copies;
- firmware install re-signs `39998` headers;
- `bDisposition` takes the kind from its handle, but only re-signs an existing TA event with a matching `d` tag
  (`src/api/concept/bDisposition.js:104-134`). No assistant kind 0 carries a `d` tag, and after this story
  nothing can mint one.

**Neither kind-5 site in the app signs as the TA.** `ui/src/hooks/useProfileTags.js:154` and
`ui/src/utils/publishTagPin.js:409` both sign with NIP-07.

**The page's publish** always sends `{ customerPubkey, content: form }` (`AssistantProfileEditor.jsx:243-247`).
"Reset to defaults" fills the form from `status.defaults` (`:211-218`), the one definition the status handler
builds (`index.js:422-423`).

**The dashboard hook's `refresh`** has one caller, `handleUseDefaultProfile` (`Dashboard.jsx:728, :763`).

**The legacy panels** read `/api/assistant/status?customerPubkey=‹signed-in›` (`nip85.html:164`,
`customer.html:872`) without `defaults=0`. So each load waits for the person's-name lookup, whose answer they
never read (ADR 0003 sub-decision 4).

**Existing tests assert today's writers by value.** I grepped `test/` and `tests/` for every literal this ADR
removes or changes (the method in ledger `2026-09-21-adr-reaim-list-misses-outcome-asserts`). The hits are
listed under "Test-file changes".

### Constraints

- **Principle 1 — whose assistant.** The server enforces what the epic decided: everyone publishes their own
  assistant, and the Owner's is the TA (epic decision 4).
- **Principle 2 — publication stays permissionless.** This story limits what the server *signs with keys it
  holds*, not what it accepts. The generic endpoint's client path keeps accepting any validly signed event.
- **Principle 4 — nothing removes local state.** No refusal deletes anything, and no profile is republished
  (AC5).
- No new dependencies or tooling (CLAUDE.md), and no concept changes.
- **Verification is stack-free.** `:7778` serves the main checkout. Both server changes sit behind seams the
  suites already drive: `createPublishProfileHandler`, and `handlePublishEvent` through
  `test/default-deny-mutations.test.js:70-76`.

## Options considered

### Option A — Close the two server doors, and retire the in-app writers

- The generic signer refuses kind 0 before it reads a key.
- `publish-profile` accepts exactly the page's contract: a signed-in person, their own assistant, and the
  profile's fields as `content`.
- The dashboard's button goes. The legacy panels become read-only, with a link to `/assistant`.

**Pros**

- AC3 and AC4 hold at the server, for every caller: a browser tab left open, a script, the stale `/kg/` build,
  an Admin.
- One rule per door, each testable through a seam that already exists.
- Neither the page nor the machinery of stories 1–4 changes.

**Cons**

- A script holding a person's own session can still publish that person's assistant's profile. The server
  cannot tell it from the page (Option B), so this ADR defines the page's action as a contract.
- ADR 0003's "no content means the default" goes.

### Option B — Bind the publish to the page itself

The page would fetch a one-time publish token from `/status` and send it back with the publish. Or the server
would check the request's `Origin`.

**Rejected, because**

- A script holding the person's session can fetch the token too, and can send any `Origin` it likes. Neither
  tells the page from a script any better than the session does.
- A token is state to issue, store and expire on every publish, and a second thing to test.
- A token would stop exactly one thing the session cannot: another site driving the person's browser. That
  risk is app-wide, not this endpoint's. The session cookie sets no `sameSite`, and CORS reflects any origin
  with credentials (`bin/control-panel.js:114-117, :195-204`). That posture is OPEN.md #326.

### Option C — One signing chokepoint for every assistant key

Every server signature made with an assistant's key would go through one `signAsAssistant(template, purpose)`,
which refuses kind 0 unless the purpose is the profile.

**Pros**

- No future signer could mint a kind 0, by construction.

**Rejected, because**

- It changes more than sixty signing call sites across normalize, bDisposition, trusted lists, dlist-curation,
  firmware install and the NIP-85 publishers. None of them can reach kind 0 today.
- It re-opens code that other books have just pinned, when this story's gap is two doors.

## Decision

We chose **Option A.**

AC3 and AC4 are statements about requests, so the server must hold them. The in-app changes (AC1, AC2) take
away the callers that would otherwise start failing. Only two doors can sign an assistant kind 0, and two small
rules close them. Option C gives a real guarantee, but for today's code it is the same guarantee at many times
the diff.

### Sub-decisions

**1. The page's publish action is a server contract.**

It is `POST /api/assistant/publish-profile`, from a signed-in session, for that session's own assistant, with
the profile's fields as a `content` object. That is exactly what the page sends.

- A script that sends the same request with its person's own session *is* that person publishing their own
  assistant's profile. The server cannot tell it from the page and does not try (Option B).
- Such a publish still passes the same finishing step (ADR 0003), the same relay fan-out and the same
  per-relay report (ADR 0002).
- Anything else is refused before anything is signed.

**2. `publish-profile` refuses two departures from the contract (settled 2026-09-21).**

Both checks run in this order, after the `customerPubkey` check (`index.js:185-187`, unchanged). So a refusal
touches no key, no relay and no settings.

| Check | Refused when | Answer |
|---|---|---|
| **Whose** | there is no authenticated session, or `session.pubkey !== customerPubkey` | **403** `{ success: false, code: 'not-your-assistant', error }` |
| **What** | `content` is missing, `null`, not an object, or an array | **400** `{ success: false, code: 'no-content', error }` |

- **Whose** reads the session the way the status handler does: `req.session.authenticated ? req.session.pubkey
  : null`. It refuses:
  - a stranger (as today);
  - the Owner publishing someone else's assistant (new);
  - an Admin publishing the TA (as today);
  - an in-container call with no session (as today).
- **What** accepts an empty object. A person may clear every field, and the finishing step still applies.
- The words:
  - `not-your-assistant`: "An assistant's profile can be published only by the person it belongs to, signed
    in, on the My Assistant page (/assistant)."
  - `no-content`: "Nothing was published: the request carried no profile. Edit and publish your assistant's
    profile on the My Assistant page (/assistant). Its "Reset to defaults" fills in the default profile."
- After the checks, the handler publishes `sanitizeProfileContent(content)`. It no longer builds a default.
  - It looks up the person's name only on a public instance, for the NIP-05.
  - Everything after that is unchanged: the finishing step, the local write first, the NIP-05 mapping, the
    fan-out and the report.
- **This partly supersedes ADR 0003.** It removes "content omitted → the one default" (steps 3–4 of ADR 0003's
  publish-handler notes) and sub-decision 6 (the dashboard's button).
  - The one definition itself is untouched. `/status` still offers it as `defaults`, and "Reset to defaults"
    still puts it into the form.
- ADR 0002's `publishSubject` keeps its "someone else's assistant" wording as a pure function, which story 2's
  M1 pins. The handler can no longer reach that case.

**3. The generic signer never signs a kind 0.**

- The check goes first in `handlePublishEvent`'s `signAs === 'assistant'` branch, before the owner gate and
  before any key is read: `if (event.kind === 0)` → **403** `{ success: false, code: 'one-writer', error }`.
- The words: "This endpoint does not sign kind 0 profiles. An assistant's profile is published only on the My
  Assistant page (/assistant)."
- **First, for everyone.** The refusal does not depend on who is asking, so every caller learns where profiles
  are published. The owner gate still answers every other kind as it does today.
- **`=== 0` covers every case.** Only a number can be signed, and every number that serializes as 0 is `=== 0`
  (see "Codebase facts").
- It closes the Owner's route, an Admin's (AC4), the in-container operator's, and the stale `/kg/` build's.
- **The client path is unchanged.** It signs nothing. An assistant kind 0 that arrives there already signed is
  a letter this instance signed itself, and the local relay keeps the newest profile.

**4. The dashboard offers no way to write (AC1).**

- `WelcomeCard` loses "✨ Use the default profile", `canUseDefault`, the `onUseDefault` prop and the comment
  about them. It keeps "🎨 Set up my Assistant's profile", which leads to `/assistant`.
- `handleUseDefaultProfile` goes, and the hook call reads only `status`.
  - The hook keeps `refresh`, as ADR 0001's contract; nothing calls it any more.
- Both remaining assistant actions lead to `/assistant`: the prompt's button and the checklist item.
  - The prompt stays a `<button>` that navigates, because story 1's specs find it by role.

**5. The legacy panels become read-only, with a link (AC2).** In both `nip85.html` and `customer.html`:

- **Remove** the publish button, its status line, the publish function, and the loader's line that relabels
  the button "Re-publish Kind 0 Profile".
- **Keep** the read-only status: the pubkey and its copy button, the profile link, "Profile Status", the preview
  and the no-key message.
- **Add** a link that shows in every state of the panel:
  `<a href="/assistant">🤖 Edit and publish its profile on the My Assistant page →</a>`.
- **Reword** the panel's own copy.
  - The intro's "Give it a profile so other users can see who it represents." becomes "Its profile is edited
    and published on the My Assistant page."
  - Within the panel (its heading, intro, loading line and no-key line), "Brainstorm Assistant" becomes
    "Tapestry Assistant", the name the page uses.
  - The rest of each page is untouched.
- **Ask with `&defaults=0`.** The panels never read the defaults, so they skip the name lookup, as the
  dashboard's check does.

**6. The in-container operator has no route (settled 2026-09-21).** They sign in and publish from the page.

- Nothing in the repo publishes an assistant kind 0 from the container: not setup, not firmware install, not
  any cron.
- A shell in the container already holds every key. An API route would add surface, not capability.
- If a headless need comes up, a `localTrusted` path through `publish-profile` would get stories 2 and 3 for
  free, because both live in the handler. It would need its own rule for whose assistant it publishes: the TA
  only.

**7. The carry-forwards this ADR folds in.**

- **Ledger `2026-09-21-my-assistant-comment-nits`: both items.**
  - `ui/src/styles.css:802-805`: the example of a disabled row becomes "e.g. My Assistant's Profile for someone
    with no assistant and no way to create one here".
  - The provision handler's comment (`index.js:453-464`) gains a line naming `mayCreateAssistant`
    (`ui/src/config/avatarMenuLinks.js`) as the rule for what the page offers, which leaves out the Owner.
    ADR 0004's "each one's comment names the other" then holds. This ADR edits the file anyway.
- **Ledger `2026-09-21-my-assistant-checks-browser-only`** belongs to Phase 3 (see "Test-file changes").
- **Ledger `2026-09-21-assistant-api-review-tidy-ups`, item (b): not folded.** This ADR does not touch
  `profileDefaults.js`, so the row stays open for (b).
- **Ledger `2026-09-21-status-reveals-assistant-key-holders`: not folded** (settled 2026-09-21).
  - The row says "The legacy pages go away in story 5". That stops being true: the panels stay, as read-only
    readers that ask only about the signed-in person.
  - The bookkeeping adds a dated note to the row saying so.

**8. BIBLE names the one writer.**

- Its API table row for `POST /api/strfry/publish` (`BIBLE.md:495`) adds: "`signAs: "assistant"` never signs a
  kind 0 (403, `code: "one-writer"`)".
- § Assistant Keys gains one bullet. An assistant's kind 0 has one writer: `POST /api/assistant/publish-profile`,
  for the signed-in person's own assistant, with its fields as `content`.
- Its "Last updated" line is bumped, as usual.

**What we trade away**

- The Owner can no longer publish a Customer's assistant profile, for example to repair a NIP-05 that stopped
  verifying. The Customer republishes it from their own page.
- A script, or a browser tab left open, that posted no content now gets a refusal instead of the default.
- A script holding a person's own session still publishes that person's assistant's profile — through every
  step the page's publish takes.

## Consequences

**Enables**

- AC1–AC5.
- The book's last acceptance bullet: "nothing else can write an assistant's kind 0".
- A one-line answer in BIBLE to "why was my kind 0 refused?".

**API contract changes**

- `publish-profile`: `content` is required, and `customerPubkey` must be the signed-in caller. Each new refusal
  carries a `code`.
- `/api/strfry/publish`: `signAs: 'assistant'` with `kind: 0` → 403, code `one-writer`. Every other kind is
  unchanged, and so is the client path.

**Supersedes, in part**

- ADR 0003: its no-content contract and sub-decision 6. ADR 0003 stays unedited as history, as ADR 0003 itself
  left ta-avatar's ADRs.
- ADR 0001's follow-up "story 5 removes it" (the dashboard's one-click publish) is done.

**Known gaps, named on purpose**

- **A TA-signed kind 5** through the generic signer, sent by the Owner or an Admin, can delete the TA's kind 0
  from the local relay.
  - The relays keep the profile. The setup check still finds it there, and the page's next publish replaces
    it.
  - What the generic signer may mint as the TA is OPEN.md #269 (settled 2026-09-21).
- **A replayed letter.** The client path accepts an assistant kind 0 that this instance signed earlier.
  - The local relay keeps the newest, so a replay changes nothing while the current profile is there.
  - After the local relay is wiped, the first letter to arrive wins until the next publish. Story 1's
    copy-home brings back the newest one.
- **Admins and the TA's other kinds** — OPEN.md #269.
- **Cross-site requests** — OPEN.md #326.
- **`public/kg/`** — OPEN.md #68.
- **The status disclosure** — ledger `2026-09-21-status-reveals-assistant-key-holders`, in its own story.

**Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

### Changed — `src/api/strfry/commands/publishEvent.js`

- Add a module constant for the refusal's words.
- At the top of the `signAs === 'assistant'` branch (`:35`), before the owner gate:
  ```js
  if (event.kind === 0) {
    return res.status(403).json({ success: false, code: 'one-writer', error: ASSISTANT_PROFILE_REFUSAL });
  }
  ```
- The header comment (`:1-7`) and the branch comment (`:36-39`) state the rule and cite ADR
  assistant-profile/0005.
- Add no new `require`. The owner gate, `req.localTrusted` and its 403 stay as they are, so the suite's S
  sentinel still holds.

### Changed — `src/api/assistant/index.js`

**The two refusal messages** are module constants near `PROFILE_FIELDS` (`:42`). Put them there, not between
the factory and its export: story 1's source check reads `handlePublishProfile` up to the next top-level
declaration.

**The comments.** The module header (`:15-18`) and the handler's doc comment (`:141-158`) say that `content` is
required and that only the signed-in person's own assistant is published. Remove their mentions of the legacy
pages and the dashboard's button.

**`createPublishProfileHandler`.** Inside `handlePublishProfile`, replace `:189-195` with:

```js
const sessionPubkey = (req.session && req.session.authenticated) ? req.session.pubkey : null;
if (!sessionPubkey || sessionPubkey !== customerPubkey) {
  return res.status(403).json({ success: false, code: 'not-your-assistant', error: NOT_YOUR_ASSISTANT });
}
if (content === null || typeof content !== 'object' || Array.isArray(content)) {
  return res.status(400).json({ success: false, code: 'no-content', error: NO_CONTENT });
}
```

- Then compute `ownerPubkey` and `isOwner` as today. `isOwner` now means "the Owner is publishing the TA".
  Call `publishSubject` as today.
- Step 2 (`:224-235`) becomes:
  - `personName = instance.isPublic ? await d.getPersonName(customerPubkey, { allowRelayLookup: true }) : ''`;
  - `draft = sanitizeProfileContent(content)`.
  - Remove `hasUserContent` and the default branch, and reword the step's comment.
- Everything from the finishing step on (`:237-315`) is unchanged. That includes the literal
  `getAssistantPublishRelays(` that story 2's S3 and story 1's source check read.

**The export comment** (`:524-526`) calls `buildDefaultProfileContent` "the one default the editor is offered";
no content-less publish signs it any more. The export stays, for story 3's D6 and the ta-avatar suite.

**`handleProvisionAssistantKey`'s comment** (`:453-464`) gains the `mayCreateAssistant` line (sub-decision 7).

`buildDefaultProfile` stays imported, because the status handler uses it.

### Changed — `ui/src/pages/Dashboard.jsx`

- `WelcomeCard({ onSetupProfile })` (`:24-61`): remove `canUseDefault`, the button and its comment. Its
  `useAuth()` call then has nothing to read, so drop it.
- Remove `handleUseDefaultProfile` (`:752-770`) and the `onUseDefault` prop (`:781`).
- `:728` becomes `const { status: assistantStatus } = useAssistantSetupState();`.

### Changed — `public/pages/nip85.html` and `public/pages/customers/customer.html`

Apply sub-decision 5 here:

- **`nip85.html`:** the panel `:69-112`; the loader `:153-202` (the request at `:164`, the sign-in line at
  `:160`, the relabel at `:195`); the publish function `:204-235`.
- **`customer.html`:** the panel `:126-170`; the loader `:869-915` (the request at `:872`, the relabel at
  `:908`); the publish function `:917-948`.

Neither page may keep a `publish-profile` call.

### Changed — `ui/src/styles.css:802-805` and `BIBLE.md`

Apply sub-decisions 7 and 8. Both are comments and docs only.

### Bookkeeping (Phases 4 and 5)

- Close ledger `2026-09-21-my-assistant-comment-nits` once both of its items land.
- Add the dated note to ledger `2026-09-21-status-reveals-assistant-key-holders` (sub-decision 7).

### Unchanged, deliberately

- `profileDefaults.js`, `profileState.js`, `profilePublish.js` (including `publishSubject`), `roster.js` and
  `avatar.js`.
- The status handler, the setup hook, the editor, the page and the route table.
- `src/middleware/auth.js`: `isOwner` stays owner-or-admin (OPEN.md #269).
- `public/kg/` (OPEN.md #68): the signer's refusal covers it.

### Test-file changes this ADR requires (Phase 3, the Tester's lane)

I found these by grepping `test/` and `tests/` for every literal this ADR removes or changes, not only in the
suites of the files it edits: "Use the default profile", the dashboard's and the legacy pages' `publish-profile`
calls, publishes with no content, the Owner publishing a Customer's assistant, and `signAs: 'assistant'` with
kind 0.

**Re-aim**

- **`test/one-default-assistant-profile.test.js` (story 3):**
  - **E1, E3, E5 and E6** publish with no content. Each should publish, as `content`, the `defaults` that the
    status would offer: `buildDefaultProfile(...)` for the same person and instance. That is what "Reset to
    defaults" followed by Publish sends. The signed results they assert do not change, because the finishing
    step drops the empty fields and sets the NIP-05 either way.
  - **E7** ("the one definition cannot be swapped out through the seam") moves to where the default now
    lives. An injected `buildDefaultProfileContent` on `createAssistantStatusHandler` must leave `defaults`
    exactly the table.
  - **E8** (the Owner publishing a Customer's default) → 403 `not-your-assistant`. Nothing is signed, imported,
    mapped or sent.
  - **W2**'s last assertion (the dashboard posts `publish-profile`) → the dashboard posts nothing to
    `/api/assistant/`. Keep its three "no second definition" checks.
  - **R1** (the legacy pages post with no content; "story 5 retires these pages; update this guard then") →
    neither page posts `publish-profile`, and each links to `/assistant`.
- **`test/assistant-publish-relays.test.js` (story 2):**
  - **E5**'s third leg (`CUSTOMER`'s assistant, published by `OWNER`) → 403 `not-your-assistant`. Its Owner and
    Customer legs stay, and M1 still pins `publishSubject`'s wording.
  - **E7** (a no-content publish answers success) → 400 `no-content`, with nothing saved or sent.
- **`tests/brainstorm/assistant-default-profile.spec.js`:**
  - **B0**'s bundle marker is the "Use the default profile" label, which leaves the bundle. Use a string that
    story 3's code keeps there, such as the editor's "NIP-05: none — this instance has no public web address".
  - **B1** → the Owner's prompt offers no one-click publish, and the dashboard posts nothing to
    `publish-profile` or to `/api/strfry/publish`.
- **`tests/brainstorm/assistant-setup-prompt.spec.js`:**
  - **B5** (the Owner is offered "Use the default profile" "until story 5 retires it") → the Owner is not.
  - **B3** passes as it is. The phrase "stays Owner-only" in its message can be reworded.

**Should pass unchanged — confirm, don't edit**

- `test/default-deny-mutations.test.js` AC3 and S, and `test/publish-event-signature-verification.test.js`.
- `test/assistant-setup-state.test.js` D1–D7, and its source check on `handlePublishProfile`.
- Story 3's D6, E2, E4 and Q-class, and story 2's other E-cases. All of them publish their own assistant, with
  content.
- `test/my-assistant-page.test.js`. Its E1's 400 comes from the unchanged first check.
- `test/recognizable-published-ta-profile.test.js`.

**Carry-forward — ledger `2026-09-21-my-assistant-checks-browser-only`**

- Four W-cases, the CI-run counterparts of story 4's B1, B11, B12 and B16, as the row's fix shape lists them.
- Reword line 24 of `engineering-team/stories/done/assistant-profile/4-my-assistant-page.test-plan.md`.

**A new suite** registers as one line in `test/registry.js`.

### Testability note (not a test plan)

**The generic signer**, stack-free, through `handlePublishEvent` (the `callPublish` pattern):

- A kind 0 with `signAs: 'assistant'` → 403 `one-writer`, for an anonymous caller, an authenticated session and
  `localTrusted` alike. The body carries no `event`.
- A kind 1 with `localTrusted` gets past the refusal, so the refusal is specific to kind 0. In a bare checkout it
  then fails on the missing key, which is fine for this test.
- A kind of `"0"` is never signed as a kind 0.

**`publish-profile`**, through its seam:

- no content, `null`, a string or an array → 400 `no-content`, and no dependency is called;
- `{}` → published, as an emptied and finished profile;
- the Owner for a Customer, an Admin for the TA, a stranger, no session, and a session that has a `pubkey` but
  is not `authenticated` → 403 `not-your-assistant`, and no dependency is called;
- someone else's assistant with no content → 403, because "whose" is checked before "what".

**Source (the W-class):**

- `Dashboard.jsx` has no `publish-profile`, no "Use the default profile" and no `onUseDefault`.
- Neither legacy page has `publish-profile`. Each links to `/assistant`, and each status request carries
  `defaults=0`.

**The browser.** `vite preview` serves `dist/`, not `/legacy/`. A B-case for a legacy page would serve the HTML
from the worktree's file through `page.route`, and mock `/api/auth/status` and `/api/assistant/status`. For
static HTML the W-class alone is enough. The dashboard's B-cases run against the worktree build as before.

**Live.** After the staging deploy, run passive checks only: the served bundle no longer contains "Use the
default profile", and neither `/legacy/nip85.html` nor `/legacy/customer.html` contains `publish-profile`.

## Out of scope

- What the generic signer may mint as the TA: other kinds (a kind 5 included) and the Admin gate. OPEN.md #269.
- The status endpoint's key-holder disclosure, which gets its own story (the ledger row).
- The session cookie and cross-origin posture: OPEN.md #326.
- Removing the legacy pages, or `public/kg/` (OPEN.md #68).
- An operator route (sub-decision 6).
- The name memo (ledger item (b)).
- Republishing any existing profile (AC5, and the epic's guardrail).
