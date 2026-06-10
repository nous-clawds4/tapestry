/**
 * Playwright behavioral check for story verified-reporters #3 / ADR 0003: the
 * /user/:pubkey/reporters page lists an account's verified reporters.
 * See engineering-team/stories/verified-reporters/3-verified-reporters-list-page.test-plan.md
 *
 * SUPPLEMENTARY + LIVE-DATA DEPENDENT (mirrors profile-followers-list.spec.js). The
 * deterministic coverage is the node suite test/verified-reporters-list-page.test.js
 * (no stack dependency). This spec verifies the browser-rendered page shell and the
 * empty state that source-regex can only approximate.
 *
 * Preconditions / fragility:
 *   - A reachable Brainstorm instance (BRAINSTORM_BASE_URL or http://localhost:7778)
 *     with the change BUILT into the UI (`npm run build` in ui/) AND the verified-
 *     reporter membership endpoint live (GET /api/get-grapevine-reporters) with House
 *     WoT scores + [:REPORTS] edges loaded.
 *   - Relies on LIVE DATA. Most accounts have ZERO verified reporters (being reported
 *     by trusted users is rare), so the account below exercises the EMPTY state.
 *
 * Not run pre-implementation (the page/route do not exist yet); exercised at the
 * staging smoke after the feature deploys.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
// A well-indexed, broadly-trusted account: scores loaded, expected 0 verified reporters.
const ZERO_PUBKEY = '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2';

const reportersUrl = (pk) => `${BASE_URL}/user/${pk}/reporters`;

test.describe('Story verified-reporters #3 — verified reporters list page', () => {
  test('the page shows the title, a back link to the profile, and the description', async ({ page }) => {
    await page.goto(reportersUrl(ZERO_PUBKEY));

    await expect(page.getByRole('heading', { name: /verified reporters/i })).toBeVisible();
    await expect(page.getByText('Verified users who have reported this account.', { exact: true })).toBeVisible();

    const back = page.getByRole('link', { name: /back to profile/i });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute('href', new RegExp(`/user/${ZERO_PUBKEY}$`));
  });

  test('an account with no verified reporters shows the designed empty state (not blank, not an error)', async ({ page }) => {
    await page.goto(reportersUrl(ZERO_PUBKEY));
    await expect(
      page.getByText('No verified reporters. No one in this web of trust has reported this account.', { exact: true })
    ).toBeVisible();
  });

  test('the point-of-view attribution line is present', async ({ page }) => {
    await page.goto(reportersUrl(ZERO_PUBKEY));
    // v1 membership is House-only, so the House PoV line is the honest attribution.
    await expect(page.getByText(/Relative to the House \(default\) web of trust\./)).toBeVisible();
  });

  // MANUAL / FIXTURE-DEPENDENT (documented, like the followers spec's mega-account note):
  // The populated path — rows sorted by Rank desc, a row click navigating to the
  // reporter's /user/<pubkey> profile, and row count == the profile's Verified Reporters
  // count — needs an account that actually has verified reporters under the House PoV at
  // smoke time. To verify: open a known-reported account's /reporters page, confirm the
  // rows are Rank-descending, click a row → lands on that reporter's profile, and the row
  // count matches the profile badge (allowing for Meili-vs-Neo4j refresh skew, per ADR 0002).
  // Entry point: from the profile, the "Verified Reporters" count (Story 1) links here when > 0.
});
