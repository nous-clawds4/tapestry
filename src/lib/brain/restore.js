/**
 * Second Brain — pure restore-plan core (second-brain #8, ADR 0008 d5).
 *
 * Dependency-free CommonJS on purpose (the export.js sibling): given an
 * artifact (already shape-validated by the export core) and the target's
 * CURRENT five families (parsed records), compute either a wholesale refusal
 * or the ordered mint plan. ALL checks precede ALL writes — the caller mints
 * only a plan this core returned, and a refusal lists EVERY collision so the
 * owner fixes the situation once.
 *
 * The goal-collision triple (the createChildGoal guard, generalized): an
 * artifact goal collides when its name, its slug, or its name-DERIVED d-tag
 * matches an existing goal — a colliding d-tag would make the import MERGE
 * over the existing goal, a silent overwrite; name/slug collisions would
 * shadow reads. The d-tag derivation is target-bound, so the caller supplies
 * it (opts.deriveGoalDTag) and this core stays dependency-free.
 *
 * Record collisions are FAMILY-scoped slug collisions: the slug-keyed
 * linkage (a decision's proposalId → its proposal's slug) must stay
 * unambiguous on the target.
 *
 * The plan mints families in dependency-friendly order — goals, resources,
 * workRecords, proposals, signals — each mint {family, name, section} with
 * the artifact's section VERBATIM (restore reproduces; it never rewrites).
 */

'use strict';

const FAMILY_ORDER = ['goals', 'resources', 'workRecords', 'proposals', 'signals'];
const RECORD_FAMILIES = ['resources', 'workRecords', 'proposals', 'signals'];

/** The d-tag part of a `39999:<who>:<dtag>` identifier. */
function dTagPart(uuid) {
  return String(uuid == null ? '' : uuid).split(':').slice(2).join(':');
}

function entriesOf(artifact, family) {
  const content = artifact && artifact.content;
  const list = content && Array.isArray(content[family]) ? content[family] : [];
  return list.filter((e) => e && typeof e === 'object' && !Array.isArray(e));
}

/**
 * planRestore(artifact, existing, opts) →
 *   { ok: false, refusal: 'goal-collides' | 'record-collides', collisions: [...] }
 * | { ok: true, mints: [{ family, name, section }, ...] }   (family-ordered)
 *
 * `existing` holds the target's parsed records per family key; `opts.deriveGoalDTag(name)`
 * is the target-bound goal d-tag derivation.
 */
function planRestore(artifact, existing, opts) {
  const deriveGoalDTag = opts && typeof opts.deriveGoalDTag === 'function' ? opts.deriveGoalDTag : null;
  const ex = existing && typeof existing === 'object' ? existing : {};
  const exGoals = Array.isArray(ex.goals) ? ex.goals : [];

  // The goal-collision triple — every artifact goal checked against every
  // existing goal; every hit reported.
  const goalCollisions = [];
  for (const entry of entriesOf(artifact, 'goals')) {
    const section = entry.section && typeof entry.section === 'object' ? entry.section : {};
    const name = entry.name != null ? entry.name : (section.name != null ? section.name : null);
    const slug = section.slug != null ? section.slug : null;
    const derived = deriveGoalDTag && name != null ? deriveGoalDTag(name) : null;
    const hit = exGoals.find((g) => g && (
      (g.name != null && name != null && g.name === name)
      || (g.slug != null && slug != null && g.slug === slug)
      || (derived != null && g.uuid != null && dTagPart(g.uuid) === derived)
    ));
    if (hit) {
      goalCollisions.push({
        family: 'goals',
        name,
        slug,
        collidesWith: hit.name != null ? hit.name : hit.slug,
      });
    }
  }
  if (goalCollisions.length > 0) {
    return { ok: false, refusal: 'goal-collides', collisions: goalCollisions };
  }

  // Record collisions — family-scoped slug uniqueness on the target.
  const recordCollisions = [];
  for (const family of RECORD_FAMILIES) {
    const have = new Set(
      (Array.isArray(ex[family]) ? ex[family] : [])
        .map((r) => (r && typeof r.slug === 'string' && r.slug !== '' ? r.slug : null))
        .filter(Boolean),
    );
    for (const entry of entriesOf(artifact, family)) {
      const slug = entry.section && entry.section.slug != null ? entry.section.slug : null;
      if (typeof slug === 'string' && have.has(slug)) {
        recordCollisions.push({ family, slug, name: entry.name != null ? entry.name : null });
      }
    }
  }
  if (recordCollisions.length > 0) {
    return { ok: false, refusal: 'record-collides', collisions: recordCollisions };
  }

  // The ordered verbatim mint plan.
  const mints = [];
  for (const family of FAMILY_ORDER) {
    for (const entry of entriesOf(artifact, family)) {
      mints.push({ family, name: entry.name, section: entry.section });
    }
  }
  return { ok: true, mints };
}

module.exports = {
  FAMILY_ORDER,
  planRestore,
};
