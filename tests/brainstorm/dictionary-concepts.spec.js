const { test, expect } = require('@playwright/test');

/**
 * Dictionary › Concepts: whose dictionary the page shows (the owner's correction of 2026-09-29).
 *
 * The rows are the person's own dictionary: exactly what Active b-tags lists under "Mine". The
 * page resolves the person as Active b-tags does and sends their pubkeys to
 * GET /api/dictionaries/concepts as `authors`. What only a browser can answer is pinned here:
 * which `authors` the page actually sends for each kind of reader, and what it then says. The
 * structural and live halves are in test/dictionary-concepts.test.js (its H1 rebuilds the rows
 * from strfry and compares them with the Active b-tags rule on real data).
 *
 * Network-mocked, the author-scoped-inspection.spec.js idiom: signed-in states come from mocking
 * /api/auth/status, /api/auth/user-classification and the roster. The dictionary endpoint is
 * mocked too, and it applies the server's rule to the fixture headers for whichever authors are
 * asked for, so a page that sent the wrong person would show the wrong rows.
 *
 *   D1 — signed out: the owner's pair is asked for, and the page says it is the owner's.
 *   D2 — a signed-in customer: their account and their assistant, "your", and no Add.
 *   D3 — the signed-in owner: the owner's pair, and Add to Dictionary is offered.
 *   D4 — signed in with no assistant: the account alone, and the page says so.
 */

const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const CUST = '3'.repeat(64);
const CUST_TA = '4'.repeat(64);
const ADMIN_NO_TA = '5'.repeat(64);
const FOREIGN = `39998:${'f'.repeat(64)}:shared-thing`;
const SENTINEL = 'b-tag-deferred';

const ROSTER = [
  { accountPubkey: OWNER, assistantPubkey: OWNER_TA, role: 'owner', displayName: 'Ada' },
  { accountPubkey: CUST, assistantPubkey: CUST_TA, role: 'customer', displayName: 'Baz' },
];

/** Fixture headers: [d, name, author, b]. */
const HEADERS = [
  ['cat-breed', 'cat breed', OWNER_TA, FOREIGN],
  ['dog', 'dog', OWNER_TA, `39998:${OWNER_TA}:dog`],
  ['owner-signed', 'owner signed', OWNER, FOREIGN],
  ['customer-thing', 'customer thing', CUST_TA, FOREIGN],
  ['admin-thing', 'admin thing', ADMIN_NO_TA, FOREIGN],
  ['deferred-one', 'deferred one', OWNER_TA, SENTINEL],
];
const ALL_NAMES = HEADERS.map((h) => h[1]);

/** The server's rule over the fixtures: the requested authors' headers that carry a real b. */
function dictionaryFor(authors) {
  return HEADERS
    .filter(([, , author, b]) => authors.includes(author) && b !== SENTINEL)
    .map(([d, name, author, b]) => {
      const coord = `39998:${author}:${d}`;
      const selfDeclared = b === coord;
      return {
        coord, name, plural: null, description: null, author,
        targets: selfDeclared ? [] : [b], selfDeclared, isFirmware: false,
        itemCount: 0, sharedCoord: selfDeclared ? coord : b, gum: 0,
        totalAuthorCount: 0, totalEventCount: 0, override: null,
      };
    });
}

async function mockStack(page, { session = null } = {}) {
  const asked = [];
  const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/assistant/pubkey', (r) => json(r, { success: true, pubkey: OWNER_TA }));
  await page.route('**/api/owner/pubkey', (r) => json(r, { success: true, pubkey: OWNER }));
  await page.route('**/api/profiles**', (r) => json(r, { success: true, profiles: {} }));
  await page.route('**/api/relays', (r) => json(r, { success: true, relays: [] }));
  await page.route('**/api/status', (r) => json(r, { success: true }));
  await page.route('**/api/user-prefs', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/assistant/roster', (r) => json(r, {
    success: true,
    assistants: ROSTER,
    viewer: session ? { accountPubkey: session.pubkey, assistantPubkey: session.assistantPubkey } : null,
  }));
  await page.route('**/api/auth/status', (r) => json(r, session
    ? { authenticated: true, pubkey: session.pubkey }
    : { authenticated: false, pubkey: null }));
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true,
    classification: session ? session.classification : 'unauthenticated',
    pubkey: session ? session.pubkey : null,
    assistantPubkey: session ? session.assistantPubkey : null,
  }));
  await page.route('**/api/dictionaries/concepts**', (r) => {
    const authors = (new URL(r.request().url()).searchParams.get('authors') || '').split(',').filter(Boolean);
    asked.push(authors.join(','));
    return json(r, {
      success: true, metric: 'gum1', authors, entries: dictionaryFor(authors),
      pov: { branch: 'house', observer: null, fellBackToHouse: false, cutoff: 0.01, threshold: 2 },
    });
  });
  return asked;
}

const URL_ = '/tapestry/dictionaries/concepts';
const list = (page) => page.getByRole('list', { name: /Concepts in/ });

/** The row names on the page, in fixture order. */
async function names(page) {
  await expect(list(page)).toBeVisible();
  const out = [];
  for (const name of ALL_NAMES) {
    if (await list(page).locator('.dict-row-name', { hasText: new RegExp(`^${name}$`) }).count() > 0) out.push(name);
  }
  return out;
}

test.describe('Dictionary › Concepts — whose dictionary', () => {
  test('D1: signed out, the page shows the owner’s dictionary', async ({ page }) => {
    const asked = await mockStack(page);
    await page.goto(URL_);
    await expect(page.getByText(/concepts? in the owner’s Dictionary/)).toBeVisible();
    expect(asked.at(-1), 'signed out → the owner and the owner’s assistant').toBe(`${OWNER},${OWNER_TA}`);
    expect(await names(page)).toEqual(['cat breed', 'dog', 'owner signed']);
    await expect(page.getByText('You’re signed out, so this is the owner’s Dictionary.')).toBeVisible();
    await expect(list(page).getByText('Shared by the owner')).toBeVisible();
  });

  test('D2: a signed-in customer sees their own dictionary, and no Add', async ({ page }) => {
    const asked = await mockStack(page, { session: { pubkey: CUST, assistantPubkey: CUST_TA, classification: 'customer' } });
    await page.goto(URL_);
    await expect(page.getByText(/concepts? in your Dictionary/)).toBeVisible();
    expect(asked.at(-1), 'a customer → their account and their assistant').toBe(`${CUST},${CUST_TA}`);
    expect(await names(page)).toEqual(['customer thing']);
    await page.getByRole('button', { name: /Don’t see what you’re looking for\?/ }).click();
    await expect(page.getByText('For now only the owner of this instance can add a concept from here.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to Dictionary' })).toHaveCount(0);
  });

  test('D3: the signed-in owner sees their dictionary, marked as theirs', async ({ page }) => {
    const asked = await mockStack(page, { session: { pubkey: OWNER, assistantPubkey: OWNER_TA, classification: 'owner' } });
    await page.goto(URL_);
    await expect(page.getByText(/concepts? in your Dictionary/)).toBeVisible();
    expect(asked.at(-1), 'the owner → the owner and the owner’s assistant').toBe(`${OWNER},${OWNER_TA}`);
    expect(await names(page)).toEqual(['cat breed', 'dog', 'owner signed']);
    await expect(list(page).getByText('Shared by you')).toBeVisible();
    await page.getByRole('button', { name: /Don’t see what you’re looking for\?/ }).click();
    await expect(page.getByText('For now only the owner of this instance can add a concept from here.')).toHaveCount(0);
  });

  test('D4: signed in with no assistant, the account alone, and the page says so', async ({ page }) => {
    const asked = await mockStack(page, { session: { pubkey: ADMIN_NO_TA, assistantPubkey: null, classification: 'admin' } });
    await page.goto(URL_);
    await expect(page.getByText(/concepts? in your Dictionary/)).toBeVisible();
    expect(asked.at(-1), 'no assistant → the account only').toBe(ADMIN_NO_TA);
    expect(await names(page)).toEqual(['admin thing']);
    await expect(page.getByText('You have no assistant key on this instance')).toBeVisible();
  });
});
