/**
 * Tests for the list (DList) TOML drop-in helpers. Plain node + assert.
 * Run: `node src/lib/listToml.test.mjs` (from ui/).
 */

import assert from 'node:assert';
import { parseListToml, buildListPrompt, buildClaudeDeepLink } from './listToml.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

test('valid array of two lists, fenced, with property tags + defaults', () => {
  const src = [
    '```toml',
    '[[list]]',
    'singular = "Kettlebell routine"',
    'plural = "Kettlebell routines"',
    'description = "Curated kettlebell workouts"',
    'property_tags = [',
    '  { requirement = "required", name = "name" },',
    '  { requirement = "optional", name = "video_url" },',
    ']',
    '',
    '[[list]]',
    'singular = "Protein bar"',
    '```',
  ].join('\n');
  const { lists, errors } = parseListToml(src);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(lists.length, 2);
  assert.strictEqual(lists[0].singular, 'Kettlebell routine');
  assert.strictEqual(lists[0].plural, 'Kettlebell routines');
  assert.strictEqual(lists[0].replaceable, true); // default
  assert.deepStrictEqual(lists[0].propertyTags, [
    { requirement: 'required', value: 'name' },
    { requirement: 'optional', value: 'video_url' },
  ]);
  // second list: plural empty, no tags, default replaceable
  assert.strictEqual(lists[1].plural, '');
  assert.deepStrictEqual(lists[1].propertyTags, []);
});

test('bare top-level table with name alias and non-replaceable', () => {
  const { lists, errors } = parseListToml('name = "Sleepy dwarf"\nreplaceable = false');
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(lists[0].singular, 'Sleepy dwarf');
  assert.strictEqual(lists[0].replaceable, false);
});

test('requires singular', () => {
  const { lists, errors } = parseListToml('[[list]]\ndescription = "no name"');
  assert.strictEqual(lists.length, 0);
  assert.match(errors[0], /singular/);
});

test('rejects a bad requirement', () => {
  const { errors } = parseListToml('[[list]]\nsingular = "x"\nproperty_tags = [{ requirement = "mandatory", name = "name" }]');
  assert.match(errors[0], /requirement must be one of/);
});

test('rejects a property tag with no name', () => {
  const { errors } = parseListToml('[[list]]\nsingular = "x"\nproperty_tags = [{ requirement = "required" }]');
  assert.match(errors[0], /needs a name/);
});

test('rejects non-array property_tags', () => {
  const { errors } = parseListToml('[[list]]\nsingular = "x"\nproperty_tags = "name"');
  assert.match(errors[0], /property_tags must be an array/);
});

test('reports TOML syntax errors instead of throwing', () => {
  const { lists, errors } = parseListToml('this is = = not toml');
  assert.strictEqual(lists.length, 0);
  assert.match(errors[0], /TOML syntax error/);
});

test('labels errors per-list when several tables are present', () => {
  const { errors } = parseListToml('[[list]]\nsingular = "ok"\n\n[[list]]\ndescription = "no name"');
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /^List 2:/);
});

test('prompt embeds the request and tells Claude to draft immediately', () => {
  const withReq = buildListPrompt('a list of kettlebell routines');
  assert.match(withReq, /Here is what I want:/);
  assert.ok(withReq.includes('a list of kettlebell routines'));
  assert.match(withReq, /do NOT ask me questions/);
  const without = buildListPrompt();
  assert.doesNotMatch(without, /Here is what I want:/);
  assert.match(without, /Ask me what list I want/);
});

test('deep link round-trips the prompt', () => {
  const prompt = buildListPrompt('books');
  const link = buildClaudeDeepLink(prompt);
  assert.ok(link.startsWith('https://claude.ai/new?q='));
  assert.strictEqual(decodeURIComponent(link.split('?q=')[1]), prompt);
});

console.log(`\n${passed} passed`);
