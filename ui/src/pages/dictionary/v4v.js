/**
 * The V4V Songs DList's views: what they read off an item, built from its view brief
 * (protocols/drafts/opinionated-views.md, Appendix B, 2026-10-03; playback only). Pure (no React), so the
 * node runner can import it (test/dictionary-v4v-song.test.js).
 *
 * The DList is recognised by its shared concept, V4V_SONGS below: an instance's own "V4V Song" header
 * b-points to it, so the coordinate is the same on every deployment. It is the community header's author,
 * not this instance's Assistant, so the never-hardcode-the-TA rule doesn't apply. Everything a song needs
 * is on the item itself: no API reads. The artwork's host is contacted when the image loads, and the
 * audio's hosts only when the listener presses play.
 */

export const V4V_SONGS = '39998:77599c5c4a7ba08456679d812a414037f4b01c975fb4f577187df11d189f80d3:b504f5a8-949f-4d31-ad14-8afcebde2b34';

/** Whether a page's concepts (its header, the shared concept it points to, its b targets) include the V4V Songs DList. */
export const isV4vSongs = (concepts) => Array.isArray(concepts) && concepts.includes(V4V_SONGS);

// The Items read (trustedItems, src/lib/trustedDictionary.js) bounds each value at this many characters
// (MAX_ITEM_TEXT). A link that long may have been cut, and a cut link is a wrong one: a row never plays
// or loads it. The item's page reads the whole event.
export const LIST_TEXT_BOUND = 300;

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** An https:// link, exactly as given (trimmed); anything else, a link with a user or password included, is null. */
export function httpsUrl(raw) {
  const s = text(raw);
  if (!s || !/^https:\/\//i.test(s)) return null;
  try {
    const url = new URL(s);
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? s : null;
  } catch {
    return null;
  }
}

/** `duration`: a whole number of seconds, written as one ("219"); anything else is null. */
export function durationSeconds(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return /^\d{1,9}$/.test(s) ? Number(s) : null;
}

/** 3:39, or 1:02:05 from an hour up; null for anything that isn't a whole number of seconds. */
export function durationLabel(seconds) {
  if (!Number.isInteger(seconds) || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Podcast Index's page for the song's release, by its numeric feed ID; null unless that is a positive whole number. */
export function podcastIndexUrl(feedId) {
  const s = typeof feedId === 'string' ? feedId.trim() : '';
  return /^[1-9]\d{0,15}$/.test(s) ? `https://podcastindex.org/podcast/${s}` : null;
}

/**
 * A song from its fields (each a tag's value), checked one by one; null unless it has a title and an
 * https:// `url`, in which case it gets the default view instead. `url` is kept exactly as given: its OP3
 * prefix counts the play for the artist.
 */
export function songFrom(fields) {
  const f = fields && typeof fields === 'object' ? fields : {};
  const title = text(f.title);
  const url = httpsUrl(f.url);
  if (!title || !url) return null;
  return {
    title,
    artist: text(f.artist),
    url,
    artwork: httpsUrl(f.artwork),
    duration: durationSeconds(f.duration),
    t: text(f.t),
    feedGuid: text(f.feedGuid),
    feedId: podcastIndexUrl(f.feedId) ? f.feedId.trim() : null,
    alt: text(f.alt),
  };
}

const FIELDS = ['title', 'artist', 'url', 'artwork', 'duration', 't', 'feedGuid', 'feedId', 'alt'];

/** The song an item's event names: each field its first non-blank tag, as the Items read keeps them. */
export function songOf(ev) {
  const tags = Array.isArray(ev?.tags) ? ev.tags : [];
  const fields = {};
  for (const name of FIELDS) {
    const t = tags.find((x) => Array.isArray(x) && x[0] === name && typeof x[1] === 'string' && x[1].trim() !== '');
    if (t) fields[name] = t[1];
  }
  return songFrom(fields);
}

/** A row's song, from the Items read: its title, and its properties, less any link the read may have cut. */
export function songOfItem(it) {
  const p = it && typeof it.properties === 'object' && it.properties ? it.properties : {};
  const whole = (v) => (typeof v === 'string' && v.length < LIST_TEXT_BOUND ? v : null);
  return songFrom({ ...p, title: it?.title, url: whole(p.url), artwork: whole(p.artwork) });
}

/**
 * What a song's page asks the Items read for (its `match`): the filings of its release and of its artist,
 * never the whole list. The answer holds the page's two lists, the song's other filings, and its own.
 */
export function songMatch(song) {
  if (!song) return [];
  return [song.feedGuid && `feedGuid:${song.feedGuid}`, song.artist && `artist:${song.artist}`].filter(Boolean);
}

/** One song's identity: its release's feed GUID and its track ID, the pair Podcasting 2.0 names a track by. Null without both. */
export const songKey = (song) => (song && song.feedGuid && song.t ? `${song.feedGuid}\n${song.t}` : null);

/**
 * The V4V Songs DList's Items, one row per song: the filings of one song (its feed GUID and track ID) are
 * one row, which the earliest filing stands for (its id, address and filer), naming every filer in filing
 * order. A filing missing either value is a row of its own; one that isn't a song (no title, no https://
 * `url`) is a plain row, `song` null.
 * Items arrive from the Items read (trustedItems: oldest first); rows are numbered in that order.
 */
export function v4vRows(items) {
  const rows = [];
  const byKey = new Map();
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || typeof it !== 'object') continue;
    const song = songOfItem(it);
    const key = songKey(song);
    const row = key ? byKey.get(key) : null;
    if (row) {
      row.filings.push(it);
      if (!row.filers.includes(it.author)) row.filers.push(it.author);
      continue;
    }
    const fresh = { ...it, song, filers: [it.author], filings: [it] };
    rows.push(fresh);
    if (key) byKey.set(key, fresh);
  }
  return rows.map((r, i) => ({ ...r, n: i + 1 }));
}

/** The row of v4vRows that a filing (by its key: address, else id) belongs to, else null. */
export const v4vRowOf = (rows, key) => (Array.isArray(rows) && key
  ? rows.find((r) => (r.filings || [r]).some((f) => (f.address || f.id) === key)) || null : null);

const sameArtist = (a, b) => Boolean(a && b) && a.toLowerCase() === b.toLowerCase();

/**
 * The song page's two lists, from the Items read's rows (v4vRows), in their order: the release's other
 * songs (the same feed GUID), and more by the artist (the same artist, in any case), less those already
 * in the first list. The page's own song is left out of both: its row (by `itemKey`), and any row that
 * is the same song.
 */
export function relatedSongs(rows, song, itemKey) {
  if (!song || !Array.isArray(rows)) return { release: [], artist: [] };
  const own = songKey(song);
  const others = rows.filter((r) => r && r.song
    && !(own && songKey(r.song) === own)
    && !(itemKey && (r.filings || [r]).some((f) => (f.address || f.id) === itemKey)));
  const release = song.feedGuid ? others.filter((r) => r.song.feedGuid === song.feedGuid) : [];
  const listed = new Set(release);
  const artist = song.artist ? others.filter((r) => !listed.has(r) && sameArtist(r.song.artist, song.artist)) : [];
  return { release, artist };
}
