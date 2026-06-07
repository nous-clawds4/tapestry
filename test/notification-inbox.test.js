/**
 * Story communities-notifications/8: notification inbox (ADR-0038). Pure core
 * (buildNotifications / hasNew / notificationSentence) tested against real source
 * via extract-and-eval (loaded inside tests to tolerate the new module). Hook +
 * fetchers + marker + route via source-guards.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const NOTIF = path.join(ROOT, 'ui-communities/src/lib/notifications.js');
const HOOK = path.join(ROOT, 'ui-communities/src/hooks/useNotifications.js');
const APP = path.join(ROOT, 'ui-communities/src/App.jsx');
const HEADER = path.join(ROOT, 'ui-communities/src/components/Header.jsx');
const INBOX = path.join(ROOT, 'ui-communities/src/pages/NotificationInbox.jsx');
const CIRCLE = path.join(ROOT, 'ui-communities/src/lib/circle.js');
const CLIENT = path.join(ROOT, 'ui-communities/src/api/client.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }
function loadExport(file, name) {
  const src = read(file);
  const re = new RegExp(`export\\s+function\\s+${name}\\s*\\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`${path.basename(file)} must export function ${name}`);
  // eslint-disable-next-line no-new-func
  return new Function(m[1], m[2]);
}

const VIEWER = 'v'.repeat(64), MAYA = 'm'.repeat(64), DEV = 'd'.repeat(64);
const ATAG = `39998:${'f'.repeat(64)}:sunset`;
const idx = () => new Map([[ATAG, { slug: 'sunset', name: 'Sunset Hikers' }]]);
const ALL_ON = { vouched: true, 'new-posts': true, replies: true };

function build(args) {
  const buildNotifications = loadExport(NOTIF, 'buildNotifications');
  return buildNotifications({ vouches: [], replies: [], circlePosts: [], viewer: VIEWER, prefs: ALL_ON, circleIndex: idx(), ...args });
}

test('T1: a vouch for the viewer (pref on) → one vouched item, no circle', () => {
  const out = build({ vouches: [{ id: 'a1', actor: MAYA, target: VIEWER, createdAt: 5 }], prefs: { vouched: true, 'new-posts': false, replies: false } });
  assert(out.length === 1 && out[0].occasion === 'vouched', 'one vouched item');
  assert(out[0].actor === MAYA && (out[0].circle == null), 'actor set, circle null for a vouch');
});

test('T2: vouched pref OFF → no item (the gate)', () => {
  const out = build({ vouches: [{ id: 'a1', actor: MAYA, target: VIEWER, createdAt: 5 }], prefs: { vouched: false, 'new-posts': false, replies: false } });
  assert(out.length === 0, 'an off occasion produces nothing');
});

test('T3: a vouch authored by the viewer is excluded (no self-notify)', () => {
  const out = build({ vouches: [{ id: 'a1', actor: VIEWER, target: VIEWER, createdAt: 5 }] });
  assert(out.length === 0, 'own vouch excluded');
});

test('T4: a reply (pref on) → reply item with circle name + slug', () => {
  const out = build({ replies: [{ id: 'r1', actor: MAYA, aTag: ATAG, createdAt: 6 }], prefs: { vouched: false, 'new-posts': false, replies: true } });
  assert(out.length === 1 && out[0].occasion === 'reply', 'one reply item');
  assert(out[0].circle === 'Sunset Hikers' && out[0].sourceSlug === 'sunset', 'circle resolved from index');
});

test('T5: a new circle post (pref on) → new-post item', () => {
  const out = build({ circlePosts: [{ id: 'p1', actor: MAYA, aTag: ATAG, createdAt: 7 }], prefs: { vouched: false, 'new-posts': true, replies: false } });
  assert(out.length === 1 && out[0].occasion === 'new-post', 'one new-post item');
});

test('T6: same event as reply + circle-post → one item, occasion reply (priority)', () => {
  const out = build({
    replies: [{ id: 'x', actor: MAYA, aTag: ATAG, createdAt: 8 }],
    circlePosts: [{ id: 'x', actor: MAYA, aTag: ATAG, createdAt: 8 }],
  });
  assert(out.length === 1, 'deduped by id');
  assert(out[0].occasion === 'reply', 'reply wins over new-post');
});

test('T7: items are sorted newest-first', () => {
  const out = build({
    vouches: [{ id: 'a', actor: MAYA, target: VIEWER, createdAt: 1 }],
    circlePosts: [{ id: 'b', actor: DEV, aTag: ATAG, createdAt: 9 }],
  });
  assert(out.length === 2 && out[0].createdAt >= out[1].createdAt, 'newest first');
});

test('T8: hasNew reflects items newer than last-seen', () => {
  const hasNew = loadExport(NOTIF, 'hasNew');
  assert(hasNew([{ createdAt: 5 }], 3) === true, 'newer than last-seen → true');
  assert(hasNew([{ createdAt: 5 }], 5) === false, 'not newer → false');
  assert(hasNew([], 3) === false, 'empty → false');
});

test('T9: notificationSentence reads as one plain line per occasion', () => {
  const sentence = loadExport(NOTIF, 'notificationSentence');
  assert(/vouched for you/i.test(sentence({ occasion: 'vouched', circle: null }, 'maya')), 'vouched line');
  assert(/replied to you in Sunset Hikers/i.test(sentence({ occasion: 'reply', circle: 'Sunset Hikers' }, 'maya')), 'reply line names the circle');
  assert(/New posts in Sunset Hikers/i.test(sentence({ occasion: 'new-post', circle: 'Sunset Hikers' }, 'maya')), 'new-post line');
});

// ── source guards ──
test('T10: fetchNotificationSources queries 39999 #p, 1111 #p, 1111 #A', () => {
  const src = read(NOTIF);
  assert(/fetchNotificationSources/.test(src), 'fetcher exists');
  assert(/kinds:\s*\[\s*39999\s*\][\s\S]{0,80}?['"]#p['"]/.test(src), 'vouch query: 39999 #p');
  assert(/kinds:\s*\[\s*1111\s*\][\s\S]{0,120}?['"]#p['"]/.test(src), 'reply query: 1111 #p');
  assert(/kinds:\s*\[\s*1111\s*\][\s\S]{0,120}?['"]#A['"]/.test(src), 'new-posts query: 1111 #A');
});

test('T11: useNotifications gates on prefs and Header shows a dot (no count)', () => {
  const hook = read(HOOK);
  assert(/loadPreferences/.test(hook), 'reads preferences');
  assert(/buildNotifications/.test(hook), 'derives via buildNotifications');
  assert(/signedIn/.test(hook), 'gated on sign-in');
  const header = read(HEADER);
  assert(/[Hh]asNew|notificationsHasNew/.test(header), 'Header consumes a hasNew flag');
  assert(!/notif[\s\S]{0,40}badge|count/i.test(header) || /dot/i.test(header), 'a dot, not a numeric badge');
});

test('T12: /notifications route + inbox marks seen on mount with empty/error states', () => {
  const app = read(APP);
  assert(/['"]notifications['"]/.test(app) && /NotificationInbox/.test(app), 'route → NotificationInbox');
  const inbox = read(INBOX);
  assert(/markNotificationsSeen|markSeen/.test(inbox), 'marks seen on open');
  assert(/Nothing new/i.test(inbox), 'designed empty state');
  assert(/Retry|retry/.test(inbox), 'error+retry state');
});

test('T13: circleATag yields a coordinate for a joined declaration-circle shape', () => {
  const circleATag = loadExport(CIRCLE, 'circleATag');
  assert(circleATag({ model: 'declaration', founder: 'f'.repeat(64), slug: 'sunset' }) === `39998:${'f'.repeat(64)}:sunset`, 'declaration → 39998 coordinate');
  assert(circleATag({ slug: 'sunset' }) === null, 'no model/founder → null (the gap that silenced new-posts)');
});

test('T14: getJoinedCommunitySummaries projects model + founder so circleATag works', () => {
  const src = read(CLIENT);
  assert(/getJoinedCommunitySummaries/.test(src), 'fn exists');
  // Without these, circleATag returns null for every joined circle → the
  // new-posts occasion never fires and reply rows lose their circle link.
  assert(/model:\s*c\.model/.test(src), 'projection carries model');
  assert(/founder:\s*c\.founder/.test(src), 'projection carries founder');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (e) { console.log(`  ✗ ${t.name}`); console.log(`      ${e.message.split('\n')[0]}`); fail++; }
  }
  return { pass, fail };
}
module.exports = { run };
