# Test Plan: Story 1 — Tag actions menu and raw event inspector

**Story:** `engineering-team/stories/tag-event-inspector/1-tag-actions-menu-and-raw-event.md`
**ADR:** `engineering-team/decisions/tag-event-inspector/0001-tag-actions-menu-and-raw-event.md`
**Date:** 2026-07-16
**Branch:** `feat/tag-raw-event-viewer` (phases 1–2 at `5215ff43`)

## The shape of this plan in one paragraph

Two suites, because the two halves of this story fail in different places and only one of them gates CI. The **API contract** (D1) is asserted at runtime in `test/tag-detail.test.js` against the live `by-id` endpoint — that is where an exact key-set can actually be observed. The **UI wiring** (D2–D6) plus the story's named regression risks are asserted stack-free at source level in a new `test/tag-actions-menu-ui.test.js`, because the Node harness cannot transpile JSX. The split is not stylistic: `tag-detail.test.js` skips wholesale when the control panel is unreachable, which is exactly CI's `stack-free` job, so **every assert that must gate a PR lives in the new suite**. Runtime behavior neither can prove (a real clipboard, a real tab switch, 1280px overflow) is Playwright / verify-by-driving work per ADR §Test strategy layers 2–3 and is listed here as explicitly deferred, not silently dropped.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (menu presence) | `U: TagActionsMenu component exists as a sibling of NoteActionsMenu` | `test/tag-actions-menu-ui.test.js` | source |
| AC-1 (placement beside h1) | `U: Tag.jsx imports and renders <TagActionsMenu> inside the tag header, beside the h1` | `test/tag-actions-menu-ui.test.js` | source (region-scoped) |
| AC-1 (no dead affordance) | `U: TagActionsMenu renders no dead affordance when the tag has not loaded (AC-1)` | `test/tag-actions-menu-ui.test.js` | source |
| AC-1 (no auth gate) | `R: SENTINEL — TagActionsMenu gates on nothing: no authorship check, no login gate` | `test/tag-actions-menu-ui.test.js` | source |
| AC-1 (a11y contract) | `U: TagActionsMenu exposes the menu a11y contract (accessible name, expanded state, menu roles)` | `test/tag-actions-menu-ui.test.js` | source |
| AC-1 (toggle open/close, click-outside) | — | **Playwright (deferred)** | e2e |
| AC-2 (exactly three, exact labels) | `U: TagActionsMenu offers exactly the three specified items, with the user's exact labels` | `test/tag-actions-menu-ui.test.js` | source |
| AC-2 (label flips in place) | `U: TagActionsMenu's Show/Hide label is driven by rawOpen (flips in place)` | `test/tag-actions-menu-ui.test.js` | source |
| AC-2 (menu stays open on select) | `R: TagActionsMenu never closes the dropdown on select (D4 — deliberate emulated parity)` | `test/tag-actions-menu-ui.test.js` | source |
| AC-2 (kebab glyph parity) | `U: TagActionsMenu renders the kebab glyph and the emulated bsp-note-menu markup` | `test/tag-actions-menu-ui.test.js` | source |
| AC-3 (Copy Note ID) | `U: TagActionsMenu copies through the shared clipboard helper` (+ label test) | `test/tag-actions-menu-ui.test.js` | source |
| AC-3 (clipboard actually contains the id) | — | **Playwright (deferred)** | e2e |
| AC-4 (naddr = kind 39999) | `U: TagActionsMenu builds the naddr with nip19.naddrEncode over kind 39999` | `test/tag-actions-menu-ui.test.js` | source |
| **AC-4 (naddr from the tag's OWN author)** | `U: the naddr is encoded from the TAG'S OWN AUTHOR and its slug — never the TA (AC-4)` | `test/tag-actions-menu-ui.test.js` | source |
| AC-4 (degrades, doesn't emit a wrong address) | `U: the naddr construction is guarded against malformed data (naddrEncode throws)` | `test/tag-actions-menu-ui.test.js` | source |
| AC-4 (naddr decodes to the right coordinate) | — | **Playwright (deferred)** | e2e |
| AC-5 (default hidden; state ownership) | `U: Tag.jsx owns the rawOpen state, defaulting to hidden, and passes the toggle down (D4, AC-5)` | `test/tag-actions-menu-ui.test.js` | source |
| AC-5 (panel at page level, right region) | `U: Tag.jsx renders the raw panel at page level, between the header and the tab strip (AC-5)` | `test/tag-actions-menu-ui.test.js` | source (region-scoped) |
| **AC-5 (not tab-scoped — the D3 forced decision)** | `R: SENTINEL — the raw panel is NOT nested in the hidden-toggled bs-tag-rows tabpanel (D3)` | `test/tag-actions-menu-ui.test.js` | source (order) |
| AC-5 (below the POV banner) | `R: the raw panel sits BELOW the POV status banner (D3 — a tall blob can't hide a notice)` | `test/tag-actions-menu-ui.test.js` | source (order) |
| AC-5 (panel survives a tab switch) | — | **Playwright (deferred)** | e2e |
| AC-6 (raw event served) | `GET /api/profile-tags/by-id returns the tag definition event on tag.rawEvent` | `test/tag-detail.test.js` | integration |
| **AC-6 (the whitelist — exact key set)** | `by-id tag.rawEvent carries EXACTLY the seven canonical NIP-01 keys — no more, no less` | `test/tag-detail.test.js` | integration |
| AC-6 (no field reordered) | `by-id tag.rawEvent emits the canonical fields in canonical order` | `test/tag-detail.test.js` | integration |
| AC-6 (fields correct) | `…rawEvent.id …` / `…kind is 39999` / `…pubkey is the tag element's own author` / `…tags contains the d tag` / `…sig and .content …untruncated` | `test/tag-detail.test.js` | integration |
| AC-6 (z tags as signed) | `by-id tag.rawEvent preserves the z tags as signed (read and displayed, never recomposed)` | `test/tag-detail.test.js` | integration |
| AC-6 (whitelist enforced structurally) | `U: toRawEvent projects all seven canonical NIP-01 fields, in canonical order` + `R: toRawEvent whitelists — it never spreads the scanned event` | `test/tag-actions-menu-ui.test.js` | source |
| AC-6 (panel renders the full event) | `U: Tag.jsx renders the raw panel at page level…` (`JSON.stringify(tag.rawEvent, null, 2)`) | `test/tag-actions-menu-ui.test.js` | source |
| AC-6 (absent ⇒ no empty panel) | `U: the raw panel renders nothing when the raw event is absent (AC-6 — no empty panel)` | `test/tag-actions-menu-ui.test.js` | source |
| AC-6 (absent ⇒ "unavailable" flash) | `U: TagActionsMenu degrades per the emulated convention rather than throwing (AC-6)` | `test/tag-actions-menu-ui.test.js` | source |
| **AC-7 (no TA literal / no TA lookup)** | `R: SENTINEL — TagActionsMenu introduces no TA pubkey literal and no TA lookup (AC-7)` | `test/tag-actions-menu-ui.test.js` | source |
| AC-7 (feed menu unchanged) | `R: NoteActionsMenu still exports a default component and keeps its own three items` | `test/tag-actions-menu-ui.test.js` | source |
| AC-7 (no item added to feed menu) | `R: this story adds no item to the feed note menu (AC-7)` | `test/tag-actions-menu-ui.test.js` | source |
| AC-7 (by-id contract additive) | `by-id keeps its existing contract alongside rawEvent (additive change, AC-7)` | `test/tag-detail.test.js` | integration |
| AC-7 (POV-invariance) | `U: the raw event is projected off a POV-free id lookup (invariant #1 — POV-invariance)` | `test/tag-actions-menu-ui.test.js` | source (region-scoped) |
| AC-7 (Pin row / tabs / rows unchanged) | — | **Playwright + verify-by-driving (deferred)** | e2e |

## The CI-gating claim is verified, not assumed

`test/tag-detail.test.js` is one of the 12 live-API suites policed by `test/stack-free-npm-test.test.js` (story test-hermeticity-ci #2), which spawns each against a dead port and asserts a whole-suite SKIP. Run against this branch with the 10 new `rawEvent` tests added, that suite is **5/5 green**:

- **G1** — `tag-detail` still whole-suite SKIPs when the panel is unreachable, so the new tests inherit the existing `controlPanelReachable()` guard and add no unguarded live call. **This is the proof that its asserts do not gate CI.**
- **G2** — with the panel reachable, `tag-detail` still *runs* its live tests (`pass + fail >= 1`), so the guard has not swallowed the new coverage.

No count-based assertion anywhere in that suite hardcodes `tag-detail`'s test count (`G2` checks `>= 1`; the rest use `offenders.length === 0`), so growing the suite by 10 is safe. This was checked rather than assumed — it is exactly the shape of cross-suite collision OPEN.md #40 exists for.

## The two whitelist assertions are complementary — neither alone is sufficient

Worth stating plainly, because it is the least obvious thing in this plan and it changes what a reviewer should demand.

The ADR's D1 rationale is that `{...ev}` is *only accidentally clean*: strfry emits exactly the 7 canonical fields, and nostr-tools' `verifiedSymbol` is a `Symbol`, which `JSON.stringify` silently drops. **Verified consequence: a naive `{...ev}` spread PASSES the runtime set-equality assertion today.** I checked this directly rather than assuming it (`Object.keys({...ev})` on the local leg = exactly the canonical 7). So:

- **`R: toRawEvent … never spreads the scanned event`** (source, stack-free, **gates CI**) is what catches a spread **today**, structurally. The runtime assert cannot.
- **`by-id tag.rawEvent carries EXACTLY the seven canonical keys`** (runtime, does **not** gate CI) is what catches the leak **when it actually happens** — a nostr-tools upgrade that switches `verified` to a string key, or a new strfry field. That failure arrives *without any change to our source*, so the source sentinel cannot see it.

One guards the code, the other guards the dependency surface. Deleting either leaves a real hole open. Both are load-bearing.

## Edge cases covered beyond the ACs

- [x] **`toRawEvent` drops a field** — caught by the canonical-fields test and by runtime set-equality's `missing: [sig]` direction.
- [x] **`toRawEvent` reorders fields** — caught (D1's declared-order rationale; AC-6's "no field reordered").
- [x] **Scan leg attaches an extra field** — caught by runtime set-equality's `unexpected: [...]` direction.
- [x] **Malformed `authorPubkey` / missing slug** — `naddrEncode` calls `hexToBytes`, which **throws**; the guard + try/catch is asserted.
- [x] **Tag not loaded** — no dead menu (`return null`).
- [x] **`rawEvent` absent from the response** — menu still opens, copies still work, no empty panel.
- [x] **A future refactor nests the panel into the tab panel** — the D3 order sentinel fails.
- [x] **A future refactor extracts NoteActionsMenu into a shared shell** — the AC-7 sentinel fails (that extraction is deferred to the third menu, D2).
- [x] **Region marker renamed / missing** — every slicer asserts its start marker and fails loudly rather than passing vacuously against an empty slice.
- [ ] **Concept Graph API unavailable** — not applicable; no concept-graph call is on this path (no firmware reinstall; concepts are read-only context).
- [ ] **Concurrent calls** — not applicable; `by-id` is a stateless read, once per page mount.

## Region-scoping (OPEN.md #40) — applied, and checked in both directions

`ui/src/pages/Tag.jsx` is read by ~9 suites and `src/api/profile-tags/index.js` hosts many handlers. Per **OPEN.md #40** and its worked precedent (**ADR relay-management/0002 Amendment 1**), source assertions here slice to the owning region first, and **each slicer asserts its start marker exists** so a missed marker fails loudly instead of passing vacuously against an empty string. Four slicers: `handleTagByIdRegion`, `toRawEventRegion`, `tagHeaderRegion`, `pageLevelRegionBeforeRows`.

Two notes a reviewer should check:

- **`pageLevelRegionBeforeRows`'s end marker is `className="bs-tag-rows"`, not `<section className="bs-tag-rows"`.** That section's opening tag is **multiline** in the source, so the combined form would never match, the slicer would silently run to EOF, and it would swallow the very placement it exists to police. This is the vacuous-pass trap in miniature.
- **The POV assert scopes to the definition scan, not the whole handler**, because `handleTagById` legitimately contains `viewerPubkey` for the ADR-0009 `viewerPin` scan. A handler-wide token ban would fail on correct code.

**The reverse direction — does this feature break the siblings?** #40's actual failure mode is a *new* surface breaking an *existing* suite's file-global assert. I checked all five suites reading `Tag.jsx`: they anchor on `refresh-pinned-tag`, `pinTag(`, `createTag`, `syncPinnedExportsForTag`, and `PovStatusNotice` — **none of which this story touches**, and the panel is inserted *after* `<PovStatusNotice/>`, leaving its index intact. No collision found. The Implementer should still run the differential (below) rather than trust this.

## The negative sentinels check code, not prose

The four "this token must not appear" sentinels (TA-hardcode, no-gate, no-spread, stays-open) run against **comment-stripped** source. Without that they punish the right instinct: the ADR *instructs* the Implementer "Do NOT add a `setOpen(false)`" and "must not call `useConfig().taPubkey`", so a conscientious comment recording that rule — `// no setOpen(false) here (D4)` — would trip the very sentinel enforcing it. AC-7 bans a 64-hex **constant**, not the mention of one.

The stripper is deliberately conservative: block comments, plus `//` comments only where they *begin a line*. Stripping trailing `//` would eat the tail of any line holding a URL (`'https://…'`), and for a negative assert that is a false **negative** — the failure direction that actually matters. Whole-line comments cannot contain code, so nothing is lost.

Verified in both directions: a reference implementation carrying comments that name a literal TA hex, `useConfig`, `taPubkey`, `LEGACY_TA_PUBKEY` and `setOpen(false)` stays **28/28 green**, while all 14 mutations below are still caught.

## Guarding power — 14 mutation spot-checks (all caught)

Per the Amendment 1 precedent ("the change must be scoping, not weakening"). A regex assert that can never fail is decoration; one that can never *pass* is worse. Both were checked by transcribing the ADR's own code blocks into a **throwaway scratch tree** (never the repo), confirming **28/28 PASS** — the suite is satisfiable — then mutating one thing at a time:

| # | Mutation | Sentinel that caught it |
|---|---|---|
| 1 | Panel nested inside the `bs-tag-rows` tabpanel | D3 placement sentinel |
| 2 | naddr pubkey ← 64-hex TA literal | TA-hardcode sentinel |
| 3 | naddr pubkey ← runtime `useConfig().taPubkey` | TA-hardcode sentinel |
| 4 | `toRawEvent` body ← `{...ev}` | whitelist/no-spread sentinel |
| 5 | `toRawEvent` drops `sig` | canonical-fields test |
| 6 | `toRawEvent` emits non-canonical order | canonical-order test |
| 7 | `setOpen(false)` added to a select handler | D4 stays-open sentinel |
| 8 | `Copy Note Addr` → `Copy Event Addr` | exact-labels test |
| 9 | `rawOpen` defaults to `useState(true)` | default-hidden test |
| 10 | 64-hex guard removed from the naddr build | naddr-guard test |
| 11 | Inspector login-gated via `useAuth` | no-gate sentinel |
| 12 | Raw-event item added to the feed note menu | AC-7 no-new-item sentinel |
| 13 | `rawEvent` POV-namespaced | POV-invariance test |
| 14 | `bs-tag-header` region marker renamed | slicer failed **loudly** (4 FAIL), not vacuously |

## Test infrastructure

- **Framework:** Node built-in runner (`node test/test.js`). No new test infrastructure — house rule.
- **Registration:** `test/tag-actions-menu-ui.test.js` is registered in **all four** places in `test/test.js` (require / run+header / summary line / the boolean AND in the overall verdict). The fourth is the one that makes it gate; miss it and the suite runs but never fails the build.

  **Registering it surfaced a live harness bug — logged as OPEN.md #43.** `const overallOk = …` (`test.js:717`) is **severed by a stray semicolon** at `tagApplicabilityPickerResult.fail === 0;` (:826). The seven lines after it — `harnessLint`, `harnessStats`, `sessionStart`, `stackFreeNpmTest`, `ciTestJob`, `syncPanelTagFilters`, `routerStreamTagFilters` — are a **dangling expression statement**: evaluated, discarded, never read. `process.exit(overallOk ? 0 : 1)` (:865) consults only the truncated chain, so those seven suites run, print PASS/FAIL, and **cannot fail the build** — including the two suites from the just-closed router-stream-tag-filters book and CI's own stack-free guards.

  Appending this story's term at the bottom (the natural place, next to the most recent suite) landed it **in the dead block**, where the four-touch ritual would have looked complete while gating nothing. The term was therefore placed inside the live `const overallOk` declaration instead, and verified mechanically rather than by eye:

  ```
  my suite gates overallOk : true
  terms in the LIVE chain   : 109
  terms still ORPHANED      : harnessLintResult, harnessStatsResult, sessionStartResult,
                              stackFreeNpmTestResult, ciTestJobResult,
                              syncPanelTagFiltersResult, routerStreamTagFiltersResult
  ```

  **Re-attaching the other seven is deliberately NOT in this diff.** The fix is one character (`;` → `&&`), and all seven currently PASS so it is zero-risk *today* — but it changes gate semantics for other stories' suites, and this repo's precedent (ADR relay-management/0002 Amendment 1) is that harness changes get ratified explicitly rather than slipped into an unrelated story's commit. Operator's call.
- **Control panel:** `http://localhost:7778` (`BRAINSTORM_BASE_URL` overrides) for `tag-detail.test.js` only. The new suite needs no stack, no network, no transpile.
- **Firmware state:** none required. No concept definitions change (ADR: "Firmware reinstall required? No").
- **Fixture (`tag-detail.test.js` only):** local tag `cpc-tag-s12b-1784175857927-1vizzi`, event `5633f149…e975d`, author `c06d93c9…8899`. **Deliberately a NON-TA author** — a TA-hardcode regression would pass silently against a TA-authored tag, which is precisely how the reference incident in CLAUDE.md stayed invisible on local dev. Prerequisite: the local strfry kind-39999 corpus. Against a base URL lacking this event the fixture tests fail loudly with a named PRECONDITION message rather than passing vacuously.

## How to run

```
node test/tag-actions-menu-ui.test.js     # stack-free; the CI-gating half
node test/tag-detail.test.js              # needs the local stack on :7778
npm test                                  # full suite (see the FAIL caveat below)
```

## Verification

Confirmed 2026-07-16 on `feat/tag-raw-event-viewer` at `5215ff43`. Both suites fail because the feature is absent — not from a typo, an import error, or a missing fixture.

**`test/tag-actions-menu-ui.test.js` — 3 passed, 25 failed.** Every failure names the missing artifact. The 3 passes are exactly the regression sentinels that *should* pass before and after — AC-7's two feed-menu sentinels, plus the `handleTagById` no-spread sentinel, which is armed for a future edit rather than describing today:

```
--- tag actions menu + raw event inspector UI tests (epic tag-event-inspector, Story 1) ---
  FAIL  U: profile-tags API declares a toRawEvent(ev) projection helper
        src/api/profile-tags/index.js must declare `toRawEvent(ev)` (ADR 0001 D1) — the raw panel's contract is "the event as signed", not "whatever the scan leg attached".
  FAIL  U: toRawEvent projects all seven canonical NIP-01 fields, in canonical order
        src/api/profile-tags/index.js must declare a `toRawEvent(ev)` helper (ADR 0001 D1) — the 7-field NIP-01 projection the raw panel's "as signed" contract rests on.
  FAIL  R: toRawEvent whitelists — it never spreads the scanned event (the D1 decision)
        src/api/profile-tags/index.js must declare a `toRawEvent(ev)` helper (ADR 0001 D1) — the 7-field NIP-01 projection the raw panel's "as signed" contract rests on.
  FAIL  U: the by-id response hangs the raw event on tag.rawEvent (so useTagDetail needs no change)
        handleTagById's res.json must carry `rawEvent: toRawEvent(ev)` inside its `tag` object (ADR 0001 D1) — nested under `tag` because useTagDetail.js already does setTag(data.tag).
  PASS  R: handleTagById does not spread the scanned event into its response
  FAIL  U: the raw event is projected off a POV-free id lookup (invariant #1 — POV-invariance)
        handleTagById must project `rawEvent:` off the definition scan result (ADR 0001 D1).
  FAIL  U: TagActionsMenu component exists as a sibling of NoteActionsMenu
        ui/src/components/TagActionsMenu.jsx must exist (ADR 0001 D2 — a new sibling, so the shipped feed menu carries zero risk per AC-7).
  FAIL  U: TagActionsMenu copies through the shared clipboard helper
        TagActionsMenu must copy via the shared `copyText` helper from ui/src/utils/clipboard.js (ADR 0001 D2 — reused verbatim, not reimplemented).
  FAIL  U: TagActionsMenu renders the kebab glyph and the emulated bsp-note-menu markup
        TagActionsMenu must render the literal ⋯ (U+22EF) glyph — the same character NoteActionsMenu uses; there is no icon library in this repo.
  FAIL  U: TagActionsMenu offers exactly the three specified items, with the user's exact labels
        TagActionsMenu must offer the exact label "Copy Note ID (event id)" (AC-2).
  FAIL  U: TagActionsMenu's Show/Hide label is driven by rawOpen (flips in place)
        the third item's label must be driven by the rawOpen prop ({rawOpen ? 'Hide Raw Event' : 'Show Raw Event'}) so it flips on the same click that toggles the panel (AC-2, ADR 0001 D4).
  FAIL  U: TagActionsMenu exposes the menu a11y contract (accessible name, expanded state, menu roles)
        the kebab button must expose an accessible name (AC-1).
  FAIL  U: TagActionsMenu renders no dead affordance when the tag has not loaded (AC-1)
        TagActionsMenu must return null when the tag has no eventId (AC-1: "given a tag that has not loaded, no menu renders" — mirroring NoteActionsMenu.jsx:47).
  FAIL  U: TagActionsMenu degrades per the emulated convention rather than throwing (AC-6)
        TagActionsMenu must follow the emulated menu's "<label> unavailable" convention when it cannot produce a value (AC-6) — the item stays, it reports; it is not hidden or disabled.
  FAIL  R: TagActionsMenu never closes the dropdown on select (D4 — deliberate emulated parity)
        ui/src/components/TagActionsMenu.jsx must exist
  FAIL  U: TagActionsMenu builds the naddr with nip19.naddrEncode over kind 39999
        TagActionsMenu must encode the tag coordinate with nip19.naddrEncode (ADR 0001 D5).
  FAIL  U: the naddr is encoded from the TAG'S OWN AUTHOR and its slug — never the TA (AC-4)
        TagActionsMenu must call nip19.naddrEncode({...}) (ADR 0001 D5).
  FAIL  U: the naddr construction is guarded against malformed data (naddrEncode throws)
        the naddr build must guard authorPubkey with a /^[0-9a-f]{64}$/ test before encoding (ADR 0001 D5) — mirroring publishProfileTag.js:55, which validates the identical field for the identical coordinate. naddrEncode throws on malformed hex.
  FAIL  R: SENTINEL — TagActionsMenu introduces no TA pubkey literal and no TA lookup (AC-7)
        ui/src/components/TagActionsMenu.jsx must exist
  FAIL  R: SENTINEL — TagActionsMenu gates on nothing: no authorship check, no login gate
        ui/src/components/TagActionsMenu.jsx must exist
  FAIL  U: Tag.jsx imports and renders <TagActionsMenu> inside the tag header, beside the h1
        Tag.jsx must import TagActionsMenu.
  FAIL  U: Tag.jsx owns the rawOpen state, defaulting to hidden, and passes the toggle down (D4, AC-5)
        Tag.jsx must own `const [rawOpen, setRawOpen] = useState(false)` (ADR 0001 D4) — the menu and the panel are siblings, so Tag.jsx is their only common ancestor that can hold shared state. useState(FALSE) is AC-5's default-hidden.
  FAIL  U: Tag.jsx renders the raw panel at page level, between the header and the tab strip (AC-5)
        Tag.jsx must render the raw event panel (.bs-tag-raw) in the PAGE-LEVEL region between the tag header and the bs-tag-rows tabpanel (ADR 0001 D3, AC-5).
  FAIL  U: the raw panel renders nothing when the raw event is absent (AC-6 — no empty panel)
        the panel must also be conditioned on tag.rawEvent existing (AC-6) — no empty panel that could be misread as "this tag has no definition".
  FAIL  R: SENTINEL — the raw panel is NOT nested in the hidden-toggled bs-tag-rows tabpanel (D3)
        the raw event panel (.bs-tag-raw) is missing from Tag.jsx entirely (ADR 0001 D3, AC-5).
  FAIL  R: the raw panel sits BELOW the POV status banner (D3 — a tall blob can't hide a notice)
        the raw event panel (.bs-tag-raw) is missing from Tag.jsx.
  PASS  R: NoteActionsMenu still exports a default component and keeps its own three items
  PASS  R: this story adds no item to the feed note menu (AC-7)

tag-actions-menu-ui: 3 passed, 25 failed
```

**`test/tag-detail.test.js` — 9 passed, 9 failed.** All 9 failures are `tag.rawEvent must be present`. The 6 pre-existing tests still pass (no regression from the edit), and — the point that proves these fail for the *right* reason — `by-id keeps its existing contract alongside rawEvent` **passes**, which means the fixture resolves 200 and its existing fields are intact. The suite is failing on the absent feature, not on a missing fixture:

```
--- tag-detail tests (Story 2) ---
  PASS  GET /api/profile-tags/by-id rejects missing tagEventId with 400
  PASS  GET /api/profile-tags/by-id rejects malformed tagEventId with 400
  PASS  GET /api/profile-tags/by-id returns 404 for a well-formed but unknown tagEventId
  FAIL  GET /api/profile-tags/by-id returns the tag definition event on tag.rawEvent
        tag.rawEvent must be present — the signed event the raw panel renders (ADR 0001 D1)
  FAIL  by-id tag.rawEvent carries EXACTLY the seven canonical NIP-01 keys — no more, no less
        tag.rawEvent must be present
  FAIL  by-id tag.rawEvent emits the canonical fields in canonical order (AC-6: no field reordered)
        tag.rawEvent must be present
  FAIL  by-id tag.rawEvent.id is the requested event id and agrees with tag.eventId
        tag.rawEvent must be present
  FAIL  by-id tag.rawEvent.kind is 39999 — the addressable kind AC-4 encodes into the naddr
        tag.rawEvent must be present
  FAIL  by-id tag.rawEvent.pubkey is the tag element's own author, agreeing with tag.authorPubkey
        tag.rawEvent must be present
  FAIL  by-id tag.rawEvent.tags contains the d tag, and it equals tag.slug (the naddr identifier)
        tag.rawEvent must be present
  FAIL  by-id tag.rawEvent preserves the z tags as signed (read and displayed, never recomposed)
        tag.rawEvent must be present
  FAIL  by-id tag.rawEvent.sig and .content are present, unmodified and untruncated (AC-6)
        tag.rawEvent must be present
  PASS  by-id keeps its existing contract alongside rawEvent (additive change, AC-7)
  PASS  GET /api/profile-tags/profiles-tagged rejects missing tagEventId with 400
  PASS  GET /api/profile-tags/profiles-tagged rejects malformed tagEventId with 400
  PASS  GET /api/profile-tags/profiles-tagged rejects an invalid sort param with 400
  PASS  GET /api/profile-tags/profiles-tagged returns the documented response shape for a known-empty tag
  PASS  GET /api/profile-tags/profiles-tagged accepts each documented sort value

tag-detail: 9 passed, 9 failed
```

### Known-FAIL local environment — do not misread the gate

A full local `npm test` reports **Overall: FAIL for environmental reasons** (OPEN.md #27 — near-empty local Neo4j; 11 tag/pin/TL suites), and a tail view of the output hides this. **Nobody should claim a green full local suite.** The binding gates are:

- **(a)** a **differential** against the `origin/staging` baseline — same suites failing before and after, no *new* failures;
- **(b)** CI's stack-free run (`.github/workflows/test.yml`, required on `main`), which is why `test/tag-actions-menu-ui.test.js` is the half that must be stack-free.

Behavior needing a populated WoT/graph is verified on **staging**; tag data is richest on `feat/tags`, which is where this ships per the book's plan.

## Deferred to Playwright / verify-by-driving (ADR §Test strategy layers 2–3)

Listed so the Reviewer can see what source assertions do **not** prove, rather than discovering it at review:

- The dropdown actually opening/closing; click-outside closing it; the menu **staying open** across a select (AC-1/AC-2).
- The clipboard actually containing the event id (AC-3) and a **decodable** naddr whose kind/pubkey/identifier match — with a **non-TA author fixture**, so a TA-hardcode fails loudly (AC-4).
- The panel **surviving a Taggings↔Pinned tab switch** — the runtime proof of the D3 placement whose source-order proxy is sentinel #1 above (AC-5).
- The `rawEvent`-absent mock degrading to `Raw Event unavailable` with no panel and no throw (AC-6).
- The Pin row, its login gate, the tab strip, the Profiles|Notes switch and the tagging rows behaving as before, signed in and signed out (AC-7).
- Visual placement and **no horizontal overflow at 1280px** (D6) — `/verify` against `http://localhost:7778/tag/cpc-tag-s12b-1784175857927-1vizzi/5633f149de1dd8635d9b45c77ab44c7decf2ad179b76898340ed1be2537e975d`.

The route-mocking pattern already exists (`tests/brainstorm/tag-detail-write.spec.js:50`, `pin-a-tag.spec.js:48` both mock `**/api/profile-tags/by-id**`; the mock simply gains a `rawEvent`).

## Note for the Implementer

`engineering-team/stories/_intake.md` still needs the shared-`<ActionsMenu>`-extraction entry from ADR D2 — it is a doc change, not code, and it is not covered by any test here.
