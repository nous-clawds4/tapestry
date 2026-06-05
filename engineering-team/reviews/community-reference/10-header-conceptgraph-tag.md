# Review: Story #10 — Header→ConceptGraph self-describing tag

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-19
**Diff:** impl commit `51fcdf33` (vs test-design boundary `2accc87a`)
**Story/ADR/Plan:** `stories/10-header-conceptgraph-tag.md` · `decisions/0007-header-conceptgraph-tag.md` · `stories/10-header-conceptgraph-tag.test-plan.md`

## Quality gate (run by reviewer, not trusted)
- [x] `npm test` — **Overall PASS**. header-conceptgraph-tag 2/2 (T1 PASS, R1 PASS); all 8 prior suites + config green. Re-run by reviewer.
- [x] Lint/typecheck/build — not configured; skipped.

## Spec adherence
- **AC-1** ✓ — `['concept-graph', \`39999:${pubkey}:${headerDTag}-concept-graph\`]` added to `headerTags` in `handleCreateConcept`. Value computed from `pubkey` (the signing pubkey, see correctness note) + `headerDTag`; no Neo4j lookup → correct even before the concept-graph node exists, per ADR 0007. Behavioral proof = smoke S1.
- **AC-2** ✓ — deterministic value + kind-39998 replaceable ⇒ idempotent by construction. Behavioral proof = smoke S2.
- **AC-3** ✓ — tag-else-compute resolution contract documented (BIBLE §5). Consumer is stream #5 (out of scope).
- **AC-4** ✓ — nothing reads the tag; existing header tag shape preserved (R1 green).
- **AC-5** ✓ — BIBLE §5 subsection + glossary + §22 deferred-list update. **Placement deviation from ADR's literal "§8 note":** Implementer placed it in §5 (protocol/tags — correct home for an event tag) + glossary + §22 xref, candidly flagged in the commit. Reviewer assessment: this is *more correct* than the ADR note (§8 is word-wrapper JSON, not event tags) — an improvement, not a defect.

## ADR 0007 adherence
- Option A descriptive `concept-graph` tag ✓; computed not graph-looked-up ✓; new headers only, **no mass re-emit / no migration code** ✓ (hybrid C); resolution contract documented ✓. Blast radius = `handleCreateConcept` (one tag) + BIBLE — diff is exactly 2 files, +18/−1. No new deps. No scope creep.

## Things tests can't catch (reviewer audit)
- **`pubkey`-var correctness (resolved):** `src/api/normalize/index.js:1198` `Buffer.from(nt().getPublicKey(privBytes)).toString('hex')` is the established working idiom (identical to `src/api/trustedList/index.js:44`, a shipped feature) and is already load-bearing in handleCreateConcept's duplicate-check Cypher (`:1206`, matched against the finalized `event.pubkey`). If it were double-encoded/malformed, concept creation + dup-detection would already be broken — they are not (used throughout this session). Therefore `pubkey` === the header's signing pubkey and the tag value is correct. No defect.
- No secrets, no debug cruft, no commented-out code, no concurrency surface (pure synchronous tag construction).

## Findings
### Blocking
None.
### Non-blocking
1. **Sharpen smoke S1 (Reviewer-required).** The structural sentinel only checks the literal pattern. S1 must assert the emitted 39998 header's `concept-graph` tag value **exactly equals** `39999:<instance TA pubkey from /api/assistant/pubkey>:<dtag>-concept-graph` (not just a 64-hex regex) — this is the authoritative end-to-end confirmation that the `pubkey` var is the real signing pubkey. Plus S2 idempotency on reinstall.

## Verdict (initial — SUPERSEDED, see Re-review)
~~**PASS (code/ADR/scope).**~~ Premature — see Re-review below.

---

## Re-review (cycle-local S1 — 2026-05-19) — verdict corrected to CHANGES_REQUESTED

**S1 FAILED.** The emitted `nostr-relay` 39998 header carried `["concept-graph","39999:653030656430...6166653964663336:nostr-relay-concept-graph"]`. The pubkey segment is the **hex of the ASCII** of `e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36` — i.e. **double-encoded**. Root cause: `index.js:1198` `const pubkey = Buffer.from(nt().getPublicKey(privBytes)).toString('hex')` — in this nostr-tools build `getPublicKey` already returns hex, so the `Buffer.from(...).toString('hex')` wrapper re-encodes. The tag's pubkey ≠ the header's real pubkey ⇒ AC-1 broken.

**Reviewer self-correction (candid):** the initial PASS dismissed exactly this risk via code-archaeology ("same idiom as shipped trustedList + load-bearing in dup-check ⇒ must be correct"). That was unsound — under double-encoding the dup-check would *silently never match*, so "it works" was never provable by inspection. The structural sentinel (T1) is pattern-only and stayed green throughout. Only the Reviewer-required behavioral smoke caught it. This is the canonical justification for treating that smoke as **mandatory, not optional** — it did its job.

**Scoped fix applied (Implementer kickback):** `handleCreateConcept` now builds the tag with `nt().getPublicKey(privBytes)` directly (un-wrapped). The shared `pubkey` var at :1198 is **deliberately not touched** — that double-encode is a **pre-existing latent bug** affecting the concept dup-check (`:1206`) and `src/api/trustedList/index.js:44` (and possibly other sites), out of scope for #10 and **spun off as a separate flagged task**.

**Verdict: CHANGES_REQUESTED → re-verifying.** Fix applied; cycle-local S1 (exact tag pubkey == real TA) + S2 (idempotent) re-running. Final PASS only on observed-green S1/S2 + npm test. No scope change; the fix is minimal and within ADR 0007.

### Re-review result (cycle-local, post-fix) — PASS

- **S1 (nostr-relay, authoritative):** real firmware-install-emitted 39998 header carries **exactly** `["concept-graph","39999:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-relay-concept-graph"]`; tag pubkey == `event.pubkey` == real TA. Double-encode resolved. **PASS.**
- **S2 (idempotent):** second firmware reinstall → byte-identical tag value. **PASS.**
- **npm test:** header-conceptgraph-tag 2/2 (T1, R1), all prior suites + config green, Overall PASS. Clean container startup.
- **Ad-hoc direct `POST /api/normalize/create-concept`:** not headlessly testable — owner-auth-gated (`{"error":"Authentication required"}`), same class as export-set/firmware-install. Firmware install exercises the identical `handleCreateConcept` path internally, already proven by S1. Documented caveat, **not** a feature signal.

**Final verdict: PASS.** The CHANGES_REQUESTED defect (pubkey double-encode) is fixed and behaviorally verified on the authoritative cycle-local smoke; scope unchanged; the pre-existing shared-`pubkey` double-encode (`:1198`, `trustedList:44`) is spun off as a separate flagged task. Ready for the deploy chain (cycle-staging → cycle-prod, gated).
