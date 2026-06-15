/**
 * List-item drop-in: build a Claude prompt + deep link from a list's field
 * schema, and parse the TOML Claude hands back into the state the New List Item
 * form already uses (name, replaceable, per-property values, custom tags).
 *
 * Mirrors src/lib/bountyToml.js, but a list item's fields are dynamic — they
 * come from the parent list header's required/recommended/optional property
 * tags — so both the prompt and the parser are parameterized by this list's
 * `propertyDefs` (the same array NewDListItem derives from parentEvent).
 */

import { parse as parseToml } from 'smol-toml';

const CLAUDE_NEW_URL = 'https://claude.ai/new';

// Keys handled specially; everything else is matched against the list's props
// (case-insensitively) and otherwise treated as an extra/custom tag.
const RESERVED_KEYS = new Set(['name', 'replaceable']);

function asBoolean(value) {
  if (value === true || value === false) return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return undefined;
}

/** TOML scalars (string/number/bool/Date) -> the string the form inputs hold. */
function asString(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Validate + normalize one raw TOML table into a form descriptor.
 * Returns { item } or { error } (a single human-readable string).
 * @param {{name:string,requirement:string}[]} propertyDefs this list's fields
 */
function normalizeOne(table, propertyDefs) {
  const name = table.name;
  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'name is required' };
  }

  const rawReplaceable = table.replaceable;
  const replaceable = rawReplaceable === undefined ? true : asBoolean(rawReplaceable);
  if (replaceable === undefined) {
    return { error: 'replaceable must be true or false' };
  }

  // Case-insensitive lookup of a TOML key to the list's canonical prop name.
  const byLower = new Map(propertyDefs.map(d => [d.name.toLowerCase(), d.name]));

  const props = {};
  const customTags = [];
  for (const [key, value] of Object.entries(table)) {
    if (RESERVED_KEYS.has(key)) continue;
    const canonical = byLower.get(key.toLowerCase());
    if (canonical) {
      props[canonical] = asString(value);
    } else {
      const v = asString(value);
      if (v) customTags.push({ key, value: v });
    }
  }

  const missing = propertyDefs
    .filter(d => d.requirement === 'required' && d.name.toLowerCase() !== 'name')
    .filter(d => !props[d.name]?.trim())
    .map(d => d.name);
  if (missing.length) {
    return { error: `missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}` };
  }

  return { item: { name: name.trim(), replaceable, props, customTags } };
}

/** Pull TOML out of a ```toml fenced block if the paste includes Claude's prose. */
function stripCodeFence(text) {
  const fenced = text.match(/```(?:toml)?\s*\n([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

/**
 * Parse pasted text into normalized item descriptors for this list.
 * @param {string} text raw paste (may include a ```toml fence and prose)
 * @param {{name:string,requirement:string}[]} propertyDefs this list's fields
 * @returns {{ items: object[], errors: string[] }}
 */
export function parseItemToml(text, propertyDefs = []) {
  const src = stripCodeFence(text || '');
  if (!src) return { items: [], errors: ['Nothing to parse — paste the TOML Claude gave you.'] };

  let data;
  try {
    data = parseToml(src);
  } catch (err) {
    return { items: [], errors: [`TOML syntax error: ${err.message}`] };
  }

  // Accept [[item]] array, a single [item] table, or a bare top-level table.
  let tables;
  if (Array.isArray(data.item)) {
    tables = data.item;
  } else if (data.item && typeof data.item === 'object') {
    tables = [data.item];
  } else {
    tables = [data];
  }

  if (tables.length === 0) {
    return { items: [], errors: ['No [[item]] tables found.'] };
  }

  const items = [];
  const errors = [];
  const label = tables.length > 1 ? (i) => `Item ${i + 1}: ` : () => '';
  tables.forEach((table, i) => {
    const result = normalizeOne(table || {}, propertyDefs);
    if (result.error) errors.push(`${label(i)}${result.error}`);
    else items.push(result.item);
  });

  return { items, errors };
}

/**
 * Build the prompt Claude opens with: this list's field schema as a name ->
 * requirement -> key table, then an instruction to emit one ```toml block.
 * @param {string} listName the parent list's display name
 * @param {{name:string,requirement:string}[]} propertyDefs this list's fields
 * @param {string} [request] plain-English description of the item(s) you want
 */
export function buildItemClaudePrompt(listName = '(unnamed list)', propertyDefs = [], request = '') {
  // Drop any 'name' prop def — name is its own required line in the schema.
  const fields = propertyDefs.filter(d => d.name.toLowerCase() !== 'name');

  const fieldLines = fields.length
    ? fields.map(d => `  - ${d.name}  (${d.requirement})`).join('\n')
    : '  (this list defines no extra fields — just a name)';

  // A worked TOML example so Claude emits exactly the keys we can parse.
  const schemaLines = [
    '[[item]]',
    'name         = "An item name"            # required',
    'replaceable  = true                      # optional; true = editable (kind 39999), false = permanent (9999)',
    ...fields.map(d => {
      const pad = d.name.padEnd(12);
      return `${pad} = ""                        # ${d.requirement}`;
    }),
  ];

  const trimmedRequest = (request || '').trim();
  const requestLines = trimmedRequest
    ? [
        '',
        'Here is what I want:',
        trimmedRequest,
        '',
        'If that is enough, reply with the TOML now. If anything is ambiguous, ask me one',
        'or two quick questions first, then give me the TOML.',
      ]
    : [
        '',
        'Ask me what item(s) I want to add (and any details for the fields), then give me the TOML.',
      ];

  return [
    `You are helping me add item(s) to my Tapestry list "${listName}".`,
    'Each item has a name plus the fields below (required ones must be filled; fill recommended/optional',
    'when you have a sensible value, otherwise omit the line):',
    fieldLines,
    ...requestLines,
    '',
    'Output exactly ONE ```toml code block I can paste back. Use one [[item]] table per item:',
    '',
    '```toml',
    ...schemaLines,
    '```',
    '',
    'Rules: name is required; replaceable is true/false (default true); every value is a string;',
    'omit any field you do not have a value for; you may add extra key = "value" lines for tags not',
    'listed above and they will be attached as custom tags.',
  ].join('\n');
}

/** Build the claude.ai deep link that opens with `prompt` prefilled. */
export function buildClaudeDeepLink(prompt) {
  return `${CLAUDE_NEW_URL}?q=${encodeURIComponent(prompt)}`;
}
