const { test, expect } = require('@playwright/test');
const { nip19 } = require('nostr-tools');

/**
 * manage-treasure-map #2 — the Assistants by category cards on /treasure-map, and story 1's review findings 1, 2, 4.
 * What a viewer SEES.
 *
 * Story: engineering-team/stories/manage-treasure-map/2-the-assistants-by-category-cards.md
 * ADR:   engineering-team/decisions/manage-treasure-map/0002-the-cards-count-with-their-own-rule-over-the-same-read.md
 * Plan:  engineering-team/stories/manage-treasure-map/2-the-assistants-by-category-cards.test-plan.md
 * Node half: test/manage-treasure-map-cards.test.js (the rule over the story's example table, the cards, the words).
 *
 * Mocks as story 1's spec (tests/brainstorm/manage-treasure-map.spec.js): the Map read local-first, then the strict
 * relay read; plus /api/profiles answering names, and — for C10 only — the sign-out and sign-in endpoints.
 *
 *   C1 — the section sits between the FAQ and the raw Treasure Map; heading; three cards in order with their
 *        descriptions; the Mixed line and its link; no edit controls.                                      [AC-1]
 *   C2 — found: Scores mixed (rank → Ava, all Scores → Bea), Lists single (your own Assistant, purple), Concepts not
 *        assigned yet (`*:tag` never reaches Concepts).                                              [AC-2, AC-3]
 *   C3 — `*` → an Assistant with no profile: all three cards name it by shortened npub, navy avatar.  [AC-2, AC-3]
 *   C4 — four Assistants on Scores: three avatars, "· 4 Assistants", every name readable.                   [AC-3]
 *   C5 — no Treasure Map (strict none): three "Not assigned yet", no "Assigned to".                         [AC-4]
 *   C6 — still reading the Map, then still reading names: the loading line, never "Not assigned yet", never a
 *        name swap; then the named cards.                                                                    [AC-3, AC-4]
 *   C7 — can't read: the error line and Try again in place of the cards; Try again shows them.              [AC-4]
 *   C8 — signed out: no section, and no Assistant's profile asked for.                                     [AC-1]
 *   C9 — at 375 px, long names don't push the page sideways.                                               [AC-3]
 *   C10 — sign out and back in on the page: the raw viewer is closed again.                                  [AC-5]
 *   C11 — hide the FAQ with an answer open, show it again: every answer closed.                             [AC-5]
 *   C12 — the raw Treasure Map box is reached with Tab, named "Raw Treasure Map", and scrolls with the arrow keys.
 *                                                                                                               [AC-5]
 *   C13 — across the states, nothing is signed or published and no socket opens.                           [AC-5]
 *   C14 — a raw viewer opened while sign-in is still settling stays open once the session's user arrives (review 1,
 *         blocking 1; ADR 0002 Amendment 1).                                                                    [AC-5]
 */

const VIEWER = 'a1'.repeat(32);
const LOCAL = 'a2'.repeat(32);
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const C = 'c3'.repeat(32);
const D = 'd1'.repeat(32);
const R = 'wss://relay.example';
// The Assistants the fixtures' Maps name; the frame's own profile reads (the viewer's, the instance's) are other keys.
const CARD_KEYS = new Set([LOCAL, A, B, C, D]);
const PURPLE = 'rgb(114, 55, 255)';
const NAVY = 'rgb(43, 23, 79)';

const npubShort = (pk) => { const n = nip19.npubEncode(pk); return `${n.slice(0, 12)}…${n.slice(-6)}`; };
const mapOf = (entries) => ({ id: '9'.repeat(64), pubkey: VIEWER, created_at: 1790121600, kind: 10040, content: '', tags: entries.map(([k, pk]) => [k, pk, R]), sig: 'f'.repeat(128) });

// Scores: rank → A and all Scores → B (mixed). Lists: your own Assistant twice (single). `*:tag` → D is covered on
// Scores by 3038x and on Lists by 3039x:tag, and never reaches Concepts, which stay unassigned.
const MAIN = mapOf([['30382:rank', A], ['3038x', B], ['30392', LOCAL], ['3039x:tag', LOCAL], ['*:tag', D]]);
const EVERYTHING = mapOf([['*', D]]);
const FOUR = mapOf([['30382:rank', A], ['30382:followers', B], ['30382:hops', C], ['3038x', D]]);
const PROFILES = { [A]: { display_name: 'Ava' }, [B]: { name: 'Bea' }, [C]: { display_name: 'Cy' }, [LOCAL]: { display_name: 'Zed Local' } };

const WORDS = {
  descriptions: {
    Scores: 'Trust scores for profiles and content, one at a time.',
    Lists: 'Curated lists of profiles and content.',
    Concepts: 'Structured datasets your community organizes together.',
  },
  loading: 'Loading your Treasure Map…',
  error: /Couldn['’]t read your Treasure Map\./,
};

const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }

async function setup(page, {
  signedIn = true, mapLocal = MAIN, mapHold = null, relayAnswers = [{ success: true, events: [] }], relayList = ['wss://one.example'],
  profiles = PROFILES, profilesHold = null, authHold = null,
} = {}) {
  const state = { ws: 0, writes: [], mapFilters: [], relayUrls: [], profileAsks: [], session: signedIn };
  await page.routeWebSocket(/.*/, (ws) => { state.ws++; ws.close(); });
  await page.addInitScript((viewer) => {
    window.__signCalls = 0;
    window.nostr = {
      getPublicKey: async () => viewer,
      signEvent: async (u) => { window.__signCalls++; return { ...u, pubkey: viewer, id: '7'.repeat(64), sig: 'f'.repeat(128) }; },
    };
  }, VIEWER);
  page.on('request', (req) => {
    const p = new URL(req.url()).pathname;
    if (!p.startsWith('/api/') || req.method() === 'GET') return;
    if (req.method() === 'POST' && p === '/api/neo4j/query') {
      let cypher = '';
      try { cypher = JSON.parse(req.postData() || '{}').cypher || ''; } catch { /* not JSON */ }
      if (!/\b(CREATE|MERGE|DELETE|SET|REMOVE|DETACH|DROP|CALL\s*\{)\b/i.test(cypher)) return;
    }
    state.writes.push(`${req.method()} ${p}`);
  });
  await page.route('**/api/strfry/scan**', async (r) => {
    const filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}');
    if (Array.isArray(filter.kinds) && filter.kinds.includes(10040)) {
      state.mapFilters.push(filter);
      if (mapHold) await mapHold;
      return json(r, { success: true, events: mapLocal ? [mapLocal] : [] });
    }
    return json(r, { success: true, events: [] });
  });
  await page.route('**/api/neo4j/query', (r) => json(r, { success: true, data: relayList.map((url, i) => ({ name: `relay ${i}`, json: JSON.stringify({ nostrRelay: { websocketUrl: url } }) })) }));
  await page.route('**/api/relay/external**', (r) => {
    state.relayUrls.push(r.request().url());
    const a = relayAnswers[Math.min(state.relayUrls.length - 1, relayAnswers.length - 1)];
    return json(r, a, a.success === false ? 500 : 200);
  });
  await page.route('**/api/profiles**', async (r) => {
    const keys = (new URL(r.request().url()).searchParams.get('pubkeys') || '').split(',').filter(Boolean);
    const forCards = keys.some((k) => CARD_KEYS.has(k));
    if (forCards) state.profileAsks.push(keys);
    if (forCards && profilesHold) await profilesHold;
    const out = {};
    for (const k of keys) if (Object.prototype.hasOwnProperty.call(profiles, k)) out[k] = profiles[k];
    return json(r, { success: true, profiles: out });
  });
  await page.route('**/api/publish-policy', (r) => json(r, { success: true, allowExternalPublish: false }));
  await page.route('**/api/assistant/pubkey', (r) => json(r, { success: true, pubkey: '2'.repeat(64) }));
  await page.route('**/api/owner/pubkey', (r) => json(r, { success: true, pubkey: '1'.repeat(64) }));
  await page.route('**/api/relays', (r) => json(r, { success: true, relays: [] }));
  await page.route('**/api/status', (r) => json(r, { success: true }));
  await page.route('**/api/user-prefs', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/grapevine/preferences', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/setup/status**', (r) => json(r, state.session
    ? { success: true, signedIn: true, steps: { account: { done: true }, follow: { done: true }, activate: { done: true } } }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/attention**', (r) => json(r, state.session
    ? { success: true, signedIn: true, hasAssistant: false, actions: {} }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/roster', (r) => json(r, { success: true, assistants: [], viewer: null }));
  await page.route('**/api/auth/status', async (r) => {
    if (authHold) await authHold;
    return json(r, state.session ? { authenticated: true, pubkey: VIEWER } : { authenticated: false, pubkey: null });
  });
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true,
    classification: state.session ? 'customer' : 'unauthenticated',
    pubkey: state.session ? VIEWER : null,
    assistantPubkey: state.session ? LOCAL : null,
  }));
  // Sign out and sign in (C10 only drives them).
  await page.route('**/api/auth/logout', (r) => { state.session = false; return json(r, { success: true }); });
  await page.route('**/api/auth/verify-user', (r) => json(r, { authorized: true, challenge: 'test-challenge' }));
  await page.route('**/api/auth/login-user', (r) => { state.session = true; return json(r, { success: true }); });
  return state;
}

const main = (page) => page.locator('main');
const sectionHeading = (page) => main(page).getByText('Assistants by category', { exact: true });
const faqButton = (page) => main(page).getByRole('button', { name: 'Frequently asked questions' });
const rawButton = (page) => main(page).getByRole('button', { name: /^(View|Hide) the raw Treasure Map/ });
/** A card: the innermost element holding both its description and its assignment line. */
const card = (page, title) => main(page).locator('*')
  .filter({ hasText: WORDS.descriptions[title] })
  .filter({ hasText: /Assigned to|Not assigned yet/ })
  .last();
/** A card's avatar: an aria-hidden element whose text is exactly the letter. */
const avatar = (c, letter) => c.locator('[aria-hidden="true"]').filter({ hasText: new RegExp(`^${letter}$`, 'u') });
const background = (loc) => loc.evaluate((el) => getComputedStyle(el).backgroundColor);
async function cardsReady(page) {
  await expect(card(page, 'Scores')).toBeVisible();
  await expect(card(page, 'Lists')).toBeVisible();
  await expect(card(page, 'Concepts')).toBeVisible();
}
async function safe(page, state) {
  expect(state.ws, 'no WebSocket may be opened').toBe(0);
  expect(state.writes, 'the page only reads').toEqual([]);
  expect(await page.evaluate(() => window.__signCalls), 'nothing is signed').toBe(0);
}

test.describe('/treasure-map — Assistants by category', () => {
  test('C1: between the FAQ and the raw Treasure Map — heading, three cards in order, the Mixed line; no edit controls', async ({ page }) => {
    const state = await setup(page);
    await page.goto('/treasure-map');
    await cardsReady(page);
    const ys = [];
    for (const loc of [faqButton(page), sectionHeading(page), card(page, 'Scores'), card(page, 'Lists'), card(page, 'Concepts'), rawButton(page)]) {
      ys.push((await loc.boundingBox()).y);
    }
    expect(ys, 'FAQ, heading, Scores, Lists, Concepts, raw Treasure Map — top to bottom').toEqual([...ys].sort((x, y) => x - y));
    for (const [title, desc] of Object.entries(WORDS.descriptions)) {
      await expect(card(page, title).getByText(title, { exact: true })).toBeVisible();
      await expect(card(page, title).getByText(desc, { exact: true })).toBeVisible();
    }
    await expect(main(page)).toContainText('Mixed assignments can be reviewed on the Advanced page.');
    await expect(main(page).getByRole('link', { name: 'Advanced page', exact: true })).toHaveAttribute('href', '/treasure-map/advanced');
    for (const name of [/^Edit(ing)?$/, /^Save changes$/, /^Assign to all/, /^Choose an Assistant/, /^Change$/]) {
      await expect(main(page).getByRole('button', { name })).toHaveCount(0);
    }
    await expect(main(page).getByText('All duties', { exact: true })).toHaveCount(0);
    await safe(page, state);
  });

  test('C2: found — Scores mixed (Ava and Bea), Lists your own Assistant in purple, Concepts not assigned yet', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await cardsReady(page);
    const scores = card(page, 'Scores');
    await expect(scores).toContainText('Assigned to');
    await expect(scores.getByText('Mixed', { exact: true })).toBeVisible();
    await expect(scores).toContainText('· 2 Assistants');
    await expect(scores, 'every Assistant on a mixed card is readable').toContainText('Ava');
    await expect(scores).toContainText('Bea');
    await expect(avatar(scores, 'A')).toHaveCount(1);
    await expect(avatar(scores, 'B')).toHaveCount(1);
    expect(await background(avatar(scores, 'A')), 'another Assistant’s avatar is navy').toBe(NAVY);

    const lists = card(page, 'Lists');
    await expect(lists).toContainText('Assigned to');
    await expect(lists.getByText('Zed Local', { exact: true })).toBeVisible();
    await expect(lists.getByText('Mixed', { exact: true })).toHaveCount(0);
    expect(await background(avatar(lists, 'Z')), 'your own Assistant here has the purple avatar').toBe(PURPLE);

    const concepts = card(page, 'Concepts');
    await expect(concepts.getByText('Not assigned yet', { exact: true })).toBeVisible();
    await expect(concepts).not.toContainText('Assigned to');
    await expect(concepts.locator('[aria-hidden="true"]').filter({ hasText: /^.$/u })).toHaveCount(0);
  });

  test('C3: everything → an Assistant with no profile — all three cards name it by its shortened npub, navy', async ({ page }) => {
    await setup(page, { mapLocal: EVERYTHING });
    await page.goto('/treasure-map');
    await cardsReady(page);
    for (const title of ['Scores', 'Lists', 'Concepts']) {
      const c = card(page, title);
      await expect(c.getByText(npubShort(D), { exact: true })).toBeVisible();
      await expect(c.getByText('Mixed', { exact: true })).toHaveCount(0);
      expect(await background(avatar(c, 'n')), `${title}: navy`).toBe(NAVY);
    }
  });

  test('C4: four Assistants on Scores — three avatars, "· 4 Assistants", every name readable', async ({ page }) => {
    await setup(page, { mapLocal: FOUR, profiles: { ...PROFILES, [D]: { display_name: 'Dee' } } });
    await page.goto('/treasure-map');
    await cardsReady(page);
    const scores = card(page, 'Scores');
    await expect(scores).toContainText('· 4 Assistants');
    await expect(scores.locator('[aria-hidden="true"]').filter({ hasText: /^.$/u }), 'at most three avatars').toHaveCount(3);
    for (const name of ['Ava', 'Bea', 'Cy', 'Dee']) await expect(scores).toContainText(name);
  });

  test('C5: no Treasure Map — three "Not assigned yet", and nothing says "Assigned to"', async ({ page }) => {
    await setup(page, { mapLocal: null, relayAnswers: [{ success: true, events: [] }] });
    await page.goto('/treasure-map');
    await cardsReady(page);
    await expect(main(page).getByText('Not assigned yet', { exact: true })).toHaveCount(3);
    await expect(main(page).getByText('Assigned to', { exact: true })).toHaveCount(0);
  });

  test('C6: while the Map, then the names, are read — the loading line, never "Not assigned yet"; then the named cards', async ({ page }) => {
    const map = deferred();
    const names = deferred();
    const state = await setup(page, { mapHold: map.promise, profilesHold: names.promise });
    await page.goto('/treasure-map');
    await expect(sectionHeading(page)).toBeVisible();
    await expect(main(page).getByRole('status')).toContainText(WORDS.loading);
    await expect(main(page).getByText('Not assigned yet', { exact: true })).toHaveCount(0);
    await expect(main(page).getByText(WORDS.descriptions.Scores, { exact: true })).toHaveCount(0);
    map.resolve();
    await expect.poll(() => state.profileAsks.length, { message: 'the names are asked for' }).toBeGreaterThan(0);
    await expect(main(page).getByRole('status')).toContainText(WORDS.loading);
    await expect(main(page).getByText(WORDS.descriptions.Scores, { exact: true }), 'no card before its names').toHaveCount(0);
    await expect(main(page).getByText(npubShort(A))).toHaveCount(0);
    names.resolve();
    await cardsReady(page);
    await expect(card(page, 'Scores')).toContainText('Ava');
    const asked = state.profileAsks.flat();
    for (const pk of [A, B, LOCAL]) expect(asked, `the lookup asks for ${pk.slice(0, 4)}…`).toContain(pk);
  });

  test('C7: can’t read — the error line and Try again in place of the cards; Try again shows them', async ({ page }) => {
    await setup(page, { mapLocal: null, relayAnswers: [{ success: false, error: 'no relay reached' }, { success: true, events: [MAIN] }] });
    await page.goto('/treasure-map');
    await expect(sectionHeading(page)).toBeVisible();
    await expect(main(page).getByRole('alert')).toContainText(WORDS.error);
    await expect(main(page).getByText('Not assigned yet', { exact: true })).toHaveCount(0);
    await main(page).getByRole('button', { name: 'Try again' }).click();
    await cardsReady(page);
    await expect(card(page, 'Lists')).toContainText('Zed Local');
  });

  test('C8: signed out — no section, and no Assistant’s profile is asked for', async ({ page }) => {
    const state = await setup(page, { signedIn: false });
    await page.goto('/treasure-map');
    await expect(main(page).getByRole('button', { name: 'Sign in with nostr' })).toBeVisible();
    await expect(sectionHeading(page)).toHaveCount(0);
    await expect(main(page).getByText('Not assigned yet', { exact: true })).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    expect(state.profileAsks, 'no Assistant profile is read').toEqual([]);
  });

  test('C9: at 375 px, long names don’t push the page sideways', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setup(page, {
      mapLocal: FOUR,
      profiles: {
        [A]: { display_name: 'A very long display name for an Assistant that goes on and on and on and on' },
        [B]: { name: 'Averyveryveryveryveryveryveryveryveryverylongnamewithoutanyspacesatallwhatsoever' },
        [C]: { display_name: 'Cy' },
        [D]: { name: 'Dee' },
      },
    });
    await page.goto('/treasure-map');
    await cardsReady(page);
    const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
    expect(m.scroll, `the page is ${m.scroll}px wide in a ${m.width}px viewport`).toBeLessThanOrEqual(m.width);
    for (const title of ['Scores', 'Lists', 'Concepts']) {
      const box = await card(page, title).boundingBox();
      expect(box.x + box.width, `${title} ends inside the viewport`).toBeLessThanOrEqual(375.5);
    }
  });

  test('C10: sign out and back in on the page — the raw Treasure Map viewer is closed again', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await rawButton(page).click();
    await expect(rawButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(main(page).locator('pre')).toBeVisible();

    await page.locator('.bs-usermenu-avatar-btn').first().click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(main(page).getByRole('button', { name: 'Sign in with nostr' })).toBeVisible();
    await expect(rawButton(page)).toHaveCount(0);

    await main(page).getByRole('button', { name: 'Sign in with nostr' }).click();
    await expect(rawButton(page)).toBeVisible();
    await expect(rawButton(page), 'the raw viewer starts closed for the new session').toHaveAttribute('aria-expanded', 'false');
    await expect(main(page).locator('pre')).toHaveCount(0);
  });

  test('C11: hide the FAQ with an answer open, show it again — every answer is closed', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await faqButton(page).click();
    const q2 = main(page).getByRole('button', { name: 'Do I need to do anything?', exact: true });
    await q2.click();
    await expect(q2).toHaveAttribute('aria-expanded', 'true');
    await faqButton(page).click();
    await faqButton(page).click();
    for (const q of ['What is a Treasure Map?', 'Do I need to do anything?', 'Who can see it?', /^What['’]s on the Advanced page\?$/]) {
      await expect(main(page).getByRole('button', { name: q, exact: typeof q === 'string' })).toHaveAttribute('aria-expanded', 'false');
    }
    await expect(main(page).getByText(/^Not usually\./)).toHaveCount(0);
  });

  test('C12: the raw Treasure Map box is reached with Tab, is named "Raw Treasure Map", and scrolls with the arrow keys', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await rawButton(page).click();
    const box = main(page).getByRole('region', { name: 'Raw Treasure Map' });
    await expect(box).toBeVisible();
    await rawButton(page).focus();
    await page.keyboard.press('Tab');
    await expect(box, 'Tab from the raw viewer’s button lands on the box').toBeFocused();
    expect(await box.evaluate((el) => el.scrollWidth > el.clientWidth), 'the fixture overflows sideways').toBe(true);
    for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
    await expect.poll(() => box.evaluate((el) => el.scrollLeft), { message: 'the box scrolled right' }).toBeGreaterThan(0);
  });

  test('C14: a raw viewer opened while sign-in is still settling stays open once the session’s user arrives', async ({ page }) => {
    const auth = deferred();
    await setup(page, { authHold: auth.promise });
    await page.goto('/treasure-map');
    await expect(rawButton(page), 'while sign-in settles, the raw viewer is offered').toBeVisible();
    await rawButton(page).click();
    await expect(rawButton(page)).toHaveAttribute('aria-expanded', 'true');
    auth.resolve();
    await cardsReady(page);
    await expect(main(page).locator('pre'), 'the Map shows in the still-open viewer').toBeVisible();
    await expect(rawButton(page), 'sign-in settling is not a new viewer').toHaveAttribute('aria-expanded', 'true');
  });

  test('C13: across the states, nothing is signed or published and no socket opens', async ({ page }) => {
    const state = await setup(page, { mapLocal: null, relayAnswers: [{ success: false, error: 'x' }, { success: true, events: [FOUR] }] });
    await page.goto('/treasure-map');
    await main(page).getByRole('button', { name: 'Try again' }).click();
    await cardsReady(page);
    await rawButton(page).click();
    await faqButton(page).click();
    await safe(page, state);
  });
});
