# Build Audit: The assistant's profile — one page, one default, an honest setup check

**Book:** `engineering-team/audits/assistant-profile/book.md`
**Date:** 2026-09-21
**Branch / commit range:** `d886d98d..383f99e5` — the book opened in `a118119c` (planning PR #645) and ran as
five story branches: #650 → main #651 (story 1), #717 → #718 (story 2), #724 → #725 (story 3), #730 → #731
(story 4), and #733 (story 5, **on staging, not yet promoted** — promotion follows this close).
**Provenance:** Acceptance-frame *(no PRD; the owner's ask quoted verbatim in `book.md`, the frame confirmed when
the owner approved the stories on 2026-09-11, never amended)*
**Confidence:** high — the anchor was captured at planning with a measured survey of the feature as built
(epic § Survey), every story traces to a frame bullet, and stories 1–4 are observable in production and
story 5 on staging.

> The Build Audit is the as-built record. It does not propose changes — that is `prd-seed.md`'s job.

## 1. What shipped

- **An honest "set up your Assistant" prompt.** The dashboard asks about the *signed-in person's own* assistant,
  only once sign-in has resolved, and prompts only for a definite "no profile": none on this instance's relay
  and none on the relays profiles are published to. A profile found only on a relay is copied home. The
  `pubkeys=null` race that prompted every visitor on staging and production (2026-09-11) is gone —
  `stories/done/assistant-profile/1-setup-prompt-tells-the-truth.md`
- **Publishing that reaches the configured relays and reports each one.** The publish set is the instance's
  general-purpose, profile and WoT relay settings (editable on the Relays settings page, no restart);
  local-only publish mode keeps a profile on this instance; the answer lists every relay as accepted,
  refused, unreachable, timed out or skipped, within one 8-second deadline, and nothing goes outward if the
  local write fails — `stories/done/assistant-profile/2-publish-to-the-right-relays.md`
- **One default profile for every role** — the owner's table: "‹name›'s Tapestry Assistant" (or the npub form),
  the owner's two-paragraph about, the branded avatar always, and a website, NIP-05 and `["client", ‹domain›]`
  tag only on a public instance. Nothing the app supplies is ever loopback, private-network or relative —
  `stories/done/assistant-profile/3-one-default-assistant-profile.md`
- **One place: the My Assistant page at `/assistant`.** Every entry point leads there — both avatar menus'
  "My Assistant's Profile" and "Assistant Management", the dashboard prompt and checklist item, the
  assistant's profile-page banner, the Tapestry Settings tab (and its old URL), and the Brainstorm `/settings`
  card. An Admin or Customer with no assistant creates one there; everyone else is told why not —
  `stories/done/assistant-profile/4-my-assistant-page.md`
- **One writer.** Only the My Assistant page's publish can change an assistant's kind 0: the generic
  sign-as-assistant endpoint refuses kind 0 for everyone, `publish-profile` accepts only the signed-in person
  publishing their own assistant with the form's fields, the dashboard's one-click "Use the default profile" is
  gone, and the legacy NIP-85 and customer pages show read-only status with a link to `/assistant` —
  `stories/done/assistant-profile/5-one-writer-for-assistant-profiles.md`

## 2. Epics & stories rolled up

### Epic: `assistant-profile`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 setup-prompt-tells-the-truth | One setup answer (`/api/assistant/status`, local relay first then the publish relays, copy-home); the dashboard asks about the viewer's own assistant after sign-in resolves | Done | `reviews/done/assistant-profile/1-setup-prompt-tells-the-truth.md` — round 1 **CHANGES_REQUESTED** (a silent relay voided the relay fallback), round 2 PASS after ADR 0001 Amendment 1 |
| #2 publish-to-the-right-relays | Configured publish set, local-only mode, per-relay report with one deadline, local-first with `stage: 'local'` on failure | Done | `reviews/done/assistant-profile/2-publish-to-the-right-relays.md` — PASS |
| #3 one-default-assistant-profile | `profileDefaults.js`: the role-free default, the syntactic public-instance rule on ssrfGuard's classifiers, the person's name from local-then-profile relays, the finishing step every publish passes through | Done | `reviews/done/assistant-profile/3-one-default-assistant-profile.md` — PASS |
| #4 my-assistant-page | `/assistant`, every entry point repointed, `refreshUser`, role-aware editor (badge generator Owner-only, three no-key cases), machine-readable `no-picture` | Done | `reviews/done/assistant-profile/4-my-assistant-page.md` — PASS |
| #5 one-writer-for-assistant-profiles | Kind 0 refused by the generic signer; `publish-profile` takes only the page's contract; dashboard and legacy writers retired | Done | `reviews/done/assistant-profile/5-one-writer-for-assistant-profiles.md` — PASS (fresh reviewer agent) |

Five stories, five reviews in six rounds; one kick-back (story 1, round 1), whose blocking finding traced to a design step in
ADR 0001 that the implementation had followed faithfully — fixed by Amendment 1 and pinned by a stack-free test
through the real relay helper (U12). Stories 3–5 were reviewed by fresh reviewer agents at the owner's request.
Every review's non-blocking findings are either resolved in a later story, filed, or carried in §6.

## 3. As-built inventory

**User-facing.**

| Surface | What it is now |
|---|---|
| `/assistant` (`ui/src/pages/assistant/Index.jsx`) | The My Assistant page, Brainstorm look (`TopBar`), four states: checking sign-in · sign-in prompt · "no assistant here" explanation · the editor for `user.pubkey` |
| `AssistantProfileEditor.jsx` | Imported only by `/assistant`. Seven editable fields; NIP-05 read-only (or "none — … no NIP-05 is published" on a non-public instance); "Reset to defaults" fills the form from `status.defaults`; per-relay result rows; badge generator only when `status.isOwner`; "Create my Tapestry Assistant key" only when `canCreateAssistant` |
| Dashboard (`ui/src/pages/Dashboard.jsx`) | Welcome card only for a definite `needs-setup`; one action, "🎨 Set up my Assistant's profile" → `/assistant`; the checklist item likewise; no publish |
| Avatar menus (`ui/src/config/avatarMenuLinks.js`) | "My Assistant's Profile" enabled exactly when `hasMyAssistantPage(user)`; both it and "Assistant Management" → `MY_ASSISTANT_PATH` (`/assistant`) |
| `/tapestry/settings/assistant` | Redirects (`replace`) to `/assistant`; the Settings tab opens `/assistant` |
| Brainstorm `/settings` | A link card, "Your Tapestry Assistant" → "🤖 Open My Assistant" |
| `/tapestry/users/‹assistant›` banner | "Edit Assistant profile" → `/assistant` |
| `/legacy/nip85.html`, `/legacy/customer.html` | Read-only assistant panel (pubkey, profile status, preview) asked with `defaults=0`, and "🤖 Edit and publish its profile on the My Assistant page →" in every state; no publish |

**Server modules.** New: `src/api/assistant/profileState.js` (the setup resolver, per-relay reads against one
deadline, copy-home), `profilePublish.js` (publish set, per-relay publish, the words), `profileDefaults.js` (the
definition, the public-instance rule, the person's name, the finishing step). Changed: `src/api/assistant/index.js`
(two seams: `createPublishProfileHandler`, `createAssistantStatusHandler`), `src/api/strfry/commands/publishEvent.js`
(the kind-0 refusal), `src/api/publish-policy/index.js` (`isPublishLocalOnly()`), `src/api/assistant/avatar.js`
(`code: 'no-picture'`). Client: `ui/src/hooks/useAssistantSetupState.js` (new), `AuthContext.refreshUser` (new).

**Data & contracts.**

| Contract | As built |
|---|---|
| `GET /api/assistant/status?customerPubkey=‹hex›[&defaults=0]` | 400 unless a 64-hex string. `hasProfile` from the resolver (local, then the publish relays for the person, the Owner, an Admin or the in-container operator; anonymous callers local only), `profileSource`, `isOwner` (also on the no-key answer), `isPublicInstance`; unless `defaults=0`: `defaults` (the table) and `computedNip05` (public only). A GET that can copy a validly-signed profile home — a cache repair. |
| `POST /api/assistant/publish-profile` | The one writer. 403 `not-your-assistant` unless the authenticated session is `customerPubkey`; 400 `no-content` unless `content` is an object; then sanitize → finish (NIP-05 + client tag on a public instance) → sign → local write first (500, `stage: 'local'`, nothing outward on failure) → NIP-05 map (public only) → the configured relays within 8 s → `{ success, outcome: published\|kept-local\|not-delivered, localOnly, relays: { total, success, results: [{ relay, status, reason }] }, message, nip05 }` |
| `POST /api/strfry/publish` | `signAs: 'assistant'` + `kind: 0` → 403 `one-writer`, for every caller, before the owner gate and any key read. Every other kind and the client path unchanged |
| `GET /api/assistant/owner-avatar` | Its "no picture" 404 carries `code: 'no-picture'` |
| An assistant's kind 0 | Content per the table; `tags: [["client", ‹domain›]]` and a server-managed `nip05` on a public instance only |
| Configuration | Publish set = `aRelays.aPopularGeneralPurposeRelays ∪ aProfileRelays ∪ aWotRelays` (deduplicated, `ws(s)://` only); `BRAINSTORM_PUBLISH_LOCAL_ONLY=true` → empty set, every configured relay reported `skipped` |

**Domain:** none. No concept, handle, schema or firmware seed changed; no firmware reinstall (every ADR says so).
The kind 0 is a nostr event this instance signs, not a knowledge-graph node.

**Docs:** BIBLE §11 (the `/api/strfry/publish` row) and §14 Assistant Keys (the one writer). No BIBLE row for
`/api/assistant/status` (§6).

**Records filed during the book** (harness): the book, epic, five stories, five ADRs (0001 and 0003 amended), five
test plans, five reviews (six rounds); OPEN.md rows #269, #270, #272, #273, #274; ledger rows `…-assistant-api-review-tidy-ups`,
`…-status-no-key-relay-gate-unpinned`, `…-status-reveals-assistant-key-holders`, `…-my-assistant-checks-browser-only`,
`…-my-assistant-comment-nits`, `…-strfry-domain-env-not-read`, `…-match-head-commit-needs-full-sha`,
`…-adr-reaim-list-misses-outcome-asserts`, `…-r3-sentinels-miss-owner-gate-403`,
`…-assistant-profile-ac5-postdeploy-check` (all `2026-09-21-`); closed rows #148 and #154.

## 4. Deviations from intent

The anchor is the book's acceptance frame and the owner's ask it quotes. Harvested from the ADRs' Consequences,
the stories' Out of scope / Open questions / Deviations, and the six review rounds; reconciled against the diff.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | The ask: "the logged-in user, whether Owner, Admin, or Customer, can manage the kind 0 profile of the Tapestry Assistant" | Each person manages **their own** assistant; the Owner's is the instance TA. Admins lost their route to the TA's profile (the old "Surprise me"), and the Owner can no longer publish a Customer's assistant | intentional-change | Epic decision 4 (confirmed at approval); owner-settled before ADR 0005 | A Customer's stale profile (e.g. prod's `@brainstorm.world` NIP-05) is fixed only when that Customer republishes | §6 #6 |
| 2 | Frame 1: "one place — a dedicated My Assistant page" | `/assistant`, Brainstorm look; "Assistant Management" (added by #722 before the page existed) and "My Assistant's Profile" both lead there | interpretation | Route settled with the owner 2026-09-21 (ADR 0004 Context) | Two menu items, one page | — |
| 3 | Frame 1: "every entry point leads there" | The Tapestry Settings tab stays in the tab bar and navigates away; its old URL redirects; `/settings` becomes a link card; the editor has one host | interpretation | ADR 0004 sub-decision 3 | Old bookmarks keep working | — |
| 4 | Frame 1: "nothing else can write an assistant's kind 0" | The generic signer refuses kind 0; `publish-profile` refuses anyone but the person, and a request with no content; the dashboard and legacy writers are gone; the in-container operator has no route of their own (they use the page) | intentional-change | ADR 0005; the operator decision owner-settled 2026-09-21 | A script with a person's own session is still that person publishing — through every step the page's publish takes | — |
| 5 | Frame 1, same bullet | **Not closed:** a TA-signed kind 5 sent through the generic signer (Owner or Admin) can delete the TA's kind 0 from the local relay; the relays keep it and the next publish replaces it | deferred | Owner-settled: every non-kind-0 TA signing question is OPEN.md #269 (ADR 0005 known gaps) | Narrow: an Owner or Admin acting through the API | §6 #2 |
| 6 | Frame 1, same bullet | The client-signed path still accepts an assistant kind 0 this instance signed earlier (a replayed letter); the local relay keeps the newest, so it matters only after a wiped relay | constraint-discovered | ADR 0005 known gaps; principle 2 (publication stays permissionless) | Negligible | — |
| 7 | Frame 2: "one definition … whichever role or path publishes it" | One role-free definition (`profileDefaults.js`), offered by `/status` as `defaults`; since story 5 the publish path no longer builds it — "Reset to defaults" puts it in the form, and the form is what is published | intentional-change | ADR 0003; ADR 0005 sub-decision 2 partly supersedes ADR 0003's no-content contract | Publishing the default is two clicks (Reset, Publish) instead of one | — |
| 8 | Frame 2: the ratified picture "always" | On a non-public instance the default picture is the reference deployment's `https://tapestry.brainstorm.world/ta-avatar.png` | interpretation | Resolved at approval (story 3 Open question 1; ADR 0003 sub-decision 8) | Non-public instances' profiles depend on that host staying up | §6 #13 |
| 9 | Frame 2: the ratified about text | Its kind 10040 sentence ("You can find my pubkey in my owner's kind 10040 event") can be false for an owner with assistants on several instances | interpretation | Kept as approved (story 3 Open question 4); OPEN.md #267 was settled by `curated-dlist-update` #1 (one curating assistant per list) | The sentence is true for one of an owner's instances | §6 #12 |
| 10 | Frame 2: "users can edit exactly the agreed fields" | The seven fields; NIP-05 server-managed and read-only, and absent (with an explanation) on a non-public instance; values the user types are not validated, so a stale value an older default put into a published profile (e.g. `https://localhost:7777`) survives an unedited republish | deferred | ADR 0003 known gaps; story 3 Out of scope | "Reset to defaults" clears it | §6 #14 |
| 11 | Frame 3: "only when the viewer's own assistant has no profile on the local relay or on the relays its profile is published to" | Existence of any kind 0 counts; a stale profile counts as set up; the relay fallback runs only for the person, the Owner, an Admin or the operator; in local-only mode no relay is asked, so a wiped local-only box prompts | interpretation | Story 1 Out of scope; epic decision 6 (the local answer stands); ADR 0002 sub-decision 1 | A published-but-broken profile (e.g. a NIP-05 that no longer verifies) is not flagged | §6 #5 |
| 12 | Frame 3, same bullet | A publish relay that sends the profile but withholds EOSE past the 4 s budget does not count; the JSDoc and ADR 0001 Amendment 1 overstate this ("every event … delivered within `maxWait`") | constraint-discovered | Review 1 round 2, non-blocking R2-1 (rare: relays send EOSE after stored events, and the profile sits on several) | Rare false prompt | §6 #16 |
| 13 | Frame 4: "reaches the relays the instance is configured for" | The union of the general-purpose, profile and WoT settings (six relays today, adding profiles.nostr1.com); the sibling Tapestry instance relays are left out; local-only mode sends nothing outward | interpretation | Story 2 Open questions (approved); ADR 0002 | The operator steers publishing from the Relays settings page | §6 #3 |
| 14 | Frame 4: "an honest result for each relay" | Five statuses with the relay's own reason, one 8 s deadline; `success: true` now means "saved on this instance's relay", with `outcome` for what reached nostr | intentional-change | ADR 0002 sub-decisions 2, 4, 5 | A client reading `success` as "reached nostr" must read `outcome` | — |
| 15 | Epic "Other defects": the badge generator stamped the Owner's face for Admins and was refused for Customers | Offered only to the Owner (`status.isOwner`); its failures say what happened (`code: 'no-picture'`) | constraint-discovered | ADR 0004 sub-decisions 4–5; composites for others are the ta-avatar carry-forward | Admins and Customers have no badged avatar | §6 #9 |
| 16 | Epic "Other defects": an Owner with a missing key saw Customer copy, and provisioning stored a key nothing reads | The copy is fixed (`isOwner` on the no-key answer, Owner wording, no create button); the key slot itself is untouched | deferred | ADR 0004; key lifecycle (`stories/_intake.md`, 2026-08-10) | An Owner whose TA key is lost cannot restore it from the app | §6 #7 |
| 17 | Epic survey: "`/api/profiles` skips its local fallback when its relay race times out" | The setup check no longer depends on it; display surfaces (avatars, profile pages) still do | deferred | ADR 0001 Consequences → OPEN.md #273 | Occasional missing names/avatars on display surfaces | §6 #4 |
| 18 | The legacy pages "still served though no longer linked" | Kept, with read-only panels; not removed | deferred | Story 5 Out of scope ("Removing the legacy pages altogether") | Two unlinked pages remain | §6 #11 |
| 19 | The ask implies each person's assistant is theirs to see | `GET /api/assistant/status` tells an anonymous caller which pubkeys hold an assistant key — pre-existing, found at story 4's review | deferred | Owner-settled 2026-09-21: its own story (ledger `2026-09-21-status-reveals-assistant-key-holders`) | Admins are identifiable to anyone who can guess their pubkey | §6 #1 |
| 20 | Guardrail: "nothing in this epic rewrites an already-published profile" | Held: no migration, no republish. At story 5's staging deploy the staging TA's kind 0 is the same event as before (`1c20ca95…`, 2026-07-12) | — | ADR 0003/0005; AC5 check, step 2 | Old defaults stay published until each user republishes | §6 #6, #17 |

**Undocumented work** — none. Every product file in the book's 34 non-merge commits traces to one of the five
stories; the remaining commits are records (book, stories, ADRs, plans, reviews, ledger). The story branches also
carried merges of `origin/staging` (other books' work, e.g. `setup-status-and-alert` #1 into story 5's branch);
none of that is this book's. **Changed from outside this book:** PR #722 (`navigation-scaffolding`) added the
"Assistant Management" avatar-menu item pointing at `/assistant` before the page existed; story 4 made the page.

**This close** ticks five §6 items in earlier audits that this book resolved: `ta-avatar` (RFC1918 in
`isPubliclyReachable`; the `'a customer'` fallback; "Nothing is on prod"), `nip05-ssrf-guard` (row 148) and
`navigation-scaffolding` #1 (provisioning for non-owner users).

## 5. Quality state at close

- **`npm test` at close** — run after the book flip and the epic close-out, over the tree this close leaves behind
  (`+dirty` is this close, uncommitted): `20260921T211149Z-821-5af6 [book-close-assistant-profile] started
  2026-09-21T21:11:49.135Z on 383f99e5+dirty — FAIL, exit 1, 3564 passed, 97 failed, 46 skipped, 218/218 suites;
  failed: profile-tags, … setup-status` (36 suites; the full list is in the run record).
  - **The failing set is the one story 5's review saw, suite for suite.** Every one is a live test against the
    local stack, which serves an older checkout (OPEN.md #27).
  - **Three counts moved, all from the stack.** `teach-it-what-matters` H6 and `the-brain-survives` H7 got
    `fetch failed`, and `operational-direction` skipped its ten live-stack tests because the stack did not answer
    at that moment. Nothing restarted: the control panel had been up for a day, and it answered in 0.09 s after
    the run.
  - **This close changed nothing those suites run.** It touched only records and test header comments.
- **At story 5's review:** `20260921T201431Z-84182-4f5d [ap5-review] … on c19feb89 — FAIL, exit 1, 3576 passed, 95
  failed, 36 skipped, 218/218 suites` — every failure a live test against the local stack, which serves an older
  checkout (OPEN.md #27); the story's suites all pass. A stack-free re-run of 13 related suites had no failure.
- **CI:** `stack-free` green on all five staging PRs (#650, #717, #724, #730, #733); on #733:
  `Overall: PASS — 3219 passed, 0 failed, 541 skipped across 218 suites`.
- **Browser class:** 60/60 across the six assistant specs on story 5's build; stories 1–4's specs ran against
  their own worktree builds at each review.
- **Deploys:** stories 1–4 are in production (via #651, #718, #725, #731). Story 5 on staging: run
  [35653798692](https://github.com/nous-clawds4/tapestry/actions/runs/35653798692), ~96 s, green; five-tier smoke
  clean — the bundle changed (`index-Bw35Un5X.js` → `index-pcqX0yLl.js`), the anonymous kind-0 probe answers
  403 `one-writer`, both legacy pages link to `/assistant` and no longer post.
- **Known open issues** (linked, none introduced by this book): OPEN.md #269 (Admins can mint other TA kinds),
  #270 (dead relays in the default lists), #273 (`/api/profiles` timeout gap), #274 (the dashboard has no error
  boundary), #216 (`.dropdown-item:last-child`); ledger `…-status-reveals-assistant-key-holders` (bug).
- **Debt logged by ADRs, rolled up:** ADR 0001 — `/api/profiles`' timeout gap (#273). ADR 0002 — dlist-curation
  keeps its own local-only reader and server publisher; ADR `event-tagging/0002`'s "no server external publish
  exists" is out of date. ADR 0003 — the reference-deployment coupling; stale typed values; the kind 10040
  sentence; a NIP-05 local-part that can change when the profile relays fail. ADR 0004 — the avatar endpoints and
  `provision-key` keep their gates (#269; key lifecycle); the pubkey is shown as shortened hex. ADR 0005 — the
  kind-5 path, replayed letters, cross-site posture (OPEN.md #326), `public/kg/` (OPEN.md #68). Story 5's review
  adds that two re-signers not in ADR 0005's census, `src/api/concept/selfDeclare.js:79-105` and normalize
  add-to-set's republish (`src/api/normalize/index.js:4408-4431`), share `bDisposition`'s shape and its argument:
  they re-sign only an existing TA event with a matching `d` tag, which no assistant kind 0 carries.

## 6. Carry-forward register

- [ ] **1. The status endpoint's key-holder disclosure** — its own story, by the owner's decision. Ledger
      `2026-09-21-status-reveals-assistant-key-holders`. (§4 #19)
- [ ] **2. What the generic signer may mint as the TA** — the Admin gate for every other kind, a TA-signed kind 5
      included. OPEN.md #269 (dated note 2026-09-21). (§4 #5)
- [ ] **3. Dead or broken relays in the default lists.** OPEN.md #270. (§4 #13)
- [ ] **4. `/api/profiles` skips its local fallback when its relay race times out.** OPEN.md #273. (§4 #17)
- [ ] **5. A "needs attention" state** for a published-but-stale profile — e.g. production's customer assistant,
      whose NIP-05 on `@brainstorm.world` stopped verifying at the domain cutover. (epic Deferred; §4 #11)
- [ ] **6. Existing profiles still carry older defaults** until each user republishes (staging's TA: "Tapestry
      Assistant", no picture, from before ta-avatar). Whether to *prompt* anyone to republish is a product
      question; auto-republishing is deliberately out (epic guardrail). (§4 #1, #20)
- [ ] **7. Key lifecycle** — Admin auto-provisioning, deprovisioning, the Owner's TA slot re-key.
      `stories/_intake.md` 2026-08-10. (§4 #16)
- [ ] **8. The TA ↔ owner two-way handshake.** `stories/_intake.md` 2026-08-09.
- [ ] **9. Badged avatars for Admins' and Customers' assistants** (the generator is Owner-only). ta-avatar
      carry-forward. (§4 #15)
- [ ] **10. A kind 10002 relay list for assistants; unifying in-app display fallbacks for assistants with no
      profile.** (epic Deferred)
- [ ] **11. The legacy pages** (`/legacy/nip85.html`, `/legacy/customer.html`) — remove them, or keep them
      read-only; and the April build under `public/kg/` (OPEN.md #68). (§4 #18)
- [ ] **12. The about text's kind 10040 sentence** can be false for an owner with assistants on several
      instances (#267 settled the list model, not the wording). (§4 #9)
- [ ] **13. Non-public instances' default picture depends on `tapestry.brainstorm.world`.** (§4 #8)
- [ ] **14. Validating URLs a user types** (picture, banner, website). (§4 #10)
- [ ] **15. A design pass on the My Assistant page** — the editor's control-panel look inside a Brainstorm page,
      its unstyled `settings-action-btn` buttons, the pubkey as shortened hex. (story 4 Out of scope / Deviations)
- [ ] **16. Small record and code tidy-ups from the reviews:** the relay-fallback wording (review 1 R2-1, §4 #12);
      a failed setup check can let the checklist read "Setup complete" (review 1 Note 2); BIBLE has no row for
      `/api/assistant/status` and the handler's JSDoc does not mention its copy-home write (review 1 Note 4); the
      skipped-row literals and double settings read (review 2 non-blocking 1–2); the name memo's in-flight
      de-duplication (ledger `2026-09-21-assistant-api-review-tidy-ups` (b)); ADR `event-tagging/0002`'s stale
      sentence (ADR 0002 debt); OPEN.md #216.
- [ ] **17. Story 5's post-deploy checks.** AC5 on production after promotion (ledger
      `2026-09-21-assistant-profile-ac5-postdeploy-check`); re-anchor the two R3 sentinels at the owner gate
      (ledger `2026-09-21-r3-sentinels-miss-owner-gate-403`).
- [ ] **18. The Treasure Map's no-assistant state** could now link to `/assistant`, where Admins and Customers can
      create one (`treasure-map-user-assistant` audit §6, provisioning UX).
- [ ] **19. The dashboard has no error boundary.** OPEN.md #274.

## 7. Process findings (harness)

Retro run on measurement: `scripts/harness-stats.sh` at close — 234 reviews decided, 0% final kick-back rate, 44
reviews with a kick-back somewhere in their history; 59 books closed, cycle-time median 0d. This book: 32 phase
commits, open 10 days (2026-09-11 → 2026-09-21); story → review 0d (#1), 8d (#2), 9d (#3–#5) — stories 2–5 were
filed at planning and waited in the queue; each was built in a day. One kick-back in six review rounds (story 1).

| Finding | Source | Terminal state |
|---|---|---|
| **An ADR's "Test-file changes" list — and then the Tester's own grep — missed existing tests that assert the old behaviour by value or by layout.** Three instances: ADR 0003 missed story 1's spec B3/B5; ADR 0004 missed B3/B4/B5/B8; in story 5 the `signAs` grep *listed* two suites whose R3 window sentinels broke, and neither was opened — the first full gate caught them, and review 5 found the sentinels now pass while measuring a different line. | stories 3–5 test plans; story 5 Deviations; review 5 NB1 | **OPEN.md row `2026-09-21-adr-reaim-list-misses-outcome-asserts`** (`meta`, filed in this book, three dated notes) |
| **The review template's section order makes a CHANGES_REQUESTED review parse as PASS** (`review-verdict.awk` takes the last verdict token). Reproduced at story 1's round 1. | review 1 harness friction | **OPEN.md row 28** (`meta`, open; this book's row #272 was closed as its duplicate) |
| **Setting `STRFRY_DOMAIN` in the environment does not choose an instance shape** for a hermetic run — a reviewer can believe they checked a public instance when they checked an unconfigured one. | review 4 harness friction | **OPEN.md row `2026-09-21-strfry-domain-env-not-read`** (`meta`) |
| **`gh pr merge --match-head-commit` rejects a short SHA, after the safe-to-merge verdict is spent.** | story 2's staging merge (#717) | **OPEN.md row `2026-09-21-match-head-commit-needs-full-sha`** (`meta`) |
| **The epic close-out's move under `done/` breaks every citation of the moved files made from outside them — in code and test comments as well as docs — and no check reads code.** This close rewrote its own 80 citations in 38 files with one substitution; 99 citations of earlier epics' moved files are still stale in `test/`, `tests/`, `src/`, `ui/src/` and `scripts/`. | this close, step 9 | **OPEN.md row 312** (`meta`, open; dated note 2026-09-21 added) |
| **Test plans called the W-class "the CI-enforced backstop for the B-class"** when some B-tests had no W counterpart — twice (stories 3 and 4). | reviews 3 and 4 | **Declined (fixed at the source):** both gaps were closed with guards (W15–W16, W17–W20, each mutation-tested), story 4's plan was reworded, and story 5's plan states the narrower rule. No recurrence in story 5. |
| **Seam fakes cannot express per-relay behaviour.** Story 1's blocking defect lived in a design step the fakes could not reach; the fix added a stack-free test through the real helper against local `ws` relays, a pattern stories 2 and 5 reused. | review 1 round 1 | **Declined (applied in-book):** the pattern is established in `test/assistant-setup-state.test.js` U12 and story 2's P-class; ADR 0001 Amendment 1 records the obligation. |
| **Stories written at planning drift before they are built** — story 5's Background still described "Surprise me" ten days and three stories later. | story 5 ADR § Codebase facts | **Declined:** the Architecture phase's "verified on ‹commit›" facts are the designed catch, and it caught this; restating stories on every earlier merge would cost more than it saves. |
| **A fresh reviewer agent** (the owner's preference, stories 3–5) found real things the author missed each time: the browser-only checks and the status disclosure (story 4), the R3 sentinels measuring the wrong line and two re-signers outside the census (story 5). | agent memory; reviews 4–5 | **Declined as a harness change:** kept as the owner's per-session preference in agent memory; ratifying it into `workflows/5-review.md` is the owner's call. |
| **Tooling gotcha:** `nak req` inside a `while read` loop consumes the loop's stdin, so only the first row is checked (seen in story 5's staging smoke). | this book's staging smoke | **Declined (no row):** added to the agent-memory note on the Bash shell (step 13); not a harness defect. |

**Does it port to the other flow (Direction ↔ human-gated)?** The re-aim lesson ports fully — a Direction-mode
Architect and Tester face the same pre-existing assertions — and so do the template, `STRFRY_DOMAIN`, full-SHA
and `done/`-citation rows. The fresh-reviewer finding matters most in Direction mode, where the blinded judges already embody it.
