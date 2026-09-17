# Story 2: Pin-stack integration — contextual pins composed onto membership methods

**Status:** Approved *(the consequential decisions were made by the operator in session — book
Decision log D1; this story transcribes them into ACs)*
**Created:** 2026-09-17
**Type:** Feature — **Standard**, full ADR required (touches published event shape: a new `z`
on contextual Trusted Lists; and the pin/TL `d`-tag composers)

## Background
The step-1 bulk merge (`1f4fa6f7`) took **staging's** pin runner and pin publisher as an
interim: `src/api/trustedList/refreshPinnedTags.js` and `ui/src/utils/publishTagPin.js` carry
membership methods / weighted certainty (ADR `trusted-lists/0001`, `0002`) and **no context
support**. `feat/tags`' contextual pins (ADR `contextual-pins/0001`, stories 1–3) are present in
the tree — `src/lib/event-tagging/pins.js`, `test/context-scoped-pins.test.js`, `Tag.jsx`'s
caller — but no longer wired. The interim reality on the merged tree:
`test/context-scoped-pins.test.js` **23 pass / 9 fail**;
`test/restore-historical-data-and-fix-tl-author-filter.test.js` **21 / 1** (Tag.jsx passes
`taPubkey` + `context` to `pinTag`, staging's key-based guard rejects it). Those ten failures are
this story's acceptance list.

**The two features are orthogonal** (operator ruling): contextual pins decide *which pin produces
which list* (identity/partitioning); membership methods decide *how a list's members are scored*
(computation). The runner resolves context first, then applies the method. `certainty` is the
method in practical use, so membership methods is the load-bearing side and context composes onto
it — never the reverse.

## User-facing description
As a user with a neutral pin and an LFO-context pin of the same tag, I want each to keep its own
Trusted List (scored by the operator's chosen method) and I want a third party to be able to find
"Trusted Lists about X in LFO" by a plain relay filter, so that contextual curation is both
preserved and discoverable.

## Acceptance criteria
- [ ] AC-1: `test/context-scoped-pins.test.js` is green (32/32): pin identity, TL and note-TL
      `d`-tags, and note-bookmark `d`-tags thread `pinVariantKey`; `pinTag` stamps the context via
      `contextHandle` (runtime TA); the runner recovers context from the pin; a single-pin refresh
      recomputes both the profile and note TLs; the Pinned panel reads under observer + context.
- [ ] AC-2: `test/restore-historical-data-and-fix-tl-author-filter.test.js` is green: its caller
      guard accepts `pinTag({ …, context, taPubkey })` **only when `context` is present** (the
      contextual path legitimately threads the runtime TA), and still rejects a bare `taPubkey`
      on a neutral pin (ADR 0015 intent preserved).
- [ ] AC-3: A contextual Trusted List (30392 and 30393) carries the context concept as an
      **additional `z`** — three `z` tags in all under `dlist-item-tagging` ADR 0002's convention
      (kind-of-thing, per-tag TL header, context) — so `{kinds:[3039x], "#z":[<perTagHeader>,
      <contextConcept>]}` finds "TLs about X in <context>". A neutral list carries two. The `d`
      suffix `-in-<context>` remains a replaceability key that no reader parses.
- [ ] AC-4: Membership-method behavior is unchanged for every pin: `tl-membership-method-selector`,
      `tl-weighted-sum-method`, `tl-certainty-method`, `tl-publication-from-pins` keep their
      current pass counts (they hang without a live stack — the reviewer runs them against the
      stack, or records the hang as pre-existing with evidence).
- [ ] AC-5: The `contextual-pins/0001` ADR is flipped from *Proposed* to *Accepted* (it shipped and
      passed review); this story's ADR records the composition rule and the context-`z` rule.
- [ ] AC-7 *(Ruling A, 2026-09-17 — folded in from the planned story 3 / D2)*: the Pinned tab's
      "update the note list" action calls `POST /api/trusted-list/refresh-pinned-tag` (server
      recompute of the assistant-signed 30393, context-aware via the pin event id) instead of the
      client-signed bookmark publish; the client bookmark export remains a separate action in the
      Export modal. (`context-scoped-pins` "Story 2: the Pinned panel … updates via server
      refresh" is the pinning assertion.)
- [ ] AC-6: The `computeNoteTLDTag` client helper and the server `runOneNotePin` compose the same
      string for the same inputs, context included (a shared-fixture test pins parity).

## Out of scope
- **Option D** (a context-scoped per-tag TL header making "TLs about X in <context>" a single
  relay filter) — deferred by ruling B, 2026-09-17; the union-plus-local-narrowing query stands.
- Republishing existing contextual lists with the new `z` — they re-derive on the next refresh.

## Linked artifacts
- ADR: `engineering-team/decisions/feat-tags-modernization/0001-pin-stack-composition.md` (Accepted)
- Prior: `engineering-team/decisions/contextual-pins/0001-context-scoped-pins.md`;
  `engineering-team/decisions/trusted-lists/0001-…`, `0002-…`;
  `engineering-team/decisions/dlist-item-tagging/0002-trusted-list-discovery-tags.md`.
- Review: `engineering-team/reviews/feat-tags-modernization/2-pin-stack-integration.md`

## Deviations

- **`runOnePin` deps seam shape.** The injected `resolveMembershipMethod` / `resolvePov` are read
  at their call sites (`deps.resolveMembershipMethod ? deps.resolveMembershipMethod() : resolveMembershipMethod()`)
  rather than hoisted into the deps preamble like `lookupTag`/`publishTL`. Reason: hoisting would
  need a differently-named local (a `const` cannot shadow the module import it falls back to), and
  the ADR §1 ordering sentinel greps for the literal `resolveMembershipMethod(` *after*
  `contextSlugOfPin(` inside `runOnePin`'s body. Behavior is identical; defaults unchanged.
- **Grep-satisfaction-by-comment (as the test plan's carve-out predicted).** The wire-binding
  `tl-pin-…` / `tl-pin-notes-…` shapes now live only in `src/lib/event-tagging/pins.js`, so the
  composed form is kept as a **doc comment** beside each thin delegating wrapper in
  `refreshPinnedTags.js` (`computeTLDTag`, for the frozen `R-2` sentinel) and `publishTagPin.js`
  (`computeTLDTag` / `computeNoteTLDTag`, for the two `context-scoped-pins` sentinels). The
  executable coverage of those strings is the new suite's composer + parity tests.
- **`pinned-notes-display.test.js` regresses 1/1 → 0/2 (superseded guard, not in the blast radius).**
  Its panel assertion requires `publishNoteBookmarkSetForPin` in `PinnedListPanel.jsx` — "the
  Update affordance must re-publish the bookmark set" — which is exactly the behavior AC-7 / D2
  replaces with the server recompute. Its sibling assertion (the hook must read kind-30003) was
  already red on this branch for the same generational reason. Both assertions are red on
  `origin/feat/tags` too, so this brings the branch to the source branch's state rather than
  introducing a new defect. Not edited (test edits are the Tester's lane; only the Ruling-C
  re-aim was authorized).
- **Panel context banner NOT restored.** `feat/tags`' `<p className="bs-pindetail-context">Pinned in
  …</p>` line is user-facing per-context labelling, which the ADR assigns to story 3. Only the
  threading the ADR's blast radius names was restored; `contextName` is used by `handleEditSubmit`.
- **`initialCuration={viewerPin.curationMethod}` → `activePin?.curationMethod`.** Required by the
  `activePin` selection (a context pin's Edit dialog must seed from the *selected* pin); also
  removes the last `viewerPin`-direct dereference that would crash when only `pin` is passed.

## Blocked (needs the Tester / PO)

- **AC-2 cannot reach 22/0.** After the authorized Ruling-C re-aim, the caller guard passes, but a
  **second** assertion in the same suite goes red — `AC-6: pinTag() signature no longer accepts a
  taPubkey parameter` (`test/restore-historical-data-and-fix-tl-author-filter.test.js:237`). It
  bans `taPubkey` from `pinTag`'s destructured parameter list outright, which the ratified ADR §2/§4
  signature (`pinTag({ tag, curationMethod, localTaPubkey, context, taPubkey })`) requires. It was
  green pre-change only because the parameter did not exist yet; the test plan's R1 carve-out
  caught the caller half of this ban but not the signature half. Its sibling
  (`pinTag() body no longer throws when taPubkey is missing`, :254) IS satisfied — the guard reads
  `if (context && !taPubkey)`, exactly as ADR §4 prescribed. Recommended one-line re-aim, mirroring
  Ruling C (not applied — only the caller re-aim was authorized):
  `!/\btaPubkey\b/.test(paramList) || /\bcontext\b/.test(paramList)`.
  Suite stands at **21 pass / 1 fail**.
