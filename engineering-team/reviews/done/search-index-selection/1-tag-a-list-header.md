# Review: search-index-selection #1 — Tag a list header

**Reviewer:** Claude (acting as Reviewer) — Gate B, Light profile
**Date:** 2026-09-18 (round 2; round 1 same day)
**Branch:** `feat/search-index-selection`, HEAD `04d2bb95`
**Diff under review (round 2):** `04d2bb95` on top of `f18ab211` (implementation) ·
`f12c62bc` (sentinel re-aim) · `b6ceac8c` (ledger)
**Story:** `engineering-team/stories/search-index-selection/1-tag-a-list-header.md`
**Test plan:** `engineering-team/test-plans/search-index-selection/1-tag-a-list-header.md`
**ADR:** none (Light — Design note in the story; composition rule inherited from
`decisions/dlist-item-tagging/0001-addressable-target-dtag.md`)
**Book:** `engineering-team/audits/search-index-selection/book.md` (acceptance frame, bullet 1)

---

## Round 2 — re-review of the fix

Round 1 was **CHANGES_REQUESTED** on one blocking issue: the `NoteTags` header mount in
`ui/src/pages/List.jsx` was unconditional, so a legacy **kind-9998** list page (32 in the local
corpus) rendered a tag affordance whose target was the header's **event id**, not a coordinate —
a live 400 on read and, on write, a permanently unresolvable `['a', <id>]` assertion with empty
`author8`/`d16` d-tag segments. That violated AC-2 and AC-6. Round 1's full findings are kept
below as history.

### What `04d2bb95` changes

| File | Change | Verdict |
|---|---|---|
| `ui/src/pages/List.jsx:163-169` | the mount is now `{header.kind === 39998 && (<NoteTags … subject="list" />)}`, with a comment naming the 9998 reason and pointing at OPEN 308 | **Closes the blocker.** |
| `test/tag-a-list-header.test.js:417-429` | new **R8** pins both halves of the finding: the source-level gate (`/header\.kind === 39998 && \(\s*<NoteTags\b/`) *and* the underlying fact (`headerCoord({kind:9998,…})` returns the event id) | Good handle — it fails if either the gate or `headerCoord`'s 9998 behaviour changes, which is exactly the coupling that produced the bug. |
| `test/tag-a-list-header.test.js:313` | **S5** loosened to `not on this relay\|\{NOT_HERE\}` inside the headers branch | Correct fix for round-1 Non-blocking 1 — the sentinel was the obstacle, not the code. The file-level literal assertion at `:311` is unchanged, so the copy is still pinned somewhere. |
| `ui/src/components/TagItemsView.jsx:147` | reuses the `NOT_HERE` constant (`:37`), matching the other call site at `:168` | Round-1 Non-blocking 1 resolved; the duplicate literal is gone. |
| `OPEN.md:364` | **OPEN 308** records the 9998 gap and the open design question (`{ id }`/`e` target vs "a non-addressable list is not indexable") | Satisfies the round-1 ask to record the gap. Correctly framed as *not this story's call*. |

The fix is the narrow one I asked for: it does not attempt to take the 9998 design decision,
and it does not touch `headerCoord`, the write path, or any resolution code.

### Quality gates (run by reviewer, not trusted)

Nix shell (`direnv exec .`, no system node), each suite in the foreground, exit code captured by
brace-redirect — never piped through `tail` (OPEN #157).

- [x] **Gate-A scoped gate + the guard suite — all green.**
      `tag-a-list-header` **28/0/0** (EXIT=0, +1 = R8) ·
      `dlist-tagged-items` **34/0/0** (EXIT=0) ·
      `dlist-browse` **25/0/0** (EXIT=0) ·
      `trusted-list-raw-view` **25/0/0** (EXIT=0) ·
      `dlist-item-tagging` **21/0/0** (EXIT=0).
      No skips anywhere; `dlist-browse` **U2** ("headerCoord … falls back to id for 9998") and
      `dlist-item-tagging` **S4** (the re-aimed no-raw-`NoteTags` sentinel) both still pass with
      the mount now wrapped in a conditional — the JSX-brace wrapper did not defeat the regex.
- [x] **ESLint** on `src/pages/List.jsx` + `src/components/TagItemsView.jsx` — clean, EXIT=0.
- [ ] **Full `npm test`** — not run (capped by instruction; under Light it is the book-close /
      promotion gate, not the per-story gate). **No `gate:status` line for this review** — the
      counts above are per-suite foreground runs, and the full-gate verdict is still owed at
      book close.

### Live verification (the blocker, end to end)

Panel restarted (`docker exec tapestry supervisorctl restart brainstorm`); the bundle served at
`:8778` is `index-Crd5-320.js` (round 1 saw `index-hotNmK0S.js`), and it carries the gate in
minified form — `…bs-dlist-coord…r.kind===39998&&t.jsx(xN,{item:r,target:{address:Pd(r)},subject:"list"})` —
so the deployed code is this commit. Headless Chromium, `page.route` stubs for
`/api/auth/status` + `/api/auth/user-classification` (house pattern); nothing signed or published.

- **kind-9998 — `/list/aaef5be616323473fc64fc5a4b4685b1457d62ec059b5fffb1ee773908346a50`**
  ("tabs"). Header renders title, "Each item is a tab — …", author, and the bare id as the
  coordinate line. **Zero buttons in `.bs-dlist-header`** — no `+` affordance. The only
  `for-event` requests on the page are the two per-item reads for
  `address=39999:2efaa715…:2057e8f3-…` — i.e. **no `for-event?address=<64-hex id>` is issued at
  all**, and therefore no 400. Round-1's observed failure is gone.
- **kind-39998 — `/list/39998:b83a28b7…:github-accounts`.** Header block unchanged from round 1:
  the `+` affordance renders, and its read is
  `GET /api/event-tags/for-event?address=39998%3Ab83a28b7…%3Agithub-accounts&wotPov=house&viewerPubkey=…`
  — the **coordinate**, not the id. The seven per-item `39999:…` reads follow, unchanged.

Both halves of the asked change are confirmed against the running stack, not just the source.

### Round-1 non-blocking items — status

1. **Duplicated `list not on this relay` literal** — **fixed** (`TagItemsView.jsx:147` now uses
   `NOT_HERE`), by loosening the sentinel rather than by keeping the duplication, which is the
   order I asked for. `PinnedListPanel` keeps its own literals; it has no such constant, so that
   remains consistent with its file.
2. **`test/dlist-item-tagging.test.js:255` — `/<NoteTags\b[^>]*subject="list"/` is brittle against
   a prop containing `>`** — **still open, still acceptable.** It survived this round's mount
   rewrite (the conditional wraps the element; the props did not change). Non-blocking.
3. **`PinnedListPanel.jsx:728` raw `<a href>` vs `TagItemsView`'s `<Link>`** — unchanged,
   consistent with the rest of that file. Non-blocking.
4. **A kind-39998 header with no `d` tag still yields `39998:<pk>:`** (`dlistFields.js:66-68`) —
   **still open.** The gate chosen is `header.kind === 39998`, not "`headerCoord` returns an
   a-coordinate", so this theoretical case is not closed by the fix. It stays theoretical: zero
   such events in the local corpus (405 sampled) and the malformed value would be caught at
   resolution, not at write. Non-blocking, and it is a smaller surface than OPEN 308 (which names
   `headerCoord` among its files, so the eventual 9998 work will pass through here anyway).
5. **Stale Deviations in the story file** (new, cosmetic). `stories/search-index-selection/1-tag-a-list-header.md:195-198`
   still says the notice "is written as a literal in both headers branches" and `:205-214` still
   carries the `dlist-item-tagging` S4 item as "**BLOCKING** — surfaced unfixed"; both were
   resolved by `04d2bb95` and `f12c62bc` respectively. The review record and OPEN 308 carry the
   true state, so this is documentation drift, not a defect — worth a line in the book audit §7
   rather than another round.

### Spec adherence (round 2)

| AC | Verdict | Evidence |
|---|---|---|
| **AC-1** affordance on the header block | **Pass** | `ui/src/pages/List.jsx:167` inside `.bs-dlist-header`; S1/S2 green; live `+` observed on the 39998 page. |
| **AC-2** targets the coordinate, never the id | **Pass** | Round 1's exception is closed. The mount is reachable only for `kind === 39998`, for which `headerCoord` returns `39998:<pk>:<d>`; U10 pins `['a', …]` with no `e`; R8 pins the gate and the 9998 fact; live read carries the coordinate and the 9998 page issues no header read. |
| **AC-3** tagged header resolves for display | **Pass** | `src/api/event-tags/index.js:102-134` + the rewritten loop `:588-597`; U7–U9, S3/S4/S6/S7 green. |
| **AC-4** stance parity | **Pass** | Same `NoteTags` → `useEventTags` / `useEventTagging` path (S9); no new write surface. |
| **AC-5** item/note/profile tagging unchanged | **Pass** | R1–R7 green; `itemCoord`, `NoteTags.jsx`, `listCoordOf`, `toTableItem` untouched across all four commits. |
| **AC-6** no misleading group heading | **Pass** | `groupItemsByList` (`ui/src/utils/dlistHeaders.js:75-87`) leading `{ headers: true, listCoord: null }` group; U1–U3 green; E8 byte-identity held by U5/U6 and `trusted-list-raw-view` U12. Round 1's "degrades legibly" concern for 9998 is met by showing nothing rather than something broken. |

Edge cases E1–E8 covered as planned. No behaviour beyond the story in this round: one JSX
conditional, one constant reuse, one test, one ledger row.

### Design-note / classification ratification (Light Gate B)

**Design note, not ADR — ratified**, unchanged from round 1's reasoning: no wire format, schema,
auth default, dependency, cross-repo contract, routing or header change. The round-2 fix is a
client-side render gate; it *narrows* what can be published, which is the safe direction and does
not constitute an auth/trust default (any pubkey may still tag any addressable target — the
principle-2 check holds; what is removed is a UI path that could only mint a malformed target).
Blast radius held to the declared files.

### Concept-graph integrity
- [x] Handles untouched; the change is exactly about honouring `kind:pubkey:slug` rather than
      forcing `39999:`.
- [x] No concept definitions changed → no firmware reinstall needed.
- [x] No re-derivation from BIBLE.md in new code.

### Architecture invariants
- [x] **No TA-pubkey literal** in the diff (the `04d2bb95` diff contains no 64-hex literal outside
      the test's `'a'.repeat(64)` / `'b'.repeat(64)` fixtures). `LEGACY_*` constants untouched.
- [x] **No write-time gating of publication.** The server still accepts any addressable kind.
- [x] **POV cascade unchanged.** `povSuffix` / `minRank` / `povResolution` and the `forTagCache`
      key untouched; resolution stays at read time per request.
- [x] **Local-first:** read-only; nothing deleted or rebuilt.

### Things tests can't catch
- [x] No secrets, no `console.log`, no TODO/FIXME, no commented-out code.
- [x] No race introduced.
- [x] The write-boundary hole flagged in round 1 is no longer reachable from the UI. Note for the
      record: `src/lib/event-tagging/builders.js:193-208` still does **no** coordinate validation
      on `{ address }`, so a hand-rolled client could publish the malformed assertion. That is a
      pre-existing gap in a shared builder, wider than this story, and OPEN 308 names the file.

### House rules
- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling; `package.json` untouched.

### Harness friction (for the book audit §7)
1. The Gate-A scoped gate did not name `dlist-item-tagging`, yet that was the suite the story
   broke and then edited — the scoped-gate naming rule under-selected the guard set.
2. The blocker was a *live-behaviour* class (a real corpus kind the story never modelled) that
   no source-level sentinel could have caught; it took a browser run against `:8778`. Worth
   recording as evidence for what the Light interior's J3 cannot see.
3. Story Deviations were not updated when the deviations were resolved (non-blocking item 5).

---

## Round 1 (2026-09-18, HEAD `b6ceac8c`) — CHANGES_REQUESTED, kept as history

> Verdict of that round: CHANGES_REQUESTED on one blocking issue. Everything else was found
> sound. Reproduced below for the record; the gate numbers are that round's.

**Gates then:** `tag-a-list-header` 27/0 · `dlist-tagged-items` 34/0 · `dlist-browse` 25/0 ·
`trusted-list-raw-view` 25/0 · `dlist-item-tagging` 21/0 (after `f12c62bc`); ESLint clean; full
`npm test` not run. `test/registry.js:222` carries the new suite, so it is in the full gate.

**Blocking 1 — `ui/src/pages/List.jsx:164`, the header affordance was mounted unconditionally.**
`headerCoord` (`ui/src/utils/dlistFields.js:65-70`) returns the header's **event id** for a legacy
**kind-9998** header, and `/list/:ref` serves those pages (`parseListRef`'s
`HEADER_KINDS = {9998, 39998}`, `:20`; `/lists` scans `kinds: [9998, 39998]`,
`ui/src/pages/Lists.jsx:45`). 32 kind-9998 headers exist locally. Verified both ways:
*read*, live on `/list/aaef5be6…346a50` — `GET /api/event-tags/for-event?address=aaef5be6…346a50`
→ **400 `address must be an a-coordinate <kind>:<author>:<d>.`** while the `+` still rendered;
*write*, by inspection — `NoteTags` passes `target` through to `buildEventTaggingAssertion`, whose
`{ address }` branch (`src/lib/event-tagging/builders.js:193-208`) does no coordinate validation,
so applying a tag would publish `['a', '<64-hex id>']` with empty `author8`/`d16` d-tag segments:
permanent, unresolvable (`isACoord` rejects it at `:99`; an id-keyed 9998 never enters
`itemMembers` because the classification scan is `kinds: [9999]`), violating AC-2 and AC-6.
*Asked change:* gate the mount on the header actually having a coordinate; add a regression handle;
record the 9998 gap in "Out of scope" or as an OPEN row. (**All three done in `04d2bb95`.**)

**Round-1 non-blocking:** (1) duplicated `list not on this relay` literal at
`TagItemsView.jsx:147` caused by S5's source slice — *now fixed*; (2) brittle
`<NoteTags…subject="list"` regex at `test/dlist-item-tagging.test.js:255` — *still open*;
(3) `PinnedListPanel.jsx:728` raw anchor vs `<Link>` — *still open, consistent with its file*;
(4) a `d`-less kind-39998 would yield `39998:<pk>:` — *still open, theoretical*.

**Round-1 ratifications that carry forward unchanged:** Design-note (not ADR) classification;
blast radius held to six files; the story's Deviations 2 (`tags.length > 0` as the resolution
signal), 3 (four CSS classes), and 4 (the `f12c62bc` S4 re-aim, which tightened the sentinel in
practice by additionally requiring `subject="list"` on every `NoteTags` in `List.jsx`); the
per-bucket strfry scan failure path (`src/api/event-tags/index.js:592`) accepted with shape-only
coverage; `/for-tag` response keys verified byte-identical live.

---

## Verdict

**PASS.** The round-1 blocker is closed at the source (`ui/src/pages/List.jsx:167`), pinned by a
regression handle (R8), verified live on both a kind-9998 and a kind-39998 list page against the
running panel, and the design question it exposed is parked honestly as OPEN 308 rather than
silently decided. The scoped gate plus the guard suite are green under my own run — 28/0, 34/0,
25/0, 25/0, 21/0, ESLint clean. Two round-1 non-blocking items are fixed; the three that remain
are theoretical or stylistic, and one new item (stale Deviations prose) is documentation drift for
the book audit. The full `npm test` gate remains owed at book close.

Story `**Status:**` set to `Done` in the same change. Book completion detection: the
`search-index-selection` book's acceptance frame has further bullets open, so no close is offered
yet.
