/**
 * Second Brain — pure goals core (second-brain #1, ADR 0001 decision 4;
 * decomposition extensions second-brain #3, ADR 0003 d1/d3/d4).
 *
 * Dependency-free CommonJS on purpose: this module is the shared classification
 * surface — the brain read endpoint maps Neo4j rows through it, the hygiene
 * checker reuses it, and the decomposition write primitives validate with it.
 * It requires nothing and pulls in no modules.
 *
 * A "row" is what the goals Cypher returns per element:
 *   { uuid, name, createdAt, json }  — json is the element's json-tag string.
 * A "record" is the parsed goal:
 *   { uuid, name, slug, statement, origin, capturedOn, createdAt,
 *     deliverable, boundary, parent }
 * The PRD's "statement" IS the concept's existing description field (ADR 0001
 * decision 2) — adopted, not duplicated. "parent" is the parent goal's json
 * slug (ADR 0003 d2: instance-portable, unique-by-intent, stable across
 * re-signs — never the TA-bound uuid/d-tag).
 */

'use strict';

/**
 * Parse one class-thread row into a goal record, or return null when the row
 * is not a parseable goal record (missing/malformed json, or no
 * tapestryOwnerGoal section). Never throws on bad data — non-goal rows are
 * classified out at read time (event-tagging ADR 0009 discipline).
 */
function parseGoalRow(row) {
  if (!row || !row.uuid || typeof row.json !== 'string' || row.json === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(row.json);
  } catch {
    return null;
  }
  const section = parsed && parsed.tapestryOwnerGoal;
  if (!section || typeof section !== 'object' || Array.isArray(section)) return null;
  return {
    uuid: row.uuid,
    name: row.name != null ? row.name : (section.name != null ? section.name : null),
    slug: section.slug != null ? section.slug : null,
    statement: section.description != null ? section.description : null,
    origin: section.origin != null ? section.origin : null,
    capturedOn: section.capturedOn != null ? section.capturedOn : null,
    createdAt: typeof row.createdAt === 'number' ? row.createdAt : null,
    deliverable: section.deliverable != null ? section.deliverable : null,
    boundary: section.boundary != null ? section.boundary : null,
    parent: section.parent != null ? section.parent : null,
  };
}

/** A field "counts" only as the owner's words — a non-empty trimmed string. */
function hasWords(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * Standing is derived from dated facts, never stored (PRD §6). The derivation
 * grows here, in one place (ADR 0001 d4; extended by ADR 0003 d3):
 *   - a goal with children is 'captured' — never 'viable' (PRD §5.2);
 *   - a leaf with both a deliverable and a boundary is 'viable';
 *   - everything else is 'captured'.
 * 'achieved'/'abandoned' arrive with the later stories that record those
 * dated facts. One-argument calls keep the story-1 behavior ('captured' for
 * records without decomposition fields).
 */
function deriveStanding(record, context = {}) {
  if (context && context.hasChildren === true) return 'captured';
  if (record && hasWords(record.deliverable) && hasWords(record.boundary)) return 'viable';
  return 'captured';
}

/**
 * The capture date: capturedOn (the stable json field) wins; legacy records
 * fall back to the event created_at (unix seconds → ISO date). A record with
 * neither resolves to null — the view renders nothing, never "Invalid Date".
 */
function resolveCaptureDate(record) {
  if (record && record.capturedOn) return record.capturedOn;
  if (record && typeof record.createdAt === 'number' && record.createdAt > 0) {
    const d = new Date(record.createdAt * 1000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

/** Newest capture first (ADR decision 4 interpretation). Stable, non-mutating. */
function sortGoals(records) {
  return [...records].sort((a, b) => {
    const da = resolveCaptureDate(a) || '';
    const db = resolveCaptureDate(b) || '';
    if (da === db) return 0;
    return da < db ? 1 : -1;
  });
}

/**
 * Group records by slug and pick each slug's canonical owner: oldest
 * createdAt wins, uuid as the deterministic tie-break (records without a
 * numeric createdAt sort last). Out-of-contract writes can duplicate slugs;
 * reads must resolve them the same way every time (ADR 0003 d4).
 */
function slugIndex(records) {
  const groups = new Map();
  for (const r of records) {
    if (!r || typeof r.slug !== 'string' || r.slug === '') continue;
    if (!groups.has(r.slug)) groups.set(r.slug, []);
    groups.get(r.slug).push(r);
  }
  const winners = new Map();
  for (const [slug, list] of groups) {
    const sorted = [...list].sort((a, b) => {
      const ca = typeof a.createdAt === 'number' ? a.createdAt : Infinity;
      const cb = typeof b.createdAt === 'number' ? b.createdAt : Infinity;
      if (ca !== cb) return ca - cb;
      return a.uuid < b.uuid ? -1 : 1;
    });
    winners.set(slug, sorted[0]);
  }
  return { groups, winners };
}

/**
 * The one resolution truth for the tree (ADR 0003 d4) — the API, the view,
 * and the hygiene check all read decomposition through this.
 *
 * Returns a same-length, same-order array of annotated copies:
 *   parentUuid       — uuid of the record the parent slug resolves to (the
 *                      slug's canonical owner), or null (root);
 *   hasChildren      — some record's parentUuid points here;
 *   parentUnresolved — true when a stated parent could not be honored
 *                      (dangling slug, or this record is a cycle member);
 *   slugShadowed     — true when another, older record owns this slug;
 *   cycleOf          — cycle members only: the lexicographically smallest
 *                      member uuid (the cycle's stable identity).
 *
 * Read-tolerant by construction: dangling parents render at the root; cycles
 * (writable only out-of-contract) are broken at the CYCLE MEMBERS only — each
 * becomes a flagged root and their well-formed descendants stay attached.
 * Rendering never loops and never hides a goal.
 */
function resolveDecomposition(records) {
  const { winners } = slugIndex(records);
  const annotated = records.map((r) => {
    const out = { ...r, parentUuid: null, hasChildren: false };
    if (r && typeof r.slug === 'string' && r.slug !== '') {
      const winner = winners.get(r.slug);
      if (winner && winner.uuid !== r.uuid) out.slugShadowed = true;
    }
    if (r && hasWords(r.parent)) {
      const target = winners.get(r.parent.trim());
      if (!target) {
        out.parentUnresolved = true;
      } else {
        // Self-reference resolves to itself and is caught by the cycle pass.
        out.parentUuid = target.uuid;
      }
    }
    return out;
  });

  // Break cycles in the parent graph (each node has ≤1 parent, so plain
  // chain-walking with three-state coloring finds every cycle).
  const byUuid = new Map(annotated.map((r) => [r.uuid, r]));
  const state = new Map(); // uuid → 'visiting' | 'done'
  for (const start of annotated) {
    if (state.has(start.uuid)) continue;
    const chain = [];
    let cur = start;
    while (cur && !state.has(cur.uuid)) {
      state.set(cur.uuid, 'visiting');
      chain.push(cur);
      cur = cur.parentUuid ? byUuid.get(cur.parentUuid) : null;
    }
    if (cur && state.get(cur.uuid) === 'visiting') {
      const idx = chain.findIndex((x) => x.uuid === cur.uuid);
      const members = chain.slice(idx);
      const cycleId = members.map((m) => m.uuid).sort()[0];
      for (const m of members) {
        m.parentUuid = null;
        m.parentUnresolved = true;
        m.cycleOf = cycleId;
      }
    }
    for (const c of chain) state.set(c.uuid, 'done');
  }

  for (const r of annotated) {
    if (r.parentUuid && byUuid.has(r.parentUuid)) byUuid.get(r.parentUuid).hasChildren = true;
  }
  return annotated;
}

/**
 * Validate a proposed decomposition write against the current record set
 * (ADR 0003 d4). ops:
 *   { type: 'create-child', parentSlug }
 *   { type: 'set-parent', goalSlug, parentSlug }
 * Returns { ok: true } or { ok: false, refusal: '<kind>', detail: '<why>' }
 * with kinds goal-not-found | parent-not-found | ambiguous-slug |
 * self-parent | already-has-parent | cycle. Pure — the caller enforces
 * "nothing written" by validating before any write.
 */
function validateDecompositionOp(records, op) {
  const { groups } = slugIndex(records);
  const refuse = (refusal, detail) => ({ ok: false, refusal, detail });
  const lookup = (slug, missingKind, roleWord) => {
    const list = groups.get(slug) || [];
    if (list.length === 0) {
      return { fail: refuse(missingKind, `no goal has the slug '${slug}' — the ${roleWord} was not found.`) };
    }
    if (list.length > 1) {
      return { fail: refuse('ambiguous-slug',
        `${list.length} goals share the slug '${slug}' — refusing to guess which ${roleWord} is meant.`) };
    }
    return { rec: list[0] };
  };

  if (!op || (op.type !== 'create-child' && op.type !== 'set-parent')) {
    return refuse('unknown-op', 'unrecognized decomposition operation.');
  }
  if (op.type === 'create-child') {
    const p = lookup(op.parentSlug, 'parent-not-found', 'parent');
    if (p.fail) return p.fail;
    return { ok: true };
  }
  // set-parent (adoption)
  const g = lookup(op.goalSlug, 'goal-not-found', 'goal');
  if (g.fail) return g.fail;
  const p = lookup(op.parentSlug, 'parent-not-found', 'parent');
  if (p.fail) return p.fail;
  if (g.rec.uuid === p.rec.uuid) {
    return refuse('self-parent', `a goal cannot be placed under itself ('${op.goalSlug}').`);
  }
  if (hasWords(g.rec.parent)) {
    return refuse('already-has-parent',
      `goal '${op.goalSlug}' already has the parent '${g.rec.parent.trim()}' — adoption is for parentless goals only.`);
  }
  // Cycle: the target parent may not sit inside the goal's own subtree —
  // walk the target's ancestor chain; reaching the goal means a cycle.
  const { winners } = slugIndex(records);
  const seen = new Set();
  let cur = p.rec;
  while (cur) {
    if (cur.uuid === g.rec.uuid) {
      return refuse('cycle',
        `placing '${op.goalSlug}' under '${op.parentSlug}' would create a cycle — '${op.parentSlug}' is a descendant of '${op.goalSlug}'.`);
    }
    if (seen.has(cur.uuid)) break; // pre-existing cycle upstream — not this op's defect
    seen.add(cur.uuid);
    cur = hasWords(cur.parent) ? winners.get(cur.parent.trim()) : null;
  }
  return { ok: true };
}

/**
 * The four intent properties the goal concept declares, in the concept's own
 * names and order (goal-intent-fields ADR 0001 d1). One list, one place: the
 * constructing write paths carry them onto a goal section through
 * pickIntentFields, and the read side imports this rather than re-declaring
 * the names. The names double as request-body keys — no new vocabulary.
 */
const INTENT_FIELDS = ['prompt', 'chanceOfSuccess', 'needsHumanInput', 'needsBreakdown'];

/**
 * The whitelist that carries the four onto a goal section (ADR 0001 d2). Pure
 * and non-mutating: returns a NEW object holding exactly those of
 * INTENT_FIELDS the caller supplied.
 *
 * Three prohibitions, each deliberate:
 *   - values are copied VERBATIM — no trim, no coercion, no type check, no
 *     range clamp, no default substitution, no rejection. The four are
 *     carried, never consulted: nothing may reject or transform a write
 *     because of what they contain (story AC5), and a prompt must come back
 *     byte-identical (AC3).
 *   - `undefined` is the ONLY omission test. A supplied null is a supplied
 *     value and is kept; a `!= null` test would silently drop it, which is a
 *     content-driven transform AC5 forbids.
 *   - nothing about a value is inspected, so a falsy-but-supplied 0, false or
 *     '' is carried like any other value (a truthiness test drops all three).
 *
 * Absence is expressed by NOT writing the key — the only representation of
 * "unset" that survives storage, export and restore. Object.keys() of the
 * result doubles as the "which fields were written" report, deterministically
 * in INTENT_FIELDS order.
 */
function pickIntentFields(input) {
  const supplied = input || {};
  const out = {};
  for (const field of INTENT_FIELDS) {
    if (supplied[field] !== undefined) out[field] = supplied[field];
  }
  return out;
}

module.exports = {
  parseGoalRow,
  deriveStanding,
  resolveCaptureDate,
  sortGoals,
  resolveDecomposition,
  validateDecompositionOp,
  INTENT_FIELDS,
  pickIntentFields,
};
