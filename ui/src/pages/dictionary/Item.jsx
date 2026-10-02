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
 * `:item` is the item's address (kind:pubkey:d) or its event id, as the entry's Items table names
 * it. Opened from that table, the row arrives in router state (the item, its number, the entry), so
 * nothing needs reading but the event. A direct visit reads the person's dictionary for the entry,
 * then the entry's Items for the number, from the active point of view.
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

export default function DictionaryItemPage() {
  const { coord: rawCoord, item: rawItem } = useParams();
  const coord = decodeURIComponent(rawCoord || '');
  const ref = decodeURIComponent(rawItem || '');
  const location = useLocation();
  const st = location.state;
  const passed = st?.item && (st.item.address || st.item.id) === ref ? st : null;
  const { povParams } = usePov();
  const person = useDictionaryPerson();

  // The entry: from the row, else the person's dictionary (and its header, for the names, if it isn't in it).
  const dict = useConceptDictionary(person, povParams, { enabled: !passed?.entry });
  const entry = passed?.entry || (dict.data?.entries || []).find((e) => e.coord === coord) || null;
  const header = useHeaderEvent(entry ? null : coord);
  const itemEvent = useItemEvent(ref);

  // The item's number: from the row, else its place in the entry's Items (read once the entry is known).
  const settled = Boolean(passed?.entry) || dict.data !== null;
  const items = useConceptItems({ coord, shared: entry?.sharedCoord || null, person, povParams, enabled: !passed && settled });
  const listed = passed ? passed.item : (items.data?.items || []).map((it, i) => ({ ...it, n: i + 1 })).find((it) => (it.address || it.id) === ref) || null;

  const ev = itemEvent.event;
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
  const own = Boolean(author && (person.authors || []).includes(author));
  const itemsKnown = Boolean(passed) || items.data !== null;

  // The event's own description, else what the Items list establishes about it: who filed it here.
  let description = tagOf(ev, 'description');
  if (!description && ev && itemsKnown) {
    if (!listed) description = `${name} is filed under ${concept}, but not by anyone ${whose} community trusts, so it isn’t in the entry’s Items.`;
    else if (own) description = `${name} is one of the ${plural} ${person.signedIn ? 'you' : 'the owner'} filed under ${concept}.`;
    else description = `${name} is one of the ${plural} ${whose} trusted community has filed under ${concept}.`;
  }

  // Back to the entry, with what it was opened with, so it shows at once and keeps its own way back.
  const entryState = passed?.entry ? { entry: passed.entry, metric: passed.metric, pov: passed.pov, listHref: passed.listHref } : undefined;
  const entryHref = typeof passed?.entryHref === 'string' && passed.entryHref.startsWith(dictionaryEntryPath(coord))
    ? passed.entryHref : dictionaryEntryPath(coord);

  return (
    <DictionaryShell>
      <div className="dict-page dict-skin-light">
        <Link to={entryHref} state={entryState} className="dict-back"><DictIcon name="back" /> {concept}</Link>
        <h1 className="dict-entry-title">{name}</h1>
        <p className="dict-entry-sub text-muted">
          {listed ? `Item ${listed.n} in ${concept}` : `An item in ${concept}`}
        </p>
        {description && <p className="dict-lede">{description}</p>}
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
              View Nostr profile <DictIcon name="external" size={12} />
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
