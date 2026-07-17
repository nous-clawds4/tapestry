# PRD Seed: Precision relay data-flows — persistent router streams

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/router-stream-tag-filters/audit.md`
**Anchor:** acceptance frame in `book.md` (opened eagerly at intake; operator-confirmed at kickoff)
**Confidence:** high
**Date:** 2026-07-16

> Reverse-engineered baseline in PRD shape, from what shipped 2026-07-16. A strawman for the product team's next `/discover`, not a ratified spec. Tags: `[FROM FRAME]` · `[INFERRED]` · `[UNKNOWN — product input needed]`. Companion to the sibling seed (`audits/sync-panel-tag-filters/prd-seed.md`) — this book resolves that seed's §6 bullet 1 and §7 router-scope question.

## 1. Product vision

`[INFERRED]` Extend the operator's precise filter language from one-shot syncs to **always-on federation**: Router Management streams now express the same single-letter tag filters (with the same validation) as the Negentropy Sync panel, so *which events flow continuously* between instances is as controllable, safe, and point-and-click as a one-time pull. The motivating job — a `#z`-scoped dcosl stream moving ~451 relevant tag events instead of ~1.28M by kind (OPEN.md #25) — is now expressible entirely from the UI.

`[INFERRED — evidence accrued]` The sibling seed's open question "does this grow into a coherent relay data-flows console?" now has a data point: two of the page's tabs share one filter language, one validation core, and one wire format. What's still missing for "console" status: shared presets, count/preview parity on streams, and any cross-tab mental model the product team wants to name. `[UNKNOWN]` whether that console is a product goal or an emergent convenience.

## 2. Personas

`[FROM FRAME]` **Instance operator** — self-hosting admin, signs in as owner, edits persistent router config; a mistake here is worse than a bad one-shot sync (it *keeps* running), so filter safety at save time matters more, not less.
`[INFERRED]` **Federation maintainer** — the same person wearing the network hat (tags-federation across `*.brainstorm.world`); needs per-instance stream setup because router state is per-deployment (observed: staging `treasureMaps` vs prod `dcoslUpload`).

## 3. Scope (as-built)

`[FROM FRAME]` Per-stream single-letter tag filters in the stream add/edit editor: letter + one-or-more values, entered one at a time; `p`/`e`/`a` (and uppercase) format-checked with bech32 normalization; other letters free-form; rows removable; filters persist through save → router restart and round-trip into the editor; saved entries visible on the stream card.
`[FROM FRAME — carried defaults]` Story #1's ratified defaults verbatim: uppercase validated like lowercase; duplicate-letter adds merge + dedupe; bech32 accepted, normalized to hex/coordinate; hex display.
`[INFERRED — shipped mechanics]` The stream's **persisted filter object is the single source of truth** (editor rows derived from it each render; no parallel state); every stream save passes a whitelist sanitizer matched to the deployed router parser's closed vocabulary (one unknown key would crash-loop the whole router at restart — discovered live during Architecture); tag-less streams re-emit byte-identically.

Explicitly out of scope this phase (story + Planning answers): a tags-federation *preset* (guardrail: generic tooling stays concept-unaware) · any change to save/apply→restart semantics · count/preview for streams · in-place value editing · multi-char tag names · comma-bearing values · concept-handle autocomplete.

## 4. Domain model

`[INFERRED]` Still no new domain entities. A stream's filter is standard nostr filter JSON; tag filters are `"#<letter>": [strings]` keys within it, edited through the same `{letter, values}` row model as the sync panel. Router streams live in per-instance state (`router-state.json`) and are compiled into the strfry-router config on save — so **stream sets legitimately diverge per deployment**; a federation plan must be executed per instance. No concepts touched; no firmware.

## 5. Design rules (as-built)

`[INFERRED]` The stream editor follows its host form's idioms (labeled field blocks, small hint copy) rather than the sync panel's `settings-group` chrome — same component, host-appropriate framing. Tag Filters sits between Event Kinds and Limit. The read card appends ` #x: v1, v2` entries to its existing `Filter:` line (kinds/limit/tags are card-rendered; other persisted keys are not — pre-existing card scope). Errors remain blocking-and-specific, naming the offending value. `[UNKNOWN — inherited]` hex vs bech32-echo display was never designed on either panel; both currently show hex.

## 6. Carry-forward & open questions (promoted from audit §6)

1. **Execute the tags-federation stream** (OPEN.md #25) — the feature this book built the tooling for: per-instance `#z`-filtered both-direction dcosl streams + the runbook correction. Now point-and-click.
2. **Hardening trio** (OPEN.md #31): raw `urls`/plugin interpolation in the config emitter; negative-integer acceptance; kinds-less-filter editor crash. One bounded story.
3. **Count/preview parity for streams** — sync can Count a filter before running; streams save blind. Candidate next increment.
4. Optional **live round-trip check** on a shared instance (the one AC leg verified architecturally rather than by live mutation).
5. Inherited sugar, still deferred: saved presets · in-place editing · concept-handle autocomplete for `#z` · display normalization.

## 7. What product must validate

- [ ] **Preset strategy:** should the tags-federation stream ship as an *optional, clearly-labeled concept-aware preset* (fills kinds + canonical `#z` handles), or does hand-entry + runbook stay the norm? This book declined a preset on the epic's generic-tooling guardrail — a deliberate product decision is needed to override that. `[UNKNOWN]`
- [ ] **Runbook UX for #25:** is hand-entering three canonical z-handles per instance acceptable, or does execution need copy-paste affordances / autocomplete first? `[UNKNOWN]`
- [ ] **Count-before-save:** do operators need match-volume preview on stream filters (parity with the sync panel's Count)? `[INFERRED gap]`
- [ ] **Display normalization** (hex now; echo bech32 with hex on hover?) — ratify once for both panels. `[UNKNOWN — inherited]`
- [ ] **Merge-vs-replace on duplicate letter** — carried default, still worth one ratification. `[FROM FRAME — approved default, inherited]`
- [ ] **Saved/named filter presets across both panels** (one mental model) — inherited from the sibling seed. `[UNKNOWN]`
- [ ] **Live-mutation verification appetite:** should shared-instance smoke ever include a scripted save→restart→round-trip of a scratch stream, or does read-only smoke + test coverage remain the standing policy? `[UNKNOWN]`
