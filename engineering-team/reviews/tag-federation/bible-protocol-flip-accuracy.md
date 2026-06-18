# Review (docs-mode): BIBLE §21/§22/§25/§26 + inherit-from.md — b-tag primitive flip accuracy

**Reviewer:** Claude (acting as Reviewer, Protocol-Spec docs-mode)
**Date:** 2026-06-17
**Branch:** `feat/b-tag-primitive` (unmerged; auto-deploys nowhere)
**Diff:** `git diff BIBLE.md protocols/drafts/inherit-from.md` (working tree on `0b9cf443`)
**Scope:** prose-accuracy audit — no test gate gates this docs-only diff.

## Quality gates

- [x] `npm test` (`node test/test.js`) — ran to completion. Only failures are **pre-existing and environment-bound** (`pin-a-tag-publish` / `tl-publication-from-pins`: `fetch failed`; `authored-tagging` / `profile-tag-polish`: `settings.json not writable` SKIPs) — live-stack deps absent in sandbox, matching the recorded "3 pre-existing failures." **The diff touches zero code/test files** (`--stat`: `BIBLE.md` 10 lines, `inherit-from.md` 1 line), so the suite is not affected by these edits.
- [x] Playwright — N/A (no browser/UI change).
- [x] Lint / typecheck / build — not configured.

## Ground-truth cross-check (claim by claim)

Authoritative source = the as-built code on this branch.

1. **§22 Status-today "implemented … seeds … re-signs with TA key … derives source:'b-tag' … stub skipped … applied to the four concepts."** — **ACCURATE.**
   - Seed + never-clobber: `install.js:1054` (`tags.some(t=>t[0]==='b')`), append `['b', cr.headerATag, 'pointer']` `:1059`.
   - Re-sign: `loadTAKey()` `:1060` + `signAndFinalize({kind:39998,…})` `:1061`; publish `:1062`; import `:1063`.
   - Derivation `source:'b-tag'`: `eventSync.js:272-277`.
   - Stub-skip gated on `seededB`: `install.js:1261-1266`.
   - "Applied to `nostr-relay` + `tag`/`nostr-user-tag`/`tag-pinning`": `manifest.json` carries `communityReference` on **exactly** those four (`:225, :308, :325, :341`) and no others. Correct.
   - "live-verified at install … the seed, the derived edge, the stub-skip, and the Superset link intact": matches the ADR 0002 "Live verification" section verbatim.

2. **§22 "never-clobber within-run-only … reinstall re-seeds the firmware-default b … operator's manual re-point does not survive a reinstall."** — **ACCURATE and correctly framed as accepted, not a defect.** Matches the ADR 0002 "Finding … (accepted as defensible)" section and ADR 0002 line 110 ("Decision (requester, 2026-06-17): accept"). Mechanism (pass1/pass2 rebuild the TA header from the static firmware conceptHeader JSON, b-less, before `pass_communityReferences` runs) is consistent with `install.js` (headers built in pass1/pass2 from `entry.conceptHeader`; the emitter scans a freshly-rebuilt header at `:1043-1046`). BIBLE flags it "(accepted; restore-firmware-defaults is the intended reinstall semantics …)" — correct register.

3. **§22 "graceful: local pointer-b seeds from the manifest headerATag literal even when the community-header fetch or pin-verify fails — only the foreign-node materialization + Superset link gate on a successful pin."** — **ACCURATE.** Matches ADR 0034 OQ-1 exactly. Verified against the emitter control flow: the seed block (`install.js:1041-1070`) sits **before** the community fetch (`:1072`) and its `continue`s (`:1078-1085`); a fetch miss / pin mismatch `continue`s past foreign materialization but never undoes the already-placed seed. The inline comment `:1033-1040` states this invariant. Correct.

4. **§25 "Both materialized in buildImportCypher … type-gate keys on the explicit string 'inherit' (never 'not pointer')."** — **ACCURATE.** `eventSync.js:265` `const isInherit = tag[2] === 'inherit'`; `:266-271` `INHERITS_FROM` (no source), `:272-277` `REFERENCES {source:'b-tag'}`. `child` is the event's own uuid (header-level), per the `:260` comment. Single import chokepoint, so derivation runs on install and ongoing sync. Correct.

5. **§26/1542 "On-wire b-tags now exist (the pointer-typed firmware seed) … but the resolved-definition read half needs inherit-typed b-tags plus the merge-walk resolver — both still future (firmware seeds only pointer)."** — **ACCURATE.** No resolver / merge-walk / resolved-definition reader exists anywhere in `src/` (grep returns nothing). Firmware seeds only `'pointer'` (`install.js:1059`), which derives `REFERENCES`, not `INHERITS_FROM`, and does not participate in resolution. Story 38 did not build the resolver. Correct.

6. **`inherit-from.md` "Implementation" line:** write-primitive + derivation implemented (ADR 0034/0002); resolved-definition read NOT. — **ACCURATE.** Correctly scoped: emitter in `pass_communityReferences`, derivation in `buildImportCypher`, applied via tag-federation ADR 0002; read primitive (live merge/closure walk) explicitly "not implemented." Matches code reality.

7. **Overclaiming (PROD/staging deployment):** — **NONE.** No edit claims prod or staging. Wording used: "implemented," "live-verified at install" — both correct for an unmerged branch verified on the local stack. No "deployed to prod / on staging" appears. Clean.

8. **Stale-claim check:** — **CLEAN.** Grep over the flipped §22 paragraphs (1438–1462) for `not yet wired` / `no seeding code` / `deployed)` / `interim stub form` / `one concept` / `nostr-relay … no seeding` returns nothing — all the old Status-today text was replaced. The **collision contract** (line 1456) still names exactly two producers (`firmware-community` stub + `b-tag`) and the **precedence model** (line 1458, `grapevine-resolved → firmware-blessed → none`) is unchanged — both remain internally consistent with the flipped Status-today and the glossary entry.

9. **Cross-reference integrity:** — **ALL RESOLVE.** Cited targets exist: `community-reference` ADR 0029 (`0029-b-type-registry.md`), ADR 0030, ADR 0032, ADR 0034; `tag-federation` ADR 0002 (`0002-per-concept-b-tag-seeds.md`); §25 and §22 internal pointers point to the right sections. The ADR-0030 fp8 **flip-site mandate** ("the status-today text is the designated flip site for the future code story") is satisfied: the designated paragraph has been flipped from stub/not-yet-wired to implemented, with the §27-precedent labels retained ("Ratified semantics … / Status today …").

## Concept-graph integrity
- [x] Handles in `kind:pubkey:slug` form throughout (`39998:<localTA>:<slug>`, `39998:82b75e47…:<slug>`).
- [x] No concept *definition* changed by this diff (docs only) — no firmware reinstall triggered by these edits. (The reinstall that activates the primitive is ADR 0002's concern, already verified there.)
- [x] Docs correctly describe runtime TA resolution (`firmware.getTAPubkey()` / `<localTA>`); the `82b75e47…` literals are the ADR-0015 named-exception data coordinate, not a hardcoded signing key.

## Things tests can't catch
- [x] No secrets. The `knownGoodEventId` / `headerATag` values are public event ids / coordinates (data), not keys.
- [x] No overstatement understated either — the "registry-correct though firmware seeds only pointer" qualifier on the `INHERITS_FROM` mention is precise and prevents implying inherit-typed seeds ship today.
- [x] No internal contradiction between glossary (§21), §22, §25, §26, and the protocol draft.

## Findings

### Blocking
None.

### Non-blocking
1. **BIBLE.md §22 Status-today** — the paragraph is one very long sentence-chain; readability only, not accuracy. Optional: no change required for this PASS.

## Verdict
**PASS** — every audited claim is accurate against the as-built code, the manifest, and the governing ADRs (0029/0030/0034, tag-federation 0002). No overclaim (no prod/staging deployment asserted), no stale "not-yet-wired/no-seeding/one-concept" text remains in the flipped §22 area, the collision-contract and precedence paragraphs stay internally consistent, and all ADR/§ cross-references resolve. Commit as-is.
