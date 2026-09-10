# Review: Story 3 — Tag a DList item

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-10
**Diff:** `git diff 5335291d~1 3a39574b` (commits 5335291d test-plan+suite → e4cc3b2c story-4 draft → 3a39574b impl) on `feat/dlist-item-tagging`
**Profile:** Light (trial) — Gate B, full rigor. Tier assigned after writing: **full-depth** (new user-facing affordance on every list row plus a new modal branch; not a mechanical change).

## Quality gates (run by reviewer, not trusted)

| Gate | Command | Result |
|---|---|---|
| Scoped gate — story suite | `BRAINSTORM_BASE_URL=http://localhost:8778 direnv exec . node -e "require('./test/dlist-item-tagging.test.js').run()…"` (brace-redirect, exit captured) | **20 pass / 0 fail / 0 skipped, EXIT=0** — U1–U7, S1–S7, R1–R6 green |
| Scoped gate — guard suite | same form, `test/strfry-write-assertion-bracket.test.js` | **6 pass / 0 fail / 0 skipped, EXIT=0** |
| Full `npm test` | not run — operator constraint (scoped gate only; full suite is the book-close gate) | — |
| Playwright | not run (no spec in scope) | — |
| Lint / typecheck / build | not configured for the harness; UI eslint config exists but is not a house gate | — |

Pre-implementation baseline recorded in the story (`6 pass / 14 fail`) → post: 20/0. U/S handles measured something.

## Gate-A classification — ratified

Irreversibility triggers walked: **wire format** — no; the `a`-target assertion shape and the story-2 `d` rule are reused unchanged (`filterTagsAppliedToEvent` already branches on `{ address }`; `useEventTagging` untouched). **Auth/trust default** — no; per-POV read via `for-event`, `mine` from `viewerPubkey`, no author gate. **Schema/firmware** — no; `nostr-event-tag` already names e-or-a targets. **New dependency** — no; `nostr-tools` was already imported in `dlistFields.js`. **Cross-repo contract / routing / middleware / headers / multi-repo value** — no server change at all. **Design note stands.**

## AC verdict table

| AC | Handles | Evidence | Verdict |
|---|---|---|---|
| AC-1 row affordance, `a` target, publish gate | U1, U2, S1–S4, R4 | `DListItemTags.jsx:12` → `target={itemTarget(item)}`; `NoteTags.jsx:27` shares `target` between `useEventTags` and all four writes (`applyTag`×3, `disputeTag`×1 at :143–:151); `useEventTagging` unchanged → `publishOrThrow` | PASS |
| AC-2 per-POV chips + own stance | S1–S3 | `useEventTags.js:66` sets `address=`; server `handleForEvent` (`src/api/event-tags/index.js:151–182`) validates `isACoord`, scans `#a` via `filterTagsAppliedToEvent`, and passes `viewerPubkey` into `classifyEventTaggings` identically for both targets → `mine`/`rawEvents`/`povResolution` returned for address targets | PASS |
| AC-3 dispute / re-apply, no reload | S2, R4 | `run()`/`refetch()` unchanged; effect deps `target.id, target.address, …, nonce` (`useEventTags.js:118`) | PASS (code-verified; live click-through is the operator's Gate-B step) |
| AC-4 signed-out read-only | S2 | `!hasTags && !viewerPubkey → null` / `viewerPubkey && <button>` branches intact (`NoteTags.jsx:153`, :212) | PASS |
| AC-5 paste `naddr` / coordinate | U6, U7, S5 | `TagANoteModal.jsx:100–103` `parseItemRef` before `classifyEventInput`; resolve `queryRelay({kinds:[39999],authors,'#d'})`; `runTag` passes `{ address }` when `hasItem`; count read uses `address=` | PASS |
| AC-6 note tagging unchanged | R1, R2, R3, S5 | `NoteCard.jsx` and `eventParam.js` have zero diff in range; default `subject='note'` renders `"Tags on this note"` / `"Add a tag to this note"` byte-identically; modal note branch, `REASON_COPY`, placeholder prefix unchanged | PASS |
| AC-7 nav links `/lists` | S6, R5, R6 | `avatarMenuLinks.js:78` in `destinationLinks`; all three renderers map it (`BrainstormSearch.jsx:568` via the shared `AvatarMenuLink`, Header, BrainstormUserMenu); `/lists` route in `App.jsx` | PASS |

## Evidence table (probes beyond the plan)

| Probe | What I checked | Result |
|---|---|---|
| NoteTags defaults byte-identical | diffed `NoteTags.jsx`: only the prop signature, the `target` hoist, and the two template-literal aria-labels changed; `useEventTags(target)` receives `{ id: item?.id }` — same object shape the hook previously built from the string | identical for notes |
| `useEventTags` deps + `mine` for address | deps are primitives (`target.id`, `target.address`), so the per-render `itemTarget(item)` object does not loop; empty-target guard `!target.id && !target.address` | correct |
| `parseItemRef` on a 39998 naddr | `data.kind !== 39999 → null` → note path → `naddrUnsupported` reason as before (U7 covers) | correct |
| `parseItemRef` on kind-9999 coordinate / bare hex | null (by design, non-addressable) | as specified |
| Modal header resolve via `z` | `parseListRef` handles hex `{ id }` and coordinate forms; wrapped in its own try → `fieldDecls = []` on miss; `DListItemsTable` defaults `profiles`/`voteCounts` to `{}` so the one-row mount is safe | correct |
| Modal path exclusivity | item hit clears `resolveArg` (→ `useEventResolve` short-circuits, `data=null`, `resolvedOk=false`); note hit clears `itemRef` (→ `itemOk=false` even with stale `itemState`) | no dual render |
| exhaustive-deps warning | HEAD~1 `useEventTags.js:112` deps omit `povParams` while the effect reads `Object.entries(povParams)` — pre-existing | not this story |
| Collateral | `git diff … --stat -- NoteCard.jsx eventParam.js` empty; story-1 R5 sentinels pass; `DListItemsTable`/`DListItemRow` untouched | clean |
| TA pubkey literal | S7 passes; no 64-hex literal in the seven touched UI files | clean |
| Concept graph | no concept/firmware change; handles remain `kind:pubkey:slug`; no reinstall needed | clean |
| Secrets / debug / commented code | none in diff | clean |

## Spec / ADR / house rules
- Every AC has a passing handle; none dropped. Behaviour beyond the story is limited to the five logged Deviations, all small and all consistent with the Design note's intent.
- Blast radius honoured: the diff touches exactly the files the Design note lists plus `test/test.js` registration. The range also contains `e4cc3b2c` (story-4 draft) — a story file, not implementation; not scope creep.
- No new lint/typecheck/build tooling. Publish path unchanged (local strfry only).

## Findings

### Blocking
None.

### Non-blocking
1. **`ui/src/components/NoteTags.jsx:31` + Design note "Invariants"** — the per-row fan-out is under-counted. Each row's `NoteTags` also mounts `useTagApplicability('event', viewerPubkey)`, which fires **two uncached** `GET /api/tags/applicability` requests per mount (`useTagApplicability.js:41–42`; no shared promise like `fetchAvailableTags`). A 50-item list is therefore ~150 requests (50 `for-event` + 100 applicability), not 50 + 1. This is the exact pattern the note feed already has, so it is not a regression introduced here — but the story's "measure before batching" note should measure the applicability pair too. Suggest: a module-level TTL cache in `useTagApplicability` mirroring `fetchAvailableTags` (its own small story; not this one). The operator's signed-out headless evidence (7 `for-event` calls) does not contradict this — applicability calls hit a different path and were not in the count.
2. **`ui/src/utils/dlistFields.js:174–178`** — `HEX64` is `/i`, so a pasted `39999:<UPPERCASE-HEX>:<d>` coordinate is accepted and its `address` is built with the uppercase pubkey. The server's `isACoord` is lowercase-only and strfry `authors:` won't match, so the modal lands on "Couldn't load that list item" (E6) and nothing is published — safe, but the error is misleading. Optional: `pubkey.toLowerCase()` in the coordinate branch (the `naddr` branch already yields lowercase from `nip19`). Same latent quirk exists in `parseListRef` for coordinates.
3. **`ui/src/components/TagANoteModal.jsx:193`** — the input's `aria-label` still says "Paste a note identifier to tag" while the placeholder now advertises list items. Cosmetic.

### Harness friction
None. Scoped gate ran cleanly under the operator's brace-redirect form.

## Operator Gate-B step (not performed here)
The write affordance and the `/lists` menu entry sit behind sign-in, so this review verified them by source only. The operator's browser check on :8778: open `/list/39998:b83a28b7…:github-accounts` signed in → apply a tag on a row → chip appears with "mine" highlight → dispute → re-apply, no reload; then Tag page → "+ Tag a Note" → paste the item's `naddr` → one-row table renders with GitHub link → Apply → count reads back. Also confirm chip density inside the table cell is acceptable (story "Not covered").

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place (`engineering-team/stories/dlist-item-tagging/3-tag-a-dlist-item.md`).
- [x] Completion detection performed: book `dlist-item-tagging` frame bullets 1–3 now satisfied (stories 1–3); bullets 4 (tag page Items view, story 4) and 5 (pins/TLs, story 5) remain open → **book not complete; no close offered.**
