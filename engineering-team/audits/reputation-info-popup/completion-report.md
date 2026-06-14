# Completion Report — reputation-info-popup

**Book:** `engineering-team/audits/reputation-info-popup/book.md`
**Epic:** `reputation-info-popup` · **Story #1:** reputation-section-pov-explainer-popup (`**Status:** Done`)
**Live on:** https://staging.brainstorm.world (PR [#287](https://github.com/nous-clawds4/tapestry/pull/287), merge `e8b9182e`, deploy run [`27483210200`](https://github.com/nous-clawds4/tapestry/actions/runs/27483210200) — success, 1m14s)

This report maps each acceptance-frame bullet to its evidence.

## Acceptance-frame bullets

### 1. The "Reputation" section heading carries a circled-"i" (ⓘ) control, visually/behaviorally consistent with the existing "Verified" info control
- **Code:** new `ui/src/components/ReputationInfo.jsx` renders `<button className="bsp-info-btn" …>ⓘ</button>` — the same class, glyph, and `type` as the shipped `VerificationInfo.jsx`. Rendered inside the heading in `ui/src/pages/BrainstormProfile.jsx`: `<h3>Reputation<ReputationInfo /></h3>`.
- **Consistency:** the shared `.bsp-info-btn { margin-left:auto }` is left in effect, so the Reputation ⓘ right-aligns at the heading edge — the same placement behavior as the Verified ⓘ in its `.bsp-counts` row (recorded in the story's `## Deviations`).
- **Staging evidence:** rendered on https://staging.brainstorm.world/user/c4eabae1be3cf657bc1855ee05e69de9f059cb7a059227168b80b89761cbc4e0?pov=a1420e44 — the ⓘ appears beside "Reputation" (browser `find` located it as the button "Where do these reputation scores come from?" next to the Reputation heading; screenshot captured).
- **Tests:** T1, T9 in `test/reputation-info-popup.test.js`.

### 2. Activating the control opens a dismissible popup (closes on an acknowledgement button and on dismissing the overlay)
- **Code:** `useState(open)`; `bsp-confirm-overlay` (overlay `onClick → setOpen(false)`) wrapping `bsp-confirm-box` (`onClick → e.stopPropagation()`); a `bsp-confirm-ok` "Got it" button (`onClick → setOpen(false)`).
- **Staging evidence:** clicking the ⓘ opened the popup; clicking "Got it" closed it (the dialog was confirmed absent from the page tree after the click).
- **Tests:** T3 (overlay/box), T4 ("Got it" closes), T5 (overlay closes / inner click does not).

### 3. The popup explains the scores reflect a Web-of-Trust point of view — either the House (default) or the viewer's Personalized PoV, depending on which is selected (general; does not name the active one)
- **Live DOM extract (staging):** *"Where do these scores come from? These reputation scores reflect a Web of Trust — a point of view on who is trustworthy. The numbers show either the House point of view (this Tapestry instance's default) or your Personalized point of view, depending on which is currently selected. Got it"*
- **General:** the copy presents House vs Personalized as alternatives ("either … or … depending on which is currently selected") without naming the active PoV.
- **Tests:** T6 (Web of Trust / point of view), T7 (House + Personalized + either/or + select).

### 4. The explanation is accurate and bounded — no claim about the Following / Verified Followers / Verified Reporters counts elsewhere on the page
- **Code:** the popup copy mentions none of those counts.
- **Staging evidence (boundary is real):** on the same profile, the top-of-page "Verified Followers" reads **17,584** (Owner-PoV, Neo4j) while the Reputation grid reads **20,688** (Meili House/Personalized at `?pov=a1420e44`) — distinct sources. The popup is scoped to the Reputation-section scores and makes no PoV claim about the top counts, honoring ADR 0033 §27.
- **Tests:** T8 (popup names none of the counts), R7 (`BrainstormProfile.jsx` carries no "House (default)" label on the counts).

### 5. Additive and presentational only — no change to how scores are computed/fetched/namespaced/displayed; with the control removed the page behaves exactly as before
- **Diff scope:** only `ui/src/components/ReputationInfo.jsx` (new) and `ui/src/pages/BrainstormProfile.jsx` (import + render in the heading). No `src/api/**`/backend change; no new dependency, lint, typecheck, or build tooling.
- **Data path untouched:** the Meili document fetch, `TRUST_METRICS` grid, and `?pov=`/`povSuffix` resolution are unchanged (regression sentinels R1–R3). The shipped verification popover (`VerificationInfo.jsx`, `useVerificationInfo.js`) and `BrainstormReporters.jsx` are not in the diff (R4–R6).
- **Tests:** full `npm test` 34/34 suites green (the new suite 16/16; all pre-existing suites unchanged).

### 6. Live on staging.brainstorm.world with the staging smoke passing; Tier-4 rendered-UI evidence mandatory
- **Deploy:** PR #287 merged to `staging` (merge `e8b9182e`); `deploy-staging.yml` run `27483210200` succeeded (1m14s).
- **Five-tier smoke (https://staging.brainstorm.world):** Tier 1 stability (3 consecutive 200s); Tier 2 sanity (`/`, `/api/assistant/pubkey`, `/user/<pub>` all 200); Tier 3 the served bundle `index-DVyPDYLk.js` contains the feature copy; Tier 4 rendered UI (below); Tier 5 regression (Verified popup intact, no console errors).
- **Tier-4 evidence:** the live staging profile render described in bullets 1–4 — a 200 on the profile URL, the ⓘ beside "Reputation", and the opened popup containing both "House" and "Personalized" point-of-view wording (DOM extract quoted in bullet 3; screenshots captured). No browser console errors.

## Artifacts
- Story: `engineering-team/stories/reputation-info-popup/1-reputation-section-pov-explainer-popup.md`
- ADR: `engineering-team/decisions/reputation-info-popup/0034-reputation-section-pov-explainer-popup.md`
- Test plan + tests: `…/1-reputation-section-pov-explainer-popup.test-plan.md`, `test/reputation-info-popup.test.js`
- Review: `engineering-team/reviews/reputation-info-popup/1-reputation-section-pov-explainer-popup.md` (PASS)
- Decision journal: `engineering-team/audits/reputation-info-popup/journal.md`
