const { test, expect } = require('@playwright/test');

/**
 * Story 5: Authored-tagging section on profile pages — UI tests.
 *
 * Profile route per ui/src/App.jsx: /user/:pubkey.
 *
 * BaseURL is configured in playwright.config.js (default http://localhost:7778).
 *
 * The section is data-dependent: it's rendered ONLY when the profile has at
 * least one authored nostr-user-tag assertion whose target survives the
 * viewer's POV WoT filter (AC-6 — hidden entirely when zero rows). Data-
 * dependent affordances (sort labels, default indicator, row structure,
 * "Tags they've placed on YOU" sub-block, peer annotation) are covered
 * server-side by test/authored-tagging-publish.test.js.
 *
 * What this spec covers deterministically:
 *  - AC-6: a freshly-generated pubkey with no authored data must NOT render
 *    the TAGGING ACTIVITY section.
 *  - Regression guard: the existing TAGS section (Story 1) still renders on
 *    the same page — i.e., Story 5 didn't accidentally hide or break the
 *    Story-1 surface.
 */
test.describe('Authored-tagging section (Story 5)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  test('AC-6: TAGGING ACTIVITY section is hidden on a profile with no authored assertions', async ({ page }) => {
    // Random 64-char hex — vanishingly unlikely to have authored data.
    const freshPubkey = Array.from({ length: 64 }, () =>
      '0123456789abcdef'[Math.floor(Math.random() * 16)]
    ).join('');
    await page.goto(`/user/${freshPubkey}`);
    await page.waitForLoadState('networkidle');

    // The section's heading must NOT be present.
    const heading = page.getByRole('heading', { name: /tagging activity/i });
    await expect(heading).toHaveCount(0);
  });

  test('regression: Story-1 TAGS section still renders on a profile page', async ({ page }) => {
    // Use the firmware TA pubkey — always renders profile page reliably.
    const TA = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
    await page.goto(`/user/${TA}`);
    await page.waitForLoadState('networkidle');

    // The Story 1 TAGS heading must still be visible — guards against Story 5
    // accidentally breaking the existing surface (e.g., a SortToggle refactor
    // or BrainstormProfile JSX edit that nukes the old section).
    await expect(page.getByRole('heading', { name: /^tags$/i }).first()).toBeVisible({ timeout: 10000 });
  });
});
