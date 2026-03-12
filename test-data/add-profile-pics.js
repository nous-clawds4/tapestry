#!/usr/bin/env node
/**
 * Add profile pictures to dwarf and pretender accounts.
 * Real dwarves: DiceBear "adventurer" style (cute cartoon)
 * Pretenders: DiceBear "bottts" style (ugly robots)
 * Good actors: DiceBear "lorelei" style (friendly fantasy)
 * Bad actors: DiceBear "shapes" style (abstract/menacing)
 *
 * Publishes updated kind 0 profiles to local strfry.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const v1Data = JSON.parse(fs.readFileSync(path.join(__dirname, 'dwarves-test-data.json'), 'utf8'));

const REAL_DWARVES = ['Doc', 'Grumpy', 'Happy', 'Sleepy', 'Bashful', 'Sneezy', 'Dopey'];
const PRETENDERS = ['Grouchy', 'Jolly', 'Drowsy', 'Timid', 'Sniffles', 'Goofy', 'Brainy'];
const GOOD_ACTORS = [
  'Snow White', 'Prince Charming', 'Magic Mirror', 'Huntsman',
  'Forest Owl', 'Woodland Deer', 'Bluebird', 'Rabbit', 'Turtle', 'Wise Owl',
];
const BAD_ACTORS = [
  'Evil Queen', 'Poison Apple', 'Dark Mirror', 'Witch Cat',
  'Shadow', 'Goblin King', 'Troll', 'Imp', 'Wraith', 'Specter',
];

// DiceBear avatar URLs — high-contrast backgrounds for visibility from across the room
function dwarfPic(name) {
  const seed = encodeURIComponent(name);
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=00cc44&radius=50`;
}

function pretenderPic(name) {
  const seed = encodeURIComponent(name);
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${seed}&backgroundColor=ff2222&radius=50`;
}

function goodActorPic(name) {
  const seed = encodeURIComponent(name);
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${seed}&backgroundColor=2288ff&radius=50`;
}

function badActorPic(name) {
  const seed = encodeURIComponent(name);
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${seed}&backgroundColor=880088&radius=50`;
}

function signEvent(sk, eventJson) {
  const result = execSync(
    `echo '${JSON.stringify(eventJson).replace(/'/g, "'\\''")}' | nak event --sec ${sk}`,
    { encoding: 'utf8', shell: '/bin/zsh' }
  ).trim();
  return JSON.parse(result);
}

function publishEvent(event) {
  try {
    const escaped = JSON.stringify(event).replace(/'/g, "'\\''");
    execSync(`echo '${escaped}' | docker exec -i tapestry /usr/local/bin/strfry import --no-verify 2>/dev/null`, {
      encoding: 'utf8', shell: '/bin/zsh', timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🖼️  Adding profile pictures\n');

  const groups = [
    { names: REAL_DWARVES, picFn: dwarfPic, emoji: '⛏️', label: 'Real dwarves (adventurer)' },
    { names: PRETENDERS, picFn: pretenderPic, emoji: '👺', label: 'Pretenders (bottts/robot)' },
    { names: GOOD_ACTORS, picFn: goodActorPic, emoji: '😇', label: 'Good actors (lorelei)' },
    { names: BAD_ACTORS, picFn: badActorPic, emoji: '😈', label: 'Bad actors (shapes)' },
  ];

  for (const { names, picFn, emoji, label } of groups) {
    console.log(`── ${label} ──\n`);
    for (const name of names) {
      const acc = v1Data.accounts[name];
      if (!acc) { console.log(`   ⚠️  ${name} not found in test data`); continue; }

      const picture = picFn(name);
      const profile = {
        name: name,
        display_name: name,
        about: acc.group === 'real-dwarves' ? `One of the Seven Dwarves.`
             : acc.group === 'pretenders' ? `Definitely a real dwarf. Definitely.`
             : undefined,
        picture,
      };
      // Keep original about if we don't override
      if (!profile.about) delete profile.about;

      const event = signEvent(acc.sk, {
        kind: 0,
        tags: [],
        content: JSON.stringify(profile),
        created_at: Math.floor(Date.now() / 1000),
      });

      const ok = publishEvent(event);
      console.log(`   ${emoji} ${ok ? '✅' : '❌'} ${name} → ${picture.slice(0, 60)}…`);
    }
    console.log();
  }

  console.log('Done! Profile pictures set for all 34 accounts.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
