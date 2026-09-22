/**
 * Story 1 (epic: llms-txt) — serve llms.txt on the fleet.
 *
 * Story: engineering-team/stories/done/llms-txt/1-serve-llms-txt-on-the-fleet.md
 * ADR:   engineering-team/decisions/done/llms-txt/0001-serve-llms-txt-on-the-fleet.md
 *
 * Four test classes:
 *
 *   U-class (unit, stack-free) — the ADR's pure core: `buildLlmsTxt()` and the
 *     new behaviour of `buildRobotsTxt()`, both from src/utils/siteTrust.js.
 *     Covers the llmstxt.org format order (AC-2), the exact link inventory per
 *     section (AC-3), the required blockquote/notes facts (AC-4), production
 *     robots.txt staying byte-unchanged (AC-5), and the /llms.txt exemption on
 *     non-production robots.txt (AC-6). These gate the build.
 *
 *   S-class (structural, stack-free) — source sentinels. S2 is the single most
 *     important test in this file: the ADR found, by calling
 *     isBlockedProbePath('/llms.txt') directly, that `.txt` is in
 *     BLOCKED_EXTENSIONS — so the new route 404s itself unless it is
 *     registered before the honest-404 deny-rule middleware. Get this wrong
 *     and every U-class test still passes while the live site serves nothing.
 *
 *   H-class (live HTTP against :7778, per-test SKIP when the stack is absent)
 *     — the real control panel. /llms.txt must actually be reachable and
 *     match the unit-tested content; robots.txt's exemption must show up on
 *     the wire, not just in the pure function.
 *
 *   L-class (live link resolution, per-link SKIP on network failure rather
 *     than stack absence) — story AC-7: every linked URL must resolve. A
 *     timeout/DNS failure SKIPs that link (most likely no outbound network in
 *     this environment); an actual non-2xx response FAILs it (a real broken
 *     link). This is the automated half of the "ongoing check" the story asks
 *     for; the human half is OPEN.md row 172's renewal ritual, extended by
 *     this phase to also cover these links (see that row).
 *
 * ALL U/S tests and (stack-present) H tests FAIL until the feature lands:
 * buildLlmsTxt does not exist yet, and /llms.txt returns the SPA shell today.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_TRUST = path.join(ROOT, 'src/utils/siteTrust.js');
const CONTROL_PANEL = path.join(ROOT, 'bin/control-panel.js');

const BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

/** The exact link inventory the story specifies (AC-3), independent of the
 *  implementation so this is a spec, not a tautology. Section order matches
 *  the story's own bullet order: Protocols, Tapestry, Optional. */
const REQUIRED_LINKS = {
  Protocols: [
    'https://raw.githubusercontent.com/NosFabrica/protocols/main/CONCEPTS.md',
    'https://raw.githubusercontent.com/NosFabrica/protocols/main/specs/trusted-assertions.md',
    'https://raw.githubusercontent.com/NosFabrica/protocols/main/specs/graperank.md',
    'https://raw.githubusercontent.com/NosFabrica/protocols/main/ECOSYSTEM.md',
  ],
  Tapestry: [
    'https://raw.githubusercontent.com/nous-clawds4/tapestry/main/README.md',
    'https://raw.githubusercontent.com/nous-clawds4/tapestry/main/AGENTS.md',
    'https://raw.githubusercontent.com/nous-clawds4/tapestry/main/protocols/README.md',
    'https://raw.githubusercontent.com/nous-clawds4/tapestry-cli/main/README.md',
  ],
  Optional: [
    'https://raw.githubusercontent.com/nous-clawds4/tapestry/main/BIBLE.md',
    'https://raw.githubusercontent.com/nous-clawds4/brainstorm-cli/main/README.md',
    'https://api.brainstorm.world/openapi.json',
    'https://raw.githubusercontent.com/nous-clawds4/tapestry/main/SECURITY.md',
  ],
};
const ALL_LINKS = [].concat(...Object.values(REQUIRED_LINKS));

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

/** Load the feature module, failing loudly while it does not yet exist —
 *  mirrors test/site-trust-signals.test.js's loadSiteTrust(). */
function loadSiteTrust() {
  if (!fs.existsSync(SITE_TRUST)) {
    throw new Error(
      'FEATURE MISSING: src/utils/siteTrust.js does not exist. ' +
      'ADR llms-txt/0001 requires it to export buildLlmsTxt (and an updated buildRobotsTxt).'
    );
  }
  const mod = require(SITE_TRUST);
  if (typeof mod.buildLlmsTxt !== 'function') {
    throw new Error(
      'FEATURE MISSING: src/utils/siteTrust.js does not export buildLlmsTxt yet.'
    );
  }
  return mod;
}

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

async function fetchOrNull(url, opts) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { ...opts, signal: ctrl.signal, redirect: 'manual' });
    clearTimeout(t);
    return res;
  } catch { return null; }
}

/** H-class guard: is the control panel answering at all? */
async function stackPresent() {
  const res = await fetchOrNull(`${BASE}/`);
  return res !== null;
}

/** L-class guard: a bounded fetch that distinguishes "no network" (SKIP) from
 *  "network fine, response is bad" (FAIL). Longer timeout than fetchOrNull's
 *  10s — GitHub raw content and the production OpenAPI doc can be slow. */
async function fetchForLinkCheck(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal, redirect: 'follow' });
    clearTimeout(t);
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ─────────────── U-class: the pure core ─────────────── */

test('U1 buildLlmsTxt follows the llmstxt.org format: H1, then blockquote, then ## sections', () => {
  const { buildLlmsTxt } = loadSiteTrust();
  const body = buildLlmsTxt();
  assert(typeof body === 'string' && body.length > 0, 'buildLlmsTxt() must return a non-empty string.');
  const lines = body.split(/\r?\n/);
  const h1Idx = lines.findIndex((l) => /^#\s+\S/.test(l));
  assert(h1Idx !== -1, 'the document must have an H1 title line (llmstxt.org: "the only required section").');
  const quoteIdx = lines.findIndex((l, i) => i > h1Idx && /^>\s*\S/.test(l));
  assert(quoteIdx !== -1 && quoteIdx > h1Idx,
    'a blockquote summary must follow the H1 (llmstxt.org format).');
  const firstH2Idx = lines.findIndex((l) => /^##\s+\S/.test(l));
  assert(firstH2Idx !== -1 && firstH2Idx > quoteIdx,
    'at least one ## section must follow the blockquote.');
  // Nothing between the H1 and the blockquote except blank lines — the format
  // allows non-heading notes, but they come AFTER the blockquote, not before it.
  for (let i = h1Idx + 1; i < quoteIdx; i++) {
    assert(lines[i].trim() === '',
      `only blank lines are allowed between the H1 and the blockquote; line ${i + 1} was ${JSON.stringify(lines[i])}.`);
  }
});

test('U2 buildLlmsTxt carries the three required facts in its blockquote/notes', () => {
  const { buildLlmsTxt } = loadSiteTrust();
  const body = buildLlmsTxt();
  const lines = body.split(/\r?\n/);
  const firstH2Idx = lines.findIndex((l) => /^##\s+\S/.test(l));
  const preamble = lines.slice(0, firstH2Idx === -1 ? lines.length : firstH2Idx).join('\n');

  assert(/grape ?rank/i.test(preamble) && /point of view/i.test(preamble),
    'the preamble must describe GrapeRank scores computed from a chosen observer\'s point of view (story AC-4).');
  assert(/single[- ]page app|SPA/i.test(preamble) && /(empty|blank).{0,20}(shell|html)/i.test(preamble),
    'the preamble must warn that the site is a JS SPA returning an empty shell to non-JS clients (story AC-4).');
  assert(/no global trust score|no (single|one|global) (trust )?score/i.test(preamble),
    'the preamble must state there is no global trust score (story AC-4).');
});

for (const [section, links] of Object.entries(REQUIRED_LINKS)) {
  test(`U3 buildLlmsTxt's "## ${section}" section links exactly the required ${links.length} documents`, () => {
    const { buildLlmsTxt } = loadSiteTrust();
    const body = buildLlmsTxt();
    const lines = body.split(/\r?\n/);
    const headingIdx = lines.findIndex((l) => l.trim() === `## ${section}`);
    assert(headingIdx !== -1, `a "## ${section}" section heading must exist.`);
    const nextHeadingIdx = lines.findIndex((l, i) => i > headingIdx && /^##\s+\S/.test(l));
    const sectionBody = lines.slice(headingIdx + 1, nextHeadingIdx === -1 ? lines.length : nextHeadingIdx).join('\n');
    const missing = links.filter((url) => !sectionBody.includes(url));
    assert(missing.length === 0,
      `"## ${section}" must link every required document; missing: ${missing.join(', ')}.`);
    // Each must be an actual markdown link, not a bare URL — llmstxt.org requires
    // "a required markdown hyperlink [name](url)".
    for (const url of links) {
      assert(sectionBody.includes(`](${url})`),
        `"${url}" must appear as a markdown link "[name](${url})", not a bare URL.`);
    }
  });
}

test('U4 buildLlmsTxt sections appear in the required order: Protocols, Tapestry, Optional', () => {
  const { buildLlmsTxt } = loadSiteTrust();
  const body = buildLlmsTxt();
  const order = ['Protocols', 'Tapestry', 'Optional'].map((s) => body.indexOf(`## ${s}`));
  assert(order.every((i) => i !== -1), `all three sections must exist; indices: ${JSON.stringify(order)}.`);
  assert(order[0] < order[1] && order[1] < order[2],
    `sections must appear in order Protocols, Tapestry, Optional; got indices ${JSON.stringify(order)}.`);
});

test('U5 buildLlmsTxt names no link outside the required 12 (content stays a pointer manifest)', () => {
  const { buildLlmsTxt } = loadSiteTrust();
  const body = buildLlmsTxt();
  const found = [...body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]);
  const extra = found.filter((u) => !ALL_LINKS.includes(u));
  assert(extra.length === 0,
    `llms.txt must only link the 12 required documents (the estate discrepancy rule — it points, ` +
    `it does not grow its own inventory); unexpected links: ${extra.join(', ')}.`);
});

test('U6 buildRobotsTxt({allowIndexing:true}) is unchanged from site-trust-signals', () => {
  const { buildRobotsTxt } = loadSiteTrust();
  assert(buildRobotsTxt({ allowIndexing: true }) === 'User-agent: *\nAllow: /\n',
    'the indexing branch must stay byte-identical to the pre-existing site-trust-signals output ' +
    '(story AC-5: "behavior unchanged"); this story only touches the non-indexing branch.');
});

test('U7 buildRobotsTxt exempts /llms.txt on non-production hosts, ahead of the blanket disallow', () => {
  const { buildRobotsTxt } = loadSiteTrust();
  for (const arg of [{ allowIndexing: false }, {}, undefined]) {
    const body = buildRobotsTxt(arg);
    const allowIdx = body.indexOf('Allow: /llms.txt');
    const disallowIdx = body.search(/^\s*Disallow:\s*\/\s*$/m);
    assert(allowIdx !== -1,
      `robots.txt must exempt /llms.txt with an "Allow: /llms.txt" line for ${JSON.stringify(arg)}; got:\n${body}`);
    assert(disallowIdx !== -1,
      `robots.txt must still carry the blanket "Disallow: /" for ${JSON.stringify(arg)}; got:\n${body}`);
    assert(allowIdx < disallowIdx,
      `"Allow: /llms.txt" must appear AHEAD of "Disallow: /" (story AC-6); got:\n${body}`);
  }
});

/* ─────────────── S-class: source sentinels ─────────────── */

test('S1 control-panel registers the /llms.txt route', () => {
  const src = readSafe(CONTROL_PANEL);
  assert(src, 'bin/control-panel.js must be readable.');
  assert(/['"`]\/llms\.txt['"`]/.test(src),
    'bin/control-panel.js must register GET /llms.txt.');
});

test('S2 the /llms.txt route is registered BEFORE the honest-404 deny-rule middleware', () => {
  const src = readSafe(CONTROL_PANEL);
  // .txt IS in BLOCKED_EXTENSIONS (verified directly: isBlockedProbePath('/llms.txt') === true,
  // exactly like /robots.txt today) — so if this route were registered AFTER the deny rule, or
  // the deny rule ran first for any other reason, /llms.txt would 404 itself. This is the load-
  // bearing placement fact the ADR calls out; every OTHER test in this file could pass while the
  // live site still serves nothing, if this one regresses.
  const routeIdx = src.search(/app\.get\(\s*(?:LLMS_TXT_PATH|['"`]\/llms\.txt['"`])/);
  const denyIdx = src.lastIndexOf('isBlockedProbePath');
  assert(routeIdx !== -1, 'bin/control-panel.js must register a GET handler for /llms.txt.');
  assert(denyIdx !== -1, 'the honest-404 deny rule (isBlockedProbePath) must still exist.');
  assert(routeIdx < denyIdx,
    'the /llms.txt route must be registered BEFORE the deny-rule middleware, or ' +
    'isBlockedProbePath("/llms.txt") (true — .txt is a blocked extension) 404s it before the ' +
    'route handler ever runs.');
});

test('S3 no static llms.txt file shadows the route', () => {
  // ADR guardrail: express.static(dist) is registered before this route. A stray file at
  // ui/public/llms.txt (copied into dist/ by the Vite build) would be served first and the
  // explicit route would become dead code, silently diverging from buildLlmsTxt()'s content.
  const shadowPaths = [
    path.join(ROOT, 'ui/public/llms.txt'),
    path.join(ROOT, 'public/llms.txt'),
  ];
  const present = shadowPaths.filter((p) => fs.existsSync(p));
  assert(present.length === 0,
    `no static llms.txt file may exist under ui/public/ or public/ — it would shadow the ` +
    `explicit route (ADR llms-txt/0001, Guardrail). Found: ${present.join(', ')}.`);
});

/* ─────────────── H-class: live HTTP ─────────────── */

test('H1 GET /llms.txt returns 200 as text/plain, matching buildLlmsTxt()', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const res = await fetchOrNull(`${BASE}/llms.txt`);
  assert(res && res.status === 200, `expected 200; got ${res && res.status}.`);
  const ct = res.headers.get('content-type') || '';
  assert(/text\/plain/i.test(ct), `expected text/plain; got "${ct}".`);
  assert(/charset=utf-8/i.test(ct), `expected charset=utf-8; got "${ct}".`);
  const served = await res.text();
  const { buildLlmsTxt } = loadSiteTrust();
  assert(served === buildLlmsTxt(),
    'the served body must exactly match buildLlmsTxt() — the route must call the builder, ' +
    'not carry a separate, driftable copy of the content.');
});

test('H2 GET /robots.txt on this instance shows the /llms.txt exemption live', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const res = await fetchOrNull(`${BASE}/robots.txt`);
  assert(res && res.status === 200, `expected 200; got ${res && res.status}.`);
  const body = await res.text();
  // Whichever branch this instance is in (indexing on or off), the response must be
  // well-formed; if it's the non-indexing branch, the exemption must be present and precede
  // the disallow — confirms the env var actually reaches buildRobotsTxt end-to-end, not just
  // the pure function in isolation.
  if (/^\s*Disallow:\s*\/\s*$/m.test(body)) {
    const allowIdx = body.indexOf('Allow: /llms.txt');
    const disallowIdx = body.search(/^\s*Disallow:\s*\/\s*$/m);
    assert(allowIdx !== -1 && allowIdx < disallowIdx,
      `this instance is non-indexing; its live robots.txt must exempt /llms.txt ahead of the ` +
      `disallow. Got:\n${body}`);
  }
});

test('H3 a small representative regression sweep: probe and SPA paths still behave (AC-8)', async () => {
  if (!(await stackPresent())) return 'SKIP';
  // Full exhaustive coverage of this guarantee lives in test/site-trust-signals.test.js
  // (PROBE_PATHS, SPA_PATHS), which stays in the gate unmodified. This is a small,
  // complementary confirmation that adding /llms.txt didn't disturb it.
  const probe = await fetchOrNull(`${BASE}/.env`);
  assert(probe && probe.status === 404, `probe paths must still 404; /.env got ${probe && probe.status}.`);
  const spa = await fetchOrNull(`${BASE}/about`);
  assert(spa && spa.status === 200, `SPA routes must still resolve; /about got ${spa && spa.status}.`);
  const api = await fetchOrNull(`${BASE}/api/assistant/pubkey`);
  assert(api && api.status !== 404, `/api/ routes must be unaffected; got ${api && api.status}.`);
});

/* ─── L-class: live link resolution (story AC-7) — per-link SKIP on network failure ─── */

for (const url of ALL_LINKS) {
  test(`L1 link resolves with 2xx: ${url}`, async () => {
    const result = await fetchForLinkCheck(url);
    if (!result.ok) return 'SKIP'; // no outbound network in this environment — not a link defect
    assert(result.status >= 200 && result.status < 300,
      `${url} must resolve with a 2xx status; got ${result.status}. This is the automated half ` +
      'of story AC-7 — the human half is OPEN.md row 172\'s renewal ritual.');
  });
}

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- llms.txt on the fleet (epic llms-txt, Story 1) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\nllms-txt: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
