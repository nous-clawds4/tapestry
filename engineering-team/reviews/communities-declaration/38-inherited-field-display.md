# Review: Story 38 — inherited-field display

**Reviewer:** Claude · **Date:** 2026-06-05 · **Type:** Feature (ADR 0028/§26 + 0029; no new ADR).

## Quality gates
- [x] `node test/test.js` — **inherited-field-display 5/5**; Overall PASS, no regression (view-a-circle still 5/5).
- [x] `npm run lint` clean · `npm run build` clean.

## Spec adherence
- [x] CommunityDetail resolves a forked circle's definition via the §26 resolver, **gated on a parent** (T1/T2), **live** (re-resolves from the parent's current state — not a snapshot).
- [x] An inherited field renders the parent's value with an **"(inherited)"** marker; an overridden field shows the child's value with no marker (T3/T4); the marker is gated `!c.belongingBar && resolved?.belongingBar`.
- [x] No-parent circles show no markers — no regression to Story 34 (T5).

## ADR adherence
Read-side of §26 made visible; live resolution per ADR 0028. CSS via tokens.

## Findings
**Blocking:** none.
**Non-blocking:**
1. v1 marks the **belonging-bar** as inherited; description/topics inheritance markers can follow (the resolver already returns them).
2. The resolve effect runs on every `state.community` change; for deep chains it makes one fetch per ancestor. Bounded by MAX_DEPTH 16; caching is a future concern (ADR 0028 noted).

## Verdict
**PASS.** Forked circles now show what they inherit vs override, live. **Block 2 complete.**
