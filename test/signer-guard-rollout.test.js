/**
 * Item #4 (issue #335) — NIP-07 signer/session guard rolled out to ALL
 * user-initiated signed write paths (profile tags + pins + NIP-51 exports),
 * not just event-tagging. Source-contract.
 */
const fs = require('fs');
const path = require('path');
const UI = (p) => path.resolve(__dirname, '..', 'ui/src', p);
function assert(c, m) { if (!c) throw new Error(m || 'fail'); }
function rd(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const tests = [];
const t = (n, f) => tests.push([n, f]);

t('signerGuard exposes the session-pubkey mirror + getActiveSignerOrThrow', () => {
  const s = rd(UI('utils/signerGuard.js'));
  assert(/export function setSessionPubkey/.test(s), 'must export setSessionPubkey');
  assert(/export function getSessionPubkey/.test(s), 'must export getSessionPubkey');
  assert(/getActiveSignerOrThrow/.test(s), 'must export getActiveSignerOrThrow (fetch active + assert vs session)');
});

t('AuthContext publishes the session pubkey to the guard', () => {
  const s = rd(UI('context/AuthContext.jsx'));
  assert(/setSessionPubkey/.test(s), 'AuthContext must call setSessionPubkey on session changes');
});

t('profile-tag write path is guarded', () => {
  const s = rd(UI('utils/publishProfileTag.js'));
  assert(/getActiveSignerOrThrow/.test(s), 'publishProfileTagAssertion must guard the active signer');
});

t('pin + NIP-51 export write paths are guarded', () => {
  const s = rd(UI('utils/publishTagPin.js'));
  // pinTag, unpinTag, publishNip51ExportForPin, publishNoteBookmarkSetForPin.
  const count = (s.match(/getActiveSignerOrThrow/g) || []).length;
  assert(count >= 4, `expected the pin/export write paths guarded (>=4 getActiveSignerOrThrow), found ${count}`);
});

async function run() {
  console.log('\n--- signer-guard rollout tests (issue #335, item #4) ---');
  let pass = 0, fail = 0; const failures = [];
  for (const [name, fn] of tests) { try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failures.push({ name, message: e.message }); fail++; } }
  console.log(`\nsigner-guard-rollout: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}
if (require.main === module) { run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); }); }
module.exports = { run };
