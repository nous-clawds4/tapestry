# Book of Work: Trusted Lists on the Treasure Map

**Slug:** tl-treasure-map
**Status:** Closed
**Opened:** 2026-08-27
**Closed:** 2026-08-27
**Strictness:** Light (trial) — workflows/light-profile.md *(story 1 escalated to Standard docs-mode by the wire-format irreversibility trigger; stories 2–3 ride the Light feature lane)*

## Intent anchor

**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff (2026-08-27
session): Brainstorm customers — whose Treasure Map is managed at brainstorm.world and whose
rank/followers Trusted Assertions are published by the Brainstorm Assistant — can come to the
Tapestry app and modify their Treasure Map to indicate that pubkey Trusted Lists will be published
by the local Tapestry Assistant.

### Acceptance frame

- [x] **Tags panel:** on the TA Treasure Map page (`/tapestry/grapevine/trusted-assertions`), a
      panel enumerates every tag of the found kind-10040 event — kind, classification (Trusted
      Assertion 3038x / Trusted List 3039x / other), avatar linking to
      `/tapestry/users/<pubkey>`, and a local-TA vs **external** badge (TA pubkey resolved at
      runtime, never hardcoded).
- [x] **Salient question answered visibly:** whether generic pubkey-TL support (`30392`) is
      present in the Map, and whether it points at this instance's Tapestry Assistant.
- [x] **Opt-in flow:** if either answer is no → prompt "Would you like the local Tapestry
      instance to publish your pubkey Trusted Lists on your behalf?"; on yes → updated 10040
      carrying `["30392", <local TA pubkey>, <relay>]` — all other tags preserved verbatim, a
      stale generic `30392` entry replaced (never appended alongside) — signed by the user via
      NIP-07 and published to local strfry + the general-purpose relays.
- [x] **Preview:** the exact updated (unsigned) event is viewable whenever the publish
      affordance is visible.
- [x] **Convention ratified:** the Treasure-Map TL-advertisement convention is recorded in
      `protocols/drafts/trusted-lists.md` plus a full ADR; named `30392:<name>` entries are
      documented as a future override, recognized but inert today.
- [x] **No-Map-found path unchanged.** Verified locally and on staging; production promotion is
      the operator's explicit call, outside this frame.

## Epics in this book
- `tl-treasure-map` — Treasure-Map TL advertisement: wire-format convention + tags panel +
  opt-in publish flow (+ manual editor, story 4). *(Done, retired 2026-08-27.)*

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high — anchored frame; every bullet verified in-session against the live local stack and staging (bundle-hash-matched), the wire convention ratified by full ADR, and the operator ratified each story's Gate B plus the close itself.

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/tl-treasure-map/audit.md`
- Product feedback: `engineering-team/audits/tl-treasure-map/prd-seed.md`
