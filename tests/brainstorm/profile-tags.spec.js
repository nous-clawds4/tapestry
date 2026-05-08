const { test, expect } = require('@playwright/test');

/**
 * Story 1: Tag user profiles — UI affordance tests.
 *
 * These verify the user-visible surface of the profile-tag feature.
 * They do NOT exercise the publish-to-relay path (that requires a NIP-07
 * extension and a signing pubkey) — those are exercised at the API layer
 * and via manual smoke testing per the test plan.
 *
 * BaseURL is configured in playwright.config.js (default http://localhost:7778).
 * Profile route per ui/src/App.jsx is `/user/:pubkey`.
 */
test.describe('Profile tagging UI (Story 1)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  // Any valid 64-char hex pubkey is fine — we're testing affordances, not data.
  const TEST_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';

  test('profile page exposes a Tag action button on its action row', async ({ page }) => {
    await page.goto(`/user/${TEST_PUBKEY}`);
    await page.waitForLoadState('networkidle');

    // Tag button must be visible regardless of auth state; Follow/Mute/Report
    // are NIP-07-gated and Playwright runs unauthenticated, so we don't anchor
    // on those.
    await expect(page.getByRole('button', { name: /^tag$/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking Tag opens a panel that exposes tag-application affordances', async ({ page }) => {
    await page.goto(`/user/${TEST_PUBKEY}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /^tag$/i }).first().click();

    // Per AC-2 + AC-3: panel must let the user apply a tag.
    await expect(page.getByText(/apply/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('tag panel exposes a Dispute affordance for negative tagging', async ({ page }) => {
    await page.goto(`/user/${TEST_PUBKEY}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /^tag$/i }).first().click();

    // Per AC-4: dispute (negative-polarity) tagging must be reachable.
    await expect(page.getByText(/dispute/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('tag panel exposes inline new-tag creation (name + optional description)', async ({ page }) => {
    await page.goto(`/user/${TEST_PUBKEY}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /^tag$/i }).first().click();

    // Per AC-2: user can create a new tag inline.
    await expect(page.getByText(/create.*tag|new tag/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('tag panel exposes a Manage affordance for revoking own assertions', async ({ page }) => {
    await page.goto(`/user/${TEST_PUBKEY}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /^tag$/i }).first().click();

    // Per AC-7: minimal Manage view (list + revoke).
    await expect(page.getByText(/manage/i).first()).toBeVisible({ timeout: 5000 });
  });
});
