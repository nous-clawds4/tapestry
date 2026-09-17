# Review: Story 2 — Pin-stack integration (contextual pins × TL membership methods)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-17
**Worktree:** `/home/vcavallo/src/tapestry-tags`, branch `integrate/staging-into-tags-2026-09`
**Diff:** `git diff 4b2e3d9a~1 HEAD` — `4b2e3d9a` (Phase-3 tests + plan), `ccbb8189` (Phase-4 implementation)
**Story:** `engineering-team/stories/feat-tags-modernization/2-pin-stack-integration.md`
**ADR:** `engineering-team/decisions/feat-tags-modernization/0001-pin-stack-composition.md` (Accepted)
**Test plan:** `engineering-team/stories/feat-tags-modernization/2-pin-stack-integration.test-plan.md`
**Book:** `engineering-team/audits/feat-tags-modernization/book.md` (D1, D2, D3 + rulings A, B)

## Quality gates (run by reviewer, not trusted)

Run individually from the worktree root, `timeout 120`, `BRAINSTORM_BASE_URL=http://localhost:8778`,
via `direnv exec .` (no system node). Operator-scoped set — no full `npm test`.

| Suite | Result |
|---|---|
| `pin-stack-composition` | **20 pass / 0 fail / 0 skipped** (EXIT=0) |
| `context-scoped-pins` | **32 pass / 0 fail** (EXIT=0) — AC-1 |
| `restore-historical-data-and-fix-tl-author-filter` | **22 pass / 0 fail** (EXIT=0) — AC-2 |
| `pinned-notes-display` | **2 pass / 0 fail** (EXIT=0) |
| `note-trusted-list` | **15 pass / 0 fail** (EXIT=0) |
| `trusted-list-pin-publish-blockers` | **11 pass / 0 fail** (EXIT=0) |
| `generalized-tag-pinning` | **12 pass / 0 fail** (EXIT=0) |

Every count matches the expected 20/32/22/2/15/11/12 with zero failures. No `SKIP` in
`pin-stack-composition` — the runtime TA resolved from env, so all runner-executing assertions ran.

- `npm run test:playwright` — not run (no browser surface asserted by the plan; the panel change is
  source-level and covered by AC-7's sentinels).
- **Deferred, by operator instruction:** the four live-stack AC-4 ladder suites
  (`tl-membership-method-selector`, `tl-certainty-method`, `tl-publication-from-pins`,
  `customize-pin-curation-publish`). They hang without a live stack, and the stack on `:8778` serves
  the MAIN checkout's server code, not this worktree's — a "live" run would exercise the wrong
  runner. Recorded as deferred to the full-suite run on the deployed branch (see Findings NB-8).
- **Not run:** `ui` production build / browser smoke (outside the authorized command set). See NB-8.
- _Lint not configured — skipped._ _Typecheck not configured — skipped._ _No build step in the gate._

## Spec adherence

| AC | Verdict | Evidence |
|---|---|---|
| **AC-1** — `context-scoped-pins` 32/32 | **Met** | Measured 32/0. All four previously-red groups green: `computeNoteTLDTag` delegation, note-cutoff threading, panel read-under-observer+context, single-pin refresh recomputing both TLs. |
| **AC-2** — `restore-historical…` green, `taPubkey` accepted only with `context` | **Met** | Measured 22/0. Caller guard (`:310–317`) = the Tester's pre-authored R1 patch verbatim; signature guard (`:247`) re-aimed to the same rule. A bare `taPubkey` on a neutral `pinTag` call still fails both. ADR-0015's real invariant is asserted *directly* and strictly (positive `39998:${LEGACY_TA_PUBKEY}:tag-pinning` + anti-pattern `!39998:${taPubkey}:tag-pinning`), so the re-aims do not soften it. Ratified — see "Test re-aims" below. |
| **AC-3** — context as an additional `z` on 30392 **and** 30393 | **Met** | `refreshPinnedTags.js:264` (30392) and `:439` (30393): `...(contextSlug ? [['z', contextHandle(TA_PUBKEY, contextSlug)]] : [])`. Exactly one, last in `extraTags`, only when contextual; neutral emits none (`pin-stack-composition` Z-group asserts published z arrays are empty for neutral). `-in-<context>` `d` suffix retained as the replaceability key. |
| **AC-4** — membership-method behavior unchanged | **Met (stack-free half) / live ladder deferred** | Literal-fixture proof for neutral `count`, neutral `certainty` (items, scores, `rigor 0.5`, `cutoff`, `min-rank`, exact `content` JSON) and the neutral 30393. Independently verified by reading: `git show origin/staging:src/api/trustedList/refreshPinnedTags.js` diffed whole-file against HEAD shows **only** the reviewed hunks — `resolveMembershipMethod`, `round6`, the `membershipFolds` map, the fold order, the `rigor`/`cutoff`/`min-rank` tags and their positions are untouched; the context `z` is *appended* after `rigor`/`truncated`, so no tag reorders. `contextSlug` reaches only `computeTLDTag`/`noteTlDTag` and the `z` — never `resolvePov`, `aggregateProfilesTagged`, `resolveMembershipMethod`, `applyDisputesFunction` or any fold. One narrow authorized delta: NB-7. |
| **AC-5** — `contextual-pins/0001` flipped to Accepted | **Met** | `decisions/contextual-pins/0001-context-scoped-pins.md:3–4` — `**Status:** Accepted` plus a pointer to this ADR. |
| **AC-6** — client/server note-TL `d`-tag parity | **Met** | `tlDTag`/`noteTlDTag` added and exported from `src/lib/event-tagging/pins.js:48–64,122–123`; re-exported via `index.js`'s `...pins` spread. Server `computeTLDTag` (`:90`) and `runOneNotePin` (`:416–418`) delegate; client `computeTLDTag` (`:78`) and `computeNoteTLDTag` (`:89`) delegate. Parity asserted over a 5-row fixture table **and** end-to-end (client helper string == the `d`-tag the runner hands the publisher). Negative sentinel bans template interpolation of `tl-pin…` in both files. |
| **AC-7** — Pinned tab "update" is a server recompute; bookmark export survives | **Met** | `PinnedListPanel.jsx:189–207` — `handleRepinNotes` POSTs `/api/trusted-list/refresh-pinned-tag` with `{ pinEventId }` (matching the handler's contract at `src/api/trustedList/index.js:232–236`, session-authed by `requireAuth`), then `refetchPinnedNotes()`; `publishNoteBookmarkSetForPin` is no longer imported by the panel. `refreshOnePinnedTagById` (`refreshPinnedTags.js:305–314`) now runs **both** runners. Export survives: `PinnedListPanel.jsx:391` keeps `noteExport={…}` on `<ExportModal>`, which publishes via `ExportModal.jsx:153–157`. |

No criterion silently dropped. No behavior beyond the story: the panel's user-facing context banner
and per-context labels were correctly left to story 3 (logged in Deviations).

### Test re-aims — ratified individually

Four assertions were re-aimed in the Phase-4 commit. Each is a re-aim to ruled intent, not a
loosening:

1. `restore-historical…:310–317` (caller guard) — `!keys.includes('taPubkey') || keys.includes('context')`.
   Verbatim the patch the Tester pre-authored in the test plan's **R1** carve-out; per-call-site;
   ADR §4 exactly. A neutral call with a bare `taPubkey` still fails. **Ratified.**
2. `restore-historical…:247` (signature guard) — `!/\btaPubkey\b/.test(paramList) || /\bcontext\b/.test(paramList)`.
   The ratified ADR §2/§4 signature makes the original ban unsatisfiable. The property it used to
   *proxy* (the `tag-pinning` handle must never be composed from a runtime pubkey) is asserted
   directly and remains green. **Ratified.**
3. `pinned-notes-display:19` — `computeNoteBookmarkDTag` → `computeNoteTLDTag`. The displayed list is
   the TA-signed 30393; addressing it by its context-aware `d`-tag is the story-2 end state.
   **Ratified** (with NB-2 on the stale sibling clause).
4. `pinned-notes-display:33–35` — the Update affordance must POST `refresh-pinned-tag` and must not
   publish the bookmark set. This is D2/AC-7 verbatim. The negative strips `//` comments before
   testing, so it cannot be defeated by prose. **Ratified.**

## ADR adherence

- **§1 call order** — `contextSlugOfPin(pinEvent, TA_PUBKEY)` sits immediately after the `lookupTag`
  success guard in **both** runners (`refreshPinnedTags.js:178` and `:392`), before `resolvePov` /
  aggregation / `resolveMembershipMethod` (`:201–204`). The ordering sentinel greps the literal
  positions inside `runOnePin`'s body and passes. Context never enters the scoring fold.
- **§2/§5 shared composer** — single source in `pins.js`; six delegating call sites; no
  `` `tl-pin…${ `` interpolation remains in either pin-stack file. The two grep sentinels over the
  relocated literals are satisfied by **doc comments** (`refreshPinnedTags.js:78–87`,
  `publishTagPin.js:74–77,85–88`) — confirmed to be comments, not code, exactly as the test plan's
  carve-out predicted, with executable coverage moved to the composer + parity tests.
- **§3 context `z`** — exactly one, contextual-only, on both kinds, handle composed by
  `contextHandle(TA_PUBKEY, contextSlug)` = `39998:<runtime TA>:<slug>`. `TA_PUBKEY` is
  `profileTags.TA_PUBKEY` = `getOwnerAssistantPubkey()` (`src/api/profile-tags/index.js:56`) —
  the **runtime** resolution, never the ADR-0015 legacy literal (asserted negatively in the suite).
  Client side: `contextHandle(taPubkey, context.slug)` with `taPubkey` from `useConfig()`.
- **§4 two TA params** — `pinTag({ tag, curationMethod, localTaPubkey, context, taPubkey })`
  (`publishTagPin.js:135`). `localTaPubkey` keeps its hex-gated ADR-0004 dual-`z` line (`:160`), hex-gated;
  `taPubkey` is used *only* for `contextHandle` (`:162`). Guard is `if (context && !taPubkey)`
  (`:139`) — the composed condition ADR §4 prescribed, so the ADR-0015 negative regex stays
  satisfiable. `TAG_PINNING_HANDLE` still `39998:${LEGACY_TA_PUBKEY}:tag-pinning` (`:48`).
- **Deps seam** — `runOnePin(pinEvent, options = {})` with `const deps = options.deps || options`
  and real-module defaults; no production caller passes a second argument (grep: `refreshPinnedTags.js:311, 462, 483`
  all call `runOnePin(pin)`), so every production path is byte-identical. The Deviation about reading
  `resolveMembershipMethod`/`resolvePov` at their call sites rather than hoisting is behaviorally inert
  and correctly explained.
- **Collateral, verified untouched** — `membershipMethods.js`, `retractStaleTLs`,
  `enumeratePinnedTags`, `src/api/trustedList/index.js` (dlist-curation's `publishToStrfry` reuse),
  `src/api/profile-tags/index.js`, `usePinnedNotes.js`, `useEventTagging.js`, `Tag.jsx`,
  `PinToContextModal.jsx`, `Pins.jsx`, `firmware/**`. Whole-file diff vs `origin/staging` for the
  runner shows no other hunk. Story-12 `includeScoreInTL` Meilisearch enrichment was **not**
  reintroduced (correct — it is a regression per ADR trusted-lists/0002–0003).
- **Both named hazards closed** — Hazard 1 (mutual overwrite): contextual and neutral TLs now
  publish at distinct `d` coordinates for both kinds. Hazard 2 (stale sweep): contextual `d`-tags are
  returned by both runners and collected into `currentDTags`/`currentNoteDTags`
  (`refreshPinnedTags.js:466–467` (`runOneNotePin` returns its `dTag` at `:446,448`)), and retraction still diffs on `new Set(currentDTags)` — the
  contextual-pins/0001 set-based invariant is intact, no `(obs, author, slug)` collapse.
- No new dependencies. No new lint/typecheck/build tooling.

## Concept-graph integrity

- Handles are `kind:pubkey:slug`: `39998:<runtimeTA>:<contextSlug>` via the existing `contextHandle`;
  never hand-formatted.
- **Firmware reinstall: not required.** No concept definition changed (`firmware/**` absent from the
  diff), as the ADR states. `lfo` and `tapestry-web-of-trust` already exist in the graph and in
  `firmware/active/`.
- Concept authority respected: context slugs are gated by `KNOWN_CONTEXT_SLUGS`, and
  `contextSlugOfPin`'s legacy-`z` disambiguation (the load-bearing guard now that the dual-`z` writer
  puts a runtime-TA-prefixed `z` on every pin) is unchanged and asserted.

## Things tests can't catch

- No secrets. The only 64-hex literals added are the ADR-0015-sanctioned `LEGACY_TA_PUBKEY` usage
  (unchanged) and test fixtures.
- No `console.log`, `TODO`, `FIXME`, `debugger`, or commented-out code added (grep over the `src`/`ui`
  hunks is empty). Two stale comments were *retired* as the ADR asked (#336, "story 2 appends…").
- Race conditions: `refreshOnePinnedTagById` now runs the two runners sequentially, so the two
  replaceable coordinates are distinct and no write races itself. `handleRepinNotes` guards on
  `repinningNotes` and on `pinEventId`; `usePinnedNotes` cancels in-flight work via `cancelled`.
- Security: the endpoint the panel now calls is `requireAuth`-gated (signature-verified session) and
  validates `pinEventId` as 64-hex, and `refreshOnePinnedTagById` still enforces
  `pin.pubkey !== sessionPubkey → forbidden` before either runner. Same-origin relative `fetch`
  carries the session cookie by default. No new input reaches a shell (`publishToStrfry`'s stdin
  path untouched).
- Scope creep: none. Every touched file is in the ADR's blast radius; the four extra Deviations are
  each justified and minimal.

## House rules check

- Concept Graph API authority respected (ADR records the live `/summaries` verification; no
  concept re-derivation from BIBLE).
- Per-deployment TA pubkey: runtime resolution everywhere new (`getOwnerAssistantPubkey` server-side,
  `useConfig().taPubkey` client-side). No `LEGACY_*` constant removed — the ADR-0015 named exception
  is intact.
- No new tooling.

## Findings

### Blocking
None.

### Non-blocking

1. **`stories/feat-tags-modernization/2-pin-stack-integration.md` (Deviations / Blocked sections) —
   the story record contradicts the diff shipped in the same commit.** It states the
   `restore-historical…` signature re-aim was "**not applied**", that the suite "**stands at 21 pass /
   1 fail**", and that `pinned-notes-display` was "**Not edited**". All three re-aims *are* in
   `ccbb8189`, and I measured `restore-historical…` at **22/0** and `pinned-notes-display` at **2/0**.
   The re-aims themselves are correct and ratified above; the record is what is wrong. **Ask (doc-only,
   before story close-out):** delete/replace the "Blocked (needs the Tester / PO)" section, correct the
   `pinned-notes-display` Deviation to describe the re-aim actually made, and cite the authorization
   for the two unplanned re-aims (see Harness friction 1).
2. **`test/pinned-notes-display.test.js:23` — the surviving `/30003/` clause is now a vacuous guard.**
   `ui/src/hooks/usePinnedNotes.js` no longer scans kind-30003 at all (its drift baseline is
   `/api/event-tags/for-tag`); `30003` appears only in the file's doc comment (`:13,15`), so
   `assert(/30003/.test(s), 'must scan the kind-30003 bookmark set')` passes on prose, and the
   assertion's own name ("reads the viewer's kind-30003 snapshot") now misdescribes the code.
   Tester-lane cleanup: drop the clause or re-aim it to the live-set fetch. Not blocking — the real
   behavior is covered executably by `context-scoped-pins` ("usePinnedNotes reads the TA-signed
   kind-30393").
3. **ADR §5's "one composer" is not fully realized (pre-existing, out of blast radius).** Three
   sites still hand-compose the TL `d`-tag: `src/api/profile-tags/index.js:1668` and
   `src/api/trustedList/index.js:411` (both correct — they thread `pinVariantKey`), and
   `ui/src/hooks/useTagMemberSets.js:56,93` which **omits** the discriminator entirely, so that hook
   cannot resolve a contextual pin's TL. The ADR explicitly listed these as "not touched, verified
   already correct", so this is debt, not drift — but the drift-impossibility rationale only holds
   once they delegate too. Worth an `OPEN.md` row or a story-3 line.
4. **`PinnedListPanel.jsx:197–201` ignores the response.** `await fetch(...)` with no `res.ok` /
   `success` check: a 401 or 500 is swallowed and the UI then refetches unchanged data. Contrast
   `ui/src/hooks/useRefreshPin.js:17–26`, which throws on `!r.ok || !data?.success`. The comment
   ("best-effort; drift line stays until it succeeds") makes it defensible, but the user gets no
   signal. Same pattern at `:310–315` (fire-and-forget, `.catch(() => {})`).
5. **Contextual note-bookmark export: display is context-aware, the write is not.**
   `PinnedListPanel.jsx:260` now threads `contextSlug` into `computeNoteBookmarkDTag` for the
   displayed kind-30003 naddr (rendered at `:470` whenever the **30393** exists), but
   `publishNoteBookmarkSetForPin` (`publishTagPin.js:370`) has no context parameter and
   `noteExport` (`:391`) passes none — so on a contextual pin the panel can show an naddr for
   `notes-pin-…-in-<ctx>` that nothing ever publishes, while the Export button writes the neutral
   coordinate. Mostly inherited (the naddr row was already gated on the 30393, not on the export),
   and the ADR puts contextual exports out of scope — but this diff makes the mismatch
   context-specific. Log it with the ADR's existing "contextual exports" follow-up.
6. **`pinTag` does not validate `taPubkey`'s shape** (`publishTagPin.js:139`). `localTaPubkey` is
   hex-gated (`/^[0-9a-f]{64}$/`, `:160`) but `taPubkey` only has a truthiness guard, so a malformed
   truthy value would stamp a malformed context handle. Cheap hardening: reuse the same regex.
7. **Note-TL cutoff default moved 0 → 1** (`refreshPinnedTags.js:405–409`). ADR-authorized
   ("threads the pin cutoff into `curateNotes`") and required by AC-1's cutoff assertions. For
   `notes:net-endorsed` it is provably inert (`app > dis` already implies `app ≥ 1`); for
   `notes:most-applied` a note with **0** trusted applications is now dropped where it previously
   published. So "byte-identical for every neutral pin" holds for profile TLs and net-endorsed note
   TLs, with this one deliberate, narrow exception. Recording it so the book's as-built record is
   accurate.
8. **Verification gaps to close on the deploy pass** (both by instruction, not by omission): the four
   live-stack AC-4 ladder suites, and the `ui` production build + browser smoke of the Pinned tab
   (contextual pin: Update-notes button, curation edit, Export modal). The Vite CJS-alias risk from
   the four new named imports out of `@tapestry/event-tagging` is low — the alias plus
   `build.commonjsOptions.include` already carry `KNOWN_CONTEXTS`/`projectionFor`/`curateNotes` from
   the same module — but it is unproven in this review.

### Harness friction

1. **"Ruling C" has no durable home.** It is cited in `test/restore-historical…:247` and in the story
   (`:114`), but the book's Decision log records only rulings 1–5 (= D1, D2, D3, ruling A, ruling B).
   A future session cannot verify what Ruling C authorized — and the two re-aims beyond the Tester's
   pre-authored R1 patch rest on it. Add Ruling C to
   `engineering-team/audits/feat-tags-modernization/book.md` § Decision log (and an `OPEN.md` `meta`
   row if it stays unrecorded).
2. **Phase-4 edited `test/` twice** (`pinned-notes-display`, `restore-historical…`). Correct in
   substance here (superseded generational guards, operator-ruled), but the story's own Deviations
   asserted the opposite, which is exactly how a lane exception becomes invisible. The
   templates' "test-deliverable" carve-out does not cover this shape; the workflow would benefit from
   a named "re-aim of a superseded guard" path that requires recording the authorizing ruling inline.

## Verdict

**PASS**

The composition is exactly the one ADR 0001 ratified: context resolves first and feeds identity only,
the membership ladder is provably untouched, the context `z` is a single runtime-TA-composed handle on
both 30392 and 30393, the two `d`-tag strings now have one source, and both interim hazards are
closed. All seven authorized suites are green at the expected counts, with the live ladder and the UI
build explicitly deferred to the deployed-branch pass.

## On PASS (same commit)

- [ ] Story `**Status:**` flip to `Done` — **left to the parent** (this review was run with
      "do not commit"; no Edit performed). Do **not** move files: retirement is per-epic.
- [ ] Non-blocking item 1 (correct the story's Deviations/Blocked sections) and Harness friction 1
      (record Ruling C in the book) should land with that close-out.
- [ ] Completion detection: the book's acceptance frame is **not** satisfied — `dlist-item-tagging`
      has not landed by ordinary merge, the branch is not yet deployed/verified, and the
      `feat/tags..staging` count is not 0. The book stays **Open**; `/close-book` is **not** offered.
