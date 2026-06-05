# Review: Story 33 — Found a circle by declaring its definition

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-05
**Branch:** `feat/communities` · **Epic:** `communities-declaration`
**Type:** Feature (all five phases applied).
**Diff under review (5 commits):** story+epic, ADR 0029, test design (10 tests), impl, this review. Impl diff: 7 files, +373/−18.

## Quality gates (run by reviewer, not trusted)
- [x] **`node test/test.js` — PASS.** `found-a-circle` **10/10**; **Overall PASS**, no regression across the other suites. The 3 previously-failing pre-existing suites stay green (path/firmware fixes from earlier this session hold).
- [x] **`cd ui-communities && npm run lint` — clean.**
- [x] **`npm run build` — clean** (127 modules, ~775ms; +~16kB JS over the prior build for the new flow + read paths).
- [x] **Browser smoke (preview :5180)** — `/found` renders; stepper advances Name → Belonging → Review; review shows the circle + belonging-bar + peer-framed callout; signed-out shows the "Sign in to publish" prompt; **zero console errors**.

## Spec adherence (vs. Story 33 acceptance criteria)
- [x] **AC-1 (publish a CD that exists/retrievable).** `buildCommunityDeclaration` emits kind-39998, `d`=slug, name + description(purpose) + belonging + founder tags ([declaration.js](ui-communities/src/events/declaration.js)). `getCommunity` resolves it via `fetchCommunityDeclaration` ([client.js:realGetCommunity](ui-communities/src/api/client.js)). T1/T2.
- [x] **AC-2 (founder lands on read-only detail).** `Found.jsx` builds → `publishEvent` → `navigate('/community/<slug>')`; `getCommunity` now returns the CD so the detail renders. T7.
- [x] **AC-3 (founder is a peer).** `founder` tag, no owner/admin/moderator tags (T3); `Found.jsx` has no owner/admin/moderator labels (T10); copy reads "You are a peer here."
- [x] **AC-4 (belonging-bar as prose, not a roster).** `belonging` tag carries prose; **no `seed`/`member` tags** (T4).
- [x] **AC-5 (sign-in only at publish, state preserved).** Publish gated on `signedIn`; inline sign-in panel at the review step; typed state held in component state across sign-in (T8).
- [x] **AC-6 (specific publish errors).** Reuses `publishErrorCopy` from `lib/errors.js` (T9); empty-slug guard has its own message.
- [x] **AC-7 (existing circles undisturbed).** Bespoke `build.js` untouched and carries no CD builder (T5); the read paths union both models behind a normalized projection with a `model` discriminator (T6). `Create.jsx` left intact and still routable at `/create`.

**7/7 ACs met.**

## ADR 0029 adherence
- [x] CD is **kind-39998** (a concept), not a 39999 item — matches the protocol; forkable via `b` (forward-compat tag present, unwritten by founding).
- [x] **Strangler coexistence** via a normalized `Circle` projection + `model: 'bespoke' | 'declaration'`; new modules beside frozen ones; discovery unions; founding writes a CD only.
- [x] **No firmware change** — CDs read/written directly from the relay (mirrors the bespoke relay-fallback pattern). Confirmed: no firmware/concept-schema files touched.
- [x] Type marker (`t=brainstorm-community`) distinguishes CDs from the bespoke kind-39998 DList header (which has no `t`) and from kind-39999 records (different kind). No filter collision.

**No ADR deviations.**

## Things tests can't catch
- [x] **No secrets, no debug logging, no commented-out code.** One intentional `console.warn` on the discovery-union failure path (graceful degrade).
- [x] **Strangler integrity** — `git show` confirms `build.js` and `Create.jsx` are byte-unchanged; the bespoke fallback still resolves existing circles.
- [x] **Copy** honors the style guide — peer language, specific errors, no owner/admin/badge vocabulary.
- [x] **Slug collision policy** — on a shared slug, `getCommunity` prefers the CD over the bespoke record (deliberate: new model wins). Consistent with the strangler intent.

## Findings

### Blocking
_None._

### Non-blocking
1. **NB-1 — CD conversation addressing is a Story 8 prerequisite.** `CommunityDetail` computes the post a-tag as `39999:<founder>:<slug>`. For a **CD circle (kind-39998)** that address is wrong, so the Conversation tab on a CD circle will not round-trip posts. Out of scope for Story 33 (posting is Story 8), but **Story 8 must derive the post anchor from the circle's `model`** (39998 for CDs). Flagging so it's not missed.
2. **NB-2 — `COMMUNITY_TYPE_MARKER` export is now orphaned in `declaration.js`.** The builder inlines the literal (required for the pure-function eval test), so the exported const has no in-repo importer (`fetch.js` defines its own). Harmless and self-documenting; could be removed or actually imported by `fetch.js` in a tidy-up.
3. **NB-3 — founding omits topics.** The builder supports `topics`, but the found flow doesn't collect them. Acceptable for Story 33 (topics serve discovery, Story 3); note for Story 3 so discover filtering has data.
4. **NB-4 — T19 (discover suite) was relaxed to assert intent over proximity.** Legitimate: ADR 0029's CD fallback sits between the 404 sentinel and the final `return null`. The 404→null contract still holds; the change is documented inline. No behavior change.

## Verdict
**PASS.**

Story 33 lands the first brick of the "right way" Communities model: a circle is a **kind-39998 Community Declaration** (forkable, peer-founded), founded through a new `/found` flow that coexists cleanly with the frozen bespoke app via a normalized projection — no firmware change, no disturbance to existing circles. 7/7 ACs, ADR-conformant, full suite green, lint/build/browser-smoke clean. Four non-blocking notes; **NB-1 (CD post addressing) is the one to carry into Story 8.**

Ready for the deploy chain when chosen. Next in the epic: Story 2 (view-a-circle, fuller read-only detail) and Story 3 (discover-circles), which can build on the projection + union this story established.
