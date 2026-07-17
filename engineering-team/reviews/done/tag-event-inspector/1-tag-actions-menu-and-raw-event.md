# Review: Story 1 — Tag actions menu and raw event inspector on the tag detail page

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-16
**Epic:** tag-event-inspector
**Diff:** `git diff 5215ff43..HEAD` (impl `e69553e7`, tests `8350c268`) — working tree clean, nothing uncommitted.
**Story:** `engineering-team/stories/tag-event-inspector/1-tag-actions-menu-and-raw-event.md`
**ADR:** `engineering-team/decisions/tag-event-inspector/0001-tag-actions-menu-and-raw-event.md`

Every claim below was re-derived by the Reviewer — the Implementer's report was treated as a hypothesis, not evidence. Where I reproduced a claim it is marked *(independently verified)*; where I accepted it on code reading, it says so.

## Quality gates (run by reviewer, not trusted)

| Gate | Result |
|---|---|
| `node test/test.js` (branch, full) | **Overall: FAIL** — environmental, 11 unique suites (OPEN.md #27, near-empty local Neo4j). **Not a green suite; the binding gate is the differential below.** |
| **Differential vs `origin/staging` (0bc77ee1)** | **Identical failing-suite set, identical counts. Zero new failures.** See table below. |
| `tag-actions-menu-ui` (new) | **PASS — 28 passed, 0 failed** |
| `tag-detail` (extended) | **PASS — 18 passed, 0 failed** (was 9/9; stack up) |
| `bash scripts/harness-lint.sh` | **clean (0 violations)** |
| `npx vite build` | **✓ built in 32.40s**, no new warnings. Chunk-size warning is pre-existing (1.66 MB app + 652 kB vis-network chunk, neither touched). |
| Playwright | Not run — the test plan defers the UI specs (ADR §Test strategy layer 2). Substituted verify-by-driving (layer 3), below. |
| Lint / typecheck | _Not configured — skipped._ |

### The differential — the binding gate

Baseline run in a **throwaway worktree** at `origin/staging` (`0bc77ee1`, the exact parent of this branch's base `5215ff43`); the shared checkout was never mutated. Both columns below are **measured**, not inferred — the branch and baseline runs are `node test/test.js` end-to-end on each tree against the same local stack.

| Failing suite | Baseline (0bc77ee1) | Branch (e69553e7) |
|---|---|---|
| `profile-tags` | FAIL (10 passed, 3 failed) | FAIL (10 passed, 3 failed) |
| `profile-tags-publish` | FAIL (6 passed, 1 failed) | FAIL (6 passed, 1 failed) |
| `profile-tag-polish` | FAIL (7 passed, 4 failed) | FAIL (7 passed, 4 failed) |
| `tag-detail-publish` | FAIL (7 passed, 2 failed) | FAIL (7 passed, 2 failed) |
| `tag-index-publish` | FAIL (8 passed, 1 failed) | FAIL (8 passed, 1 failed) |
| `pin-a-tag-publish` | FAIL (1 passed, 6 failed) | FAIL (1 passed, 6 failed) |
| `tl-publication-from-pins` | FAIL (9 passed, 1 failed) | FAIL (9 passed, 1 failed) |
| `tl-publication-from-pins-publish` | FAIL (2 passed, 5 failed) | FAIL (2 passed, 5 failed) |
| `customize-pin-curation-publish` | FAIL (0 passed, 3 failed) | FAIL (0 passed, 3 failed) |
| `most-pinned-tag-index-publish` | FAIL (0 passed, 7 failed) | FAIL (0 passed, 7 failed) |
| `tag-detail-curated-view-and-pin-polish-publish` | FAIL (0 passed, 1 failed) | FAIL (0 passed, 1 failed) |
| **New failures introduced by this branch** | — | **none** |

All 11 are the documented OPEN.md #27 set (tag/pin/TL suites needing a populated graph). `tag-detail` — the suite this story extends — **passes on both sides**, and gains 9 assertions on the branch.

### Does the new suite actually gate CI?

Verified mechanically by parsing `test/test.js`, not by eye:

- **Four-touch registration complete**: require `:125`, run+header `:369-370`, summary `:714`, overall-AND `:827`.
- `overallOk`'s **live** chain carries **109** terms and **includes `tagActionsMenuUiResult`** ⇒ the suite gates.
- The suite is **stack-free by construction** (`fs.readFileSync` over source; no network, no stack, no transpile), so it gates CI's `stack-free` job. This matters: `test/tag-detail.test.js` — which holds the runtime set-equality assert — **skips wholesale when the control panel is unreachable**, which is exactly CI. The Tester saw this and put the CI-gating half in the new suite, including a source-level guard on `toRawEvent`. Correct call, explicitly reasoned in the suite header (`:13-18`).

## Spec adherence — AC-by-AC

| AC | Verdict | Evidence |
|---|---|---|
| **AC-1** menu present, right of the name, **no auth gate**, none when unloaded | ✅ | `Tag.jsx:237` renders `<TagActionsMenu>` inside `.bs-tag-name-row` (`:233`) — **not** wrapped in the `{user && tag && …}` gate that guards the Pin row at `:246`. *(independently verified by driving, signed out: `pin_row_present:false`, `kebab_present:true`, `aria-label:"Tag actions"`, `aria-expanded:"false"→"true"`.)* No-dead-menu guard at `TagActionsMenu.jsx:60` (`if (!tag?.eventId) return null`). Not-found branch renders no header at all. |
| **AC-2** exactly three items, exact labels, label flips in place, menu stays open | ✅ | *(independently verified by driving:* `item_count:3`, labels exactly `["Copy Note ID (event id)","Copy Note Addr","Show Raw Event"]`, `dropdown_role:"menu"`, `item_roles:["menuitem"]`; after select → `label_now:"Hide Raw Event"`, `menu_still_open:true`; toggle back → `label_back:"Show Raw Event"`, `menu_still_open:true`.*)* |
| **AC-3** Copy Note ID = the 64-hex id; failure is visible | ✅ | *(independently verified: intercepted the clipboard write → `5633f149…e975d`, exactly the id in the URL; flash `"Event ID copied"`.)* Failure branch also observed live: when the real clipboard API rejected (focus loss under JS-driven nav), the menu flashed `"Copy failed"` — AC-3's "visible failure message, not silence", confirmed by accident. |
| **AC-4** naddr from the **tag's own author**, never the TA | ✅ | **The headline check.** *(independently verified — I decoded the copied naddr in node, twice, against two different tags:* tag 1 → `kind 39999 / pubkey c06d93c9…8899 / identifier cpc-tag-s12b-…` — equals the tag's own author, `=== LEGACY_TA` is **false**. Tag 2 → `kind 39999 / pubkey 1f2c26ad…93a3 / identifier nip51-tag-s19b-…` — a *different* author, tracked correctly. Two authors, two naddrs: precisely what a TA hardcode would flatten.*)* Guard at `TagActionsMenu.jsx:49` (`/^[0-9a-f]{64}$/` + truthy slug, in try/catch) matches D5 verbatim and mirrors `publishProfileTag.js:55`. |
| **AC-5** default hidden; toggles; below header/POV banner, above Profiles\|Notes; **not tab-scoped** | ✅ | `Tag.jsx:272-277`, a sibling of the tab strip (`:280`) and of `bs-tag-rows` (`:311`). *(independently verified by driving:* `panel_present_by_default:false`; after select `panel_visible:true`, `panel_inside_bs_tag_rows:**false**`, `panel_prev_sibling:"bs-pov-notice"`.*)* See D3 below for the tab trace. |
| **AC-6** full signed event; honest degradation | ✅ | *(independently verified by driving:* panel renders `["id","pubkey","created_at","kind","tags","content","sig"]` — all 7, canonical order. Then I patched `fetch` to strip `rawEvent` and client-side-navigated to a second tag: flash `"Raw Event unavailable"`, `panel_opened:false`, `label_did_not_lie:"Show Raw Event"` (never flipped), `js_errors:[]`, and **both copies still worked** (`"Event ID copied"`, `"Addr copied"`) — the naddr derives from `authorPubkey`+`slug`, not `rawEvent`.*)* |
| **AC-7** feed menu unchanged; no TA literal; POV-invariant | ✅ | `NoteActionsMenu.jsx` is **byte-identical** — SHA `370ed6b1…` at base *and* HEAD; zero diff lines. `NoteCard.jsx` (the real consumer across all 8 surfaces) untouched. `useTagDetail.js` byte-identical (`dd9cf9bd…`) as D1 predicted. `styles.css` **purely additive** — zero removed lines, no `.bsp-note-menu*` rule redefined. TA/POV checks below. |

No criterion silently dropped. No behavior beyond the story: the diff touches only the ADR's prescribed files.

## The TA-hardcode rule (CLAUDE.md's reference incident for this exact area)

This is the rule most likely to be violated here and the one CLAUDE.md names an incident for. Every check passed:

- **No 64-hex literal in any added `src/`or `ui/` line.** The only two 64-hex literals in the whole diff are in `test/tag-detail.test.js` — the fixture's `eventId` and its **non-TA** `authorPubkey`, deliberately chosen so a TA-hardcode regression fails loudly instead of passing against a TA-authored tag. Correct use.
- **No `taPubkey`, `useConfig`, `LEGACY_*`, `getOwnerAssistantPubkey`, `assistantKeys`, or `useAuth`** in any added source line. `TagActionsMenu` needs no TA at all — it takes `tag` and renders.
- **No `LEGACY_*` constant removed.** All three survive intact: `src/api/profile-tags/index.js:49`, `ui/src/utils/publishTagPin.js:47`, `ui/src/hooks/useEventTagging.js:16`. (CLAUDE.md: a reviewer seeing `LEGACY_*` removed without a re-parenting migration MUST reject — no such removal here.)
- **The `z`-tag legacy literal is read and displayed, never recomposed.** The two `39999:` strings in added source are both *comments* documenting the coordinate; the actual composition is `nip19.naddrEncode` over runtime data.
- **Mutation-tested, not just grepped.** I injected the TA literal in place of `tag.authorPubkey` → the suite went **28/0 → 26 pass / 2 FAIL**. The sentinel has teeth.

## ADR adherence — D1…D6

| D | Verdict | Evidence |
|---|---|---|
| **D1** `by-id` → `tag.rawEvent`, 7-field whitelist, never `...ev` | ✅ | `index.js:748-767` — an explicit 7-key return, no spread. *(independently verified by curl against the live stack:* `rawEvent` keys = `id,pubkey,created_at,kind,tags,content,sig` — **count 7, exact canonical order, zero extras**; `rawEvent.id === tag.eventId`, `rawEvent.pubkey === tag.authorPubkey`, `kind 39999`, `sig` 128 chars, d-tag matches slug. Top-level response keys unchanged: `success,tag,author,viewerPin`.*)* Set-equality enforced at runtime (`tag-detail.test.js`) **and** stack-free at source (`toRawEventRegion`). Mutation-tested: inserting `...ev` → **27 pass / 1 FAIL**. `ev` is non-null-guaranteed — the `events.length === 0` 404 at `:792` precedes it. 400/404 paths untouched. |
| **D2** new sibling component; no NoteActionsMenu refactor | ✅ | New `TagActionsMenu.jsx` (114 lines) reusing `bsp-note-menu*` + `copyText`. Feed menu byte-identical (above). `_intake.md` entry recorded per D2's instruction — and it usefully notes the AC-7 sentinel must be *updated, not deleted*, when the extraction is picked up. |
| **D3** page-level sibling, after `<PovStatusNotice/>`, never inside `bs-tag-rows` | ✅ | **Traced, not trusted.** Panel at `Tag.jsx:272` sits between `<PovStatusNotice/>` (`:264`) and the tab strip (`:280`); `bs-tag-rows` with `hidden={activeTab !== 'default'}` begins at `:311`. **Pinned-tab trace:** `activeTab==='pinned'` ⇒ `bs-tag-rows` gets `hidden`, but the panel's visibility is governed *solely* by `rawOpen && tag?.rawEvent` ⇒ it survives. Runtime `panel_inside_bs_tag_rows:false`. **Mutation-tested:** I actually relocated the panel inside the tabpanel → **25 pass / 3 FAIL**, including the named D3 sentinel. |
| **D4** `rawOpen` in `Tag.jsx`; menu stays open on select | ✅ | `Tag.jsx:71` `useState(false)`; passed as `rawOpen`/`onToggleRaw` (`:237-241`). No `setOpen(false)` in any item handler. *(verified by driving: menu stayed open across 4 selects.)* |
| **D5** `naddrEncode({kind:39999, pubkey: tag.authorPubkey, identifier: tag.slug})` + guard | ✅ | `TagActionsMenu.jsx:48-57`, verbatim per D5. Coordinate matches the precedent `publishProfileTag.js:64` (`39999:${tag.authorPubkey}:${tag.slug}`) exactly. |
| **D6** `.bs-tag-name-row` flex; `.bs-tag-raw*`; both overflow paths closed | ✅ | `styles.css` +42 additive. `.bs-tag-raw-pre`: `white-space:pre-wrap` + `word-break:break-all`; `.bs-tag-name-row .bs-tag-name`: `min-width:0` + `overflow-wrap:anywhere`. *(independently verified at 1280×900 with the panel open — the 128-char `sig` is the failure case:* computed `whiteSpace:"pre-wrap"`, `wordBreak:"break-all"`, `pre_h_overflow:false`, `page_h_overflow:false`.*)* |

**No unauthorized dependencies.** `package.json` untouched; `nostr-tools` already a `ui/` dependency; the only imports are `react`, `nostr-tools`, and the existing `../utils/clipboard`.

## Architecture invariants (CLAUDE.md)

- **POV-invariance (#1).** `rawEvent`'s path carries **no** `povSuffix` / `wotPov` / `viewerPubkey` / `wot_rank` — verified by grep over the added API lines. It is projected off `federatedScan({kinds:[39999], ids:[tagEventId]})`, an id lookup with no POV input. The ADR's own reviewer check passes. Correct: a signed event is the same bytes from every POV; the taggings *around* it remain per-POV and are untouched.
- **Decentralized-first (#2).** No authorship check, no trust check, no login gate. Mutation-adjacent sentinel `R: TagActionsMenu gates on nothing` covers it. Both live fixtures are non-TA authors, and both work.
- **Filter at view time (#3).** Nothing denormalized or stored; panel visibility is pure client state.
- **Firmware reinstall:** **not required** — no concept definitions changed (verified: no `concept`/`firmware`/`setup/`/`.cypher` file in the diff). Matches the ADR.

## Concept-graph integrity

- Handles remain in `kind:pubkey:slug` form; the only handle-shaped strings in added source are explanatory comments.
- The `z`-tag concept handle is read from event data and displayed, never recomposed (ADR-0015 exception correctly *not* invoked — D5's reasoning that the `a`-coordinate and the `z`-handle are different composites is sound and I concur).
- New code orients via the response body / runtime data, not re-derived constants.

## Things tests can't catch

- **No secrets**, no `console.log`/`debugger`/TODO/FIXME in added source lines. No commented-out code.
- **Security — the panel renders attacker-controlled bytes.** Anyone may publish a kind-39999 event with arbitrary `content`; the panel shows it. Checked: no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval` anywhere in the diff. The panel renders `JSON.stringify(tag.rawEvent, null, 2)` as a **React text child**, which React escapes — no injection vector. `max-height:60vh` + `overflow-y:auto` caps a pathological `content` from swallowing the page.
- **Error paths:** `ev` non-null-guaranteed by the preceding 404; `naddrEncode` guarded by regex + truthy slug + try/catch (it calls `hexToBytes`, which throws); absent `rawEvent` degrades to a flash with no panel.
- **Races:** the `flash` `setTimeout` at `TagActionsMenu.jsx:64` is unguarded on unmount — **this is the deliberate house pattern**, copied verbatim from `NoteActionsMenu.jsx:51`. Diverging here would break the parity the story exists to create. Correctly left alone.
- **AC-5's forbidden state** (`"Hide Raw Event"` with no panel) is **unreachable**: `toggleRaw` refuses to set `rawOpen` when `rawEvent` is absent, and `toRawEvent` is projected unconditionally whenever a tag exists — so a tag can never lose `rawEvent` mid-session within one deployment. When `tag` is null the menu returns `null` entirely, so there is no label to read.

## House rules

- Concept Graph API authority respected (ADR oriented via `/summaries`; no BIBLE re-derivation).
- No new lint/typecheck/build tooling.
- Per-deployment TA pubkey rule: **honored** — see the dedicated section above.

## Findings

### Blocking

**None.**

### Non-blocking

1. **`OPEN.md:72` (row #43) understates the defect it files — 9 suites don't gate, not 7.** The row names the 7 orphaned by the stray semicolon. Parsing `test/test.js` shows **9** suites printed in the summary but absent from the live `overallOk` chain: the 7 named, **plus `noteTrustedListResult` and `applicabilityRepublishResult`**, which were never added to the chain at all — an independent four-touch miss, not a semicolon casualty. **Pre-existing and not this branch's doing**: base and HEAD both show exactly 9 (the branch took the live chain 108 → 109 and widened nothing). Optional: amend row #43 to say 9, since the one-character `;`→`&&` fix it prescribes would only recover 7 of them.
2. **`OPEN.md:72` (row #43) line reference is now stale.** It says the chain "terminates at `tagApplicabilityPickerResult.fail === 0;` (:826)". After the impl commit it terminates at `tagActionsMenuUiResult.fail === 0;` (**:827**) — the Implementer correctly appended inside the live chain, which moved the semicolon. A future session following the row to `:826` would edit the wrong line. Optional: update the row's line ref.
3. **D6's overflow rules have no regression sentinel.** `ui/src/styles.css` is asserted by ~10 sibling suites, so there is precedent and no technical barrier — but nothing in `tag-actions-menu-ui.test.js` pins `word-break:break-all` / `white-space:pre-wrap` / `min-width:0`. A future edit deleting `break-all` would silently reintroduce the 1280px horizontal overflow the closed `event-page` book enforced, and only a human at a browser would notice. **Not blocking** — the test plan consciously assigns D6 to verify-by-driving (ADR §Test strategy layer 3), that decision was ratified, and I verified the computed styles myself this story. Optional: three `styles.css` asserts would convert a one-time observation into permanent cover.
4. **`Deviations` — both judgment calls reviewed and endorsed.** The `aria-label:"Tag actions"` (not "Note actions") is right: emulating the *string* would announce a kind-39999 tag element as a note to screen-reader users, and the story's open-question (a) reasoning covers item *labels*, not the object's accessible name — a genuinely different question, correctly distinguished. `max-height:60vh` over the precedents' `200px`/`400px` correctly takes the ratified ADR value over the code it was modeled on.

### Addendum (post-review, same session) — findings 1–3 dispositioned

All three non-blocking findings were acted on rather than carried; the PASS verdict is unaffected (no source behavior changed).

1. **Done** — `OPEN.md` row #43 amended to say **9** non-gating suites, with the count now stated as *measured* (109 live `overallOk` terms vs 118 declared `*Result` vars) and the note that the prescribed one-character fix recovers only 7 of the 9.
2. **Done** — row #43's line reference removed rather than corrected. The semicolon **migrates to whichever suite registers last** (it sat at `:826`, moved to `:827` with this story), so any line number in that row is stale by construction; the row now says to find it as the first `;` after `const overallOk =`.
3. **Done** — the three D6 sentinels were added to `test/tag-actions-menu-ui.test.js` (suite: 28 → **30 passed, 0 failed**), pinning `white-space: pre-wrap` + `word-break: break-all` on `.bs-tag-raw-pre` and `min-width: 0` on `.bs-tag-name-row .bs-tag-name`. Region-scoped via a `cssRule(src, selector)` slicer per OPEN.md #40 — **necessary, not ceremonial**: with the rule deleted, `styles.css` still holds **9 other** `word-break: break-all` occurrences, so a file-global assert would have passed vacuously.
   **Mutation-tested, 4/4 caught:** remove `break-all` → FAIL; `pre-wrap` → `pre` → FAIL; remove `min-width:0` → FAIL; rename the selector → FAIL *loudly* on the slicer's own missing-marker assert (the vacuous-pass case), with a message telling the next editor to update the test rather than delete it. `styles.css` restored byte-exact after each.
   This converts D6 from a once-observed property into permanent cover, closing the one gap this review called genuinely load-bearing.

### Harness friction

**None new this story.** OPEN.md #43 was already filed by the Tester (this branch adds the row), and #40's region-scoping guidance was followed properly — every slicer asserts its start marker exists, so a missed marker fails loudly rather than passing vacuously against an empty string. That is the OPEN.md #40 lesson correctly applied.

## Note on OPEN.md #43's disposition

I independently confirm the Implementer's and Tester's call to **leave it unfixed**. It is pre-existing (base `5215ff43` already terminated at `tagApplicabilityPickerResult.fail === 0;`), this story's suite gates correctly regardless, and the one-character fix changes gate semantics for seven *other* stories' suites — which does not belong in an unrelated implementation commit, unratified. It is filed, documented, and the operator's call. It does not block this story.

## Verdict

**PASS**

The diff matches the story and the ADR decision-for-decision. I tried to break it on the axes most likely to fail — the TA hardcode (CLAUDE.md's named incident for this exact code), a `...ev` spread hiding behind a whitelist, the panel secretly living inside the `hidden`-toggled tabpanel, an auth gate on the menu, a 128-char `sig` overflowing at 1280px, and a test suite that looks like a gate but isn't. All six held, and three of them held under **mutation testing** rather than mere inspection. The one genuinely load-bearing gap (D6 has no CSS sentinel) was a ratified Tester scoping decision, is covered by driving this story, and is logged above rather than swallowed.

The differential is honest: local `npm test` is **Overall:FAIL** for the documented environmental reasons and this review does not claim otherwise — but the failing-suite set is **byte-identical to the `origin/staging` baseline**, and the two suites this story owns are green.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place (`stories/tag-event-inspector/1-tag-actions-menu-and-raw-event.md`).
- [x] Completion detection run — see below.

### Completion detection — the book looks complete

`audits/tag-event-inspector/book.md` is an **acceptance-frame** (no-PRD) book whose four frame bullets are the operator's verbatim ask. Against what shipped:

- ✅ *"The raw nostr event that defines a tag is viewable on that tag's page… not a summary"* — all 7 signed fields, verified rendered.
- ✅ *"Hidden by default and toggles… below the Pin button and above the Profiles|Notes switch"* — verified default-hidden and correctly placed in both the signed-in and signed-out branches.
- ✅ *"A new three-dot `⋯` menu floats to the right of the tag name"* — verified, reusing the emulated classes.
- ✅ *"Exactly three options: Copy Note ID (event id), Copy Note Addr, Show/Hide Raw Event"* — verified, exact labels, exact order.

Story #1 is the epic's only story and now passes review. The frame's **"Done looks like"** adds one condition this review cannot satisfy: *"ships to `staging`"* — so the book is **complete pending the staging deploy**, not complete today. The remaining promotion to `feat/tags`, and prod, are explicitly *"the operator's call, not this session's"*.

**Recommendation to the operator:** ship to staging, then `/close-book` is worth offering. The book is not closed by this review.
