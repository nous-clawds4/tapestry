# PRD Seed: Precision relay-sync tooling (Relay Settings → Negentropy Sync)

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/sync-panel-tag-filters/audit.md`
**Anchor:** acceptance frame in `book.md` (backfilled same-day from the verbatim ask; OPEN.md #29)
**Confidence:** high

> Reverse-engineered baseline in PRD shape, from what shipped 2026-07-15. A strawman for the product team to adopt at the next `/discover`, not a ratified spec. Tags: `[FROM FRAME]` · `[INFERRED]` · `[UNKNOWN — product input needed]`.

## 1. Product vision

`[INFERRED]` Give **instance operators** first-class, safe, point-and-click control over *which events* move between their relay and the network — replacing shell sessions inside the container with a command builder whose preview is exactly what runs. The sync panel now expresses the full useful nostr filter language for its job (kinds × authors × time × single-letter tags), making targeted operations (e.g. tags-federation syncs of ~451 relevant events instead of ~1.28M by kind) routine and mistake-resistant.

`[UNKNOWN — product input needed]` Whether this grows into a general "relay data-flows console" (one-shot sync + persistent router streams + counts/monitoring as one coherent surface) or stays a set of adjacent tabs.

## 2. Personas

`[FROM FRAME]` **Instance operator** (self-hosting admin; the story's "as an instance operator"): technically fluent, signs in as owner, runs syncs against live relays, cares about not typo-ing a pubkey into a long-running pull. Uses hex and bech32 interchangeably (clipboard usually holds an `npub…`).
`[INFERRED]` Secondary: **federation maintainer** (the tags-federation work) — same person wearing a network hat; needs `#z`-scoped syncs across `*.brainstorm.world` instances.

## 3. Scope (as-built)

`[FROM FRAME]` Add one-or-more single-letter tag filters to the sync filter, entered one at a time (letter + one-or-more values); `p`/`e`/`a` values format-checked; other letters unchecked; preview/count/executed-sync all honor them.
`[FROM FRAME — approved defaults]` Uppercase `P`/`E`/`A` validated like lowercase; duplicate-letter adds merge + dedupe; bech32 (`npub`/`nprofile`/`note`/`nevent`/`naddr`) accepted, normalized to hex/coordinate.
`[INFERRED — shipped mechanics]` Exactly-one-ASCII-letter tag names (the protocol's indexable set); case-sensitive letters (`#x` ≠ `#X`); one bad value blocks the whole add with an inline error naming it; rows removable; inputs disabled while a sync runs; server accepts only `#<letter>` keys with non-empty string-array values and still drops every other unknown key.

Explicitly out of scope this phase (story): persistence/saved presets · in-place editing · multi-char tag names (not queryable in strfry) · comma-bearing values · concept-handle semantics or autocomplete · router config changes.

## 4. Domain model

`[INFERRED]` No new domain entities. A **tag filter** here is `{ letter, values[] }`, a UI-local structure serialized into the standard nostr filter (`"#x": [...]`) — deliberately *not* concept-graph-aware (a `#z` value is an opaque string; the epic guardrail keeps generic tooling generic). Value classes: pubkey (p/P), event id (e/E), address coordinate `kind:pubkey:identifier` (a/A), free string (all other letters). No stored shapes changed; no concepts touched; no firmware.

## 5. Design rules (as-built)

`[INFERRED]` Follow the panel's existing idioms: one `settings-group` per filter dimension, ordered Relay → Direction → Kinds → Authors → **Tag Filters** → Time Range → Preview; label + `(optional — hint)` sub-copy; comma-separated multi-value inputs (Authors precedent); inline red error box matching the panel's error styling; mono font for wire-format strings (`#x`, command preview); everything disabled while a sync runs; the Command Preview is ground truth (exactly what executes). `[INFERRED]` Errors are blocking-and-specific: name the offending value and the expected forms. `[UNKNOWN]` No recorded rule for whether normalized values should *display* as hex (current) or echo the operator's bech32 input — never designed, defaulted to hex.

## 6. Carry-forward & open questions (promoted from audit §6)

1. **Router Management tag filters — the headline next phase.** Same filter expressiveness, one tab left, but for *persistent* strfry-router streams (always-on federation) rather than a one-shot command. Directly serves the ledgered tags-federation plan (OPEN.md #25: `#z`-filtered both-direction dcosl stream). Triaged with verbatim ask: `stories/_intake.md` 2026-07-15.
2. Prod promotion of this feature (staging-held; OPEN.md #30).
3. Small UX: strip a leading `#` in the letter input.
4. Deferred sugar: saved presets; in-place editing; concept-handle autocomplete for `#z`.
5. Ops adjacent: dcosl lacks NIP-45 COUNT (`maxFilterLimitCount`), so remote counts show unsupported against it.

## 7. What product must validate

- [ ] **Router-stream scope (next phase):** are tag filters set per-stream, and do preset streams (dcosl/WoT/profiles…) grow editable tag filters too? Persistence + restart semantics: router config rewrites restart the router — acceptable UX? Does the tags-federation stream (OPEN.md #25) ship as a *preset*? `[UNKNOWN]`
- [ ] Display normalization: show hex (current) vs echo the pasted bech32 with hex on hover? `[UNKNOWN]`
- [ ] Merge-on-duplicate-letter (current) vs replace — right long-term default? `[FROM FRAME — approved default, worth ratifying]`
- [ ] Should `#z` inputs *optionally* offer concept-handle awareness (autocomplete from the local graph) while staying generic underneath? `[INFERRED gap]`
- [ ] Does the sync panel need saved/named filter presets once router presets exist (one mental model across both tabs)? `[UNKNOWN]`
