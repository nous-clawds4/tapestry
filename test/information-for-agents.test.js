/**
 * Story 1 (epic: information-for-agents) — the page and the briefing.
 *
 * Story: engineering-team/stories/information-for-agents/1-information-for-agents-page-and-briefing.md
 * ADR:   engineering-team/decisions/information-for-agents/0001-serve-the-briefing-and-build-the-page.md
 * Plan:  engineering-team/stories/information-for-agents/1-information-for-agents-page-and-briefing.test-plan.md
 *
 * Six test classes:
 *
 *   U-class (unit, stack-free) — the server's pure core in src/utils/siteTrust.js: the path
 *     constant, the briefing loader, the robots.txt allow line, and buildLlmsTxt's optional
 *     domain (byte-identical without one; one "## Start here" section with one).
 *
 *   P-class (unit, stack-free) — the page's pure prompt builder, ui/src/utils/agentPrompt.js,
 *     loaded by dynamic import(). The prompt's exact wording is a story criterion, so it is
 *     pinned here rather than left to a browser check.
 *
 *   B-class (content, stack-free) — the briefing file itself: the sections the story requires,
 *     a maturity label and a reference link per integration point, production endpoints only,
 *     and a visible review date. These are drift alarms for an editorial document.
 *
 *   S-class (structural, stack-free) — source sentinels for wiring a unit test can't see: route
 *     placement ahead of the session middleware and the SPA catch-all (a missed route returns
 *     the HTML shell with a 200 — .md is not a blocked extension, so nothing 404s), no static
 *     shadow copy, the page route, and the links in.
 *
 *   H-class (live HTTP against :7778, per-test SKIP when the stack is absent).
 *
 *   L-class (live link resolution over every markdown link in the briefing). SKIPs on a network
 *     failure AND on a cloud egress gateway's own 403 (ledger
 *     2026-10-04-llms-txt-egress-403-false-fail): that 403 is the sandbox refusing the host, not
 *     the host answering. Any other non-2xx FAILs.
 *
 * Until the feature lands: U/P/S fail (missing exports, module, route, page), B3 fails on the
 * whitelist section's missing reference link, and the stack-present H tests fail.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const SITE_TRUST = path.join(ROOT, 'src/utils/siteTrust.js');
const CONTROL_PANEL = path.join(ROOT, 'bin/control-panel.js');
const BRIEFING = path.join(ROOT, 'docs/information-for-agents.md');
const AGENT_PROMPT = path.join(ROOT, 'ui/src/utils/agentPrompt.js');
const PAGE = path.join(ROOT, 'ui/src/pages/InformationForAgents.jsx');
const APP = path.join(ROOT, 'ui/src/App.jsx');
const HUB = path.join(ROOT, 'ui/src/pages/developers/Hub.jsx');
const SKILL_PAGE = path.join(ROOT, 'ui/src/pages/BrainstormSkill.jsx');

const BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const SERVED_PATH = '/information-for-agents.md';
const PAGE_PATH = '/information-for-agents';

/** The story's prompt, verbatim, with its two slots. A spec, not a copy of the implementation. */
function expectedPrompt(project, origin) {
  return `I'm building ${project}. I'd like to use Brainstorm's web-of-trust technology in it: ` +
    'reputation scores, NIP-85 Trusted Assertions, Decentralized Lists, Trusted Lists, and the other ' +
    `protocols behind them. Read ${origin}/information-for-agents.md and follow its links to the specs ` +
    'that apply to my project. Then tell me which pieces fit, how I\'d integrate them, and what to build ' +
    'first. Point out anything that is still a draft. If you can\'t open web pages, tell me and I\'ll ' +
    'paste the file in.';
}

/** The story's two intro paragraphs, verbatim. */
const INTRO_PARAGRAPHS = [
  "Building something on nostr? Brainstorm's web-of-trust scores and the protocols behind them are " +
    'open, and you can use them in your own project. The fastest way to find out how is to ask your AI agent.',
  'Describe your project below, copy the prompt, and paste it into any agent that can read web pages.',
];

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

/** JSX source with entities decoded and whitespace collapsed, so copy that wraps across
 *  source lines (or is written as &apos;) still matches the story's sentence. */
function normalizedJsx(src) {
  return src
    .replace(/&apos;|&#39;|&rsquo;|’/g, "'")
    .replace(/\{' '\}/g, ' ')
    .replace(/\s+/g, ' ');
}

function loadSiteTrust() {
  const mod = require(SITE_TRUST);
  const missing = ['INFORMATION_FOR_AGENTS_PATH', 'INFORMATION_FOR_AGENTS_SOURCE', 'readInformationForAgents']
    .filter((k) => !(k in mod));
  if (missing.length) {
    throw new Error(`FEATURE MISSING: src/utils/siteTrust.js does not export ${missing.join(', ')} ` +
      '(ADR information-for-agents/0001).');
  }
  return mod;
}

async function loadAgentPrompt() {
  if (!fs.existsSync(AGENT_PROMPT)) {
    throw new Error('FEATURE MISSING: ui/src/utils/agentPrompt.js does not exist ' +
      '(ADR information-for-agents/0001 — the page\'s pure prompt builder).');
  }
  return import(pathToFileURL(AGENT_PROMPT).href);
}

/** The "### " subsections under "## What's on offer", as { heading, body }. */
function offerSections(md) {
  const start = md.indexOf("## What's on offer");
  const end = md.indexOf('\n## ', start + 1);
  const block = md.slice(start, end === -1 ? undefined : end);
  return block.split(/\n(?=### )/).slice(1).map((chunk) => {
    const nl = chunk.indexOf('\n');
    return { heading: chunk.slice(4, nl).trim(), body: chunk.slice(nl + 1) };
  });
}

function markdownLinks(md) {
  return [...md.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]);
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

async function stackPresent() {
  return (await fetchOrNull(`${BASE}/`)) !== null;
}

/** A 403 written by a sandbox's egress gateway, not by the host. Seen in Claude Code cloud
 *  containers: "Host not in allowlist: <host>. Add this host to your network egress settings…",
 *  and through the agent proxy, "GitHub access to this repository is not enabled for this
 *  session". The host never saw the request, so the link's health is unknown, not bad. */
function isEgressRefusal(status, body) {
  return status === 403 &&
    /Host not in allowlist|network egress settings|not enabled for this session/i.test(body || '');
}

async function checkLink(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal, redirect: 'follow' });
    const body = res.status === 403 ? await res.text().catch(() => '') : '';
    clearTimeout(t);
    if (isEgressRefusal(res.status, body)) return { skip: `egress gateway refused the host (${res.status})` };
    return { status: res.status };
  } catch (e) {
    return { skip: `no network (${e.cause?.code || e.message})` };
  }
}

/* ─────────────── U-class: the server's pure core ─────────────── */

test('U1 siteTrust exports the served path as /information-for-agents.md', () => {
  const { INFORMATION_FOR_AGENTS_PATH } = loadSiteTrust();
  assert(INFORMATION_FOR_AGENTS_PATH === SERVED_PATH,
    `INFORMATION_FOR_AGENTS_PATH must be "${SERVED_PATH}"; got ${JSON.stringify(INFORMATION_FOR_AGENTS_PATH)}.`);
});

test('U2 the briefing source is docs/information-for-agents.md (one source file, story AC)', () => {
  const { INFORMATION_FOR_AGENTS_SOURCE } = loadSiteTrust();
  assert(path.resolve(INFORMATION_FOR_AGENTS_SOURCE) === BRIEFING,
    `INFORMATION_FOR_AGENTS_SOURCE must resolve to ${BRIEFING}; got ${INFORMATION_FOR_AGENTS_SOURCE}.`);
});

test('U3 readInformationForAgents() resolves to the source file\'s exact content', async () => {
  const { readInformationForAgents } = loadSiteTrust();
  const served = await readInformationForAgents();
  const onDisk = readSafe(BRIEFING);
  assert(onDisk, 'docs/information-for-agents.md must exist.');
  assert(served === onDisk,
    'readInformationForAgents() must return the file verbatim — no transformation, no stale cache.');
});

test('U4 non-production robots.txt allows exactly /llms.txt and the briefing, then disallows the rest', () => {
  const { buildRobotsTxt } = loadSiteTrust();
  const expected = 'User-agent: *\nAllow: /llms.txt\nAllow: /information-for-agents.md\nDisallow: /\n';
  for (const arg of [undefined, {}, { allowIndexing: false }]) {
    const body = buildRobotsTxt(arg);
    assert(body === expected,
      `buildRobotsTxt(${JSON.stringify(arg)}) must be exactly ${JSON.stringify(expected)} — the briefing's ` +
      `allow line directly after /llms.txt's, ahead of the disallow, and nothing else allowed; got ${JSON.stringify(body)}.`);
  }
});

test('U5 production robots.txt is byte-unchanged', () => {
  const { buildRobotsTxt } = loadSiteTrust();
  const body = buildRobotsTxt({ allowIndexing: true });
  assert(body === 'User-agent: *\nAllow: /\n',
    `production robots.txt must stay "User-agent: *\\nAllow: /\\n"; got ${JSON.stringify(body)}.`);
});

test('U6 buildLlmsTxt without a usable domain is byte-identical to today\'s and names no briefing', () => {
  const { buildLlmsTxt } = loadSiteTrust();
  const base = buildLlmsTxt();
  assert(!/information-for-agents/.test(base),
    'buildLlmsTxt() with no domain must not link the briefing — a guessed host is worse than none.');
  for (const arg of [{}, { domain: '' }, { domain: '   ' }, { domain: 'localhost' }, { domain: undefined }]) {
    assert(buildLlmsTxt(arg) === base,
      `buildLlmsTxt(${JSON.stringify(arg)}) must equal buildLlmsTxt() byte for byte (ADR: localhost and ` +
      'empty are treated as absent, exactly as buildSecurityTxt does).');
  }
});

test('U7 buildLlmsTxt with a domain adds one "## Start here" section, first, linking the briefing on that host', () => {
  const { buildLlmsTxt } = loadSiteTrust();
  const base = buildLlmsTxt();
  const body = buildLlmsTxt({ domain: 'staging.brainstorm.world' });
  const startIdx = body.indexOf('## Start here');
  const protocolsIdx = body.indexOf('## Protocols');
  assert(startIdx !== -1, 'the domain variant must carry a "## Start here" section.');
  assert(startIdx < protocolsIdx, '"## Start here" must come before "## Protocols" — the first section an agent reads.');
  assert(body.indexOf('\n## ', 0) === startIdx - 1,
    '"## Start here" must be the first ## section (after the H1, blockquote, and notes).');
  const section = body.slice(startIdx, protocolsIdx);
  const links = markdownLinks(section);
  assert(links.length === 1 && links[0] === 'https://staging.brainstorm.world/information-for-agents.md',
    `"## Start here" must link exactly https://staging.brainstorm.world/information-for-agents.md; got ${JSON.stringify(links)}.`);
  assert(/^- \[[^\]]+\]\(https:\/\/[^)]+\): \S/m.test(section),
    'the link must follow the llmstxt.org list form "- [name](url): note".');
  assert(body.slice(0, startIdx) + body.slice(protocolsIdx) === base,
    'removing the "## Start here" section must give back buildLlmsTxt() exactly — nothing else may change.');
});

test('U8 buildLlmsTxt trims the configured domain', () => {
  const { buildLlmsTxt } = loadSiteTrust();
  const body = buildLlmsTxt({ domain: '  tapestry.brainstorm.world \n' });
  assert(body.includes('(https://tapestry.brainstorm.world/information-for-agents.md)'),
    'surrounding whitespace in DOMAIN_NAME must not leak into the link.');
});

/* ─────────────── P-class: the page's prompt builder ─────────────── */

test('P1 agentPrompt.js is import-free and exports the placeholder, the path, and the builder', async () => {
  const src = readSafe(AGENT_PROMPT);
  assert(src, 'FEATURE MISSING: ui/src/utils/agentPrompt.js does not exist.');
  assert(!/^\s*import\b/m.test(src), 'agentPrompt.js must stay import-free so Node suites can load it.');
  const mod = await loadAgentPrompt();
  assert(mod.PROJECT_PLACEHOLDER === '<describe your project>',
    `PROJECT_PLACEHOLDER must be "<describe your project>"; got ${JSON.stringify(mod.PROJECT_PLACEHOLDER)}.`);
  assert(mod.BRIEFING_PATH === SERVED_PATH, `BRIEFING_PATH must be "${SERVED_PATH}"; got ${JSON.stringify(mod.BRIEFING_PATH)}.`);
  assert(typeof mod.buildAgentPrompt === 'function', 'buildAgentPrompt must be an exported function.');
});

test('P2 the prompt reads exactly as the story specifies', async () => {
  const { buildAgentPrompt } = await loadAgentPrompt();
  const got = buildAgentPrompt({ project: 'a nostr client for long-form writers', origin: 'https://staging.brainstorm.world' });
  const want = expectedPrompt('a nostr client for long-form writers', 'https://staging.brainstorm.world');
  assert(got === want, `prompt wording must match the story verbatim.\n  want: ${want}\n  got:  ${got}`);
});

test('P3 an empty or blank project fills the slot with the placeholder', async () => {
  const { buildAgentPrompt } = await loadAgentPrompt();
  for (const project of ['', '   ', '\n\t', undefined, null]) {
    const got = buildAgentPrompt({ project, origin: 'https://tapestry.brainstorm.world' });
    assert(got === expectedPrompt('<describe your project>', 'https://tapestry.brainstorm.world'),
      `project ${JSON.stringify(project)} must give the placeholder prompt; got: ${got}`);
  }
});

test('P4 the project is trimmed and its inner whitespace collapsed to keep the prompt one paragraph', async () => {
  const { buildAgentPrompt } = await loadAgentPrompt();
  const got = buildAgentPrompt({ project: '  a relay\n  for   artists  ', origin: 'https://x.example' });
  assert(got === expectedPrompt('a relay for artists', 'https://x.example'),
    `the project must be trimmed and whitespace-collapsed; got: ${got}`);
});

test('P5 a trailing period in the project is not doubled', async () => {
  const { buildAgentPrompt } = await loadAgentPrompt();
  const got = buildAgentPrompt({ project: 'a podcast app for bitcoiners.', origin: 'https://x.example' });
  assert(got.startsWith("I'm building a podcast app for bitcoiners. I'd like"),
    `"I'm building X." must not become "X.."; got: ${got.slice(0, 80)}`);
});

test('P6 the briefing URL is the page\'s own origin plus the served path', async () => {
  const { buildAgentPrompt } = await loadAgentPrompt();
  const got = buildAgentPrompt({ project: 'p', origin: 'http://localhost:7778' });
  assert(got.includes(' Read http://localhost:7778/information-for-agents.md and '),
    `the URL must be origin + "/information-for-agents.md" (ADR: origin, not https:// + host); got: ${got}`);
});

test('P7 the copied prompt carries no markdown markup', async () => {
  const { buildAgentPrompt } = await loadAgentPrompt();
  const got = buildAgentPrompt({ project: 'p', origin: 'https://x.example' });
  assert(!/\*\*|__|`/.test(got), `the prompt must be plain text (no **, __ or backticks); got: ${got}`);
});

test('P8 the UI\'s briefing path agrees with the server\'s', async () => {
  const { INFORMATION_FOR_AGENTS_PATH } = loadSiteTrust();
  const { BRIEFING_PATH } = await loadAgentPrompt();
  assert(BRIEFING_PATH === INFORMATION_FOR_AGENTS_PATH,
    `ui BRIEFING_PATH (${BRIEFING_PATH}) must equal server INFORMATION_FOR_AGENTS_PATH (${INFORMATION_FOR_AGENTS_PATH}).`);
});

/* ─────────────── B-class: the briefing's content ─────────────── */

test('B1 the briefing exists, titled "The Technology Behind Brainstorm", with a review date', () => {
  const md = readSafe(BRIEFING);
  assert(md && md.length > 0, 'docs/information-for-agents.md must exist and be non-empty.');
  assert(/^# The Technology Behind Brainstorm\s*$/m.test(md.split('\n')[0]),
    'the first line must be "# The Technology Behind Brainstorm".');
  assert(/^Last reviewed: \d{4}-\d{2}-\d{2}\.?\s*$/m.test(md),
    'the briefing must carry a "Last reviewed: YYYY-MM-DD" line (ADR: staleness must be visible).');
});

test('B2 the briefing has the sections the story requires', () => {
  const md = readSafe(BRIEFING) || '';
  for (const h of ['## What Brainstorm is', '## The one idea to get right', "## What's on offer", '## Where to start']) {
    assert(md.includes(`\n${h}`), `the briefing must have a "${h}" section.`);
  }
  const headings = offerSections(md).map((s) => s.heading).join(' | ');
  for (const topic of ['NIP-85', 'Open Ranking', 'whitelist', 'NIP-50', 'Decentralized Lists', 'Trusted Lists', 'GrapeRank', 'R&D']) {
    assert(headings.toLowerCase().includes(topic.toLowerCase()),
      `"What's on offer" must have an integration-point section covering ${topic}; headings were: ${headings}`);
  }
});

test('B3 every integration point states its maturity and links a spec or reference document', () => {
  const md = readSafe(BRIEFING) || '';
  const sections = offerSections(md);
  assert(sections.length >= 8, `expected at least 8 integration-point sections; found ${sections.length}.`);
  const reference = /\((https:\/\/raw\.githubusercontent\.com\/[^)]+|https:\/\/api\.brainstorm\.world\/openapi\.json)\)/;
  for (const { heading, body } of sections) {
    const firstLine = body.trim().split('\n')[0];
    const isLastSection = heading === sections[sections.length - 1].heading;
    // Section 8 ("Also in R&D") states its maturity in its body ("All are drafts"), not a label line.
    if (!isLastSection) {
      assert(/^\*.*\b(Production|Published|Draft|R&D)\b.*\*$/.test(firstLine),
        `"${heading}" must open with an italic maturity line naming Production, Published, Draft or R&D; got: ${firstLine}`);
    } else {
      assert(/\bdrafts?\b/i.test(body), `"${heading}" must say its contents are drafts.`);
    }
    assert(reference.test(body),
      `"${heading}" must link its normative spec or reference document (raw markdown, or the OpenAPI ` +
      'document for API-only surfaces) — story AC: "each ... linking its normative spec".');
  }
});

test('B4 the briefing sends builders to production endpoints and labels R&D as R&D', () => {
  const md = readSafe(BRIEFING) || '';
  for (const host of ['staging.brainstorm.world', 'localhost', 'tags.brainstorm.world', 'magic-carpet.brainstorm.world']) {
    assert(!md.includes(host), `the briefing must not send builders to ${host} — production endpoints only.`);
  }
  assert(md.includes('https://api.brainstorm.world'), 'the briefing must name the production API host.');
  for (const { heading, body } of offerSections(md)) {
    if (body.includes('tapestry.brainstorm.world')) {
      assert(/^\*R&D\b/.test(body.trim()), `"${heading}" points at a Tapestry host, so it must be labeled R&D.`);
    }
  }
});

test('B5 the briefing points rather than restating wire formats: one code block, the NIP-50 example', () => {
  const md = readSafe(BRIEFING) || '';
  const fences = (md.match(/^```/gm) || []).length;
  assert(fences === 2, `the briefing may carry exactly one fenced code block (the NIP-50 REQ); found ${fences / 2}.`);
  const nip50 = offerSections(md).find((s) => s.heading.includes('NIP-50'));
  assert(nip50 && /```json\n\["REQ"/.test(nip50.body),
    'the one fenced block must be the NIP-50 REQ example inside the NIP-50 section (ADR: its only non-SPA home).');
});

test('B6 "Where to start" is a table with a row per project type', () => {
  const md = readSafe(BRIEFING) || '';
  const start = md.indexOf('## Where to start');
  const block = md.slice(start, md.indexOf('\n## ', start + 1));
  const rows = block.split('\n').filter((l) => /^\|/.test(l)).slice(2); // drop header + separator
  assert(rows.length >= 5, `"Where to start" must map at least 5 project types; found ${rows.length}.`);
});

/* ─────────────── S-class: source sentinels ─────────────── */

test('S1 control-panel registers the briefing route before the session middleware and the SPA catch-all', () => {
  const src = readSafe(CONTROL_PANEL) || '';
  const routeIdx = src.search(/app\.get\(\s*(?:INFORMATION_FOR_AGENTS_PATH|['"`]\/information-for-agents\.md['"`])/);
  const sessionIdx = src.search(/app\.use\(\s*session\(/);
  const catchAllIdx = src.indexOf("dist/index.html'");
  assert(routeIdx !== -1, 'bin/control-panel.js must register GET /information-for-agents.md.');
  assert(sessionIdx !== -1 && catchAllIdx !== -1, 'the session middleware and SPA catch-all must still exist.');
  assert(routeIdx < sessionIdx,
    'the route must precede app.use(session(...)) so agent fetches mint no Redis session.');
  assert(routeIdx < catchAllIdx,
    'the route must precede the SPA catch-all, or the request returns the HTML shell with a 200 — ' +
    '.md is not a blocked extension, so nothing would 404 to warn you.');
});

test('S2 the briefing route serves text/plain; charset=utf-8 from the loader', () => {
  const src = readSafe(CONTROL_PANEL) || '';
  const start = src.search(/app\.get\(\s*(?:INFORMATION_FOR_AGENTS_PATH|['"`]\/information-for-agents\.md['"`])/);
  assert(start !== -1, 'bin/control-panel.js must register GET /information-for-agents.md.');
  const handler = src.slice(start, src.indexOf('\n});', start) + 4);
  assert(/text\/plain; charset=utf-8/.test(handler), 'the handler must set Content-Type: text/plain; charset=utf-8.');
  assert(/readInformationForAgents\(\)/.test(handler), 'the handler must read the briefing through readInformationForAgents().');
});

test('S3 the /llms.txt route passes the deployment domain from DOMAIN_NAME, never the Host header', () => {
  const src = readSafe(CONTROL_PANEL) || '';
  assert(/buildLlmsTxt\(\s*\{\s*domain:\s*process\.env\.DOMAIN_NAME\s*\}\s*\)/.test(src),
    'the /llms.txt route must call buildLlmsTxt({ domain: process.env.DOMAIN_NAME }).');
  const start = src.search(/app\.get\(\s*LLMS_TXT_PATH/);
  const handler = src.slice(start, src.indexOf('\n});', start));
  assert(!/req\.(get|header|headers|hostname|host)\b/.test(handler),
    'the /llms.txt handler must not read the request host — it is attacker-controllable (same rule as security.txt).');
});

test('S4 no static copy of the briefing shadows the route', () => {
  const shadows = ['public/information-for-agents.md', 'ui/public/information-for-agents.md']
    .map((p) => path.join(ROOT, p)).filter((p) => fs.existsSync(p));
  assert(shadows.length === 0,
    `no static briefing may exist under public/ or ui/public/ — static middleware runs first and would serve ` +
    `it as text/markdown, diverging from the source (ADR guardrail). Found: ${shadows.join(', ')}.`);
});

test('S5 App.jsx routes /information-for-agents to the page', () => {
  const src = readSafe(APP) || '';
  assert(/import\s+InformationForAgents\s+from\s+['"]\.\/pages\/InformationForAgents['"]/.test(src),
    'App.jsx must import the page from ./pages/InformationForAgents.');
  assert(/path:\s*['"]\/information-for-agents['"],\s*element:\s*<InformationForAgents\s*\/>/.test(src.replace(/\s+/g, ' ')),
    'App.jsx must register { path: "/information-for-agents", element: <InformationForAgents /> }.');
});

test('S6 the page carries the story\'s title, copy, box, prompt builder and copy button', () => {
  const raw = readSafe(PAGE);
  assert(raw, 'FEATURE MISSING: ui/src/pages/InformationForAgents.jsx does not exist.');
  const src = normalizedJsx(raw);
  assert(/<DevPage\b/.test(src) && /title=["']The Technology Behind Brainstorm["']/.test(src),
    'the page must render DevPage titled "The Technology Behind Brainstorm".');
  assert(/back=\{false\}/.test(src), 'the page is not a /developers child, so DevPage must get back={false}.');
  for (const p of INTRO_PARAGRAPHS) assert(src.includes(p), `the page must carry the story's intro copy verbatim: "${p}"`);
  assert(/What are you building\?/.test(src) && /<textarea\b/.test(src),
    'the page must have a <textarea> labeled "What are you building?".');
  assert(/import\s*\{[^}]*buildAgentPrompt[^}]*\}\s*from\s*['"][./]*utils\/agentPrompt(\.js)?['"]/.test(src),
    'the page must build its prompt with buildAgentPrompt from utils/agentPrompt.');
  assert(/window\.location\.origin/.test(src), 'the prompt URL must come from window.location.origin (ADR).');
  assert(/Copy prompt/.test(src) && /Copied/.test(src) && /Couldn't copy/.test(src),
    'the page must offer "Copy prompt", confirm "Copied", and say "Couldn\'t copy" on failure.');
});

test('S7 the page links the briefing with a plain <a href>, never a router <Link>, and links /developers', () => {
  const src = normalizedJsx(readSafe(PAGE) || '');
  assert(/Read the briefing yourself/.test(src), 'the page must offer "Read the briefing yourself".');
  assert(/<a\b[^>]*href=\{?\s*(?:["']\/information-for-agents\.md["']|BRIEFING_PATH)/.test(src),
    'the briefing link must be <a href="/information-for-agents.md"> (or href={BRIEFING_PATH}).');
  assert(!/<Link\b[^>]*to=\{?\s*(?:["']\/information-for-agents\.md["']|BRIEFING_PATH)/.test(src),
    'a router <Link> to the .md would client-route to the SPA NotFound instead of fetching the file.');
  assert(/to=["']\/developers["']/.test(src), 'the page must link to /developers.');
});

test('S8 the /developers hub links the page in a card ahead of the NIP-50 card', () => {
  const src = readSafe(HUB) || '';
  const pageIdx = src.search(/to=["']\/information-for-agents["']/);
  const nip50Idx = src.search(/to=["']\/developers\/nip-50["']/);
  assert(pageIdx !== -1, 'Hub.jsx must link to /information-for-agents.');
  assert(nip50Idx !== -1 && pageIdx < nip50Idx, 'the "Ask your AI agent" card must come first, ahead of NIP-50.');
  assert(/Ask your AI agent/.test(src), 'the hub card must be titled "Ask your AI agent".');
});

test('S9 the "Using Your Agent" page points builders at the page', () => {
  const src = readSafe(SKILL_PAGE) || '';
  assert(/to=["']\/information-for-agents["']|href=["']\/information-for-agents["']/.test(src),
    'BrainstormSkill.jsx must link to /information-for-agents.');
});

/* ─────────────── H-class: live HTTP ─────────────── */

test('H1 GET /information-for-agents.md returns 200 text/plain with the file\'s content', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const res = await fetchOrNull(`${BASE}${SERVED_PATH}`);
  assert(res && res.status === 200, `expected 200; got ${res && res.status}.`);
  const ct = res.headers.get('content-type') || '';
  assert(/^text\/plain/i.test(ct) && /charset=utf-8/i.test(ct), `expected text/plain; charset=utf-8; got "${ct}".`);
  const body = await res.text();
  assert(!/<html/i.test(body), 'the response is the SPA shell — the route is missing or registered too late.');
  assert(body === readSafe(BRIEFING), 'the served body must equal docs/information-for-agents.md.');
});

test('H2 the live robots.txt exempts the briefing when the instance is non-indexing', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const res = await fetchOrNull(`${BASE}/robots.txt`);
  assert(res && res.status === 200, `expected 200; got ${res && res.status}.`);
  const body = await res.text();
  if (/^\s*Disallow:\s*\/\s*$/m.test(body)) {
    const allowIdx = body.indexOf(`Allow: ${SERVED_PATH}`);
    const disallowIdx = body.search(/^\s*Disallow:\s*\/\s*$/m);
    assert(allowIdx !== -1 && allowIdx < disallowIdx,
      `this instance is non-indexing; its robots.txt must allow ${SERVED_PATH} ahead of the disallow. Got:\n${body}`);
  }
});

test('H3 GET /information-for-agents serves the SPA (deep link works)', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const res = await fetchOrNull(`${BASE}${PAGE_PATH}`);
  assert(res && res.status === 200, `expected 200; got ${res && res.status}.`);
  assert(/text\/html/i.test(res.headers.get('content-type') || ''), 'the page route must return the SPA HTML.');
});

test('H4 the live llms.txt is either the domainless body or that body plus one "Start here" link to the briefing', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const res = await fetchOrNull(`${BASE}/llms.txt`);
  assert(res && res.status === 200, `expected 200; got ${res && res.status}.`);
  const served = await res.text();
  const { buildLlmsTxt } = loadSiteTrust();
  const base = buildLlmsTxt();
  if (served === base) return undefined;
  const startIdx = served.indexOf('## Start here');
  const protocolsIdx = served.indexOf('## Protocols');
  assert(startIdx !== -1 && startIdx < protocolsIdx, 'a domain-bearing llms.txt must carry "## Start here" before "## Protocols".');
  assert(/\(https:\/\/[^)/]+\/information-for-agents\.md\)/.test(served.slice(startIdx, protocolsIdx)),
    '"## Start here" must link https://<domain>/information-for-agents.md.');
  assert(served.slice(0, startIdx) + served.slice(protocolsIdx) === base,
    'apart from "## Start here", the live llms.txt must equal buildLlmsTxt().');
  return undefined;
});

/* ─── L-class: every markdown link in the briefing resolves (story AC) ─── */

const BRIEFING_LINKS = [...new Set(markdownLinks(readSafe(BRIEFING) || ''))];

test('L0 the briefing has links to check', () => {
  assert(BRIEFING_LINKS.length >= 15, `expected the briefing to link at least 15 documents; found ${BRIEFING_LINKS.length}.`);
});

for (const url of BRIEFING_LINKS) {
  test(`L1 briefing link resolves with 2xx: ${url}`, async () => {
    const r = await checkLink(url);
    if (r.skip) { console.log(`        (${r.skip})`); return 'SKIP'; }
    assert(r.status >= 200 && r.status < 300,
      `${url} must resolve with a 2xx; got ${r.status}. Fix the link in docs/information-for-agents.md ` +
      '(renewal ritual: OPEN.md row 172).');
    return undefined;
  });
}

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- information for agents: page and briefing (epic information-for-agents, Story 1) ---');
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
  console.log(`\ninformation-for-agents: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
