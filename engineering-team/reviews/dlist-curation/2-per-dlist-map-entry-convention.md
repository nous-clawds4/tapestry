# Review: Story 2 — Per-DList curation entries on the Treasure Map — wire convention

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-10
**Diff:** `git diff 66190a9f..HEAD` (commits `8a0a850a` ADR 0002, `8e9b1255` spec section + pointers;
docs-mode — numbered form because the story is storied; claims-adherence table per the review
template's docs-mode variant; precedent: `reviews/done/tl-treasure-map/1-…`)

## Quality gates (run by reviewer, not trusted)

- [ ] `bash scripts/harness-lint.sh` — **1 violation, introduced by this diff:**
      `VIOLATION L9 BIBLE.md — 'Last updated: 2026-08-17' lags the last git change (2026-09-10) by 24d (>14)`.
      At the base `66190a9f`, BIBLE.md's last change is `1eb54c07` (2026-08-17) = the header date, i.e.
      0 days — clean. Commit `8e9b1255` edits BIBLE.md:1079 without bumping BIBLE.md:8. Everything else
      is pre-existing waivers/INFO.
- [x] Links and anchors resolve — every `[..](..)` on an added or modified line was resolved
      mechanically (scratchpad script): BIBLE → `protocols/drafts/assistant-designation.md`; README row →
      `./drafts/assistant-designation.md`; draft → `#per-dlist-curation-entries` (anchor present),
      `../nips/decentralized-lists.md`, `./inherit-from.md`,
      `./trusted-lists.md#treasure-map-advertisement-kind-10040` (anchor present); trusted-lists →
      `./assistant-designation.md`. The plain-text ADR path in the section exists.
- [x] README row ↔ BIBLE pointer ↔ draft ↔ ADR mutually consistent — `protocols/README.md:61` (scope phrase
      + `dlist-curation #2`, status 📝 pre-NIP unchanged), `BIBLE.md:1079`, draft `:11–13` intro, ADR
      Decision §§1–8.
- [x] Targeted regression suites — every suite under `test/` that reads a changed file (grep over `test/`
      for BIBLE.md, protocols/README, the two drafts, the handoff; also checked for `path.join`-segment
      forms — none), each via `node -e "require('./test/<f>').run()"`:
      `tag-applicability` 19/0 · `event-tagging-spec` 5/0 · `open-ranking-stats` 29/0 ·
      `treasure-maps-router-preset` 5/0 (reads the BIBLE section directly below the edited paragraph) ·
      `b-tag-primitive` 16/0 · `b-coverage-audit-and-disposition` 26/0 ·
      `task-queue-semaphore-protection-audit` 6/0 · `scheduled-search-and-house-scores-refresh` 12/0 ·
      **`harness-lint` 40 passed / 1 failed** — the failure is
      `✗ the real repo lints clean (violations fixed or waived with citations)`, i.e. the L9 violation
      above. That suite is part of `npm test` (`test/test.js:157`, `:543`; its zero-failure result is
      in the overall pass condition at `:1419`), so **`npm test` regresses on this diff** independently
      of OPEN.md row 191's default-red trusted-lists L0 guards.
- [ ] Full `npm test` — not run: markdown-only diff; all nine doc-reading suites were run individually
      above; the full run is ~41 min and red-by-default on the L0 guards (row 191). The regression it
      would surface is already identified (the harness-lint suite).
- [x] Sweeps — no 64-hex literal anywhere in the diff (no hardcoded assistant/TA pubkey);
      `git diff --check` clean.
- [x] _Lint / typecheck / build not configured — skipped._

## Claims-adherence table *(docs-mode variant — one row per substantive claim)*

| # | Claim (spec section / ADR / pointers) | Evidence checked |
|---|---|---|
| 1 | The ratified Treasure-Map parse rule reads: split on `:` — one all-digits segment ⇒ generic TL entry; two segments ⇒ kind:metric or a named TL entry | `protocols/drafts/trusted-lists.md:100–103`; ADR `decisions/done/tl-treasure-map/0001` Decision §1 (`:72–75`). The per-DList key is the two-segment form, so no amendment was needed — the appended sentence (`:103–106`) only routes the `39998`/`39999` prefixes to the opaque-remainder rule. |
| 2 | The multiplicity / writer / reader rules are "the rules the Trusted Lists spec ratified for its generic Map entry, restated for this family" | `trusted-lists.md:109–114`: at most one per kind; switching **replaces** in place; every other tag preserved verbatim; fresh `created_at`; duplicates ⇒ first occurrence wins. All five are restated at draft `:78`; ADR 0001 Decision §3–§4 agree. |
| 3 | `classifyEntry` already splits at the first colon and classifies a `39998:*` entry `other` | `ui/src/utils/treasureMap.js:10` (`/^(\d{5})(?::(.+))?$/` — `.+` swallows later colons), `:24–36` (kind outside 30380–30399 ⇒ `'other'`; never throws). Rendered as "other" by `ui/src/pages/grapevine/TreasureMapTagsPanel.jsx:7,23,80` — no crash. |
| 4 | `SearchPreferences.jsx` `parseMetrics` ignores such entries | `ui/src/pages/grapevine/SearchPreferences.jsx:72` — `tag[0]?.startsWith('30382:')`. |
| 5 | `customerManager.js` `extractRelayPubkeyFromKind10040` ignores them | `src/utils/customerManager.js:2618–2630` — exact `tag[0] === '30382:rank'`. |
| 6 | "Nothing breaks meanwhile" also holds for the readers the ADR did not enumerate | `ui/src/pages/grapevine/TrustedAssertionsList.jsx:46,53` (exact / prefix), `ui/src/pages/BrainstormSearch.jsx:332–335` (prefix + exact), `ui/src/hooks/useTrustWeights.js:78` (exact), `ui/src/pages/grapevine/TrustDetermination.jsx:485` (exact); `TlOptInCard.jsx:41` is class-filtered via `findGenericTlDelegation`; `TreasureMapManualEdit.jsx` has no per-entry validation (JSON error only); `UserDetail.jsx:527` / `TrustDetermination.jsx:592` only count tags. Claim true; the ADR's enumeration undercounts (Non-blocking 5). |
| 7 | Relay hint source `settings.aRelays.aDListRelays[0]` exists, default `wss://dcosl.brainstorm.world`, runtime-resolved via `/api/relays` | `src/config/defaults.json:9–11`; `src/api/relays/index.js:13–17` (public; serves `settings.aRelays`), registered at `src/api/index.js:553`; `ui/src/context/ConfigContext.jsx:42–44`. The empty-string / three-element idiom matches `trusted-lists.md:117–118`. |
| 8 | d-tags may contain colons and the codebase already tolerates them | `ui/src/pages/shared-concepts/Detail.jsx:103–106` — `'#d': [parts.slice(2).join(':')]`. |
| 9 | The DList NIP keeps 39999-declared headers open | `protocols/nips/decentralized-lists.md:373` (phasing out `(3)9998` left as an open experiment); `protocols/drafts/tapestry-concepts.md:51` (kind unification — the parent may itself be a kind-39999 event). |
| 10 | The export generator rebuilds the tag list from config and would clobber these entries | `src/api/export/nip85/commands/create-unsigned-kind10040.js:63–125` — a fresh `tags:` literal of `30382:*` rows, no merge step before `res.json`. `bin/brainstorm-create-kind10040.js:41–43` does the same (handoff D8's second generator). |
| 11 | "`<type>` per the inherit-from registry" is accurate while naming no facet | `protocols/drafts/inherit-from.md:25`, `:86` — registry closed at `pointer` / `inherit`; new values require an ADR (story 3's job). |
| 12 | The blanket entry's status is unchanged — specified, not wired; no resolver | `dlist-header` appears nowhere in `src/` or `ui/src/` (grep, no matches); ADR `community-reference/0031` Decision §2 stands; draft `:32–52` unchanged apart from the compatibility sentence at `:40`. |
| 13 | The dual-author precedence rule is untouched | Draft `:94–112` is outside the diff; ADR 0031 §4 (headers-only subject) intact. See Non-blocking 3 for the `<kind>` wording tension. |
| 14 | Handoff D9 / O2 are consistent with D8 and the ADR; status stays 🔴 OPEN | `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md:140–158` (D8 cost (a) ↔ D9's last bullet ↔ ADR Consequences "debt carried"), `:186` (O2 extended in place), `:3` status unchanged. D9's rejected shapes match ADR Options B and C. |
| 15 | The section mirrors ADR 0002 Decision §§1–8 in spec voice and adds nothing normative | Point-by-point: draft `:58–64` ↔ §1; `:66` ↔ §2; `:68–74` ↔ §3 (the SHOULD and both MUSTs identical); `:76` ↔ §4; `:78` ↔ §5; `:80` ↔ §6; `:82` ↔ §7; `:84` ↔ §8; `:86–92` ↔ the worked example in Implementation note 1. Only two glosses were added ("so the Map never points at a header that does not exist"; "the same compatibility posture as the blanket entry") — both true, neither adds a rule. Intro `:11–13`, blanket-scope bullet `:50`, deployment status `:120` match notes 1a/1b/1d. |
| 16 | RFC keywords are used consistently | MUST / MUST NOT / SHOULD appear exactly where ADR §3–§4 use them; the rest of the section is descriptive, like the blanket-entry section above it. |
| 17 | Story AC-9's pointer set matches what changed | Diffstat = the five files ADR notes 1–5 name + the story; `tapestry-concepts.md:49` untouched and still accurate (note 6). The story's two placement questions are answered (ADR Option D rejected; BIBLE placement in note 3). |
| 18 | The Phase-4 deviation (draft `:40` now reads "`39998:*` or `39999:*`") is justified | The intro `:13` claims both families; leaving `:40` at `39998:*` would have left the compatibility claim incomplete. Same claim, one sentence, disclosed in the story. Accepted. |
| 19 | "harness-lint is clean" (story Deviations) | **Does not hold for the committed diff** — Quality gates / Blocking 1. It was true in the working tree (L9 is commit-dated) and became false once `8e9b1255` landed. |
| 20 | No concept / schema change; no firmware reinstall; no literal assistant pubkey | ADR Consequences; the diff touches no `firmware/` or concept files; the sweep found no 64-hex literal; the entry's provider is the owner's assistant, described as runtime-resolved. |

## ADR adherence
- [x] Files changed match ADR implementation notes 1–7 exactly, plus the one disclosed sentence.
- [x] No code, no dependencies, no `test/` changes (docs-mode).

## Concept-graph integrity
- [x] No concept definitions changed; no firmware reinstall required (ADR states it; diff confirms).

## Things tests can't catch
- [x] No secrets, no debug output, no commented-out matter.
- [x] Adversarial probes — (a) can a per-DList key collide with the blanket entry? Only via the d-tag
      `dlist-header`, which §4 reserves for both kinds; `39999:dlist-header` is forbidden and assigned
      no meaning — consistent. (b) Does first-colon splitting disturb the bare-kind TL rule? No: a bare
      kind has no colon, and the `39998`/`39999` prefix is what routes a reader to the opaque-remainder
      rule (`trusted-lists.md:103–106`). (c) Could `classifyEntry`'s `'other'` drive behavior today? No —
      every behavior-driving reader filters on `30382:` or on class (rows 3–6).
- [x] Collateral damage outside the diff: none — reader sweep (row 6).

## House rules check
- [x] Assistant / TA pubkey never literal; runtime resolution prescribed.
- [x] No new lint / typecheck / build tooling.

## Findings

### Blocking
1. **BIBLE.md:8** — the `**Last updated:**` header still reads `2026-08-17` while this diff (`8e9b1255`)
   edits BIBLE.md:1079 on 2026-09-10. `scripts/harness-lint.sh` reports
   `VIOLATION L9 BIBLE.md — lags the last git change by 24d (>14)`, and `test/harness-lint.test.js`
   → `✗ the real repo lints clean` fails as a direct consequence; that suite is wired into `npm test`
   (`test/test.js:157`, `:1419`), so the docs gate and the test gate are both red because of this diff
   (both were clean at the base — BIBLE.md's last change there is `1eb54c07`, 2026-08-17). The spec
   prose itself needs no change. **Asked change:** bump BIBLE.md:8 to
   `**Last updated:** 2026-09-10 (content: § Assistant Keys — the "TA designation on kind 10040" paragraph gains the per-DList curation entries pointer + wiring status — dlist-curation #2 / ADR 0002; prior: §3 "The wider estate" …)`
   in the header's established chain format, then re-run `bash scripts/harness-lint.sh` (expect 0
   violations) and `node -e "require('./test/harness-lint.test.js').run().then(r=>console.log(JSON.stringify(r)))"`
   (expect 41 passed / 0 failed).

### Non-blocking
1. **BIBLE.md:1079** — "(they rebuild the full tag list from config; a merge-preserve fix is required —
   and would clobber per-DList entries too)": the em-dash clause attaches grammatically to "fix"; the
   clobbering subject is the rebuild. Optional, can ride along with Blocking 1: "(they rebuild the full
   tag list from config — which would clobber per-DList entries too; a merge-preserve fix is required)".
2. **BIBLE.md:1079** — "per-DList entries are wired by the `dlist-curation` book (stories 4–6 …)" mirrors
   ADR note 3 verbatim but reads as already shipped; the draft's own status line
   (`assistant-designation.md:120`) says "are being wired". Optional: align to "are being wired
   (stories 4–6, in flight)"; whichever story ships Map Entries (#6) should flip both to past tense.
3. **protocols/drafts/assistant-designation.md:84 vs :96–102** — the per-DList Precedence paragraph
   parameterizes `<kind>` (39998 or 39999) while the lookup section it defers to is written for
   `39998:<U>:<S>` and names kind-39998 headers as its subject. Faithful to ADR 0002 §8 and story AC-7,
   and the story scopes 39999-declared-header semantics beyond reconstruction out, so not a defect of
   this diff — but a reader curating a 39999-declared header finds no lookup rule for it. Candidate for
   story 3's docs touch or the draft's next revision: generalize the lookup section's `<kind>`, or
   scope `:84` to 39998 explicitly.
4. **engineering-team/decisions/dlist-curation/0002-per-dlist-map-entry-convention.md:44–48, :143–145**
   — Context/Consequences name one "export generator" (`create-unsigned-kind10040.js`); handoff D8 and
   `bin/brainstorm-create-kind10040.js:41–43` show two rebuild-from-config generators plus a wrapper
   (`create-and-publish-kind10040.js`). The draft and BIBLE correctly say "generators". Story 7's scope
   should name all of them.
5. **engineering-team/decisions/dlist-curation/0002-per-dlist-map-entry-convention.md:30–36** —
   "grep-verified … three readers" undercounts: claims row 6 lists four more first-element readers and
   two tag-count displays. The tolerance claim survives; story 6 (Map Entries class) should work from
   the full list.
6. **protocols/drafts/assistant-designation.md:120, protocols/README.md:61** (both re-touched by this
   diff; also handoff `:206`) — "BIBLE §953" is a stale line reference (Assistant Keys is at
   BIBLE.md:1056 today; BIBLE has no §953). Pre-existing and outside the ADR's edit list; candidate
   small doc-drift fix.
7. **docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md:153** — D9's "type per the D2 registry" points at a D2
   that still names `"reference"` (the `"pointer"` rename is parked there) while the ratified registry
   is `pointer` / `inherit`. Pre-existing handoff drift; D9 is internally consistent with the handoff.

### Harness friction *(candidate OPEN.md `meta` rows — not edited here)*
1. **L9 is commit-dated, so a pre-commit lint run is blind to it.** `check_L9`
   (`scripts/harness-lint.sh:221–236`) compares the header to `git log -1 -- BIBLE.md`; a working-tree
   edit leaves that date unchanged, so the Implementer's `harness-lint.sh` run was genuinely clean and
   the violation only materialized when `8e9b1255` landed — the story's "harness-lint is clean" was
   honest and wrong at once. Fix candidates: have L9 treat a `git status`-dirty BIBLE.md/OPERATIONS.md
   as changed today, and/or add "bump `Last updated` when touching BIBLE.md" to the docs-mode
   Implementer checklist (`workflows/protocol-spec-workflow.md` → Docs-mode rules).

## Verdict
**CHANGES_REQUESTED** — one blocking item (BIBLE.md:8 header bump); the spec section, cross-references,
and pointers are otherwise accurate and ADR-conformant, and every non-blocking note is optional.

## Close-out
- Story `**Status:**` not flipped and the story's "Review:" line not filled — both happen on the
  re-review that passes. No spec, BIBLE, README, handoff, source, or test file was edited by the Reviewer.
- Completion detection deferred to the passing round. For the record: book `dlist-curation`, frame
  bullet 4 (empowerment convention) would be met by this story; bullets 3 and 5–9 stay open (stories
  3–7). The book is not complete.
