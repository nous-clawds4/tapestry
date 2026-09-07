# Build Audit: Treasure Map — Per-User Assistant

**Book:** `engineering-team/audits/treasure-map-user-assistant/book.md`
**Date:** 2026-09-07
**Branch / commits:** `bc4a7663` (story 1, PR #581) and `099bda18` (story 2, PR #584) on
`staging` — **not** a commit range: the two are 14 days apart and an unrelated epic
(`trusted-lists`, PR #574) landed between them. The book's true diff is those two commits:
13 files, +583/−143, of which code+tests are 6.
**Production:** story 1 via full promotion PR #582 (2026-08-28); story 2 via **selective**
promotion PR #586 (2026-09-07) — see §4 deviation 3.
**Provenance:** Acceptance-frame
**Confidence:** high — every frame bullet verified, and the one bullet no local test could
reach (recovery) was confirmed by the affected user himself.

> The Build Audit is the **as-built record** — what the product *is* now, factual and
> source-linked.

## 1. What shipped

- **Per-user assistant delegate** — every delegation judgment and composition on the TA Treasure
  Map page now uses the **signed-in user's** assistant (`useAuth().user.assistantPubkey`, from
  `getAssistantKeys`) instead of the instance owner's: the salient check, the preview, the
  published `30392` entry, and the Map Entries badge (relabelled **Your assistant**). A viewer
  with no provisioned assistant gets no card rather than a prompt that would compose a null
  delegate. `stories/treasure-map-user-assistant/1-per-user-assistant-delegate.md`.
- **Hand-edit reachable by every viewer** — the raw-event editor moved out of `TlOptInCard`
  into its own module, mounted by the page, so no state of the delegation card (including the
  null-assistant case story 1 introduced) can withhold it.
  `stories/treasure-map-user-assistant/2-manual-edit-available-to-all.md`.
- **Two standing pins** against the regression classes: the owner-TA token is barred from both
  Treasure-Map components, and the hand-edit affordance is barred from the opt-in card, with
  page order asserted positionally.
- **Spec correction** — `protocols/drafts/trusted-lists.md`'s relay-hint bullet now names the
  signed-in user's Assistant rather than "its own TA".

## 2. Epics & stories rolled up

### Epic: `treasure-map-user-assistant`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 per-user-assistant-delegate | delegate source, badge semantics, null safety, copy/spec | Done | `reviews/…/1-per-user-assistant-delegate.md` (PASS) |
| #2 manual-edit-available-to-all | editor extracted to its own module, mounted by the page | Done | `reviews/…/2-manual-edit-available-to-all.md` (PASS) |

## 3. As-built inventory

- **User-facing:** `/tapestry/grapevine/trusted-assertions` — Trusted Lists card judges against
  the viewer's own assistant and says "Published by your Tapestry Assistant"; Map Entries badge
  reads **Your assistant** / **external**; the hand-edit panel sits last in the found-Map block,
  always available. No card and no badges for a viewer without a provisioned assistant.
- **Modules:** `TlOptInCard.jsx` (delegate source swapped; editor removed),
  `TreasureMapTagsPanel.jsx` (badge baseline swapped), **new**
  `TreasureMapManualEdit.jsx` (the extracted editor), `TrustedAssertions.jsx` (mount).
- **Domain:** no concepts, no firmware, no handles.
- **Data & contracts:** **no wire change.** The `["30392", <pubkey>, <relay>]` convention is
  tl-treasure-map ADR 0001's and was already per-user-correct at its §2; this book fixed which
  runtime key fills the delegate slot, and corrected one sentence of spec prose.
- **Tests:** `tl-treasure-map-optin-publish` 22→23, `tl-treasure-map-panel` 18 (re-aimed);
  no new suite files, no registry change.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Original frame: six bullets, all about the delegate key | A seventh bullet (hand-edit reachable) added mid-book on operator report | added-beyond-scope (operator-ratified) | Operator, 2026-09-07; story 2 opened in this book rather than a new one, per intake step 4 "joins an open book" | Escape hatch reachable by everyone | — |
| 2 | Story 1 "not covered: live multi-user NIP-07 verification" | Verified after all — by the affected team member on production | constraint-resolved | Operator relay, 2026-09-07 | Recovery path proven in the wild | — |
| 3 | Normal path is feature → staging → main | Story 2 reached production by **selective promotion** (`promote/*`, cherry-pick onto main) | intentional-change | Operator direction: staging held the unrelated 27-commit `trusted-lists` bundle, which was not to ship; `guard-main-source.yml` sanctions `promote/*` for exactly this | None — same UI bytes staging proved in a superset build | §6 item 3 |

**Undocumented work** — none. Every hunk in both commits traces to a story; the co-resident
`trusted-lists` files in any naive range diff belong to PR #574, a different book.

## 5. Quality state at close

- Test gate: full `npm test` post-flip — **Overall FAIL (exit 1), environmental, zero book
  overlap.** 148 suites PASS / 3 FAIL / 44 skipped; all three failures are the **co-resident
  `trusted-lists` epic's** suites (PR #574, a different book), and each *declares its own
  refusal*: an `L0 GUARD` that will not run live-publish tests unless the local stack is in
  local-only publish mode. This machine's stack answers `allowExternalPublish: true`, so the
  guard refused and the downstream assertions (score slot, `rigor` tag, fixture prune) failed as
  consequences. The prerequisite is documented (`docs/DEVELOPMENT.md` sets
  `BRAINSTORM_PUBLISH_LOCAL_ONLY=true` for dev); this machine's env lacks it → OPEN.md row 191.
  **This book's suites are green in the same run** — panel 18/18, optin 23/23.
- Scoped gates at final story state: panel 18/18, optin 23/23, guards 8+6+5; harness-lint clean.
- Live verification: story 1 bundle hash-matched on staging and production; story 2 verified on
  localhost, on staging (`index-Dy4XpUkC.js`), and in production (`index-BUyrt0O6.js`) with the
  excluded epic's panel strings confirmed **absent** from the production bundle.
- **The book's own defect is closed in the wild:** the team member whose Map carried the owner's
  assistant re-ran the opt-in after the fix and reports it working (2026-09-07).

## 6. Carry-forward register

- [ ] Provisioning UX for viewers with no assistant — today they simply see no card. Whether
      they should be offered provisioning is a product question (story 1 "Not covered").
- [ ] Hand-creating a Treasure Map when none is found — the editor edits a seed event; a blank
      template is a different feature (story 2 "Not covered").
- [ ] The next `staging → main` promotion re-carries a duplicate of the cherry-picked story-2
      commit; identical content merges cleanly, but concurrent edits to those 8 files on staging
      could conflict → OPEN.md row 189.
- [ ] `trusted-lists` (PR #574, 27 commits) still sits unpromoted on staging, awaiting its own
      review/promotion — explicitly out of this book.
- [ ] Optional strengthening declined at close: querying the relays for the team member's
      kind-10040 to confirm the `30392` entry carries his assistant pubkey. His confirmation is
      the designed verifier; the artifact-level proof was offered and not required.

## 7. Process findings (harness)

Retro basis: `scripts/harness-stats.sh` at close — 184 reviews parsed, 182 final PASS,
kick-back history 32/184 (≈17%).

| Finding | Source | Terminal state |
|---|---|---|
| **The escaped defect passed every gate because the acceptance criteria encoded the wrong premise.** Story 2 and 3 of tl-treasure-map said "this instance's Assistant"; J1/J2/J3 and every test then pinned that reading faithfully. No gate rubric asks *whose* view a judgment is computed from — yet this repo's own CLAUDE.md invariant #1 (POV-first) and reflex check #1 ("Who is this true for? If the answer is 'everyone', check again") describe precisely the missed question. Proposed remedy: put the POV reflex check into the Gate-A/J1 rubric and the story template's AC section, so premise-level POV errors are asked about before they are pinned. | this close's retro; OPEN.md 188 | OPEN.md row **190** (`meta`) — a harness-rubric amendment needs operator ratification, not a drive-by edit; flagged to join the standing META-ESCALATION harness story |
| Escaped-defect ledger row for the trial's comparison line | story 1 | OPEN.md row **188 → DONE** (this close's commit) |
| Selective promotion (`promote/*`) leaves a duplicate-content commit for the next line promotion | story 2 / this close | OPEN.md row **189** (`meta`) |
| Story-2's positional test pin first anchored on a string (`Not found`) that also appears in an unrelated code comment 174 lines earlier — failed for the wrong reason, re-anchored on the branch's own headline | review #2 Harness friction | declined — the lesson (positional source assertions must anchor on region-unique strings) is documented in the suite itself; too local for a ledger row |
| Book gained a bullet mid-flight rather than opening a new book | this close's retro | declined — intake step 4's "joins an open book" is the ratified path, and tl-treasure-map story 4 set the precedent; the frame was amended in the same commit as the story, so the anchor never drifted silently |

### Light-profile trial — closing record (book 3 of the 2–3 target)

The trial protocol's target is met. The honest ledger across all three books:

| | tl-treasure-map (#1) | neo4j-sizing (#2) | treasure-map-user-assistant (#3) |
|---|---|---|---|
| Stories / lanes | 4 (1 escalated Standard, 3 Feature) | 1 (Bug) | 2 (Bug, Bug) |
| Judge spawns / verdicts | 9 / 9 APPROVE, 0 kick-backs | 0 (lane-correct) | 0 (lane-correct) |
| Findings per review (non-blocking) | 2, 2, 2 | 1 | 2, 2 |
| Escaped defects (30-day window) | **1 — surfaced day 1** | 0 to date | — |

- **Comparison line vs the corpus** (median findings-per-review 3): Light reviews ran 1–2. Not
  empty — the "gates lost their teeth" failure mode did not appear, and the judged interior
  produced real catches (a delegate-less classification defect, a dangling docblock, a guard
  flake, a suite-hermeticity bug caught by a close gate). But they are consistently *below* the
  corpus median, which the ratification decision should weigh rather than wave away.
- **On the escaped defect:** it is the trial's most important datum and it is **not** evidence
  against Light specifically. The wrong premise lived in the ACs; Standard's phases would have
  pinned it just as faithfully, because no profile's rubric asks the POV question. Reading it as
  "Light is too thin" would draw the wrong lesson and leave the real gap (row 190) unfixed.
- **Ratification is the operator's call**, per `workflows/light-profile.md` — this audit supplies
  the record, not the verdict.

## Post-flip gate result

- `npm test` after the flip + epic close-out (2026-09-07, run blf0ukabz — re-run *after* the
  flips so it certifies the tree this close leaves behind, per workflow step 10): `Overall:
  FAIL`, exit 1 — **148 suite PASS / 3 suite FAIL / 44 skipped**. The three reds are
  `tl-membership-method-selector`, `tl-weighted-sum-method`, and `tl-certainty-method`, all from
  the co-resident `trusted-lists` epic, all blocked by their own `L0 GUARD` on a documented
  local-env prerequisite this machine does not meet (row 191) — not a defect in that epic and
  not reachable by this book's diff, which contains no `src/` change any of them executes.
  Book suites in the same run: `tl-treasure-map-panel` **18/18**,
  `tl-treasure-map-optin-publish` **23/23**. The harness-lint suite passed over the flipped
  tree, certifying the L2 book/epic pairing this close produced.
