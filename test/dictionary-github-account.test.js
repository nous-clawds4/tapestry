/**
 * The GitHub Accounts DList's item page (/dictionary/:coord/items/:item): an item of that DList shows the
 * account as GitHub does — avatar, name and login, View on GitHub, the public profile and the recently
 * active repositories — read by the reader's browser from GitHub's public REST API.
 *
 *   G1..G10 — pure: ui/src/pages/dictionary/github.js (dynamic import): the login read off the item, the
 *            DList recognised by its shared concept, the API's answer checked field by field, the
 *            repositories chosen, a failed read named, and the Items as one row per account.
 *   S1..S6 — structural pins, read off comment-stripped source: the page is chosen by the shared concept
 *            whichever instance's header it's on, the reads are unsigned and send no referrer, the
 *            avatar costs no API read, every other item keeps the generic page, the entry page lists one
 *            row per account (S5), and the item page agrees on its number (S6). (The footer every item
 *            page shares, filer and raw event, is pinned by test/dictionary-entry.test.js E8.)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const UI = path.join(ROOT, 'ui/src');
const GITHUB_JS = path.join(UI, 'pages/dictionary/github.js');
const GITHUB_JSX = path.join(UI, 'pages/dictionary/GithubAccount.jsx');
const HOOK_JS = path.join(UI, 'pages/dictionary/useGithubAccount.js');
const ITEM_JSX = path.join(UI, 'pages/dictionary/Item.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function src(p) {
  let s = '';
  try { s = fs.readFileSync(p, 'utf8'); } catch { /* reported below */ }
  assert(s.length > 0, `${path.relative(ROOT, p)} must exist`);
  return s;
}
const flat = (s) => s.replace(/\s+/g, ' ');
/** Source with comments blanked out, so prose cannot satisfy an assertion. */
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

let _gh;
async function gh() {
  if (_gh === undefined) {
    try { _gh = await import(pathToFileURL(GITHUB_JS).href); } catch (err) { _gh = err; }
  }
  assert(!(_gh instanceof Error), `ui/src/pages/dictionary/github.js must import: ${_gh && _gh.message}`);
  return _gh;
}

const SHARED = '39998:b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450:github-accounts';
const item = (...tags) => ({ kind: 39999, tags: [['d', 'x-1'], ['z', SHARED], ...tags] });

test('G1: the DList is recognised by its shared concept, the same coordinate on every deployment', async () => {
  const m = await gh();
  eq(m.GITHUB_ACCOUNTS, SHARED, 'the shared concept');
  assert(m.isGithubAccounts([`39998:${'a'.repeat(64)}:github-account`, SHARED]), 'an instance header that points to it');
  assert(!m.isGithubAccounts([`39998:${'a'.repeat(64)}:github-accounts`]), 'another author\'s same-named header is not it');
  assert(!m.isGithubAccounts(null) && !m.isGithubAccounts([]), 'nothing known, nothing recognised');
});

test('G2: the login is the item\'s github-username, as GitHub would accept it', async () => {
  const { normalizeLogin } = await gh();
  eq(normalizeLogin('wds4'), 'wds4', 'a plain login');
  eq(normalizeLogin('  @nous-clawds4 '), 'nous-clawds4', '"@" and spaces dropped');
  eq(normalizeLogin('https://github.com/vcavallo'), 'vcavallo', 'a profile link');
  eq(normalizeLogin('github.com/aburra16/'), 'aburra16', 'a link without the scheme');
  eq(normalizeLogin('https://github.com/wds4?tab=repositories'), 'wds4', 'a link to a tab');
  for (const bad of ['', '-lead', 'trail-', 'dou--ble', 'a'.repeat(40), 'has space', '../x', 'a/b', 'https://gitlab.com/x', 42, null]) {
    eq(normalizeLogin(bad), null, `not a login: ${JSON.stringify(bad)}`);
  }
  eq(normalizeLogin('a'.repeat(39)), 'a'.repeat(39), 'thirty-nine characters is the limit');
});

test('G3: githubLogin reads the first github-username tag that is a login', async () => {
  const { githubLogin } = await gh();
  eq(githubLogin(item(['github-username', 'wds4'])), 'wds4', 'the tag');
  eq(githubLogin(item(['github-username', 'not a login'], ['github-username', 'wds4'])), 'wds4', 'a bad value is passed over');
  eq(githubLogin(item(['description', 'wds4'])), null, 'no tag, no login');
  eq(githubLogin(null), null, 'no event');
});

test('G4: the profile is checked field by field; links keep to http(s), and the blog may omit its scheme', async () => {
  const { summarizeUser } = await gh();
  const u = summarizeUser({
    login: 'wds4', name: ' David Strayhorn ', type: 'User', bio: 'the Grapevine & the Concept Graph', company: null,
    location: 'earth', blog: 'example.com/me', twitter_username: 'davidstrayhorn', public_repos: 71, followers: 37,
    following: 91, created_at: '2015-03-12T20:21:09Z',
  }, 'wds4');
  eq(u.name, 'David Strayhorn', 'trimmed');
  eq(u.company, null, 'null stays null');
  eq(u.blog, 'https://example.com/me', 'a blog without a scheme is https');
  eq([u.publicRepos, u.followers, u.following], [71, 37, 91], 'the counts');
  eq(u.organization, false, 'a user');
  eq(summarizeUser({ type: 'Organization' }, 'acme').organization, true, 'an organization');
  eq(summarizeUser({ blog: 'javascript:alert(1)' }, 'x').blog, null, 'no script links');
  eq(summarizeUser({ blog: 'localhost' }, 'x').blog, null, 'a bare word is no site');
  eq(summarizeUser({ twitter_username: 'bad handle!' }, 'x').twitter, null, 'an X handle must be one');
  eq(summarizeUser({ followers: -1, public_repos: '7' }, 'x').followers, null, 'a count must be a whole number');
  eq(summarizeUser({ login: 'evil/../x' }, 'wds4').login, 'wds4', 'GitHub\'s login is used only when it is one');
  eq(summarizeUser(null, 'x'), null, 'no profile');
  eq(summarizeUser([], 'x'), null, 'a list is no profile');
});

test('G5: the recent repositories are the account\'s own, newest push first, linking only to github.com', async () => {
  const { recentRepos } = await gh();
  const r = (name, pushed, extra = {}) => ({ name, html_url: `https://github.com/u/${name}`, pushed_at: pushed, ...extra });
  const out = recentRepos([
    r('old', '2024-01-01T00:00:00Z'),
    r('forked', '2026-09-01T00:00:00Z', { fork: true }),
    r('new', '2026-09-02T00:00:00Z', { stargazers_count: 3, language: 'Rust', archived: true }),
    r('offsite', '2026-09-03T00:00:00Z', { html_url: 'https://evil.example/u/offsite' }),
    r('nopush', null),
  ]);
  eq(out.map((x) => x.name), ['new', 'old', 'nopush'], 'forks and off-site links set aside, newest push first');
  eq([out[0].stars, out[0].language, out[0].archived], [3, 'Rust', true], 'what each card shows');
  eq(recentRepos(Array.from({ length: 9 }, (_, i) => r(`r${i}`, `2026-01-0${i + 1}T00:00:00Z`))).length, 6, 'six at most');
  eq(recentRepos({ message: 'Not Found' }), [], 'an answer that isn\'t a list');
});

test('G6: a failed read is named: no such account, the hourly limit, or the status', async () => {
  const { readFailure } = await gh();
  const h = (o) => ({ get: (k) => (k in o ? o[k] : null) });
  eq(readFailure(404, h({})), { kind: 'missing' }, '404');
  eq(readFailure(403, h({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791007673' })),
    { kind: 'limited', resetAt: 1791007673000 }, '403 with none remaining is the limit, with its reset');
  eq(readFailure(429, h({})), { kind: 'limited', resetAt: null }, '429 is the limit');
  eq(readFailure(403, h({ 'x-ratelimit-remaining': '12' })).kind, 'error', 'a 403 with reads left is not the limit');
  eq(readFailure(500, null), { kind: 'error', message: 'GitHub answered HTTP 500' }, 'anything else');
});

test('G7: links are built from the login alone', async () => {
  const m = await gh();
  eq(m.profileUrl('wds4'), 'https://github.com/wds4', 'the profile');
  eq(m.profileUrl('wds4', 'followers'), 'https://github.com/wds4?tab=followers', 'a tab');
  eq(m.avatarUrl('wds4'), 'https://github.com/wds4.png?size=192', 'the avatar, which costs no API read');
  eq(m.userApiUrl('wds4'), 'https://api.github.com/users/wds4', 'the profile read');
  assert(/^https:\/\/api\.github\.com\/users\/wds4\/repos\?type=owner&sort=pushed&per_page=12$/.test(m.reposApiUrl('wds4')), 'the repositories read');
  eq(m.githubHref('https://github.com/wds4/tapestry'), 'https://github.com/wds4/tapestry', 'a github.com link');
  eq(m.githubHref('http://github.com/wds4'), null, 'not over http');
  eq(m.githubHref('https://github.com.evil.example/x'), null, 'not a look-alike host');
});

test('G8: dates and counts read as GitHub writes them', async () => {
  const m = await gh();
  eq(m.joinedLabel('2015-03-12T20:21:09Z'), 'March 2015', 'joined');
  eq(m.joinedLabel('soon'), null, 'not a date');
  eq([m.compactCount(37), m.compactCount(1234), m.compactCount(15000)], ['37', '1.2k', '15k'], 'counts');
  const now = Date.parse('2026-10-03T12:00:00Z');
  eq(m.updatedLabel('2026-10-03T01:00:00Z', now), 'today', 'today');
  eq(m.updatedLabel('2026-10-02T01:00:00Z', now), 'yesterday', 'yesterday');
  eq(m.updatedLabel('2026-09-30T12:00:00Z', now), '3 days ago', 'days');
  eq(m.updatedLabel('2026-07-01T12:00:00Z', now), '3 months ago', 'months');
  eq(m.updatedLabel('2022-10-01T12:00:00Z', now), '4 years ago', 'years');
  eq(m.updatedLabel(null, now), null, 'no date');
});

test('G9: an unknown language is grey', async () => {
  const { languageColor } = await gh();
  eq(languageColor('JavaScript'), '#f1e05a', 'a known one');
  eq(languageColor('Befunge'), '#8c929e', 'an unknown one');
});

test('G10: the Items are one row per account: the earliest filing stands for it, every filer named', async () => {
  const { githubRows, githubRowOf } = await gh();
  const it = (id, author, login, description) => ({
    id: id.repeat(64), address: `39999:${author.repeat(64)}:${id}`, author: author.repeat(64), name: `${login}-x`,
    description: description || null, properties: login ? { 'github-username': login } : {},
  });
  const rows = githubRows([
    it('1', 'a', 'wds4', 'David Strayhorn'),
    it('2', 'b', 'vitorpamplona'),
    it('3', 'c', 'VitorPamplona', 'Vitor'),
    it('4', 'a', null, 'no login'),
    it('5', 'b', 'vitorpamplona'),
    it('6', 'd', 'bad login!'),
  ]);
  eq(rows.map((r) => [r.n, r.login, r.filers.length]), [[1, 'wds4', 1], [2, 'vitorpamplona', 2], [3, null, 1], [4, null, 1]],
    'filings of one login (any case) are one row, numbered in order; a filing with no login is its own row');
  eq(rows[1].id, '2'.repeat(64), 'the earliest filing stands for the row');
  eq(rows[1].filers, ['b'.repeat(64), 'c'.repeat(64)], 'every filer, once each, in filing order');
  eq(rows[1].description, 'Vitor', 'the first description any filing gives');
  eq(rows[1].filings.length, 3, 'all three filings are kept');
  eq(githubRowOf(rows, `39999:${'c'.repeat(64)}:3`).n, 2, 'a later filing finds its account\'s row');
  eq(githubRowOf(rows, '4'.repeat(64)), null, 'by address when it has one');
  eq(githubRows(null), [], 'no items');
});

test('S1: the GitHub page is chosen by the shared concept, from the entry or its header\'s b tags', () => {
  const page = flat(code(src(ITEM_JSX)));
  assert(/const pageConcepts = \[coord, entry\?\.sharedCoord, \.\.\.\(entry\?\.targets \|\| \[\]\), \.\.\.bTargets\(header\.event\)\]\.filter\(Boolean\);/.test(page),
    'the page\'s concepts: its header, the shared concept, the entry\'s targets, and the header\'s b tags');
  assert(/const login = isGithubAccounts\(pageConcepts\) \? githubLogin\(ev\) : null;/.test(page), 'a GitHub login only on the GitHub Accounts DList');
  assert(/const gh = useGithubAccount\(login\);/.test(page), 'read once the login is known');
});

test('S2: every other item keeps the generic page', () => {
  const page = flat(code(src(ITEM_JSX)));
  assert(/\{login \? <GithubAccountHead login=\{login\} gh=\{gh\} subtitle=\{subtitle\} \/> : \( <> <h1 className="dict-entry-title">\{name\}<\/h1>/.test(page),
    'the GitHub head, else the generic title');
  assert(/\{login && <GithubProfile login=\{login\} gh=\{gh\} \/>\}/.test(page) && /\{login && <GithubRepos login=\{login\} gh=\{gh\} \/>\}/.test(page),
    'the profile and repositories only for a GitHub account');
  assert(/const name = login \|\| \(ev && /.test(page), 'a GitHub item is named by its login, not its d-tag');
});

test('S3: GitHub is read unsigned, with no cookies and no referrer; a partial answer is not kept', () => {
  const hook = flat(code(src(HOOK_JS)));
  assert(/credentials: 'omit', referrerPolicy: 'no-referrer'/.test(hook), 'the API reads');
  assert(!/Authorization/.test(hook), 'no token');
  assert(/if \(repos\) keep\(login, \{ user, repos \}\);/.test(hook), 'kept only when both reads answered');
  assert(/try \{ sessionStorage\.setItem/.test(hook) && /try \{ hit = JSON\.parse\(sessionStorage\.getItem/.test(hook), 'session storage may throw');
  assert(/return read\.login === login \? read : LOADING;/.test(hook), 'an answer for another login is never shown');
});

test('S4: the avatar costs no API read and falls back to the initial; links out open safely', () => {
  const view = flat(code(src(GITHUB_JSX)));
  assert(/src=\{avatarUrl\(login, px \* 2\)\}/.test(view) && /referrerPolicy="no-referrer" onError=\{\(\) => setFailed\(true\)\}/.test(view), 'the avatar by login, with a fallback');
  assert(/const out = \{ target: '_blank', rel: 'noopener noreferrer' \};/.test(view), 'external links');
  assert(/View on GitHub/.test(view), 'the link to the profile');
});

test('S5: the entry page lists the GitHub Accounts DList one row per account, on /dictionary only', () => {
  const body = flat(code(src(path.join(UI, 'pages/dictionaries/ConceptEntry.jsx'))));
  const entry = flat(code(src(path.join(UI, 'pages/dictionary/Entry.jsx'))));
  assert(/const githubList = dlistViews && isGithubAccounts\(\[coord, sharedCoord, \.\.\.\(entry\?\.targets \|\| \[\]\), \.\.\.headerB\]\);/.test(body),
    'recognised by its shared concept, as the item page does');
  assert(/editHref = null, resync = false, dlistViews = false,/.test(body) && /resync dlistViews \/>/.test(entry), 'off by default; /dictionary turns it on');
  assert(/const all = useMemo\(\(\) => \(githubList \? githubRows\(items\.data\?\.items\)/.test(body), 'one row per account');
  assert(/\{githubList && it\.login \? <GithubItemCell row=\{it\} to=\{to\} state=\{state\} \/>/.test(body), 'avatar, login and description');
  assert(/\{it\.filers\?\.length > 1 && \(/.test(body) && /also filed by \{it\.filers\.slice\(1\)\.map\(nameOf\)\.join\(', '\)\}/.test(body),
    'every other filer, said to a screen reader too');
  assert(/\{githubList && <span className="dict-entry-mark" aria-hidden="true"><GithubMark size=\{30\} \/><\/span>\}/.test(body), 'the mark by the title');
});

test('S6: the item page numbers a GitHub account by its row, and names its other filers', () => {
  const page = flat(code(src(ITEM_JSX)));
  assert(/: items\.data && key && login \? githubRowOf\(githubRows\(items\.data\.items\), key\)/.test(page), 'its row, on a direct visit');
  assert(/const others = login && Array\.isArray\(listed\?\.filers\) \? listed\.filers\.filter\(\(p\) => typeof p === 'string' && p !== author\) : \[\];/.test(page),
    'the row\'s other filers');
  assert(/\{others\.length > 0 && \( <p className="dict-item-filer"> Also filed by/.test(page), 'named in the footer');
});

// ═══ runner ══════════════════════════════════════════════════════════════════

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${t.name}`); skipped++; }
      else { console.log(`  ✓ ${t.name}`); pass++; }
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      failures.push({ name: t.name, message: err.message });
      fail++;
    }
  }
  console.log(`\ndictionary-github-account: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };
