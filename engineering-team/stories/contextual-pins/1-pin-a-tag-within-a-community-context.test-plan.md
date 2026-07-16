# Test Plan — Story 1: Pin a tag within a community context

**Story:** `engineering-team/stories/contextual-pins/1-pin-a-tag-within-a-community-context.md`
**ADR:** `engineering-team/decisions/contextual-pins/0001-context-scoped-pins.md`
**Suite:** `test/context-scoped-pins.test.js` (registered in `test/test.js`; runner: `npm test`)

## Approach

The project runs a hand-rolled runner (`node test/test.js`); each suite exports
`run() → {pass, fail, failures}`. Following the established split:

- **Pure-logic tests** exercise the new SDK spine `src/lib/event-tagging/pins.js` directly
  (node-loadable, stack-agnostic — the same portability the story demands). The SDK is
  required **lazily inside each test** so the not-yet-existent module fails *this suite*
  meaningfully rather than crashing the runner at load.
- **Source-contract markers** (`readFileSync` + regex) cover the client/server surfaces that
  don't load under node (vite `@tapestry/event-tagging` alias, JSX). These assert the
  d-tag threading, the runtime-TA stamp, the plural read, and firmware seeding are wired —
  the behavioral proof of coexistence/first-class is exercised through the pure spine
  (distinct d-tags via `pinVariantKey`) plus the existing pin suites staying green.

**Backward-compat is guarded by omission + invariant:** `pinVariantKey()` returning `''`
keeps bare pins byte-identical, so the existing `pin-a-tag` / `tl-publication-from-pins` /
`nip51-list-export` suites MUST remain green — that is the regression proof for neutral pins,
not duplicated here.

## RED status (confirmed)

Isolated run: **20 fail for the right reasons, 1 passes by design.** The passing test
(`retraction stays SET-BASED`) is a **regression guard** on the ADR's load-bearing invariant
(`new Set(currentDTags)` in `retractStaleTLs`) — it must stay green through implementation,
never flip. All others are RED until the SDK module, the source threading, and the firmware
seeds exist.

## Coverage map (AC → test)

| Story AC | Test(s) |
|---|---|
| Pin without a context unchanged (bare identity preserved) | `pinVariantKey() → ""` + existing pin suites stay green |
| Offered contexts (LFO, Tapestry & Web of Trust); optional | `KNOWN_CONTEXTS offers lfo + tapestry-web-of-trust`; UI marker `driven by KNOWN_CONTEXTS` |
| A context pin is associated with exactly one context | `contextSlugOfPin recovers the context slug`; `pinVariantKey({contextSlug}) → "-in-lfo"` |
| Neutral + context pin of same tag coexist | `computePinEventDTag threads pinVariantKey` (distinct d-tags ⇒ `dedupeReplaceable` keeps both) |
| Same tag in two different contexts coexist | `pinVariantKey` distinct suffix per slug (distinct d-tags) |
| Removing one pin leaves the others | distinct d-tags (above) + `viewerPins` plural read exposes each independently |
| First-class parity (own TL/export/detail, no clobber) | `computeTLDTag + computeNoteBookmarkDTag thread pinVariantKey`; server `TL d-tags thread pinVariantKey` |
| Reconfigure one pin doesn't touch siblings | distinct TL d-tags (above) + `retraction stays SET-BASED` invariant |
| Context query returns C-stamped, excludes neutral | `context scan excludes neutral pins`; `contextSlugOfPin returns null for a neutral pin` |
| Trust-filtered, de-duplicated derivation | `contextPinsToTags dedupes by a-coordinate`; `applies the injected trustFilter` |
| Portable derivation (no server) | `contextPinsToTags returns display-sufficient fields from events alone`; `does not mutate its input` |
| Fresh-deploy provisioning, no event IDs in client code | firmware `manifest` + `concept-header files exist`; `KNOWN_CONTEXTS … no event IDs`; runtime-TA `contextHandle` |
| Runtime-TA (not legacy) stamp — CLAUDE.md rule | `contextHandle → 39998:<taPubkey>:lfo`; `pinTag stamps via contextHandle`; `contextSlugOfPin does NOT misread the legacy tag-pinning z` |

## Notes for the Implementer

- Make the RED tests pass by building `src/lib/event-tagging/pins.js` to the ADR §Implementation-notes
  signatures, then threading `pinVariantKey` through the five d-tag schemes and stamping the
  runtime-TA context z in `pinTag`.
- Do **not** satisfy `viewerPins`/UI markers with a cosmetic rename — the plural read must
  actually return one entry per coexisting pin.
- Keep `retractStaleTLs` set-based (the guard test enforces it; the ADR marks removing it a
  reviewer-reject).
- After adding firmware concepts: `POST /api/firmware/install` locally (AGENTS.md §6). The
  firmware tests only check the definition files/manifest, not a live graph.
