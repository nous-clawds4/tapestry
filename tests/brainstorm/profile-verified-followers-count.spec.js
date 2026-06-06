/**
 * Playwright behavioral check for story #33 / ADR 0029: the profile page shows a
 * "Verified Followers" count beside "Following", as a PLAIN (non-link) number.
 * See engineering-team/stories/profile/33-profile-verified-followers-count.test-plan.md
 *
 * SUPPLEMENTARY + LIVE-DATA DEPENDENT (mirrors the story #30 spec). The
 * deterministic coverage is the node suite test/profile-verified-followers-count.test.js
 * (no stack dependency). This spec additionally verifies the browser-rendered
 * result and the not-an-anchor behavior that source-regex can only approximate.
 *
 * Preconditions / fragility:
 *   - A reachable Brainstorm instance (BRAINSTORM_BASE_URL or http://localhost:7778)
 *     with the change deployed AND House-PoV WoT scores loaded into Meilisearch
 *     (the count comes from wot_verifiedFollowerCount_<houseSuffix>).
 *   - Relies on LIVE DATA: the account below (Jack Dorsey) is expected to have
 *     verified followers indexed under the House PoV. If scores aren't loaded the
 *     Reputation section reports "no scores" and the counter shows "—".
 *
 * Not run pre-implementation (current code has no such counter); exercised at the
 * staging smoke after the feature deploys.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
// Jack Dorsey — a high-profile account expected to have verified followers indexed.
const PUBKEY = '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2';

test.describe('Story 33 — verified-followers count on the profile page', () => {
  test('a "Verified Followers" count is shown beside "Following"', async ({ page }) => {
    await page.goto(`${BASE_URL}/user/${PUBKEY}`);

    // Both prominent counters present.
    await expect(page.getByText('Following', { exact: true })).toBeVisible();
    await expect(page.getByText('Verified Followers', { exact: true })).toBeVisible();
  });

  test('the "Verified Followers" count is a plain element, not a link; "Following" remains a link', async ({ page }) => {
    await page.goto(`${BASE_URL}/user/${PUBKEY}`);

    // AC7: the verified-followers counter is NOT a link.
    await expect(page.getByText('Verified Followers', { exact: true })).toBeVisible();
    expect(
      await page.getByRole('link', { name: /Verified Followers/i }).count(),
      'the Verified Followers counter must be plain text, not a <Link> (the followers table is deferred)'
    ).toBe(0);

    // Regression: the Following counter is still a same-tab link to /follows.
    const followingLink = page.getByRole('link', { name: /Following/i });
    await expect(followingLink).toBeVisible();
    await expect(followingLink).toHaveAttribute('href', new RegExp(`/user/${PUBKEY}/follows`));
  });

  // PoV (AC3/AC4) is exercisable manually here by appending ?pov=<8hex> to the URL
  // (e.g. ?pov=a1420e44) and confirming the count reflects that PoV when its scores
  // are indexed, falling back to House (default, no ?pov) otherwise. Left as a manual
  // check — asserting a specific PoV-dependent number needs a fixed fixture instance.
});
