# Review: feed note actions menu (conversational / non-harness)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-18
**Diff:** `git --no-pager diff --cached` on branch `feat/feed-note-actions-menu` (staged, uncommitted)
**Nature:** Conversational UI change. No formal story / ADR / test plan — those gates are skipped by design. Audited the diff directly for correctness, pattern consistency, accessibility, security, and edge cases.

## Scope of the diff
- `ui/src/components/NoteActionsMenu.jsx` (new) — "⋯" kebab menu per feed note: Copy Note Link, Copy Note ID (nevent), Copy Note ID (event id), Tag Event (transient "not yet supported").
- `ui/src/utils/clipboard.js` (new) — `copyText` helper extracted from `PinnedListPanel.jsx`.
- `ui/src/pages/BrainstormEvent.jsx` (new) — `/event` placeholder echoing `?nevent=` / `?id=`.
- `ui/src/pages/BrainstormFeed.jsx` — wires `<NoteActionsMenu>` into `FeedItem`.
- `ui/src/App.jsx` — registers `/event` route.
- `ui/src/styles.css` — menu + event-page CSS.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **Suite-level: relevant suites PASS; overall FAIL is pre-existing/environmental, NOT caused by this diff.**
  - The two suites covering the surface this diff touches both pass: `live-feed-feed-page` (18/18), `live-feed-read-path` (23/23).
  - The overall `FAIL` comes entirely from live-service integration suites (`profile-tags`, `tag-detail-publish`, `tag-index-publish`, `pin-a-tag`, `tl-publication-from-pins`, `concept-graph /summaries`, …) that report `fetch failed` / Meili / strfry errors. None of these reference any changed file (verified: `grep -rln "NoteActionsMenu|utils/clipboard|BrainstormEvent" test/` → NONE). They are environmental (test DB / service wiring), independent of a pure client-side nav/clipboard change.
- [ ] `npm run test:playwright` — not run. No Playwright spec exists for this surface and the Implementer browser-verified the interaction manually (menu open/close, aria-expanded, all 4 actions, mobile 375px, zero console errors). Acceptable for a conversational UI change with no e2e harness.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Correctness

- **nevent encoding** — `nip19.neventEncode({ id, author })` and `{ id }` both verified against `ui/node_modules/nostr-tools`: round-trip correct, and invalid hex throws (caught by the `try/catch` → `nevent = null`). Correct.
- **copyLink URL** — `${window.location.origin}/event?nevent=${nevent}`. Origin is correct; nevent is bech32 (`[a-z0-9]` only) so no URL-encoding needed. The `/event` reader matches (`params.get('nevent')`). Round-trips correctly.
- **No-id guard** — `if (!eventId) return null` renders no dead menu. Matches the Implementer's claim.
- **No-pubkey path** — falls to `{ id }`-only nevent; still copyable. Correct.

## Pattern consistency

- **Click-outside / open-state** — mirrors `BrainstormUserMenu.jsx:14–20` exactly (same `mousedown` listener, same cleanup in the effect return). No listener leak: the effect has `[]` deps and removes its own listener on unmount.
- **Multiple menus** — each `FeedItem` mounts its own `NoteActionsMenu` instance with independent `open` state. Opening menu B fires menu A's outside-`mousedown` handler (B's button is outside A's `menuRef`), closing A. Net effect is correct single-open-at-a-time behavior. No shared-state bug.
- **clipboard.js extraction** — byte-for-byte identical logic to `PinnedListPanel.jsx:54–72` (secure-context fast path + `execCommand` textarea fallback). Faithful extraction.

## Architecture invariants (CLAUDE.md)

- **TA pubkey** — no hardcode; no TA pubkey usage at all (`grep 82b75e47|[0-9a-f]{64}` → NONE in new files). N/A and clean.
- **POV-first / decentralized-first / filter-at-view-time** — N/A. Pure client-side nav + clipboard; no read scoping, no write gating, no per-POV storage.

## Security

- **XSS in `/event` echo** — `{identifier}` is rendered as a React text child inside `<code>`; React escapes it. No `dangerouslySetInnerHTML` in any new file (verified). The identifier is display-only — never `decode`d, fetched, or interpolated into a URL/DOM sink. Safe.
- **Secrets / debug** — none. No `console.*`, `debugger`, TODO/FIXME, or commented-out code in the new files.

## Accessibility

- Kebab button: `aria-label="Note actions"`, `aria-haspopup="menu"`, `aria-expanded={open}`, `title`. Dropdown `role="menu"`, items `role="menuitem"`, flash `role="status"`. Good baseline. (Arrow-key roving / Escape-to-close are absent — see NICE-TO-HAVE.)

## Findings

### BLOCKER
None.

### SHOULD-FIX
None.

### NICE-TO-HAVE
1. **`ui/src/components/PinnedListPanel.jsx:54–72`** — now-duplicated `copyText`. The extraction into `utils/clipboard.js` was intentionally not back-applied to PinnedListPanel to avoid scope creep, which is a defensible call for this change. But the duplication is now load-bearing (two copies that must stay in sync). Recommend a tiny follow-up to have `PinnedListPanel` import from `utils/clipboard` and delete its local copy. Not blocking — file it as an OPEN.md / `_intake.md` cleanup row.
2. **`ui/src/components/NoteActionsMenu.jsx` (menu)** — no Escape-to-close and no arrow-key navigation within the `role="menu"`. The ARIA roles imply keyboard menu semantics that aren't fully wired. Click-outside + tab-away work, so it's usable; full menu keyboard support is a polish item, and `BrainstormUserMenu` (the model) doesn't implement it either, so this is consistent with the house baseline.

### NIT
1. **`ui/src/components/NoteActionsMenu.jsx:50`** — `setTimeout(() => setFlash(null), 1600)` is unguarded against unmount. This matches the established house pattern (`CopyButton.jsx:16`, `PinnedListPanel.jsx:87`, `settings/Index.jsx`, `RelaySettings.jsx`), and `useFeed` does not poll so feed items don't churn under the user; React 18 no longer warns on setState-after-unmount. No action needed.
2. **`ui/src/pages/BrainstormEvent.jsx`** — inline `style={{…}}` on the content wrapper and headings rather than CSS classes (the identifier line correctly uses classes). Minor inconsistency on a deliberately-throwaway placeholder. Fine to leave.

## Route placement
`/event` is registered in the public route group (`App.jsx:149–152`), immediately after `/feed` and before the `/tapestry` admin tree — correct placement for a public, login-free page reachable from the feed's Copy Note Link.

## Verdict
**PASS**

The diff is correct, faithfully follows the `BrainstormUserMenu` interaction pattern, introduces no security/secret/TA-pubkey issues, respects all architecture invariants, and is mergeable as-is. The overall `npm test` FAIL is pre-existing environmental breakage in live-service integration suites unrelated to this client-side change; the feed suites that cover the touched surface pass. No story file exists to mark Done (conversational change). The two NICE-TO-HAVE items (dedupe PinnedListPanel's `copyText`, menu keyboard polish) are non-blocking follow-ups.
