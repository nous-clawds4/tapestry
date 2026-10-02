import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import DictionaryShell from './DictionaryShell';
import DictIcon from '../dictionaries/DictIcon';
import useProfiles from '../../hooks/useProfiles';
import { usePov } from '../../context/PovContext';
import { Disclosure, eventJson, initialOf, npubOf, scan, useHeaderEvent } from '../dictionaries/ConceptEntry';
import {
  coordParts, dictionaryEntryPath, displayName, useConceptDictionary, useConceptItems, useDictionaryPerson,
} from '../dictionaries/conceptsDictionary';

/**
 * /dictionary/:coord/items/:item — one item of a Dictionary entry, as the design's "Dictionary item"
 * screen: its name, "Item N in <concept>", a description, who filed it, and the raw Nostr event.
 *
 * `:item` is the item's address (kind:pubkey:d) or its event id. Opened from the entry's Items table,
 * the row arrives in router state (the item, its number, the entry), so nothing needs reading but the
 * event. A direct visit reads the person's dictionary for the entry, then the entry's Items for the
 * number, from the active point of view. The page says only what those reads establish: that the item
 * isn't trusted needs the whole Items read, the entry known, and the event filed under the concept.
 */

const ADDRESS = /^(\d+):([0-9a-f]{64}):(.+)$/;
const EVENT_ID = /^[0-9a-f]{64}$/;

const tagOf = (ev, name) => {
  const t = (ev?.tags || []).find((x) => x[0] === name && typeof x[1] === 'string' && x[1].trim() !== '');
  return t ? t[1] : null;
};

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

  // The entry's Items (for the number and the trust verdict): read on a direct visit, once the entry is known.
  const items = useConceptItems({ coord, shared: entry?.sharedCoord || null, person, povParams, enabled: !passed && Boolean(entry) });

  const ev = itemEvent.event;
  const key = itemKey(ev);
  const listed = passed ? passed.item
    : (items.data && key ? (items.data.items || []).map((it, i) => ({ ...it, n: i + 1 })).find((it) => (it.address || it.id) === key) : null) || null;
  const author = ev?.pubkey || passed?.item?.author || null;
  const profiles = useProfiles(author ? [author] : []);
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
  const p = author ? profiles?.[author] : null;
  const nip05 = p && typeof p === 'object' && typeof p.nip05 === 'string' && p.nip05 ? p.nip05 : null;

  const concept = entry ? displayName(entry) : (tagOf(header.event, 'names') || tagOf(header.event, 'name') || coordParts(coord).d);
  const plural = (entry?.plural || header.event?.tags?.find((t) => t[0] === 'names')?.[2] || 'items').toLowerCase();
  const name = (ev && (tagOf(ev, 'names') || tagOf(ev, 'name') || tagOf(ev, 'title') || tagOf(ev, 'd'))) || passed?.item?.name || ref;

  // What this page knows, and may therefore say. Only a known entry names every concept its Items are
  // filed under; only a complete, successful read of those Items can say an item is not among them.
  const own = Boolean(author && (person.authors || []).includes(author));
  const concepts = [coord, entry?.sharedCoord].filter(Boolean);
  const filedHere = ev && entry ? (ev.tags || []).some((t) => t && t[0] === 'z' && concepts.includes(t[1])) : null;
  const complete = Boolean(items.data) && !items.data.truncated;
  const readError = dict.error ? `Couldn’t read ${whose} Dictionary (${dict.error}), so this page can’t say where the item stands in it.`
    : items.error ? `Couldn’t read the entry’s Items (${items.error}), so this page can’t say where the item stands in them.`
      : null;
  const notInDictionary = !passed && !dict.error && dict.data !== null && !entry;
  const filer = author === person.assistant ? `${whose} Assistant` : person.signedIn ? 'you' : 'the owner';

  let description = tagOf(ev, 'description');
  if (!description && ev && !readError) {
    if (listed) {
      description = own
        ? `${name} is one of the ${plural} ${filer} filed under ${concept}.`
        : `${name} is one of the ${plural} ${whose} trusted community has filed under ${concept}.`;
    } else if (filedHere === false) {
      description = `${name} isn’t filed under ${concept}.`;
    } else if (filedHere && complete && !own) {
      description = `${name} is filed under ${concept}, but not by anyone ${whose} community trusts, so it isn’t in the entry’s Items.`;
    } else if (filedHere && items.data?.truncated) {
      description = `${name} is filed under ${concept}, beyond the first ${(items.data.items || []).length.toLocaleString()} Items this page reads.`;
    }
  }
  const subtitle = listed ? `Item ${listed.n} in ${concept}` : filedHere ? `Filed under ${concept}` : null;

  // Back to the entry, with what it was opened with, so it shows at once and keeps its own way back.
  const entryPath = dictionaryEntryPath(coord);
  const entryState = passed?.entry ? { entry: passed.entry, metric: passed.metric, pov: passed.pov, listHref: passed.listHref } : undefined;
  const fromEntry = passed?.entryHref;
  const entryHref = typeof fromEntry === 'string' && (fromEntry === entryPath || fromEntry.startsWith(`${entryPath}?`))
    ? fromEntry : entryPath;

  return (
    <DictionaryShell>
      <div className="dict-page dict-skin-light">
        <Link to={entryHref} state={entryState} className="dict-back"><DictIcon name="back" /> {concept}</Link>
        <h1 className="dict-entry-title">{name}</h1>
        {subtitle && <p className="dict-entry-sub text-muted">{subtitle}</p>}
        {description && <p className="dict-lede">{description}</p>}
        {readError && <p className="dict-notice">{readError}</p>}
        {notInDictionary && (
          <p className="dict-notice">
            {`This concept isn’t in ${whose} Dictionary, so this page can’t place the item in its Items.`}
          </p>
        )}
        {itemEvent.done && itemEvent.error && <p className="dict-notice">{itemEvent.error}</p>}

        {author && (
          <div className="dict-card dict-entry-card dict-filed-by">
            <span className="dict-avatar dict-avatar--soft dict-avatar--lg" aria-hidden="true">{initialOf(nameOf(author))}</span>
            <div className="dict-strip-text">
              <span className="dict-field-label">Filed by</span>
              <span className="dict-filed-by-name">
                {nameOf(author)}{nip05 && <span className="dict-strip-faint"> · {nip05}</span>}
              </span>
            </div>
            <Link to={`/user/${author}`} className="dict-pill-btn dict-pill-btn--quiet dict-filed-by-link" title={npubOf(author)}>
              View Nostr profile
            </Link>
          </div>
        )}

        <Disclosure id="dict-item-raw" label="Raw Nostr event">
          {!itemEvent.done && <p className="text-muted">Reading the event…</p>}
          {ev && <pre className="dict-json">{eventJson(ev)}</pre>}
          {itemEvent.done && !ev && <p className="text-muted">{itemEvent.error}</p>}
        </Disclosure>
      </div>
    </DictionaryShell>
  );
}
