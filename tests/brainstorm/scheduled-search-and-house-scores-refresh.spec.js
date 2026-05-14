/**
 * Playwright UI checks for story #4: scheduled task to refresh Meilisearch profiles
 * + House PoV WoT scores.
 * See engineering-team/stories/4-scheduled-search-and-house-scores-refresh.test-plan.md
 *
 * Preconditions:
 *   - A reachable Brainstorm instance. Defaults to BRAINSTORM_BASE_URL or http://localhost:8080.
 *   - The Implementer's changes deployed to that instance.
 *   - For the unconfigured-banner test: House PoV is unset in Search Preferences
 *     (the default on a fresh install).
 *
 * These checks verify presence of the new card, default-off toggle, the
 * unconfigured-banner, and continued visibility of the existing Owner card.
 * Interaction-level tests (toggle on, save, observe scheduler tick) are out of
 * scope for this spec — they require auth and live-state verification.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BRAINSTORM_BASE_URL || 'http://localhost:8080';
const RELAYS_URL = `${BASE_URL}/tapestry/settings/relays`;

test.describe('Story 4 — Scheduled task: refresh Meilisearch profiles & House PoV scores', () => {
  test('Scheduled Tasks tab shows the Refresh Meilisearch profiles & House PoV scores card', async ({ page }) => {
    await page.goto(RELAYS_URL);

    // Switch to the Scheduled Tasks tab.
    const scheduledTab = page.getByRole('button', { name: /Scheduled Tasks/i }).or(
      page.getByRole('tab', { name: /Scheduled Tasks/i })
    );
    await scheduledTab.first().click();

    // The new card title should be visible.
    await expect(page.getByText(/Refresh Meilisearch profiles\s*&\s*House PoV scores/i)).toBeVisible();
  });

  test('Existing Update All Scores for Owner card still visible (no regression)', async ({ page }) => {
    await page.goto(RELAYS_URL);

    const scheduledTab = page.getByRole('button', { name: /Scheduled Tasks/i }).or(
      page.getByRole('tab', { name: /Scheduled Tasks/i })
    );
    await scheduledTab.first().click();

    // The existing card must still render.
    await expect(page.getByText(/Update All Scores for Owner/)).toBeVisible();
  });

  test('Refresh Meilisearch card toggle defaults to disabled state on a fresh install', async ({ page }) => {
    await page.goto(RELAYS_URL);

    const scheduledTab = page.getByRole('button', { name: /Scheduled Tasks/i }).or(
      page.getByRole('tab', { name: /Scheduled Tasks/i })
    );
    await scheduledTab.first().click();

    // Locate the new card's surrounding area.
    const newCard = page.locator('div', {
      has: page.getByText(/Refresh Meilisearch profiles\s*&\s*House PoV scores/i),
    }).first();

    // The card should show "Disabled" text adjacent to its toggle (matches existing panel UX).
    await expect(newCard.getByText(/Disabled/i)).toBeVisible();
  });

  test('House PoV unconfigured banner is visible when povPubkey is unset', async ({ page }) => {
    await page.goto(RELAYS_URL);

    const scheduledTab = page.getByRole('button', { name: /Scheduled Tasks/i }).or(
      page.getByRole('tab', { name: /Scheduled Tasks/i })
    );
    await scheduledTab.first().click();

    // The banner copy should be present when House PoV is unconfigured (default on a fresh install).
    await expect(page.getByText(/House PoV is not configured/i)).toBeVisible();
    // And it should offer a way to get to Search Preferences.
    await expect(page.getByText(/Search Preferences/i)).toBeVisible();
  });
});
