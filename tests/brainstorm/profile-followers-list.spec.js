/**
 * Playwright behavioral check for story #34 / ADR 0030: the profile "Verified
 * Followers" count links to /user/:pubkey/followers, which renders a table of
 * verified followers (the inbound mirror of the follows page #29).
 * See engineering-team/stories/profile/34-profile-followers-list.test-plan.md
 *
 * SUPPLEMENTARY + LIVE-DATA DEPENDENT (mirrors tests/brainstorm/profile-follows-list.spec.js).
 * The deterministic coverage is the node suite test/profile-followers-list.test.js
 * (no stack dependency). NOTE: a PRE-EXISTING harness bug (tests/global-setup.js
 * reads config.use, undefined in the installed Playwright) currently blocks
 * `npm run test:playwright` everywhere — unrelated to this story; run/verify at the
 * staging smoke (or via a Chrome MCP tab), not as a local gate.
 *
 * Not run pre-implementation (the page/route/link don't exist yet); exercised at
 * the staging smoke after the feature deploys.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
// Jack Dorsey — a high-profile account with many verified followers (≈26.7k on staging).
const PUBKEY = '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2';

test.describe('Story 34 — followers list page', () => {
  test('the profile "Verified Followers" count links to /user/<pk>/followers (Entry point)', async ({ page }) => {
    await page.goto(`${BASE_URL}/user/${PUBKEY}`);
    const link = page.getByRole('link', { name: /Verified Followers/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', new RegExp(`/user/${PUBKEY}/followers`));
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/user/${PUBKEY}/followers$`));
  });

  test('the followers page renders the table and a Back-to-profile control', async ({ page }) => {
    await page.goto(`${BASE_URL}/user/${PUBKEY}/followers`);
    await expect(page.getByText(/back to profile/i)).toBeVisible();
    // The verified-followers table renders (DataTable). Rows hydrate names/scores
    // progressively; a visible table element is the load-bearing assertion here.
    await expect(page.locator('table, .data-table, [class*="data-table"]').first()).toBeVisible();
    // Back-to-profile returns to the profile.
    await page.getByText(/back to profile/i).first().click();
    await expect(page).toHaveURL(new RegExp(`/user/${PUBKEY}$`));
  });
});
