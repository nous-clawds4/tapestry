/**
 * Tests for the list-item TOML drop-in helpers. Plain node + assert, matching
 * the repo's test style (see bountyToml.test.mjs).
 * Run: `node src/lib/listItemToml.test.mjs` (from ui/).
 */

import assert from 'node:assert';
import { parseItemToml, buildItemClaudePrompt, buildClaudeDeepLink } from './listItemToml.js';

// The kettlebell list's field schema, in the shape NewDListItem derives.
const DEFS = [
  { name: 'url', requirement: 'recommended' },
  { name: 'description', requirement: 'optional' },
  { name: 'duration_min', requirement: 'optional' },
  { name: 'difficulty', requirement: 'optional' },
  { name: 'focus', requirement: 'optional' },
  { name: 'kettlebells', requirement: 'optional' },
];

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

test('single [[item]] table fills name, replaceable, and props', () => {
  const src = [
    '[[item]]',
    'name = "Simple & Sinister"',
    'replaceable = true',
    'url = "https://example.com/ss"',
    'difficulty = "beginner"',
    'duration_min = "30"',
  ].join('\n');
  const { items, errors } = parseItemToml(src, DEFS);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].name, 'Simple & Sinister');
  assert.strictEqual(items[0].replaceable, true);
  assert.strictEqual(items[0].props.url, 'https://example.com/ss');
  assert.strictEqual(items[0].props.difficulty, 'beginner');
  assert.strictEqual(items[0].props.duration_min, '30');
});

test('replaceable defaults to true and accepts false', () => {
  const a = parseItemToml('name = "x"', DEFS);
  assert.strictEqual(a.items[0].replaceable, true);
  const b = parseItemToml('[[item]]\nname = "x"\nreplaceable = false', DEFS);
  assert.strictEqual(b.items[0].replaceable, false);
});

test('property keys match case-insensitively to canonical def name', () => {
  const { items, errors } = parseItemToml('[[item]]\nname = "x"\nURL = "https://u"\nDifficulty = "hard"', DEFS);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(items[0].props.url, 'https://u');
  assert.strictEqual(items[0].props.difficulty, 'hard');
});

test('numbers and bools coerce to strings for the form inputs', () => {
  const { items } = parseItemToml('[[item]]\nname = "x"\nduration_min = 45', DEFS);
  assert.strictEqual(items[0].props.duration_min, '45');
});

test('unrecognized keys become custom tags', () => {
  const { items } = parseItemToml('[[item]]\nname = "x"\nequipment = "pull-up bar"', DEFS);
  assert.deepStrictEqual(items[0].customTags, [{ key: 'equipment', value: 'pull-up bar' }]);
});

test('multiple [[item]] tables parse in order', () => {
  const src = '[[item]]\nname = "A"\nurl = "https://a"\n\n[[item]]\nname = "B"\nreplaceable = false';
  const { items, errors } = parseItemToml(src, DEFS);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].name, 'A');
  assert.strictEqual(items[1].name, 'B');
  assert.strictEqual(items[1].replaceable, false);
});

test('bare top-level table (no [[item]]) is accepted', () => {
  const { items, errors } = parseItemToml('name = "x"\nfocus = "strength"', DEFS);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(items[0].props.focus, 'strength');
});

test('strips a ```toml fence with surrounding prose', () => {
  const paste = 'Sure! Here you go:\n\n```toml\nname = "x"\nurl = "https://u"\n```\n\nLet me know!';
  const { items, errors } = parseItemToml(paste, DEFS);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(items[0].props.url, 'https://u');
});

test('requires name', () => {
  const { items, errors } = parseItemToml('[[item]]\nurl = "https://u"', DEFS);
  assert.strictEqual(items.length, 0);
  assert.match(errors[0], /name is required/);
});

test('reports a missing required field', () => {
  const reqDefs = [{ name: 'url', requirement: 'required' }];
  const { items, errors } = parseItemToml('[[item]]\nname = "x"', reqDefs);
  assert.strictEqual(items.length, 0);
  assert.match(errors[0], /missing required field: url/);
});

test('rejects a non-boolean replaceable', () => {
  const { errors } = parseItemToml('[[item]]\nname = "x"\nreplaceable = "maybe"', DEFS);
  assert.match(errors[0], /replaceable must be true or false/);
});

test('reports TOML syntax errors instead of throwing', () => {
  const { items, errors } = parseItemToml('this is = = not toml', DEFS);
  assert.strictEqual(items.length, 0);
  assert.match(errors[0], /TOML syntax error/);
});

test('labels errors per-item when several tables are present', () => {
  const { errors } = parseItemToml('[[item]]\nname = "ok"\n\n[[item]]\nurl = "https://u"', DEFS);
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /^Item 2:/);
});

test('prompt lists the field schema and round-trips through the deep link', () => {
  const prompt = buildItemClaudePrompt('Kettlebell routines', DEFS);
  assert.match(prompt, /Kettlebell routines/);
  assert.match(prompt, /url  \(recommended\)/);
  assert.match(prompt, /kettlebells  \(optional\)/);
  const link = buildClaudeDeepLink(prompt);
  assert.ok(link.startsWith('https://claude.ai/new?q='));
  assert.strictEqual(decodeURIComponent(link.split('?q=')[1]), prompt);
});

test('a request is embedded in the prompt when provided', () => {
  const req = 'add Simple & Sinister, a beginner conditioning routine, ~30 min, one 24kg bell';
  const withReq = buildItemClaudePrompt('Kettlebell routines', DEFS, req);
  assert.match(withReq, /Here is what I want:/);
  assert.ok(withReq.includes(req));
  const without = buildItemClaudePrompt('Kettlebell routines', DEFS);
  assert.doesNotMatch(without, /Here is what I want:/);
  assert.match(without, /Ask me what item\(s\) I want/);
});

console.log(`\n${passed} passed`);
