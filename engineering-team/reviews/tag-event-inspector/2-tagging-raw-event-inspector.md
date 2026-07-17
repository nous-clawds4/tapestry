# Review: Story 2 — Raw event inspector for profile taggings

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-16
**Diff:** `git diff 1a36935e..HEAD` (impl `2831b1e0` + docs `29b48bc8`) — 7 files, +334/−5
**Book:** `engineering-team/audits/profile-tagging-inspector/book.md` (Open)

**Posture note.** The Implementer disclosed that their own self-reporting was wrong at least once this phase (a fabricated deviation, retracted in `29b48bc8`). I therefore re-derived every non-regression claim myself rather than auditing the summary. **All of them hold.** The disclosure was accurate and the retraction was correct — that is a point in favour of the record's reliability, not against it, but I verified regardless.

## Quality gates (run by reviewer, not trusted)

| Suite | Result |
|---|---|
| `tagging-raw-event-inspector-ui` (**the only automatic gate**) | **25 passed, 0 failed** |
| `tag-detail` | **28 passed, 0 failed** |
| `tag-actions-menu-ui` (Story 1 — AC-6 non-regression) | **30 passed, 0 failed** |
| `tag-read-union` | 18 passed, 0 failed |
| `profile-tag-consume-by-a-coordinate` | 15 passed, 0 failed |
| `tag-detail-write` | 4 passed, 0 failed |
| `tag-detail-curated-view-and-pin-polish` | 33 passed, 0 failed |
| `harness-lint` | clean (0 violations) |

- `npm test` overall — **FAIL, environmental** (`OPEN.md` #27, near-empty local Neo4j). Not this story's doing. `tag-detail-publish` shows 8/2/2; I confirmed the 2 failures are pre-existing Meili-enrichment tests unrelated to this diff.
- `npm run test:playwright` — **not run, and correctly not written.** Nothing runs Playwright (`OPEN.md` #13 records the ratified deferral). The test plan's "What actually gates" table is accurate and unusually honest: live-HTTP suites skip wholesale in CI (`tag-detail.test.js:268-271`), so the stack-free source suite is the only automatic gate. I re-verified the gate's registration lands in the **live** `overallOk` chain (`OPEN.md` #43's severed `;`) — it does.
- Lint / typecheck / build — not configured; skipped per house rules.

## Spec adherence

- [x] Every acceptance criterion has a passing test — AC-1 (`U10`,`U7`), AC-2 (`U3`,`U11`,`U13`,`R9`), AC-3 (`U5`,`U6`,`U12`), AC-4 (`U14`,`U18`,`U19`,`U1` + the runtime invariant + whitelist set-equality), AC-6 (`R7`,`R3`,`R4`,`R1` + envelope regression). AC-5 is source-covered only — see Non-blocking #3.
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story. `_intake.md` is **purely additive** (26 insertions, **0 deletions** — verified by `--numstat`), and the ADR-0001 `<ActionsMenu>` entry is untouched; its single mention in the diff is a new cross-reference explaining why that trigger has *not* fired.

## ADR adherence

- [x] Files match the ADR's implementation notes exactly (7 files, all named in D1–D6).
- [x] Layering respected. **D2's seam is honoured precisely**, and this is the part I scrutinised hardest: `aggregateProfilesTagged` returns `authorAllowed` and nothing else new (`index.js:693`); the response shaping stays in `handleProfilesTagged`, which is what the helper's own docblock demands ("that's the caller's job").
- [x] No new dependencies (`package.json` untouched).
- [x] `toRawEvent` reused, declared exactly once (`R8`).

**I independently audited the `counted` predicate**, since no gate proves its semantics (`index.js:971-985` vs the counts loop at `:669-685`):

- An event is `counted:true` iff `authorAllowed(ev.pubkey) && non-neutral && has p-tag` — **identical** to the counting condition. The reconciliation invariant therefore holds *by construction*, not by coincidence. ✅
- Signed out (`viewerPubkey` null), `ev.pubkey !== null` is always true, so uncounted events are dropped and every block is `counted:true`. ✅
- `counted:false` is reachable **only** via the viewer-union — exactly the case AC-4 describes and the flag exists for. ✅
- No double-count: one pass over `deduped`, each event visited once. ✅
- No orphans: every `assertionsByTarget` key has a `byTarget` entry (via the counts loop or the viewer-union). ✅
- The sort is a genuine **total** order (polarity → `created_at` desc → `id`), so equal timestamps cannot swap between requests. ✅

**Assertion data cannot reach a published kind-30392 TL** — two independent mechanisms, both verified: (i) `entry.assertions` is assigned only inside `handleProfilesTagged`'s enrichment loop, which `refreshPinnedTags` never runs (it calls the *helper*, `refreshPinnedTags.js:156`, destructuring `{ byTarget }` alone); (ii) `applyDisputesFunction` (`:104-119`) still whitelists `{pubkey, endorsements, disputes}` rather than spreading. Only two callers of the helper exist; I enumerated them.

## Concept-graph integrity

- [x] Handles remain `kind:pubkey:slug`; the story/ADR cite `nostr-user-tag` / `nostr-event` correctly and the graph's own "**each element** links a target pubkey to a tag event ID" is the load-bearing authority for the story's central fact.
- [x] **No firmware reinstall required** — `firmware/` untouched (verified), no concept definitions changed. ADR answers this explicitly.
- [x] No BIBLE.md re-derivation.

## Architecture invariants (CLAUDE.md)

- [x] **No TA literal.** Comment-stripped scan of `TagPageRow.jsx` and `TagRowRawEvents.jsx`: **0** hits for 64-hex / `LEGACY_(TA|Z_TAG)_PUBKEY` / `taPubkey`. Correct — a tagging's author is runtime data off the event; this feature needs no TA. ADR-0015's exception does not reach it, and no `LEGACY_*` constant was removed.
- [x] **POV — checked against the AMENDED guardrail, not the original.** Each event's bytes are the untouched 7-field projection; nothing POV-namespaces, filters, or annotates *inside* `toRawEvent`. *Which* events appear is per-POV by construction (`authorAllowed` = `wot_rank_<suffix> >= minRank`) and computed at read time — nothing precomputed, denormalized, or stored. This is the opposite finding from Story 1's ADR and it is **correct**: the guardrail amendment separating "the bytes" from "the set" is what makes both stories consistent, and the code lands on the right side of that line.
- [x] **Decentralized-first.** No authorship gate; no auth gate. Verified by driving: the item renders **signed out**.
- [x] **Filter at view time.** `assertions` is a per-request projection.

## Things tests can't catch

- [x] No secrets. No `console.log` / `debugger` / TODO / FIXME in the new code (grepped).
- [x] No commented-out code.
- [x] **XSS:** `JSON.stringify(a.event, null, 2)` renders as React text content in a `<pre>`; no `dangerouslySetInnerHTML` anywhere. Event `content` is arbitrary attacker-controlled data and is correctly escaped by React. ✅
- [x] **Keying:** blocks keyed by `a.event.id` (unique per event); rows keyed by `row.pubkey`, so per-row `rawOpen` survives a refetch/re-sort. ✅
- [x] **Resize edge case I checked:** modal menu open at 390px → resized to ≥769px. The base `.bs-tag-row-overflow { display: none }` hides the whole subtree (the sheet is a DOM child, `position:fixed` notwithstanding), so the menu vanishes exactly as it did before this change. **No regression.**
- [x] Error paths: `row.assertions?.length` guards both the click handler and the panel render.

## AC-6 non-regression — re-derived by me, not taken on trust

| Claim | Verified |
|---|---|
| `TagSomeoneModal.jsx` diff | **0 lines** |
| `is-scores-pinned` touched | **0** (the retracted fabrication was indeed false; baseline already had it) |
| `.bs-tag-raw-pre` rule changed | **0** |
| base wide `display:none` removed | **0** — retained, which is what spares the modal |
| `.bsp-note-menu` **rule** changed | **0** (the diff's only hit is a comment citing it) |
| `TagActionsMenu.jsx` changed | **0 lines** |
| `useTagDetail.js` changed | **0 lines** (ADR predicted no change; correct) |
| `test/` files in impl commits | **0** — the Implementer did not touch tests |

**D5's two leaks are genuinely closed**, and I verified the mechanism rather than the claim: the prop gate (`showRawEvent = false` default) plus the positively-scoped `.is-raw-enabled` override. I reproduced the Implementer's proof — stripping `is-raw-enabled` from a row at 1280px flips the kebab `flex → none`, i.e. a modal row keeps no desktop kebab. This is the failure mode that would have passed every other test.

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/components/TagRowRawEvents.jsx:49` — native `title=` instead of the house `data-bs-tooltip=`.** This is a real convention miss, not a style preference: `data-bs-tooltip` is ratified by **ADR 0016 (Option 5A)**, implemented in 8 CSS rules, reused by ADR 0018, and used by **all five** tooltips in `TagPageRow` itself (`:239, :247, :254, :264, :304`) — whose docblock (`:25-28`) states the rule verbatim: *"Native `title=` attributes migrate to `data-bs-tooltip=` … Each migrated node keeps its accessible name via `aria-label`."* The only other bare `title=` in the family (`TagActionsMenu.jsx:94`) was explicitly justified in Story 1's Deviations; this one is an oversight. **Not blocking** because the effect is confined to tooltip onset speed, the pill carries visible text (`"not counted under this POV"`) so no information is lost, and `title` is arguably *better* for screen readers than a CSS `::after`. **Asked change (follow-up):** migrate to `data-bs-tooltip=` + `aria-label`, matching its five siblings. Worth doing before the next story copies it.
2. **`ui/src/styles.css` — `.bs-tag-row-overflow-help` is unscoped** in the `@media (min-width: 769px)` block, while its two neighbours are scoped to `.bs-tag-row-overflow-menu`. Harmless today (the class only ever renders inside the menu, `TagPageRow.jsx:357`), but the asymmetry is a trap if that class is ever reused. Optional: scope it for consistency.
3. **`TagPageRow.jsx:373-380` — `rawNotice` is never cleared except by a successful toggle.** ADR's implementation note said "cleared when the menu reopens"; the code only clears it on the success path, so an "unavailable" warning persists under the row indefinitely. **Near-unreachable** (every real row has ≥1 assertion by construction; this fires only against a server predating this field), and AC-5 asks for "a visible message" without requiring transience. Minor ADR-note drift, not behavior drift.
4. **ADR 0002 D2's wording is imprecise** — it claims the design "keeps assertions out of `byTarget` entirely", but `entry.assertions` *is* assigned onto `byTarget` entries (`index.js:~995`), exactly as `displayName`/`picture` already are. The **safety property** it was asserting nonetheless holds via the two independent mechanisms above. Documentation nit for the book-close audit; no code change.

### Harness friction

None new this story. Three pre-existing items were correctly navigated rather than tripped over: `OPEN.md` #43 (the severed `overallOk` chain — the new suite's term is in the live chain, verified), #27 (environmental `npm test` FAIL — the differential was used instead), and #13 (Playwright's ratified CI deferral — no dead spec written). `OPEN.md` #47 was filed this cycle for the L2 epic/book-span gap and is correctly waived with a citation.

## Assessment of the disclosed verification gap

The Implementer flagged that **`counted: false` is proven by no automated gate and cannot be proven on this machine**, and asked me to audit the predicate by reading it. I did (above): the predicate is provably correct against the counts loop, so I am **not in doubt** — which is the bar the role sets for blocking. The environmental reasoning also checks out: `/var/lib/brainstorm` is a Docker **named volume**, so `settings.json` is unreachable from the host; the container lacks `nak`; and with no POV threshold locally, `authorAllowed` is `() => true`, making the `false` branch unreachable *by construction* regardless of tooling. The gap is real, correctly disclosed rather than hidden, and correctly routed to staging. **Naming it in the story is the right outcome; it does not block a staging deploy — but it is the first thing to check there.**

The test plan's "Known coverage gaps" list is honest and, as far as I can tell, complete. I found no gap it failed to name.

## Verdict

**PASS**

The diff conforms to the story, the ADR, and the amended epic guardrails. All acceptance criteria are covered; the only automatic gate is green at 25/25 (from 9/16 at an isolated baseline); Story 1's surface is byte-unchanged; the modal is untouched at zero diff lines; no TA literal; no firmware reinstall; no new dependencies. The four findings are non-blocking — the strongest (`title=` vs `data-bs-tooltip=`) is a one-line cosmetic convention miss on a new node, and blocking a diff of this quality on tooltip onset would be pedantry rather than skepticism.

Two things distinguish this diff and are worth recording for the book-close audit: the `counted` flag, which turns AC-4's promise from *approximately* true into *exactly* true and which no test forced the Implementer to add; and the D5 prop gate, which closes a leak that every other test in the suite would have missed.

**Deploy target: `staging`. Do not promote to `main`.** On staging, verify `counted: false` first (a real POV threshold `povSuffix a1420e44` and multi-author rows exist there: `podcaster` Avi Burra `+4 −0`; `verified-human` NY Times NewsBot `+0 −3` with zero applies; `aos-2026-participant` 99 rows/108 assertions), plus the five other driving-only gaps the test plan names.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection run — see below.
