/**
 * Playwright behavioral check for story verified-reporters #4 / ADR 0004: the
 * Report Type + Reported (timestamp) columns and the new default column set on the
 * /user/:pubkey/reporters page.
 * See engineering-team/stories/verified-reporters/4-reporters-report-type-and-timestamp-columns.test-plan.md
 *
 * SUPPLEMENTARY + LIVE-DATA DEPENDENT (mirrors profile-verified-reporters-list.spec.js).
 * The deterministic coverage is the node suite test/verified-reporters-report-columns.test.js
 * (pure-function behavior + source sentinels, no stack dependency). This spec verifies the
 * browser-rendered column chooser, which source-regex can only approximate.
 *
 * Preconditions / fragility:
 *   - A reachable Brainstorm instance (BRAINSTORM_BASE_URL or http://localhost:7778) with
 *     the change BUILT into the UI (`npm run build` in ui/).
 *   - The Columns ▾ chooser renders even on an account with ZERO verified reporters (it sits
 *     above the table/empty-state), so the DEFAULT column set is verifiable without populated
 *     data. A fresh browser context (empty localStorage) is required so DEFAULT_VISIBLE applies
 *     rather than a saved 'bsp-reporters-columns' preference — Playwright gives each test one.
 *
 * Not run pre-implementation (the columns/defaults do not exist yet); exercised at the
 * staging smoke after the feature deploys.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
// Scores loaded, expected 0 verified reporters → empty state, but the Columns menu still renders.
const ZERO_PUBKEY = '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2';

const reportersUrl = (pk) => `${BASE_URL}/user/${pk}/reporters`;
const colOption = (page, label) =>
  page.locator('label.bsp-follows-colopt', { hasText: label }).locator('input[type="checkbox"]');

test.describe('Story verified-reporters #4 — report-type & timestamp columns', () => {
  test('the column chooser offers both new columns: "Report Type" and "Reported"', async ({ page }) => {
    await page.goto(reportersUrl(ZERO_PUBKEY));
    await page.getByRole('button', { name: /columns/i }).click();
    await expect(page.locator('label.bsp-follows-colopt', { hasText: 'Report Type' })).toBeVisible();
    await expect(page.locator('label.bsp-follows-colopt', { hasText: 'Reported' })).toBeVisible();
  });

  test('by default Report Type is shown and Name is hidden (default columns = Picture/Report Type/Rank)', async ({ page }) => {
    await page.goto(reportersUrl(ZERO_PUBKEY));
    await page.getByRole('button', { name: /columns/i }).click();
    // New default set: Report Type on, Rank on, Name off, Reported off (toggleable).
    await expect(colOption(page, 'Report Type')).toBeChecked();
    await expect(colOption(page, 'Rank')).toBeChecked();
    await expect(colOption(page, 'Name')).not.toBeChecked();
    await expect(colOption(page, 'Reported')).not.toBeChecked();
  });

  // MANUAL / FIXTURE-DEPENDENT (documented, like the list spec's populated-path note). These
  // need an account that actually has verified reporters under the House PoV at smoke time —
  // most accounts have zero. To verify on such an account's /reporters page:
  //   1. Report Type cells show a humanized label (e.g. "Spam", "Impersonation"); empty when absent.
  //   2. Toggle "Reported" on: cells read relative time, e.g. "3d, 4h, 12m ago"; empty when absent.
  //   3. Click the "Reported" header: rows order by the RAW unix timestamp (newest/oldest), NOT
  //      lexicographically by the "ago" text; rows with no timestamp sit at the bottom in BOTH
  //      sort directions.
  //   4. The summary line reads "<N> reporters, <M> reports" — N = distinct people, M = rows; when
  //      a reporter filed multiple distinct report types they appear as multiple rows (no de-dup),
  //      so M can exceed N. Entry point: the profile's "Verified Reporters" count links here.
});
