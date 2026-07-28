/**
 * Pure, React-free builder for a "Create a Tapestry" draft (members-only v1).
 * See ADR tapestries/0003. No React/DOM imports so it is unit-testable in the
 * stack-free Node runner via dynamic import().
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
 * @returns {{dTag, uuid, tapestry, graph, unsignedEvent}}
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
      ['json', JSON.stringify({ tapestry, graph })],
    ],
  };

  return { dTag, uuid, tapestry, graph, unsignedEvent };
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
