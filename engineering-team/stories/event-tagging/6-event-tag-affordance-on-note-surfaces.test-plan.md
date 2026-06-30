# Test Plan: Story 6 — Event-tag affordance on note surfaces

**Story:** `engineering-team/stories/event-tagging/6-event-tag-affordance-on-note-surfaces.md`
**ADR:** `engineering-team/decisions/event-tagging/0006-event-tag-affordance-on-note-surfaces.md`
**Date:** 2026-06-30

## Approach

Two layers, matching how this repo tests UI stories (note-surfaces-ui / live-feed-feed-page / the profile-* suites):

1. **Source-contract CJS suite (`test/event-tag-note-affordance-ui.test.js`) — the `npm test` gate.** The Node harness has no JSX transpile (react-dom lives only in the `ui/` Vite workspace), so UI stories are gated by asserting on the `ui/src/*.jsx` **source text**. These sentinels pin the load-bearing **wiring** the ADR fixed (which hook, which reused components, which write calls, the data contract, the integration point) — **not** pixels or class names, since ADR 0006 deliberately leaves placement/markup density to the Implementer (story Open Qs). New files fail now; regression sentinels (`R:`) pass before and after.

2. **Manual browser verification — the runtime behaviors source can't prove.** A click that publishes a kind-39999 `nostr-event-tag` assertion, the chip reflecting `mine` durably across reload, logged-out read-only, and the local-only invariant are verified by the operator on the **local dev stack** (`:8080`/`:7778`) with the publish guard ON — per ADR §Testability and the operator's stated flow ("build the whole feature, then browser-test"). The checklist is below, mapped per AC. (The pubkey-tagging analog `tests/brainstorm/tag-detail-write.spec.js` — a Playwright spec with a mocked `window.nostr` — is the template if/when this is automated; recommended as a fast-follow, not a gate for this story.)

> **Build invariant (epic):** every manual check runs against the **local dev relay only**, guard ON. Any external publish during verification is a defect.

## Coverage map

| Criterion (AC) | How it's proven | Test / check |
|---|---|---|
| Tags shown on a note (POV-filtered) | source + manual | `U: useEventTags … reads … for-event` / `U: NoteCard renders <NoteTags>` ; manual #1 |
| …from the viewer's POV, durable (own stance survives reload) | source + manual | `U: useEventTags … consumes the Story-7 mine channel`, `U: NoteTags consumes mine` ; **manual #6 (the Story-7 payoff)** |
| Apply / dispute an existing tag | source + manual | `U: NoteTags writes through … useEventTagging`, `U: NoteTags maps add-existing → applyTag…` ; manual #2 |
| Add an existing tag not yet on this note | source + manual | `U: NoteTags reuses … AddTagDialog`, `… onSelectExisting` ; manual #3 |
| Create a brand-new tag | source + manual | `U: NoteTags maps … create-new → applyTag({name,description})`, `… onCreateNew` ; manual #4 |
| Affordance present on EVERY note surface | source | `U: NoteCard renders <NoteTags>` + `R: all four … surfaces still render through NoteCard` |
| Logged-out / no-signer is read-only | source + manual | `U: NoteTags sources the viewer from useAuth and is READ-ONLY when logged out` ; manual #5 |
| Partial-failure surfaced, retry-safe | source + manual | `U: NoteTags surfaces partial failure (failedAt) / errors` ; manual #7 |
| Local-only holds end to end | source + manual | `U: useEventTags … no external publish path`, `U: NoteTags … not a new publish path` ; **manual #8 (guard ON, watch local strfry)** |
| Reuse, not fork (ADR) | source | `U: NoteTags reuses the existing TagChip and AddTagDialog` |
| "Tag Event" stub retired (ADR) | source | `U: the NoteActionsMenu "Tag Event" stub is retired` |
| Names enriched from shared available-tags (ADR) | source | `U: useEventTags joins display names from … available-tags` |
| Card not broken (additive) | regression | `R: NoteCard still renders … NoteContent … NoteActionsMenu` |

## Why source-contract for most ACs (and not runtime here)

The Node harness can't render JSX, and ADR 0006 leaves exact placement/markup to the Implementer — so brittle DOM/e2e assertions written now would over-constrain a not-yet-decided layout. The source sentinels prove the **contract** (the right hook is called, the right write path is used, the reused components are wired, `mine` is consumed, no external publish path is reachable), which is what actually makes the behavior correct. The remaining behavioral truth is gathered in the browser, where it's cheap and unambiguous.

## Manual browser checklist (local dev stack, publish guard ON)

Run logged-in with a NIP-07 signer on `:8080` (or `:7778`). On each surface — **feed**, **single-event page** (`/event`), **user-notes** (`/user/:pubkey/notes`), **profile content** — confirm:

1. **Tags shown.** A note with counted event-taggings shows its tags (POV-weighted) on every surface.
2. **Apply / dispute.** Clicking Apply (then Dispute) on a tag publishes the expected sequence and the chip reflects the new stance; re-clicking/flipping doesn't duplicate.
3. **Add existing.** Search a tag used elsewhere, apply it → it appears on the note.
4. **Create new.** Coin a brand-new tag name, apply it → tag created and shown.
5. **Logged-out read-only.** With no signer, tags still render but apply/dispute/add/create are unavailable and nothing publishes.
6. **Durable own stance (Story-7 payoff).** After applying a tag, **reload the page** → the tag is still shown as *yours* (read from `mine`), even if the house POV doesn't count you. (This is the bug Story 7 fixed; verify it here.)
7. **Partial failure.** If a multi-publish sequence fails midway, the UI says it didn't complete and a retry doesn't duplicate (only reusable leftovers).
8. **Local-only.** With the guard ON, watch the local strfry: every published event lands locally and **nothing** reaches an external relay.

## Test infrastructure

- Runner: `node test/test.js` (the source-contract suite; no stack, no build).
- To be created by the Implementer: `ui/src/hooks/useEventTags.js`, `ui/src/components/NoteTags.jsx`; edits to `ui/src/components/NoteCard.jsx` (render `<NoteTags>`) and `ui/src/components/NoteActionsMenu.jsx` (remove the stub). Reused as-is: `TagChip`, `AddTagDialog`, `useEventTagging` (Story 5).
- Manual verification needs the local dev stack up (`cycle-local`) with `BRAINSTORM_PUBLISH_LOCAL_ONLY=true` and a browser signer.

## How to run

```
npm test
```

## Verification

The new source-contract tests fail with the current code. Confirmed on 2026-06-30 at commit `bd50edf5`:

```
--- event-tag note-affordance UI tests (epic event-tagging, Story 6) ---
  FAIL  U: useEventTags hook exists and reads a note's tags from the Story-4 for-event endpoint
        ui/src/hooks/useEventTags.js must exist (the note-tags read hook)
  FAIL  U: useEventTags identifies the viewer (viewerPubkey) and consumes the Story-7 `mine` channel
  FAIL  U: useEventTags joins display names from the shared available-tags endpoint
  FAIL  U: useEventTags does NOT reach an external publish path (read-only hook; local-only invariant)
  FAIL  U: NoteTags component exists and is the single owner of the note tag affordance
  FAIL  U: NoteTags writes through the Story-5 useEventTagging hook (guarded/local-only), not a new publish path
  FAIL  U: NoteTags reuses the existing TagChip and AddTagDialog (no forked note-specific components)
  FAIL  U: NoteTags maps add-existing → applyTag({authorPubkey,slug}) and create-new → applyTag({name,description})
  FAIL  U: NoteTags sources the viewer from useAuth and is READ-ONLY when logged out
  FAIL  U: NoteTags consumes `mine` so the viewer's own stance is shown durably (the Story-7 payoff)
  FAIL  U: NoteTags surfaces partial failure (failedAt) / errors for retry
  FAIL  U: NoteCard renders <NoteTags> so EVERY note surface gets the affordance at once
  FAIL  U: the NoteActionsMenu "Tag Event" stub is retired (its job moved into NoteTags)
  PASS  R: NoteCard still renders the note body (NoteContent) and the actions menu
  PASS  R: all four kind-1 note surfaces still render through the shared NoteCard

event-tag-note-affordance-ui: 2 passed, 13 failed
```

The 13 feature-bearing `U:` tests are red for the right reason: `useEventTags`/`NoteTags` don't exist, `NoteCard` doesn't render the affordance, and the `NoteActionsMenu` stub is still present. The 2 green `R:` tests are regression sentinels that must stay green through the additive change.
