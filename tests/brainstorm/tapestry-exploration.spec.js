const { test, expect } = require('@playwright/test');

/**
 * tapestries #2: Tapestry Exploration page (rebuilds ui/src/pages/tapestries/TapestryDetail.jsx
 * at /tapestry/tapestries/:uuid).
 * ADR: engineering-team/decisions/tapestries/0002-exploration-page-as-authored-rendering.md
 *
 * Verifies (network-mocked; the page reads the element + its graph.imports from strfry via
 * queryRelay → /api/strfry/scan, dispatched here on the request filter's #d):
 *
 *   AC-1 — the page presents the Firmware-Explorer-style read-only views: a concept sidebar
 *          (member concepts), an integration graph, integration tables (enumerations/elements/
 *          subsets), and a JSON viewer — and NO install/version/constraints controls.
 *   AC-2 — for "Tapestry for Dog", the authored integrations show: dog-breed ENUMERATES dog.breed;
 *          dog-breed HAS_ELEMENT irish-setter + golden-retriever; dog-superset IS_A_SUPERSET_OF the
 *          two breed supersets.
 *   AC-3 — graph.imports are resolved and composed in: the integration graph reports more edges
 *          than the element's own 5 relationships (the +4 IS_THE_CONCEPT_FOR spine edges come only
 *          from resolving the 4 imported concept-graphs).
 *   AC-4 — an element with a missing/malformed graph block degrades gracefully (notice, no crash).
 *   AC-5 — the page resolves the tapestry by its uuid (a-tag coordinate), stable across edits.
 *
 * These fail against the current build: TapestryDetail is still the Story-1 placeholder
 * ("exploration coming soon") — none of the exploration views exist yet.
 */

test.describe('Tapestry Exploration page (tapestries #2)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  const TA = 'e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36';
  const EL_DTAG = 'tapestry-for-dog-ca3b675e';
  const EL_UUID = `39999:${TA}:${EL_DTAG}`;

  function ev(dTag, json) {
    return {
      id: 'f'.repeat(64), pubkey: TA, kind: 39999, created_at: 1784821324,
      tags: [['d', dTag], ['name', dTag], ['json', JSON.stringify(json)]],
      content: '', sig: '0'.repeat(128),
    };
  }

  // The seed tapestry element's graph block (9 nodes / 3 relTypes / 5 rels / 4 imports).
  const ELEMENT_JSON = {
    tapestry: { slug: 'tapestry-for-dog', title: 'Tapestry for Dog', description: 'The tapestry for dog.' },
    graph: {
      graphType: 'tapestry',
      nodes: [
        { slug: 'concept-header-for-the-concept-of-dogs', uuid: `39998:${TA}:dog`, name: 'dog' },
        { slug: 'concept-header-for-the-concept-of-dog-breeds', uuid: `39998:${TA}:dog-breed`, name: 'dog breed' },
        { slug: 'concept-header-for-the-concept-of-irish-setters', uuid: `39998:${TA}:irish-setter`, name: 'irish setter' },
        { slug: 'concept-header-for-the-concept-of-golden-retrievers', uuid: `39998:${TA}:golden-retriever`, name: 'golden retriever' },
        { slug: 'superset-for-the-concept-of-dogs', uuid: `39999:${TA}:dog-superset`, name: 'superset for the concept of dogs' },
        { slug: 'superset-for-the-concept-of-dog-breeds', uuid: `39999:${TA}:dog-breed-superset`, name: 'superset for the concept of dog breeds' },
        { slug: 'superset-for-the-concept-of-irish-setters', uuid: `39999:${TA}:irish-setter-superset`, name: 'superset for the concept of irish setters' },
        { slug: 'superset-for-the-concept-of-golden-retrievers', uuid: `39999:${TA}:golden-retriever-superset`, name: 'superset for the concept of golden retrievers' },
        { slug: 'dog.breed', name: 'dog.breed' },
      ],
      relationshipTypes: [
        { slug: 'CLASS_THREAD_PROPAGATION', alias: 'IS_A_SUPERSET_OF' },
        { slug: 'CLASS_THREAD_TERMINATION', alias: 'HAS_ELEMENT' },
        { slug: 'PROPERTY_ENUMERATION', alias: 'ENUMERATES' },
      ],
      relationships: [
        { nodeFrom: { slug: 'superset-for-the-concept-of-dogs' }, relationshipType: { slug: 'CLASS_THREAD_PROPAGATION' }, nodeTo: { slug: 'superset-for-the-concept-of-irish-setters' } },
        { nodeFrom: { slug: 'superset-for-the-concept-of-dogs' }, relationshipType: { slug: 'CLASS_THREAD_PROPAGATION' }, nodeTo: { slug: 'superset-for-the-concept-of-golden-retrievers' } },
        { nodeFrom: { slug: 'superset-for-the-concept-of-dog-breeds' }, relationshipType: { slug: 'CLASS_THREAD_TERMINATION' }, nodeTo: { slug: 'concept-header-for-the-concept-of-irish-setters' } },
        { nodeFrom: { slug: 'superset-for-the-concept-of-dog-breeds' }, relationshipType: { slug: 'CLASS_THREAD_TERMINATION' }, nodeTo: { slug: 'concept-header-for-the-concept-of-golden-retrievers' } },
        { nodeFrom: { slug: 'superset-for-the-concept-of-dog-breeds' }, relationshipType: { slug: 'PROPERTY_ENUMERATION' }, nodeTo: { slug: 'dog.breed' } },
      ],
      imports: [
        { slug: 'concept-graph-for-the-concept-of-dogs', uuid: `39999:${TA}:dog-concept-graph` },
        { slug: 'concept-graph-for-the-concept-of-dog-breeds', uuid: `39999:${TA}:dog-breed-concept-graph` },
        { slug: 'concept-graph-for-the-concept-of-irish-setters', uuid: `39999:${TA}:irish-setter-concept-graph` },
        { slug: 'concept-graph-for-the-concept-of-golden-retrievers', uuid: `39999:${TA}:golden-retriever-concept-graph` },
      ],
    },
  };

  // A concept-graph import: header + superset + the IS_THE_CONCEPT_FOR spine edge (alias-form slug).
  // The spine edge exists ONLY in the imports, never in the element — so its presence proves resolution.
  function importJson(concept, headerName, supersetName) {
    return {
      graph: {
        nodes: [
          { slug: `concept-header-for-the-concept-of-${concept}s`, uuid: `39998:${TA}:${concept}`, name: headerName },
          { slug: `superset-for-the-concept-of-${concept}s`, uuid: `39999:${TA}:${concept}-superset`, name: supersetName },
        ],
        relationshipTypes: [{ slug: 'IS_THE_CONCEPT_FOR' }],
        relationships: [{
          nodeFrom: { slug: `concept-header-for-the-concept-of-${concept}s` },
          relationshipType: { slug: 'IS_THE_CONCEPT_FOR' },
          nodeTo: { slug: `superset-for-the-concept-of-${concept}s` },
        }],
        imports: [],
      },
    };
  }

  // d-tag → event. Import d-tags mirror the element's graph.imports uuids.
  function fixtureMap({ element = ELEMENT_JSON } = {}) {
    return {
      [EL_DTAG]: ev(EL_DTAG, element),
      'dog-concept-graph': ev('dog-concept-graph', importJson('dog', 'dog', 'superset for the concept of dogs')),
      'dog-breed-concept-graph': ev('dog-breed-concept-graph', importJson('dog-breed', 'dog breed', 'superset for the concept of dog breeds')),
      'irish-setter-concept-graph': ev('irish-setter-concept-graph', importJson('irish-setter', 'irish setter', 'superset for the concept of irish setters')),
      'golden-retriever-concept-graph': ev('golden-retriever-concept-graph', importJson('golden-retriever', 'golden retriever', 'superset for the concept of golden retrievers')),
    };
  }

  /** Route /api/strfry/scan, dispatching on the filter's #d[0]. */
  async function mockScans(page, byDtag) {
    await page.route('**/api/strfry/scan**', (route) => {
      // Dispatch by which fixture d-tag appears in the request URL. Parsing the
      // `filter` query param is fragment-sensitive here — the encoded "#d" round-trips
      // as a URL fragment through the browser and is dropped by searchParams — so match
      // the d-tag substring directly (d-tags are alphanumeric/hyphen → they appear literally).
      const raw = route.request().url();
      const key = Object.keys(byDtag).find((k) => raw.includes(k));
      const e = key ? byDtag[key] : null;
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, events: e ? [e] : [] }),
      });
    });
    await page.route('**/api/assistant/pubkey', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, pubkey: TA }) }));
    await page.route('**/api/auth/user-classification', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ classification: 'unauthenticated', pubkey: null }) }));
  }

  const URL = `/tapestry/tapestries/${encodeURIComponent(EL_UUID)}`;

  /** Click an integration/concept sidebar control by accessible name, tolerating button-or-link. */
  async function pick(page, name) {
    const target = page.getByRole('button', { name }).or(page.getByRole('link', { name })).or(page.getByText(name)).first();
    await target.click();
  }

  /* ───────── AC-1 — the four read-only view families, no firmware-lifecycle controls ───────── */

  test('AC-1: shows concept sidebar + integration graph + integration tables + JSON viewer, and no install/version/constraints', async ({ page }) => {
    await mockScans(page, fixtureMap());
    await page.goto(URL);
    await page.waitForLoadState('networkidle');

    // Concept sidebar lists the member concepts.
    await expect(page.getByText('dog breed').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('irish setter').first()).toBeVisible();
    await expect(page.getByText('golden retriever').first()).toBeVisible();

    // The three integration tables + the integration graph are reachable.
    await expect(page.getByText(/enumerations/i).first()).toBeVisible();
    await expect(page.getByText(/elements/i).first()).toBeVisible();
    await expect(page.getByText(/subsets/i).first()).toBeVisible();
    await expect(page.getByText(/integration graph/i).first()).toBeVisible();

    // A JSON viewer affordance exists.
    await expect(page.getByText(/json/i).first()).toBeVisible();

    // No firmware-lifecycle controls.
    await expect(page.getByRole('button', { name: /install/i })).toHaveCount(0);
    await expect(page.getByText(/available versions|neo4j constraints|install firmware/i)).toHaveCount(0);
  });

  /* ───────── AC-2 — authored integrations render ───────── */

  test('AC-2: the authored integrations render (enumerates dog.breed; elements irish-setter/golden-retriever; subsets under dog)', async ({ page }) => {
    await mockScans(page, fixtureMap());
    await page.goto(URL);
    await page.waitForLoadState('networkidle');

    // Elements: dog-breed HAS_ELEMENT the two breeds.
    await pick(page, /elements/i);
    await expect(page.getByText(/irish setter/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/golden retriever/i).first()).toBeVisible();

    // Enumerations: dog-breed ENUMERATES dog.breed.
    await pick(page, /enumerations/i);
    await expect(page.getByText(/dog\.breed/i).first()).toBeVisible();

    // Subsets: dog superset IS_A_SUPERSET_OF the breed supersets.
    await pick(page, /subsets/i);
    await expect(page.getByText(/irish setter/i).first()).toBeVisible();
    await expect(page.getByText(/golden retriever/i).first()).toBeVisible();
  });

  /* ───────── AC-3 — imports resolved (composed edge count exceeds the element's own 5) ───────── */

  test('AC-3: resolving the 4 imports composes the IS_THE_CONCEPT_FOR spine — the graph reports more than 5 edges', async ({ page }) => {
    await mockScans(page, fixtureMap());
    await page.goto(URL);
    await page.waitForLoadState('networkidle');

    await pick(page, /integration graph/i);

    // The element alone declares 5 relationships; resolving the 4 imports adds 4 IS_THE_CONCEPT_FOR
    // spine edges → 9. Assert the graph's edge count is > 5 (only import resolution can raise it).
    const edgeText = page.getByText(/\d+\s*edges/i).first();
    await expect(edgeText).toBeVisible({ timeout: 10000 });
    const n = parseInt((await edgeText.innerText()).match(/(\d+)\s*edges/i)[1], 10);
    expect(n, 'composed graph should have more than the element\'s own 5 edges once imports resolve').toBeGreaterThan(5);
  });

  /* ───────── AC-4 — graceful degradation on a missing/malformed graph block ───────── */

  test('AC-4: an element with no graph block degrades gracefully (notice, no crash)', async ({ page }) => {
    // Element present but carries only the tapestry block — no `graph`.
    await mockScans(page, fixtureMap({ element: { tapestry: { slug: 'tapestry-for-dog', title: 'Tapestry for Dog', description: 'x' } } }));
    await page.goto(URL);
    await page.waitForLoadState('networkidle');

    // Still shows the title and a clear notice; does not crash into a raw error.
    await expect(page.getByText(/Tapestry for Dog/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/no graph|nothing to explore|not.*available|empty/i).first()).toBeVisible();
  });

  /* ───────── AC-5 — resolves the tapestry by its uuid ───────── */

  test('AC-5: the page resolves the tapestry by its uuid (a-tag coordinate)', async ({ page }) => {
    await mockScans(page, fixtureMap());
    await page.goto(URL);
    await page.waitForLoadState('networkidle');

    // The uuid-keyed URL resolves to THIS tapestry's exploration — its title AND a member concept
    // from its graph both render (distinguishing it from the Story-1 title-only placeholder).
    await expect(page.getByText(/Tapestry for Dog/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('dog breed').first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/tapestry/tapestries/.*${EL_DTAG}`));
  });
});
