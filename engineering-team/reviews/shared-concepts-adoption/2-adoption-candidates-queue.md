# Review: Story 2 — Adoption-candidates queue

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-06
**Diff:** `git diff 3f6800e6^..HEAD` (commits `3f6800e6` story+book, `6bededd3` ADR, `464b260c` failing tests, `f33fc528` implementation) — 15 files, +1383/−3.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **run independently** (2026-08-06, strfry-router quiesced/restored): every suite PASS including `adoption-candidates-queue` **19/19** and F5's `b-coverage-audit-and-disposition` **26/26 unregressed**; the single failure remains the pre-existing `show-the-four` S5 pin (OPEN.md #143). Result identical to the Implementer's run — and the Implementer additionally demonstrated **five consecutive green story-suite runs** after the #144 fix, the reproduction condition that previously failed by run three.
- [x] `bash scripts/harness-lint.sh` — clean (0 violations).
- [x] Browser verification (Implementer's evidence reviewed, conclusions consistent with the code): 13 real nominations usage-sorted on the live corpus, badges correct, review panel + twin picker live, Declined toggle renders, console clean throughout.

## Spec adherence (story ACs)

- [x] **AC-1 population** — [adoptionQueue.js](../../../src/lib/adoptionQueue.js) implements the S3 base (cross-author only — the self-filed rule at the carrier loop), all three exclusions independently, and usage-sort. U1–U6 + H1/H2/H4 live.
- [x] **AC-2 evidence** — cross-author-only counts + usedByMe (U3, H1); rendered per row.
- [x] **AC-3 adopt** — twin picker → the shipped `b-append` (sentinel-replace semantics inherited from F5) + community broadcast; H4 live.
- [x] **AC-4 recognize** — `create-element` with identifiers prefilled, exactly the New.jsx payload; exclusion U-covered by both identifier forms (U5). The **recorded gap** (no H row — a per-run permanent registry element would violate #128) is honest and correctly dispositioned; the registry *scan* path runs live in every queue call.
- [x] **AC-5 decline** — the runtime ledger concept (ensure idiom, [normalize/index.js](../../../src/api/normalize/index.js) — schema required-complete, dated, append-only, nonce d-tags); newest-per-target with tie-toward-visibility (U6 pins the contract); Declined view + reversal (H2/H3 live round-trips).
- [x] **AC-6 nothing auto-acts** — the queue GET is read-only by construction; empty states present in the page for both views.
- [x] **AC-7 gating** — queue GET public (H1 host fetch); producer gates first-line with the F5 pair (S2, structure-bounded, before any mint — verified in the landed body); remote 401 (H6).
- [x] **AC-8 gates** — per Quality gates.
- [x] No criterion silently dropped; no scope creep (the OPEN.md #144 row is required harness-friction discipline).

## ADR adherence + amendment audit

- [x] Files match ADR 0002's notes exactly: pure core / adoption module / producer-in-normalize / UI seams; `strfryScan` **shared from bDisposition, not copied** (S5 — the export is the only F5-file touch); route named `adoption-queue` (matches neither the F5-S4 regex nor any count pin); ledger concept **never under firmware/** (S3, and verified in the live graph as runtime-created).
- [x] **Four Phase-4 suite amendments — AUDITED, each strengthens or preserves:** (1) S2's gate regex broadened to the normalize producers' De Morgan spelling — equally strict, still failed pre-implementation; (2) H1's fixture-integrity assert — pure addition; (3) bounded settle-polls — semantic assertions preserved, fail-on-timeout with self-describing diagnostics; (4) **the monotonic `nextStamp` fixture discipline** — fixture infrastructure only, zero product-path changes, and it closed a real, deterministic-once-seen defect class: teardown stamps racing F5's `created_at` bump left a fixture twin silently wired, poisoning subsequent runs through the S2a exclusion. Root-caused with parallel-observer evidence; **OPEN.md #144** records the class, and its latent-sibling claim about the F5 suite's blind-stamped teardown was **verified accurate** in this review ([b-coverage test:176](../../../test/b-coverage-audit-and-disposition.test.js)). All four were surfaced unprompted in the test plan and the gate message — the correct handling of the Phase-4 test-edit blur, again.
- [x] No new dependencies; `invokeNormalizeHandler`/ensure idiom used as designed; `PUBLIC_MUTATIONS`, middleware, scripts, protocols all byte-untouched.

## Concept-graph integrity

- [x] One new **runtime-created** concept (`adoption disposition`) via the ensure idiom — **firmware reinstall: N/A** (matches ADR; S3 pins it out of firmware forever). No hardcoded pubkeys (zero 64-hex additions under src/ui; test-file throwaway key is the sanctioned exception, non-secret by construction).

## Things tests can't catch

- [x] Injection: the producer validates `target` through `classifyBValue` before it reaches any mint; the queue GET takes no parameters; the page's community strings render through React escaping.
- [x] The queue GET's five scans are read-only and error out loudly (500) rather than degrade silently.
- [x] No secrets, no debug logging, no leftover instrumentation (the forensic probes lived in throwaway shells, not the tree).

## Findings

### Blocking

None.

### Non-blocking

1. **[adoptionQueue.js:104](../../../src/lib/adoptionQueue.js)** — a declined-*then*-wired concept still lists in the Declined view (the declined branch precedes the wired check). Truthful to the latest ledger record and harmless (it is excluded from nominations either way), but the Declined view can show a concept that no longer needs reversing. Cosmetic; revisit if the view confuses.
2. **Recognized-by-event-id staleness** — a registry record identifying by event id matches the *newest* header version's id, so recognition by id can lapse after the foreign author republishes. The a-tag path (what the queue's own Recognize stores) is durable. Inherent to id-form identifiers; note for F3.
3. **Twin picker cosmetics** — duplicate-named TA headers render as separate entries (distinct d-tags), and fixture headers appear (they are genuine TA headers — the accepted-residue class made visible). Both cosmetic; a name-dedup or annotation could come with F3's surfaces.

### Harness friction

1. OPEN.md **#144** filed during Implementation (the replaceable-tie fixture class + the latent F5-suite sibling). Nothing further from this phase.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Book box **F1 ticked**; completion detection performed — book remains Open (F2/F3/F4 unbuilt); result reported in chat.
