# Review: Story 1 — Per-user assistant delegate

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-28
**Diff:** working tree over `dab19738` (branch `fix/treasure-map-user-assistant`)

## Quality gates (run by reviewer, not trusted)

- [x] Scoped gate — **TOTAL_FAIL=0**: panel 18/18, optin 22/22, guards 8+6+5. Red→green
      demonstrated: the three re-aimed S-assertions were red against the pre-fix components.
- [x] `cd ui && npm run build` — EXIT=0; `bash scripts/harness-lint.sh` — clean.
- [x] Browser (localhost, rebuilt bundle): route loads, zero console errors (logged-out; the
      multi-user path is not NIP-07-automatable here — see AC-6/Not covered).
- [x] The negative pin has teeth: it caught my own explanatory comment carrying the barred
      token before it caught nothing — reworded, pin kept strict.

## Spec adherence

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 delegate = `useAuth().user.assistantPubkey`; `taPubkey` barred from both components | ✅ | S5 (card: useAuth + guard + negative pin), S4 (panel: same); grep 0 occurrences in both files; compose/preview/salient all reference `assistantPubkey` |
| AC-2 badge vs user assistant, label **Your assistant** | ✅ | S5 (panel label assertion); `EntryRow` compares `row.pubkey === assistantPubkey` |
| AC-3 null assistant ⇒ no card, no badges | ✅ | card guard `if (!event || !assistantPubkey) return null`; panel locality null-baseline → no badge |
| AC-4 copy: "Published by your Tapestry Assistant."; ratified prompt verbatim | ✅ | S1 still pins the prompt sentence; green-state copy updated |
| AC-5 spec bullet corrected | ✅ | `protocols/drafts/trusted-lists.md` relay-hint bullet now names the signed-in user's Assistant; §2 wire semantics untouched |
| AC-6 owner path unchanged; U-suites untouched | ✅ | `getAssistantKeys(owner)` returns the owner assistant (assistantKeys.js:20–25), so every owner-visible behavior reproduces; U1–U9 + P-handles unchanged and green |

## Things tests can't catch
- [x] `user.assistantPubkey` provenance: AuthContext ← `/api/auth/user-classification` ←
      `getAssistantKeys(session pubkey)` — owner ⇒ owner assistant; customer ⇒ signup-minted
      relay keys. The exact key the operator expected.
- [x] Recovery path reasoned end-to-end: the production Map's owner-TA entry now classifies
      **external** for its owner's session → prompt → ADR §3 replace-in-place with his key.
- [x] `Avatar`'s instance-TA badge intentionally untouched (identity display, ta-avatar 0001).

## Findings

### Blocking
None.

### Non-blocking
1. **Live multi-user verification** rests with the team member on staging/production (no second
   NIP-07 identity on this machine) — the strongest possible pins short of that are in place
   (source provenance + negative token bar + owner-equivalence reasoning).
2. Provisioning UX for null-assistant users (guests) deferred — product question, book seed.

### Harness friction
1. None new. The escaped defect's root process lesson (ACs can encode a wrong reading and the
   judged interior will faithfully pin it; only a multi-persona scenario catches it) belongs to
   this book's close §7 and the Light-trial record.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection: frame bullets 1–4 met and verified; bullet 5 (recovery) verifiable
      only by the team member's re-run; bullet 6 (row 188 DONE) belongs to the close. Book
      close to be **offered** at Gate B.
