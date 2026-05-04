#!/bin/bash
# Apply Redis integration patches to upstream strfry source.
# Run from the strfry source directory (e.g., /usr/local/src/strfry).
set -e

STRFRY_DIR="${1:-.}"
PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Applying Redis patches to strfry at $STRFRY_DIR ==="

# 1. Copy Redis source files
cp "$PATCH_DIR/redis.h" "$STRFRY_DIR/src/redis.h"
cp "$PATCH_DIR/redis.cpp" "$STRFRY_DIR/src/redis.cpp"
echo "  Copied redis.h and redis.cpp"

# 2. Add -lhiredis to linker flags in golpe/rules.mk
if ! grep -q "lhiredis" "$STRFRY_DIR/golpe/rules.mk"; then
    sed -i 's/-ldl -pthread/-lhiredis -ldl -pthread/' "$STRFRY_DIR/golpe/rules.mk"
    echo "  Added -lhiredis to golpe/rules.mk"
else
    echo "  -lhiredis already in golpe/rules.mk (skipping)"
fi

# 3. Add Redis config entries to golpe.yaml
if ! grep -q "redis__host" "$STRFRY_DIR/golpe.yaml"; then
    cat >> "$STRFRY_DIR/golpe.yaml" << 'YAML'

  - name: redis__host
    desc: "Redis hostname or IP"
    default: "localhost"
    noReload: true

  - name: redis__port
    desc: "Redis TCP port"
    default: 6379
    noReload: true
YAML
    echo "  Added redis__host and redis__port to golpe.yaml"
else
    echo "  Redis config already in golpe.yaml (skipping)"
fi

# 4. Add redis_init() call to golpe/main.cpp.tt
if ! grep -q "redis_init" "$STRFRY_DIR/golpe/main.cpp.tt"; then
    # Add #include at the top of the file (after the first #include)
    sed -i '0,/#include/{s/#include/#include "redis.h"\n#include/}' "$STRFRY_DIR/golpe/main.cpp.tt"

    # Insert redis_init AFTER loadConfig (inside run(), where cfg() is available).
    # Match prefix "loadConfig(configFile" so this works against both upstream's
    # historical 1-arg signature and current 2-arg signature.
    sed -i '/loadConfig(configFile/a\
\
    // Initialize Redis connection for streaming ETL\
    if (redis_init(cfg().redis__host.c_str(), cfg().redis__port) != 0) {\
        LW << "Failed to connect to Redis — streaming ETL disabled";\
    }' "$STRFRY_DIR/golpe/main.cpp.tt"

    # Verify the insertion actually landed — sed silently no-ops on no-match.
    if ! grep -q "redis_init" "$STRFRY_DIR/golpe/main.cpp.tt"; then
        echo "ERROR: redis_init insertion in golpe/main.cpp.tt failed — sed pattern did not match. Upstream signature may have changed again." >&2
        exit 1
    fi
    echo "  Added redis.h include and redis_init() to golpe/main.cpp.tt"
else
    echo "  redis_init already in golpe/main.cpp.tt (skipping)"
fi

# 5. Add Redis integration to WriterPipeline.h
if ! grep -q "redis_rpush" "$STRFRY_DIR/src/WriterPipeline.h"; then
    # Add includes after the existing includes
    sed -i '/#include "events.h"/a\
#include "redis.h"\
#include <unordered_set>\
\
static const std::unordered_set<uint64_t> REDIS_ALLOW_KINDS = {\
    3, 10000, 1984\
};' "$STRFRY_DIR/src/WriterPipeline.h"

    # Add redis_rpush call after "written++;" in the writer loop
    sed -i '/written++;/a\
\
                            // Push WoT-relevant events to Redis for streaming ETL\
                            {\
                                PackedEventView packed_redis(ev.packedStr);\
                                auto kind = packed_redis.kind();\
                                if (REDIS_ALLOW_KINDS.contains(kind)) {\
                                    redis_rpush("strfry:events", ev.jsonStr.c_str());\
                                }\
                            }' "$STRFRY_DIR/src/WriterPipeline.h"

    # Verify both insertions actually landed.
    if ! grep -q "REDIS_ALLOW_KINDS" "$STRFRY_DIR/src/WriterPipeline.h" \
       || ! grep -q "redis_rpush" "$STRFRY_DIR/src/WriterPipeline.h"; then
        echo "ERROR: WriterPipeline.h patch failed — sed pattern did not match. Upstream may have changed." >&2
        exit 1
    fi
    echo "  Added Redis integration to WriterPipeline.h"
else
    echo "  Redis already in WriterPipeline.h (skipping)"
fi

echo "=== Redis patches applied successfully ==="
