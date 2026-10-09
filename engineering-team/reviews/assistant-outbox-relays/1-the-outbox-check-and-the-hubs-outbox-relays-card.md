# Review: Story 1 — The outbox check and the hub's Outbox Relays card

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-09
**Diff:** `git diff 50a6103..ccb4bbc`: the tests `9a9b715` (Phase 3) and the implementation `ccb4bbc` (Phase 4). The three stories share both commits. This review covers story 1's part: `src/lib/relay-list/index.js` (`normalizeRelayUrl`, `parseRelayList`, the caps), `src/api/assistant/attention.js`, `src/api/assistant/outboxRelays.js` (`checkOutboxRelays`, `evaluateOutboxRelays`), `ui/src/pages/assistant/actions.js`, `ui/src/pages/assistant/Index.jsx`, the hub's done rule in `ui/src/styles.css`, `ui/vite.config.js`, and the attention entries in `src/api/openapi.yaml` and BIBLE §11. Base `50a6103`. `origin/staging` has since moved to `eea477f`, three test-only commits from assistant-profile-checklist; none touches a file in this diff. `git merge-tree --write-tree HEAD origin/staging` is clean (exit 0, tree `6e25a742`).
**Story:** `engineering-team/stories/assistant-outbox-relays/1-the-outbox-check-and-the-hubs-outbox-relays-card.md`
**ADR:** `engineering-team/decisions/assistant-outbox-relays/0001-the-outbox-check-joins-the-one-attention-answer.md` (Accepted)
**Test plan:** `engineering-team/stories/assistant-outbox-relays/1-the-outbox-check-and-the-hubs-outbox-relays-card.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** on `ccb4bbc` (Node, label `reviewer-outbox-relays`). `npm run gate:status -- --label reviewer-outbox-relays`:

  > `20261009T120133Z-5764-c4eb [reviewer-outbox-relays] started 2026-10-09T12:01:33.183Z on ccb4bbc8 — FAIL, exit 1, 5209 passed, 70 failed, 582 skipped, 284/284 suites; failed: harness-lint, stamped-composite-avatar, my-assistant-page, assistant-profile-check, assistant-profile-checklist-page, assistant-stamped-avatar-for-everyone`

  None of the six failures comes from this diff. I ran each failing suite through its `run()` export in a worktree at the base `50a6103`, and compared with the record:
  - `harness-lint`: the same single violation on both. L10 names `commit:f932e16` ("docs(protocols): Opinionated Views § 2.1…"), which is an ancestor of the base and comes from another session.
  - `stamped-composite-avatar` 8/5/2, `my-assistant-page` 30/1/0, `assistant-profile-checklist-page` 0/14, `assistant-stamped-avatar-for-everyone` 0/19: identical on both. These are the parallel book's intentionally failing Phase-3 tests.
  - `assistant-profile-check`: 0 passed / 33 failed on the base, 3 / 30 here. The three new passes are its C4, D1 and D2, the hub Done badge. This diff builds that badge to the parallel ADR's spec (see ADR adherence).
- [x] **This book's suites, each alone:** `assistant-outbox-check` **29 passed, 0 failed, 0 skipped**. The re-aimed suites: `assistant-attention` 38/0/1, `assistant-management-page` 23/0/1, `assistant-alert` 15/0/0, `assistant-identification-tags-page` 16/0/0, `assistant-taggings-publish` 19/0/1. Each skip is a live H-class test with no stack.
- [x] **Playwright, chromium,** against a fresh `vite build` of `ccb4bbc` served by `vite preview` on :4173. I ran `assistant-outbox-relays`, `assistant-management-page`, `assistant-attention`, `assistant-alert`, `assistant-identification-tags-page` and `assistant-taggings-publish` together: **69 passed, 3 skipped, 1 failed (4.8 m)**.
  - Story 1's browser tests B0, B1 and B2 pass.
  - The three skips are `assistant-management-page` B8 for the three built pages: identification-tags, outbox-relays, and the parallel book's profile.
  - The one failure is `assistant-attention.spec.js:193` B4: the pill expects 8 and gets 9. The 8 is the parallel book's re-aim (`git show 50a6103:tests/brainstorm/assistant-attention.spec.js:191` already expects 8 against a build where the profile is still a placeholder). With both books built it is 11 actions − 3 checked = 8. With only this one built it is 9, which is right for this diff.
  - The preview server was stopped afterwards.
- [x] `src/api/openapi.yaml` parses (`js-yaml`).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._ The UI's `vite build` with the new alias succeeds, and B0 finds the route in the bundle.

## Spec adherence
- [x] Every acceptance criterion has a passing test, and the plan's coverage map holds:
  - AC-1 → C1, B1, plus the re-aimed `assistant-management-page` D2/D3.
  - AC-2 → U1, U2, U12, U13.
  - AC-3 → U3–U5, U7–U10, U14, L2–L5.
  - AC-4 → U6, C2–C4, D1, D2, B1, B2, plus the re-aimed alert and attention specs.
  - AC-5 → S1, S2, U11.
- [x] No criterion silently dropped.
  - AC-3's "finished, as `/setup` means it" is `lookupNewestReplaceable` (`src/api/assistant/attention.js:160-180`): a local hit returns early; a local miss with no outside relay returns `no-outside-relays`; none answering returns `outside-unreachable`.
  - AC-4's "Done badge whichever story is built first" is built here.
- [x] No behavior beyond the story. The `suggestions` field in the action belongs to story 2 (ADR 0002 sub-decision 1) and is reviewed there.

## ADR adherence
- [x] Files match § Implementation notes 1–5.
  - The library is pure CommonJS with no `require` (L1).
  - `lookupNewestReplaceable` is exported beside `lookupByAddresses`, sharing `readWithinBudget` and `newest`.
  - `defaultDeps()` gains `checkOutboxRelays` and `getConfiguredPublishRelays`.
  - `OUTBOX_RELAYS` is exported.
  - The header comment is updated.
  - `outboxRelays.js` follows the lazy-`defaultDeps` idiom.
- [x] Sub-decision 3: outside means `outsideOnly(getConfiguredPublishRelays())` whatever the publish mode (`outboxRelays.js:102`; U8).
- [x] Sub-decision 4: invariants `done ⇒ finished`, `pending ⇒ finished`, `done ⇒ !pending` (`outboxRelays.js:51-72`), and no pubkey in the answer (U13).
- [x] Sub-decision 5: `Promise.allSettled` (`attention.js:264-267`). A rejected outbox check becomes the frozen `OUTBOX_CHECK_FAILED` shape with `suggestions: []` and is logged. A rejected identification-tags check still rethrows to the 500. The `Promise.resolve().then(...)` wrapper turns a synchronous throw into a rejection too.
- [x] Sub-decision 6: the entry follows Identification Tags. `NIP_LINKS.relayList` is added. `CHECKED_ACTIONS = ['identification-tags', 'outbox-relays']` is in action order. The Done badge matches ADR assistant-profile-checklist/0001 sub-decision 7 point by point (`decisions/assistant-profile-checklist/0001-…md:227-240`):
  - `done: string[]` on `assistantAttention`, never a placeholder.
  - The `ActionCard` `done` prop.
  - `is-done`, the ✓ marker, `bs-setup-step-badge is-done`.
  - `ASSISTANT_COPY.done` / `doneSrPrefix`.
  - One CSS rule, `styles.css:8856-8860`, the same three declarations as `.bs-idtags-card.is-done .bs-idtags-card-marker` at `:8986-8990`.

  The parallel suite's C4/D1/D2 passing here confirms the two diffs will agree on those lines.
- [x] No new dependencies (`package*.json` untouched). The Vite alias is configuration, matching the existing cross-boundary aliases.

## Concept-graph integrity
- [x] No concept handle is composed or read. A kind 10002 is not a graph node.
- [x] No concept definitions changed, so no firmware reinstall is needed (story § Concepts touched, ADR § Concept-graph orientation).
- [x] Orientation was done at Architecture through the AGENTS.md §2 fallback (stack absent). The code reads no graph.

## Things tests can't catch
- [x] No secrets, and no 64-hex literal in any added `src`/`ui` line. The assistant comes from `getAssistantPubkeyFor(viewer)` through the session, never a TA literal.
- [x] No leftover debug logging. The one `console.error` (`attention.js:271`) is the failed-check log the ADR asks for.
- [x] No commented-out code, and no TODO/FIXME.
- [x] Error paths:
  - A throwing local scan gives `local-unreadable`.
  - A hanging relay loses the 8 s budget with its timer cleared (U9).
  - A relay answering with another author's list or another kind is filtered by `mine` (U10).
  - Outside reads go through `readRelayEvents`, which verifies signatures (`src/api/_shared/relaySource.js:122,196`), so a configured relay cannot forge the Assistant's list.
- [x] Concurrency: the two checks run side by side, and each owns its own scan. The answer is re-derived per request with nothing stored (principle 3).
- [x] Security: the viewer comes only from `req.session`, and no request parameter reaches the check (U12, S1). The relays read are owner-configured, never request-supplied, so this check has no SSRF surface (contrast story 3's review).

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.
- [x] POV-first: the answer is for the session's own Assistant only. Local-first: this instance's relay first, outside only on a miss. Nothing is written.

## Product-guide adherence
Not applicable: no PRD (acceptance-frame book). Copy matches story § Copy, pinned by C1/C4 against `test/helpers/outboxRelaysFixtures.js`.

## Findings

### Blocking
None.

### Non-blocking
1. **`src/api/assistant/outboxRelays.js:99-104`, `attention.js:264-267`**: until an Assistant publishes its first list (today: every Assistant), every hub or pill load for a viewer with an Assistant reads every configured General Purpose, Profile and WoT relay from the server. That answer, and the identification-tags answer with it, wait up to the 8 s budget when one hangs. This is the trade ADR 0001 § "What we trade away" accepted. Noted only so the first-deploy latency is not a surprise.
2. **`src/api/setup/status.js:38`**: `outsideOnly` treats only `localhost`, `127.0.0.1` and `::1` as this instance's own. Harmless here because the relays read are owner-configured. It matters in story 3, where the same filter guards request-supplied relays (story 3 review, blocking finding 1).
3. **Phase-4 test edits (process).** Story 1's re-aims were corrected inside the `impl:` commit `ccb4bbc`, not in their own `test:` commit. These are `assistant-identification-tags-page.spec.js` B7 and `assistant-taggings-publish.spec.js` B2, now counting the hub at `X.ACTIONS.length − 1`. The rule is workflows/4-implementation.md:38 and templates/adr.md:37.
   - Each edit is right on merits. These mocks carry no `outbox-relays` answer, so the checked Outbox Relays card stays marked: 11 − 1 = 10. The expression stays correct after the parallel book lands, and `assistant-management-page` D2 still pins `length === 11` literally, so the computed count weakens no judge.
   - The rebase's combined re-aims (`test/assistant-attention.test.js` fakes and C2, `test/registry.js`, the three hub specs) keep both books' expectations. For example, `assistant-alert.spec.js` mocks the profile, identification-tags and outbox actions all pending.
   - Neither the corrections nor the rebase resolution is logged under a story `## Deviations` (roles/implementer.md:47). This review is the record.

### Harness friction
1. `.claude/commands/implement-feature.md` does not restate that Phase-4 test corrections belong in their own `test:` commit (Tester's lane). The rule lives only in workflows/4-implementation.md:38 and templates/adr.md:37, and a mixed `impl:` commit passed the Phase-4 gate here. Candidate `meta` row: one line in the command's house rules.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place (`stories/assistant-outbox-relays/1-the-outbox-check-and-the-hubs-outbox-relays-card.md:3`), and the review linked in its § Linked artifacts.
- [x] Completion detection performed; the result is in the chat, not here.
