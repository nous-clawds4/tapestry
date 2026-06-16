# ADR 0033: Profile identity details popover

**Status:** Accepted
**Date:** 2026-06-16
**Story:** `engineering-team/stories/profile/37-identity-details-popover.md`
**Epic:** `profile`

## Context

Story 37 moves the **npub** and **hex pubkey** out of the inline Identity section of the profile page into a small, centered, tap-to-open popover triggered by a neutral "more details" control floated to the right of the display name. Website and Lightning stay inline. The control is framed as a "details drawer" that will grow.

Acceptance criteria (quoted, condensed): a neutral non-key glyph control to the right of the name, floated right like the existing info popovers, with an a11y label; tap-to-open/dismiss matching the existing info popovers; the popover shows npub + hex pubkey, each labeled, each with a copy control that copies the **full** value with the page's existing on-copy feedback; npub/pubkey **no longer inline**; Website + Lightning unchanged; the Identity section does **not** render as an empty shell when both website and lud16 are absent; **purely presentational** (same values, same derivation).

**Grounding (this branch — all in the React UI under `ui/`):**
- Display name: `ui/src/pages/BrainstormProfile.jsx:250` — `<h1 className="bsp-name">{displayName}</h1>`, inside `.bsp-header-info` (`:249`) inside the flex `.bsp-header` (`:236`).
- Identity section: `BrainstormProfile.jsx:334-365` — a `.bsp-section` with `<h3>Identity</h3>` and a `.bsp-id-grid` of `.bsp-id-row`s: Pubkey hex (`:338-342`, value `shortPubkey(pubkey)` + `<CopyButton value={pubkey}/>`), npub (`:343-349`, guarded by `{npub && …}`, value truncated + `<CopyButton value={npub}/>`), Website (`:350-357`, an `<a className="bsp-id-link">`), Lightning (`:358-363`, `<span>⚡ {profile.lud16}</span>`).
- `CopyButton`: `BrainstormProfile.jsx:59-75` — `navigator.clipboard.writeText(value)`, swaps `📋`→`✓` for 1.5s. **Used only** at `:341` and `:347` (grep-confirmed) — both move into the popover, so after this change the page no longer references it.
- `npub` is already derived client-side: `BrainstormProfile.jsx:119-121` (`nip19.npubEncode(pubkey)`, `null` on failure). `pubkey` from `useParams`. No fetch involved.
- `shortPubkey` helper: `BrainstormProfile.jsx:36-39` — **also used at `:122`** for the displayName fallback, so it must stay in the page.
- Established info-popover pattern (ADR 0032): `ui/src/components/VerificationInfo.jsx`, `ui/src/components/ReputationInfo.jsx` — a `.bsp-info-btn` trigger owning local `open` state + a `.bsp-confirm-overlay` › `.bsp-confirm-box` popover (overlay-click + "Got it" to dismiss; `stopPropagation` on the box).
- Relevant CSS (all reusable, tokens-only): `.bsp-info-btn` (`styles.css:4181` — circular 1.75rem bordered button, **`margin-left:auto`** → floats right within a flex row); `.bsp-confirm-overlay/box/title/message/buttons/ok` (`:3668-3724`); `.bsp-id-grid/row/label/value` (`:3441-3462`); `.bsp-copy-btn` (`:3471`); `.bsp-section h3` (`:3422`, already `display:flex`).

Constraints: JS-without-build; **tokens-only** (`bsp-*` classes + CSS custom properties); **no new icon library** (use an existing unicode glyph); tested via `test/test.js` **source-regex sentinels**, not Playwright. No concept/schema/firmware change (npub/pubkey are NIP-19 encodings of the already-known `nostr-user` pubkey; Concept Graph orientation is a no-op here and the local stack was down at design time).

## Options considered

### Component structure

#### Option A — a new self-contained `IdentityDetails` component *(chosen)*
Mirror `VerificationInfo`/`ReputationInfo`: a new `ui/src/components/IdentityDetails.jsx` taking props `{ pubkey, npub }`, owning its own `open` state, rendering the trigger button + the popover. It reuses `.bsp-info-btn` (trigger), `.bsp-confirm-overlay/box` (popover), and `.bsp-id-*` (the rows, moved verbatim) and renders a `<CopyButton>` per identifier. `CopyButton` is **extracted** to its own `ui/src/components/CopyButton.jsx` (exported) and imported by `IdentityDetails`.
- **Pros:** matches the page's established self-contained-info-popover pattern exactly (operator's consistency intent); keeps the already-large `BrainstormProfile` from growing; the drawer is a clean unit to grow; removes now-dead `CopyButton` from the page; almost no new CSS (one flex wrapper).
- **Cons:** two new component files + one small refactor (moving `CopyButton`).

#### Option B — inline the trigger + popover state directly in `BrainstormProfile`
Add `useState` for open + the trigger/overlay JSX inline in the page.
- **Pros:** one fewer file.
- **Cons:** bloats a 438-line component; diverges from the VerificationInfo/ReputationInfo pattern the operator explicitly wants to match; harder to grow; the open/close state pollutes the page. Rejected.

#### Option C — a generic reusable `<Popover>`/drawer primitive, with `IdentityDetails` as one consumer
- **Pros:** would serve future drawers and the Story-B reorg.
- **Cons:** over-engineering for one drawer; no such primitive exists today and introducing an abstraction now pre-commits a shape before the second use case is known. Rejected — revisit only if more drawers appear (note for Story B).

### Trigger placement / "float right"
- **Chosen:** wrap the `<h1 className="bsp-name">` and the `IdentityDetails` trigger in a new flex `.bsp-name-row`; the reused `.bsp-info-btn { margin-left:auto }` floats the trigger to the right edge of the name line — identical mechanism to the `ⓘ` icons in `.bsp-counts` / the Reputation `<h3>`.
- **Alternative:** make the trigger a direct child of `.bsp-header` (far-right card edge, vertically centered with the avatar). Rejected — detaches the control from the name line; "to the right of the **name**" reads better on the name's own row, and it survives header wrapping on mobile.

### Trigger glyph (neutral, not a key, not `ⓘ`)
- **Chosen:** horizontal ellipsis **`⋯`** (U+22EF) — the canonical "more / details" affordance, neutral, and signals "this will hold more" (the drawer is designed to grow). Distinct from the `ⓘ` ("explain this concept") already on the page.
- **Alternative:** a chevron (`▾`/`⌄`) — implies expand/collapse of an inline region, mildly misleading for a modal popover. Available as a low-cost flip; the final glyph is the operator's call and the sentinel will pin whatever we choose.

### CopyButton
- **Chosen:** extract `CopyButton` to `ui/src/components/CopyButton.jsx` (behavior unchanged, verbatim), import in `IdentityDetails`. Removes dead code from the page and makes it reusable for future drawer fields.
- **Alternative:** co-locate `CopyButton` inside `IdentityDetails.jsx`. Acceptable and slightly smaller, but less reusable as the drawer grows. Either satisfies the story; chosen the shared file for reuse + dead-code removal.

## Decision

We chose **Option A**: a new self-contained `IdentityDetails` component (props `{ pubkey, npub }`) that reuses the ADR-0032 `.bsp-info-btn` / `.bsp-confirm-*` popover pattern and the `.bsp-id-*` rows, with `CopyButton` extracted to its own shared component. The trigger is a neutral `⋯` glyph floated right via a new `.bsp-name-row` flex wrapper next to `<h1 className="bsp-name">`. The Identity section is made conditional on `profile?.website || profile?.lud16` so it never renders as an empty shell. No backend, data, concept, or firmware change.

This **does not conflict with or supersede** any existing ADR: it reuses ADR 0032's popover pattern, preserves ADR 0030's website-link behavior untouched, and the Identity heading/website/lightning are governed by no ADR. It is the approved sibling of the deferred profile IA reorg ("Story B", `docs/PROFILE_IA_REVIEW_2026-06-16.md`); the "Identity"→"Links" relabel and any further drawer fields are explicitly Story B / out of scope here.

## Consequences

- **Declutters the default profile view** while keeping the identifiers one tap away, in a control that can grow (future fields render as more rows in the same popover).
- **One small refactor:** `CopyButton` moves to its own file; the page drops its local copy. Behavior is byte-for-byte the same (`📋`→`✓`, 1.5s).
- **Almost no new CSS:** one rule (`.bsp-name-row`, layout-only, no colors/tokens). Trigger, popover, and rows reuse existing classes — honors tokens-only / no-new-tooling.
- **Keyboard-dismissal parity, not improvement:** the popover matches the existing info popovers exactly (overlay-click + "Got it"; no Esc/focus-trap). The existing popovers lack those too; adding them here would diverge and is out of scope (a future a11y pass could cover all `.bsp-confirm-*` popovers at once).
- **Testing (for the Tester):** source-regex sentinels in the established style — e.g. `IdentityDetails.jsx` exists and renders a `.bsp-info-btn` trigger bearing the `⋯` glyph + an `aria-label`, opens a `.bsp-confirm-overlay`/`.bsp-confirm-box`, and renders a `CopyButton` for both `pubkey` and `npub`; `BrainstormProfile.jsx` renders `<IdentityDetails …/>` inside `.bsp-name-row` next to `.bsp-name`, **no longer** renders `<CopyButton value={pubkey/npub}/>` in its body, and gates the Identity `.bsp-section` on `website || lud16`; `CopyButton.jsx` exists and is imported by `IdentityDetails`. No new test harness.
- **Firmware reinstall?** No.
- **Follow-ups:** if Story B proceeds, the "Identity"→"Links" relabel and additional drawer fields build on this; if a *second* drawer appears elsewhere, reconsider Option C (a shared popover primitive).

## Implementation notes

Concrete, for the Implementer:

- **`ui/src/components/CopyButton.jsx` (new).** Move the `CopyButton` function from `BrainstormProfile.jsx:59-75` here verbatim; `export default`. No behavior change.
- **`ui/src/components/IdentityDetails.jsx` (new).** Self-contained, props `{ pubkey, npub }`. Structure mirrors `VerificationInfo.jsx`:
  - Trigger: `<button type="button" className="bsp-info-btn" aria-label="Show account identifiers" title="Show account identifiers" onClick={() => setOpen(true)}>⋯</button>` (final glyph/label wording tunable; sentinel pins it).
  - Popover (when `open`): `.bsp-confirm-overlay` (onClick close) › `.bsp-confirm-box` (onClick `stopPropagation`) with a `.bsp-confirm-title` (e.g. `Identifiers`), then a `.bsp-id-grid` reproducing the two rows moved from the page — Pubkey hex (`.bsp-id-label` "Pubkey (hex)" + `.bsp-id-value` showing the truncated form `pubkey.slice(0,12)+'…'+pubkey.slice(-8)` + `<CopyButton value={pubkey}/>`) and, guarded by `{npub && …}`, npub (`.bsp-id-value` `npub.slice(0,20)+'…'+npub.slice(-8)` + `<CopyButton value={npub}/>`) — and a `.bsp-confirm-buttons` with a `.bsp-confirm-ok` "Got it". Truncation is inline here (don't import `shortPubkey`; it stays in the page for `:122`). `CopyButton` receives the **full** value.
- **`ui/src/pages/BrainstormProfile.jsx`:**
  - Delete the local `CopyButton` (`:59-75`); add `import CopyButton from '../components/CopyButton';` only if still needed (it is **not** after this change — leave it out) and `import IdentityDetails from '../components/IdentityDetails';`.
  - Header (`:249-253`): wrap the name in a row — `<div className="bsp-name-row"><h1 className="bsp-name">{displayName}</h1><IdentityDetails pubkey={pubkey} npub={npub} /></div>` — leaving `nip05`/`age` siblings below as today.
  - Identity section (`:334-365`): remove the Pubkey hex row (`:338-342`) and the npub row (`:343-349`); wrap the whole `.bsp-section` so it renders only when `profile?.website || profile?.lud16`. Keep the `<h3>Identity</h3>` heading (relabel is Story B). Website (`:350-357`) and Lightning (`:358-363`) rows unchanged.
- **`ui/src/styles.css`:** add one layout rule near the header block (≈`:3382`): `.bsp-name-row { display: flex; align-items: center; gap: 0.5rem; }`. No new color tokens. (`.bsp-info-btn`'s existing `margin-left:auto` does the float.)

## Out of scope

- The Story-B profile IA reorg (Verification-Score headline, Reputation promotion/disclosure, grid de-dup, Reporters-card removal) — `docs/PROFILE_IA_REVIEW_2026-06-16.md`.
- Renaming/relocating the Identity heading ("Identity"→"Links", Story B); adding any drawer field beyond npub + pubkey.
- Esc/focus-trap keyboard handling for `.bsp-confirm-*` popovers (a separate a11y pass, if any).
- Any change to value derivation, the website-link scheme (ADR 0030), or other surfaces.
