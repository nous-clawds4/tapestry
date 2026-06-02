#!/usr/bin/env bash
# Real-strfry end-to-end for the CLI's LOCAL path (strfry import + strfry scan).
#
# Meant to run INSIDE the tapestry container, where the patched strfry binary
# and config live. Uses a throwaway strfry config pointing at a temp LMDB dir so
# it never touches the dev DB at /var/lib/strfry. Drives bin/receiving.js through
# set (local import only) → show/resolve (local scan only) and asserts the event
# round-trips through the real store.
#
# Run from the host:
#   docker exec tapestry bash /usr/local/lib/node_modules/brainstorm/test/support/strfry-local-e2e.sh
set -euo pipefail

DBDIR=/tmp/strfry-e2e-db
CONF=/tmp/strfry-e2e.conf
export STRFRY_CONFIG="$CONF"

rm -rf "$DBDIR"; mkdir -p "$DBDIR"
cp /etc/strfry.conf "$CONF"
sed -i "s|^db = .*|db = \"$DBDIR/\"|" "$CONF"

cd /usr/local/lib/node_modules/brainstorm

fail() { echo "FAIL: $1" >&2; exit 1; }

count() { strfry scan --count "$1" 2>/dev/null; }

echo "strfry: $(which strfry)  config: $STRFRY_CONFIG  db: $DBDIR"
INITIAL=$(count '{"kinds":[0]}')
echo "initial kind-0 count in temp db: $INITIAL"
[ "$INITIAL" = "0" ] || fail "temp db not empty ($INITIAL)"

PRIV=$(node -e "const {generateSecretKey}=require('nostr-tools');process.stdout.write(Buffer.from(generateSecretKey()).toString('hex'))")
PUB=$(node -e "const {getPublicKey}=require('nostr-tools');process.stdout.write(getPublicKey(Uint8Array.from(Buffer.from('$PRIV','hex'))))")
echo "throwaway pubkey: ${PUB:0:12}…"

echo ""
echo "--- set npub-cash (empty relays → ONLY the real 'strfry import' runs) ---"
SET_JSON=$(node bin/receiving.js set npub-cash --nsec "$PRIV" --relays ',' --no-external --no-probe --json)
echo "$SET_JSON" | node -e 'const o=JSON.parse(require("fs").readFileSync(0));console.log("  field:",o.field,"value:",o.value);console.log("  local import:",JSON.stringify(o.local));process.exit(o.local&&o.local.success?0:1)' \
  || fail "local strfry import did not report success"

POST=$(count '{"kinds":[0]}')
echo "post-import kind-0 count: $POST"
[ "$POST" = "1" ] || fail "expected 1 event in strfry after import, got $POST"

echo ""
echo "--- show (──no-external → ONLY the real 'strfry scan' reads it back) ---"
SHOW_JSON=$(node bin/receiving.js show "$PUB" --no-external --json)
echo "$SHOW_JSON" | node -e '
const o=JSON.parse(require("fs").readFileSync(0));
const m=o.method;
console.log("  resolved:",m&&m.method,"value:",m&&m.value,"source:",o.source,"tracked:",m&&m.tracked);
if(!m||m.method!=="lud16") { console.error("  expected lud16 from local strfry"); process.exit(1); }
if(o.source!=="local") { console.error("  expected source=local, got "+o.source); process.exit(1); }
if(!String(m.value).endsWith("@npub.cash")) { console.error("  expected npub.cash address"); process.exit(1); }
' || fail "show did not read the imported profile back from strfry"

echo ""
echo "--- resolve (--no-external → real local scan → payout decision) ---"
node bin/receiving.js resolve "$PUB" --amount 1000 --no-external --json \
  | node -e 'const o=JSON.parse(require("fs").readFileSync(0));console.log("  payment:",JSON.stringify(o.payment));process.exit(o.payment.type==="bolt11"&&o.payment.tracked?0:1)' \
  || fail "resolve did not produce a tracked bolt11 decision"

echo ""
echo "--- switch: import a newer bolt12; strfry replaces the kind-0 (replaceable), offer wins ---"
sleep 1.1   # ensure a strictly-greater created_at so the new event wins (no same-second tie)
node bin/receiving.js set bolt12 'bitcoin:?lno=lno1pqps7sjqpgtyzm3qv4uxzmtsd3jjqer9wd3hy6tsw35k7msjz' --nsec "$PRIV" --relays ',' --no-external --no-probe --json >/dev/null
POST2=$(count '{"kinds":[0]}')
echo "kind-0 count after second import (replaceable → stays 1): $POST2"
SHOW2=$(node bin/receiving.js show "$PUB" --no-external --json)
echo "$SHOW2" | node -e 'const o=JSON.parse(require("fs").readFileSync(0));const m=o.method;console.log("  resolved now:",m&&m.method,"tracked:",m&&m.tracked);process.exit(m&&m.method==="bolt12"&&m.tracked===false?0:1)' \
  || fail "after importing a newer bolt12, show should resolve bolt12 (untracked)"

# cleanup temp db
rm -rf "$DBDIR" "$CONF"
echo ""
echo "STRFRY-LOCAL E2E: PASS"
