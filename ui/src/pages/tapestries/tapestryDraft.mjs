/**
 * Pure, React-free builders for tapestry-element drafts: create (ADR tapestries/0003),
 * add-a-concept (ADR tapestries/0005), and take-a-concept-out (ADR tapestries/0006).
 * No React/DOM imports so every builder is unit-testable in the stack-free Node runner
 * via dynamic import().
 */

/** kebab-case slug: lowercase, runs of non-alphanumerics → a single dash, trimmed. */
export function slugifyTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build an unsigned kind-39999 tapestry element from a title + description + members.
 *
 * @param {object} args
 * @param {string} args.title                 required; a whitespace-only title throws.
 * @param {string} [args.description='']
 * @param {Array<{handle,shortSlug,conceptGraphSlug,descriptiveSlug,name}>} args.members  ≥1 required; empty throws.
 *        handle          = the concept-header coordinate `39998:<TA>:<shortSlug>` (short slug = its d-tag).
 *        conceptGraphSlug= the header's `oSlugs.singular` — the name its derived `*-concept-graph` uses
 *                          (diverges from the d-tag for some concepts, e.g. nostr-event-tag).
 *        descriptiveSlug = the concept-header `word.slug` — used as the node slug so it dedups
 *                          with the resolved `*-concept-graph` import at read time (ADR Decision 2-A).
 * @param {string} args.taPubkey              runtime-resolved TA pubkey (never hardcode).
 * @param {string} [args.authorPubkey=taPubkey] who SIGNS the element — the owner's key for own-key
 *        publishing, the TA for assistant publishing. Namespaces the tapestry's own coordinate (uuid).
 * @param {string} args.dTagSuffix            short unique suffix for the parameterized-replaceable d-tag.
 * @returns {{dTag, uuid, word, tapestry, graph, unsignedEvent}}
 */
export function buildTapestryDraft({ title, description = '', members, taPubkey, authorPubkey = taPubkey, dTagSuffix }) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) throw new Error('A tapestry needs a title.');
  if (!Array.isArray(members) || members.length === 0) {
    throw new Error('A tapestry needs at least one member concept.');
  }
  if (!taPubkey) throw new Error('A tapestry needs the instance TA pubkey.');

  const slug = slugifyTitle(cleanTitle);
  const dTag = `tapestry-${slug}-${dTagSuffix || ''}`;
  // The tapestry's own coordinate is namespaced to whoever SIGNS it (owner key for own-key
  // publishing, the TA for assistant publishing) — the directory + Exploration page resolve it by
  // author. The z-tag below stays TA-namespaced (it is the concept handle, always TA).
  const uuid = `39999:${authorPubkey}:${dTag}`;

  const tapestry = { slug, title: cleanTitle, description: String(description || '') };

  // Authored word section (story tapestries #7 / ADR 0007): the letter carries
  // word alongside tapestry + graph. Values mirror the generic word deriver's
  // own defaults (word.slug = the element slug, word.name = the display name,
  // wordTypes ["word"]) so derive never fights authoring. Create-only: the
  // add/remove republish builders pass unknown top-level sections through
  // verbatim and never retrofit legacy word-less letters.
  const word = { slug, name: cleanTitle, wordTypes: ['word'] };

  const graph = {
    graphType: 'tapestry',
    // Node slug = the concept-header's descriptive word.slug (NOT the short slug): this is the
    // slug its derived *-concept-graph uses for the same header node, so composeGraph dedups
    // them and each member renders exactly once on the Exploration page (ADR Decision 2-A).
    nodes: members.map((m) => ({ slug: m.descriptiveSlug, uuid: m.handle, name: m.name })),
    // Members-only v1: no cross-concept integrations are authored — those surface via import
    // resolution, and explicit authoring is a fast-follow.
    relationshipTypes: [],
    relationships: [],
    imports: members.map((m) => {
      // Concept-graphs are named from the header's oSlugs.singular, which diverges from the
      // header d-tag for some concepts (e.g. nostr-event-tag → nostr-event-tagging-concept-graph).
      const cg = m.conceptGraphSlug || m.shortSlug;
      return { slug: `concept-graph-for-${cg}`, uuid: `39999:${taPubkey}:${cg}-concept-graph` };
    }),
  };

  const unsignedEvent = {
    kind: 39999,
    created_at: Math.floor(Date.now() / 1000),
    content: '',
    tags: [
      ['d', dTag],
      ['name', cleanTitle],
      // The z-tag to the tapestry concept handle is what the directory reads (queryRelay #z).
      ['z', `39998:${taPubkey}:tapestry`],
      ['json', JSON.stringify({ word, tapestry, graph })],
    ],
  };

  return { dTag, uuid, word, tapestry, graph, unsignedEvent };
}

/**
 * Build the add-only replacement for an EXISTING tapestry element (ADR tapestries/0005
 * Decision 1-A): copy the event verbatim — same d-tag (same coordinate → relay-native
 * replacement), every non-json tag byte-identical and in order, content unchanged — and
 * append exactly ONE member node + concept-graph import inside the json tag. A graph-less
 * event (the live b0b48b00 shape) gains the minimal envelope on first add. Refuses — throws,
 * with messages the UI shows verbatim — anything it cannot preserve.
 *
 * @param {object} args
 * @param {object} args.event    the tapestry element as read from the relay (kind 39999).
 * @param {{handle,shortSlug,conceptGraphSlug,descriptiveSlug,name}} args.member
 *        the same member object shape buildTapestryDraft consumes (shared; see ADR 0005
 *        Consequences — a change to it touches both builders).
 * @param {string} args.taPubkey runtime-resolved TA pubkey (never hardcode) — namespaces the
 *        new import; the tapestry's own coordinate follows the EVENT's author, not the TA.
 * @returns {{dTag, uuid, unsignedEvent}} unsignedEvent carries no pubkey/sig — the own-key
 *        branch attaches the author before NIP-07 signing; the TA branch lets the server re-sign.
 */
export function buildAddConceptDraft({ event, member, taPubkey }) {
  if (!event || event.kind !== 39999) {
    throw new Error('Only a kind-39999 tapestry element can have a concept added.');
  }
  const tags = Array.isArray(event.tags) ? event.tags : [];
  const dEntry = tags.find((t) => t[0] === 'd');
  const dTag = dEntry && dEntry[1];
  if (!dTag) {
    throw new Error('This tapestry has no d tag — there is no coordinate to republish to.');
  }
  if (!taPubkey) throw new Error('Adding a concept needs the instance TA pubkey.');
  const cg = member && (member.conceptGraphSlug || member.shortSlug);
  if (!member || !member.handle || !member.descriptiveSlug || !member.name || !cg) {
    throw new Error('Adding a concept needs a member with a handle, descriptive slug, name, and concept-graph slug.');
  }

  // Parse the existing json tag; a missing tag is treated as {}. Refuse what cannot be
  // preserved — silently replacing an unreadable payload would destroy it.
  const jsonIdx = tags.findIndex((t) => t[0] === 'json');
  let json = {};
  if (jsonIdx >= 0) {
    try {
      json = JSON.parse(tags[jsonIdx][1]);
    } catch {
      throw new Error('This tapestry’s json tag is not valid JSON — refusing to republish over a payload that cannot be preserved.');
    }
    if (json === null || typeof json !== 'object' || Array.isArray(json)) {
      throw new Error('This tapestry’s json tag does not hold an object — refusing to republish over a payload that cannot be preserved.');
    }
  }

  // Missing graph block (undefined or null) → create the minimal envelope on first add.
  // A graph block that EXISTS but is not appendable is refused, never rebuilt.
  const existing = json.graph;
  if (existing != null) {
    if (typeof existing !== 'object' || !Array.isArray(existing.nodes)) {
      throw new Error('This tapestry’s graph block has no nodes array — an add-only republish cannot preserve a structure it does not understand.');
    }
    if (existing.imports !== undefined && !Array.isArray(existing.imports)) {
      throw new Error('This tapestry’s graph imports are not an array — an add-only republish cannot preserve a structure it does not understand.');
    }
    for (const n of existing.nodes) {
      if (n && n.uuid === member.handle) {
        throw new Error(`“${member.name}” is already a member of this tapestry.`);
      }
      if (n && n.slug === member.descriptiveSlug && n.uuid !== member.handle) {
        throw new Error(`Another node in this tapestry already uses the slug “${member.descriptiveSlug}” — adding “${member.name}” would merge them at read time.`);
      }
    }
  }

  const newNode = { slug: member.descriptiveSlug, uuid: member.handle, name: member.name };
  const newImport = { slug: `concept-graph-for-${cg}`, uuid: `39999:${taPubkey}:${cg}-concept-graph` };

  if (existing == null) {
    json.graph = { graphType: 'tapestry', nodes: [newNode], relationshipTypes: [], relationships: [], imports: [newImport] };
  } else {
    // `existing` is freshly parsed above — mutating it never touches the input event.
    existing.nodes = [...existing.nodes, newNode];
    const imports = Array.isArray(existing.imports) ? existing.imports : [];
    existing.imports = imports.some((i) => i && i.uuid === newImport.uuid) ? imports : [...imports, newImport];
    json.graph = existing;
  }

  // Copy every tag in order; only the (first) json tag's VALUE changes. Append one if none existed.
  const jsonValue = JSON.stringify(json);
  const newTags = jsonIdx >= 0
    ? tags.map((t, i) => (i === jsonIdx ? ['json', jsonValue] : t))
    : [...tags, ['json', jsonValue]];

  const unsignedEvent = {
    kind: 39999,
    // Strictly newer than the base so replacement can never tie — NIP-01 resolves equal
    // timestamps by id, which could keep the OLD event on a same-second create-then-add.
    created_at: Math.max(Math.floor(Date.now() / 1000), (event.created_at || 0) + 1),
    content: event.content,
    tags: newTags,
  };

  return { dTag, uuid: `39999:${event.pubkey}:${dTag}`, unsignedEvent };
}

/** The pubkey / d-tag segments of a "kind:pubkey:slug" handle — split on the first two
 * colons only, since d-tags may themselves contain colons (the same split rule as
 * useTapestryGraph's parseUuid). Internal to the attribution matcher below. */
function pubkeyOf(uuid) {
  const s = String(uuid || '');
  const i1 = s.indexOf(':');
  const i2 = s.indexOf(':', i1 + 1);
  return i1 < 0 || i2 < 0 ? '' : s.slice(i1 + 1, i2);
}
function dTagOf(uuid) {
  const s = String(uuid || '');
  const i1 = s.indexOf(':');
  const i2 = s.indexOf(':', i1 + 1);
  return i1 < 0 || i2 < 0 ? '' : s.slice(i2 + 1);
}

/**
 * The ONE definition of authored membership (ADR tapestries/0006 Decisions 1-A + 3-A):
 * a tapestry's member concepts are the nodes with a `39998:` uuid in the element's OWN
 * `json.graph.nodes` — never the composed graph, which fluctuates with import resolution.
 * Shared by the subtract transform (membership + last-member checks), the page (per-row
 * eligibility + count), and tests, so the membership definition cannot drift.
 *
 * @param {object|null} event a kind-39999 tapestry element (or null before load).
 * @returns {Array<{slug, uuid, name}>} in node order; [] on missing/unparseable json,
 *          missing/null graph, or nodes-not-an-array. Never throws — the page uses it
 *          for eligibility before any save exists.
 */
export function authoredConceptMembers(event) {
  try {
    const raw = (event?.tags || []).find((t) => t && t[0] === 'json')?.[1];
    if (!raw) return [];
    const nodes = JSON.parse(raw)?.graph?.nodes;
    if (!Array.isArray(nodes)) return [];
    return nodes
      .filter((n) => n && typeof n.uuid === 'string' && n.uuid.startsWith('39998:'))
      .map((n) => ({ slug: n.slug, uuid: n.uuid, name: n.name }));
  } catch {
    return [];
  }
}

/**
 * Build the remove-only replacement for an EXISTING tapestry element (ADR tapestries/0006
 * Decisions 1-A + 2-A + 3-A): copy the event verbatim — same d-tag (same coordinate →
 * relay-native replacement), every non-json tag byte-identical and in order, content
 * unchanged, every json key and remaining node/import untouched and in order — and
 * subtract exactly ONE authored member node plus the import(s) the element carried
 * solely on its behalf. Refuses — throws, with messages the UI shows verbatim —
 * anything it cannot remove cleanly.
 *
 * @param {object} args
 * @param {object} args.event      the tapestry element as read from the relay (kind 39999).
 * @param {string} args.memberUuid the authored member's concept-header uuid (`39998:…`).
 * @param {Array}  [args.resolvedImports=[]] the page's already-resolved imports
 *        (useTapestryGraph.imports: [{slug, uuid, graph}]) — matcher (a)'s evidence.
 * @param {Array}  [args.conceptOptions=[]] the concept-picker options
 *        (useConceptOptions.concepts) — matcher (b)'s evidence.
 * @returns {{dTag, uuid, unsignedEvent, removed: {node, importUuids}}} unsignedEvent
 *        carries no pubkey/sig — the own-key branch attaches the author before NIP-07
 *        signing; the TA branch lets the server re-sign. `removed` feeds the confirm
 *        copy and the page's selected-reset.
 */
export function buildRemoveConceptDraft({ event, memberUuid, resolvedImports = [], conceptOptions = [] }) {
  if (!event || event.kind !== 39999) {
    throw new Error('Only a kind-39999 tapestry element can have a concept taken out.');
  }
  const tags = Array.isArray(event.tags) ? event.tags : [];
  const dEntry = tags.find((t) => t[0] === 'd');
  const dTag = dEntry && dEntry[1];
  if (!dTag) {
    throw new Error('This tapestry has no d tag — there is no coordinate to republish to.');
  }

  // Parse the json tag; refuse what cannot be preserved (the mirror of the add
  // transform's guards, extended per story #5's ratified Deviations). Unlike add there
  // is no first-add path here: a missing/absent/null graph has no members to take out
  // (the story's Out of scope — degraded tapestries), so it is refused, never invented.
  const jsonIdx = tags.findIndex((t) => t[0] === 'json');
  if (jsonIdx < 0) {
    throw new Error('This tapestry has no json tag — there are no member concepts to take out.');
  }
  let json;
  try {
    json = JSON.parse(tags[jsonIdx][1]);
  } catch {
    throw new Error('This tapestry’s json tag is not valid JSON — refusing to republish over a payload that cannot be preserved.');
  }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('This tapestry’s json tag does not hold an object — refusing to republish over a payload that cannot be preserved.');
  }
  const graph = json.graph;
  if (graph == null || typeof graph !== 'object' || Array.isArray(graph)) {
    throw new Error('This tapestry has no graph block — there are no member concepts to take out.');
  }
  if (!Array.isArray(graph.nodes)) {
    throw new Error('This tapestry’s graph block has no nodes array — a remove-only republish cannot preserve a structure it does not understand.');
  }
  if (graph.imports !== undefined && !Array.isArray(graph.imports)) {
    throw new Error('This tapestry’s graph imports are not an array — a remove-only republish cannot preserve a structure it does not understand.');
  }

  // Membership is judged from the authored graph block only (Decision 3-A), via the same
  // helper the page uses for eligibility — page and transform can never disagree. A uuid
  // that is not an authored `39998:` member (a "ghost" visible only through a resolved
  // import, a superset node, an unknown handle) is refused: what a ghost needs removed is
  // an import with no node — integration-shaped work, not membership removal.
  const members = authoredConceptMembers(event);
  if (!members.some((m) => m.uuid === memberUuid)) {
    throw new Error('That concept is not an authored member of this tapestry, so it cannot be taken out here.');
  }
  if (members.length === 1) {
    // The boundary's floor — transform-level backstop behind the page's up-front refusal.
    throw new Error('A tapestry keeps at least one concept — the last one can’t be taken out.');
  }
  const removedNode = graph.nodes.find((n) => n && n.uuid === memberUuid);
  if (graph.nodes.some((n) => n && n !== removedNode && typeof n.uuid === 'string' &&
      n.uuid.startsWith('39998:') && n.slug === removedNode.slug)) {
    throw new Error(`Another concept in this tapestry also uses the slug “${removedNode.slug}” — composeGraph merges nodes by slug, so this removal could not be shown distinctly. Refusing.`);
  }

  // Which import(s) leave with the member — union of evidence (Decision 2-A). An import
  // is carried for a member iff:
  //  (a) read-time containment: the page's RESOLVED import with that uuid contains a node
  //      under the member's slug — literally the mechanism by which a surviving import
  //      would re-materialize the removed member at compose time (dedup by slug);
  //  (b) options derivation: the concept-picker option for the member derives exactly
  //      that import uuid (the same derivation add/create used to write it) — decisive
  //      when the node uuid's d-tag diverges from the concept-graph name (the live dog
  //      member) or the import fails to resolve;
  //  (c) short-slug derivation: the common `39999:<pubkey>:<d-tag>-concept-graph` shape,
  //      needing zero external evidence.
  // All pubkeys come from the handles themselves — no taPubkey parameter, nothing hardcoded.
  const resolved = Array.isArray(resolvedImports) ? resolvedImports : [];
  const options = Array.isArray(conceptOptions) ? conceptOptions : [];
  const carriedFor = (imp, m) => {
    if (!imp || typeof imp.uuid !== 'string') return false;
    for (const r of resolved) {
      if (r && r.uuid === imp.uuid && Array.isArray(r.graph?.nodes) &&
          r.graph.nodes.some((n) => n && n.slug === m.slug)) return true;
    }
    for (const o of options) {
      if (o && o.handle === m.uuid && o.conceptGraphSlug &&
          imp.uuid === `39999:${pubkeyOf(o.handle)}:${o.conceptGraphSlug}-concept-graph`) return true;
    }
    return imp.uuid === `39999:${pubkeyOf(m.uuid)}:${dTagOf(m.uuid)}-concept-graph`;
  };

  // `graph` is freshly parsed above — mutating it never touches the input event.
  graph.nodes = graph.nodes.filter((n) => n !== removedNode);
  const remaining = members.filter((m) => m.uuid !== memberUuid);
  const removedImportUuids = [];
  if (Array.isArray(graph.imports)) {
    graph.imports = graph.imports.filter((imp) => {
      // Removed iff carried for the removed member AND claimed by no remaining member
      // (the "solely on its behalf" guard — a shared import stays while any claimant
      // remains). An import attributable to NO member under any matcher is "everything
      // else in it stays as it was" and passes through — removing what cannot be
      // attributed would be an edit beyond removing.
      if (!carriedFor(imp, removedNode)) return true;
      if (remaining.some((m) => carriedFor(imp, m))) return true;
      removedImportUuids.push(imp.uuid);
      return false;
    });
  }

  // Copy every tag in order; only the json tag's VALUE changes.
  const jsonValue = JSON.stringify(json);
  const newTags = tags.map((t, i) => (i === jsonIdx ? ['json', jsonValue] : t));

  const unsignedEvent = {
    kind: 39999,
    // Strictly newer than the base so replacement can never tie — NIP-01 resolves equal
    // timestamps by id, which could keep the OLD event and silently lose the removal.
    created_at: Math.max(Math.floor(Date.now() / 1000), (event.created_at || 0) + 1),
    content: event.content,
    tags: newTags,
  };

  return {
    dTag,
    uuid: `39999:${event.pubkey}:${dTag}`,
    unsignedEvent,
    removed: { node: removedNode, importUuids: removedImportUuids },
  };
}
