import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import DispositionPanel from '../../components/DispositionPanel';
import useProfiles from '../../hooks/useProfiles';
import useCommunitySharedConcepts from '../../hooks/useCommunitySharedConcepts';
import { usePov } from '../../context/PovContext';
import { useConfig } from '../../context/ConfigContext';
import DictIcon from './DictIcon';
import {
  NEW_CONCEPT_PATH, authorLabel, displayName, entryPath, itemCountText, metricLabel, metricShort,
  overrideBadge, povLine, useSharedByMe, useTrustedDictionary,
} from './conceptsDictionary';

/**
 * Dictionary › Concepts, version 1 (handoff SPEC § 2; design: the Brainstorm
 * mock's Dictionary page). It replaces the navigation-scaffolding placeholder.
 *
 * The rows are the trusted dictionary (ADR shared-concepts-adoption/0005):
 * concept headers that at least N trusted people file items under, computed
 * by the server from the active point of view. The server sends each row's
 * `gum` and names the metric (`metric`, "gum1" in v1); this page sorts and
 * filters those values and never re-derives them (SPEC § 4).
 *
 * Stubbed until Pins land (SPEC § 3): the owner's Add / Veto. The server
 * returns override: null, so no Added / Vetoed badge shows yet; the badge
 * code is in place for when it does. The Veto control lives on the entry
 * page. "Add to Dictionary" in the finder opens the existing adoption flow
 * (a twin + DispositionPanel) instead of publishing a pin.
 */

// Show groups (SPEC § 2.2). The subject groups — Nostr, Bitcoin, … — are version 2 (SPEC § 3).
const SHOW_GROUPS = [
  { key: 'firmware', label: 'Firmware', test: (e) => e.isFirmware },
  { key: 'mine', label: 'Shared by me', test: (e, shared) => shared.has(e.coord) },
  { key: 'private', label: 'Private', test: (e) => e.sentinelDeferred },
];

const byName = (a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' })
  || a.coord.localeCompare(b.coord);
const SORTS = {
  az: { label: () => 'Alphabetical (A to Z)', note: () => '', cmp: byName },
  za: { label: () => 'Reverse alphabetical (Z to A)', note: () => 'Z to A', cmp: (a, b) => byName(b, a) },
  gumAsc: {
    label: (m) => `${metricLabel(m)} (lowest first)`, note: (m) => `${metricShort(m)}, lowest first`,
    cmp: (a, b) => a.gum - b.gum || byName(a, b),
  },
  gumDesc: {
    label: (m) => `${metricLabel(m)} (highest first)`, note: (m) => `${metricShort(m)}, highest first`,
    cmp: (a, b) => b.gum - a.gum || byName(a, b),
  },
};
const isGumSort = (sort) => sort === 'gumAsc' || sort === 'gumDesc';

const EMPTY = new Set();

/**
 * The FAQ — the mock's copy, corrected so that every claim is true of version
 * 1 (owner decision, 2026-09-27). The technical "decide" answer is rewritten to
 * describe GUM₁, the rule the server runs; the Selection Bar answer is marked
 * as version 2.
 */
function faqItems({ threshold, cutoff }) {
  const min = threshold ?? 2;
  const cut = cutoff ?? 0.01;
  return [
    {
      q: 'What is a Concept?',
      a: 'Concepts are the ideas your trusted community generally agrees on: restaurants, podcasters, relays, tags. Your Assistant keeps these Dictionary entries up to date automatically, in real time, based on input from your trusted community. Adding entries by hand, or vetoing ones your community endorses, comes in a later version. Your choice will then always win.',
    },
    {
      q: 'What is a Concept? (technical)',
      a: 'Every row on this page is a DList header (kind 39998) stored on this instance, authored by your Assistant or by someone else, that members of your trusted community file items under with a z-tag. In this version, community acceptance is inferred from those z-tag filings (GUM₁, below); b-tags and Pins are not read yet. When they are, your own Pins (+ to add, − to veto) will override the community’s. Adding and vetoing will use the Pin “Add to My Dictionary”. It is separate from “Spawns a Concept”, which asks your Assistant to curate a concept actively: to keep its own copies of the concept’s sets and elements too, not just its header.',
    },
    {
      q: 'How does my Assistant decide what belongs in this Dictionary?',
      a: `Your Assistant watches the people you trust. When enough of them — at least ${min} — have filed items under the same concept, your Assistant adds it to yours too. Adding a concept yourself, or vetoing one your community has added, comes in a later version.`,
    },
    {
      q: 'How does my Assistant decide what belongs in this Dictionary? (technical)',
      a: `Your Assistant reads every concept header stored on this instance (kind-39998 DList headers, its own and other people’s) and the events that point at each one with a z-tag: the items filed under it. For each header it computes the General Usage Metric GUM₁: the number of distinct authors of those items whose influence is above the verified cutoff (${cut}) from your point of view. The header’s own author and your Assistant never count, because self-filing is not community evidence. A concept is in this Dictionary when its GUM₁ is at least ${min}. Nothing is stored: the list is computed on every read, from your point of view when this instance holds your scores and from the house point of view otherwise, so a new filing shows up on your next visit. The cutoff and the minimum are settings of this instance for now. Two more metrics are planned: GUM₂, the sum of the rank scores of trusted users whose Assistants’ headers point at the shared concept with a b-tag, and GUM₃, the rank-weighted sum of “Add to My Dictionary” pinnings (an apply adds, a dispute subtracts). You will choose the metric and its cutoff on the Automated Assistant Tasks page.`,
    },
    {
      q: 'How do I find new concepts?',
      a: 'Use “Don’t see what you’re looking for?” above the list. It searches the DList headers on the community relay whose authors have Shared them: a header whose b-tag points to itself has been actively Shared by its author, and is marked Shared. In this version the results are not filtered by the author’s rank and show no usage scores yet. “Add to Dictionary” opens the adoption flow: choose one of your own concepts as the local twin, and your Assistant wires it to the shared concept with a b-tag. If nothing fits, Create New Concept.',
    },
    {
      q: 'How does the Selection Bar work? (technical)',
      a: 'Coming in version 2. Each option in the Selection Bar names a concept X that has a superset: the set of all X. An entry is shown under X when its concept header is an element of the superset for the concept of X — that is, when the header carries a class-thread n tag (HAS_ELEMENT) pointing at that superset, signed by a curator your Assistant trusts for that concept. Firmware is the superset of firmware concepts. Concepts My Assistant Curates Actively is derived instead: it lists the concepts pinned to “Spawns a Concept”, whose sets and elements your Assistant keeps its own copies of. An entry can appear under several options at once. Selecting several options shows the union: every entry that belongs to any of them. In this version, Show (under Search and sort) offers Firmware (the concepts in this instance’s firmware manifest), Shared by me and Private, and also shows the union of what you select.',
    },
  ];
}

export default function DictionaryConcepts() {
  const { povParams } = usePov();
  const { taPubkey } = useConfig();
  const { data, error } = useTrustedDictionary(povParams);
  const shared = useSharedByMe();

  const [faqShown, setFaqShown] = useState(false);
  const [faqOpen, setFaqOpen] = useState(-1);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [groups, setGroups] = useState([]); // [] = all entries
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('az');
  const [findOpen, setFindOpen] = useState(false);

  const entries = useMemo(() => data?.entries || [], [data]);
  const metric = data?.metric || 'gum1';
  const pov = data?.pov || {};
  const sharedCoords = shared.coords || EMPTY;

  // Several authors can publish a header with the same name (on staging, four
  // "nostr user tag" headers qualify). Those rows name their author.
  const sameName = useMemo(() => {
    const counts = new Map();
    for (const e of entries) {
      const k = displayName(e).toLowerCase();
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return (e) => counts.get(displayName(e).toLowerCase()) > 1;
  }, [entries]);
  const bylineAuthors = useMemo(
    () => [...new Set(entries.filter(sameName).map((e) => e.author).filter(Boolean))],
    [entries, sameName],
  );
  const profiles = useProfiles(bylineAuthors);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = entries
    .filter((e) => !groups.length || SHOW_GROUPS.some((g) => groups.includes(g.key) && g.test(e, sharedCoords)))
    .filter((e) => !words.length || words.every((w) => `${displayName(e)} ${e.plural || ''} ${e.description || ''}`.toLowerCase().includes(w)))
    .sort(SORTS[sort].cmp);

  const narrowed = groups.length > 0 || words.length > 0;
  const total = entries.length;
  const countText = narrowed
    ? `${shown.length} of ${total} concept${total === 1 ? '' : 's'}`
    : `${total} concept${total === 1 ? '' : 's'} in your Dictionary`;
  const groupNames = SHOW_GROUPS.filter((g) => groups.includes(g.key)).map((g) => g.label);
  const filterNote = toolsOpen ? '' : [
    groupNames.join(' or '),
    query.trim() ? `“${query.trim()}”` : '',
    SORTS[sort].note(metric),
  ].filter(Boolean).join(' · ');
  const toolsActive = toolsOpen || narrowed || sort !== 'az';

  const toggleGroup = (key) => setGroups((gs) => (gs.includes(key) ? gs.filter((k) => k !== key) : [...gs, key]));
  const groupCount = (g) => {
    if (g.key === 'mine' && (shared.failed || shared.coords === null)) return null;
    return entries.filter((e) => g.test(e, sharedCoords)).length;
  };

  const faqs = faqItems({ threshold: pov.threshold, cutoff: pov.cutoff });
  const inDictionary = useMemo(() => new Set(entries.map((e) => e.coord)), [entries]);

  return (
    <div className="page dict-page">
      <Breadcrumbs />
      <h1>📖 Concepts</h1>
      <p className="dict-lede">
        The concepts your trusted community generally accepts. Your Assistant keeps these entries up to date
        automatically.
      </p>
      {data && <p className="dict-pov text-muted">{povLine(pov)}</p>}

      {/* FAQ — closed by default (SPEC § 2.3). */}
      <div className="dict-faq-wrap">
        <button
          type="button" className="dict-link-btn" aria-expanded={faqShown} aria-controls="dict-faq"
          onClick={() => setFaqShown(!faqShown)}
        >
          Frequently asked questions <span className={`dict-chev${faqShown ? ' is-open' : ''}`}><DictIcon name="chevron" /></span>
        </button>
        {faqShown && (
          <div id="dict-faq" className="dict-card dict-faq">
            {faqs.map((f, i) => (
              <div key={f.q} className="dict-faq-item">
                <button
                  type="button" className="dict-faq-q" aria-expanded={faqOpen === i}
                  onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}
                >
                  <span>{f.q}</span>
                  <span className={`dict-chev${faqOpen === i ? ' is-open' : ''}`}><DictIcon name="chevron" size={16} /></span>
                </button>
                {faqOpen === i && <p className="dict-faq-a">{f.a}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Count, filter note and the search-and-sort toggle — closed by default (SPEC § 2.2). */}
      <div className="dict-count-row">
        <span className="dict-count">{data ? countText : 'Assembling your Dictionary…'}</span>
        {filterNote && <span className="dict-filter-note">{filterNote}</span>}
        <span className="dict-spacer" />
        <button
          type="button" className={`dict-tools-btn${toolsActive ? ' is-active' : ''}`}
          aria-label="Search and sort" title="Search and sort"
          aria-expanded={toolsOpen} aria-controls="dict-tools"
          onClick={() => { setToolsOpen(!toolsOpen); setShowOpen(false); }}
        >
          <DictIcon name="search" size={17} />
        </button>
      </div>

      {toolsOpen && (
        <div id="dict-tools" className="dict-panel dict-tools">
          <div className="dict-field dict-field--full">
            <span className="dict-field-label" id="dict-show-label">Show</span>
            <button
              type="button" className="dict-select-btn" aria-haspopup="true" aria-expanded={showOpen}
              aria-labelledby="dict-show-label dict-show-value" onClick={() => setShowOpen(!showOpen)}
            >
              <span id="dict-show-value">{groupNames.length ? groupNames.join(', ') : 'All entries'}</span>
              <DictIcon name="chevron" />
            </button>
            {showOpen && (
              <div className="dict-menu" role="group" aria-label="Show entries in any of">
                <label className="dict-menu-option">
                  <input type="checkbox" checked={!groups.length} onChange={() => setGroups([])} />
                  <span className="dict-menu-name">All entries</span>
                  <span className="dict-menu-count">{total}</span>
                </label>
                {SHOW_GROUPS.map((g) => {
                  const n = groupCount(g);
                  return (
                    <label key={g.key} className="dict-menu-option">
                      <input type="checkbox" checked={groups.includes(g.key)} onChange={() => toggleGroup(g.key)} />
                      <span className="dict-menu-name">{g.label}</span>
                      <span
                        className="dict-menu-count"
                        title={n === null ? 'Could not read what you have shared yet.' : undefined}
                      >
                        {n === null ? '…' : n}
                      </span>
                    </label>
                  );
                })}
                <div className="dict-menu-foot">
                  <span>Shows entries in any selected group.</span>
                  <button type="button" className="dict-pill-btn" onClick={() => setShowOpen(false)}>Done</button>
                </div>
              </div>
            )}
          </div>
          <label className="dict-field dict-field--grow">
            <span className="dict-field-label">Search</span>
            <input
              type="search" className="dict-input" value={query} placeholder="Search names and descriptions"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="dict-field dict-field--sort">
            <span className="dict-field-label">Order by</span>
            <select className="dict-input" value={sort} onChange={(e) => setSort(e.target.value)}>
              {Object.entries(SORTS).map(([key, s]) => <option key={key} value={key}>{s.label(metric)}</option>)}
            </select>
          </label>
          {isGumSort(sort) && (
            <p className="dict-gum-note">
              <strong>{metricLabel(metric)}:</strong> how many distinct people you trust (influence above the
              verified cutoff, from your point of view) have filed items under this concept. At {pov.threshold ?? 2} or
              more, the concept is in your Dictionary.
            </p>
          )}
        </div>
      )}

      {/* "Don't see what you're looking for?" + Create New Concept (SPEC § 2.4–2.5). */}
      <div className="dict-find-row">
        <button
          type="button" className="dict-link-btn" aria-expanded={findOpen} aria-controls="dict-find"
          onClick={() => setFindOpen(!findOpen)}
        >
          Don’t see what you’re looking for? <span className={`dict-chev${findOpen ? ' is-open' : ''}`}><DictIcon name="chevron" /></span>
        </button>
        <span className="dict-spacer" />
        <Link to={NEW_CONCEPT_PATH} className="dict-create-btn">
          <DictIcon name="plus" /> Create New Concept
        </Link>
      </div>
      {findOpen && <ConceptFinder inDictionary={inDictionary} taPubkey={taPubkey} />}

      {error && <div className="error">Could not assemble your Dictionary: {error}</div>}

      {data && (
        <ul className="dict-card dict-list" aria-label="Concepts in your Dictionary">
          {shown.map((e) => {
            const isShared = sharedCoords.has(e.coord);
            const badge = overrideBadge(e);
            return (
              <li key={e.coord}>
                <Link
                  to={entryPath(e.coord)} state={{ entry: e, metric, pov }}
                  className={`dict-row${isShared ? ' dict-row--shared' : ''}${e.override === 'vetoed' ? ' dict-row--vetoed' : ''}`}
                >
                  <span className="dict-row-main">
                    <span className="dict-row-title">
                      <span className="dict-row-name">{displayName(e)}</span>
                      {e.isFirmware && <span className="dict-pill dict-pill--firmware">Firmware</span>}
                      {isShared && (
                        <span className="dict-marker dict-marker--shared" title="You authored this concept and shared it (its b-tag points to itself)">
                          <DictIcon name="share" size={12} /> Shared by you
                        </span>
                      )}
                      {e.sentinelDeferred && (
                        <span className="dict-marker dict-marker--private" title="Kept private: marked as deliberately not shared with the community">
                          <DictIcon name="lock" size={12} /> Private
                        </span>
                      )}
                    </span>
                    {e.description && <span className="dict-row-desc">{e.description}</span>}
                    {sameName(e) && (
                      <span className="dict-row-by">by {authorLabel(e.author, { taPubkey, profiles })}</span>
                    )}
                  </span>
                  <span className="dict-row-stats">
                    {isGumSort(sort) && <span className="dict-row-gum" title={metricLabel(metric)}>{e.gum}</span>}
                    <span className="dict-row-count">{itemCountText(e.itemCount)}</span>
                    {badge && <span className={badge.className}>{badge.label}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
          {shown.length === 0 && (
            <li className="dict-empty">
              {total === 0
                ? 'Nothing here yet: no concept has enough trusted people filing items under it.'
                : 'No concept matches.'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * "Don't see what you're looking for?" — a keyword search over the concepts
 * people have Shared with the community (useCommunitySharedConcepts: headers
 * whose b-tag points to themselves). Mounted only while open, so the relay is
 * asked only when someone looks.
 */
function ConceptFinder({ inDictionary, taPubkey }) {
  const { rows } = useCommunitySharedConcepts();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(null); // the community row being added

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = words.length && rows
    ? rows.filter((r) => !inDictionary.has(r.uuid)
      && words.every((w) => `${r.name || ''} ${r.description || ''}`.toLowerCase().includes(w)))
    : [];
  const visible = found.slice(0, 8);
  const profiles = useProfiles(visible.map((r) => r.author));

  let status = '';
  if (rows === null) status = 'Searching the community relay…';
  else if (words.length) status = found.length ? `${found.length} concept${found.length === 1 ? '' : 's'} found` : 'No concepts found';

  return (
    <div id="dict-find" className="dict-panel dict-find">
      <label className="dict-field dict-field--full">
        <span className="dict-field-label">Search concepts shared with your community</span>
        <input
          type="search" className="dict-input" value={q} placeholder="Try “taco”, “podcast” or “bird”"
          onChange={(e) => { setQ(e.target.value); setAdding(null); }}
        />
      </label>
      {status && <div className="dict-find-status" role="status">{status}</div>}
      {visible.length > 0 && (
        <ul className="dict-find-list">
          {visible.map((r) => (
            <li key={r.uuid} className="dict-find-item">
              <div className="dict-find-main">
                <span className="dict-row-title">
                  <span className="dict-find-name">{r.name || r.uuid}</span>
                  <span className="dict-pill dict-pill--shared" title="Its author shared it: its b-tag points to itself">
                    <DictIcon name="share" size={10} /> Shared
                  </span>
                </span>
                {r.description && <span className="dict-row-desc">{r.description}</span>}
                <span className="dict-row-by">by {authorLabel(r.author, { taPubkey, profiles })}</span>
              </div>
              <button
                type="button" className="dict-add-btn" aria-expanded={adding?.uuid === r.uuid}
                onClick={() => setAdding(adding?.uuid === r.uuid ? null : r)}
              >
                Add to Dictionary
              </button>
              {adding?.uuid === r.uuid && <AddToDictionary concept={r} onClose={() => setAdding(null)} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Version 1's "Add to Dictionary": the existing adoption flow, not a pin
 * (SPEC § 2.4). The owner picks one of their own concepts as the local twin;
 * DispositionPanel then wires it to the shared concept with a pointer b-tag.
 */
function AddToDictionary({ concept, onClose }) {
  const [twins, setTwins] = useState(null);
  const [twin, setTwin] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/adoption-twins');
        const json = await resp.json();
        if (!resp.ok || json.success === false) throw new Error(json.error || `HTTP ${resp.status}`);
        if (!cancelled) setTwins(json.twins || []);
      } catch {
        if (!cancelled) setTwins([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const twinName = twins?.find((t) => t.handle === twin)?.name;

  return (
    <div className="dict-add">
      <p className="dict-add-lede">
        In this version, your Assistant adds a shared concept by wiring one of your own concepts to it (a pointer
        b-tag). Choose your twin for <strong>{concept.name || concept.uuid}</strong>, then Wire.
      </p>
      <select className="dict-input" value={twin} onChange={(e) => setTwin(e.target.value)} aria-label="Your twin concept">
        <option value="">{twins === null ? 'Loading your concepts…' : 'Choose one of your concepts as its twin…'}</option>
        {(twins || []).map((t) => <option key={t.handle} value={t.handle}>{t.name}</option>)}
      </select>
      {twin && (
        <div className="dict-add-panel">
          <DispositionPanel key={twin} handle={twin} name={twinName} initialTarget={concept.uuid} onClose={onClose} />
        </div>
      )}
      <p className="dict-add-foot text-muted">
        No matching concept of your own? <Link to={NEW_CONCEPT_PATH}>Create New Concept</Link>, then come back to wire it.
      </p>
    </div>
  );
}
