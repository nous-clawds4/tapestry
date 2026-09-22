# Review: Story 1 — The one answer — which identification taggings are missing for your Assistant — and the hub's first real mark

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-22
**Diff:** `git diff 918f1b99..27d5c15d` (the implementation), plus `git diff 918f1b99..433b4e83 -- test/` (the two Tester-lane corrections, story § Deviations 1); everything since the branch point is `git diff 4ff93dd4...HEAD` (HEAD `a333f45b`; `origin/staging` is still `4ff93dd4`, and `git merge-tree --write-tree HEAD origin/staging` is clean)
**Story:** `engineering-team/stories/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.md` (Approved 2026-09-22)
**ADR:** `engineering-team/decisions/assistant-identification-tags/0001-one-assistant-attention-answer.md`
**Test plan:** `engineering-team/stories/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] **The book's gate** (the plan's § How to run: 119 suites, 107 by filename grep + 24 `readdirSync` walkers, computed at run time and all in `test/registry.js`; the launcher printed `named=107 walkers=24 want=119`), Node 22.23.2, label `assistant-identification-tags-1-review`. The `npm run gate:status -- --label assistant-identification-tags-1-review` line (exit 1):

  > `20260922T055644Z-14283-03b9 [assistant-identification-tags-1-review] started 2026-09-22T05:56:44.124Z on a333f45b — FAIL, exit 1, 2248 passed, 25 failed, 59 skipped, 119/119 suites; failed: capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, show-the-four-on-the-goal-screens-that-already-exist, concept-count-canonical, summaries-element-count`

  Read against the baseline record `20260922T053841Z-80977-caaf [assistant-identification-tags-1-baseline]` on `918f1b99` (FAIL, 2213 passed, 60 failed, 59 skipped, 119/119), suite by suite on the record fields `file`, `verdict`, `pass`, `fail`, `skipped`: **118 of 119 suites identical; the one difference is `assistant-attention.test.js`, FAIL 2/35/0 → PASS 37/0/0.** The eleven failing suites are the same eleven in both records — the host's live-graph set (memory `host-gate-at-ci-parity`), none of them touched by this story. The FAIL verdict is therefore the host's, not the diff's; the same set fails on the baseline that predates the implementation.
- [x] **The suite alone**, through its `run()` export with Node 22: 37 passed, 0 failed, 0 skipped; H1 executed (live) against `localhost:7778`.
- [x] **`npm run test:playwright` equivalent** (a browser/UI change): `BRAINSTORM_BASE_URL=http://localhost:7778`, chromium, `--reporter=line`, Node 22, against the built UI the stack serves (B0 confirms the bundle asks `/api/assistant/attention`):
  - `assistant-attention.spec.js` (7) + `assistant-alert.spec.js` (10) + `assistant-management-page.spec.js` (23), one run: **40 passed (3.1m)**, exit 0;
  - the setup book's `setup-alert.spec.js` (50) + `setup-alert-polish.spec.js` (23) + `setup-status.spec.js` (15), run whole as ledger `2026-09-22-parallel-books-no-shared-line-recheck` asks: **88 passed (1.1m)**, exit 0.
- [x] **A genuine signed-in read** (the scratchpad script; the local owner's key read from the Keychain in-process, never printed; nothing published): `GET /api/assistant/attention` in 63 ms — `signedIn: true, hasAssistant: true`, the four rows and their definitions all `finished: false, reason: 'no-outside-relays'` (this stack has no tag-federation relay and holds none of the taggings), `sameWithQuery: true` for `?pubkey=…&relays=…`. Anonymous: `{"success":true,"signedIn":false}` HTTP 200, byte-identical with query parameters.
- [x] `bash scripts/harness-lint.sh`: clean (0 violations, 4 known waivers).
- [x] `src/api/openapi.yaml` parses (`js-yaml`); the `/api/assistant/attention` entry has `get` only and no `parameters`.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._ (The bundle under test, `index-Cxk6N3PV.js`, was built by the main session's `scripts/dev-refresh.sh` after `27d5c15d`; not rebuilt here, per the session brief.)

## Spec adherence
- [x] Every acceptance criterion has a passing test; the plan's coverage map holds against the suite as it is:
  AC-1 → L2, L3, L4 · AC-2 → U1, U2, U14, U15, U16 (+ S2's "no `req.query`", + the signed-in probe) · AC-3 → U3–U8, U11, L5 · AC-4 → U9, U10 · AC-5 → C2, C3, C4, D3, B1–B5 · AC-6 → U12, U9 · AC-7 → S2, D1, B6.
- [x] No criterion silently dropped. AC-4's "says why" is carried per tagging (`reason` on each row) and not repeated on the action (story § Deviations 2); nothing reads an action-level reason. AC-5's two readings (the page marks while unfinished or failed; the pill counts only a finished, missing answer) are the approved ADR sub-decision 6, and C3 + B3/B4 pin both.
- [x] No behavior added that isn't in the story. The Vite alias `@tapestry/identification-tags` has no UI importer yet; ADR 0001 § Implementation notes 1 puts it in this story on purpose so story 2 touches no build config. The BIBLE §11 row and the OpenAPI entry are ADR sub-decision 9.

## ADR adherence
- [x] Files changed match § Implementation notes 1–7: `src/lib/identification-tags/index.js`; `src/api/assistant/attention.js`; the route in `src/api/index.js:556-559` + `openapi.yaml` + BIBLE §11; `ui/src/utils/assistantAttention.js`; `ui/src/context/AssistantAttentionContext.jsx`; the merge in `actions.js` (`CHECKED_ACTIONS`, `assistantAttention(user, attention)` with `alertCount`); the readers `Index.jsx`, `TopBarAlert.jsx`, `topBarAlert.js` (`assistantPhase`, default `'answered'`); `App.jsx` mounts the provider inside `SetupStatusProvider`; `vite.config.js` alias + CommonJS include.
- [x] `src/api/setup/status.js` is untouched: `git diff 4ff93dd4...HEAD --stat -- src/api/setup/` is empty, and S3 pins it. The module reuses `scanLocalStrict`, `outsideOnly`, `RELAY_BUDGET_MS` from it (sub-decision 3).
- [x] The Phase-4 commit `27d5c15d` changes no test: `git diff 433b4e83..27d5c15d --stat -- test/ tests/` is empty. The two corrections are their own `test:` commit `433b4e83` (one file, +9 −3), and each is right on its merits: U11 — the three lookups (the viewer's, the assistant's, the canonical author's) run in parallel and each reads a relay once, so "distinct relays read, at most three reads" is what § Implementation notes 2 describes; S1 — `codeOnly()` takes the glob string `'/api/settings/*'` in `src/api/index.js` for a block-comment opener and swallows the registration, so reading the raw source is the correct fix.
- [x] Layering: the library is pure CommonJS with no `require`/`import` (L1); heavy requires stay lazy in `defaultDeps()`; the UI util is pure ESM; `actions.js` keeps its one import (D4).
- [x] No new dependencies.

## Concept-graph integrity
- [x] Handles: the code composes tag addresses in `kind:pubkey:slug` form (`39999:<pubkey>:<slug>`) and the publisher's `d` (`profile-tag-<slug>-<target[0:8]>-<signer[0:8]>`, kept in step by R1); it composes no concept handle and writes no `z`. Tag definitions are looked up at `d = <slug>`, which `protocols/drafts/tags.md` § Tag definitions specifies.
- [x] No concept definitions changed; no firmware reinstall needed.
- [x] Orientation was done at Architecture through `/summaries` and `/neighbors` (ADR § Concept-graph orientation); the code reads no graph.

## Things tests can't catch
- [x] No secrets. The single 64-hex literal, `CANONICAL_TAG_AUTHOR` (`src/lib/identification-tags/index.js:21`), is the owner's own key, verified my own way: `nip19.decode` of the fixture's npub yields exactly that hex; `BIBLE.md:1503` lists that npub for Dave Strayhorn (wds4/straycat); the story's settled open question 1 carries the same hex. It is used only to compose the four canonical addresses and as the `authors:` filter for looking up those four public definitions — never as a TA filter, a signer or a concept handle (ADR sub-decision 2; the epic's guardrail). No `82b75e47…` literal appears in any new file; the TA is resolved at runtime through `getAssistantPubkeyFor`. Precedent of the same class: `CANONICAL_AUTHORITY` in `src/api/event-tags` (guarded by `test/note-tagging-raw-events-inspector-ui.test.js` R2).
- [x] No leftover debug logging: the one `console.error` (`src/api/assistant/attention.js:209`) is the 500 path, the `handleSetupStatus` idiom.
- [x] No commented-out code; no TODO/FIXME in the diff.
- [x] Error paths: a failed local scan → every address `local-unreadable`; no outside relay → `no-outside-relays`; every relay unreachable, throwing or silent → `outside-unreachable` after the 8 s budget with every timer cleared (U9, U10); a throw anywhere → 500 with a fixed message (U17). `getAssistantPubkeyFor` itself never throws (it returns `null`), so the 500 path is for the unexpected.
- [x] Concurrency: three lookups in parallel, each its own local scan; the provider keys each answer by `${pubkey}#${assistantPubkey}#${attempt}`, drops stale answers and cancels on unmount, and its `setResult` during render mirrors `SetupStatusProvider` line for line.
- [x] Security: the viewer comes only from `req.session` (`authenticated === true`, 64-hex, lowercased); no query parameter is read (S2, U15, the live probe); the strfry filter carries only validated hex pubkeys and fixed slugs into `spawn('strfry', ['scan', JSON])` (argument array, no shell); the answer carries neither the viewer's nor the assistant's pubkey (U16); the anonymous route reveals nothing. GET is public and unmiddlewared, as `/api/setup/status` is, and the live anonymous call proves no `protectedGetEndpoints` substring catches it.

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling (a Vite alias is configuration, matching the two existing cross-boundary aliases).
- [x] The TA pubkey is never hardcoded; the parallel book's `src/api/setup/status.js` is not edited.

## Product-guide adherence
Not applicable: no PRD (acceptance-frame book), and no new copy (story § Copy).

## Findings

### Blocking
None.

### Non-blocking
1. **`src/api/assistant/attention.js:122-123`, `:185`** — on a local miss each of the three parallel lookups reads every tag-federation relay once, so one page load for a viewer with a missing tagging opens up to three sockets per relay. ADR 0001 § Consequences' "one read per tag-federation relay" is true per lookup, not per request (U11's corrected form pins "at most three"). Optional improvement, when the strict lookups are unified: batch the outside reads into one filter per relay (`authors: [viewer, assistant, canonical]`, all missing `#d`s).
2. **`src/api/assistant/attention.js:53-86`** — `dTagOf`, `newest` and `readWithinBudget` are verbatim copies of `src/api/setup/status.js`'s (the ADR chose not to edit that module mid-book). With the two polarity readers and the two `d`-tag composers the ADR already names, this is one ledger row's worth of debt; the ADR left the decision to the Reviewer: **one** `OPEN` row ("unify the three strict local-then-outside lookups, and the helpers, polarity readers and `d`-tag composers they duplicate") rather than three.
3. **`ui/src/utils/topBarAlert.js:38`** — only `'checking'` hides the pill; `'idle'` falls through to the count. For a viewer with an assistant `'idle'` cannot be observed with a count today: `useAssistantAttention()` sets `wanted` in its mount effect while `useAuth().loading` is still `true`, so by the time `signedIn` is true the phase is already `'checking'` (B5 saw only `[9]`). Worth knowing if auth ever resolves synchronously; no change asked.
4. **`BIBLE.md:496`** — the new §11 row sits inside the strfry block (between `/api/strfry/publish` and `/api/strfry/router-status`). The ADR's "beside `/api/setup/status`'s" has no BIBLE counterpart: §11 has no `/api/setup/status` row at all (the setup book's gap, not this story's). Cosmetic; a docs-lane tidy the next time §11 is touched.
5. **Story file `:141-145`, § Linked artifacts** — still the template placeholders for the ADR and the test plan (compare `stories/setup-status-and-alert/1-*.md:183-186`). Not filled here: this review's sanctioned story edit is the Status flip only (harness friction 2).

### Harness friction
1. **The ADR's status never flips.** `decisions/assistant-identification-tags/0001-one-assistant-attention-answer.md:3` still reads `**Status:** Proposed` after approval at the Architecture gate; every prior book's ADRs read `Accepted`. Neither `workflows/2-architecture.md` nor `.claude/commands/design-architecture.md` says who sets `Accepted` and when (the template offers `Proposed | Accepted | Superseded by ADR-<n>`). Candidate `meta` row: make the flip part of the Architecture gate's save step.
2. **The story's "Linked artifacts" were not written at the gates that own them.** `.claude/commands/design-architecture.md:22` and `.claude/commands/design-tests.md:24` instruct linking the ADR / test plan back into the story; both placeholders survived to Review. The template's third line, `Review: (filled in after Review phase)`, also conflicts with the Reviewer's write scope as briefed for this session (review file + Status flip, nothing else). Candidate `meta` row: either the Review-phase write scope includes the story's Linked artifacts lines, or the template stops promising it.
3. **The plan's gate recipe assumes stdin from the repo root.** § How to run's heredoc uses `require('./test/helpers/gateRunner')`; saved to a file outside the repo (a scratchpad, where the session brief sends long-running outputs) it fails with `Cannot find module` — one aborted launch here (the first `review-gate.log`). Candidate fix in the recipe: `require(path.join(process.cwd(), 'test/helpers/gateRunner'))`, or a one-line note that it must be piped from the repo root.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place (`stories/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.md:3`).
- [x] Completion detection performed; the result is recorded in the chat, not here. (The book has three stories; this is the first, so no `/close-book` offer.)
