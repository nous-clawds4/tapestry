const { test, expect } = require('@playwright/test');

/**
 * Story 1: Tag user profiles — UI affordance tests.
 *
 * The profile-tags surface lives inline on the profile page. These tests verify
 * the auth-independent affordances; the publish/revoke paths require NIP-07
 * signing and are exercised at the API layer.
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

  test('profile page renders an inline TAGS section with a Manage link', async ({ page }) => {
    await page.goto(`/user/${TEST_PUBKEY}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /^tags$/i }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /^manage$/i }).first()).toBeVisible();
  });

  test('TAGS section exposes an add affordance (empty-state or +)', async ({ page }) => {
    await page.goto(`/user/${TEST_PUBKEY}`);
    await page.waitForLoadState('networkidle');

    // Either empty-state ("Add the first tag") or the "+" chip-style button
    // must be present, depending on whether the profile has any tags.
    const addAffordance = page.getByRole('button', { name: /add (a|the first) tag|^\+$/i });
    await expect(addAffordance.first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking the add affordance opens an Add tag dialog with a search input', async ({ page }) => {
    await page.goto(`/user/${TEST_PUBKEY}`);
    await page.waitForLoadState('networkidle');

    const addAffordance = page.getByRole('button', { name: /add (a|the first) tag|^\+$/i });
    await addAffordance.first().click();

    // Dialog renders with both Search-existing and Create-new tabs.
    await expect(page.getByRole('dialog', { name: /add tag/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('searchbox', { name: /search tags/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create new/i })).toBeVisible();
  });

  test('Manage button opens a Manage dialog', async ({ page }) => {
    await page.goto(`/user/${TEST_PUBKEY}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /^manage$/i }).first().click();

    await expect(page.getByRole('dialog', { name: /manage your tags/i })).toBeVisible({ timeout: 5000 });
  });
});
