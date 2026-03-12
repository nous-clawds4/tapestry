#!/usr/bin/env node
/**
 * Add noisy votes from the 7 real dwarves.
 * 25% chance to publish each reaction.
 * Real dwarves upvote real dwarves, downvote pretenders.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const v1Data = JSON.parse(fs.readFileSync(path.join(__dirname, 'dwarves-test-data.json'), 'utf8'));
const v2Data = JSON.parse(fs.readFileSync(path.join(__dirname, 'dwarves-v2-test-data.json'), 'utf8'));

const REAL_NAMES = ['Doc', 'Grumpy', 'Happy', 'Sleepy', 'Bashful', 'Sneezy', 'Dopey'];
const PRETENDER_NAMES = ['Grouchy', 'Jolly', 'Drowsy', 'Timid', 'Sniffles', 'Goofy', 'Brainy'];

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
  console.log('🎲 Adding noisy real dwarf votes (25% chance per reaction)\n');

  let published = 0, skipped = 0;

  for (const dwarfName of REAL_NAMES) {
    const acc = v1Data.accounts[dwarfName];
    let ups = 0, downs = 0, flips = 0;

    // Upvote fellow real dwarves
    for (const targetName of REAL_NAMES) {
      if (Math.random() >= 0.25) { skipped++; flips++; continue; }
      const targetItem = v2Data.items[targetName];
      const event = signEvent(acc.sk, {
        kind: 7,
        tags: [['e', targetItem.eventId], ['p', targetItem.authorPk]],
        content: '+',
        created_at: Math.floor(Date.now() / 1000),
      });
      publishEvent(event);
      ups++; published++;
    }

    // Downvote pretenders
    for (const targetName of PRETENDER_NAMES) {
      if (Math.random() >= 0.25) { skipped++; flips++; continue; }
      const targetItem = v2Data.items[targetName];
      const event = signEvent(acc.sk, {
        kind: 7,
        tags: [['e', targetItem.eventId], ['p', targetItem.authorPk]],
        content: '-',
        created_at: Math.floor(Date.now() / 1000),
      });
      publishEvent(event);
      downs++; published++;
    }

    console.log(`   ⛏️ ${dwarfName}: +${ups} real, -${downs} pretenders (${flips} skipped)`);
  }

  console.log(`\n   📊 Total: ${published} published, ${skipped} skipped (75% skip rate)\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
