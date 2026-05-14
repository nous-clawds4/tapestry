# Story 6: Brainstorm Communities UI scaffold (Slice 0)

**Status:** Approved
**Created:** 2026-05-14
**Type:** Feature

## Background

`feat/communities` is a long-lived sandbox branch deploying to `communities.brainstorm.world` (droplet + CI/CD per OPERATIONS.md §1, to be provisioned by the repo owner). The full Brainstorm Communities feature — leaderless self-curating membership groups, per [`PLAN.md`](../../PLAN.md) — is too big for one story, and has been sliced into seven phases. This story covers **Slice 0**: stand up the user-visible scaffold against mock data, so that subsequent slices can plug real protocol behavior into a surface that already exists, the brand identity is locked in, and the deploy chain can be validated end-to-end before any real user data hits the system.

There are two competing pressures the scaffold has to navigate:

1. **PLAN.md's v1 UX scope** (§6 Q5) specifies four user journeys — Discover, Join/curate, Found, Participate — plus the "your view" personal-projection framing (§3) that is the conceptually trickiest UX point in the product. The scaffold has to demonstrate every journey is reachable, even if the data backing them is mocked.

2. **The handoff prototype is a wireframe, not a visual target.** The user has been explicit that *"the look and feel of the UI needs to be top notch and modern — not a whiff of vibe coded app should be in there."* The prototype's inline-style soup, generic lavender accent, placeholder "B" tile in the header, and ad-hoc spacing are the bar to clear, not the bar to hit. The locked Brainstorm brand palette (royal `#662d91`, magenta `#ba20ba`, marigold `#fbb03b`) and the bundled MuseoModerno wordmark replace the prototype's generic theming.

Slice 0 also makes the personal-projection pattern legible at the surface level — every "your view" framing the user encounters comes from the wording and chrome decisions made in this slice, not from any backend behavior — so getting it right here pays compounding interest across slices 3–6.

## User-facing description

**As a first-time visitor to `communities.brainstorm.world`**, I want to land on a polished, on-brand site that lets me discover circles, open a circle's detail page, see the people in it, browse my (mocked) joined circles, walk through a create-a-circle wizard, and open a member's drawer, **so that** I can experience the shape of Brainstorm Communities end-to-end before any single feature is wired to real nostr events, and **so that** I can tell from the first second this is a real, considered product — not a vibe-coded prototype.

**As an operator (David / the team)**, I want a push to `feat/communities` to deploy the scaffold to `communities.brainstorm.world` via the same CI/CD pattern the other long-lived sandbox branches use, **so that** subsequent slices can ship incrementally without each one re-litigating deploy infrastructure, and **so that** the deploy chain itself is verified working before real protocol features depend on it.

## Acceptance criteria

Testable from the outside. Each criterion is observable in a browser or in CI logs without inspecting source.

### Identity & brand
- [ ] On any page, the header shows the real Brainstorm mark (cloud + lightning-bolt SVG sourced from the brand kit) at the brand royal-purple `#662d91`, paired with a "Communities" sub-brand label set in MuseoModerno. **No placeholder "B" tile.** The mark color shifts to the magenta accent `#ba20ba` on hover/active, matching the brand kit's two-tone purple system.
- [ ] The page background, surfaces, borders, and accents resolve to the locked brand palette declared in `project_communities_brand.md` user memory. No `#a855f7` (prototype lavender), no Ember/Moss/generic-neon variables remain in the shipped CSS.
- [ ] Display headings render in **MuseoModerno** (loaded from the brand kit's variable font files, bundled with the app — not via Google Fonts CDN). Body text renders in DM Sans. Both fonts have a `font-display: swap` fallback so a missing font never produces a flash of unstyled or zero-height text.
- [ ] The prototype's `tweaks-panel` (theme switcher + "Signed in" toggle) is **not** present in any production build. (It may live behind a dev-only build flag, but no end-user-visible chrome exposes theme switching.)

### Routes & journeys (all backed by mock data parity with the handoff)
- [ ] `/` renders the Discover screen with a hero, search input, scrollable topic-pill filter row, and a responsive grid of community cards. Cards filter live by free-text search (matching name / description / topic label) and by selected topic pill, identical to the handoff's filter logic.
- [ ] `/community/:slug` renders a Community Detail screen with banner, header (name, description, topic pills, stats), a tabbed body switching between **People**, **Conversation**, and **How this works**, and — for "signed in & joined" mock state — a "Your view" / "Leave" action pair instead of a Join CTA. The People tab lists members with a trust indicator and a Vouch action; the Conversation tab shows mock kind-1-style posts; the How-this-works tab explains the membership model in plain language.
- [ ] `/my-circles` renders the user's (mocked) joined circles as a grid identical to Discover's, plus a "Start a circle" CTA leading to `/create`.
- [ ] `/create` renders a five-step wizard with the labels **Name → Similar circles → Topics → Founding voices → Review**, with Back / Continue navigation and validation that disables Continue when the current step is incomplete (e.g. empty name on step 1, zero seeds on step 4).
- [ ] `/edit/:slug` renders an Edit screen that foregrounds the personal-projection framing: at minimum a visible callout reading **"Your view of this circle. These settings are personal to you. Other members have their own view — edits here don't change theirs."** Form fields are labelled `(your view)`. Save and Cancel both navigate back to the corresponding `/community/:slug`.
- [ ] Clicking any member row anywhere in the app opens a right-side slide-in drawer showing the member's name, avatar, trust visualization, mock voucher list, and Vouch + Raise-a-concern actions. The drawer dismisses on overlay click and on close button. Drawer state survives navigation within the SPA (no full-page reload when opening).

### Sibling identity & navigation (PLAN §6 Q6)
- [ ] The header carries a discoverable cross-product link to `https://brainstorm.world` ("Brainstorm Search") that opens in a new tab. On mobile widths the link condenses but does not vanish.
- [ ] When a route doesn't exist (e.g. `/community/does-not-exist` or `/some-bogus-path`), the app renders a styled Not Found surface — not a blank page, not a stack trace — with a CTA back to Discover.

### Mock-data hygiene & v1-locked decisions
- [ ] Card and detail surfaces **do not display** any "Independent hosts" / mirror count stat (Q5.3 deferral to v1.1, per locked decisions). The `mirrors` field remains in the mock dataset so future slices can re-enable the stat without backfilling data.
- [ ] The vocabulary translation glossary is honored consistently in user-visible copy: the action label is **"Vouch"** (not "Endorse"); the destructive-leaning action is **"Raise a concern"** (not "Veto"); seed members are referred to as **"Founding voices"** in the create flow; the trust-aggregate label is **"Trusted here"**.
- [ ] No screen displays the strings "lorem", "TODO", "FIXME", or the prototype's `EDITMODE-BEGIN` / `EDITMODE-END` markers in the shipped output.

### Visual polish bar (the "not a whiff of vibe coded" criterion)
- [ ] Layouts hold without horizontal scroll, clipped CTAs, or overflowing text at **375 × 812** (iPhone-class small-mobile), **768 × 1024** (tablet), and **1440 × 900** (desktop). Verified by a screenshot artifact at each breakpoint, attached to the PR or saved under `engineering-team/reviews/`.
- [ ] At least the following motion is choreographed (not duration: 0.2s on everything): card grids enter with a staggered fade-in (≤ 50ms per-card stagger, ≤ 400ms total); the member drawer slides in with a cubic-bezier overshoot rather than a linear translate; the create-flow step-progress bar interpolates rather than snapping.
- [ ] No element relies on color alone to convey state. Joined-circle badges include both a glyph (e.g. checkmark) and the success color. Trust dots are accompanied by adjacent text ("Trusted by N people"). Step-progress states are conveyed by both fill and a check glyph at completed steps. (WCAG SC 1.4.1, *Use of Color*.)
- [ ] All visible text passes WCAG 2.1 AA contrast (4.5:1 for body, 3:1 for large display). Specifically, body text on `--bg-card`, accent-color CTA text on `--accent`, and `--text-muted` on `--bg` all hit at least 4.5:1.
- [ ] Inline-style soup from the prototype does **not** ship as-is — styling is consolidated into a real stylesheet, design-token CSS variables, or CSS Modules, such that a developer can change `--accent` in one place and have the entire UI respond.

### Build, deploy, and Express mount
- [ ] `cd ui-communities && <install> && <build>` produces a deployable static bundle without ESLint errors and without console warnings about missing fonts or unresolved imports.
- [ ] Express (the existing brainstorm Node server) serves the built `ui-communities` bundle when the request comes in under the `communities.brainstorm.world` host (or, in dev, under a clearly-mounted path), without breaking the existing `ui/` mount for the brainstorm-search / tapestry-dashboard surfaces. A request to `brainstorm.world/` and to `localhost:8080/tapestry/...` continue to return the existing UIs unchanged.
- [ ] `.github/workflows/deploy-communities.yml` exists, follows the same SSH-action pattern as `deploy-staging.yml` / `deploy-tags.yml` (OPERATIONS.md §3), and uses secret names `DEPLOY_HOST_COMMUNITIES`, `DEPLOY_USER_COMMUNITIES`, `DEPLOY_SSH_KEY_COMMUNITIES`. The workflow triggers on push to `feat/communities` only. The first runs are expected to fail with a missing-secret message until the droplet is provisioned; this is acceptable and the workflow's failure mode must be a clear "secret not configured" log line, not a silent hang.

### Regression
- [ ] `npm run build` in the existing `ui/` continues to succeed with no new errors or warnings introduced by Slice 0.
- [ ] The existing `public/`-based control-panel pages continue to load and function (no asset path collisions introduced by the new mount).

## Concepts touched

This slice does not write or read protocol events — it operates entirely on mock data — so no firmware concept handles are exercised yet. Slice 1 introduces `brainstorm-community` and `brainstorm-community-signal`. The vocabulary glossary the scaffold establishes will map to those handles in later slices.

## Out of scope

- **NIP-07 sign-in.** The "Sign in" button is a no-op visual placeholder in Slice 0; real signer wiring lands with Slice 4.
- **Any real backend API call.** No `fetch('/api/communities')`, no Neo4j queries, no strfry subscriptions. Slice 0 reads exclusively from the in-repo mock dataset.
- **Server-side GR-Community scoring.** Trust dots / "trusted here" counts come from the mock dataset, not from a computed score. Slice 2 introduces the real scoring API.
- **Firmware activation.** `firmware/active` continues to point at v1.0.0; the v1.1.0 skeleton stays staged. Slice 1 handles activation.
- **Publishing community records or endorsements.** No event ever leaves the browser in Slice 0. The Join, Vouch, and Raise-a-concern buttons toggle local state and nothing else.
- **Kind-1 reading or writing.** The Conversation tab reads from mock posts; the "Share something..." composer is a non-functional visual placeholder.
- **Mirror tooling / "independent hosts" stat.** Locked-decision deferral to v1.1; the data field stays in the mock dataset but is not surfaced.
- **NIP-72 wrapping UX.** Optional `a` tag on community records — no v1 UX surface.
- **Provisioning the DigitalOcean droplet and CI/CD secrets.** The workflow file ships ready-to-deploy; David provisions the droplet + secrets on his timeline. Slice 0 does **not** block on the droplet existing.
- **Search-engine indexing / OpenGraph / favicon polish.** Functional `<title>` and a placeholder favicon are sufficient. Marketing-grade SEO is a later concern.
- **Cross-product navigation beyond a header link.** Q6 specifies a header link in both directions, not a unified switcher. The reciprocal link from `brainstorm.world` back to `communities.brainstorm.world` is a separate change in the existing `ui/` and out of scope here.

## Open questions

Resolved before story approval:

- **Theme direction:** Neon, grounded in real brand purple. No runtime theme switcher. Confirmed.
- **Mirror count display in v1:** hidden entirely. Confirmed.
- **Code placement:** new parallel `ui-communities/` Vite app, sibling to existing `ui/`. Confirmed. (Specific tech choices — Vite version, React version, router choice — are the Architect's call in Phase 2; the PO scope only locks "a parallel app, not nested under `ui/`.")
- **First-time-visitor default trust root:** brainstorm.world's TA pubkey, discovered at runtime per AGENTS.md §1 with an env-var fallback. Confirmed. Slice 0 does not exercise this; Slice 3 does.
- **MuseoModerno licensing:** bundled in the brand kit at `design-handoff/Brainstorm Logo/Typographies/Principal/` as variable fonts. Confirmed self-hostable; no CDN dependency required.

## Linked artifacts

- ADR: [`engineering-team/decisions/0004-ui-communities-scaffold.md`](../decisions/0004-ui-communities-scaffold.md)
- Test plan: `engineering-team/stories/6-communities-ui-scaffold.test-plan.md` (filled in by Tester)
- Review: `engineering-team/reviews/6-communities-ui-scaffold.md` (filled in by Reviewer)
