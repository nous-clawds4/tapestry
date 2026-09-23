# Book of Work: Modernizing feat/tags against staging

**Slug:** feat-tags-modernization
**Status:** Open
**Opened:** 2026-09-17
**Closed:** —
**Strictness:** Standard

## Intent anchor

**Acceptance frame (no PRD)** — the operator's ask, restated 2026-09-17: `feat/tags` serves
tags.brainstorm.world and has drifted far enough from `staging` that the drift is now the dominant
cost. Close the gap so that ordinary feature work (starting with the `dlist-item-tagging` epic)
lands on it by plain merge, and so that security fixes stop needing hand-porting.

**Measured divergence at kickoff:** `feat/tags` is **943 commits behind** and **54 ahead** of
`origin/staging`. Merge base `39822c9d`, 2026-07-22. A trial merge produced **10 conflicted files,
21 hunks**.

**The prompting evidence.** Two symptoms, not one: (a) David hand-ported the September production
security fixes onto this branch (`sandbox-security` #2) because it cannot simply take staging —
a recurring cost paid in security-sensitive code; (b) replaying the `dlist-item-tagging` epic onto
it required a divergent second implementation of one nav surface plus four adapted test sentinels
(branch `tags/dlist-item-tagging`, pushed, **deliberately not merged** — merging it is what would
cement the divergence). That replay stays parked as evidence the epic works on this base.

**Standing policy this book must reconcile.** A decision recorded 2026-07-16 made `feat/tags` a
**deploy branch, strictly downstream of staging** — never originating feature work — precisely to
end peer cross-merge divergence after an earlier painful integration. That policy has since drifted:
`contextual-pins` (3 stories, ADR 0001) and parts of `security-auth-exposure` originated here. The
book must either restore the policy or replace it with one the team will actually hold.

### Acceptance frame

- [x] **The gap is closed.** `feat/tags` contains staging's content, and `git rev-list --count
      feat/tags..staging` is 0 at close.
- [x] **No shipped behavior is silently lost, in either direction.** Every feature that exists on
      one side only is either carried across or explicitly declared dropped, with the reason
      recorded. Specifically resolved, not merged-by-luck:
      - `contextual-pins` (feat/tags only: `pinVariantKey`, `contextSlugOfPin`, `contextHandle`,
        context-keyed TL `d`-tags, ADR `contextual-pins/0001`, stories 1–3)
      - Trusted-List **membership methods / weighted certainty** (staging only:
        `resolveMembershipMethod`, `round6`, ADR `trusted-lists/0002`)
      - The **pinned-panel note-list refresh**: client-side publish (staging) vs server-side
        recompute (feat/tags) — a behavioral choice, not a textual merge
      - `relay-scan-bounds`, `site-trust-signals`, the Firmware Explorer fork, the JSON-viewer
        toggle
- [x] **The 54 feat/tags-only commits have a declared destination** — each either promoted toward
      staging or marked tags-only. This is the decision that determines whether the pin-stack
      tangle is resolved once or twice.
- [x] **Security parity is verified, not assumed.** The September fixes end up present and
      equivalent; `publishEvent.js` keeps staging's brain-write hook (verified superset at kickoff).
- [~] **The branch is deployable.** UI builds; the full suite ran once (capped) and **every failure is
      attributed** — see the attribution note below. tags.brainstorm.world serving it waits on the push.
- [x] **A branch policy is written down and agreed** (Decision 3: bidirectional, cadence-driven) — so the next
      session does not re-derive it.
- [~] **`dlist-item-tagging` then lands by ordinary merge** — landed (`ffe74a75`, zero code
      conflicts); the parked replay `tags/dlist-item-tagging` is to be deleted from origin at
      the operator's push (deleting a remote branch is a push).

## Epics in this book
- `feat-tags-modernization` — the integration itself, its per-file decisions, and the branch policy.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/feat-tags-modernization/audit.md`
- Product feedback: `engineering-team/audits/feat-tags-modernization/prd-seed.md`

## Decision log *(operator rulings, in session, 2026-09-17)*

1. **Contextual pins → promote to staging** (not tags-only). Census finding: of the 54
   feat/tags-only commits, contextual pins is the only substantively unique feature; security
   hardening, site-trust, relay-scan bounds, the About page and developers link all exist on
   staging in substance. One cosmetic straggler (Firmware Explorer JSON-viewer toggle) is carried
   mechanically if staging's refactor lacks it.
   - **Composition rule for the pin stack:** contextual pins decide *which pin produces which
     list* (identity/partitioning); membership methods decide *how a list's members are scored*
     (computation). Orthogonal; the runner resolves context, then applies the method. The
     integration ADR states this so it is never re-derived. Operator note: `certainty` is the
     method that will be used in practice, so membership methods is the load-bearing side.
   - **Context becomes a third `z` on a contextual Trusted List.** Today the context rides only
     as a `d`-tag suffix (`-in-<context>`), which the TL-discovery convention
     (`dlist-item-tagging` ADR 0002) forbids readers from parsing. Stamping the context concept
     as a `z` — the convention the pin already uses — makes "TLs about X in LFO" a plain filter.
     Low usage makes the republish a refresh, not a migration.
   - The contextual-pins ADR is still marked *Proposed* though it shipped; the integration ADR
     accepts it.
2. **Pinned tab "update the note list" → server recompute** (feat/tags' choice), not the client
   bookmark publish. The button refreshes the assistant-signed list the tab displays; the
   `refresh-pinned-tag` endpoint already exists on both branches (Story 11); the client-signed
   bookmark export stays a separate action in the Export modal on both. Operator rationale: a
   `brainstorm_server` PR adds a "publish/update all TLs for this observer" button using the
   assistant key, so this normalizes the UX across apps.
3. **Branch policy → bidirectional with a written cadence.** Correction to the record: a July
   note called `feat/tags` a deploy-only branch strictly downstream of staging. Actual usage
   since then — including how the `dlist-item-tagging` epic was framed on day one — is the
   reverse: `feat/tags` is where tagging features are built and tested **before** they
   graduate to staging. That note was stale; the drift is the natural consequence of an
   upstream feature line that is never re-synced. The rule is therefore about **cadence, not
   direction**:
   - **Pull staging into `feat/tags` after every staging promotion** — including promotions
     that land from other feature branches `feat/tags` has never seen. This book is the first
     such pull. The trigger must be a checklist line in the promotion skill, not a memory: the
     skipped step is exactly the one that produced the 943-commit gap.
   - **Graduate `feat/tags` → staging by book close**, not commit by commit.
   Recorded 2026-09-17; supersedes the 2026-07-16 note wherever it is quoted.
4. **Pinned-panel server-recompute switch folded into story 2** (ruling A). One AC-1 assertion
   already bundles it and the change is ~10 lines; the planned story 3 is absorbed. Story numbering
   in the epic: 1 census (Done), 2 pin-stack + panel, then bulk merge (done as step 1, commit
   `1f4fa6f7`), policy (D3), land `dlist-item-tagging`.
5. **Option D deferred** (ruling B). Correction on the record: several values under one `#z`
   filter key are a NIP-01 *union*, so "TLs about X in <context>" is `#z:[<contextConcept>]` plus
   local narrowing by per-tag header, not one conjunctive filter. A context-scoped per-tag TL
   header would make it one filter; not worth a layer at current usage.
   - Interim hazard, contained (ADR 0001 § Consequences): on the merged branch before story 2,
     a contextual pin and its neutral twin publish at the same `d` (mutual overwrite) and the stale
     sweep would retract existing `-in-<context>` lists. Never run the pin refresh from this branch
     against real data before story 2 lands; nothing is pushed.
   - The two-`z` TL convention (`dlist-item-tagging` ADR 0002) is implemented on no branch yet
     (that was its story 5); a contextual TL carries its context `z` alone until then. Composes.
6. **Ruling C — the `taPubkey` guards** (2026-09-17). `pinTag(...)` may carry `taPubkey` **only
   alongside `context`** — at the caller site (Tag.jsx) and the signature site alike. A bare
   `taPubkey` on a neutral pin still fails, and the ADR-0015 invariant (the pin's canonical `z`
   composes from the legacy literal, never the runtime TA) is still asserted directly. Both guard
   assertions in `test/restore-historical-data-and-fix-tl-author-filter.test.js` were re-aimed to
   this rule; `test/pinned-notes-display.test.js` was re-aimed to D2 (server recompute) and to the
   accepted contextual-pins hook (reads the 30393 TL). Recorded here because the review found the
   ruling cited in tests and story but nowhere durable.


## Status at the end of the 2026-09-17 session
Integration branch `integrate/staging-into-tags-2026-09` (worktree `~/src/tapestry-tags`), head
`433c8141`: 0 behind staging; story 2 PASS; epic landed; full suite running (capped). **Not pushed** —
remaining frame bullets (deployable + verified on tags.brainstorm.world) wait on the operator's
push of `feat/tags`.

### Full-suite attribution (integration branch, 2026-09-17, head `0338fd14`)
The capped stack-free run (`npm test`, 25 min) was interrupted at 177/206 suites; 51 of those 177
reported failures. Attribution:
- **~45 — the port-7778 false positive** (OPEN 297/292 class): with no `BRAINSTORM_BASE_URL` the
  suites default to `localhost:7778`, a foreign strfry that answers 200, so live suites believe a
  stack is up and fail instead of skipping. Re-run individually with the URL set they go green
  (profile-tags 13/0, event-tagging-for-tag 15/0, restore-historical 22/0, site-trust 28/0,
  deploy-safety 22/0, relationship-primitives 23/0, strfry-write-assertion-bracket 6/0).
- **tag-detail 19/9 — corpus precondition**, identical on the epic branch: "no tag in the first 60
  of available-tags has any tagged profile" on the local relay. Not the code.
- **assistant-setup-state 27/1 — stale dev server**: the :8778 process predates staging's
  `profileSource` field. Environmental.
- **harness-lint 39/2 — real, fixed** (`0338fd14`): CLAUDE.md was 212/190 because the NixOS
  section was committed by accident in `5e1a31aa`; moved to `docs/DEV_ENVIRONMENT_NIX.md`. Plus
  the `contextual-pins` story folder had no epic file (L3) — written retroactively.
- **The hang at suite 178** (`context-scoped-pins`) was the same 7778 mechanism; the 28 suites
  after it, run individually with the URL and caps: 27 green, the one red being
  assistant-setup-state above.
Nothing attributable to the merge or to story 2.
- **2026-09-23 — frame complete.** `feat/tags` was pushed and verified on tags.b.w on 2026-09-17
  (item tagging, wombat fix, `/lists` pagination, contextual pin), and again on 2026-09-22 with
  the `search-index-selection` epic on top; the two-way sync cadence (D3) was exercised at that
  deploy (two unrelated upstream commits absorbed by fast-forward). Operator ratified close.
