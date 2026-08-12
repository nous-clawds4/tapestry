// Isolated simulation of every shell fence in the David issuer runbook.
//
// The harness runs each fence with a stubbed PATH, a sandbox filesystem, and no
// network. Three rules make it able to catch the class of bug that made the
// earlier version useless:
//
//   1. `ssh` with no remote command fails. A bare `ssh host` in a non-interactive
//      run would drop the rest of the fence on the operator's own laptop.
//   2. `docker`, `systemctl`, `systemd-analyze` and `journalctl` fail unless the
//      caller is inside a remote heredoc. That is how a remote-only command run
//      locally is caught.
//   3. No fence may prompt. `read -rp`, `read -rsp`, and `npx` are banned from
//      the document outright.
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'docs', 'david-bounty-issuer', 'README.md'), 'utf8');
const goal = fs.readFileSync(path.join(root, 'goals', 'david-bounty-issuer', 'goal.md'), 'utf8');
const blocks = [...readme.matchAll(/```bash\n([\s\S]*?)\n```/g)].map(match => match[1]);

// ── document-level rules ─────────────────────────────────────────────────────
const allFenceText = blocks.join('\n');
assert.equal(/\bnpx\b/.test(allFenceText), false, 'the container has no working directory; npx would install unpinned wallet code');
assert.equal(/\bread -rp\b|\bread -rsp\b/.test(allFenceText), false, 'a prompt eats the following lines when the runbook is driven non-interactively');
const pin = readme.match(/- Repository: `(\S+)`\n- Branch: `(\S+)`\n- Commit: `([0-9a-f]{40})`/);
assert.ok(pin, 'the runbook must pin a real repository, branch, and commit');
const [, pinnedRepo, pinnedBranch, pinnedSha] = pin;
assert.equal(pinnedRepo, 'https://github.com/nous-clawds4/tapestry.git');
assert.ok(readme.includes(`export DEPLOY_REF="${pinnedBranch}"`), 'section 0 must export the pinned branch');
assert.ok(readme.includes(`export PINNED_IMPLEMENTATION="${pinnedSha}"`), 'section 0 must export the pinned commit');
assert.ok(readme.includes('git merge-base --is-ancestor "$PINNED_IMPLEMENTATION" "$DEPLOY_SHA"'), 'section 0 must refuse a branch tip that does not contain the pinned commit');

const warningSection = goal.match(/## Hard constraints — these go in the pack verbatim as warnings\n\n([\s\S]*?)\n\n## Tasks/)[1];
const warnings = warningSection.split(/\n(?=- )/);
assert.equal(warnings.length, 5);
for (const warning of warnings) assert.ok(readme.includes(warning), `missing verbatim warning: ${warning.split('\n')[0]}`);
const sectionHeadings = [
  '## What has not been executed',
  '## 0. Prepare a fresh checkout', '## 1. Set up the wallet, funding, allowlist, delegate, and session',
  '## 2. Issue a bounty from a sentence', '## 3. Install settlement and keep the timer disabled',
  '## 4. Prove one live 100-sat settlement', '## 5. Reconcile and recover safely', '## 6. Hard-constraint warnings',
];
const sectionOffsets = sectionHeadings.map(heading => readme.indexOf(heading));
assert.ok(sectionOffsets.every(offset => offset >= 0));
assert.deepEqual(sectionOffsets, [...sectionOffsets].sort((a, b) => a - b), 'the honesty box and sections 0 through 6 must stay ordered');

// ── one declared behaviour per fence ─────────────────────────────────────────
// `env` is merged into the fence environment and drives the stubs, so no stub
// depends on a fence number.
const fences = [
  { name: 'canonical checkout' },
  { name: 'portable random selection' },
  { name: 'local issuer authentication' },
  { name: 'remote prerequisites' },
  { name: 'pre-dispatch settings', env: { RUNBOOK_ALLOWLIST_MODE: 'before' } },
  { name: 'workflow dispatch correlation' },
  { name: 'post-dispatch assertions', env: { RUNBOOK_ALLOWLIST_MODE: 'after' } },
  { name: 'pinned deploy' },
  { name: 'legacy payment repair' },
  { name: 'wallet configuration and balance' },
  { name: 'top-up invoice' },
  { name: 'top-up history proof', env: { RUNBOOK_WALLET_MODE: 'topup' } },
  { name: 'delegate reuse' },
  { name: 'durable authentication' },
  { name: 'canonical topic input' },
  { name: 'non-state input' },
  { name: 'server inventories', env: { RUNBOOK_CURL_MODE: 'inventory' } },
  { name: 'durable ledger', env: { LEDGER_RECONCILE_ACK: 'RECONCILE' } },
  { name: 'list creation' },
  { name: 'bounty creation' },
  { name: 'bounty API assertion', env: { RUNBOOK_CURL_MODE: 'verify' } },
  { name: 'settlement self-checks' },
  { name: 'disabled unit install' },
  { name: 'initial settlement dry-run', env: { RUNBOOK_SETTLE_MODE: 'queued' } },
  { name: 'judgment append', env: { DECISION: 'accept', CONFIDENCE: '0.8', REASON: 'fixture reason' } },
  { name: 'post-judgment dry-run', env: { RUNBOOK_SETTLE_MODE: 'clean' } },
  { name: 'disabled diagnostics' },
  { name: 'proof timer stop' },
  { name: 'targeted settlement' },
  { name: 'receipt proof and activation', env: { RUNBOOK_CURL_MODE: 'proof' } },
  { name: 'dry reconciliation' },
  { name: 'live reconciliation' },
  { name: 'ordinary failed reset' },
  { name: 'ambiguous failed reset', env: { RUNBOOK_WALLET_MODE: 'failed-attempt' } },
];
assert.equal(blocks.length, fences.length, 'every shell fence needs one named harness behaviour');

function requireSuccess(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  assert.equal(result.status, 0, result.stderr || result.stdout || `${command} failed`);
  return result;
}

requireSuccess('/bin/bash', ['-n'], { input: blocks.join('\n') });
requireSuccess(process.execPath, ['--check', __filename]);
requireSuccess('npm', ['--version']);
requireSuccess('jq', ['-e', '.ok == true'], { input: '{"ok":true}\n' });

// ── sandbox ──────────────────────────────────────────────────────────────────
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'david-runbook-'));
process.on('exit', () => fs.rmSync(sandbox, { recursive: true, force: true }));
const fakeBin = path.join(sandbox, 'bin');
const repo = path.join(sandbox, 'repo');
const home = path.join(sandbox, 'home');
const varLib = path.join(sandbox, 'var', 'lib', 'brainstorm');
const varLog = path.join(sandbox, 'var', 'log', 'brainstorm');
const etcSystemd = path.join(sandbox, 'etc', 'systemd', 'system');
for (const directory of [fakeBin, repo, home, varLib, varLog, etcSystemd, path.join(repo, 'systemd')]) fs.mkdirSync(directory, { recursive: true });
fs.copyFileSync(path.join(root, 'systemd', 'david-bounty-settlement.service'), path.join(repo, 'systemd', 'david-bounty-settlement.service'));
fs.copyFileSync(path.join(root, 'systemd', 'david-bounty-settlement.timer'), path.join(repo, 'systemd', 'david-bounty-settlement.timer'));
fs.mkdirSync(path.join(repo, '.git'));

const david = 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f';
const house = '853baa94b4b12d23931ade03ceb854a2b36cf1e24b5e3a82e68c8ca3a8ced2ba';
const claim = 'c'.repeat(64);
const bounty = '14ec286a-bc47-4def-b400-9c905f4e1519';
const paymentHash = 'b'.repeat(64);
const bolt11 = 'lnbc10u1fixtureinvoice';
const expectedAllowlist = `${house},${david}`;
const decisionsPath = path.join(varLib, 'david-bounty-decisions.jsonl');
fs.writeFileSync(path.join(repo, '.env'), `AUTO_PAY_ENABLED=true\nAUTO_PAY_MAX_SATS=77\nAUTO_PAY_ALLOWLIST_PUBKEYS=${house}\nSESSION_SECRET=${'9'.repeat(64)}\nMDK_WALLET_ID=fixture\nMDK_WALLET_MNEMONIC=fixture\n`, { mode: 0o600 });

function executable(name, content) { fs.writeFileSync(path.join(fakeBin, name), content, { mode: 0o755 }); }

// Any command that only exists on the instance refuses to run outside a remote
// heredoc. This is the check that catches a runbook block missing its ssh.
const REMOTE_ONLY_GUARD = `if test "\${RUNBOOK_REMOTE-}" != 1; then echo "REFUSE: $(basename "$0") ran outside a remote heredoc" >&2; exit 70; fi`;

executable('ssh', `#!/bin/bash
set -eu
if test "$#" -le 1; then echo 'REFUSE: ssh with no remote command' >&2; exit 65; fi
export RUNBOOK_REMOTE=1
command="\${!#}"
if test "$command" = 'bash -s'; then exec /bin/bash -s; fi
exec /bin/bash -c "$command"
`);

executable('git', `#!/bin/bash
set -eu
case "\${1-}" in
 clone) target="\${!#}"; mkdir -p "$target/.git" ;;
 check-ref-format|fetch|checkout) ;;
 merge-base) if test "\${RUNBOOK_ANCESTOR-1}" = 1; then exit 0; fi; exit 1 ;;
 rev-parse) printf '%s\\n' '${pinnedSha}' ;;
 *) echo "unhandled git: $*" >&2; exit 64 ;;
esac
`);
executable('npm', '#!/bin/bash\nexit 0\n');
executable('pick_one', '#!/bin/bash\nhead -n 1\n');
executable('node', `#!/bin/bash
set -eu
if [[ "\${1-}" == "-e" ]]; then
 if [[ "\${2-}" == *"process.versions.node"* ]]; then exec '${process.execPath}' "$@"; fi
 if [[ "\${2-}" == *"getPublicKey"* ]]; then printf '%s' "$DAVID_ISSUER_PUBKEY"; exit 0; fi
 if [[ "\${2-}" == *"randomInt"* ]]; then head -n 1; exit 0; fi
fi
if [[ "\${1-}" == "bin/agent.js" ]]; then
 case "\${2-}" in
  auth-login) printf '{"ok":true,"pubkey":"%s"}\\n' "$DAVID_ISSUER_PUBKEY" ;;
  create-list) printf '{"ok":true,"coordinate":"%s"}\\n' "$EXPECTED_COORDINATE" ;;
  create-bounty) printf '{"ok":true,"success":true,"bounty":{"id":"%s","list_coordinate":"%s","amount_sats":%s,"bounty_cap_sats":%s,"criteria":"%s","auto_pay":0}}\\n' "$BOUNTY_ID" "$LIST_COORDINATE" "$AMOUNT_SATS" "$CAP_SATS" "$CRITERIA" ;;
  *) echo "unhandled agent command: \${2-}" >&2; exit 64 ;;
 esac
 exit 0
fi
echo "unhandled node: $*" >&2; exit 64
`);
executable('gh', `#!/bin/bash
set -eu
case "\${1-} \${2-}" in
 "auth status") ;;
 "api user"|"api repos/"*) printf 'fixture-actor\\n' ;;
 "workflow run"|"run watch") ;;
 "run list") file="$RUNBOOK_SANDBOX/gh-count"; count=0; test -f "$file" && count=$(cat "$file"); count=$((count + 1)); printf '%s' "$count" > "$file"; if test "$count" -eq 1; then printf '100\\n'; else printf '100\\n101\\n'; fi ;;
 "run view") printf '{"databaseId":101,"conclusion":"success","url":"https://example.invalid/run/101","event":"workflow_dispatch","headBranch":"${pinnedBranch}","headSha":"${pinnedSha}"}\\n' ;;
 *) echo "unhandled gh: $*" >&2; exit 64 ;;
esac
`);
executable('curl', `#!/bin/bash
set -eu
case "\${RUNBOOK_CURL_MODE-}" in
 inventory) printf '{"success":true,"bounties":[]}\\n' ;;
 verify) printf '{"success":true,"bounty":{"id":"%s","issuer_pubkey":"%s","list_coordinate":"%s","amount_sats":100,"bounty_cap_sats":500,"paymentState":{"totalRewardSlots":5},"auto_pay":0,"criteria":"%s"}}\\n' "$BOUNTY_ID" "$DAVID_ISSUER_PUBKEY" "$LIST_COORDINATE" "$CRITERIA" ;;
 proof) printf '{"success":true,"bounty":{"id":"%s"},"claims":[{"event":{"id":"%s"},"paymentStatus":"paid","zapReceipt":{"kind":9735}}]}\\n' "$BOUNTY_ID" "$CLAIM_ID" ;;
 *) echo "unexpected curl call: $*" >&2; exit 64 ;;
esac
`);
executable('docker', `#!/bin/bash
set -eu
${REMOTE_ONLY_GUARD}
args="$*"
case "$args" in
 "compose version") ;;
 *"printenv AUTO_PAY_ENABLED"*) printf 'true\\n' ;;
 *"printenv AUTO_PAY_MAX_SATS"*) printf '77\\n' ;;
 *"printenv AUTO_PAY_ALLOWLIST_PUBKEYS"*) if test "\${RUNBOOK_ALLOWLIST_MODE-}" = before; then printf '%s\\n' "$HOUSE_ISSUER_PUBKEY"; else printf '%s\\n' "$EXPECTED_ALLOWLIST"; fi ;;
 *"agent-wallet init --show"*) printf '{"network":"mainnet"}\\n' ;;
 *"agent-wallet receive"*) printf '{"invoice":"${bolt11}","payment_hash":"${paymentHash}"}\\n' ;;
 *"agent-wallet payments"*) if test "\${RUNBOOK_WALLET_MODE-}" = failed-attempt; then printf '{"payments":[{"destination":"${bolt11}","paymentHash":"${paymentHash}","amountSats":100,"direction":"outbound","status":"failed"}]}\\n'; else printf '{"payments":[{"paymentHash":"${paymentHash}","amountSats":1000,"direction":"inbound","status":"completed"}]}\\n'; fi ;;
 *"verifyBolt11AmountSats"*) ;;
 *"agent.js balance"*) printf '{"ok":true,"balance_sats":5000}\\n' ;;
 *"repair-legacy-payments"*) printf '{"ok":true,"dryRun":false,"legacyRows":0,"results":[],"issuer":null}\\n' ;;
 *"getDelegatePubkey"*) if [[ "$args" == *"$HOUSE_ISSUER_PUBKEY"* ]]; then printf 'afb6ca29%s' "$(printf '0%.0s' {1..56})"; else printf '%s' "$(printf 'd%.0s' {1..64})"; fi ;;
 *"resolveSessionDbPath"*) printf '%s' '${varLib}/sessions.db' ;;
 *"agent.js auth-login"*) printf '{"ok":true,"pubkey":"%s"}\\n' "$DAVID_ISSUER_PUBKEY" ;;
 *"agent.js payments-due"*) printf '{"ok":true,"success":true,"items":[]}\\n' ;;
 *"agent.js reconcile"*) if [[ "$args" == *"--dry-run"* ]]; then printf '{"ok":true,"dryRun":true,"results":[]}\\n'; else printf '{"ok":true,"dryRun":false,"results":[]}\\n'; fi ;;
 *"agent.js reset"*) printf '{"ok":true,"success":true,"reset":true,"blocked":false}\\n' ;;
 *"getAutoPayment"*) printf '{"state":"failed","reason":"ambiguous_send: fixture","bolt11":"${bolt11}"}\\n' ;;
 *"david-bounty-settle.js"*"--dry-run --bounty"*) printf '{"ok":true,"mode":"dry-run","dryRuns":1,"judgments":0,"payments":0,"failures":0,"target":{"bountyId":"%s","claimEventId":"%s"}}\\n' "$BOUNTY_ID" "$CLAIM_ID" ;;
 *"david-bounty-settle.js"*"--live --bounty"*) printf '{"ok":true,"mode":"live","dryRuns":1,"judgments":1,"payments":1,"failures":0,"target":{"bountyId":"%s","claimEventId":"%s"}}\\n' "$BOUNTY_ID" "$CLAIM_ID" ;;
 *"david-bounty-settle.js"*)
   case "\${RUNBOOK_SETTLE_MODE-clean}" in
    queued) printf '{"ok":false,"mode":"dry-run","target":null,"failures":1,"queued":1}\\n'; exit 1 ;;
    fatal) printf '{"ok":false,"mode":"dry-run","target":null,"failures":1,"queued":0}\\n'; exit 1 ;;
    *) printf '{"ok":true,"mode":"dry-run","target":null,"failures":0,"queued":0}\\n' ;;
   esac ;;
 *"david-bounty-decisions.jsonl"*"cat >>"*) cat >> "$RUNBOOK_DECISIONS" ;;
 *"david-bounty-decisions.jsonl"*) test ! -f "$RUNBOOK_DECISIONS" || cat "$RUNBOOK_DECISIONS" ;;
 *"david-bounty-judgment-queue.json"*) if test "\${RUNBOOK_SETTLE_MODE-}" = fatal; then printf '{"issuerPubkey":"%s","claims":[]}\\n' "$DAVID_ISSUER_PUBKEY"; else printf '{"issuerPubkey":"%s","claims":[{"bountyId":"%s","claimEventId":"%s","status":"%s"}]}\\n' "$DAVID_ISSUER_PUBKEY" "$BOUNTY_ID" "$CLAIM_ID" "\${RUNBOOK_QUEUE_STATUS-awaiting_judgment}"; fi ;;
 *"AUTO_PAY_ZAP_RELAYS"*) printf 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net\\n' ;;
 *"stat -c %a"*) printf '600\\n' ;;
 *"for command in node jq curl stat tail"*|*"fetch(\\\"http://localhost:7778"*|*"test/david-bounty-settle.test.js"*|*"test/agent-auth-commands.test.js"*|*"tail -n"*) ;;
 "compose up"*|"compose restart"*) ;;
 *) echo "unhandled docker: $args" >&2; exit 64 ;;
esac
`);
executable('systemctl', `#!/bin/bash
set -eu
${REMOTE_ONLY_GUARD}
file="$RUNBOOK_SANDBOX/systemctl-state"; test -f "$file" || printf 'disabled inactive\\n' > "$file"; read -r enabled active < "$file"
case "\${1-}" in
 disable) printf 'disabled inactive\\n' > "$file" ;;
 stop) printf '%s inactive\\n' "$enabled" > "$file" ;;
 enable) printf 'enabled active\\n' > "$file" ;;
 is-enabled) printf '%s\\n' "$enabled" ;;
 is-active) printf '%s\\n' "$active" ;;
 status) exit 3 ;;
 list-timers|daemon-reload) ;;
 *) echo "unhandled systemctl: $*" >&2; exit 64 ;;
esac
`);
executable('systemd-analyze', `#!/bin/bash\nset -eu\n${REMOTE_ONLY_GUARD}\nexit 0\n`);
executable('journalctl', `#!/bin/bash\nset -eu\n${REMOTE_ONLY_GUARD}\nprintf "journal checked\\n" >> "$RUNBOOK_SANDBOX/evidence"\n`);
executable('sudo', '#!/bin/bash\nset -eu\ncase "${1-}" in systemctl|systemd-analyze) exec "$@" ;; tee) exec /usr/bin/tee "${@:2}" ;; chmod) exec /bin/chmod "${@:2}" ;; install) exec /usr/bin/install "${@:2}" ;; *) echo "unhandled sudo: $*" >&2; exit 64 ;; esac\n');
executable('stat', '#!/bin/bash\nif test "${1-}" = "-c"; then printf "600\\n"; else exec /usr/bin/stat "$@"; fi\n');

function isolatedBlock(block) {
  return block
    .replaceAll('/opt/tapestry', repo)
    .replaceAll('/var/lib/brainstorm', varLib)
    .replaceAll('/var/log/brainstorm', varLog)
    .replaceAll('/etc/systemd/system', etcSystemd)
    .replaceAll('/etc/magic-carpet-david-settlement.conf', path.join(sandbox, 'etc', 'magic-carpet-david-settlement.conf'));
}
const baseEnv = {
  ...process.env,
  PATH: `${fakeBin}:${process.env.PATH}`,
  HOME: home,
  RUNBOOK_SANDBOX: sandbox,
  RUNBOOK_DECISIONS: decisionsPath,
  REPO: repo,
  GH_REPO: 'nous-clawds4/tapestry',
  GH_URL: 'https://github.com/nous-clawds4/tapestry.git',
  DEPLOY_REF: pinnedBranch,
  DEPLOY_SHA: pinnedSha,
  SSH_HOST: 'fixture-host',
  MC_NSEC: '1'.repeat(64),
  MC_BASE_URL: 'https://example.invalid',
  MC_COOKIE_JAR: path.join(home, 'cookies.json'),
  DAVID_ISSUER_PUBKEY: david,
  HOUSE_ISSUER_PUBKEY: house,
  DAVID_BOUNTY_LEDGER_DIR: path.join(home, 'state'),
  EXPECTED_ALLOWLIST: expectedAllowlist,
  ENABLE_BEFORE: 'true',
  MAX_BEFORE: '77',
  MAX_OPEN: '5',
  AMOUNT_SATS: '100',
  CAP_SATS: '500',
  BUDGET_SATS: '500',
  TOP_UP_SATS: '1000',
  BALANCE_BEFORE: '4000',
  D_TAG: 'fixture-topic',
  SINGULAR: 'Fixture item',
  PLURAL: 'Fixture items',
  DESCRIPTION: 'Fixture description.',
  CRITERIA: 'Submit one fixture item.',
  EXPECTED_COORDINATE: `39998:${david}:fixture-topic`,
  LIST_COORDINATE: `39998:${david}:fixture-topic`,
  BOUNTY_ID: bounty,
  CLAIM_ID: claim,
  QUEUE_JSON: JSON.stringify({ issuerPubkey: david, claims: [{ bountyId: bounty, claimEventId: claim, status: 'awaiting_judgment' }] }),
  ALL_INVENTORY: JSON.stringify({ success: true, bounties: [] }),
  OPEN_INVENTORY: JSON.stringify({ success: true, bounties: [] }),
  TOP_UP_PAYMENT_HASH: paymentHash,
  TOP_UP_INVOICE: bolt11,
};
// RUNBOOK_REMOTE must never leak in from the outside; the ssh stub is the only
// thing allowed to set it.
delete baseEnv.RUNBOOK_REMOTE;

function prepare(index) {
  fs.rmSync(path.join(sandbox, 'gh-count'), { force: true });
  fs.rmSync(decisionsPath, { force: true });
  fs.writeFileSync(path.join(sandbox, 'systemctl-state'), 'disabled inactive\n');
  fs.mkdirSync(path.join(home, 'state'), { recursive: true });
  const ledger = path.join(home, 'state', 'david-bounty-generator-ledger.json');
  const ledgerFenceIndex = fences.findIndex(fence => fence.name === 'durable ledger') + 1;
  if (index === ledgerFenceIndex) fs.rmSync(ledger, { force: true });
  if (index > ledgerFenceIndex && !fs.existsSync(ledger)) fs.writeFileSync(ledger, '{"budget_sats":500,"created":[]}\n');
  return ledger;
}
function runFence(index, { env = {}, mutate = block => block, before = () => {} } = {}) {
  const ledger = prepare(index);
  before();
  return spawnSync('/bin/bash', ['-c', isolatedBlock(mutate(blocks[index - 1]))], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...baseEnv, LEDGER: ledger, ...(fences[index - 1].env || {}), ...env },
    timeout: 20_000,
  });
}
function fenceIndex(name) {
  const index = fences.findIndex(fence => fence.name === name);
  assert.notEqual(index, -1, `unknown fence: ${name}`);
  return index + 1;
}

for (let index = 1; index <= blocks.length; index += 1) {
  const result = runFence(index);
  assert.equal(result.status, 0, `fence ${index} (${fences[index - 1].name}) failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}
assert.match(fs.readFileSync(path.join(sandbox, 'evidence'), 'utf8'), /journal checked/);

// ── the harness catches the bugs it exists to catch ──────────────────────────
const heredocForm = /ssh "\$SSH_HOST" 'bash -s' <<'REMOTE'\n/;
const pipedForm = /\} \| ssh "\$SSH_HOST" 'bash -s'/;
const remoteChecks = [
  // Drop the ssh and the remote script runs on the operator's own machine.
  ['remote prerequisites', heredocForm, "bash -s <<'REMOTE'\n"],
  ['pinned deploy', pipedForm, '} | bash -s'],
  // Keep the ssh but drop its command and the rest of the fence goes nowhere.
  ['remote prerequisites', heredocForm, 'ssh "$SSH_HOST"\n'],
];
for (const [name, pattern, replacement] of remoteChecks) {
  const index = fenceIndex(name);
  assert.match(blocks[index - 1], pattern, `${name} must be one ssh heredoc`);
  const broken = runFence(index, { mutate: block => block.replace(pattern, replacement) });
  assert.notEqual(broken.status, 0, `${name} must fail when its remote commands leave the remote heredoc`);
}
for (const [index, fence] of fences.entries()) {
  const usesRemoteOnly = /\bdocker compose\b|\bsystemctl\b|\bsystemd-analyze\b|\bjournalctl\b/.test(blocks[index]);
  if (!usesRemoteOnly) continue;
  assert.ok(
    heredocForm.test(blocks[index]) || pipedForm.test(blocks[index]),
    `fence ${index + 1} (${fence.name}) uses a remote-only command and must be one ssh heredoc`,
  );
}

// ── refusal and decision scenarios ───────────────────────────────────────────
const judgment = fenceIndex('judgment append');
assert.equal(runFence(judgment, { env: { DECISION: 'reject', CONFIDENCE: '0.2' } }).status, 0, 'a valid reject must append');
assert.notEqual(runFence(judgment, { env: { CONFIDENCE: '0.5' } }).status, 0, 'low-confidence accept must fail');
assert.notEqual(runFence(judgment, { env: { REASON: '' } }).status, 0, 'empty reason must fail');
assert.notEqual(runFence(judgment, { env: { REASON: '   ' } }).status, 0, 'whitespace-only reason must fail');
assert.notEqual(runFence(judgment, { env: { DECISION: 'maybe' } }).status, 0, 'an unknown decision must fail');
assert.notEqual(runFence(judgment, {
  before: () => fs.writeFileSync(decisionsPath, `${JSON.stringify({ bountyId: bounty, claimEventId: claim })}\n`),
}).status, 0, 'duplicate decision must fail');
assert.notEqual(runFence(judgment, {
  env: { QUEUE_JSON: JSON.stringify({ issuerPubkey: david, claims: [{ bountyId: bounty, claimEventId: claim, status: 'payment_failed_reset_required' }] }) },
}).status, 0, 'non-judgment queue row must fail');
assert.notEqual(runFence(judgment, { env: { QUEUE_INDEX: '1' } }).status, 0, 'out-of-range queue index must fail');
assert.notEqual(runFence(fenceIndex('initial settlement dry-run'), {
  env: { RUNBOOK_SETTLE_MODE: 'fatal' },
}).status, 0, 'fatal dry-run without judgment rows must fail');
assert.notEqual(runFence(fenceIndex('canonical checkout'), { env: { SSH_HOST: '' } }).status, 0, 'a missing SSH_HOST must fail');
assert.notEqual(runFence(fenceIndex('canonical checkout'), { env: { MC_NSEC: '' } }).status, 0, 'a missing MC_NSEC must fail');
assert.notEqual(runFence(fenceIndex('canonical checkout'), { env: { RUNBOOK_ANCESTOR: '0' } }).status, 0, 'a branch tip without the pinned commit must fail');
assert.notEqual(runFence(fenceIndex('durable ledger'), { env: { LEDGER_RECONCILE_ACK: '' } }).status, 0, 'an unacknowledged ledger import must fail');
assert.notEqual(runFence(fenceIndex('ordinary failed reset'), { env: { BOUNTY_ID: '' } }).status, 0, 'a reset without a bounty id must fail');

console.log(`${blocks.length} runbook shell fences passed in isolated simulation; ${remoteChecks.length} remote-placement and 14 refusal scenarios passed`);
