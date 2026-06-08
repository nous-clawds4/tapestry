/**
 * List (DList) drop-in: build a Claude prompt and parse the TOML it returns into
 * the shape NewDList publishes. Mirrors ui/src/lib/bountyToml.js; reuses its
 * deep-link builder and code-fence stripper so both panels behave identically.
 */

import { parse as parseToml } from 'smol-toml';
import { buildClaudeDeepLink, stripCodeFence } from './bountyToml.js';

export { buildClaudeDeepLink };

const REQUIREMENTS = ['required', 'optional', 'recommended'];

const FIELD_ALIASES = {
  singular: ['singular', 'name', 'item', 'item_name'],
  plural: ['plural', 'plural_name'],
  description: ['description', 'desc', 'about'],
  replaceable: ['replaceable', 'editable'],
  propertyTags: ['property_tags', 'propertyTags', 'tags', 'item_tags'],
};

function pick(table, field) {
  for (const key of FIELD_ALIASES[field]) {
    if (table[key] !== undefined && table[key] !== null && table[key] !== '') return table[key];
  }
  return undefined;
}

function asBoolean(value) {
  if (value === true || value === false) return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return undefined;
}

/** Validate + normalize one raw TOML table into NewDList's form shape. */
function normalizeOne(table) {
  const singular = pick(table, 'singular');
  if (typeof singular !== 'string' || !singular.trim()) {
    return { error: 'singular (the item name) is required' };
  }

  const pluralRaw = pick(table, 'plural');
  const plural = typeof pluralRaw === 'string' ? pluralRaw.trim() : '';

  const descRaw = pick(table, 'description');
  const description = typeof descRaw === 'string' ? descRaw.trim() : '';

  const replRaw = pick(table, 'replaceable');
  const replaceable = replRaw === undefined ? true : asBoolean(replRaw);
  if (replaceable === undefined) {
    return { error: 'replaceable must be true or false' };
  }

  const tagsRaw = pick(table, 'propertyTags');
  const propertyTags = [];
  if (tagsRaw !== undefined) {
    if (!Array.isArray(tagsRaw)) {
      return { error: 'property_tags must be an array of { requirement, name }' };
    }
    for (const t of tagsRaw) {
      if (!t || typeof t !== 'object' || Array.isArray(t)) {
        return { error: 'each property tag must be a table like { requirement = "required", name = "name" }' };
      }
      const name = t.name ?? t.value ?? t.tag;
      if (typeof name !== 'string' || !name.trim()) {
        return { error: 'each property tag needs a name' };
      }
      let req = String(t.requirement ?? t.req ?? 'required').toLowerCase();
      if (!REQUIREMENTS.includes(req)) {
        return { error: `requirement must be one of ${REQUIREMENTS.join(', ')}` };
      }
      propertyTags.push({ requirement: req, value: name.trim() });
    }
  }

  return {
    list: { singular: singular.trim(), plural, description, replaceable, propertyTags },
  };
}

/**
 * Parse pasted text into normalized list objects.
 * @param {string} text raw paste (may include a ```toml fence and surrounding prose)
 * @returns {{ lists: object[], errors: string[] }}
 */
export function parseListToml(text) {
  const src = stripCodeFence(text || '');
  if (!src) return { lists: [], errors: ['Nothing to parse — paste the TOML Claude gave you.'] };

  let data;
  try {
    data = parseToml(src);
  } catch (err) {
    return { lists: [], errors: [`TOML syntax error: ${err.message}`] };
  }

  // Accept [[list]] array, a single [list] table, or a bare top-level table.
  let tables;
  if (Array.isArray(data.list)) {
    tables = data.list;
  } else if (data.list && typeof data.list === 'object') {
    tables = [data.list];
  } else {
    tables = [data];
  }

  if (tables.length === 0) {
    return { lists: [], errors: ['No [[list]] tables found.'] };
  }

  const lists = [];
  const errors = [];
  const label = tables.length > 1 ? (i) => `List ${i + 1}: ` : () => '';
  tables.forEach((table, i) => {
    const result = normalizeOne(table || {});
    if (result.error) errors.push(`${label(i)}${result.error}`);
    else lists.push(result.list);
  });

  return { lists, errors };
}

/**
 * Build the prompt Claude opens with: the list TOML spec, then an instruction to
 * emit one ```toml block. When `request` is given it is embedded so Claude drafts
 * straight away (the form is the review step).
 * @param {string} [request] your plain-English description of the list(s) you want
 */
export function buildListPrompt(request = '') {
  const trimmedRequest = (request || '').trim();
  const requestLines = trimmedRequest
    ? [
        '',
        'Here is what I want:',
        trimmedRequest,
        '',
        'Draft the TOML now — do NOT ask me questions. I review and adjust every value in a',
        'form before anything is published, so make reasonable choices and hand me a complete',
        'block. Pick clear singular/plural names and a one-line description from my request, and',
        'suggest a few sensible item property tags. Keep any prose to a sentence — the TOML is',
        'what matters.',
      ]
    : [
        '',
        'Ask me what list I want (its name and what items it collects), then give me the TOML.',
      ];

  return [
    'You are helping me create Nostr "lists" (DLists) on Tapestry. A list is a named',
    'collection of items; people I trust submit items to it, and I can attach a sats bounty',
    'to the list later.',
    ...requestLines,
    '',
    'Output exactly ONE ```toml code block I can paste back. Schema — one [[list]] table per list:',
    '',
    '```toml',
    '[[list]]',
    'singular     = "Kettlebell routine"    # required; the item name, singular',
    'plural       = "Kettlebell routines"   # optional; defaults to the singular',
    'description  = "What this list collects."  # optional, one line',
    'replaceable  = true                    # optional; true = editable (39998), false = permanent (9998)',
    'property_tags = [                      # optional; the tags each submitted item should carry',
    '  { requirement = "required", name = "name" },',
    '  { requirement = "optional", name = "description" },',
    ']',
    '```',
    '',
    'Rules: requirement is one of required|optional|recommended; keep tag names short and',
    'machine-friendly (e.g. name, url, npub); omit fields you do not need.',
  ].join('\n');
}
