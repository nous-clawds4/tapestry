/**
 * Editing a Dictionary concept's header (the owner's request of 2026-10-02): the person's own
 * Assistant publishes a new version of its kind-39998 header with new names, description and Item
 * Property Tags, the New DList page's fields. Everything else the header carries stays as it is.
 *
 * What an edit can change:
 *   - `names`: the singular and plural (any further values in the tag are kept);
 *   - `description`: replaced, or removed when left blank;
 *   - the Item Property Tags, `["required" | "optional" | "recommended", value, …]`: the new list
 *     replaces the old one, where the old one stood.
 *   - the header's `json` copy of its names and description (a header made by the control panel's
 *     create-concept carries `["json", {word, conceptHeader: {description, oNames, …}}]`, and the
 *     Tapestries pickers and the concept graph summary read it): `conceptHeader.oNames` and
 *     `conceptHeader.description` follow the edit. Everything else in it is kept: `oSlugs`, `oKeys` and
 *     `oLabels` are identities (the derived graph's slug, schema keys, Neo4j labels), and `oTitles` and
 *     `word` were derived from the name the concept was created with.
 * What it can't: the d-tag (the concept's address, so its items and anything wired to it keep pointing
 * at it), the b-tags (shared or wired), the content, and every other tag, all kept in their order.
 *
 * The server finds some concepts by their singular name (`MATCH … h.name = $concept`): the names in
 * NAME_KEYED_CONCEPTS. Renaming one would break what looks it up, so their singular name can't be
 * edited; the rest of them can.
 *
 * Pure CJS, zero requires (the broadcastOutcome / trustedDictionary idiom): the server's edit endpoint
 * (src/api/adoption/editConcept.js) composes with it, and the browser imports the same code through
 * the `@tapestry/concept-header-edit` alias (ui/vite.config.js), so the edit page's preview is exactly
 * what is signed.
 */

'use strict';

const PROPERTY_REQUIREMENTS = ['required', 'optional', 'recommended'];
const MAX_PROPERTIES = 200;
// Concepts the server looks up by their singular name, so a rename would break their features: the
// `*_CONCEPT_NAME` constants in src/api/normalize/index.js and src/api/adoption, the literal
// `concept:` names the UI passes to the normalize API, and the audit's core concepts
// (test/dictionary-edit-concept.test.js keeps this list in step with the code).
const NAME_KEYED_CONCEPTS = [
  'adoption disposition', 'concept header', 'goal set', 'property', 'relationship', 'set', 'shared concept', 'superset',
  'tapestry external resource', 'tapestry owner goal', 'tapestry priority signal', 'tapestry proposal',
  'tapestry restore drill', 'tapestry work record', 'trusted dictionary snapshot',
];
const CONTROL_RE = /\p{Cc}/u;
// Bidirectional overrides and isolates can make a name read differently from what it is.
const BIDI_RE = /[\u202A-\u202E\u2066-\u2069]/u;
// A description is typed in a text area, so it may keep its line breaks and tabs.
const DESCRIPTION_CONTROL_RE = /(?![\n\r\t])\p{Cc}/u;

const isTag = (t) => Array.isArray(t) && t.length > 0 && typeof t[0] === 'string';
const isProperty = (t) => isTag(t) && PROPERTY_REQUIREMENTS.includes(t[0]);
const text = (v) => (typeof v === 'string' ? v.trim() : '');

/** The form's starting values, from a header: { singular, plural, description, properties }. */
function headerFields(event) {
  const tags = (event && Array.isArray(event.tags) ? event.tags : []).filter(isTag);
  const names = tags.find((t) => t[0] === 'names');
  const description = tags.find((t) => t[0] === 'description');
  return {
    singular: text(names && names[1]),
    plural: text(names && names[2]),
    description: text(description && description[1]),
    properties: tags.filter(isProperty).map((t) => t.map((v) => (typeof v === 'string' ? v : String(v)))),
  };
}

/**
 * The fields, trimmed and checked: { fields } or { error }. `properties` is a list of whole tags,
 * so a property tag that carries more than a requirement and a value keeps the rest.
 */
function checkEditFields(input) {
  const b = input && typeof input === 'object' ? input : {};
  const str = (v) => (typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : null);
  const singular = str(b.singular);
  const plural = str(b.plural);
  const description = str(b.description);
  if (singular === null || plural === null || description === null) return { error: 'The names and the description must be text' };
  if (!singular || !plural) return { error: 'Both the singular and the plural name are needed' };
  if (CONTROL_RE.test(singular) || CONTROL_RE.test(plural)) return { error: "A name can't contain control characters" };
  if (BIDI_RE.test(singular) || BIDI_RE.test(plural)) return { error: "A name can't contain text-direction controls" };
  if (DESCRIPTION_CONTROL_RE.test(description)) return { error: "The description can't contain control characters" };
  const raw = b.properties === undefined || b.properties === null ? [] : b.properties;
  if (!Array.isArray(raw)) return { error: 'The Item Property Tags must be a list' };
  if (raw.length > MAX_PROPERTIES) return { error: `At most ${MAX_PROPERTIES} Item Property Tags` };
  const properties = [];
  for (const t of raw) {
    if (!Array.isArray(t) || t.length < 2 || !t.every((v) => typeof v === 'string')) {
      return { error: 'Each Item Property Tag is a requirement and a value' };
    }
    if (!PROPERTY_REQUIREMENTS.includes(t[0])) return { error: `An Item Property Tag is required, optional or recommended, not "${t[0]}"` };
    const value = t[1].trim();
    if (!value) return { error: 'An Item Property Tag needs a value' };
    if (t.some((v) => CONTROL_RE.test(v))) return { error: "An Item Property Tag can't contain control characters" };
    properties.push([t[0], value, ...t.slice(2)]);
  }
  return { fields: { singular, plural, description, properties } };
}

/** Is this header's singular name one the server looks it up by? (Exactly: the lookups are exact.) */
function nameKeyed(singular) {
  return NAME_KEYED_CONCEPTS.includes(typeof singular === 'string' ? singular.trim() : '');
}

/**
 * The `json` tag with its conceptHeader following what the edit changed, measured against the header's
 * own tags (`was`, headerFields of the base), never against the json: a json can hold values the tags
 * don't (a concept created without a description has a default one there), and an edit that doesn't
 * touch the names or the description must leave it exactly as it is. The tag is returned as it was when
 * it isn't an object with a conceptHeader, or when the edit changes neither.
 */
function editedJson(tag, fields, was) {
  const namesChanged = fields.singular !== was.singular || fields.plural !== was.plural;
  const descChanged = fields.description !== was.description;
  if (!namesChanged && !descChanged) return [...tag];
  let obj;
  try { obj = JSON.parse(tag[1]); } catch { return [...tag]; }
  const ch = obj && typeof obj === 'object' && obj.conceptHeader && typeof obj.conceptHeader === 'object' ? obj.conceptHeader : null;
  if (!ch) return [...tag];
  if (namesChanged) {
    const names = ch.oNames && typeof ch.oNames === 'object' ? ch.oNames : {};
    ch.oNames = { ...names, singular: fields.singular, plural: fields.plural };
  }
  if (descChanged) {
    if (fields.description) ch.description = fields.description;
    else delete ch.description;
  }
  return [tag[0], JSON.stringify(obj), ...tag.slice(2)];
}

/**
 * The new version of `base` with `fields` (already checked): { kind, created_at, content, tags }.
 * Each edited tag takes the place of the first one it replaces; one that wasn't there goes after the
 * tags it follows on the New DList page (d, names, description), so the order stays familiar.
 * `created_at` is never earlier than one second after the base's, so the new version replaces it.
 */
function composeEdit(base, fields, now) {
  const baseTags = (base && Array.isArray(base.tags) ? base.tags : []).filter(isTag);
  const was = headerFields(base);
  const namesTag = (old) => ['names', fields.singular, fields.plural, ...(old ? old.slice(3) : [])];
  const descTag = (old) => (fields.description ? [['description', fields.description, ...(old ? old.slice(2) : [])]] : []);
  const propTags = (fields.properties || []).map((t) => [...t]);
  const out = [];
  let names = false;
  let desc = false;
  let props = false;
  for (const t of baseTags) {
    if (t[0] === 'names') { if (!names) { out.push(namesTag(t)); names = true; } continue; }
    if (t[0] === 'description') { if (!desc) { out.push(...descTag(t)); desc = true; } continue; }
    if (isProperty(t)) { if (!props) { out.push(...propTags); props = true; } continue; }
    if (t[0] === 'json' && typeof t[1] === 'string') { out.push(editedJson(t, fields, was)); continue; }
    out.push([...t]);
  }
  const after = (pred) => {
    let at = -1;
    out.forEach((t, i) => { if (pred(t)) at = i; });
    return at + 1;
  };
  if (!names) out.splice(after((t) => t[0] === 'd'), 0, namesTag(null));
  if (!desc && fields.description) out.splice(after((t) => t[0] === 'd' || t[0] === 'names'), 0, ...descTag(null));
  if (!props && propTags.length) out.splice(after((t) => t[0] === 'd' || t[0] === 'names' || t[0] === 'description'), 0, ...propTags);
  const baseAt = base && Number.isInteger(base.created_at) ? base.created_at : 0;
  return {
    kind: base && Number.isInteger(base.kind) ? base.kind : 39998,
    created_at: Math.max(now, baseAt + 1),
    content: base && typeof base.content === 'string' ? base.content : '',
    tags: out,
  };
}

/** Does the edit change anything? (The same tags in the same order is no change.) */
function changesTags(base, composed) {
  return JSON.stringify((base && base.tags) || []) !== JSON.stringify(composed.tags);
}

module.exports = {
  PROPERTY_REQUIREMENTS, MAX_PROPERTIES, NAME_KEYED_CONCEPTS, nameKeyed, headerFields, checkEditFields, composeEdit, changesTags,
};
