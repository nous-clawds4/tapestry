# Completion report — add-a-concept-to-a-tapestry

**Date:** 2026-07-28
**Scope:** every bullet of the acceptance frame in `book.md` § "Acceptance frame", with primary evidence for each. Evidence pointers are files in this repo, public URLs, or read-only probes that can be re-run as-is. Shipped as PR [#476](https://github.com/nous-clawds4/tapestry/pull/476) → `staging` (merge `ac09d591`, deploy run [30340623300](https://github.com/nous-clawds4/tapestry/actions/runs/30340623300), 1m32s, success). Nothing was promoted past staging.

The feature: story `engineering-team/stories/tapestries/5-add-a-concept-to-a-tapestry.md` (Status: Done; review PASS at `engineering-team/reviews/tapestries/5-add-a-concept-to-a-tapestry.md`), design `engineering-team/decisions/tapestries/0005-add-concept-add-only-republish.md`, implemented entirely in `ui/src/pages/tapestries/` (no server changes).

## Evidence classes used below

- **[FULL-SUITE]** `engineering-team/audits/add-a-concept-to-a-tapestry/gate4-full-npm-test-2026-07-28.log` — the complete `npm test` at the implementation commit: `GATE4_EXIT=0`, `Overall: PASS`, `add-a-concept-to-a-tapestry suite: PASS (23 passed, 0 failed)`. Re-runnable: `npm test` (~32 min).
- **[NODE-SUITE]** `test/add-a-concept-to-a-tapestry.test.js` — P1–P13 pure-transform, S1–S6 source sentinels, R1–R4 regression guards. Re-runnable in seconds: `node -e "require('./test/add-a-concept-to-a-tapestry.test.js').run().then(r => console.log(JSON.stringify(r)))"` → expect `{"pass":23,"fail":0}`.
- **[PLAYWRIGHT]** `tests/brainstorm/tapestry-add-concept.spec.js` — E1–E13 browser round-trip against the served UI with mocked network (both signing branches, every negative). Re-runnable: `BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test tests/brainstorm/tapestry-add-concept.spec.js --project=chromium --reporter=line` → expect 13 passed.
- **[LIVE-LOCAL]** the real add performed on the local stack on 2026-07-28: the `cat` concept was added to the live, previously graph-less tapestry `39999:<local-TA>:b0b48b00` ("Tapestry for Farm Animals") by running the shipped `buildAddConceptDraft` on the live relay event and publishing through the real assistant path (`POST /api/strfry/publish`, `signAs:'assistant'`). The resulting state persists and is re-verifiable read-only right now:
  ```
  TA=$(curl -s http://localhost:7778/api/assistant/pubkey | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).pubkey))")
  F=$(node -e "console.log(encodeURIComponent(JSON.stringify({kinds:[39999],'#z':['39998:'+process.argv[1]+':tapestry']})))" "$TA")
  curl -s "http://localhost:7778/api/strfry/scan?filter=$F"
  ```
  → exactly **one** event for d-tag `b0b48b00` (no duplicate row), `created_at` 1785225434 (the pre-add event was 1773183323), tag order `d,name,z,json` preserved, the `tapestry` json block intact, and `json.graph` = the created envelope holding exactly one member node (`cat`, uuid `39998:<TA>:cat`) and one import (`39999:<TA>:cat-concept-graph`).
- **[STAGING]** `https://staging.brainstorm.world` after deploy run 30340623300: serves asset `index-B5IfxynM.js` — the same content hash as the locally verified bundle (deterministic vite build of identical source) — containing the affordance string (`curl -s https://staging.brainstorm.world/ | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1`, then grep the asset for `Add a concept` → 2). All smoke read-only: no event was published or mutated on staging.

## The frame, bullet by bullet

**From the deliverable** — *"From a Tapestry I am looking at, I can add a concept that is not already in it. After I save, the Tapestry shows the new concept — to me, and to anyone else who opens it afterwards."*

- ✅ **From a Tapestry I am looking at, I can add a concept that is not already in it.**
  The affordance lives on the existing Exploration page (`/tapestry/tapestries/<uuid>`), owner-only, tapestry-author-gated: [PLAYWRIGHT] E1 (affordance present for the owner on a TA-authored tapestry, same URL, no new page) and E6 (the picker offers non-members and excludes existing members); [NODE-SUITE] P6/P7 (the transform independently refuses duplicates and slug collisions — no save can produce a duplicate member), S2 (component wiring), S4 (the gate: `classification === 'owner'` and author ∈ {TA, session pubkey}). The save mechanism is real end-to-end: [LIVE-LOCAL] executed the identical shipped transform + publish path against the live relay. The one seam automation cannot cross — a NIP-07 owner click in a real browser session — is covered by E7/E8 driving the actual component through both signing branches with the network mocked at the boundary the real flow uses.
- ✅ **After I save, the Tapestry shows the new concept — to me.**
  Post-save visibility is by re-read of the same coordinate, not client-side optimism: [PLAYWRIGHT] E9 (after the mocked save resolves, the page re-reads — the element-scan count grows — and the added concept renders among the members); [NODE-SUITE] S5 (`useTapestryGraph` exposes the raw event + `reload()`). [LIVE-LOCAL] corroborates on real data: after the real publish, the same read path the page uses (`/api/strfry/scan`) returns the tapestry with members `cat`, and the rendered detail page shows `CONCEPTS: cat`.
- ✅ **…and to anyone else who opens it afterwards.**
  [LIVE-LOCAL] a signed-out browser session opened the tapestry after the add and the page rendered `CONCEPTS: cat` with the integration graph composed (2 nodes · 1 edge; the tapestry had been rendering degraded before the add) — the reader's path is the same relay read any session performs, with zero console errors. [PLAYWRIGHT] E10 pins it in automation: a fresh unauthenticated context opens the same uuid and sees the member (and still no affordance).

**From the boundary** — *"Adding only: taking a concept out, and changing how concepts connect, both stay out. It works on Tapestries published under my own key or my assistant one; a Tapestry published by someone else cannot be edited here and the option is not offered for it. No new page and no new server endpoint — this is an affordance on the Tapestry view that already exists, publishing the way Tapestries are already published."*

- ✅ **Adding only — removal and integration-editing stay out.**
  Structural, not behavioral-only: the transform copies the event verbatim and appends exactly one member node + import — [NODE-SUITE] P3 (every tag byte-identical and in order; json replaced in place; content unchanged), P5 (prior nodes/relationships/relationshipTypes/imports and unknown json keys pass through; exactly one node + one import appended; input not mutated), P2 (title/description/name-tag untouched). No removal or integration-editing surface exists anywhere in the diff (review § scope sweep, with the full diff enumerated). [LIVE-LOCAL]: the republished event differs from its predecessor only by the created envelope + member and the newer `created_at`.
- ✅ **Works on Tapestries published under my own key or my assistant one.**
  The signing branch follows the tapestry's author key through the pre-existing publish paths: [PLAYWRIGHT] E7 (TA-authored → `POST /api/strfry/publish` with `signAs:"assistant"`, same d-tag, prior members + integrations intact) and E8 (owner-authored → NIP-07 signature under the owner's key, `signAs:"client"`, same d-tag); [LIVE-LOCAL] exercised the assistant branch against the real relay. [NODE-SUITE] P12 (the coordinate follows the event's author); R3 (the server still 403-gates assistant-signing for non-owner sessions — the second line of defense, unchanged).
- ✅ **A Tapestry published by someone else cannot be edited here, and the option is not offered for it.**
  [PLAYWRIGHT] E5: a tapestry authored by a foreign pubkey gets no affordance even for the signed-in owner. E2 (guest), E3 (unauthenticated), E4 (an `admin` who is not the owner) get no affordance on any tapestry; each negative first asserts the members render, so the absence is not vacuous. [LIVE-LOCAL] and [STAGING]: signed-out sessions on both instances render tapestry detail pages with no add affordance present.
- ✅ **No new page and no new server endpoint — an affordance on the existing Tapestry view, publishing the way Tapestries are already published.**
  The diff outside tests and process artifacts is exactly six files under `ui/src/pages/tapestries/` (`git diff --stat db7c5a7a..ac09d591 -- ui/ src/` — zero `src/` changes, no router change, no new route); the affordance renders inside the existing Exploration page ([PLAYWRIGHT] E1 asserts the URL is unchanged; E7 asserts no navigation on save). The publish paths are the ones tapestry creation already uses, byte-unchanged (`git diff db7c5a7a..ac09d591 -- src/api/` is empty; the review's ADR-adherence section verifies the reuse at file:line).

**Knowingly surrendered in this mode** — ✅ stated, not dropped: the book's generated section carries the endpoint's own `surrendered` block verbatim (baseline commit; pinned governing versions), each with its reason.

## Deployment state

- **Local:** built (`vite`, asset `index-B5IfxynM.js`), deployed to the local container, five-tier smoke clean; the live add above was performed here.
- **Staging:** PR [#476](https://github.com/nous-clawds4/tapestry/pull/476) plain-merged into `staging` at 2026-07-28T08:00:36Z (merge `ac09d591`) after a `safe` pre-merge deploy-safety verdict; deploy run [30340623300](https://github.com/nous-clawds4/tapestry/actions/runs/30340623300) succeeded in 1m32s; five-tier smoke clean (stability 3×2s; all pages/APIs 200; byte-identical bundle serving the feature; anonymous tapestry detail renders with no affordance and no console errors; adjacent surfaces 200). Staging smoke was **read-only**: no add was performed there — exercising a live add on staging mutates shared staging data and is deliberately left to the operator (one click on any owner/TA tapestry's Exploration page while signed in as owner).
- **Production:** untouched.

## Known limits, stated plainly

- The owner's real-browser click-through (NIP-07 signature prompt included) was not exercised by automation on either instance — automation has no NIP-07 signer (`docs/SMOKE_TEST.md` § Limits). The component, gate, picker, both signing branches, error branch, and post-save re-read are covered by [PLAYWRIGHT] against the real served bundle with the network mocked at the exact boundary the real flow crosses, and the below-the-click mechanism is proven on real data by [LIVE-LOCAL].
- The live add was demonstrated on local only; staging carries the byte-identical bundle but its data was not mutated (see above).
- Two pre-existing issues surfaced during the run are recorded outside this report's scope in `OPEN.md` (#116 and the stale `tapestries-nav-and-directory.spec.js` AC-5 case folded into it); neither is caused or worsened by this change.
