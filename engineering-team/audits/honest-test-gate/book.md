# Book of Work: An honest test gate

**Slug:** honest-test-gate
**Status:** Open
**Opened:** 2026-09-12 — eagerly, at intake, before any story is approved.
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD).** The ask is the queued umbrella in `engineering-team/stories/_intake.md`
(2026-08-18, "Make the test gate fast and honest"), proposed as H1 at the 2026-09-12 `/whats-open`
meta escalation. The operator confirmed on 2026-09-12: open it as its own book spanning two epics,
plan the truthful-report story first, and make a run's result readable however the gate was
launched. Its objective, in the intake entry's words: *the gate finishes inside tool timeouts, its
exit code is always true, and a red result always means signal.*

### Acceptance frame

- [ ] A gate run's verdict and exit status always match what happened, however it was launched —
      foreground, background, piped or interrupted, in bash or zsh.
- [ ] The gate a role runs for its story finishes inside one tool call; the full run stays available
      for pre-merge and book close.
- [ ] A suite the environment can't run says SKIP and why, and a green result shows how much was
      skipped.
- [ ] The known lying assertion patterns are gone from the suite; each replacement is shown to fail
      on a deliberately broken build before it is kept.
- [ ] The OPEN.md rows this book covers are flipped DONE — `honest-test-gate`: 83, 103, 104, 105,
      106, 111, 157, 181, 191, 192, 227, 235, 263, 271; `test-suite-hermeticity`: 59, 60, 108, 109,
      126.

## Epics in this book

- `honest-test-gate` (`epics/honest-test-gate.md`) — the gate's own run: a truthful report, a gate
  that fits a session, environment-aware skips. New epic opened for this book.
- `test-suite-hermeticity` (`epics/test-suite-hermeticity.md`) — joins with its assertion sweep
  (#2). Its #1 (OPEN.md row 150, Done) is this book's model fix.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/honest-test-gate/audit.md`
- Product feedback: `engineering-team/audits/honest-test-gate/prd-seed.md`
