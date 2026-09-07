# Story 1: Per-user assistant delegate

**Status:** Done
**Created:** 2026-08-28
**Type:** Bug *(Light lane — Implementer + Reviewer, one human stop at Gate B; scoped gate:
`node -e "Promise.all(['./test/tl-treasure-map-panel.test.js','./test/tl-treasure-map-optin-publish.test.js','./test/global-publish-gate.test.js','./test/strfry-write-assertion-bracket.test.js','./test/treasure-maps-router-preset.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"`)*

## Background
The tl-treasure-map surface used `ConfigContext.taPubkey` — the **owner's** assistant
(`getOwnerAssistantPubkey`) — as "the local Tapestry Assistant" in the salient check, the
preview, the published tag, and the panel badge. The platform model is one assistant **per
user** (`getAssistantKeys(userPubkey)`: owner ⇒ owner assistant; everyone else ⇒ their
signup-minted customer relay keys), already exposed to the UI as `useAuth().user.assistantPubkey`
(AuthContext ← `/api/auth/user-classification`). On a dev instance the operator IS the owner, so
the two keys coincide and no local test could distinguish them; production's first real
customer exposed it — his Map now advertises the owner's assistant (OPEN.md row 188).

## User-facing description
As a signed-in customer, when I opt in (or hand-edit) on the TA Treasure Map page, the
delegate written into my Map is **my own** Tapestry Assistant — and the page judges "already
delegated to me" against my assistant, not the instance owner's.

## Acceptance criteria
- [x] AC-1: `TlOptInCard` sources the delegate from `useAuth().user.assistantPubkey` for the
      salient check, the preview, and the publish composition. `taPubkey` no longer appears in
      `TlOptInCard.jsx` or `TreasureMapTagsPanel.jsx` (negative pin — the regression class is
      "wrong runtime key", not just hardcoding).
- [x] AC-2: The Map Entries badge compares each entry's delegate to `user.assistantPubkey`;
      the matching label reads **Your assistant** (non-matching stays **external**). No badge
      renders while the baseline is unresolved or null.
- [x] AC-3: `user.assistantPubkey` null (guest / unprovisioned) ⇒ the opt-in card renders
      nothing; no prompt can compose a null delegate.
- [x] AC-4: Green-state copy reads "Published by your Tapestry Assistant."; the
      operator-ratified prompt sentence is unchanged verbatim.
- [x] AC-5: `protocols/drafts/trusted-lists.md` relay-hint bullet corrects "advertising its own
      TA" to the signed-in user's Assistant (wire semantics untouched — §2 was already
      per-user-correct).
- [x] AC-6: Owner-signed-in behavior is unchanged (owner's `assistantPubkey` IS the instance
      TA), and the tl-treasure-map U-suites (upsert/salient helpers, pubkey-agnostic) stay
      green untouched.

## Design note *(Light profile — provisional here, ratified at Gate B)*
- **Chosen approach:** swap the baseline source in the two components. `TlOptInCard`: read
  `const { user } = useAuth()`, use `user?.assistantPubkey` where `taPubkey` was (guard, salient
  check, preview memo, publish composition); `useConfig()` keeps supplying only `aRelays`.
  `TreasureMapTagsPanel`: same swap for the badge baseline; label "Your assistant". Copy + spec
  wording per AC-4/AC-5. Suite re-aims in the same commit (Bug lane — no failing-first
  mandate, but the red→green sequence is demonstrated): S-assertions flip from
  `useConfig().taPubkey` to `useAuth()`/`assistantPubkey`, plus the AC-1 negative pin.
- **Rejected alternative:** have `/api/assistant/pubkey` return the session user's assistant —
  rejected: that endpoint IS the owner-assistant lookup by contract (CLAUDE.md § per-deployment
  TA pubkey) and other consumers (Avatar's TA badge, concept handles) depend on that meaning;
  repointing it would fix one surface by breaking the contract everywhere else.
- **Blast radius:** `ui/src/pages/grapevine/TlOptInCard.jsx`,
  `ui/src/pages/grapevine/TreasureMapTagsPanel.jsx`, the two tl-treasure-map suites,
  `protocols/drafts/trusted-lists.md` (one bullet), OPEN.md (row 188). `Avatar.jsx` untouched —
  its TA badge marks the *instance* assistant by design (ta-avatar ADR 0001), which remains
  correct identity display.
- **Recovery by design:** the production Map that carries the owner-TA entry will read
  **external** under the fixed check, re-prompt, and be replaced in place (ADR 0001 §3) — no
  data surgery.

## Edge cases & not-covered
- E1: owner signed in — `user.assistantPubkey === getOwnerAssistantPubkey()` by
  `getAssistantKeys`'s own branch; every pre-fix behavior reproduces exactly (regression path).
- E2: entry pointing at the instance TA viewed by a *customer* — now correctly **external**
  (this is the team member's Map today; the re-prompt is the designed recovery).
- E3: `assistantPubkey` arrives after first render (classification fetch) — same no-flash
  guard discipline as before, now keyed on the user object.
- **Not covered:** live multi-user NIP-07 verification (no second extension identity on this
  machine — the team member on staging/production is the real-world verifier, noted at Gate B);
  provisioning UX for null-assistant users (product question, deferred).

## Linked artifacts
- ADR: — (no trigger; wire convention untouched)
- Test suites: `test/tl-treasure-map-panel.test.js`, `test/tl-treasure-map-optin-publish.test.js`
  (re-aimed; scoped gate above)
- Review: `engineering-team/reviews/treasure-map-user-assistant/1-per-user-assistant-delegate.md`

Link by path only — never record verdicts or round history in this file.
