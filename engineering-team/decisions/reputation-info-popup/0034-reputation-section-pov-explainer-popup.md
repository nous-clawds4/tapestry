# ADR 0034: Reputation-section point-of-view explainer popup

**Status:** Accepted
**Date:** 2026-06-14
**Story:** `engineering-team/stories/reputation-info-popup/1-reputation-section-pov-explainer-popup.md`
**Epic:** `reputation-info-popup`

## Context

On a public profile page (`ui/src/pages/BrainstormProfile.jsx`) the **Reputation** section
(`<h3>Reputation</h3>` at `:368`, inside a `.bsp-section`) renders the trust-metric grid
(`TRUST_METRICS` mapped over `trustScores`, `:381–397`). Those scores come from the Meilisearch
document — the `wot_*_<suffix>` fields selected by the `?pov=` query param (resolved at
`:84` and `:149–158`). Per **ADR 0033 §27 (PoV Resolution)** these Meili-sourced scores are
genuinely the **House** PoV (the instance default, `delegatedPubkey` suffix) or the viewer's
**Personalized** PoV (the viewer's own suffix when a `pov` is selected) — the only two surfaces
that legitimately carry House/Personalized labels. Today nothing on the page tells a reader where
these numbers come from or that they shift with the selected PoV.

The page already has this exact affordance: a circled "i" (ⓘ) control that opens a short
dismissible popup. It is the shared **`VerificationInfo`** component
(`ui/src/components/VerificationInfo.jsx` + `ui/src/hooks/useVerificationInfo.js`), introduced by
**ADR 0032**, built on the generic `bsp-info-btn` / `bsp-confirm-overlay` / `bsp-confirm-box`
CSS patterns, and already rendered inside the `.bsp-counts` row at `BrainstormProfile.jsx:287`
(and on `/reporters` at `BrainstormReporters.jsx`). This story gives the **Reputation** heading
the same kind of explainer.

### Acceptance criteria (quoted from the story)

- [ ] Given a public profile page, when it renders, then the "Reputation" section heading shows a circled "i" (ⓘ) informational control, visually and behaviorally consistent with the existing "Verified" info control on that page.
- [ ] Given the profile page is rendered, when the viewer activates the Reputation ⓘ control, then a dismissible popup opens.
- [ ] Given the Reputation popup is open, when the viewer activates its acknowledgement button, then the popup closes; and when the viewer dismisses the surrounding overlay, then the popup also closes — matching the existing info-popup dismissal pattern.
- [ ] Given the Reputation popup is open, then its text explains in plain language that the reputation scores shown in that section reflect a Web-of-Trust point of view, and that this is either the House point of view (the instance's default) or the viewer's Personalized point of view depending on which is currently selected. The explanation is general; it does not name which point of view is active at the moment.
- [ ] Given the Reputation popup is open, then its text is bounded to the Reputation-section scores and makes no claim about the Following / Verified Followers / Verified Reporters counts shown elsewhere on the page.
- [ ] Given the new control and popup, then with them removed the profile page behaves exactly as before: how the reputation scores are computed, fetched, namespaced by point of view, and which scores display are all unchanged.

### Concept orientation (Concept Graph API, port 7778)

Three-call orientation done before reading source. Both concepts the story names are modeled and
unchanged by this work:

- `39998:…:web-of-trust` — "A Web of Trust (WoT) is a decentralized reputation system where
  trust propagates through human relationships… each user sees a personalized view of the network
  weighted by the people they trust." This is the House-vs-Personalized distinction in plain terms,
  and it is the phrase the popup paraphrases.
- `39998:…:graperank` — "a contextual Web of Trust scoring algorithm… computes personalized trust
  scores." The algorithm behind the Reputation-grid numbers.

Confirmed against `/api/concept-graph/summaries` (34 nodes): there is **no** `point-of-view`,
`house`, `personalized`, or `reputation` node. "House PoV" and "Personalized PoV" are product/UI
notions, not graph concepts. **No concept definition is added or changed**, so no firmware
reinstall is required.

### Constraints

- Additive, presentational, **frontend-only**. No backend/API change.
- The Reputation data path (Meili document fetch + `TRUST_METRICS` grid) stays untouched —
  this is the regression boundary that keeps the change clear of the open profile-followers
  follow-ups in the same file.
- The popup is a **static** House-vs-Personalized explanation; it does **not** dynamically name
  the active PoV (that would require promoting the resolved `povSuffix` from the fetch effect into
  render state — explicitly out of scope).
- JS-without-build; reuse existing CSS tokens/classes; **no new dependencies, lint, typecheck, or
  build tooling.**
- The exact user-facing **wording** is delegated to the Director/operator (see book). This ADR
  fixes the content *requirements*, not the verbatim string.

## Options considered

The interaction pattern, dismissal model, and CSS are settled — clone the established
`bsp-info-btn` / `bsp-confirm-overlay` / `bsp-confirm-box` popup that `VerificationInfo` already
uses. The genuine architectural decision is **how to obtain a second, differently-worded popup**,
given that `VerificationInfo` is hardcoded to the verification copy and to `useVerificationInfo`
(which fetches `/api/owner-info` for the owner identity + cutoff — data this feature does not need).

### Option A — New sibling presentational component `ReputationInfo.jsx` *(chosen)*

Add `ui/src/components/ReputationInfo.jsx`: a self-contained ⓘ button + popup that clones
`VerificationInfo`'s structure (same `useState(open)`, same `bsp-info-btn` trigger, same
`bsp-confirm-overlay` overlay-click-to-close + `bsp-confirm-box` + `bsp-confirm-ok` "Got it"
button) but with **static** Reputation/PoV copy and **no data hook** — the explanation is general,
so it needs no `owner-info`/`profiles` fetch. Render it inside the `<h3>Reputation</h3>` heading
in `BrainstormProfile.jsx:368`.

- **Pros:** Strict separation of concerns — the two popups say different things and the Reputation
  one fetches nothing, so coupling them buys nothing. The component is presentational and
  prop-free, so the established **source-regex sentinel** test idiom (T4 in
  `test/profile-verified-counts-explainer-and-alarm.test.js`) applies almost verbatim. Zero risk
  to the verification popover, `/reporters`, or `useVerificationInfo`. No new fetch, no new
  endpoint, no new CSS (heading is already a flexbox — see Implementation notes).
- **Cons:** A second small component that mirrors `VerificationInfo`'s ~30-line skeleton — mild
  structural duplication of the open/close/overlay boilerplate (no shared abstraction extracted).

### Option B — Generalize `VerificationInfo` into a parameterized `InfoPopover` and configure two instances

Refactor `VerificationInfo` into a generic `InfoPopover({ label, title, children })` (the trigger +
overlay + box + "Got it" boilerplate), then compose two thin wrappers: the existing verification
content (still consuming `useVerificationInfo`) and the new reputation content (static). One shared
dismissal/overlay implementation.

- **Pros:** DRY — a single popup primitive; future explainers compose trivially; the open/close
  boilerplate lives in exactly one place.
- **Cons:** **Touches shipped, tested code** (`VerificationInfo.jsx` and, transitively, its
  consumers on the profile *and* `/reporters`) to add an *additive* feature — it widens the diff
  and the blast radius beyond the regression boundary the book draws, risks regressing ADR 0032's
  verification popover and its sentinels (T4–T7), and turns a one-file additive change into a
  cross-file refactor. The book's autonomy run is explicitly scoped to a low-risk additive change;
  a refactor of shipped components is the opposite of that. The duplication avoided is ~15 lines of
  trivial boilerplate. **Rejected** — the right time to extract `InfoPopover` is when a *third*
  explainer appears, as a deliberate refactor story, not riding on this one.

### Option C — Reuse `VerificationInfo` as-is with a `variant`/`mode` prop

Add a prop to `VerificationInfo` that switches its title/body/data-source between "verification"
and "reputation".

- **Pros:** No new component file.
- **Cons:** Conflates two unrelated explainers in one component; the reputation branch must
  suppress the owner-identity fetch and avatar render, so the component grows conditional dead
  weight for each mode; same shipped-code-edit blast radius as Option B without its DRY payoff; the
  component name (`VerificationInfo`) would no longer describe what it does. **Rejected.**

## Decision

We chose **Option A** — a new, self-contained, prop-free `ui/src/components/ReputationInfo.jsx`
that clones the `VerificationInfo` popup pattern with static Reputation/PoV copy and no data hook,
rendered inside the existing `<h3>Reputation</h3>` heading. It satisfies every AC, keeps the change
purely additive and frontend-only, leaves the Reputation data path and the shipped verification
popover untouched (honoring the book's regression boundary and ADR 0032), needs no new CSS/fetch/
endpoint/dependency, and is testable with the established source-sentinel idiom. We trade away the
DRY of a shared popup primitive (Option B) — a deliberate deferral: extracting `InfoPopover` is a
separate refactor story worth doing only once a third explainer exists.

## Consequences

- **Enables:** the Reputation scores become self-describing — a reader learns the numbers reflect
  a Web-of-Trust PoV (House default or Personalized) that tracks the selected PoV, behaviorally
  identical to the verification ⓘ they already know.
- **Constrains / debt:** two near-identical popup skeletons (`VerificationInfo` +
  `ReputationInfo`) now coexist. If a third explainer is added, extract a shared `InfoPopover`
  primitive then (tracked as a future refactor, not this story).
- **Consistency with ADR 0033 (PoV Resolution §27):** the popup's *boundary* is not optional
  polish — it is required by the naming correction. The Reputation grid (Meili `wot_*_<suffix>`)
  is legitimately **House/Personalized**; the Following/Verified Followers/Verified Reporters
  counts above it are **Owner** PoV (Neo4j), which §27 explicitly says must **not** be labeled
  "House." So the copy must name House/Personalized *only* for the Reputation scores and make no
  PoV claim about the top-of-page counts. (Note for the Tester: the older
  `profile-verified-counts-owner-pov` sentinel asserts the page contains no `House (default)`
  string near those counts; the new popup keeps that true because its House/Personalized wording
  lives in `ReputationInfo`, scoped to the Reputation section, and never references the counts.)
- **Consistency with ADR 0032:** additive only — `VerificationInfo.jsx`, `useVerificationInfo.js`,
  `/api/owner-info`, and `BrainstormReporters.jsx` are **not** modified. ADR 0032's verification
  popover and its T4–T7 sentinels remain valid.
- **No ADR is superseded.** This ADR is consistent with ADR 0032 (clones its pattern, doesn't
  touch it) and ADR 0033 (respects the House/Personalized vs Owner naming boundary).
- **Firmware reinstall required?** **No** — no concept definition is added or changed.

## Implementation notes

Concrete, for the Implementer. Three files; all under `ui/src/`.

- **File: `ui/src/components/ReputationInfo.jsx` (new).** A default-exported, **prop-free**,
  **hook-free** function component cloning `VerificationInfo.jsx`'s structure:
  - `const [open, setOpen] = useState(false);`
  - Trigger: `<button type="button" className="bsp-info-btn" aria-label={…} title={…} onClick={() => setOpen(true)}>ⓘ</button>` — the `aria-label`/`title` should name the Reputation explainer (e.g. `Where do these reputation scores come from?`).
  - When `open`: `<div className="bsp-confirm-overlay" onClick={() => setOpen(false)}>` wrapping `<div className="bsp-confirm-box bsp-follows-info" onClick={e => e.stopPropagation()}>` — overlay click closes, inner click does not (matches `VerificationInfo`).
  - Inside the box: `<h3 className="bsp-confirm-title">…</h3>`, `<p className="bsp-confirm-message">…</p>`, and `<div className="bsp-confirm-buttons"><button className="bsp-confirm-ok" onClick={() => setOpen(false)}>Got it</button></div>`.
  - **No `useVerificationInfo` / no fetch** — the copy is static, so the component imports only `React, { useState }`. (Drop the owner-avatar block entirely; it is verification-specific.)
  - **Copy requirements (verbatim string owned by the Director — do NOT hardcode wording choices here beyond satisfying these):**
    - MUST convey that the reputation scores shown in *this section* reflect a **Web-of-Trust** point of view.
    - MUST convey that this is **either the House point of view (the instance's default) or the viewer's Personalized point of view, depending on which is currently selected** — general, not naming the active one.
    - MUST be bounded to the Reputation-section scores; MUST make **no** claim about the Following / Verified Followers / Verified Reporters counts (per ADR 0033, those are Owner-PoV, not House).
    - SHOULD reuse the verification popover's plain register so the two read as siblings.
- **File: `ui/src/pages/BrainstormProfile.jsx`.**
  - Add the import beside the existing one (`:12` has `import VerificationInfo from '../components/VerificationInfo';`): `import ReputationInfo from '../components/ReputationInfo';`.
  - Render the control **inside** the heading at `:368`: change `<h3>Reputation</h3>` to put the word and the `<ReputationInfo />` in the same `<h3>`. The `.bsp-section h3` rule (`styles.css:3422`) is already `display: flex; align-items: center; gap: 0.5rem`, so the ⓘ sits beside the word with the correct gap **without any new CSS** — e.g. `<h3>Reputation<ReputationInfo /></h3>` (or wrap the word in a `<span>` for clarity; either renders identically under the flex+gap rule).
  - **Watch-out (do not regress):** `.bsp-info-btn` carries `margin-left: auto` (`styles.css:4180`), which inside the `.bsp-counts` row pushes the verification ⓘ to the far right. Inside the `<h3>` flex container that same `margin-left: auto` will push the Reputation ⓘ to the **right edge of the heading row**. If the desired placement is immediately after the word "Reputation" (snug, not right-aligned), the Implementer needs a minimal CSS override — a single scoping class on the box/button (e.g. `.bsp-section h3 .bsp-info-btn { margin-left: 0; }`) added to `styles.css` reusing existing tokens. Right-aligned-in-heading is also acceptable if the Director prefers it; **decide placement and add at most that one-line CSS rule — no new tokens, no new layout system.** Either way the *button styling* (size, border, hover) is unchanged.
  - Touch **nothing** in the Reputation data path: `trustScores`, `trustLoading`, `trustError`, `TRUST_METRICS`, the Meili fetch, and the `?pov=` resolution stay exactly as-is.
- **File: `ui/src/styles.css`** — only if the snug-placement override above is chosen: add the single `.bsp-section h3 .bsp-info-btn { margin-left: 0; }` rule. Otherwise no CSS change.
- **No other files.** No change to `src/api/**`, no new endpoint, no change to `VerificationInfo.jsx` / `useVerificationInfo.js` / `BrainstormReporters.jsx`, no new hook.

### Testing direction (for the Tester, not decided here)

The profile UI is tested via the `test/test.js` Node runner with **source-regex sentinels**
(precedent: `test/profile-verified-counts-explainer-and-alarm.test.js`), **not** Playwright. A new
sentinel file should assert: `ReputationInfo.jsx` exists and uses the `bsp-info-btn` /
`bsp-confirm-overlay` / `bsp-confirm-box` / `bsp-confirm-ok` pattern; its copy contains the
House/Personalized + Web-of-Trust phrasing and the overlay/“Got it” dismissal; `BrainstormProfile`
imports and renders `ReputationInfo` in the Reputation heading; and regression sentinels that the
Reputation data path (`TRUST_METRICS`, the Meili fetch) and the verification popover are unchanged.
False-positive note: `point of view` already appears in `VerificationInfo.jsx`, so reputation
sentinels must anchor on the **new file** and on the House/Personalized wording, which do not exist
pre-implementation.

## Out of scope

- The verbatim popup wording (Director/operator-owned, within the copy requirements above).
- Dynamically naming the active PoV in the popup (the dynamic variant); promoting `povSuffix` to
  component state.
- Any change to how reputation scores are computed, fetched, namespaced by PoV, or which scores
  display; any change to `TRUST_METRICS` or the follows/followers tables.
- Extracting a shared `InfoPopover` primitive (deferred to a future refactor story, triggered by a
  third explainer).
- Any backend/API change; adding the popup to any page other than the public profile.
- The open profile-followers follow-ups on the same file (duplicate Verified Followers row;
  Personalized PoV for the follows/followers tables).
