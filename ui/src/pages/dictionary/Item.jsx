import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigationType, useParams } from 'react-router-dom';
import DictionaryShell from './DictionaryShell';
import { GithubAccountHead, GithubProfile, GithubRepos } from './GithubAccount';
import { githubLogin, githubRowOf, githubRows, isGithubAccounts, normalizeLogin } from './github';
import useGithubAccount from './useGithubAccount';
import { V4vPlayer, V4vSongHead, V4vSongLists } from './V4vSong';
import { isV4vSongs, relatedSongs, songMatch, songOf, v4vRowOf, v4vRows } from './v4v';
import DictIcon from '../dictionaries/DictIcon';
import useProfiles from '../../hooks/useProfiles';
import { usePov } from '../../context/PovContext';
import { Disclosure, eventJson, npubOf, scan, useHeaderEvent } from '../dictionaries/ConceptEntry';
import {
  coordParts, dictionaryEntryPath, dictionaryItemPath, displayName, useConceptDictionary, useConceptItems, useDictionaryPerson,
} from '../dictionaries/conceptsDictionary';

/**
 * /dictionary/:coord/items/:item — one item of a Dictionary entry, as the design's "Dictionary item"
 * screen: its name, "Item N in <concept>", a description, then, below a divider, who filed it and the raw
 * Nostr event.
 *
 * `:item` is the item's address (kind:pubkey:d) or its event id. Opened from the entry's Items table,
 * the row arrives in router state (the item, its number, the entry), so nothing needs reading but the
 * event. A direct visit reads the person's dictionary for the entry, then the entry's Items for the
 * number, from the active point of view. The page says only what those reads establish: that the item
 * isn't trusted needs a complete read of the Items it could be among (the whole Items, or for a song, its
 * release's and artist's), the entry known, and the event filed under the concept.
 *
 * Some DLists have a page of their own around the same reads, each recognised by its shared concept,
 * whichever instance's header the page is on: an item of the GitHub Accounts DList shows the account as
 * GitHub does (GithubAccount.jsx); an item of the V4V Songs DList shows the song with its cover art and a
 * player, then the release's other songs and more by the artist, from the entry's Items (V4vSong.jsx).
 */

const ADDRESS = /^(\d+):([0-9a-f]{64}):(.+)$/;
const EVENT_ID = /^[0-9a-f]{64}$/;

const tagOf = (ev, name) => {
  const t = (ev?.tags || []).find((x) => x[0] === name && typeof x[1] === 'string' && x[1].trim() !== '');
  return t ? t[1] : null;
};

const bTargets = (ev) => (ev?.tags || []).filter((t) => t && t[0] === 'b' && typeof t[1] === 'string').map((t) => t[1]);

/** The item's newest event: by address (newest version), else by id. */
function useItemEvent(ref) {
  const [state, setState] = useState({ event: null, error: null, done: false });
  useEffect(() => {
    let cancelled = false;
    setState({ event: null, error: null, done: false });
    (async () => {
      try {
        const m = ADDRESS.exec(ref || '');
        let filter;
        if (m) filter = { kinds: [Number(m[1])], authors: [m[2]], '#d': [m[3]] };
        else if (EVENT_ID.test(ref || '')) filter = { ids: [ref] };
        else throw new Error(`Not an item address or event id: ${ref || '(empty)'}`);
        const events = await scan(filter);
        const newest = events.reduce((a, b) => (!a || (b.created_at || 0) > (a.created_at || 0) ? b : a), null);
        if (!cancelled) setState({ event: newest, error: newest ? null : 'No event found for this item on this relay.', done: true });
      } catch (err) {
        if (!cancelled) setState({ event: null, error: err.message, done: true });
      }
    })();
    return () => { cancelled = true; };
  }, [ref]);
  return state;
}

/** The item's key as the entry's Items name it (trustedItems): kind:pubkey:d when addressable, else its id. */
function itemKey(ev) {
  if (!ev) return null;
  const d = (ev.tags || []).find((t) => t && t[0] === 'd')?.[1];
  return ev.kind >= 30000 && ev.kind < 40000 && typeof d === 'string' ? `${ev.kind}:${ev.pubkey}:${d}` : ev.id;
}

export default function DictionaryItemPage() {
  // The router has decoded both params already: decoding again would break a d-tag with a "%" in it.
  const { coord: rawCoord, item: rawItem } = useParams();
  const coord = rawCoord || '';
  const ref = rawItem || '';
  const location = useLocation();
  const st = location.state;
  const passed = st?.item && (st.item.address || st.item.id) === ref ? st : null;
  const { povParams } = usePov();
  const person = useDictionaryPerson();

  // The entry: from the row, else the person's dictionary (and its header, for the names, if it isn't in it).
  const dict = useConceptDictionary(person, povParams, { enabled: !passed?.entry });
  const entry = passed?.entry || (dict.error ? null : (dict.data?.entries || []).find((e) => e.coord === coord)) || null;
  const header = useHeaderEvent(entry ? null : coord);
  const itemEvent = useItemEvent(ref);
  // A song's lists open other items in this same page: each of those starts at its top (Back and Forward
  // are left to the browser).
  const navigationType = useNavigationType();
  const shownRef = useRef(null);
  useEffect(() => {
    if (shownRef.current !== null && shownRef.current !== ref && navigationType !== 'POP') window.scrollTo(0, 0);
    shownRef.current = ref;
  }, [ref, navigationType]);
  // The concepts this page is about: its header, the shared concept that header points to, and its b targets.
  const pageConcepts = [coord, entry?.sharedCoord, ...(entry?.targets || []), ...bTargets(header.event)].filter(Boolean);
  const v4vPage = isV4vSongs(pageConcepts);

  const ev = itemEvent.event;
  const key = itemKey(ev);
  // Until the event arrives, the row it was opened from names the login, so the page doesn't change face.
  const login = !isGithubAccounts(pageConcepts) ? null : ev ? githubLogin(ev) : normalizeLogin(passed?.item?.login);
  const gh = useGithubAccount(login);
  // A song, likewise: the event's, else the row's it was opened from. Its filings are one row (v4vRows).
  const song = !v4vPage ? null : ev ? songOf(ev) : passed?.item?.song || null;

  // The entry's Items (for the number and the trust verdict): read on a direct visit, once the entry is known.
  // A song's page never reads them all: it waits for its event, and a song asks only for what it shows (below).
  const items = useConceptItems({
    coord, shared: entry?.sharedCoord || null, person, povParams,
    enabled: !passed && Boolean(entry) && (!v4vPage || (itemEvent.done && ev && !song)),
  });
  // A song's page reads the filings of its release and of its artist (`match`): its two lists, who else filed
  // the song, and whether its own filing is trusted. Its number, which needs every row, comes only from the
  // Items table's row it was opened from.
  const songPairs = songMatch(song);
  const songItems = useConceptItems({
    coord, shared: entry?.sharedCoord || null, person, povParams, match: songPairs, enabled: Boolean(entry && song) && songPairs.length > 0,
  });
  const read = song ? songItems : items;
  const songRows = songItems.data ? v4vRows(songItems.data.items) : null;
  const songRow = song && songRows && key ? v4vRowOf(songRows, key) : null;
  // A GitHub account's number is its row's in the entry's Items, where its filings are one row (githubRows).
  const listed = passed ? passed.item
    : items.data && key && login ? githubRowOf(githubRows(items.data.items), key)
      : song ? (songRow && { ...songRow, n: null })
        : items.data && key && v4vPage ? v4vRowOf(v4vRows(items.data.items), key)
          : (items.data && key ? (items.data.items || []).map((it, i) => ({ ...it, n: i + 1 })).find((it) => (it.address || it.id) === key) : null) || null;
  const author = ev?.pubkey || passed?.item?.author || null;
  // Everyone else who filed the same account or song (its row's other filers).
  const others = (login || song) && Array.isArray(listed?.filers) ? listed.filers.filter((p) => typeof p === 'string' && p !== author) : [];
  const profiles = useProfiles(author ? [author, ...others] : []);
  const whose = person.signedIn ? 'your' : 'the owner’s';
  const Whose = person.signedIn ? 'Your' : 'The owner’s';
  const nameOf = (pubkey) => {
    if (!pubkey) return '';
    if (pubkey === person.assistant) return `${Whose} Assistant`;
    if (pubkey === person.account) return person.signedIn ? 'You' : 'The owner';
    const p = profiles?.[pubkey];
    const name = p && typeof p === 'object' ? (p.display_name || p.name) : null;
    return name || `${npubOf(pubkey).slice(0, 12)}…`;
  };

  const concept = entry ? displayName(entry) : (tagOf(header.event, 'names') || tagOf(header.event, 'name') || coordParts(coord).d);
  const name = login || (ev && (tagOf(ev, 'names') || tagOf(ev, 'name') || tagOf(ev, 'title') || tagOf(ev, 'd'))) || passed?.item?.name || ref;

  // What this page knows, and may therefore say. Only a known entry names every concept its Items are
  // filed under; only a complete, successful read of those Items can say an item is not among them.
  const own = Boolean(author && (person.authors || []).includes(author));
  const concepts = [coord, entry?.sharedCoord].filter(Boolean);
  const filedHere = ev && entry ? (ev.tags || []).some((t) => t && t[0] === 'z' && concepts.includes(t[1])) : null;
  const complete = Boolean(read.data) && !read.data.truncated;
  // One notice for a failed Items read. Opened from a row, the page already knows where the item stands, so
  // only a song's lists are lost; otherwise the page can't place the item (nor, for a song, list anything).
  const readError = dict.error ? `Couldn’t read ${whose} Dictionary (${dict.error}), so this page can’t say where the item stands in it.`
    : read.error && !passed ? (song
      ? `Couldn’t read the entry’s Items (${read.error}), so this page can’t say where the song stands in them, or list the release’s other songs or more by the artist.`
      : `Couldn’t read the entry’s Items (${read.error}), so this page can’t say where the item stands in them.`)
      : null;
  const songListsError = song && read.error && passed
    ? `Couldn’t read the entry’s Items (${read.error}), so this page can’t list the release’s other songs or more by the artist.`
    : null;
  const notInDictionary = !passed && !dict.error && dict.data !== null && !entry;

  // The event's own description; else, only when the item isn't in the Items, why not.
  let description = tagOf(ev, 'description');
  if (!description && ev && !readError && !listed) {
    if (filedHere === false) {
      description = `${name} isn’t filed under ${concept}.`;
    } else if (filedHere && complete && !own) {
      description = `${name} is filed under ${concept}, but not by anyone ${whose} community trusts, so it isn’t in the entry’s Items.`;
    } else if (filedHere && read.data?.truncated) {
      description = `${name} is filed under ${concept}, but it isn’t among the first ${(read.data.items || []).length.toLocaleString()} Items this page reads.`;
    }
  }
  // A song opened from anywhere but the Items table is in the Items, unnumbered.
  const subtitle = listed?.n ? `Item ${listed.n} in ${concept}` : listed || filedHere ? `Filed under ${concept}` : null;
  // A GitHub account's title is its GitHub name, which a filer's description often just repeats.
  const ghTitle = login && gh.status === 'ok' ? (gh.user.name || login) : login;
  const lede = description && !(ghTitle && description.trim().toLowerCase() === ghTitle.toLowerCase()) ? description : null;

  // Back to the entry, with what it was opened with, so it shows at once and keeps its own way back.
  const entryPath = dictionaryEntryPath(coord);
  const entryState = passed?.entry ? { entry: passed.entry, metric: passed.metric, pov: passed.pov, listHref: passed.listHref } : undefined;
  const fromEntry = passed?.entryHref;
  const entryHref = typeof fromEntry === 'string' && (fromEntry === entryPath || fromEntry.startsWith(`${entryPath}?`))
    ? fromEntry : entryPath;

  // A song's page lists the release's other songs and more by the artist, from that read; each opens its
  // own page, told what this one was opened with. Their rows' numbers count only that read's rows, so none
  // is passed on.
  const related = songRows ? relatedSongs(songRows, song, key || passed?.item?.address || passed?.item?.id) : null;
  const linkFor = (row) => ({
    to: dictionaryItemPath(coord, row),
    state: { item: { ...row, n: null }, entry, metric: passed?.metric, pov: passed?.pov, listHref: passed?.listHref, entryHref: passed?.entryHref },
  });
  const songLimit = songItems.data?.truncated
    ? `These lists show the first ${(songItems.data.items || []).length.toLocaleString()} of the ${songItems.data.keptCount.toLocaleString()} items from this release and by this artist.`
    : null;

  return (
    <DictionaryShell>
      <div className="dict-page dict-skin-light">
        <Link to={entryHref} state={entryState} className="dict-back"><DictIcon name="back" /> {concept}</Link>
        {login ? <GithubAccountHead login={login} gh={gh} subtitle={subtitle} /> : song ? <V4vSongHead song={song} subtitle={subtitle} /> : (
          <>
            <h1 className="dict-entry-title">{name}</h1>
            {subtitle && <p className="dict-entry-sub text-muted">{subtitle}</p>}
          </>
        )}
        {lede && <p className="dict-lede">{lede}</p>}
        {readError && <p className="dict-notice">{readError}</p>}
        {notInDictionary && (
          <p className="dict-notice">
            {`This concept isn’t in ${whose} Dictionary, so this page can’t place the item in its Items.`}
          </p>
        )}
        {itemEvent.done && itemEvent.error && <p className="dict-notice">{itemEvent.error}</p>}
        {login && <GithubProfile login={login} gh={gh} />}
        {login && <GithubRepos login={login} gh={gh} />}
        {song && <V4vPlayer key={song.url} song={song} />}
        {song && <V4vSongLists song={song} related={related} linkFor={linkFor} limit={songLimit} error={songListsError} />}

        {/* The item's Nostr record, set apart and quiet: who filed it, and the raw event. */}
        <footer className="dict-item-foot">
          {author && (
            <p className="dict-item-filer">
              Filed by <span className="dict-item-filer-name">{nameOf(author)}</span>
              <span aria-hidden="true"> · </span>
              <Link to={`/user/${author}`} title={npubOf(author)}>View Nostr profile</Link>
            </p>
          )}
          {others.length > 0 && (
            <p className="dict-item-filer">
              Also filed by{' '}
              {others.map((p, i) => (
                <span key={p}>
                  {i > 0 && ', '}
                  <Link to={`/user/${p}`} title={npubOf(p)} className="dict-item-filer-other">{nameOf(p)}</Link>
                </span>
              ))}
            </p>
          )}
          <Disclosure id="dict-item-raw" label="Raw Nostr event">
            {!itemEvent.done && <p className="text-muted">Reading the event…</p>}
            {ev && <pre className="dict-json">{eventJson(ev)}</pre>}
            {itemEvent.done && !ev && <p className="text-muted">{itemEvent.error}</p>}
          </Disclosure>
        </footer>
      </div>
    </DictionaryShell>
  );
}
