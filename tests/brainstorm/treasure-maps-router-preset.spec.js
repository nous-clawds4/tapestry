/**
 * Playwright UI checks for story #2: treasureMaps router preset + 10040 Negentropy Sync.
 * See engineering-team/stories/2-treasure-maps-router-preset.test-plan.md
 *
 * Preconditions:
 *   - A reachable Brainstorm instance. Defaults to BRAINSTORM_BASE_URL or http://localhost:8080.
 *   - The Implementer's changes deployed to that instance.
 *
 * These checks verify the *presence* of the new preset row and the new Event Kinds
 * radio option. Interaction-level tests (toggle on, refresh, observe daemon config)
 * are out of scope for this Playwright spec — they require auth and side-effect
 * verification on the droplet. Smoke-tested manually post-deploy.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BRAINSTORM_BASE_URL || 'http://localhost:8080';
const RELAYS_URL = `${BASE_URL}/tapestry/settings/relays`;

test.describe('Story 2 — treasureMaps router preset + 10040 Negentropy Sync', () => {
  test('Router tab Presets popup lists treasureMaps', async ({ page }) => {
    await page.goto(RELAYS_URL);

    // The Router Management tab should be selected by default (or click into it).
    // Click the "📋 Presets" button to open the Available Presets popup.
    const presetsButton = page.getByRole('button', { name: /Presets/i });
    await presetsButton.click();

    // Expect to see a row mentioning treasureMaps (the preset name) and kind 10040.
    await expect(page.getByText(/treasureMaps/i)).toBeVisible();
    await expect(page.getByText(/Treasure Maps/i)).toBeVisible();
  });

  test('Negentropy Sync tab Event Kinds picker offers Treasure Maps (10040)', async ({ page }) => {
    await page.goto(RELAYS_URL);

    // Switch to the Negentropy Sync tab.
    const syncTab = page.getByRole('button', { name: /Negentropy Sync/i }).or(
      page.getByRole('tab', { name: /Negentropy Sync/i })
    );
    await syncTab.first().click();

    // The Event Kinds picker should now include a "Treasure Maps (10040)" radio option.
    await expect(page.getByText(/Treasure Maps \(10040\)/)).toBeVisible();
  });
});
