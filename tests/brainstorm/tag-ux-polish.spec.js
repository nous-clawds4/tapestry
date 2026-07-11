const { test, expect } = require('@playwright/test');

/**
 * Story 6: Tag-UX polish — popover persistence + asserter navigation +
 * search placeholder.
 *
 * No formal ADR or test plan for this story (treated as a small-fix
 * bundle); this spec exists so the Reviewer has automated coverage of
 * the two ACs that are most likely to silently regress: popover
 * persistence and search-placeholder text.
 */
test.describe('Tag UX polish (Story 6)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  test('AC-5: search placeholder mentions "tag"', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // The story specifies the placeholder include "tag" alongside the other
    // searchable fields. Loose match — exact wording is not pinned.
    const input = page.locator('input[placeholder*="tag" i]').first();
    await expect(input).toBeVisible({ timeout: 5000 });
  });

  test('AC-1: chip popover stays open when the cursor moves into it', async ({ page }) => {
    // Visit a profile that has at least one tag chip (the TA pubkey is the
    // most likely to have one because the firmware seeds one). If no chip is
    // visible, skip — we don't have a controllable fixture in this dev env.
    const TEST_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
    await page.goto(`/user/${TEST_PUBKEY}`);
    await page.waitForLoadState('networkidle');

    const chip = page.locator('a.ptc-chip').first();
    if (!(await chip.isVisible().catch(() => false))) {
      test.skip(true, 'No tag chip on the test profile to exercise the popover.');
    }

    // Hover the chip → popover opens.
    await chip.hover();
    const popover = page.locator('.ptc-popover').first();
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Move the cursor into the popover. The bug Story 6 fixes was: cursor
    // crossed the chip-to-popover gap, mouseleave fired, popover closed
    // before the cursor reached it. After the fix, the popover should stay
    // open until click-outside / Escape.
    await popover.hover();
    await page.waitForTimeout(200);
    await expect(popover).toBeVisible();

    // Escape closes it.
    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden({ timeout: 2000 });
  });

  test('AC-2: clicking an asserter row navigates to that user profile', async ({ page }) => {
    const TEST_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
    await page.goto(`/user/${TEST_PUBKEY}`);
    await page.waitForLoadState('networkidle');

    const chip = page.locator('a.ptc-chip').first();
    if (!(await chip.isVisible().catch(() => false))) {
      test.skip(true, 'No tag chip on the test profile to exercise asserter navigation.');
    }

    await chip.hover();
    const popover = page.locator('.ptc-popover').first();
    await expect(popover).toBeVisible({ timeout: 5000 });

    const asserterLink = popover.locator('a.ptc-asserter-link').first();
    if (!(await asserterLink.isVisible().catch(() => false))) {
      test.skip(true, 'Chip has no asserter rows to click.');
    }

    const href = await asserterLink.getAttribute('href');
    expect(href).toMatch(/^\/user\/[0-9a-f]{64}$/);
    await asserterLink.click();
    await page.waitForURL(/\/user\/[0-9a-f]{64}/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/user\/[0-9a-f]{64}/);
  });
});
