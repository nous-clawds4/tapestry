# Neo4j Optimization in Tapestry

**Status:** Reference documentation
**Applies to:** Neo4j Community Edition 5.26.10, as pinned in
[`Dockerfile`](../Dockerfile) line 34.
**Related docs:** [ARCHITECTURE.md](ARCHITECTURE.md),
[CONFIGURATION.md](CONFIGURATION.md)

## 1. Overview

A Tapestry instance runs Neo4j co-resident with Meilisearch, strfry, Redis,
Nginx, and the Node.js application server, all inside a single container on
a single VM. Each of those services has a non-trivial memory footprint, so
Neo4j's memory allocation cannot simply grab "most of RAM" the way a
dedicated database host would.

The optimization philosophy is:

1. **Dynamic, RAM-aware.** Memory, page cache, transaction caps, and
   concurrency are calculated from `/proc/meminfo` and `nproc` every time
   the container starts, so a 4 GB droplet, a 16 GB VM, and a 32 GB
   Digital Ocean box all get sensible settings without operator action.
2. **Co-tenant first.** A fixed block of RAM is reserved for the other
   services *before* Neo4j is sized, with reservation bins that reflect
   empirical measurements on a 32 GB reference instance with ~2.6M Nostr
   profiles.
3. **Community Edition only.** No features that require Enterprise
   (off-heap cache, multi-database clustering, continuous backups) are
   relied on.
4. **Applied at container startup, not at build time.** The Docker image
   contains a generic `neo4j.conf`; the real tuning is written by
   [`docker/entrypoint.sh`](../docker/entrypoint.sh) on each `docker run`,
   which means `docker run` onto any size box "just works."

A separate, legacy path (`setup/install-neo4j.sh`) tunes Neo4j for
bare-metal Linux installs. That path is static, hardcoded for 32 GB, and
is documented below for completeness, but the Docker path is the
production path on tapestry.brainstorm.world.

## 2. What we tune

The parameters Tapestry explicitly sets (in either path) are:

### Memory

- `server.memory.heap.initial_size`
- `server.memory.heap.max_size`
- `server.memory.pagecache.size`
- `dbms.memory.transaction.total.max`

### Concurrency

- `db.transaction.concurrent.maximum`

### Garbage collection and OOM handling

- `server.jvm.additional=-XX:+UseG1GC`
- `server.jvm.additional=-XX:G1HeapRegionSize=16m`
- `server.jvm.additional=-XX:G1NewSizePercent=20`
- `server.jvm.additional=-XX:G1MaxNewSizePercent=40`
- `server.jvm.additional=-XX:+ExitOnOutOfMemoryError`
- `server.jvm.additional=-XX:+HeapDumpOnOutOfMemoryError`
- `server.jvm.additional=-XX:HeapDumpPath=/var/log/brainstorm/`

### Diagnostics (bare-metal installer only — not in Docker)

- `server.jvm.additional=-XX:NativeMemoryTracking=detail`
- `server.jvm.additional=-XX:+UnlockDiagnosticVMOptions`
- `server.jvm.additional=-XX:+PrintNMTStatistics`
- `server.logs.gc.enabled=true`

### Security / plugins

- `dbms.security.procedures.unrestricted=gds.*`
- `dbms.security.procedures.allowlist=apoc.coll.*,apoc.load.*,apoc.periodic.*,apoc.export.json.query,gds.*`

### Network

- `server.default_listen_address=0.0.0.0`
- `server.bolt.listen_address=0.0.0.0:7687`
- `server.http.listen_address=0.0.0.0:7474`

### Commonly-considered parameters we **do not** currently set

These come up in the context of Neo4j tuning but are left at defaults
today. They reappear in §9 and §10 as candidates for a future change.

- `dbms.query.statementQueryTimeout` / `db.transaction.timeout` (query
  timeouts)
- `db.memory.transaction.max` (per-transaction cap)
- `db.tx_log.rotation.retention_policy` (transaction log retention)
- `server.memory.off_heap.max_size`
- `server.metrics.enabled` and the Prometheus exporter
- Relationship-property indexes (e.g. on `FOLLOWS.timestamp`)

## 3. Neo4j Community Edition defaults

These are the values you inherit if you install the `neo4j=1:5.26.x`
package and do nothing. Refer to the authoritative
[Neo4j 5 configuration reference](https://neo4j.com/docs/operations-manual/5/reference/configuration-settings/)
for the live list; values below match Neo4j 5.26 at the time of writing
and are spot-checked against the shipped `neo4j.conf`.

| Parameter                               | Default (Community 5.26)                                                   |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `server.memory.heap.initial_size`       | Ships commented out; if unset, Neo4j auto-computes based on system RAM     |
| `server.memory.heap.max_size`           | Ships commented out; if unset, Neo4j auto-computes (often ~1–2 GB capped)  |
| `server.memory.pagecache.size`          | Ships commented out; if unset, Neo4j uses ~50 % of (RAM − heap)            |
| `dbms.memory.transaction.total.max`     | `0` — unlimited                                                            |
| `db.memory.transaction.max`             | `0` — unlimited per transaction                                            |
| `db.transaction.concurrent.maximum`     | `1000`                                                                     |
| `db.transaction.timeout`                | `0` — no timeout                                                           |
| `db.tx_log.rotation.retention_policy`   | `2 days 2G`                                                                |
| `server.logs.gc.enabled`                | `false`                                                                    |
| `server.memory.off_heap.max_size`       | `0` — off-heap caching disabled in Community                               |
| `server.default_listen_address`         | `localhost`                                                                |
| `server.bolt.listen_address`            | `localhost:7687`                                                           |
| `server.http.listen_address`            | `localhost:7474`                                                           |
| `dbms.security.procedures.unrestricted` | (empty — nothing is unrestricted)                                          |
| `dbms.security.procedures.allowlist`    | (empty — everything is allowed unless unrestricted overrides apply)        |
| GC algorithm                            | G1GC (Java 17 default); Neo4j does not override                            |
| `-XX:+ExitOnOutOfMemoryError`           | Not set                                                                    |
| `-XX:+HeapDumpOnOutOfMemoryError`       | Not set                                                                    |

The important takeaway: **Neo4j out of the box will auto-size memory, but
the auto-sized values are conservative and do not account for other
services on the same machine.** If a 32 GB box is running Neo4j alongside
Meilisearch, Neo4j's auto-sizer will happily allocate memory that
Meilisearch also wants.

## 4. Data scale and workload

The tunings below are motivated by what the Neo4j process on a Tapestry
instance actually has to do. From
[`docker/entrypoint.sh`](../docker/entrypoint.sh) lines 173–175:

```bash
# Reserve memory for other services (Meilisearch, strfry, Redis, Node.js, OS).
# Empirical measurements on 32GB/2.6M profiles: Meilisearch uses ~6GB,
# strfry ~1-2GB, Node.js ~0.5GB, OS ~1-2GB = ~10-12GB total.
```

Shape of the graph, summarized from
[`setup/neo4jConstraintsAndIndexes.sh`](../setup/neo4jConstraintsAndIndexes.sh)
lines 43–78 and the data model described in [BIBLE.md](../BIBLE.md):

- **`NostrUser`** — one node per unique pubkey; on a 32 GB reference
  instance, ~2.6M of these.
- **`NostrEvent`** — one per imported Nostr event; indexed by `id`,
  `uuid`, and `kind`.
- **`NostrUserWotMetricsCard`** — per (observer, observee) trust
  scorecard; bounded by `NostrUser²` but sparsely populated.
- **Concept graph** — `ListHeader`, `ListItem`, `Superset`, `Set`,
  `Property`, `JSONSchema`, `ClassThreadHeader`.

Relationship types (per [BIBLE.md](../BIBLE.md)):

- Social-graph / WoT: `FOLLOWS`, `MUTES`, `REPORTS`, `AUTHORED`.
- Concept graph: `IS_THE_CONCEPT_FOR`, `IS_A_SUPERSET_OF`, `HAS_ELEMENT`,
  `ENUMERATES`, `IS_A_PROPERTY_OF`, plus the various `IS_THE_*_FOR`
  wiring edges.

**Workload profile:**

- **Bulk ingest** — `apoc.periodic.iterate` with batch sizes 250–500,
  from [`src/pipeline/batch/processNostrEvents.sh`](../src/pipeline/batch/processNostrEvents.sh).
  Runs every 12 hours
  (`BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL="12hours"`).
- **Streaming ingest** — Redis-backed queue, small batches applied as
  Nostr events arrive. Near real-time.
- **Compute-heavy algorithms** — per-customer personalized GrapeRank (up
  to 60 iterations, convergence 0.001), GDS PageRank over the entire
  `FOLLOWS` graph, NIP-85 kind-30382 publishing that scans
  `NostrUser.hops < 20`.
- **API reads** — Bolt queries backing the UI and the
  `/api/neo4j-config/overview` endpoint.

**Co-tenants on the same VM:**

| Service     | Footprint on 32 GB / 2.6M reference | Role                            |
| ----------- | ----------------------------------- | ------------------------------- |
| Meilisearch | 6–8 GB                              | Full-text profile search        |
| strfry      | 1–2 GB LMDB                         | Canonical Nostr event store     |
| Redis       | ~50 MB                              | ETL queue                       |
| Node.js     | ~0.5 GB                             | Application server, workers     |
| OS + Nginx  | 1–2 GB                              | kernel, page cache, TLS         |

## 5. What happens if we ship the defaults

Concrete failure modes operators would hit on tapestry.brainstorm.world if the
entire §2 block of tunings were removed:

1. **Heap too small for GrapeRank.** With Neo4j's auto-sized heap on a
   32 GB box, the heap often lands around 1–2 GB. A GrapeRank iteration
   over 2.6M users materializes large intermediate maps; the heap fills,
   G1 thrashes, and the JVM eventually throws `OutOfMemoryError`.
2. **Page cache too small for the hot graph.** Without a pinned
   `server.memory.pagecache.size`, Neo4j splits what's left of RAM
   between heap and cache by heuristic, not knowing that Meilisearch
   will later demand 6–8 GB. The `FOLLOWS` traversal set no longer fits
   in cache; traversals fall back to disk page-faults; latency rises
   into the tens of seconds.
3. **Unbounded transaction memory.** The default
   `dbms.memory.transaction.total.max=0` means a single runaway
   `apoc.periodic.iterate` or a pathological Cypher query can starve
   every other transaction and force full GCs under load.
4. **OOM leaves the JVM limping.** Without `-XX:+ExitOnOutOfMemoryError`,
   the JVM can stay "alive" in a degraded state after an OOM — half of
   the ingest pipeline hangs, supervisord does not restart Neo4j, and
   the operator sees a black-hole instance instead of a clean crash-loop
   they can diagnose.
5. **No heap dump on OOM.** Without `-XX:+HeapDumpOnOutOfMemoryError`
   and `HeapDumpPath`, post-mortem analysis of the OOM has nothing to
   work with.
6. **oom_killer collisions.** Neo4j's auto-sizer does not know
   Meilisearch is coming. On a 32 GB box Neo4j may allocate ~12 GB heap
   + ~12 GB cache, then Meilisearch tries to mmap 8 GB, and the kernel
   oom_killer picks whichever process has the largest resident set —
   often Neo4j.
7. **Bolt binds to localhost.** Default
   `server.default_listen_address=localhost` means the application
   server in the same network namespace can reach Neo4j, but nothing
   else. For the Dockerized deployment where Bolt and HTTP are used
   across the container boundary, this is a breakage, not a tuning.
8. **GDS and APOC procedures not allowed.** The default empty allowlist
   and empty unrestricted list mean GDS algorithms (`gds.*`) and APOC
   helpers (`apoc.periodic.iterate`, `apoc.coll.*`, etc.) refuse to
   run — every Brainstorm algorithm job fails at the call boundary.

## 6. The Docker entrypoint path (primary)

All code in this section is from
[`docker/entrypoint.sh`](../docker/entrypoint.sh). The header is lines
165–167:

```bash
# ── Dynamic Neo4j memory, GC, and concurrency configuration ──
# Detects system RAM and CPU count at startup, calculates optimal settings.
# Reserves memory for other services (Meilisearch, strfry, Redis, Node.js, OS).
```

### 6.1 RAM bin selection and reservation — lines 169–188

**Rule in English:** look at `/proc/meminfo`; bin the machine as large
(≥ 24 GB), medium (12–24 GB), or small (< 12 GB); reserve a fixed
amount for everything that is not Neo4j; and refuse to give Neo4j
less than 1 GB.

```bash
TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_MEM_MB=$((TOTAL_MEM_KB / 1024))
NUM_CPUS=$(nproc)

# Empirical measurements on 32GB/2.6M profiles: Meilisearch uses ~6GB,
# strfry ~1-2GB, Node.js ~0.5GB, OS ~1-2GB = ~10-12GB total.
if [ "$TOTAL_MEM_MB" -ge 24000 ]; then
  RESERVED_MB=12000    # 12GB on large machines (≥24GB) — Meilisearch needs 6-8GB alone
elif [ "$TOTAL_MEM_MB" -ge 12000 ]; then
  RESERVED_MB=7000     # 7GB on medium machines (12-24GB)
else
  RESERVED_MB=3500     # 3.5GB on small machines (<12GB)
fi

AVAILABLE_MB=$((TOTAL_MEM_MB - RESERVED_MB))
if [ "$AVAILABLE_MB" -lt 1024 ]; then
  AVAILABLE_MB=1024
fi
```

### 6.2 Heap / page cache / transaction split — lines 190–192

**Rule in English:** split the memory available to Neo4j 40 % into JVM
heap, 40 % into the native page cache, and cap transaction memory at
half the heap. The remaining 20 % is a headroom buffer for JVM
metaspace, direct byte buffers, native allocations, and the kernel.

```bash
NEO4J_HEAP_MB=$((AVAILABLE_MB * 40 / 100))
NEO4J_CACHE_MB=$((AVAILABLE_MB * 40 / 100))
NEO4J_TX_MAX_MB=$((NEO4J_HEAP_MB * 50 / 100))
```

### 6.3 Concurrent transaction cap — lines 194–195

**Rule in English:** allow at most ~100 concurrent transactions per CPU
core. On the 32 GB / 8-core reference box this is 800 — well above any
steady-state workload but bounded so a runaway client cannot open tens
of thousands of sessions.

```bash
# Concurrent transaction limit: ~100 per CPU core
NEO4J_CONCURRENT_MAX=$((NUM_CPUS * 100))
```

### 6.4 Idempotent cleanup — lines 204–214

**Rule in English:** before writing new settings, delete every line in
`/etc/neo4j/neo4j.conf` that could conflict with what this run is about
to write. This is what makes the tuning safe to re-apply on every
container start — including after an operator has manually edited the
config.

```bash
# Remove any existing memory/GC settings (from Dockerfile or previous runs)
sed -i '/^server.memory.heap/d' /etc/neo4j/neo4j.conf
sed -i '/^server.memory.pagecache/d' /etc/neo4j/neo4j.conf
sed -i '/^dbms.memory.transaction/d' /etc/neo4j/neo4j.conf
sed -i '/^db.transaction.concurrent/d' /etc/neo4j/neo4j.conf
sed -i '/^server.jvm.additional=-XX:.*G1/d' /etc/neo4j/neo4j.conf
sed -i '/^server.jvm.additional=-XX:+UseG1GC/d' /etc/neo4j/neo4j.conf
sed -i '/^server.jvm.additional=-XX:+ExitOnOutOfMemoryError/d' /etc/neo4j/neo4j.conf
sed -i '/^server.jvm.additional=-XX:+HeapDumpOnOutOfMemoryError/d' /etc/neo4j/neo4j.conf
sed -i '/^# Dynamic Neo4j settings/d' /etc/neo4j/neo4j.conf
sed -i '/^# Memory settings for Docker/d' /etc/neo4j/neo4j.conf
```

### 6.5 Write the memory block — lines 217–225

```bash
cat >> /etc/neo4j/neo4j.conf << NEO4JMEM

# Dynamic Neo4j settings (calculated at startup by entrypoint.sh)
server.memory.heap.initial_size=${NEO4J_HEAP_MB}m
server.memory.heap.max_size=${NEO4J_HEAP_MB}m
server.memory.pagecache.size=${NEO4J_CACHE_MB}m
dbms.memory.transaction.total.max=${NEO4J_TX_MAX_MB}m
db.transaction.concurrent.maximum=${NEO4J_CONCURRENT_MAX}
NEO4JMEM
```

Note that `heap.initial_size == heap.max_size`. Setting both equal
avoids JVM heap-resize pauses during GrapeRank and PageRank; the heap
is committed up front.

### 6.6 Conditional GC block — lines 227–246

**Rule in English:** if the heap is large enough for G1 to be worth the
overhead (≥ 4 GB), turn on G1GC and install the OOM-exit / heap-dump
handlers. If the heap is large enough to benefit from tuned G1 region
sizing (≥ 8 GB), also pin region size to 16 MB and set new-generation
bounds. Below 4 GB, only the OOM-exit handler is kept; the default GC
is cheaper on small heaps.

```bash
if [ "$NEO4J_HEAP_MB" -ge 4096 ]; then
  cat >> /etc/neo4j/neo4j.conf << G1GCCONF
server.jvm.additional=-XX:+UseG1GC
server.jvm.additional=-XX:+ExitOnOutOfMemoryError
server.jvm.additional=-XX:+HeapDumpOnOutOfMemoryError
server.jvm.additional=-XX:HeapDumpPath=/var/log/brainstorm/
G1GCCONF
  if [ "$NEO4J_HEAP_MB" -ge 8192 ]; then
    echo "server.jvm.additional=-XX:G1HeapRegionSize=16m" >> /etc/neo4j/neo4j.conf
    echo "server.jvm.additional=-XX:G1NewSizePercent=20" >> /etc/neo4j/neo4j.conf
    echo "server.jvm.additional=-XX:G1MaxNewSizePercent=40" >> /etc/neo4j/neo4j.conf
  fi
  echo "  G1GC enabled (heap ≥ 4GB)"
else
  echo "server.jvm.additional=-XX:+ExitOnOutOfMemoryError" >> /etc/neo4j/neo4j.conf
  echo "  Default GC (heap < 4GB)"
fi
```

### 6.7 Static configuration baked into the image

Separate from the dynamic block, [`Dockerfile`](../Dockerfile) lines
45–62 set the network listeners and plugin allowlists at image-build
time:

```docker
RUN sed -i 's/#server.default_listen_address=0.0.0.0/server.default_listen_address=0.0.0.0/' /etc/neo4j/neo4j.conf \
    && sed -i 's/#server.bolt.listen_address=:7687/server.bolt.listen_address=0.0.0.0:7687/' /etc/neo4j/neo4j.conf \
    && sed -i 's/#server.http.listen_address=:7474/server.http.listen_address=0.0.0.0:7474/' /etc/neo4j/neo4j.conf \
    && ...
    && echo "dbms.security.procedures.unrestricted=gds.*" >> /etc/neo4j/neo4j.conf \
    && ...
    && echo "dbms.security.procedures.allowlist=apoc.coll.*,apoc.load.*,apoc.periodic.*,apoc.export.json.query,gds.*" >> /etc/neo4j/neo4j.conf
    # Note: Memory, GC, and concurrency settings are configured dynamically at runtime
    # by entrypoint.sh based on the actual machine's RAM and CPU count.
```

### 6.8 Worked example: 32 GB / 8 CPU

For the tapestry.brainstorm.world reference box:

| Quantity                     | Formula                          | Value      |
| ---------------------------- | -------------------------------- | ---------- |
| `TOTAL_MEM_MB`               | `/proc/meminfo`                  | ~32 000 MB |
| `RESERVED_MB` (≥ 24 GB bin)  | constant                         | 12 000 MB  |
| `AVAILABLE_MB`               | `TOTAL − RESERVED`               | ~20 000 MB |
| `NEO4J_HEAP_MB`              | `AVAILABLE × 40 %`               | ~8 000 MB  |
| `NEO4J_CACHE_MB`             | `AVAILABLE × 40 %`               | ~8 000 MB  |
| `NEO4J_TX_MAX_MB`            | `HEAP × 50 %`                    | ~4 000 MB  |
| `NEO4J_CONCURRENT_MAX`       | `CPUs × 100`                     | 800        |
| GC branch taken              | heap ≥ 8 GB → full G1 tuning     | yes        |

For a 4 GB Digital Ocean droplet with 2 vCPUs:

| Quantity                     | Formula                          | Value      |
| ---------------------------- | -------------------------------- | ---------- |
| `TOTAL_MEM_MB`               | `/proc/meminfo`                  | ~4 000 MB  |
| `RESERVED_MB` (< 12 GB bin)  | constant                         | 3 500 MB   |
| `AVAILABLE_MB`               | floored at 1 024                 | 1 024 MB   |
| `NEO4J_HEAP_MB`              | `AVAILABLE × 40 %`               | ~409 MB    |
| `NEO4J_CACHE_MB`             | `AVAILABLE × 40 %`               | ~409 MB    |
| GC branch taken              | heap < 4 GB → default GC + OOM   | default GC |

The 1 GB floor is there so tiny boxes at least start; the 409 MB heap
is clearly too small for any real workload, and this is expected — a
4 GB droplet is a dev box, not a production tapestry.brainstorm.world.

## 7. The bare-metal installer (legacy)

[`setup/install-neo4j.sh`](../setup/install-neo4j.sh) is the historical
path for installing Tapestry directly onto a Linux host (no Docker). It
is wrapped in a guard at line 165 so it only appends configuration
once:

```bash
if ! grep -q "Brainstorm Neo4j Configuration Additions" "$NEO4J_CONF"; then
  update_neo4j_conf
fi
```

### 7.1 Memory tuning is 32 GB-only — lines 117–142

Unlike the Docker path, this script only writes memory settings if the
box happens to be 32 GB:

```bash
# determine system memory of current configuration
SYSTEM_MEMORY=$(grep MemTotal /proc/meminfo | awk '{print $2}')

# only do this if system memory is approximately 32GB
# check if SYSTEM_MEMORY is between 29GB and 35GB
if [ "$SYSTEM_MEMORY" -ge 29000000 ] && [ "$SYSTEM_MEMORY" -le 35000000 ]; then
  echo "# Memory configuration for 32GB server" >> "$NEO4J_CONF"
  echo "server.memory.heap.initial_size=11700m" >> "$NEO4J_CONF"
  echo "server.memory.heap.max_size=11700m" >> "$NEO4J_CONF"
  echo "server.memory.pagecache.size=12000m" >> "$NEO4J_CONF"
  echo "" >> "$NEO4J_CONF"
fi
```

The static 32 GB values (11 700 MB heap, 12 000 MB page cache) sum to
23.7 GB of Neo4j-owned memory — tighter than the Docker split on the
same box (~8 GB / ~8 GB = 16 GB). The bare-metal tuning assumes
Meilisearch is not co-resident or is smaller than on a typical
tapestry.brainstorm.world deployment; running this on a 32 GB host that also
runs Meilisearch would starve it.

**On any other RAM size the bare-metal installer leaves memory
unconfigured** — Neo4j falls back to the Community auto-sizer described
in §3.

### 7.2 G1GC and OOM handling — lines 130–142

Enabled unconditionally, not gated on heap size like the Docker path:

```bash
echo "# JVM configuration with G1GC tuning" >> "$NEO4J_CONF"
echo "server.jvm.additional=-XX:+UseG1GC" >> "$NEO4J_CONF"
echo "server.jvm.additional=-XX:+ExitOnOutOfMemoryError" >> "$NEO4J_CONF"
echo "server.jvm.additional=-XX:+HeapDumpOnOutOfMemoryError" >> "$NEO4J_CONF"
echo "server.jvm.additional=-XX:HeapDumpPath=/var/log/neo4j/" >> "$NEO4J_CONF"
```

Note the heap-dump path (`/var/log/neo4j/`) differs from the Docker
path (`/var/log/brainstorm/`).

### 7.3 Native Memory Tracking and GC logging — lines 147–155

Present in the bare-metal installer but **absent from the Docker
entrypoint**:

```bash
echo "server.jvm.additional=-XX:NativeMemoryTracking=detail" >> "$NEO4J_CONF"
echo "server.jvm.additional=-XX:+UnlockDiagnosticVMOptions" >> "$NEO4J_CONF"
echo "server.jvm.additional=-XX:+PrintNMTStatistics" >> "$NEO4J_CONF"
...
echo "server.logs.gc.enabled=true" >> "$NEO4J_CONF"
```

These are diagnostic-only and zero-to-low overhead. The Docker path
lost them during a refactor; §9 flags this as a grounded
recommendation.

## 8. Monitoring and runtime introspection

Runtime observability that depends on the §6 tunings being in place:

- **System resource monitor** —
  [`src/manage/healthMonitor/systemResourceMonitor.sh`](../src/manage/healthMonitor/systemResourceMonitor.sh)
  lines 42–49 use these thresholds:

  ```bash
  NEO4J_MEMORY_THRESHOLD_MB=1024
  NEO4J_HEAP_WARNING_PERCENT=80
  NEO4J_HEAP_CRITICAL_PERCENT=95
  SYSTEM_MEMORY_WARNING_PERCENT=85
  SYSTEM_MEMORY_CRITICAL_PERCENT=95
  DISK_WARNING_PERCENT=85
  DISK_CRITICAL_PERCENT=95
  ```

- **Crash-pattern detector** —
  [`src/manage/healthMonitor/neo4jCrashPatternDetector.sh`](../src/manage/healthMonitor/neo4jCrashPatternDetector.sh)
  greps Neo4j logs for `OutOfMemoryError` and recommends a heap bump.
  The `-XX:+HeapDumpOnOutOfMemoryError` flag we set in §6.6 is what
  makes the dump available when this fires.

- **Live configuration API** —
  [`src/api/neo4j-config/index.js`](../src/api/neo4j-config/index.js)
  serves `GET /api/neo4j-config/overview`, which parses the running
  `neo4j.conf`, runs `neo4j-admin server memory-recommendation`, and
  reports both sides. If the operator wants to know "is Neo4j tuned
  right for this box?", this endpoint is the single answer.

## 9. Grounded recommendations

Changes with clear evidence. These are *not* implemented in this
documentation change; they are listed here so a follow-up change can
pick them up.

### 9.1 Port NMT and GC logging into the Docker path

The bare-metal installer enables Native Memory Tracking and GC logging
(§7.3); the Docker entrypoint does not. Both are near-zero overhead and
are exactly what an operator needs when diagnosing an OOM on
tapestry.brainstorm.world. Adding the four lines to `docker/entrypoint.sh`
would give Docker parity with bare-metal.

### 9.2 Set a query / transaction timeout

`dbms.query.statementQueryTimeout` (equivalently `db.transaction.timeout`
in 5.x) defaults to unlimited. A single stuck Cypher today can hold a
transaction open indefinitely, blocking APOC ingest batches behind
lock-wait. A 10-minute default (`db.transaction.timeout=10m`) is long
enough for GrapeRank and PageRank but bounded enough to surface
pathological queries.

### 9.3 Add a per-transaction memory cap

`dbms.memory.transaction.total.max` (which we set, §6.5) bounds the
aggregate across all concurrent transactions. It does not stop a
*single* runaway transaction from consuming that entire budget. Adding
`db.memory.transaction.max=${NEO4J_TX_MAX_MB / 4}m` (or similar) would
fence each transaction to a fraction of the total, turning a single
bad query into a failed query instead of a stall of the whole DB.

### 9.4 Shrink tx log retention

The default `db.tx_log.rotation.retention_policy=2 days 2G` is sized
for Enterprise point-in-time recovery workflows Tapestry does not use
(Community cannot do online PITR). The commented-out line in
[`setup/install-neo4j.sh`](../setup/install-neo4j.sh) lines 160–161
already contemplates `1 hours 100M`:

```bash
# sed -i 's/db.tx_log.rotation.retention_policy=2 days 2G/db.tx_log.rotation.retention_policy=1 hours 100M/' "$NEO4J_CONF"
```

This should be reinstated and ported to the Docker path. Upside: less
disk I/O from log rotation, smaller `data/` volume.

### 9.5 Mirror OOM handling across the small-heap branch

§6.6 writes the heap-dump flag only on the ≥ 4 GB branch. The small-heap
branch only gets `-XX:+ExitOnOutOfMemoryError`. Small heaps OOM *more*
often than large ones, so they are the case where a heap dump is most
useful. Add `-XX:+HeapDumpOnOutOfMemoryError` and the
`HeapDumpPath=/var/log/brainstorm/` line to the else-branch too.

## 10. Exploratory recommendations — worth benchmarking

Ideas with plausible upside but no existing measurement to stand on.
Label them clearly as such in any follow-up work.

### 10.1 Rebalance the heap / page-cache split

Current split is 40 / 40. Neo4j's own operations manual recommends
page cache ≥ working set when the graph does not fit in RAM. As the
`FOLLOWS` graph grows past ~10M edges on a 32 GB box, more of
`AVAILABLE` should go to the page cache. A 30 / 50 (heap / cache)
split is a reasonable experiment; measure GrapeRank time and p99 Bolt
latency before and after.

### 10.2 Revisit the 100-per-core concurrent cap

On an 8-core box this is 800 concurrent transactions. The actual
workload is dominated by sequential algorithm runs (GrapeRank, PageRank,
NIP-85) and a small number of Bolt sessions. Dropping to 10 × cores
may reduce lock contention and metaspace pressure without losing
throughput.

### 10.3 Turn on metrics export

`server.metrics.enabled=true` plus the Prometheus exporter gives
longitudinal trend data instead of the point-in-time snapshots the
`/api/neo4j-config/overview` endpoint currently serves. Useful for
noticing a slow drift in heap utilization weeks before it becomes a
page-out event.

### 10.4 Relationship-property indexes

The current schema indexes `NostrUser` properties but not relationship
properties. Once a feature needs time-windowed WoT queries (e.g.
"who followed X in the last 30 days"), an index on `FOLLOWS.timestamp`
would pay off. Cheap to add.

### 10.5 Off-heap caching

`server.memory.off_heap.max_size` is an Enterprise-ish optimization
that can stabilize G1 pause times on large caches by moving cache data
off heap. Worth a benchmark if p99 latency becomes a concern.

## 11. Quick reference

Full parameter grid: default vs. what we ship, with a pointer to the
code that writes it.

| Parameter                                   | Community default      | Tapestry value                                   | Rationale                                             | Code pointer                            |
| ------------------------------------------- | ---------------------- | ------------------------------------------------ | ----------------------------------------------------- | --------------------------------------- |
| `server.memory.heap.initial_size`           | auto-sized, often 1–2G | `AVAILABLE × 40 %` (Docker) / `11700m` (32 GB bare-metal) | Pre-committed heap; avoid resize pauses in GrapeRank | `docker/entrypoint.sh:220`, `setup/install-neo4j.sh:124` |
| `server.memory.heap.max_size`               | same as above          | same as `initial_size`                           | Equal min = max; avoid resize pauses                  | `docker/entrypoint.sh:221`              |
| `server.memory.pagecache.size`              | auto, ~50 % of (RAM−heap) | `AVAILABLE × 40 %` (Docker) / `12000m` (bare-metal) | Keep hot FOLLOWS graph in RAM                    | `docker/entrypoint.sh:222`              |
| `dbms.memory.transaction.total.max`         | `0` (unlimited)        | `HEAP × 50 %`                                    | Fence runaway APOC batches                            | `docker/entrypoint.sh:223`              |
| `db.transaction.concurrent.maximum`         | `1000`                 | `CPUs × 100`                                     | Bounded concurrency                                   | `docker/entrypoint.sh:224`              |
| `-XX:+UseG1GC`                              | JDK 17 default         | on if heap ≥ 4 GB                                | Pause-time targeted GC                                | `docker/entrypoint.sh:230`              |
| `-XX:G1HeapRegionSize`                      | auto                   | `16m` if heap ≥ 8 GB                             | Tuned region size for our heap range                  | `docker/entrypoint.sh:237`              |
| `-XX:G1NewSizePercent`                      | `5`                    | `20` if heap ≥ 8 GB                              | Short-lived GrapeRank allocations                     | `docker/entrypoint.sh:238`              |
| `-XX:G1MaxNewSizePercent`                   | `60`                   | `40` if heap ≥ 8 GB                              | Leave room for long-lived cache                       | `docker/entrypoint.sh:239`              |
| `-XX:+ExitOnOutOfMemoryError`               | off                    | on                                               | Let supervisord restart cleanly                       | `docker/entrypoint.sh:231,244`          |
| `-XX:+HeapDumpOnOutOfMemoryError`           | off                    | on if heap ≥ 4 GB                                | Post-mortem analysis                                  | `docker/entrypoint.sh:232`              |
| `-XX:HeapDumpPath`                          | cwd                    | `/var/log/brainstorm/`                           | Pinned dump location                                  | `docker/entrypoint.sh:233`              |
| `-XX:NativeMemoryTracking`                  | off                    | `detail` (bare-metal only)                       | Diagnose native leaks                                 | `setup/install-neo4j.sh:148`            |
| `server.logs.gc.enabled`                    | `false`                | `true` (bare-metal only)                         | Forensic GC logs                                      | `setup/install-neo4j.sh:155`            |
| `dbms.security.procedures.unrestricted`     | empty                  | `gds.*`                                          | Let GDS algorithms run                                | `Dockerfile:53`, `setup/install-neo4j.sh:86` |
| `dbms.security.procedures.allowlist`        | empty                  | `apoc.coll.*,apoc.load.*,apoc.periodic.*,apoc.export.json.query,gds.*` | Allow APOC + GDS                 | `Dockerfile:56`, `setup/install-neo4j.sh:94` |
| `server.default_listen_address`             | `localhost`            | `0.0.0.0`                                        | Reachable across container boundary                   | `Dockerfile:46`, `setup/install-neo4j.sh:77` |
| `server.bolt.listen_address`                | `:7687` / localhost    | `0.0.0.0:7687`                                   | Bolt reachable                                        | `Dockerfile:47`, `setup/install-neo4j.sh:78` |
| `server.http.listen_address`                | `:7474` / localhost    | `0.0.0.0:7474`                                   | HTTP reachable                                        | `Dockerfile:48`, `setup/install-neo4j.sh:79` |
| `db.transaction.timeout`                    | `0`                    | *(unset — see §9.2)*                             | Candidate change                                      | —                                       |
| `db.memory.transaction.max`                 | `0`                    | *(unset — see §9.3)*                             | Candidate change                                      | —                                       |
| `db.tx_log.rotation.retention_policy`       | `2 days 2G`            | *(unset — see §9.4)*                             | Candidate change                                      | —                                       |
| `server.metrics.enabled`                    | `false`                | *(unset — see §10.3)*                            | Candidate change                                      | —                                       |
