# Test Plan: Story 9 — Extend a foothold invite

**Story:** `engineering-team/stories/communities-coldstart/9-foothold-invite.md`
**ADR:** `engineering-team/decisions/communities-coldstart/0039-foothold-invite.md`
**Date:** 2026-06-06

## Approach
New suite `test/foothold-invite.test.js`, registered in `test/test.js`. The correctness core is the pure `buildFootholdInvite` (the invite event's tag shape) — tested against **real source** via extract-and-eval, injecting `LEGACY_Z_TAG_PUBKEY` + `nowSec` into the loader (mirrors `membership-assertion.test.js`, so the builder can keep using the imported const). The issuing UI (create + link + list + states) is covered by source-guards over `CommunityDetail.jsx`.

This story is **issuing only** — accepting + the carried-vouch fulfillment is Story 10, not tested here.

## Coverage map
| Criterion | Test | Level |
|---|---|---|
| AC1 create invite + shareable link | T1 (event shape), T4 (link `?invite=`) | pure + source guard |
| AC2 states the vouch, peer voice | T6 (distinctive "invite vouches for them" copy) | source guard |
| AC3 issuer sees their invites | T5 (issued-invites list) | source guard |
| AC4 empty state before any invite | T5 (empty state) | source guard |
| AC5 failed creation → inline error+retry | T3 (create path) + **review** (state copy) | source guard + review |
| AC6 signed-out → sign-in prompt | **review** (component state) | review |
| (scope) invite is addressable by code | T1 (`d = invite-<code>`) | pure (real) |

## Tests
- **T1** — `buildFootholdInvite({ viewerPubkey, communityATag, code })` → kind-39999; `a` = communityATag; `d` = `invite-<code>`; `p` = issuer; `z` = `39998:<legacy>:foothold-invite`; content empty. *(fails now)*
- **T2** — `buildFootholdInvite` with a missing `code`/`communityATag`/`viewerPubkey` throws. *(fails now)*
- **T3** — source guard: create-invite wires `buildFootholdInvite` + `publishEvent` with `MEMBERSHIP_WRITE_RELAYS`. *(fails now)*
- **T4** — source guard: the shareable link uses an `?invite=` param (the code) — the shape Story 10's accept reads. *(fails now)*
- **T5** — source guard: issued invites are listed, with a designed empty state before any exist. *(fails now)*
- **T6** — source guard: the invite copy is peer-voiced — a distinctive "invite vouches for them" phrase (scoped so it doesn't collide with the existing roster-row "no one you trust vouches for them" copy or the "never approve/admit" comment). The signed-out prompt + error/retry states (AC5/AC6) are standard component states verified at review. *(fails now)*

## Edge cases
- [x] Addressable-by-code (T1 `d`) so Story 10 can fetch the invite.
- [x] Guard on incomplete inputs (T2).
- [ ] Single vs multi-use — out of v1 scope (default multi-use).

## Test infrastructure
- Runner: `node test/test.js`. New suite exports `{ run }`, registered. Real-source layer extract-and-evals `buildFootholdInvite` (loader injects `LEGACY_Z_TAG_PUBKEY` + `nowSec`). Builder lives in `ui-communities/src/events/build.js`.

## How to run
```
node test/test.js
# or: node -e "require('./test/foothold-invite.test.js').run().then(r=>console.log(r))"
```

## Verification
Pure tests fail (no `buildFootholdInvite`); source guards fail (no invite UI). Failing output pasted at the gate.
