import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import DispositionPanel from '../../components/DispositionPanel';
import useProfiles from '../../hooks/useProfiles';
import useCommunitySharedConcepts from '../../hooks/useCommunitySharedConcepts';
import { usePov } from '../../context/PovContext';
import DictIcon from './DictIcon';
import {
  NEW_CONCEPT_PATH, authorLabel, displayName, entryPath, itemCountText, metricLabel, metricShort,
  overrideBadge, povLine, useConceptDictionary, useDictionaryPerson,
} from './conceptsDictionary';

/**
 * Dictionary › Concepts, version 1 (handoff SPEC § 2; design: the Brainstorm
 * mock's Dictionary page). It replaces the navigation-scaffolding placeholder.
 *
 * The rows are the person's own dictionary (the owner's correction of
 * 2026-09-29): their concept headers that carry a real b-tag, wired to a
 * shared concept or self-declared as one — exactly what Active b-tags lists
 * under "Mine". The design's FAQ says so: "Every row on this page is a DList
 * header authored by your local Assistant, carrying a b-tag…". The server
 * scores each row with GUM₁ of the shared concept it points to and names the
 * metric (`metric`, "gum1"); this page sorts and filters those values and
 * never re-derives them (SPEC § 4). The trusted dictionary is not this list:
 * in the design it is the rule an Assistant will use to clone concepts into it.
 *
 * Stubbed until Pins land (SPEC § 3): the owner's Add / Veto. The server
 * returns override: null, so no Added / Vetoed badge shows yet; the badge
 * code is in place for when it does. The Veto control lives on the entry
 * page. "Add to Dictionary" in the finder opens the existing adoption flow
 * (a twin + DispositionPanel) instead of publishing a pin.
 */

// Show groups (SPEC § 2.2). The subject groups — Nostr, Bitcoin, … — are version 2 (SPEC § 3). So is
// Private: in the design it marks encrypted, local-only concepts, and a kept-private header (the
// b-tag-deferred sentinel) carries no real b-tag, so it is never a row here.
const SHOW_GROUPS = [
  { key: 'firmware', label: () => 'Firmware', test: (e) => e.isFirmware },
  { key: 'mine', label: (signedIn) => (signedIn ? 'Shared by me' : 'Shared by the owner'), test: (e) => e.selfDeclared },
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

// The design's minimum author rank for concept search (SPEC § 4), quoted in the FAQ's
// "coming later" text. Nothing filters on it yet.
const MIN_AUTHOR_RANK = 20;

/**
 * The FAQ — the design's copy (owner, 2026-09-29: "back to your wording").
 * Sentences the design states as working today, but which are not built yet,
 * are either marked "Coming in a later version" (kept verbatim) or put in the
 * future tense. The technical "decide" answer starts with what version 1
 * does, as SPEC § 2.3 asks. Each answer is a list of paragraphs.
 */
function faqItems({ cutoff }) {
  const cut = cutoff ?? 0.01;
  return [
    {
      q: 'What is a Concept?',
      a: ['Concepts are the ideas your trusted community generally agrees on: restaurants, podcasters, relays, tags. In a later version, your Assistant will keep these Dictionary entries up to date automatically, in real time, based on input from your trusted community. You can also add entries by hand now, and later veto ones your community endorses. Your choice always wins.'],
    },
    {
      q: 'What is a Concept? (technical)',
      a: ['Every row on this page is a DList header authored by your local Assistant, carrying a b-tag that recognizes at least one other DList header as a shared concept. In a later version, community acceptance will be inferred from b-tags and publicly available Pins; for now, each row shows GUM₁ (below) for the shared concept it points to. Your own Pins (+ to add, − to veto) will override the community\'s. Adding and vetoing will use the Pin “Add to My Dictionary”. It is separate from “Spawns a Concept”, which asks your Assistant to curate a concept actively: to keep its own copies of the concept’s sets and elements too, not just its header.'],
    },
    {
      q: 'How does my Assistant decide what belongs in this Dictionary?',
      a: [
        'In this version your Assistant doesn’t decide on its own yet: the concepts here are the ones you have added or shared, and the ones this instance’s firmware came with.',
        'Coming in a later version: Your Assistant watches the people you trust. When enough of them — weighted by how much you trust each one — have put the same concept in their own dictionaries, your Assistant adds it to yours too. You can always add a concept yourself, or veto one your community has added.',
      ],
    },
    {
      q: 'How does my Assistant decide what belongs in this Dictionary? (technical)',
      a: [
        `In this version your Assistant does not add or remove entries on its own. A concept is in your Dictionary when a kind-39998 header signed by your Assistant (or by you) carries a b-tag that points at a shared concept, or at itself when you shared it. The reserved b-tag-deferred and malformed b values don’t count. Each entry shows GUM₁ for the shared concept it points to: the number of distinct trusted authors — influence above the verified cutoff (${cut}), from your point of view — who file items under the concept with a z-tag; the concept's own author and your Assistant never count. Nothing is stored: the list and its scores are read afresh on every visit.`,
        'Coming in a later version: Your Assistant monitors members of your community who have published the identities of their Brainstorm Assistants (using the Tag system), and looks for kind-39998 events those Assistants have published that carry a b-tag pointing at a shared concept header. It then computes a General Usage Metric for each shared concept, in one of three ways. GUM₁ (the default): the number of distinct trusted authors — influence above the verified cutoff, from your point of view — who file items under the concept with a z-tag; the concept\'s own author and your Assistant never count. GUM₂: for each user whose Assistant has wired to that shared concept header with a b-tag, add up their rank score, pulled from Trusted Assertions. GUM₃: for each pinning on “Add to My Dictionary”, add up the pinner\'s rank score — an apply adds it, a dispute subtracts it. If the selected metric is above the cutoff (default 2 for GUM₁, 1.50 for GUM₂ and GUM₃), your Assistant clones the shared concept: it publishes its own header with a b-tag pointing at the shared one. The choice of metric and the cutoff can be changed on the Automated Assistant Tasks page. Your own pins always override the result.',
      ],
    },
    {
      q: 'How do I find new concepts?',
      a: [
        'Use “Don’t see what you’re looking for?” above the list. In this version it searches the DList headers on the community relay whose authors have Shared them: a result whose b-tag points to itself has been actively Shared by its author, and is marked Shared. “Add to Dictionary” opens the adoption flow: choose one of your own concepts as its local twin, and your Assistant wires it to the shared concept with a b-tag, which puts it on this list. For now only the owner of this instance can add from here. If nothing fits, Create New Concept.',
        `Coming in a later version: You can search the DList headers published by trusted members of your community: those whose authors have a rank above ${MIN_AUTHOR_RANK} (adjustable on the Automated Assistant Tasks page). If a result is the target of b-tags from trusted members, you’ll see its GUM₂ and GUM₃ scores, calculated as described above (GUM₁ appears once the concept has items filed under it).`,
      ],
    },
    {
      q: 'How does the Selection Bar work? (technical)',
      a: [
        'Coming in a later version: Each option in the Selection Bar names a concept X that has a superset: the set of all X. An entry is shown under X when its concept header is an element of the superset for the concept of X — that is, when the header carries a class-thread n tag (HAS_ELEMENT) pointing at that superset, signed by a curator your Assistant trusts for that concept. Firmware is the superset of firmware concepts. Concepts My Assistant Curates Actively is derived instead: it lists the concepts pinned to “Spawns a Concept”, whose sets and elements your Assistant keeps its own copies of. An entry can appear under several options at once. Selecting several options shows the union: every entry that belongs to any of them.',
        'In this version, Show (under Search and sort) offers Firmware (entries that are, or point at, a concept in this instance’s firmware manifest) and Shared by me (concepts you shared: their b-tag points to themselves), and shows the union of what you select.',
      ],
    },
  ];
}

export default function DictionaryConcepts() {
  const { povParams } = usePov();
  const person = useDictionaryPerson();
  const { data, error, reload } = useConceptDictionary(person, povParams);

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
  const signedIn = person.signedIn;
  const whose = signedIn ? 'your' : 'the owner’s';

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = entries
    .filter((e) => !groups.length || SHOW_GROUPS.some((g) => groups.includes(g.key) && g.test(e)))
    .filter((e) => !words.length || words.every((w) => `${displayName(e)} ${e.plural || ''} ${e.description || ''}`.toLowerCase().includes(w)))
    .sort(SORTS[sort].cmp);

  const narrowed = groups.length > 0 || words.length > 0;
  const total = entries.length;
  const countText = narrowed
    ? `${shown.length} of ${total} concept${total === 1 ? '' : 's'}`
    : `${total} concept${total === 1 ? '' : 's'} in ${whose} Dictionary`;
  const groupNames = SHOW_GROUPS.filter((g) => groups.includes(g.key)).map((g) => g.label(signedIn));
  const filterNote = toolsOpen ? '' : [
    groupNames.join(' or '),
    query.trim() ? `“${query.trim()}”` : '',
    SORTS[sort].note(metric),
  ].filter(Boolean).join(' · ');
  const toolsActive = toolsOpen || narrowed || sort !== 'az';

  const toggleGroup = (key) => setGroups((gs) => (gs.includes(key) ? gs.filter((k) => k !== key) : [...gs, key]));

  const faqs = faqItems({ cutoff: pov.cutoff });
  // What the finder leaves out: the entries themselves and every shared concept they point to.
  const inDictionary = useMemo(
    () => new Set(entries.flatMap((e) => [e.coord, ...(e.targets || [])])),
    [entries],
  );

  return (
    <div className="page dict-page">
      <Breadcrumbs />
      <h1>📖 Concepts</h1>
      <p className="dict-lede">
        The concepts your trusted community generally accepts. You can add entries yourself; in a later version
        your Assistant will keep them up to date automatically, and you’ll be able to veto any entry.
      </p>
      {!person.loading && !signedIn && (
        <p className="dict-pov text-muted">You’re signed out, so this is the owner’s Dictionary. Sign in to see your own.</p>
      )}
      {signedIn && !person.assistant && (
        <p className="dict-pov text-muted">
          You have no assistant key on this instance, so your Dictionary shows only concepts you signed yourself.
        </p>
      )}
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
                {faqOpen === i && f.a.map((para) => <p key={para.slice(0, 40)} className="dict-faq-a">{para}</p>)}
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
                {SHOW_GROUPS.map((g) => (
                  <label key={g.key} className="dict-menu-option">
                    <input type="checkbox" checked={groups.includes(g.key)} onChange={() => toggleGroup(g.key)} />
                    <span className="dict-menu-name">{g.label(signedIn)}</span>
                    <span className="dict-menu-count">{entries.filter((e) => g.test(e)).length}</span>
                  </label>
                ))}
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
              verified cutoff, from your point of view) file items under the shared concept each entry points to.
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
      {findOpen && (
        <ConceptFinder
          inDictionary={inDictionary}
          assistantPubkey={person.assistant}
          assistantLabel={signedIn ? 'your Assistant' : 'the owner’s Assistant'}
          canAdd={signedIn && person.isOwner}
          onAdded={reload}
        />
      )}

      {error && <div className="error">Could not assemble {whose} Dictionary: {error}</div>}

      {data && (
        <ul className="dict-card dict-list" aria-label={`Concepts in ${whose} Dictionary`}>
          {shown.map((e) => {
            const badge = overrideBadge(e);
            return (
              <li key={e.coord}>
                <Link
                  to={entryPath(e.coord)} state={{ entry: e, metric, pov }}
                  className={`dict-row${e.selfDeclared ? ' dict-row--shared' : ''}${e.override === 'vetoed' ? ' dict-row--vetoed' : ''}`}
                >
                  <span className="dict-row-main">
                    <span className="dict-row-title">
                      <span className="dict-row-name">{displayName(e)}</span>
                      {e.isFirmware && <span className="dict-pill dict-pill--firmware">Firmware</span>}
                      {e.selfDeclared && (
                        <span className="dict-marker dict-marker--shared" title="Shared with the community: its b-tag points to itself">
                          <DictIcon name="share" size={12} /> {signedIn ? 'Shared by you' : 'Shared by the owner'}
                        </span>
                      )}
                    </span>
                    {e.description && <span className="dict-row-desc">{e.description}</span>}
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
                ? `Nothing here yet: none of ${whose} concepts carries a b-tag.`
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
function ConceptFinder({ inDictionary, assistantPubkey, assistantLabel, canAdd, onAdded }) {
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
      {!canAdd && <p className="dict-add-foot text-muted">For now only the owner of this instance can add a concept from here.</p>}
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
                <span className="dict-row-by">by {authorLabel(r.author, { assistantPubkey, assistantLabel, profiles })}</span>
              </div>
              {canAdd && (
                <button
                  type="button" className="dict-add-btn" aria-expanded={adding?.uuid === r.uuid}
                  onClick={() => setAdding(adding?.uuid === r.uuid ? null : r)}
                >
                  Add to Dictionary
                </button>
              )}
              {canAdd && adding?.uuid === r.uuid && (
                <AddToDictionary concept={r} onAdded={onAdded} onClose={() => setAdding(null)} />
              )}
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
 * DispositionPanel then wires it to the shared concept with a pointer b-tag,
 * which makes the twin a row of the list, so the list reloads.
 */
function AddToDictionary({ concept, onAdded, onClose }) {
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
          <DispositionPanel
            key={twin} handle={twin} name={twinName} initialTarget={concept.uuid} onActed={onAdded} onClose={onClose}
          />
        </div>
      )}
      <p className="dict-add-foot text-muted">
        No matching concept of your own? <Link to={NEW_CONCEPT_PATH}>Create New Concept</Link>, then come back to wire it.
      </p>
    </div>
  );
}
