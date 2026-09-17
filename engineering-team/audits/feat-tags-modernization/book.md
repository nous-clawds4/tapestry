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

- [ ] **The gap is closed.** `feat/tags` contains staging's content, and `git rev-list --count
      feat/tags..staging` is 0 at close.
- [ ] **No shipped behavior is silently lost, in either direction.** Every feature that exists on
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
- [ ] **The 54 feat/tags-only commits have a declared destination** — each either promoted toward
      staging or marked tags-only. This is the decision that determines whether the pin-stack
      tangle is resolved once or twice.
- [ ] **Security parity is verified, not assumed.** The September fixes end up present and
      equivalent; `publishEvent.js` keeps staging's brain-write hook (verified superset at kickoff).
- [ ] **The branch is deployable.** UI builds; the full suite runs with every failure attributed to
      a pre-existing cause; tags.brainstorm.world serves the merged branch.
- [ ] **A branch policy is written down and agreed** — restored, amended, or replaced — so the next
      session does not re-derive it.
- [ ] **`dlist-item-tagging` then lands by ordinary merge**, and the parked replay branch is
      retired rather than merged.

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
