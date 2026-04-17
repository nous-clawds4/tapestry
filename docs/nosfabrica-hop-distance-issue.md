# Issue: Replace variable-length path queries with frontier-based BFS for hop distance calculation

## Summary

The hop distance calculation in `GrapeRankAlgorithm.java` uses 8 sequential variable-length path queries (`[:FOLLOWS*1..N]` for N=1 through 8) to determine each user's distance from the observer. This approach has exponential path explosion and will become increasingly slow as the graph grows. We've implemented and tested a frontier-based BFS approach that completes in 45 seconds on a graph with 2.46M nodes and 30M FOLLOWS relationships — pure Cypher, no additional dependencies required.

## Current Implementation

In `GrapeRankAlgorithm.java` (lines ~183-199):

```java
Map<Integer, List<String>> hopsMap = new HashMap<>();
hopsMap.put(8, neo4jHelper.getUsersConnectedToObserver(observer, 8));
hopsMap.put(7, neo4jHelper.getUsersConnectedToObserver(observer, 7));
// ... 6 more queries ...
hopsMap.put(1, neo4jHelper.getUsersConnectedToObserver(observer, 1));
```

Each `getUsersConnectedToObserver(observer, N)` runs:

```cypher
MATCH (user:NostrUser {pubkey: $pubkey})-[:FOLLOWS*1..N]->(other:NostrUser)
WHERE other <> user
RETURN DISTINCT elementId(other) AS node_id, other.pubkey AS pubkey
```

### The Problem

`[:FOLLOWS*1..N]` doesn't just find nodes N hops away — it enumerates **every possible path** up to length N, then deduplicates with `DISTINCT`. With an average of ~12 follows per user and 30M edges:

- `[:FOLLOWS*1..1]`: ~12 paths (fast)
- `[:FOLLOWS*1..4]`: ~12^4 = ~20K paths (manageable)
- `[:FOLLOWS*1..8]`: ~12^8 = ~430M paths (exponential blowup)

Neo4j must traverse and deduplicate all of these before returning results. As the graph grows, the higher-hop queries become exponentially slower.

## Proposed Solution: Frontier-Based BFS

Instead of exploring all paths up to length N, process one hop level at a time, only visiting unassigned nodes:

```cypher
-- Step 1: Initialize
MATCH (u:NostrUser) CALL { WITH u SET u.hops = 999 } IN TRANSACTIONS OF 50000 ROWS

-- Step 2: Set observer to 0
MATCH (u:NostrUser {pubkey: $observer}) SET u.hops = 0

-- Step 3: For each hop level (repeat until no updates or max hops reached):
-- Hop 1:
MATCH (u:NostrUser {hops: 0})-[:FOLLOWS]->(f:NostrUser {hops: 999})
CALL { WITH f SET f.hops = 1 } IN TRANSACTIONS OF 50000 ROWS
RETURN count(f) AS updated

-- Hop 2:
MATCH (u:NostrUser {hops: 1})-[:FOLLOWS]->(f:NostrUser {hops: 999})
CALL { WITH f SET f.hops = 2 } IN TRANSACTIONS OF 50000 ROWS
RETURN count(f) AS updated

-- ... continue until updated = 0 or hop = max
```

### Why This Is Faster

Each iteration only scans edges from nodes at the **current frontier** — not the entire graph:

- Hop 1: scan edges from ~775 nodes (the observer's follows) → 8ms
- Hop 2: scan edges from ~309K nodes → 1.5 seconds
- Hop 3+: progressively fewer new nodes per level

Total work is proportional to the number of reachable nodes and their edges — linear, not exponential. The `{hops: 999}` filter on the target ensures each node is visited exactly once.

### Performance Data

Tested on a production graph (2.46M NostrUser nodes, 30.1M FOLLOWS relationships, Neo4j 5.26.10, 32GB server):

| Hop Level | Nodes Updated | Time |
|---|---|---|
| 1 | 775 | 8ms |
| 2 | 308,994 | 1.5s |
| 3+ | progressively fewer | seconds each |
| **Total** | **~283K reachable nodes** | **45 seconds** |

The old iterative approach (scanning all 30M edges per iteration, up to 12 times) took **6+ minutes** on the same graph.

## Implementation for GrapeRank

The GrapeRank Java implementation could adapt this approach in two ways:

### Option A: Run the Cypher queries from Java (minimal change)

Replace the 8 `getUsersConnectedToObserver` calls with a loop:

```java
// Initialize hops
session.run("MATCH (u:NostrUser) CALL { WITH u SET u.hops = 999 } IN TRANSACTIONS OF 50000 ROWS");
session.run("MATCH (u:NostrUser {pubkey: $pubkey}) SET u.hops = 0", Map.of("pubkey", observer));

// Frontier BFS
Map<String, Double> userDistanceMap = new HashMap<>();
userDistanceMap.put(observer, 0.0);

for (int hop = 0; hop < maxHops; hop++) {
    int nextHop = hop + 1;
    Result result = session.run(
        "MATCH (u:NostrUser {hops: $currentHop})-[:FOLLOWS]->(f:NostrUser {hops: 999}) " +
        "CALL { WITH f SET f.hops = $nextHop } IN TRANSACTIONS OF 50000 ROWS " +
        "RETURN f.pubkey AS pubkey",
        Map.of("currentHop", hop, "nextHop", nextHop)
    );

    List<String> updated = new ArrayList<>();
    while (result.hasNext()) {
        String pubkey = result.next().get("pubkey").asString();
        userDistanceMap.put(pubkey, (double) nextHop);
        updated.add(pubkey);
    }

    if (updated.isEmpty()) break;
}
```

### Option B: Compute in-memory without writing to Neo4j (no side effects)

If you prefer not to write `hops` properties to Neo4j nodes during GrapeRank calculation, you can do the frontier traversal in Java memory using a simple BFS:

```java
// Fetch the observer's adjacency list from Neo4j
// Then do BFS in Java — no Neo4j writes needed
Queue<String> frontier = new LinkedList<>();
Map<String, Integer> distances = new HashMap<>();
frontier.add(observer);
distances.put(observer, 0);

while (!frontier.isEmpty() && /* current hop < maxHops */) {
    String current = frontier.poll();
    int currentHop = distances.get(current);
    if (currentHop >= maxHops) continue;

    // Query Neo4j for this node's follows
    Result result = session.run(
        "MATCH (u:NostrUser {pubkey: $pubkey})-[:FOLLOWS]->(f:NostrUser) RETURN f.pubkey AS pubkey",
        Map.of("pubkey", current)
    );
    while (result.hasNext()) {
        String neighbor = result.next().get("pubkey").asString();
        if (!distances.containsKey(neighbor)) {
            distances.put(neighbor, currentHop + 1);
            frontier.add(neighbor);
        }
    }
}

// Convert to userDistanceMap for GrapeRank
for (Map.Entry<String, Integer> entry : distances.entrySet()) {
    userDistanceMap.put(entry.getKey(), (double) entry.getValue());
}
```

Note: Option B makes many individual queries to Neo4j (one per node in the BFS). For large graphs, Option A (batch Cypher) is more efficient because Neo4j handles the traversal internally.

## Note on GDS (Graph Data Science)

We also evaluated using Neo4j's GDS library (`gds.bfs.stream`), but discovered that GDS BFS returns a single traversal path (all nodes in BFS order) — it does **not** provide per-node hop distances. The frontier-based Cypher approach is both simpler and directly gives us what we need.

GDS is still valuable for other algorithms (we use it for Personalized PageRank), and could be worth considering for future GrapeRank enhancements (community detection, node similarity, etc.). But for hop distance specifically, the frontier Cypher approach is the right tool.

## References

- Implementation: [tapestry/src/algos/calculateHopsFrontier.sh](https://github.com/nous-clawds4/tapestry/blob/refactor-paths/src/algos/calculateHopsFrontier.sh)
- Neo4j `CALL { } IN TRANSACTIONS` docs: https://neo4j.com/docs/cypher-manual/current/subqueries/subqueries-in-transactions/
