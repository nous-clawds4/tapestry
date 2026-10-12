# Assistant Self-Map, story 2 — Planning handoff

**Status:** ✅ ADDRESSED (2026-10-12): story 2 is approved,
`engineering-team/stories/assistant-self-map/2-turning-the-self-map-on-and-off.md`. The four questions in § 3 were
settled with the owner at planning, as that story's Open questions record. The body is kept for history.

**Created:** 2026-10-12
**Provenance:** Written at the end of the session that built and shipped story 1 (Planning through three review rounds,
then staging and production). The owner chose to plan story 2 in a fresh session.

> **Audience:** the session that runs `/plan-feature` for story 2. Read this first, then the book.

---

## 1. Where things stand

- **Story 1 is Done and in production**, the Your Assistant's Treasure Map page and its check.
  - Staging: PR #855, merge `f51fe70d`.
  - The owner checked it signed in on staging, as straycat.
  - Production: PR #856, pinned at `f51fe70d` through `promote/assistant-self-map-1`, merge `ef04e503`.

  It is read-only. It shows the viewer's Assistant's duties and which are live, what its self-Map should say, and what
  the self-Map found says. The hub card has a real Done or Needs attention mark.
- **The branch:** `feat/assistant-self-map`, restarted from `origin/staging` and pushed (`18262f3f`, which records
  story 1's shipping in the book). Each story reaches `staging` by a PR after its Review passes, through
  `/cycle-staging`. Production goes through `/cycle-prod` from a pinned `promote/*` branch.
- **Story 2, from the epic's first cut:** "Turning it on and off. The signing route, and a merge that keeps every entry
  the self-Map doesn't own." Story 3 is keeping it true automatically; story 4 the readers and counters; story 5
  `/treasure-map`'s Active and Standby-ready badges.

## 2. Read, in this order

1. `engineering-team/audits/assistant-self-map/book.md`: the acceptance frame, Decisions 1–5, § Path, and § Shared
   lines, especially the "At story 1's ship" entry.
2. `engineering-team/epics/assistant-self-map.md`.
3. Story 1 and its record:
   - `engineering-team/stories/assistant-self-map/1-the-self-map-page-and-its-check.md`;
   - ADR `engineering-team/decisions/assistant-self-map/0001-a-self-map-check-from-what-has-landed.md`, with
     Amendments 1–3;
   - review `engineering-team/reviews/assistant-self-map/1-the-self-map-page-and-its-check.md` (3 rounds). R3-N2
     there is for story 2: filter `mapHints` in `src/api/assistant/selfMap.js` through `parseKey`, since story 2
     reads the same hints.
4. **The spec:** `protocols/drafts/treasure-maps.md` § 9.2, Self-Maps, as ADR `duty-menus-and-self-maps/0004`
   accepted it. In particular: Its key, Its relay, More than one relay, A part A does not publish, When it changes,
   What follows a stop, Finding a self-Map, and No expiration.
5. **Shared lines, both Proposed when this was written; check their status first:**
   - **`duty-menus-and-self-maps` story 5 and its draft ADR 0005** (the rules that keep a self-Map true). Sub-decision
     2: a self-entry removed or narrowed while the key keeps publishing is "no stop", so an off button retracts
     nothing.
   - **Book `assistant-duties-settings`, ADR 0001.** The offered duties move into instance settings, on an Assistant
     Duties tab: any key, Scores for every Assistant, and a relay per duty. Its sub-decision 6 edits this book's
     `selfMap.js` (`readUpkeep`). Any story here that touches `selfMap.js` must merge carefully with it.
6. **Code to build on:**
   - `src/lib/treasureMapMerge.js` (`isOwnedRow`, `mergeTreasureMapTags`): the merge that keeps every entry it doesn't
     own;
   - the Duty Menu's sign-and-publish route, `POST /api/assistant/duty-menu/publish`
     (`src/api/assistant/dutyMenuPublish.js`, `handlePublishDutyMenu`; the client is
     `ui/src/utils/publishAssistantDutyMenu.js`): how the instance has a viewer's Assistant sign, and its `routeAccess.js`
     entry;
   - the other writers of a kind 10040: `src/api/export/nip85/commands/*kind10040*.js` and
     `src/api/assistant/profileDefaults.js`. The TA's 10040 is also the instance's own Treasure Map, so never
     regenerate it blind (CLAUDE.md principle 4).

## 3. Questions to settle at Planning, before any design

1. **Ship story 2 alone, or with story 3?**
   - On its own, "on" publishes once. Until story 3 keeps the self-Map true, a claim can go stale when Scores stop
     landing, which breaks the book's "honest content" rule.
   - Options: story 2 waits on staging and reaches production only with story 3; or story 2 ships and the page's
     "out of date" mark covers the gap.
2. **What "on" means.** A stored on/off setting per Assistant, which story 3 acts on; or just "a self-Map with
   self-entries exists".
3. **Off.** Remove every self-entry and keep every other entry byte-for-byte, in order. Under draft ADR 0005, that is
   "no stop".
4. **Who presses.** Presumably the viewer, for their own Assistant only, the Owner and customers alike, as elsewhere
   on the hub.

The book's Decision 1 already says the self-Map is "on once, then automatic", and that the page shows what it says
beside what it should say.

## 4. Lessons from story 1 (save a round)

- **Recheck the shared lines at every phase boundary,** not only before Implementation and Review. Staging moved several
  times during story 1, and ADR 0004's acceptance mid-review cost a whole round (R2-B1). Run `git fetch origin
  staging`, then `git merge-tree --write-tree HEAD origin/staging`, then read what landed.
- **A second, independent reader at Review** found real defects in both rounds 1 and 2. Spawn one, with no write
  access and no `npm test`, and reproduce every finding before recording it.
- **When a decision reads a flag or setting, quote the line of code that reads it,** with its comparison and its
  default (ledger `2026-10-12-adr-flag-reading-not-cited`). Tests use the deployments' real config, plus the setting
  absent.
- **Environment:**
  - no `gh` CLI here, so use the GitHub MCP tools;
  - run `npm ci` in the root and in `ui/`;
  - for browser specs, build the UI, run `vite preview`, and use Chromium at `/opt/pw-browsers` with
    `--project=chromium`;
  - stop `vite preview` by pid, never with `pkill -f`, which kills its own shell;
  - read a gate verdict only through `npm run gate:status`.
- **The RW7 flake** (`tagging-edges-realtime-wrapper`) recurs at exactly 0.77 s. It is on ledger row
  `2026-10-08-realtime-wrapper-timing-flake-under-load`. Rerun the suite alone, record the occurrence on the row,
  and never skip the test.
- **Open follow-ups from story 1**, not part of story 2 unless the owner says so:
  - `2026-10-12-stopped-timer-counts-as-upkeep`;
  - `2026-10-12-live-unclaimed-when-unclaimable`;
  - `2026-10-12-self-map-profiles-category-lines`.
