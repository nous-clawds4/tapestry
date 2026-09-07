# Review: Story 3 — Make the presence panel scannable

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-07
**Diff:** `git diff bb4f7f3f..HEAD` (implementation commit `48023e33`) — 2 files, +113/−11.

## Quality gates (run by reviewer, not trusted)

- [x] **Story suite** — `treasure-map-panel-summary`: **18 passed, 0 failed**.
- [x] **Epic regression** — `treasure-map-relay-presence` 35/35, `treasure-map-relay-sync` 22/22.
      Re-run by the reviewer, not taken on report.
- [x] **Build** — `npm --prefix ui run build` succeeds.
- [ ] `npm test` (full gate) — in progress at the time of writing; the three suites this diff can
      affect are green above, and the three unrelated `trusted-lists` failures of OPEN.md row 191
      are expected to persist (server posture, proven pre-existing at story 1's review). **The
      verdict below does not rest on it:** both blocking findings were reproduced directly.
- [x] **Live behavior** — verified in the browser, including a staged divergence.
- [x] _Lint / typecheck / Playwright — not configured or not applicable._

### Live evidence

| State | Observed |
|---|---|
| Collapsed (default) | `▸ Where this Map lives · ○ 3 relays do not have it`, zero rows rendered |
| Expanded | `▾`, summary still shown, all rows + sync buttons intact |
| One relay staged divergent | `⚠️ 1 relay has a different version · 3 missing`, `rgb(245,158,11)` |
| That row, open | `⚠️ nos.lol · 📤 Send my version · Older version · 3/20/2026, 5:46:40 AM` |

The staged divergence used a client-side stub; nothing was published. AC-2's ordering is
confirmed in the rendered output, not only in the unit tests: one divergence outranks three
absences, and the lower condition appears *alongside* rather than in place of it.

## Spec adherence

- [x] Every acceptance criterion has a passing test.
- [x] No criterion silently dropped.
- [ ] No behavior added beyond the story — one deviation, disclosed by the Implementer and
      accepted; see *Accepted deviation*.

| AC | Tests | Verdict |
|---|---|---|
| 1 collapsed by default, openable | `S1`, `S5` | met in code; **not met for keyboard users** — blocking 1 |
| 2 summary names the worst finding | `M1`–`M3`, `M7`–`M9`, `S2` | met; confirmed live |
| 3 differing version's age visible | `S4` | met; confirmed live |
| 4 nothing asserted before it is known | `M4`, `M5`, `M6` | met for the panel; **helper violates it** — blocking 2 |
| 5 nothing already working disturbed | `R1`, `R2`, `R3` | met |

## ADR adherence

- [x] Both implementation notes followed: the helper lives beside the epic's other four in
      `treasureMap.js`, and the panel maps level → wording/colour locally.
- [x] The normative precedence table is implemented exactly, including `divergent` above
      `checking` (`treasureMap.js:231-236`).
- [x] The local row participates in the summary (`TreasureMapRelayPresence.jsx:219-222`).
- [x] No new dependency, no lint/build tooling, no firmware change.
- [ ] **"Reuses the page's established idiom"** — partially. The `▾`/`▸` marker matches; the
      control does not. Both sibling disclosures on this page are `<button>`; this one is a
      `<div onClick>`. See blocking 1.

## Concept-graph integrity

- [x] No handles touched; presentation-only story. No firmware reinstall needed or claimed.
- [x] No 64-hex literal, no relay URL literal (`R2`).

## Things tests can't catch

- [x] No secrets, no debug logging, no commented-out code.
- [x] Row-level state isolation from stories 1–2 preserved; no settled batch reintroduced.
- [ ] **Accessibility** — regression; blocking 1.
- [ ] **A helper that can emit a false all-clear** — blocking 2.

## Findings

### Blocking

1. **`ui/src/pages/grapevine/TreasureMapRelayPresence.jsx:237` — the disclosure is unreachable by
   keyboard, and this story is what put content behind it.**

   Measured in the browser:

   | | Tag | tabIndex | role | aria-expanded | Keyboard-reachable |
   |---|---|---|---|---|---|
   | New disclosure | `DIV` | -1 | none | none | **no** |
   | `▸ Show raw event` (same page) | `BUTTON` | — | — | — | yes |
   | `▸ Update your … by hand` (same page) | `BUTTON` | — | — | — | yes |

   Before this story the ten relay rows were always rendered. After it they sit behind a control
   that only a pointer can operate, so for a keyboard-only user the panel's entire content — the
   status of every relay, and every sync button story 2 added — becomes unreachable. That is a
   regression introduced by this diff, not a pre-existing gap, and the two sibling disclosures on
   the same page already show the shape that avoids it.

   **Asked change:** make the header a real control — a `<button>` matching
   `TrustedAssertions.jsx:214` / `TreasureMapManualEdit.jsx:63`, or at minimum `role="button"`,
   `tabIndex={0}`, `aria-expanded={open}` and an `onKeyDown` handling Enter/Space. The ADR's
   "whole header clickable" is satisfied either way.

2. **`ui/src/utils/treasureMap.js:214-240` — `summarizePresence` can return `ok` over rows it did
   not judge.**

   With no local copy, a `present` row is (correctly, per the ADR) neither divergent nor agreeing —
   but it is then counted as *nothing at all*, so it cannot hold the level away from `ok`.
   Measured directly:

   ```
   summarizePresence(null, [{status:'present', event:{…}}])
     → level "ok",  counts sum = 0,  total = 1
   ```

   The panel is saved only by prepending its local row, which makes the level `missing` in
   practice — so no user sees this today. But an explicit all-clear over an unjudged row is
   precisely the failure mode AC-4 exists to prevent, and the ADR advertises this helper as
   "reusable by any future surface", which makes the trap real rather than theoretical. The counts
   also never sum to `total` for such rows, so the ADR's own "counts survive so a lower condition
   may be mentioned alongside" contract is unsound for them.

   Contributing: **`treasureMap.js:226` is `counts.pending += 0`** — a no-op that reads as a
   deliberate decision while explaining nothing, and hides the gap from a reader.

   **Asked change:** account for unjudged rows explicitly — either count them (e.g. an `unjudged`
   tally that blocks `ok`), or refuse `ok` unless
   `divergent + missing + unreachable + agreeing === total`. Replace the `+= 0` with the real
   branch. **Also worth the Tester's note:** `M8` asserts only what the level *is not*
   (`!== 'divergent'`), never what it *is*, which is why the suite is green over this — a
   Tester-lane strengthening on the next touch.

### Non-blocking

1. **`ui/src/utils/treasureMap.js:175-213` — `planRelaySync`'s JSDoc is now orphaned.** The new
   helper was inserted *between* `planRelaySync`'s doc comment and `planRelaySync` itself, so the
   block describing "which way a sync should go" now sits immediately above `summarizePresence`,
   and `planRelaySync:242` has no doc at all. Two adjacent doc blocks, the first describing a
   different function — actively misleading to the next reader. Move it back down.

2. **`TreasureMapRelayPresence.jsx:358`** — the all-missing caution now reads
   `summary.counts.agreeing === 0` where it read `holding === 0`. Correct and disclosed (see
   below), but it means the caution now fires when relays hold *divergent* copies as well as when
   they hold none — arguably right ("no relay is serving *this* Map"), and the copy already says
   exactly that. Noted so the change is on the record, not to reverse it.

3. The header's summary is hidden entirely when `targets.length === 0`, so a panel with no
   configured relays shows a bare `▸ Where this Map lives` with nothing beside it. Harmless, and
   the empty-state text inside covers it once opened — but the closed state says nothing at all in
   that case.

### Accepted deviation

The Implementer changed the all-missing caution's condition beyond the literal ACs and said so
before review. The reasoning holds — keeping a "holding" count alongside a summary built on
"agreeing" would let the two contradict each other on screen — and the story's AC-5 protects
behavior, not implementation details of a caution line. Accepted; recorded as non-blocking 2.

### Harness friction

None this story.

## Verdict

**CHANGES_REQUESTED**

The feature works, is well-tested where it is testable, and the precedence table — this story's
substance — is implemented exactly as ratified and confirmed in the rendered output. Neither
blocking finding is about that.

They are both about the same thing from opposite ends: this story's whole purpose is to let a user
*safely* stop looking at the panel. Blocking 1 means some users can no longer look at it at all,
and blocking 2 means the helper that decides "nothing to see here" can say so about rows it never
examined. Shipping a status light requires that the light be reachable and that it never lie; the
rest of the diff is ready.

Both asks are small and local. No re-architecture, no new tests required beyond the `M8`
strengthening noted above (Tester lane, not a gate on this fix).
