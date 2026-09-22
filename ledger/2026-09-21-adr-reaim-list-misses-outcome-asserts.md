# An ADR's "Test-file changes" list has twice missed specs that assert the old behaviour by value

**Id:** 2026-09-21-adr-reaim-list-misses-outcome-asserts
**Type:** meta
**Opened:** 2026-09-21 (assistant-profile #5, Architecture)
**Status:** OPEN
**Done:** —

**What happened.** Twice in the assistant-profile book, an ADR's "Test-file changes" list missed specs that
assert the old behaviour by value. The Tester caught both at Phase 3.

- **Story 3.** ADR assistant-profile/0003 renamed "Surprise me" to "Use the default profile". It missed story 1's
  `tests/brainstorm/assistant-setup-prompt.spec.js` B3 and B5, which look for the old label.
- **Story 4.** ADR assistant-profile/0004 moved the dashboard prompt's destinations to `/assistant`. It missed
  story 1's B3, B4, B5 and B8 in the same spec, which assert the old destinations.

**Why it happens.** The Architect found re-aims from the files the ADR edits and their own suites. A spec that
asserts an outcome by value — a path, a label, a piece of copy — breaks when that value changes, whichever
file produces it and whichever story wrote the spec.

**Fix shape.** The Architect finds re-aims by grepping `test/` and `tests/` for every literal the ADR removes or
renames (paths, labels, copy), not only for the files it edits. That is one line in
`engineering-team/roles/architect.md`, or in the ADR template's "Test-file changes" note.

**2026-09-21 — a third instance, in the story that filed this row (assistant-profile #5, Phase 4).** Phase 3
grepped for every literal ADR 0005 changes, and the grep for `signAs` did list `test/create-tapestry.test.js` and
`test/add-a-concept-to-a-tapestry.test.js` — but neither was opened. Their R3 sentinels read a fixed 600-character
window from the first `signAs === 'assistant'` in `src/api/strfry/commands/publishEvent.js` and need the owner gate
inside it. The kind-0 refusal, written as the first statement of that branch, pushed the gate out; the full gate
caught it. The Implementer moved the refusal just above the branch (same behaviour; story 5's Deviations), which
leaves the gate 537 characters in. So the fix shape needs one more clause: **open every hit**, and treat a
position- or window-based source sentinel as asserting the file's layout, not just its literals.

**2026-09-21 — corrected at story 5's review (non-blocking 1).** The paragraph above says the gate is back inside
the window. That is true of the gate's `if`, not of what R3 asserts (`isOwner(req)`, `localTrusted` and `403` in
the window). The window now starts at the refusal's own `signAs === 'assistant'`, so the `403` it sees is the
refusal's; the gate's `403` falls outside. A planted gate answering 401, or a bare 200, passes both R3s — it is
caught by `default-deny-mutations` AC3 and story 5's G4, so no behaviour is unpinned. The sharper lesson: a window
sentinel does not only break on a layout change — **it can keep passing while measuring a different line.**
Re-anchoring both R3s is ledger `2026-09-21-r3-sentinels-miss-owner-gate-403`.

**2026-09-21 — a fourth instance, in another book (setup-status-and-alert #3, Phase 4).**
- ADR setup-status-and-alert/0003 moved three import pages' hand-written POST to `/api/strfry/publish` into the
  shared helper `publishToLocalStrfry`. The request is the same.
- `test/treasure-map-relay-presence.test.js` R2 pins the literal `/api/strfry/publish` in
  `TrustedAssertions.jsx` ("the import handler must still post to /api/strfry/publish").
- Phase 3 grepped for the pill's removed copy and name, but not for the endpoint path. R2 passed at the baseline,
  because the literal was still there.
- The story's full scoped gate caught it at Phase 4.
- The Tester re-aimed R2 to accept either form. Its intent, "the import still posts to the local relay", is
  unchanged.

The fix shape holds, and it covers endpoint paths moved into a helper as well as copy.

**And a fifth, in the same story's round 2.**
- ADR 0003 Amendment 1 made `publishEverywhere` announce once, and the implementation added an
  optional `{ announce }` argument to `publishToRelays`.
- `test/treasure-map-relay-sync.test.js` R4 pins the literal signature text, closing parenthesis
  included.
- The first shape tried, a separate internal function holding the local-only guard, instead broke
  `test/global-publish-gate.test.js`'s check that `publishEverywhere` routes through `publishToRelays`.
- **The lesson:** function signatures and call shapes are literals too. Grep `test/` for a helper's
  name before changing its signature or its internal routing.

**Pointer:** `engineering-team/stories/done/assistant-profile/4-my-assistant-page.test-plan.md`, the opening
"Re-aims" section (and the story 3 test plan's, `3-one-default-assistant-profile.test-plan.md:43-47`).
