# Review: Story 6 — Event-tag affordance on note surfaces

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-30
**Diff:** `git diff 2206a8e1..ea6eddbf` (impl commit `ea6eddbf`, tests `2206a8e1`)
**Story:** `engineering-team/stories/event-tagging/6-event-tag-affordance-on-note-surfaces.md`
**ADR:** `engineering-team/decisions/event-tagging/0006-event-tag-affordance-on-note-surfaces.md`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/event-tag-note-affordance-ui.test.js` — **15 passed, 0 failed** (source-contract gate).
- [x] `node test/profile-tags.test.js` — **13 passed, 0 failed** — the shared `TagChip` change is behaviourally backward-compatible.
- [x] `node test/note-surfaces-ui.test.js` — **19 passed, 0 failed** — `NoteCard`/`NoteActionsMenu` edits don't regress the reuse contract (incl. the "no variant fork" sentinel).
- [x] `ui` Vite build compiles clean (verified at implementation — all new JSX + the `useEventTagging`→`@tapestry/event-tagging` alias chain resolve).
- [x] **Browser verification (operator-run, this session, local stack + guard ON):** apply/dispute/create exercised on real notes; the relay shows the correct event sets — a brand-new tag (`drivechain`) published all **3** events (tag-element → header → assertion), an existing-but-headerless tag (`bird`) published **2** (header → assertion). The "discovered, not assumed" sequence logic verified end-to-end; every event local-only.
- [ ] _Lint / typecheck — not configured; none added._

## Spec adherence (acceptance criteria)

- [x] **Tags shown on a note, POV-aware** → `useEventTags` reads `for-event` (`useEventTags.js:41`); `NoteCard` renders `<NoteTags>` (`NoteCard.jsx:81`). Counts come from the POV-filtered `tags` channel.
- [x] **…durable own stance (survives reload)** → `NoteTags` unions `mine` into the displayed set (`NoteTags.jsx:38-51`) and drives the chip highlight via `myStance` (`:102-112`) from the Story-7 channel. *Browser-confirmed: tags persist as the viewer's across reload.*
- [x] **Apply / dispute existing** → `handleApply`/`handleDispute` → `useEventTagging` (`NoteTags.jsx:82-83`). *Browser-confirmed (polarity ±1 events).*
- [x] **Add existing tag not on the note** → `AddTagDialog onSelectExisting` → `applyTag({authorPubkey,slug})` (`:86,139`).
- [x] **Create brand-new tag** → `onCreateNew` → `applyTag({name,description})` (`:87,140`). *Browser-confirmed (3-publish sequence).*
- [x] **Affordance on EVERY note surface** → single integration point in `NoteCard`; `note-surfaces-ui` R-sentinel confirms all four surfaces still render through it.
- [x] **Logged-out / no-signer read-only** → viewer from `useAuth` (`:20-21`); add button gated on `viewerPubkey` (`:120`); `TagChip` disables apply/dispute when `!viewerPubkey` (its own guard). No publish path reachable logged-out.
- [x] **Partial-failure surfaced, retry-safe** → `run` reads `failedAt` and shows a retry-able banner (`:66-68`); refetch re-establishes truth.
- [x] **Local-only holds end to end** → `NoteTags`/`useEventTags` contain **no** publish path (grep clean); writes go through the guarded `useEventTagging`. *Browser-confirmed local-only.*

## ADR adherence

- [x] **Decision A + C + F realized.** One `NoteTags` unit in `NoteCard` (A); reuse `TagChip` + `AddTagDialog` via the `useEventTags` adapter, writes via the existing `useEventTagging` (C); per-note `for-event` read enriched from `available-tags` (F).
- [x] **`mine` consumed durably**, not optimistic-only — the corrected design from the ADR's post-review dependency. The viewer's stance is read from `mine` and shown **distinct** from the community count (the `myStance` prop keeps `applications`/`disputes` truthful).
- [x] **`NoteActionsMenu` "Tag Event" stub retired** (`NoteActionsMenu.jsx`, −1 button) — as the ADR directed.
- [x] **Stories 4 & 5 untouched** — consumed, not modified.
- [x] **`TagChip` change is the minimal, backward-compatible adapter** the reuse needed (optional `myStance`, `||` fallback) — within the ADR's "reuse via a thin adapter" intent; profile-tagging behaviour unchanged (13/0).
- [x] **Firmware reinstall?** No (no concept change).

## Things tests can't catch

- [x] No secrets, no debug logging, no commented-out code.
- [x] Error paths: read error banner, action error banner, partial-failure banner, logged-out gating, `!item.id` guard.
- [x] `useEventTags` aborts via a `cancelled` flag on unmount/dep-change (`useEventTags.js:32,82`) — no setState-after-unmount.
- [x] No new external publish path (the epic's hard invariant) — grep-clean and browser-confirmed.

## House rules check

- [x] No new lint/typecheck/build tooling.
- [x] Per-deployment TA rule respected — the new code composes no TA literal; identity comes from `useAuth`/runtime.
- [x] Server-side require-reload gotcha (restart `brainstorm` after src edits) applied during testing; the UI is static-served so the rebuilt bundle is picked up without restart.

## Findings

### Blocking
_None._

### Non-blocking
1. **`useEventTags.js:42` — `available-tags` is fetched per `NoteTags` instance, not shared.** The ADR's Option F note said it should be "fetched once (cache/share)"; as written, a feed of N notes issues **2N** requests (N×`for-event` + N×`available-tags`) rather than N+1. It's a cheap local read and the feature is sparse for v1, so not a correctness problem — but it slightly worsens the per-note fan-out the ADR already flagged. *Recommended follow-up:* lift `available-tags` to a shared cache/context (or fold both reads into the batch `for-events` endpoint already logged in `_intake.md`). Composes with that existing follow-up.
2. **`useEventTags.js:52` — synthesized `eventId` fallback (`${authorPubkey}:${slug}`)** for a tag not (yet) in `available-tags` (e.g. a brand-new tag in the propagation window before its tag-element is indexed). Used as the chip `key` and the `/tag/<slug>/<eventId>` link; transiently odd until the next refetch, then self-heals. Minor.
3. **`useEventTags` returns `loading` but `NoteTags` ignores it** — no loading indicator on the chip row. Cosmetic; acceptable for v1.

### Out of scope (not a Story-6 defect)
- The **tag detail page shows only profiles** (pubkey-taggings), so clicking an event-tag chip lands on a page without a Notes view. Found during browser testing; correctly diagnosed as a *different surface* (Story 6 is the affordance **on note surfaces**). Logged as **Story 8** ("tag detail page — Notes tagged with this tag: read endpoint + Profiles/Notes view", `_intake.md`, commit `1d87265c`). The chip→tag-page link is intentionally left as-is (it becomes correct when Story 8 lands).

## Verdict

**PASS**

The smallest change consistent with the ADR: one `NoteTags` unit in the shared `NoteCard`, reusing `TagChip`/`AddTagDialog` over a thin `useEventTags` adapter, writing through the guarded Story-5 hook, and consuming the Story-7 `mine` channel for durable own-stance. Every acceptance criterion has a passing source-contract test, the shared-component changes don't regress profile-tagging or note-surfaces, and the runtime behaviour was operator-verified end-to-end on the local stack (all sequences, local-only). The non-blocking items are a fan-out optimisation (already aligned with a logged follow-up) and two cosmetic notes. This completes the build arc of the event-tagging epic (Stories 1–7 done; Story 8 queued).
