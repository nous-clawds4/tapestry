/**
 * Playwright behavioral check for story #38 / ADR 0034: the profile page shows a
 * "HOPS" counter in the bsp-counts row — the live directed FOLLOWS shortest-path
 * distance from the source (logged-in user, else the instance Owner) to the
 * viewed profile, rendered as a PLAIN (non-link) value with a tooltip.
 * See engineering-team/stories/profile/38-profile-follows-hops.test-plan.md
 *
 * SUPPLEMENTARY + LIVE-DATA DEPENDENT (mirrors the story #33 spec). The
 * deterministic coverage is the node suite test/profile-follows-hops.test.js
 * (no stack dependency). This spec additionally verifies the browser-rendered
 * counter, its placement, and the not-an-anchor behavior that source-regex can
 * only approximate.
 *
 * Preconditions / fragility:
 *   - A reachable Brainstorm instance (BRAINSTORM_BASE_URL or http://localhost:7778)
 *     with the change deployed AND a populated FOLLOWS graph (the local stack is
 *     stale/near-empty per OPEN.md #6 — run this against STAGING).
 *   - Logged-out: the source is the Owner, so the value reflects Owner→profile.
 *   - The rendered value (a number, ∞, or "—") is data/runtime dependent, so this
 *     spec asserts the COUNTER and its NON-LINK / PLACEMENT structure, not a
 *     specific number. The exact value + tooltip wording are a manual/staging check.
 *
 * IMPORTANT — collision: BrainstormProfile.jsx also renders a Reputation trust card
 * labeled "Hops" ("Degrees of separation"). Every locator below is scoped to the
 * `.bsp-counts` row so it targets the NEW counter, not the trust card.
 *
 * Not run pre-implementation (current code has no such counter); exercised at the
 * staging smoke after the feature deploys.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
// Jack Dorsey — a high-profile account expected to be reachable in the FOLLOWS graph.
const PUBKEY = '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2';

test.describe('Story 38 — follows-hops (HOPS) counter on the profile page', () => {
  test('a HOPS counter is shown in the counts row, between Verified Followers and Verified Reporters', async ({ page }) => {
    await page.goto(`${BASE_URL}/user/${PUBKEY}`);

    const counts = page.locator('.bsp-counts');
    await expect(counts).toBeVisible();

    // The HOPS label exists in the counts row (scoped — not the Reputation "Hops" trust card).
    const hopsLabel = counts.locator('.bsp-count-label', { hasText: /^Hops$/i });
    await expect(hopsLabel).toHaveCount(1);

    // Placement: Verified Followers ... Hops ... Verified Reporters (DOM order within the row).
    const labels = await counts.locator('.bsp-count-label').allInnerTexts();
    const norm = labels.map(s => s.trim().toLowerCase());
    const iVF = norm.indexOf('verified followers');
    const iHops = norm.indexOf('hops');
    const iVR = norm.indexOf('verified reporters');
    expect(iVF, 'Verified Followers label present').toBeGreaterThanOrEqual(0);
    expect(iHops, 'Hops label present').toBeGreaterThanOrEqual(0);
    expect(iVR, 'Verified Reporters label present').toBeGreaterThanOrEqual(0);
    expect(iVF < iHops && iHops < iVR,
      `HOPS must sit between Verified Followers and Verified Reporters (order was ${norm.join(', ')})`).toBe(true);
  });

  test('the HOPS counter is a plain element, not a link (the click-through page is deferred)', async ({ page }) => {
    await page.goto(`${BASE_URL}/user/${PUBKEY}`);

    const counts = page.locator('.bsp-counts');
    await expect(counts.locator('.bsp-count-label', { hasText: /^Hops$/i })).toHaveCount(1);

    // AC present-but-not-clickable: no <a> in the counts row links to a follows-hops page,
    // and the HOPS counter is not inside an anchor.
    expect(
      await counts.getByRole('link', { name: /Hops/i }).count(),
      'the HOPS counter must be plain text, not a <Link> (the destination page is deferred)'
    ).toBe(0);
  });

  // The rendered VALUE (number / ∞ / "—") and the exact tooltip text are data- and
  // runtime-dependent (they need a known source→target distance on a populated graph),
  // so they are left as a manual/staging check rather than asserted against a fixed number.
});
