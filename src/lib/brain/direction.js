/**
 * Operational direction — pure core (operational-direction #1, ADR 0001 d1).
 *
 * Dependency-free CommonJS on purpose (the goals.js / proposals.js precedent):
 * this is the safety precondition of an autonomous run, so it must be testable
 * without a stack, a network, or a live graph. It requires nothing and pulls in
 * no modules — including for the boundary verdict, which is INJECTED (d5)
 * precisely so this file can stay pure.
 *
 * What it decides: whether a goal may be run under operational direction, and
 * on what terms. A run's terms are DERIVED from the goal (statement →
 * the ask, deliverable → success criteria, boundary → ceiling, chanceOfSuccess
 * → the estimate) rather than hand-authored per run. The owner still sets every
 * goalpost — once, at goal-writing time.
 *
 * Three guards, in order (ADR d2/d4/d5):
 *   1. ANCHOR — the goal must sit under an owner-ratified anchor: the nearest
 *      goal in its ancestry chain (itself, or an ancestor within the configured
 *      distance) named by an APPROVED proposal fact. v1 policy is distance 0 —
 *      the anchor must be the goal itself — expressed as a bounded walk with no
 *      special case for 0, so loosening it later is an owner POLICY act
 *      (PRD §7.5/§7.6), never a redesign of this procedure.
 *   2. STALENESS — an approval ratifies the deliverable AS IT STOOD. Proposal
 *      facts never re-sign (ADR 0006 d3); updateGoalIntent always does
 *      (normalize/index.js:2356, via regenerateJson's fresh created_at). So a
 *      goal whose createdAt exceeds its approval's was rewritten after
 *      ratification, and carries a ratification nobody granted.
 *   3. BOUNDARY — a sub-goal's boundary may narrow its parent's, never widen
 *      it. A distant anchor without this is a laundering path. Boundaries are
 *      prose, so the verdict itself is a blinded judgment made outside this
 *      core and supplied to it — but the GATE is here and it FAILS CLOSED
 *      (ADR 0002 d10): steps that exist and were not judged refuse. It was
 *      previously opt-in, running only when a caller injected a verdict, which
 *      made the same chain eligible or refused depending on whether the caller
 *      remembered. Half of a paired invariant must not be advisory.
 *
 * All three refuse loudly and namedly, and each says only what it established:
 * an unjudged boundary is never reported as a widening, and an unknowable
 * timestamp is never reported as a rewrite. Nothing here writes.
 */

'use strict';

/**
 * The v1 policy value: the anchor must be the goal itself (ADR d3). This is a
 * POLICY PARAMETER, not a constant of the design — the walk below is bounded by
 * whatever value is passed and has no branch on 0, so raising it is a
 * configuration act, not a code change.
 */
const DEFAULT_MAX_ANCHOR_DISTANCE = 0;

/** The refusal codes this core produces. Exhaustive — nothing else is emitted. */
const REFUSALS = [
  'goal-not-found',
  'ambiguous-slug',
  'no-anchor-in-range',
  'chain-broken',
  'anchor-stale',
  'boundary-widened',
  'boundary-unjudged',
];

/** The only verdict tokens a boundary step accepts (ADR 0002 d11). */
const BOUNDARY_VERDICTS = ['narrows', 'widens'];

/**
 * What operational mode knowingly gives up relative to armed mode, and why
 * (ADR d6). Returned as DATA so an operational run's artifacts cannot silently
 * omit it — AC2 requires it stated, not dropped.
 */
const SURRENDERED = [
  {
    term: 'baseline commit',
    detail: 'The origin/staging SHA at arming is not captured for an operational run.',
    why: 'Reproducibility is traded for operational cost. Armed mode retains it, which is why that mode still exists.',
  },
  {
    term: 'pinned governing versions',
    detail: 'The commit SHAs of roles/director.md, the direct-feature skill, and gate-judge.md are not pinned at arming.',
    why: 'Same trade: knowing which Director ran under which rubric is an experimental need, not an operational one.',
  },
];

/**
 * Terms the mapping names but the platform cannot supply yet (ADR d6). Named
 * dependencies, never silently absent.
 */
const UNAVAILABLE = [
  {
    term: 'estimate',
    detail: "chanceOfSuccess is read here from the goal's raw record; the goals read API drops it (parseGoalRow).",
    dependency: 'store-and-show-the-prompt-and-the-estimate',
  },
  {
    term: 'prerequisites',
    detail: 'dependsOn exists on no goal and nowhere in the codebase; prerequisites cannot be derived.',
    dependency: 'store-and-show-the-prompt-and-the-estimate',
  },
];

/** A field "counts" only as words — a non-empty trimmed string (goals.js idiom). */
function hasWords(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function trimmed(v) {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Read chanceOfSuccess off a raw goal row's json (ADR d6). Deliberately local:
 * parseGoalRow drops the field and is pinned by the second-brain suites, so this
 * reads the raw section instead of changing that contract. Collapses into the
 * general read surface when `store-and-show-the-prompt-and-the-estimate` ships.
 *
 * Never throws — malformed rows yield null (the parseGoalRow tolerance idiom).
 */
function parseEstimate(row) {
  if (!row || typeof row.json !== 'string' || row.json === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(row.json);
  } catch {
    return null;
  }
  const section = parsed && parsed.tapestryOwnerGoal;
  if (!section || typeof section !== 'object' || Array.isArray(section)) return null;
  const v = section.chanceOfSuccess;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * The run's terms, transcribed from the goal (ADR d6). An absent estimate is
 * RECORDED AS ABSENT — never defaulted to a number (AC2).
 */
function deriveTerms(goalRecord, estimate) {
  const g = goalRecord || {};
  const hasEstimate = typeof estimate === 'number' && Number.isFinite(estimate);
  return {
    ask: g.statement != null ? g.statement : null,
    successCriteria: g.deliverable != null ? g.deliverable : null,
    ceiling: g.boundary != null ? g.boundary : null,
    estimate: hasEstimate ? estimate : null,
    estimateSource: hasEstimate ? 'goal' : 'absent',
    // The goal's other three intent properties (goal-intent-fields ADR 0002
    // d5), transcribed with the same idiom as the prose terms above: a stored
    // value verbatim, a never-set one null — never a manufactured false or an
    // empty prompt. NAMED LITERALLY on purpose. The shared list of the four is
    // INTENT_FIELDS in src/lib/brain/goals.js, but this core is pinned
    // dependency-free (operational-direction S1) and so cannot read it; these
    // three must be kept in step with that list by hand.
    // The estimate above keeps this surface's own word (chanceOfSuccess →
    // estimate) and its derivation is byte-unchanged by that story.
    prompt: g.prompt != null ? g.prompt : null,
    needsHumanInput: g.needsHumanInput != null ? g.needsHumanInput : null,
    needsBreakdown: g.needsBreakdown != null ? g.needsBreakdown : null,
  };
}

/**
 * Is this ratification still the one that was granted? (ADR 0001 d4, amended by
 * ADR 0002 d12.)
 *
 * True iff the goal element was re-signed AFTER its approval was written. The
 * comparison is exact because the two sides have opposite re-signing behavior:
 * proposal facts never re-sign, goal records always do on an intent edit.
 *
 * Conservative by construction: any re-sign trips this, including a benign
 * capturedOn backfill or a raw update-element-json touch. That is correct at
 * arming, where no recorded text exists to compare against yet; once a run has
 * derived its terms, termsMatch() below is the exact instrument.
 *
 * **Fails CLOSED on unknowable currency (d12).** A missing `createdAt` on either
 * side means currency cannot be established, and a safety guard must refuse
 * rather than assume fresh. Reachability is low — `e.created_at` is present on
 * every real event — so the cost is a loud refusal on a malformed record.
 */
function isAnchorStale(goalRecord, approvalRecord) {
  const g = goalRecord && typeof goalRecord.createdAt === 'number' ? goalRecord.createdAt : null;
  const a = approvalRecord && typeof approvalRecord.createdAt === 'number' ? approvalRecord.createdAt : null;
  if (g === null || a === null) return true; // unknowable ⇒ treated as stale (d12)
  return g > a;
}

/**
 * Which timestamp, if either, is missing — so the refusal can distinguish
 * "could not establish currency" from "rewritten after ratification" (d12).
 * Returns [] when both are present.
 */
function missingTimestamps(goalRecord, approvalRecord) {
  const missing = [];
  if (!goalRecord || typeof goalRecord.createdAt !== 'number') missing.push('goal');
  if (!approvalRecord || typeof approvalRecord.createdAt !== 'number') missing.push('approval');
  return missing;
}

/**
 * Have the terms moved since we derived them? (ADR d9.3.)
 *
 * Compares the goal's LIVE deliverable/boundary against the verbatim text the
 * book recorded at derivation. Text, not timestamps — so a re-sign that changed
 * no term does not halt a run in flight, and a real edit does. Reports WHICH
 * field moved so the halt can name it.
 */
function termsMatch(goalRecord, recorded) {
  const g = goalRecord || {};
  const r = recorded || {};
  const changed = [];
  if (trimmed(g.deliverable) !== trimmed(r.deliverable)) changed.push('deliverable');
  if (trimmed(g.boundary) !== trimmed(r.boundary)) changed.push('boundary');
  return { match: changed.length === 0, changed };
}

/**
 * The ordered parent→child steps of a chain, anchor-first (ADR d5). Each step
 * carries ONLY what a blinded judge may see plus the slugs the REFUSAL needs —
 * callers must pass the two boundary strings and nothing else to the verdict.
 *
 * A length-1 chain yields zero steps: at v1's anchor distance there is nothing
 * to compare, so the check is vacuous but present.
 */
function boundarySteps(chain) {
  const list = Array.isArray(chain) ? chain : [];
  const steps = [];
  for (let i = 0; i + 1 < list.length; i += 1) {
    const parent = list[i] || {};
    const child = list[i + 1] || {};
    steps.push({
      parentSlug: parent.slug != null ? parent.slug : null,
      childSlug: child.slug != null ? child.slug : null,
      parentBoundary: parent.boundary != null ? parent.boundary : null,
      childBoundary: child.boundary != null ? child.boundary : null,
    });
  }
  return steps;
}

/**
 * The first step whose verdict widens, or null when every step narrows
 * (ADR d5). Verdicts are supplied positionally by the caller; anything other
 * than the string 'widens' is treated as not-widening, so an unreadable verdict
 * cannot silently block — the judge protocol handles judge failure, not this.
 */
function applyBoundaryVerdicts(steps, verdicts) {
  const list = Array.isArray(steps) ? steps : [];
  const v = Array.isArray(verdicts) ? verdicts : [];
  for (let i = 0; i < list.length; i += 1) {
    if (v[i] === 'widens') return list[i];
  }
  return null;
}

/**
 * Collect one verdict per step, from either supported source (ADR 0002 d11):
 * the `boundaryVerdict(parentBoundary, childBoundary)` function (the test seam,
 * and the shape that preserves blinding — it receives EXACTLY the two boundary
 * strings), or the ordered `boundaryVerdicts` array the endpoint threads in from
 * the query string.
 *
 * Returns { verdicts, usable }. `usable` is false when ANY step lacks a
 * recognized verdict — a length mismatch or an unrecognized token makes the
 * whole set unusable, so a typo can never read as approval.
 */
function collectVerdicts(steps, boundaryVerdict, boundaryVerdicts) {
  if (typeof boundaryVerdict === 'function') {
    const verdicts = steps.map((s) => boundaryVerdict(s.parentBoundary, s.childBoundary));
    return { verdicts, usable: verdicts.every((x) => BOUNDARY_VERDICTS.includes(x)) };
  }
  if (Array.isArray(boundaryVerdicts)) {
    const usable = boundaryVerdicts.length === steps.length
      && boundaryVerdicts.every((x) => BOUNDARY_VERDICTS.includes(x));
    return { verdicts: boundaryVerdicts, usable };
  }
  return { verdicts: [], usable: false };
}

/**
 * Project records to identity-bearing chain entries (ADR 0002 d13): `{slug, uuid}`.
 * The uuid is what lets the endpoint build boundary steps from what the walk
 * ACTUALLY visited — `ambiguous-slug` guards only the target, so a duplicated
 * ancestor slug could otherwise surface a different record's boundary text to a
 * judge. Success and refusal envelopes use the same shape, so callers need no branch.
 */
function identify(records) {
  return (Array.isArray(records) ? records : []).map((g) => ({
    slug: g && g.slug != null ? g.slug : null,
    uuid: g && g.uuid != null ? g.uuid : null,
  }));
}

/**
 * A step as a blinded judge may see it: the two boundary strings and nothing
 * else — no slugs, no chain position, nothing carrying a progress signal
 * (ADR 0001 d5). One projection shared by every return path (ADR 0003 d16), so
 * the blinding contract is stated once rather than re-derived per outcome.
 */
function blindSteps(steps) {
  return (Array.isArray(steps) ? steps : []).map((s) => ({
    parentBoundary: s.parentBoundary,
    childBoundary: s.childBoundary,
  }));
}

function refuse(refusal, error, extra) {
  return Object.assign({ eligible: false, anchor: null, chain: [], refusal, error }, extra || {});
}

/**
 * Resolve the owner-ratified anchor for `goalSlug` and decide eligibility
 * (ADR d2). Consumes records already annotated by goals.js resolveDecomposition
 * (parentUuid / parentUnresolved / cycleOf), so the ancestry walk inherits that
 * core's cycle-breaking rather than re-deriving it.
 *
 * `boundaryVerdict(parentBoundary, childBoundary)` is optional and injected. It
 * receives EXACTLY the two boundary strings — no slugs, no chain position, no
 * run state — which is what keeps the judgment blind (d5).
 *
 * Returns { eligible, anchor, chain, refusal?, error?, detail? }. `chain` is
 * anchor-first and lists the goals actually WALKED, which is what a refusal
 * reports.
 */
function resolveAnchor({ goals, proposals, goalSlug, maxAnchorDistance, boundaryVerdict, boundaryVerdicts } = {}) {
  const records = Array.isArray(goals) ? goals : [];
  const facts = Array.isArray(proposals) ? proposals : [];
  const limit = typeof maxAnchorDistance === 'number' && Number.isFinite(maxAnchorDistance) && maxAnchorDistance >= 0
    ? Math.floor(maxAnchorDistance)
    : DEFAULT_MAX_ANCHOR_DISTANCE;

  const matches = records.filter((r) => r && r.slug === goalSlug);
  if (matches.length === 0) {
    return refuse('goal-not-found', `no goal has the slug '${goalSlug}' — the goal was not found.`);
  }
  if (matches.length > 1) {
    return refuse('ambiguous-slug', `${matches.length} goals share the slug '${goalSlug}' — refusing to guess which is meant.`);
  }

  // Approved decisions, by the goal slug each ratifies. A `proposed` nomination
  // and a `skipped` decision are NOT ratifications.
  const approvedBySlug = new Map();
  for (const f of facts) {
    if (!f || f.type !== 'approved' || !hasWords(f.goal)) continue;
    if (!approvedBySlug.has(f.goal)) approvedBySlug.set(f.goal, f);
  }

  const byUuid = new Map(records.map((r) => [r.uuid, r]));

  // The bounded walk. `limit` is the ONLY thing that stops it early — there is
  // no branch on 0, which is what makes raising the policy parameter a
  // configuration act rather than a redesign (d3).
  const walked = [];          // goals actually visited, nearest-first
  let cur = matches[0];
  let distance = 0;
  let anchorRecord = null;
  let anchorFact = null;

  while (cur && distance <= limit) {
    walked.push(cur);
    const fact = approvedBySlug.get(cur.slug);
    if (fact) { anchorRecord = cur; anchorFact = fact; break; }
    if (distance === limit) break;
    if (cur.parentUnresolved || cur.cycleOf) {
      return refuse('chain-broken',
        `the ancestry chain above '${cur.slug}' is broken (${cur.cycleOf ? 'parent cycle' : 'unresolvable parent'}) — refusing to walk it.`,
        { detail: { walked: walked.map((g) => g.slug) }, chain: identify(walked) });
    }
    if (!cur.parentUuid) break;
    const next = byUuid.get(cur.parentUuid);
    if (!next) {
      return refuse('chain-broken',
        `the parent of '${cur.slug}' does not resolve to a known goal — refusing to walk a broken chain.`,
        { detail: { walked: walked.map((g) => g.slug) }, chain: identify(walked) });
    }
    cur = next;
    distance += 1;
  }

  const walkedSlugs = walked.map((g) => g.slug);

  if (!anchorRecord) {
    return refuse('no-anchor-in-range',
      `no owner-ratified anchor within ${limit} step(s) of '${goalSlug}' — walked: ${walkedSlugs.join(' → ')}. An operational run needs an approved proposal fact naming one of these goals.`,
      { detail: { walked: walkedSlugs, maxAnchorDistance: limit }, chain: identify(walked) });
  }

  if (isAnchorStale(anchorRecord, anchorFact)) {
    // d12 — distinguish "currency could not be established" from "rewritten".
    // Asserting a rewrite that nothing established would be the same dishonesty
    // d10 forbids on the boundary side.
    const missing = missingTimestamps(anchorRecord, anchorFact);
    const error = missing.length > 0
      ? `the currency of '${anchorRecord.slug}''s ratification could not be established — the ${missing.join(' and ')} record${missing.length > 1 ? 's carry' : ' carries'} no timestamp, so there is no way to tell whether the goal changed after it was approved. Refusing rather than assuming it is current.`
      : `'${anchorRecord.slug}' was rewritten after it was ratified (goal createdAt ${anchorRecord.createdAt} > approval createdAt ${anchorFact.createdAt}) — the approval ratified terms that have since changed. Propose and approve it again, then re-derive.`;
    return refuse('anchor-stale', error, {
      detail: {
        walked: walkedSlugs,
        goal: anchorRecord.slug,
        goalCreatedAt: anchorRecord.createdAt != null ? anchorRecord.createdAt : null,
        approvalCreatedAt: anchorFact.createdAt != null ? anchorFact.createdAt : null,
        missingTimestamps: missing,
      },
      chain: identify(walked),
    });
  }

  // Anchor-first, down to the target: the order the boundary steps are judged in.
  const chain = walked.slice().reverse();
  const steps = boundarySteps(chain);

  // ── The boundary guard, FAIL-CLOSED (ADR 0002 d10) ───────────────────
  // Previously this ran only when a caller injected a verdict function, so the
  // same chain was eligible or refused depending on whether the caller
  // remembered. That made half of a paired invariant opt-in. It is now a gate
  // every caller passes through: steps that exist and were not judged refuse.
  if (steps.length > 0) {
    const { verdicts, usable } = collectVerdicts(steps, boundaryVerdict, boundaryVerdicts);
    if (!usable) {
      // Says nobody judged. It must NOT claim a widening no judge produced —
      // that sentence would land in the decision journal and the book audit as
      // though a judgment had happened.
      return refuse('boundary-unjudged',
        `the ancestry chain has ${steps.length} boundary step(s) that were not judged — supply one verdict per step, in order, before this goal can be run. No judgment was supplied, so none is assumed.`,
        {
          detail: {
            walked: walkedSlugs,
            stepCount: steps.length,
            verdictsSupplied: Array.isArray(verdicts) ? verdicts.length : 0,
          },
          chain: identify(chain),
          steps: blindSteps(steps),
        });
    }
    const widening = applyBoundaryVerdicts(steps, verdicts);
    if (widening) {
      return refuse('boundary-widened',
        `'${widening.childSlug}' widens the boundary of its parent '${widening.parentSlug}' — a sub-goal may narrow what it stays inside, never widen it.`,
        { detail: { walked: walkedSlugs, step: widening }, chain: identify(chain), steps: blindSteps(steps) });
    }
  }

  return {
    eligible: true,
    anchor: {
      slug: anchorRecord.slug,
      distance,
      proposalId: anchorFact.proposalId != null ? anchorFact.proposalId : null,
      approvedOn: anchorFact.happenedOn != null ? anchorFact.happenedOn : null,
    },
    chain: identify(chain),
    steps: blindSteps(steps),
    refusal: null,
  };
}

module.exports = {
  DEFAULT_MAX_ANCHOR_DISTANCE,
  REFUSALS,
  SURRENDERED,
  UNAVAILABLE,
  parseEstimate,
  deriveTerms,
  isAnchorStale,
  termsMatch,
  boundarySteps,
  applyBoundaryVerdicts,
  BOUNDARY_VERDICTS,
  resolveAnchor,
};
