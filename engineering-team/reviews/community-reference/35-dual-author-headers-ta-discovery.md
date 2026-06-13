# Review: Story 35 — Dual-author headers + Tapestry-Assistant discovery (kind 10040)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-13
**Diff:** `git diff d9ae80dc~1..d9ae80dc` (commit `d9ae80dc` — "spec: dual-author headers + 10040 TA discovery (ADR 0031)")
**Mode:** Docs-mode (Protocol-Spec workflow) — Test Design skipped by design; audit is accuracy + consistency + no-regression, not coverage.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (Overall: PASS; all suites green — 33 suites, 0 failed). The docs change caused no regression.
- [x] `npm run test:playwright` — not applicable (no browser/UI change; docs only).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Diff inventory

5 files, all docs (`git diff --name-only`): `BIBLE.md` (+2), `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` (±6), `protocols/README.md` (+1), `protocols/drafts/assistant-designation.md` (new, 76 lines), `protocols/drafts/tapestry-concepts.md` (+2). No `src/`, `bin/`, `nip50-proxy/`, `firmware/`, or `ui/` paths touched.

## High-risk factual claims — verified against the code (not taken on faith)

- **(a) The 10040 grammar `["<kind>:<assertionType>", <providerPubkey>, <relayURL>]`, element 2 = the assistant pubkey.** Verified against both generators:
  - `src/api/export/nip85/commands/create-unsigned-kind10040.js:71-127` — tags are `["30382:rank", relayPubkey, nip85HomeRelay]` etc.; element 2 is `relayPubkey` (= the assistant/relay key from `getAssistantKeys`). Grammar matches.
  - `bin/brainstorm-create-kind10040.js:41-97` — identical triple shape; element 2 is `relayPubkey`. Matches. **Claim TRUE.**
- **(b) Backward-compat: a new `39998:dlist-header` row is ignored by every existing 10040 consumer.** Verified across all tag-parsing consumers:
  - `src/utils/customerManager.js:2618-2631` (`extractRelayPubkeyFromKind10040`) — exact-matches `tag[0] === '30382:rank'`; a `39998:*` row is invisible.
  - `nip50-proxy/src/wot-pipeline.js:84` filters `t[0]?.startsWith('30382:')` and `:87` exact-matches `'30382:rank'` — a `39998:*` row is filtered out, breaks nothing.
  - `src/api/export/nip85/queries/kind10040.js`, `get-nip85-participation-data.js:34`, `get-all-10040-authors-{locally,externally}.js` — read only `event.pubkey` / kind, never tag element 1. Unaffected.
  - The spec's claim "the sole tag-parser exact-matches `30382:rank`; all others read only kind/pubkey" is accurate. **Claim TRUE.**
- **(c) Kind 10040 is replaceable, no `d`-tag, no expiry (collision-free).** Verified: neither generator emits a `d` tag or expiry; events are one-per-author replaceable. `39998` never appears as a first-element prefix today, so an additive `39998:*` row collides with no reserved structure. **Claim TRUE.**
- **(d) "Not yet wired" / merge-preserve framing.** Verified: both generators rebuild the full tag list literal from config (`create-unsigned-kind10040.js:71`, `brainstorm-create-kind10040.js:41`), so a hand-added entry *would* be clobbered on the next create — the merge-preserve concern is real and correctly described. No resolver of a `39998:dlist-header` entry exists anywhere in the tree. **Framing accurate.**

## Spec adherence (acceptance criteria — all testable by reading the ratified docs)

- [x] New companion pre-NIP under `protocols/drafts/` (status 📝 pre-NIP) with the established metadata header (Status / Canonical / Sources) — `protocols/drafts/assistant-designation.md:1-4`.
- [x] States the 10040 entry's wire form concretely (`["39998:dlist-header", "<TA-pubkey>", "<relayURL>"]`) consistent with the deployed grammar, plus the designated scope — `assistant-designation.md:34-37` + the field table `:40-44`.
- [x] Revocation/replacement via republishing the replaceable user-signed 10040, no expiry, same posture as the `b` tag — `assistant-designation.md:46`.
- [x] Backward-compat stated (consumers exact-match `30382:rank` / read only kind-pubkey; new row ignored) — `assistant-designation.md:38`.
- [x] Dual-author lookup-and-precedence rule (D7) ratified in the companion: personal `39998:<U>:<S>` root → TA-authored via 10040 → none; deterministic/author-controlled/observer-independent — `assistant-designation.md:52-58`.
- [x] Most-recent-wins across pubkeys explicitly rejected with reason, and delegation-by-composition stated (`["b", "39998:<TA>:<S>", "inherit"]`) — `assistant-designation.md:60-72`.
- [x] BIBLE §953-area gains a pointer to the companion (normative wire form stays in `protocols/`) — `BIBLE.md:976`.
- [x] `protocols/README` index gains a row — `protocols/README.md:57` (well-formed, 5 columns matching the header, link resolves).
- [x] Honest deployed-vs-target (generators don't emit; no resolver) per the §27 / ADR 0030 precedent — `assistant-designation.md:74-76` and `BIBLE.md:976` ("target … not yet wired").
- [x] Merge-preserve recorded as a future code story, not implemented; no source/generators touched — `assistant-designation.md:74-76`; diff is docs-only (verified by `git diff --name-only`).
- [x] `npm test` remains green — confirmed above.

No criterion silently dropped; no behavior added beyond the story.

## ADR adherence (ADR 0031 fixed points 1–7)

- [x] **Site inventory:** all five inventoried edit sites present and matching the ADR Implementation notes — new `assistant-designation.md`; `README.md` row; `BIBLE.md` §953 pointer (line ~975-976, exactly where specified); `tapestry-concepts.md` pointer in the addressing area (`:49`); handoff §5 P3 + §4 O2/O3.
- [x] **Wire form** (fixed point 2) matches: `["39998:dlist-header", "<TA-pubkey>", "<relayURL>"]`, blanket scope, no expiry, revoke-by-republish.
- [x] **Precedence rule** (fixed point 4): personal root → TA fallback → none; headers-only (kind 39998); item authorship not redefined — `assistant-designation.md:58`.
- [x] **Recency rejected, composition preferred** (fixed point 5) — stated with the forged-`created_at` reasoning — `assistant-designation.md:62-72`.
- [x] **Boundary-rule placement** (fixed point 6): wire form + rule normative in the companion; tapestry-concepts + BIBLE carry pointers only; README index row added.
- [x] **Honest deployed-vs-target** (fixed point 7) present in both companion and BIBLE.
- [x] **Checked-clean list honored:** `src/api/export/nip85/*`, `bin/brainstorm-*kind10040*`, all 10040 consumers, `inherit-from.md`, worksheet, ADRs 0029/0030, and `firmware/active/manifest.json` are all untouched (verified by diff). Immutable records untouched.
- [x] No new dependencies, no new tooling.

## Consistency

- [x] **No contradiction with ADR 0029 inherit-from semantics.** The delegation example `["b", "39998:<TA>:<S>", "inherit"]` is a valid inherit-typed `b` tag — `inherit-from.md:27` shows the identical shape (`["b", "39998:<alice>:dogs", "inherit"]`) as canonical. The companion references inherit-from rather than restating it (`assistant-designation.md:58,72`), exactly as the ADR directed.
- [x] **"Deterministic, author-controlled, observer-independent"** in the companion (`:58`) mirrors `inherit-from.md:57` verbatim in intent — internally consistent with the resolution-values vocabulary.
- [x] **BIBLE §953 pointer and tapestry-concepts.md pointer agree** with the companion on the rule (personal wins; else TA; never recency; inherit-typed `b` for freshness) — `BIBLE.md:976`, `tapestry-concepts.md:49`.
- [x] **Handoff P3 / O2 / O3 annotations factually correct:** P3 row now marked ✅ ratified with the right ADR/story/scope (`:196`); O2 resolved to blanket `39998:dlist-header`, no expiry, internal pre-NIP (`:176`); O3 resolved to the companion owning the rule with a tapestry-concepts pointer (`:177`). Handoff stays 🔴 OPEN (P4 remains) per the ADR — `:3`.
- [x] **ADR citations epic-qualified** throughout the new spec (`community-reference` ADRs 0029/0030/0031) — `assistant-designation.md:4,20,72`.

## Cross-references (all resolve)

- [x] `assistant-designation.md` → `./inherit-from.md` (×2) — target exists.
- [x] `BIBLE.md` → `protocols/drafts/assistant-designation.md` (relative to repo root) — resolves.
- [x] `tapestry-concepts.md` → `./assistant-designation.md` — resolves.
- [x] `protocols/README.md` row → `./drafts/assistant-designation.md` — resolves.
- [x] NIP-85 upstream link present and attributed (Vitor Pamplona) — `assistant-designation.md:4,12`.

## Concept-graph integrity

- [x] No live concepts touched; no events emitted. **No firmware reinstall** required (ADR 0031 / story confirm). House rule satisfied — documents only.
- [x] Handles referenced in `kind:pubkey:slug` form (`39998:<U>:<S>`, `39998:<TA>:<S>`).

## Things tests can't catch

- [x] No secrets, no debug logging, no commented-out code introduced.
- [x] No scope creep — diff is exactly the five inventoried doc sites.
- [x] Guard confirmed: no source/10040-generator files changed (the story forbids it).

## House rules check

- [x] Concept Graph API authority respected (no concept definitions changed).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
None.

### Non-blocking
1. **`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md:3`** — the top-of-doc status line still reads "**nothing ratified yet**," which is now stale: the §5 table marks P1/P2/P3 ✅ ratified (P1/P2 predate this story). This is a **pre-existing** hygiene gap, not introduced by this diff, and ADR 0031's Implementation notes explicitly directed "No status flip … doc stays 🔴 OPEN" for this story — so it is correctly out of scope here. Flag for the eventual handoff close-out (when P4 lands, flip line 3 to reflect P1–P3 ratified / P4 outstanding). Not blocking.

## Verdict
**PASS**

The diff is exactly the five doc sites ADR 0031 inventoried, the four high-risk factual claims are verified true against the actual generators and consumers, every acceptance criterion is met, all cross-references resolve, the companion is internally consistent and conforms to ADR 0029's inherit-from semantics and ADR 0031's fixed points, no source/generator files were touched, and `npm test` is green. Mergeable as-is.
