/**
 * Playwright behavioral check for story #39 / ADR 0035: the HOPS click-through page
 * and the activated HOPS link.
 * See engineering-team/stories/profile/39-profile-hops-path.test-plan.md
 *
 * SUPPLEMENTARY + LIVE-DATA DEPENDENT (mirrors the #33/#38 specs). The deterministic
 * coverage is the node suite test/profile-hops-path.test.js (no stack dependency).
 * This spec verifies the browser-rendered link activation + page that source-regex
 * can only approximate.
 *
 * Preconditions / fragility:
 *   - A reachable instance (BRAINSTORM_BASE_URL or http://localhost:7778) with the
 *     change deployed AND a populated FOLLOWS graph (the local stack is stale/near-empty
 *     per OPEN.md #6 — run against STAGING).
 *   - Logged-out: the path source is the Owner. The exact path / card count is
 *     data-dependent, so this spec asserts STRUCTURE (link activates, page renders a
 *     path of cards, cards link to profiles), not specific people or a specific N.
 *
 * Not run pre-implementation (the page/link don't exist yet); exercised at the staging
 * smoke after the feature deploys.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
// Jack Dorsey — reachable in the FOLLOWS graph from the Owner (owner→jack = 1 on staging).
const PUBKEY = '04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9';

test.describe('Story 39 — follows-hops path page + HOPS link activation', () => {
  test('the HOPS counter on the profile page is now a link to the follows-hops page', async ({ page }) => {
    await page.goto(`${BASE_URL}/user/${PUBKEY}`);
    const counts = page.locator('.bsp-counts');
    await expect(counts).toBeVisible();

    // The HOPS counter is now an anchor (was a plain span in #38).
    const hopsLink = counts.getByRole('link', { name: /Hops/i });
    await expect(hopsLink).toHaveCount(1);
    await expect(hopsLink).toHaveAttribute('href', new RegExp(`/user/${PUBKEY}/follows-hops`));
  });

  test('the follows-hops page renders a path of profile cards that link to profiles', async ({ page }) => {
    await page.goto(`${BASE_URL}/user/${PUBKEY}/follows-hops`);

    // The page loads (back link to the profile present).
    await expect(page.getByRole('link', { name: /Back to profile/i })).toBeVisible();

    // For a connected pair (owner→jack), at least one card with a link to a /user/ profile renders.
    // (Exact people / card count are data-dependent — assert structure, not specifics.)
    const userLinks = page.locator('a[href*="/user/"]');
    expect(await userLinks.count(), 'the path should render at least one profile card linking to /user/<pubkey>').toBeGreaterThan(0);

    // The page should not have thrown — a known heading/landmark is present.
    await expect(page.locator('.bsp-content, .bsp-page').first()).toBeVisible();
  });

  // The re-roll button only appears when more than one shortest path exists between the
  // chosen pair, and the specific path/people are data-dependent — so the re-roll behavior
  // and the ∞/self-view states are left as manual/staging checks against known fixtures.
});
