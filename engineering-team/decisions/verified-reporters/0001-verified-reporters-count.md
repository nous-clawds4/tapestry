# ADR 0001: Verified Reporters count on the profile

**Status:** Accepted
**Date:** 2026-06-07
**Story:** `engineering-team/stories/verified-reporters/1-verified-reporters-count.md`
**Epic:** `verified-reporters`

## Context

Story 1 elevates the existing per-point-of-view verified-reporter count into a clickable, negative-signal count in the profile counts row, parallel to Following and Verified Followers, linking to `/user/:pubkey/reporters`.

Acceptance criteria (quoted to confirm):
1. A count labelled "Verified Reporters" appears in the counts row alongside Following and Verified Followers, computed under the viewer's effective point of view.
2. When `> 0`, the value reads as a negative signal and the whole count links to `/user/:pubkey/reporters`.
3. When exactly `0`, the value is neutral and is not a link.
4. When unavailable / not computed, a placeholder ("—") is shown, not a link, distinct from a real zero.
5. When loading, a dimmed/placeholder value is shown (no bare spinner).
6. The count's accessible name states the number and that it opens the list.

**What already exists (verified on `feat/verified-reporters`, off `staging`):**
- `ui/src/pages/BrainstormProfile.jsx:236-248` — the `.bsp-counts` row already renders **Following** and **Verified Followers** as `.bsp-count.bsp-count-link` entries. Verified Followers links to `/user/:pubkey/followers` and its value rides `trustScores?.verifiedFollowerCount ?? trustScores?.followers`. **This resolves PRD §11 decision 1: Verified Reporters is a third count-link in this row.**
- `BrainstormProfile.jsx:121-189` — a `useEffect` resolves the point of view (`?pov=` param, else the house `delegatedPubkey` prefix) and loads `/api/search/profiles/meili/document/:pubkey`, stripping `wot_` and the PoV suffix into a `trustScores` map. `verifiedReporterCount` is already one of those keys (it is in `TRUST_METRICS` at line 45 and renders today as a 🚩 "Reporters" trust card in the Reputation grid).
- `BrainstormProfile.jsx:97` — `fmtCount(n)` returns `—` for `null`/`undefined`, else a localized number.
- `ui/src/styles.css` — `--red: #f85149` (line 18); `.bsp-count-value` (3398, weight 600); `.bsp-counts-loading .bsp-count-value { opacity: .4 }` (3405); `.bsp-count-link` + hover underline (4150-4151).
- Tests are **Playwright e2e** (`tests/brainstorm/profile-verified-followers-count.spec.js` is the direct precedent), selected by user-facing vocabulary, run against the Vite-built UI (`npm run build` in `ui/`).

**Constraints:** JS-without-build (no new lint/typecheck). Design tokens only — no hex/px literals in components (use `--red`). Copy must come verbatim from `product-team/guides/verified-reporters-style-guide.md`. No concept-graph or schema change → **no firmware reinstall**.

**No concept changes.** This story displays an existing data field. The concepts it relates to (`nostr-user`, `web-of-trust`, `graperank`; NIP-56 report = `nostr-event` kind 1984) are unchanged; the count value is read from the already-published Meili document, not computed here.

## Options considered

### Option A — Inline conditional count-link in `.bsp-counts`, value from `trustScores.verifiedReporterCount`
Add a third entry to the existing counts row, mirroring the Following/Verified Followers pattern, but with state-dependent rendering (link only when `> 0`). Read the value from the already-fetched, PoV-resolved `trustScores`. Add two small token-based CSS modifiers (negative color; per-count loading dim).

- **Pros:** Mirrors the established pattern in the same file; reuses data already fetched (no new network call, no new PoV resolution); smallest diff; tests slot directly alongside `profile-verified-followers-count.spec.js`; no route work bleeds into this story.
- **Cons:** The reporters count renders differently from its always-link siblings (conditional link/neutral/placeholder), a slight asymmetry in the row.

### Option B — Extract a shared `<ProfileCount>` component for all three counts
Componentize the counts row, encapsulating the state logic and DRYing Following/Verified Followers/Verified Reporters.

- **Pros:** Reusable; isolates the state machine; tidier long-term.
- **Cons:** A refactor that touches the *working* Following and Verified Followers counts — regression risk for no functional gain in this story. The project has no component unit-test harness (tests are Playwright e2e), so the isolation/testability benefit is largely theoretical. Inconsistent with the current inline pattern. Out of proportion to a single-count story.

### Option C — Source the value from a dedicated fetch / `useUserCounts`
Drive the reporters value from `useUserCounts` (the `/api/get-user-counts` hook) or a new endpoint instead of `trustScores`.

- **Cons:** `useUserCounts` is **owner-POV node properties** (its own docstring), not point-of-view-aware. The verified-reporter count is intrinsically per-PoV (namespaced `wot_verifiedReporterCount_<povSuffix>` in the Meili document). Sourcing it from `useUserCounts` would break AC1 (effective PoV) and contradict the whole premise. Reject — and this is precisely why `trustScores` is the correct source.

## Decision

We chose **Option A**. It reuses the exact pattern and the already-PoV-resolved data in `BrainstormProfile.jsx`, keeps the diff minimal and the regression surface near zero, and lands the tests right next to the Verified Followers precedent. Option B's refactor is deferred; Option C is wrong for a per-PoV metric.

**Resolved story-internal tension (AC6 vs AC3):** AC6 ("accessible name states the number *and that it opens the list*") only applies to the actionable `> 0` state, because AC3 makes `0` a non-link. The `> 0` link carries `aria-label="{n} verified reporters. View list."`; the non-link states (`0`, `—`, loading) are self-describing through their visible text (value + "Verified Reporters" label), which a screen reader reads as e.g. "0 Verified Reporters". No "View list" is claimed where nothing opens.

## Consequences

- **Enables** Story 3's entry point and gives the primary persona the at-a-glance negative signal using data that already exists (no added network cost).
- **Constrains:** introduces conditional rendering distinct from the always-link siblings; adds two small CSS modifiers.
- **Deliberate non-change:** the existing `verifiedReporterCount` 🚩 trust card in the Reputation grid stays (Verified Followers already appears in both the count row and a trust card; removing trust cards is a separate cleanup, out of scope here).
- **Known interim state:** the `/user/:pubkey/reporters` link target does not exist until Story 3; the link will 404 until then. Accepted per the story.
- **Follow-ups:** the shared counts-row PoV indicator (deferred Phase 4); optional future componentization of the counts row (Option B).
- **Firmware reinstall required?** No (no concept/schema change).

## Implementation notes

- **File: `ui/src/pages/BrainstormProfile.jsx`** — in the `.bsp-counts` block, after the Verified Followers `<Link>` (~line 247), add the Verified Reporters count. Derive the value where `trustScores` is in scope:
  ```js
  const verifiedReporterCount = trustScores?.verifiedReporterCount ?? null;
  ```
  Render by state (value source `trustScores`, governed by `trustLoading`/`trustError` — NOT `userCountsLoading`):
  - `trustLoading` → non-link `<span className="bsp-count bsp-count-loading">` with value `—`, label `Verified Reporters`.
  - else `trustError || verifiedReporterCount == null` → non-link `<span className="bsp-count">` with value `—` (via `fmtCount(null)`).
  - else `verifiedReporterCount === 0` → non-link `<span className="bsp-count">` with neutral value `0`, label `Verified Reporters`.
  - else (`> 0`) → `<Link to={`/user/${pubkey}/reporters`} className="bsp-count bsp-count-link" aria-label={`${verifiedReporterCount} verified reporters. View list.`}>` with `<span className="bsp-count-value bsp-count-value-negative">{fmtCount(verifiedReporterCount)}</span><span className="bsp-count-label">Verified Reporters</span>`.
- **File: `ui/src/styles.css`** — add next to the existing count styles:
  ```css
  .bsp-count-value-negative { color: var(--red); }
  .bsp-count-loading .bsp-count-value { opacity: 0.4; }
  ```
- **Copy (verbatim from the style guide):** label `Verified Reporters`; link `aria-label` `{n} verified reporters. View list.`.
- **Do NOT** register the `/user/:pubkey/reporters` route or build the page (Story 3). **Do NOT** remove the existing Reporters trust card (out of scope).
- **Build/test seam (for the Tester):** mirror `tests/brainstorm/profile-verified-followers-count.spec.js`. Selectors by vocabulary: link `role=link name=/verified reporters/i`, `href` matching `/\/user\/[0-9a-f]{64}\/reporters$/`, and `not target=_blank`. The count is PoV-dependent, so pin a `?pov=` (or rely on the house fallback) to get deterministic fixtures: a pubkey with `> 0` verified reporters (link + negative color), one with `0` (text "0", no link), one with no scores (`—`). UI must be built (`npm run build` in `ui/`) before the specs run.

## Out of scope
- The `/user/:pubkey/reporters` route and list page (Story 3).
- The membership data behind the list (Story 2).
- Any counts-row point-of-view indicator (deferred Phase 4).
- Removing or restyling the existing trust cards; changing Following or Verified Followers.
