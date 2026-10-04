/**
 * The V4V Songs DList's views (/dictionary/:coord and /dictionary/:coord/items/:item), built from the view
 * brief alone (protocols/drafts/opinionated-views.md, Appendix B, 2026-10-03; playback only): a song with
 * its cover art, artist and a play button, and every surface spends no API reads.
 *
 *   V1..V8 — pure: ui/src/pages/dictionary/v4v.js (dynamic import): the DList recognised by its shared
 *            concept, a song read off the item field by field, its duration written m:ss, the release's
 *            Podcast Index link, the Items as one row per song (feed GUID + track ID), the page's two
 *            lists, and (V7, V8) the Items read carrying what a row needs, whole.
 *   S1..S6 — structural pins, read off comment-stripped source: the page is chosen by the shared concept
 *            and reads the Items even when opened from a row (S1); nothing loads before play, and one song
 *            plays at a time (S2); no referrer, lazy artwork (S3); the entry page lists one row per song
 *            and its play buttons don't open the row (S4); the page's parts in the brief's order (S5);
 *            and nothing says playing pays anyone (S6).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const UI = path.join(ROOT, 'ui/src');
const V4V_JS = path.join(UI, 'pages/dictionary/v4v.js');
const V4V_JSX = path.join(UI, 'pages/dictionary/V4vSong.jsx');
const ITEM_JSX = path.join(UI, 'pages/dictionary/Item.jsx');
const ENTRY_JSX = path.join(UI, 'pages/dictionaries/ConceptEntry.jsx');
const LIB_JS = path.join(ROOT, 'src/lib/trustedDictionary.js');

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

let _v4v;
async function v4v() {
  if (_v4v === undefined) {
    try { _v4v = await import(pathToFileURL(V4V_JS).href); } catch (err) { _v4v = err; }
  }
  assert(!(_v4v instanceof Error), `ui/src/pages/dictionary/v4v.js must import: ${_v4v && _v4v.message}`);
  return _v4v;
}
const lib = () => require(LIB_JS);

const H = '39998:77599c5c4a7ba08456679d812a414037f4b01c975fb4f577187df11d189f80d3:b504f5a8-949f-4d31-ad14-8afcebde2b34';
const GUID = 'c187122d-fb21-5980-a241-c1ab558a9287';
const T = '4d338528-1638-4c11-b032-3ebe1d8c9db5';
const URL_ = `https://op3.dev/e,pg=${GUID}/https://d12wklypp119aj.cloudfront.net/track/${T}.mp3`;
const ART = 'https://d12wklypp119aj.cloudfront.net/image/3bf6df11-a3d7-4f23-9528-b68f1d6843c0.jpg';
/** The first sample item of Appendix B, as a kind-9999 event. */
const sample = (...extra) => ({
  kind: 9999, id: 'a'.repeat(64), pubkey: '7'.repeat(64), created_at: 1, content: '',
  tags: [['z', H], ['t', T], ['title', 'Donde No Llega el Comercio'], ['artist', 'Musica Ancap'], ['url', URL_],
    ['duration', '219'], ['feedId', '7769268'], ['feedGuid', GUID], ['artwork', ART],
    ['alt', 'Song: Donde No Llega el Comercio by Musica Ancap'], ...extra],
});

test('V1: the DList is recognised by its shared concept, the same coordinate on every deployment', async () => {
  const m = await v4v();
  eq(m.V4V_SONGS, H, 'H, from Appendix B');
  assert(m.isV4vSongs([`39998:${'a'.repeat(64)}:v4v-song`, H]), 'an instance header that points to it');
  assert(!m.isV4vSongs([`39998:${'a'.repeat(64)}:b504f5a8-949f-4d31-ad14-8afcebde2b34`]), 'another author\'s same-d header is not it');
  assert(!m.isV4vSongs(null) && !m.isV4vSongs([]), 'nothing known, nothing recognised');
});

test('V2: a song is read off the item field by field; it needs a title and an https:// url, kept exactly as given', async () => {
  const { songOf } = await v4v();
  const s = songOf(sample());
  eq([s.title, s.artist, s.duration, s.t, s.feedGuid, s.feedId], ['Donde No Llega el Comercio', 'Musica Ancap', 219, T, GUID, '7769268'], 'the fields');
  eq(s.url, URL_, 'the OP3 prefix is kept: it counts the play for the artist');
  eq(s.artwork, ART, 'the artwork');
  eq(s.alt, 'Song: Donde No Llega el Comercio by Musica Ancap', 'the alt text, for the accessible name');
  const without = (name) => ({ ...sample(), tags: sample().tags.filter((t) => t[0] !== name) });
  eq(songOf(without('title')), null, 'no title, the default view');
  eq(songOf(without('url')), null, 'no url, the default view');
  for (const bad of ['http://example.com/a.mp3', 'javascript:alert(1)', '/track/a.mp3', 'https:example.com/a.mp3', 'https://user:pw@example.com/a.mp3', 'op3.dev/e/x.mp3']) {
    eq(songOf({ tags: [['title', 'x'], ['url', bad]] }), null, `not an https:// link: ${bad}`);
  }
  eq(songOf({ tags: [['title', 'x'], ['url', URL_], ['artwork', 'http://example.com/a.jpg']] }).artwork, null, 'artwork: https:// only');
  eq(songOf({ tags: [['title', ' '], ['title', ' Second '], ['url', URL_]] }).title, 'Second', 'the first non-blank tag, trimmed');
  eq(songOf({ tags: [['title', 'x'], ['url', URL_], ['artist', 'Tilted Halo / T \' Halo']] }).artist, 'Tilted Halo / T \' Halo', 'an artist with " / " stays whole');
  eq(songOf(null), null, 'no event');
});

test('V3: the duration is whole seconds, written m:ss, or h:mm:ss from an hour up', async () => {
  const { durationSeconds, durationLabel } = await v4v();
  eq(['219', ' 59 ', '0', '3600', '3725'].map(durationSeconds), [219, 59, 0, 3600, 3725], 'whole numbers');
  eq(['219.5', '-1', '3:39', 'abc', '', '1e3'].map(durationSeconds), [null, null, null, null, null, null], 'anything else: leave it out');
  eq(durationSeconds(219), null, 'a tag value is a string');
  eq([219, 59, 0, 3600, 3725, 36000].map(durationLabel), ['3:39', '0:59', '0:00', '1:00:00', '1:02:05', '10:00:00'], 'as a player writes it');
  eq(durationLabel(null), null, 'no duration');
});

test('V4: the release links to Podcast Index by its feed ID', async () => {
  const { podcastIndexUrl } = await v4v();
  eq(podcastIndexUrl('7769268'), 'https://podcastindex.org/podcast/7769268', 'a positive whole number');
  for (const bad of ['0', '-1', '12a', '', '../x', null, 7769268]) eq(podcastIndexUrl(bad), null, `not a feed ID: ${JSON.stringify(bad)}`);
});

test('V5: the Items are one row per song: a feed GUID and track ID make one song; the earliest filing stands for it', async () => {
  const { v4vRows, v4vRowOf, LIST_TEXT_BOUND } = await v4v();
  const it = (n, author, t, { guid = GUID, url = URL_, title = `Song ${n}` } = {}) => ({
    id: String(n).repeat(64), address: null, kind: 9999, author: author.repeat(64), name: title, title,
    description: null, properties: { artist: 'Musica Ancap', url, duration: '219', feedGuid: guid, ...(t ? { t } : {}), artwork: ART },
  });
  const rows = v4vRows([
    it(1, 'a', 'one'),
    it(2, 'b', 'two'),
    it(3, 'c', 'one'),
    it(4, 'a', null),
    it(5, 'b', 'one', { guid: 'another-release' }),
    it(6, 'd', 'two', { url: `https://example.com/${'x'.repeat(LIST_TEXT_BOUND)}` }),
    it(7, 'b', 'one'),
  ]);
  eq(rows.map((r) => [r.n, r.song && r.song.title, r.filers.length]),
    [[1, 'Song 1', 3], [2, 'Song 2', 1], [3, 'Song 4', 1], [4, 'Song 5', 1], [5, null, 1]],
    'one song (any filer, any title) is one row; without a track ID a filing stands alone; the same track ID in another '
    + 'release is another song; a filing whose url the read may have cut is a plain row, joining none');
  eq(rows[0].id, '1'.repeat(64), 'the earliest filing stands for the row');
  eq(rows[0].filers, ['a'.repeat(64), 'c'.repeat(64), 'b'.repeat(64)], 'every filer, once each, in filing order');
  eq(rows[0].filings.length, 3, 'all three filings are kept');
  eq(v4vRowOf(rows, '7'.repeat(64)).n, 1, 'a later filing finds its song\'s row');
  eq(v4vRowOf(rows, 'nope'), null, 'no such filing');
  const plain = v4vRows([{ id: '9'.repeat(64), author: 'e'.repeat(64), name: 'Not a song', title: null, properties: {} }]);
  eq([plain[0].song, plain[0].n], [null, 1], 'an item that isn\'t a song is a plain row');
  eq(v4vRows(null), [], 'no items');
});

test('V6: the page lists the release\'s other songs, then more by the artist, in the Items\' order, never itself', async () => {
  const { v4vRows, relatedSongs, songOf } = await v4v();
  const it = (n, t, guid, artist) => ({
    id: String(n).repeat(64), author: 'a'.repeat(64), name: `S${n}`, title: `S${n}`,
    properties: { url: `https://example.com/${n}.mp3`, t, feedGuid: guid, artist },
  });
  const rows = v4vRows([
    it(1, T, GUID, 'Musica Ancap'),
    it(2, 'b', 'other-release', 'MUSICA ANCAP'),
    it(3, 'c', GUID, 'Someone Else'),
    it(4, 'd', GUID, 'Musica Ancap'),
    it(5, 'e', 'third', 'Other'),
    it(6, T, GUID, 'Musica Ancap'),
  ]);
  const song = songOf(sample());
  const { release, artist } = relatedSongs(rows, song, '1'.repeat(64));
  eq(release.map((r) => r.title), ['S3', 'S4'], 'the same feed GUID, its own row left out, in order');
  eq(artist.map((r) => r.title), ['S2'], 'the same artist in any case, less the release\'s songs');
  eq(relatedSongs(rows, song, 'not-in-the-read').release.map((r) => r.title), ['S3', 'S4'], 'the same song is left out even when its own filing isn\'t in the read');
  eq(relatedSongs(rows, null, null), { release: [], artist: [] }, 'no song, no lists');
});

test('V7: the Items read carries what a row needs: the item\'s own title, and its `t`, the one single-letter property', () => {
  const { trustedItems, itemCarrier } = lib();
  const ev = { ...sample(['name', 'A name tag'], ['e', 'f'.repeat(64)], ['p', 'e'.repeat(64)]) };
  const [it] = trustedItems({ zCarriers: [itemCarrier(ev)], coords: [H], qualifying: [ev.pubkey] }).items;
  eq(it.title, 'Donde No Llega el Comercio', 'its own title, though `name` takes the name tag');
  eq(it.name, 'A name tag', 'the display name is unchanged');
  eq(it.properties.t, T, 't survives the scan');
  eq(Object.keys(it.properties), ['t', 'artist', 'url', 'duration', 'feedId', 'feedGuid', 'artwork'], 'no other single-letter tag, and still not title or alt');
  const [untitled] = trustedItems({ zCarriers: [{ ...ev, tags: [['z', H]] }], coords: [H], qualifying: [ev.pubkey] }).items;
  eq(untitled.title, null, 'no title tag, null');
});

test('V8: a row never plays or loads a link the Items read may have cut', async () => {
  const { LIST_TEXT_BOUND, songOfItem } = await v4v();
  const lib_ = flat(code(src(LIB_JS)));
  assert(lib_.includes(`const MAX_ITEM_TEXT = ${LIST_TEXT_BOUND};`), 'the bound the row trusts is the one the Items read applies');
  const row = (url, artwork) => ({ title: 'x', properties: { url, artwork } });
  const atBound = `https://example.com/${'x'.repeat(LIST_TEXT_BOUND - 20)}`;
  eq(atBound.length, LIST_TEXT_BOUND, 'fixture');
  eq(songOfItem(row(atBound, ART)), null, 'a url as long as the bound may have been cut: not a song in the row');
  eq(songOfItem(row(URL_, atBound)).artwork, null, 'an artwork link as long as the bound is not loaded');
  eq(songOfItem(row(URL_, ART)).url, URL_, 'a shorter link is whole');
});

test('S1: the page is chosen by the shared concept, and reads the Items for its lists even when opened from a row', () => {
  const page = flat(code(src(ITEM_JSX)));
  assert(/const v4vPage = isV4vSongs\(pageConcepts\);/.test(page), 'recognised by its shared concept, as the GitHub page is');
  assert(/enabled: \(!passed \|\| v4vPage\) && Boolean\(entry\)/.test(page), 'the Items read, which the release and artist lists come from');
  assert(/const song = !v4vPage \? null : ev \? songOf\(ev\) : passed\?\.item\?\.song \|\| null;/.test(page),
    'a song only on the V4V Songs DList: the event\'s, or until it arrives, the row\'s it was opened from');
  assert(/items\.data && key && v4vPage \? v4vRowOf\(songRows, key\)/.test(page), 'numbered by its row on a direct visit, a song or not, as the table numbers it');
  assert(/: items\.error && !passed \? `Couldn’t read the entry’s Items/.test(page), 'opened from a row, a failed Items read doesn\'t unsay the row\'s place');
  assert(/error=\{songListsError\}/.test(page), 'the lists say when that read failed');
});

test('S2: nothing loads before play, never autoplays, and one song plays at a time', () => {
  const view = flat(code(src(V4V_JSX)));
  assert((view.match(/<audio /g) || []).length === 2, 'two players: the page\'s and a row\'s');
  assert((view.match(/preload="none"/g) || []).length === 2, 'each loads nothing in advance');
  assert(!/autoPlay|autoplay/.test(view), 'never autoplay');
  assert(/if \(!a\.getAttribute\('src'\)\) a\.setAttribute\('src', song\.url\);/.test(view), 'a row\'s player is given its song only when pressed');
  assert(/function claim\(el\) \{ if \(playing && playing !== el\) playing\.pause\(\); playing = el; \}/.test(view), 'starting one pauses the other');
  assert((view.match(/onPlay=\{\(e\) => \{ claim\(e\.currentTarget\); announce\(song\);/g) || []).length === 2, 'both players claim, and tell the device what\'s playing');
  assert(/navigator\.mediaSession\.metadata = new MediaMetadata\(/.test(view), 'the Media Session API');
});

test('S3: no referrer, and the artwork loads lazily', () => {
  const view = flat(code(src(V4V_JSX)));
  assert(/if \(holders === 1\) ours = setPolicy\('no-referrer'\);/.test(view), 'a page-wide policy while a player is shown (an <audio> element has none of its own)');
  assert(/setPolicy\(own\?\.getAttribute\('content'\) \|\| 'strict-origin-when-cross-origin'\)\.remove\(\);/.test(view), 'and the page\'s own policy after the last one goes');
  assert((view.match(/useNoReferrer\(\);/g) || []).length === 2, 'held by both players');
  assert(/loading="lazy" referrerPolicy="no-referrer"/.test(view), 'the artwork');
  assert(/const out = \{ target: '_blank', rel: 'noopener noreferrer' \};/.test(view), 'links out');
  assert(!/dangerouslySetInnerHTML/.test(view), 'text is text');
});

test('S4: the entry page lists the V4V Songs DList one row per song, on /dictionary only; a row\'s play button doesn\'t open it', () => {
  const body = flat(code(src(ENTRY_JSX)));
  assert(/const v4vList = dlistViews && isV4vSongs\(\[coord, sharedCoord, \.\.\.\(entry\?\.targets \|\| \[\]\), \.\.\.headerB\]\);/.test(body),
    'recognised by its shared concept, as the item page does');
  assert(/: v4vList \? v4vRows\(items\.data\?\.items\)/.test(body), 'one row per song');
  assert(/: v4vList && it\.song \? <V4vItemCell row=\{it\} to=\{to\} state=\{state\} \/>/.test(body), 'artwork with play, title, artist and duration');
  assert(/if \(e\.target\.closest\('a, button, audio'\) \|\|/.test(body), 'a button in the row plays; it doesn\'t open the item');
  assert(/\{v4vList && <span className="dict-entry-mark" aria-hidden="true"><MusicNote size=\{30\} \/><\/span>\}/.test(body), 'the music note by the title');
  assert(/v4vList \? ' Cover art is loaded from each song’s host by your browser, and pressing play loads the song from its host\.'/.test(body), 'the note under the table');
});

test('S5: the page shows the head, the player, the release, more by the artist, then the link, in that order', () => {
  const page = flat(code(src(ITEM_JSX)));
  const order = ['<V4vSongHead ', '<V4vPlayer ', '<V4vSongLists ', '<footer className="dict-item-foot">'].map((s) => page.indexOf(s));
  assert(order.every((i) => i >= 0) && order.every((i, k) => k === 0 || i > order[k - 1]), `head, player, lists, then the Nostr record: ${order}`);
  const view = flat(code(src(V4V_JSX)));
  assert(/From this release/.test(view) && /More by \$\{song\.artist\}/.test(view) && /This release on Podcast Index/.test(view), 'the lists and the link');
  assert(/Couldn’t play this song: its host didn’t answer\./.test(view) && /Playing loads the song from its host\./.test(view), 'the failure and the privacy line');
});

test('S6: playback only: nothing says or shows that playing pays anyone', () => {
  for (const file of [V4V_JSX, V4V_JS, ITEM_JSX, ENTRY_JSX]) {
    assert(!/\b(pay|pays|paid|sats?|boost|zap|lightning|webln)\b|⚡/i.test(code(src(file))), `no payment words or lightning mark: ${path.relative(ROOT, file)}`);
  }
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
  console.log(`\ndictionary-v4v-song: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };
