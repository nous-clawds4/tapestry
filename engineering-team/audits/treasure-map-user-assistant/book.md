# Book of Work: Treasure Map — Per-User Assistant

**Slug:** treasure-map-user-assistant
**Status:** Closed
**Opened:** 2026-08-28
**Closed:** 2026-09-07
**Strictness:** Light (trial) — workflows/light-profile.md *(third trial book; single Bug-lane
story. This book fixes the Light trial's first **escaped defect**, attributed to
tl-treasure-map stories 2–3 — OPEN.md row 188.)*

## Intent anchor

**Acceptance frame (no PRD)** — the operator's report, restated and confirmed (2026-08-28
session): a team member signed up on tapestry.brainstorm.world (which mints his own assistant
nsec) and ran the Treasure-Map opt-in; his updated Map carried the **owner's** assistant pubkey
instead of **his own**. Fix: the delegate everywhere in the Treasure-Map surface is the
**signed-in user's** assistant (`useAuth().user.assistantPubkey`, backed by
`getAssistantKeys(userPubkey)`), never the instance owner's (`ConfigContext.taPubkey`).

### Acceptance frame

- [x] **Right key:** salient check, preview, and published tag all use the signed-in user's
      `assistantPubkey`; `ConfigContext.taPubkey` no longer appears in the card or panel
      (negative pin).
- [x] **Badge:** the Map Entries badge judges against the user's assistant and reads
      **Your assistant** (owner signed in ⇒ identical behavior to before, since the owner's
      assistant IS the instance TA).
- [x] **Null safety:** a user with no provisioned assistant (guest) gets no opt-in card and no
      locality badges — never a prompt that would compose a null delegate.
- [x] **Copy & spec:** green-state copy says "your Tapestry Assistant"; the operator-ratified
      prompt sentence stays verbatim; the spec draft's "its own TA" relay-hint phrasing is
      corrected to the signed-in user's Assistant.
- [x] **Recovery path holds:** the team member's owner-TA entry will read **external** after
      the fix, re-prompt him, and be replaced in place per ADR 0001 §3.
- [x] **Hand-edit reachable** *(operator addition, 2026-09-07)*: the "Update ... by hand" panel is
      available to every viewer of a found Map — mounted by the page, not nested inside the
      delegation card, so no card state (including the null-assistant case story 1 introduced)
      can withhold it.
- [x] **Ledger:** escaped-defect row 188 minted (attributed to tl-treasure-map for the trial
      record) and DONE with the fix pointer.

## Epics in this book
- `treasure-map-user-assistant` — per-user assistant in the Treasure-Map surface (+ hand-edit reachability, story 2). *(Done, retired 2026-09-07.)*

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high — every frame bullet verified; the recovery bullet, which no local test could reach, was confirmed by the affected team member on production (2026-09-07).

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/treasure-map-user-assistant/audit.md`
- Product feedback: `engineering-team/audits/treasure-map-user-assistant/prd-seed.md`
