#!/bin/bash
# Router patch for strfry 1.1.0: honor a stream's configured `limit` on connect.
# Run from the Dockerfile after patches/strfry-redis/, with the strfry source dir as $1.
#
# strfry's router (src/apps/mesh/cmd_router.cpp, StreamGroup::connOpen) builds the REQ for a
# down/both stream from the configured filter, then always sets "limit" to 0, so a relay sends
# no stored events, only live ones. Anything published upstream while a stream was
# disconnected (deploys, restarts, dropped connections) was lost. This keeps a configured
# limit and sends 0 only when the filter has none:
#   absent -> 0 (live only, unchanged); present -> sent as-is (the relay caps it, strfry: 500).
# ADR relay-stream-gaps/0002. The same line is in strfry master, so a STRFRY_REF bump must
# re-verify this; the checks below fail the build loudly if the pattern stops matching.
set -e

STRFRY_DIR="${1:-.}"
TARGET="$STRFRY_DIR/src/apps/mesh/cmd_router.cpp"

echo "=== Applying router patches to strfry at $STRFRY_DIR ==="

if grep -q 'if (!filterToSend.find("limit"))' "$TARGET"; then
    echo "  Router limit patch already in cmd_router.cpp (skipping)"
    exit 0
fi

sed -i 's|^\( *\)filterToSend\["limit"\] = 0;|\1if (!filterToSend.find("limit")) filterToSend["limit"] = 0;|' "$TARGET"

# Verify: the patched line is there, and no bare `filterToSend["limit"] = 0;` line is left.
if ! grep -q 'if (!filterToSend.find("limit")) filterToSend\["limit"\] = 0;' "$TARGET" \
   || grep -q '^ *filterToSend\["limit"\] = 0;' "$TARGET"; then
    echo "ERROR: cmd_router.cpp limit patch failed — sed pattern did not match. Upstream may have changed." >&2
    exit 1
fi
echo "  Router streams now send their configured limit on connect (cmd_router.cpp)"

echo "=== Router patches applied successfully ==="
