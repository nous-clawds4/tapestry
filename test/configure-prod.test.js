const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');

const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'configure-prod.yml');
const workflow = yaml.load(fs.readFileSync(workflowPath, 'utf8'));
const operateScript = workflow.jobs.configure.steps.find(step => step.name === 'Operate via SSH').with.script;

function runOperate({
  enabled = '',
  maxSats = '',
  allowlist = '',
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'configure-prod-')),
  initialEnv = 'AUTO_PAY_ENABLED=true\nAUTO_PAY_MAX_SATS=77\nKEEP_ME=yes\n',
} = {}) {
  const fakeBin = path.join(directory, 'bin');
  if (!fs.existsSync(fakeBin)) fs.mkdirSync(fakeBin);
  const docker = path.join(fakeBin, 'docker');
  fs.writeFileSync(docker, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const envPath = path.join(directory, '.env');
  if (!fs.existsSync(envPath)) fs.writeFileSync(envPath, initialEnv);

  const result = spawnSync('/bin/sh', ['-c', operateScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      TAPESTRY_DIR: directory,
      AUTO_PAY_ENABLED_IN: enabled,
      MAX_SATS_IN: maxSats,
      CLEAR_MNEMONIC_IN: 'false',
      ISSUER_IN: '',
      PREFLIGHT_CLAIMANTS_IN: '',
      MIN_RANK_IN: '3',
      ALLOWLIST_IN: allowlist,
      DEBUG_TICK_IN: 'false',
      ZAP_RELAYS_IN: '',
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const values = Object.fromEntries(fs.readFileSync(envPath, 'utf8')
    .trim().split('\n').map(line => line.split(/=(.*)/s).slice(0, 2)));
  return { directory, stdout: result.stdout, values };
}

const allowlist = 'a'.repeat(64);
const { values: preserved } = runOperate({
  allowlist,
  initialEnv: `AUTO_PAY_ENABLED=true\nAUTO_PAY_MAX_SATS=77\nKEEP_ME=yes\nSESSION_SECRET=${'1'.repeat(64)}\n`,
});
assert.equal(preserved.AUTO_PAY_ENABLED, 'true');
assert.equal(preserved.AUTO_PAY_MAX_SATS, '77');
assert.equal(preserved.AUTO_PAY_ALLOWLIST_PUBKEYS, allowlist);
assert.equal(preserved.KEEP_ME, 'yes');
assert.equal(preserved.SESSION_SECRET, '1'.repeat(64));

const { values: changed } = runOperate({ enabled: 'false', maxSats: '25' });
assert.equal(changed.AUTO_PAY_ENABLED, 'false');
assert.equal(changed.AUTO_PAY_MAX_SATS, '25');
assert.equal(changed.KEEP_ME, 'yes');
const generatedRun = runOperate();
assert.match(generatedRun.values.SESSION_SECRET, /^[0-9a-f]{64}$/);
assert.equal(generatedRun.stdout.includes(generatedRun.values.SESSION_SECRET), false);
const rerun = runOperate({ directory: generatedRun.directory, allowlist });
assert.equal(rerun.values.SESSION_SECRET, generatedRun.values.SESSION_SECRET);
assert.equal(rerun.stdout.includes(generatedRun.values.SESSION_SECRET), false);
const weakRun = runOperate({
  initialEnv: 'AUTO_PAY_ENABLED=true\nAUTO_PAY_MAX_SATS=77\nSESSION_SECRET=x\n',
});
assert.match(weakRun.values.SESSION_SECRET, /^[0-9a-f]{64}$/);
assert.notEqual(weakRun.values.SESSION_SECRET, 'x');
assert.equal(weakRun.stdout.includes('SESSION_SECRET=x'), false);

console.log('5 configure-prod workflow self-checks passed');
