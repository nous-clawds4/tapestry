import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { durationLabel, podcastIndexUrl } from './v4v';

/**
 * The V4V Songs DList's views, built from its view brief (protocols/drafts/opinionated-views.md,
 * Appendix B, 2026-10-03; playback only): the item page's head, player and lists, and the row a song gets
 * in the entry's Items table and in the page's lists.
 *
 * Everything shown is on the item: no API reads. The artwork's host is contacted when the image loads
 * (lazily, with no referrer). The audio's hosts are contacted only when the listener presses play: each
 * player loads nothing in advance, and a row's player isn't even given its song until then. One song
 * plays at a time, and the device is told what's playing (the Media Session API).
 *
 * Playback only: paying the artist is for a later version, so nothing here says or shows that playing
 * pays anyone (Appendix B § Not in this version).
 */

const out = { target: '_blank', rel: 'noopener noreferrer' };

/** The category's mark: a music note. Drawn for Tapestry; decorative, as the text beside it names the song. */
export function MusicNote({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M11 3.5h8.5v4.25H14.5V17h-3.5z" />
      <circle cx="9" cy="17.5" r="3.75" />
    </svg>
  );
}

function PlayGlyph({ state }) {
  const d = state === 'playing' ? 'M7 5h3.5v14H7zm6.5 0H17v14h-3.5z'
    : state === 'failed' ? 'M11 6h2.25v8H11zm0 10h2.25v2.25H11z'
      : 'M8.5 5.5v13l10-6.5z';
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d={d} /></svg>
  );
}

// One song at a time: starting one pauses whichever was playing.
let playing = null;
function claim(el) { if (playing && playing !== el) playing.pause(); playing = el; }

/** Tell the device what's playing, so lock-screen and headset controls show it. Where there's no Media Session API, nothing. */
function announce(song) {
  try {
    if (typeof navigator === 'undefined' || !navigator.mediaSession || typeof MediaMetadata === 'undefined') return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title, artist: song.artist || '', artwork: song.artwork ? [{ src: song.artwork }] : [],
    });
  } catch { /* the song still plays */ }
}

/** A player leaving the page: if it was the one playing, the device forgets the song. */
function release(el) {
  if (!el || playing !== el) return;
  playing = null;
  try { if (navigator.mediaSession) navigator.mediaSession.metadata = null; } catch { /* nothing to forget */ }
}

// An <audio> element has no referrer setting of its own, so while a player is shown the page's policy is
// no-referrer: a referrer meta, the last of which wins. Removing it doesn't undo it, so when the last
// player goes the page's own policy is set again: its last referrer meta's, else the browsers' default
// (this app sends no Referrer-Policy header).
let holders = 0;
let ours = null;
function setPolicy(content) {
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'referrer');
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
  return meta;
}
function useNoReferrer() {
  useEffect(() => {
    holders += 1;
    if (holders === 1) ours = setPolicy('no-referrer');
    return () => {
      holders -= 1;
      if (holders > 0 || !ours) return;
      ours.remove();
      ours = null;
      const own = [...document.querySelectorAll('meta[name="referrer"]')].pop();
      setPolicy(own?.getAttribute('content') || 'strict-origin-when-cross-origin').remove();
    };
  }, []);
}

/** The cover art, square; a music note in the same square when there is none or it fails to load. */
function Artwork({ song, large = false }) {
  const [failed, setFailed] = useState(false);
  const cls = `dict-v4v-art${large ? ' dict-v4v-art--lg' : ''}`;
  if (!song.artwork || failed) {
    return <span className={`${cls} dict-v4v-art--none`} aria-hidden="true"><MusicNote size={large ? 64 : 18} /></span>;
  }
  const px = large ? 200 : 40;
  return (
    <img
      className={cls} src={song.artwork} alt={large ? song.alt || '' : ''} width={px} height={px}
      loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}
    />
  );
}

/** A row's artwork with a play / pause button over it. Its player is given the song only when pressed. */
function ArtPlay({ song }) {
  useNoReferrer();
  const audio = useRef(null);
  const [state, setState] = useState('idle'); // idle | playing | paused | failed
  useEffect(() => {
    const el = audio.current;
    return () => release(el);
  }, []);
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (!a.paused) { a.pause(); return; }
    if (!a.getAttribute('src')) a.setAttribute('src', song.url);
    else if (state === 'failed') a.load();
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch((err) => { if (err?.name !== 'AbortError') setState('failed'); });
  };
  const failed = 'Couldn’t play this song: its host didn’t answer.';
  const label = state === 'failed' ? `${failed} Try ${song.title} again`
    : state === 'playing' ? `Pause ${song.title}`
      : `Play ${song.title}${song.artist ? ` by ${song.artist}` : ''}`;
  return (
    <span className="dict-v4v-artplay">
      <Artwork key={song.artwork} song={song} />
      <button
        type="button" className={`dict-v4v-play${state === 'playing' ? ' is-playing' : ''}${state === 'failed' ? ' is-failed' : ''}`}
        aria-label={label} title={state === 'failed' ? failed : undefined} onClick={toggle}
      >
        <PlayGlyph state={state} />
      </button>
      <audio
        ref={audio} preload="none"
        onPlay={(e) => { claim(e.currentTarget); announce(song); setState('playing'); }}
        onPause={() => setState((s) => (s === 'failed' ? s : 'paused'))} onEnded={() => setState('idle')} onError={() => setState('failed')}
      />
    </span>
  );
}

/** A song as a row: its artwork with play / pause, its title (the link to its page) with the artist beneath, and its duration. */
export function V4vItemCell({ row, to, state }) {
  const { song } = row;
  const time = durationLabel(song.duration);
  return (
    <span className="dict-v4v-item">
      <ArtPlay key={song.url} song={song} />
      <span className="dict-v4v-item-text">
        <Link to={to} state={state} className="dict-items-item-link">{song.title}</Link>
        {song.artist && <span className="dict-v4v-item-artist">{song.artist}</span>}
      </span>
      {time && <span className="dict-v4v-item-time">{time}</span>}
    </span>
  );
}

/** The page's head: the artwork, large and square; the title, with the artist beneath; the item's place; the duration. */
export function V4vSongHead({ song, subtitle }) {
  const time = durationLabel(song.duration);
  return (
    <header className="dict-v4v-head">
      <Artwork key={song.artwork} song={song} large />
      <div className="dict-v4v-head-text">
        <h1 className="dict-entry-title">{song.title}</h1>
        {song.artist && <p className="dict-v4v-artist">{song.artist}</p>}
        {subtitle && <p className="dict-entry-sub text-muted">{subtitle}</p>}
        {time && <p className="dict-v4v-time"><span className="bs-sr-only">Duration </span>{time}</p>}
      </div>
    </header>
  );
}

/** The player: the browser's own controls (play / pause, seek, elapsed and total time), loading nothing until played. */
export function V4vPlayer({ song }) {
  useNoReferrer();
  const audio = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = audio.current;
    return () => release(el);
  }, []);
  return (
    <section className="dict-card dict-entry-card dict-v4v-player" aria-label="Player">
      <audio
        ref={audio} className="dict-v4v-audio" controls preload="none" src={song.url}
        onPlay={(e) => { claim(e.currentTarget); announce(song); setFailed(false); }}
        onError={() => setFailed(true)}
      />
      {failed && (
        <p className="dict-notice" role="status">
          Couldn’t play this song: its host didn’t answer. <a href={song.url} {...out}>The song’s file</a>
        </p>
      )}
      <p className="dict-v4v-source">Playing loads the song from its host.</p>
    </section>
  );
}

const SHOWN = 10;

/** One of the page's lists: its songs as rows, in the Items' order; ten, then all on request. */
function SongList({ id, title, rows, linkFor }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, SHOWN);
  return (
    <section className="dict-v4v-list" aria-labelledby={id}>
      <h2 id={id} className="dict-field-label dict-v4v-list-title">{title}</h2>
      <ul className="dict-card dict-v4v-rows">
        {shown.map((r) => {
          const { to, state } = linkFor(r);
          return <li key={r.address || r.id} className="dict-v4v-row"><V4vItemCell row={r} to={to} state={state} /></li>;
        })}
      </ul>
      {!all && rows.length > SHOWN && (
        <button type="button" className="dict-link-btn dict-v4v-all" onClick={() => setAll(true)}>
          {`Show all ${rows.length.toLocaleString()}`}
        </button>
      )}
    </section>
  );
}

/**
 * The release's other songs, more by the artist, and the release on Podcast Index. The lists come from
 * the Items read (relatedSongs), never beyond it; `limit` says so when that read stopped short, and
 * `error` when it failed.
 */
export function V4vSongLists({ song, related, linkFor, limit, error }) {
  const release = podcastIndexUrl(song.feedId);
  return (
    <div className="dict-v4v-more">
      {error && <p className="dict-notice">{error}</p>}
      {related && <SongList key={`release-${song.url}`} id="dict-v4v-release" title="From this release" rows={related.release} linkFor={linkFor} />}
      {related && song.artist && (
        <SongList key={`artist-${song.url}`} id="dict-v4v-artist" title={`More by ${song.artist}`} rows={related.artist} linkFor={linkFor} />
      )}
      {related && limit && <p className="dict-v4v-source">{limit}</p>}
      {release && <p className="dict-v4v-release"><a href={release} {...out}>This release on Podcast Index</a></p>}
    </div>
  );
}
