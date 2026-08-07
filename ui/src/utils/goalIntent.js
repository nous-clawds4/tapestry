/**
 * goalIntent — the one place the three goal screens decide how to SHOW a goal
 * intent: its prompt, its chance-of-success estimate, and its two flags.
 *
 * Story: engineering-team/stories/goal-intent-fields/3-show-the-four-on-the-goal-screens-that-already-exist.md
 * ADR:   engineering-team/decisions/goal-intent-fields/0003-screen-side-intent-display-and-the-narrow-d13-supersession.md
 *        d3 puts every absence rule and every owner-facing string here; d4 gives
 *        the prompt its three states; d2 gives the estimate its two formatters.
 *
 * THE SCREEN IS THE INTERPRETATION POINT (epic decision 6). No layer below this
 * one invents a value: goal-intent-fields #1 stores absence as key-absence, and
 * #2 returns it as null. This module is where the concept’s OWN declared
 * defaults are applied for display — the estimate default of 0, and Absent
 * means false for the two flags — and where the prompt, which declares no
 * default at all, is said to be unwritten rather than invented.
 *
 * ABSENCE IS COMPARED AGAINST null. NEVER FALSINESS. This is the bug this
 * feature attracts, and it must not be written:
 *
 *     if (!goal.prompt)           a prompt set to empty reads as never written
 *     if (!goal.chanceOfSuccess)  a stored 0 reads as never estimated
 *     if (!goal.needsHumanInput)  a stored false reads as never set
 *
 * The third one is not hypothetical: live goals store false explicitly. Stories
 * 1 and 2 guarantee that a stored 0, false or empty string arrives verbatim and
 * that only never-set arrives as null, so every absence test in this module and
 * in the three screens compares against null.
 *
 * TWO ESTIMATE FORMATTERS, AND THEY MUST NEVER BE MERGED.
 * estimateLineOnProposalCard exists because second-brain ADR 0006 d13 bars a
 * number from an owner-facing proposal card, and goal-intent-fields ADR 0003 d1
 * narrows that bar only for a value the OWNER recorded. A default applied by
 * the screen was authored by nobody, so on that one card it is stated in words
 * instead (d2). Merging the two would put a number no one wrote next to numbers
 * they did, which is the false attribution d13 exists to prevent.
 */

export const LABEL_PROMPT = 'Prompt:';
export const LABEL_ESTIMATE = 'Could run on its own:';
export const LABEL_NEEDS_YOU = 'Needs you:';
export const LABEL_TOO_BIG = 'Too big as it stands:';

export const PROMPT_UNSET = 'No prompt written yet.';
export const PROMPT_EMPTY = 'The prompt is empty.';
export const ESTIMATE_UNSET_ON_CARD = "no — you haven't estimated this one";

/** Roughly one wrapped line at list width — enough to recognise an opening. */
export const PROMPT_EXCERPT_MAX = 140;

/**
 * The three states AC2 names — never written, written and then emptied, and
 * written. A list-type screen gets a whitespace-collapsed head excerpt of the
 * prompt itself; pass max = 0 for the verbatim text, which is how the goal
 * detail shares this one implementation with the two list screens.
 */
export function promptDisplay(value, max = PROMPT_EXCERPT_MAX) {
  if (value == null) return { state: 'unset', text: PROMPT_UNSET };
  const raw = String(value);
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (collapsed === '') return { state: 'empty', text: PROMPT_EMPTY };
  const bound = typeof max === 'number' && Number.isFinite(max) && max > 0 ? max : 0;
  if (bound === 0) return { state: 'text', text: raw };
  if (collapsed.length <= bound) return { state: 'text', text: collapsed };
  return { state: 'text', text: `${collapsed.slice(0, bound)}…` };
}

/** Goals list and Goal detail: AC2 read literally — the declared default is 0. */
export function estimateLine(value) {
  if (value == null) return '0 out of 100';
  return `${value} out of 100`;
}

/**
 * The Proposals card, and nowhere else (ADR 0003 d2). A number appears here
 * when, and only when, the owner recorded one; otherwise the declared default
 * is stated in words. Do not merge this with estimateLine — see the header.
 */
export function estimateLineOnProposalCard(value) {
  if (value == null) return ESTIMATE_UNSET_ON_CARD;
  return `${value} out of 100`;
}

/** Absent means false, applied here — so absent and stored false read alike. */
export function flagWord(value) {
  if (value === true) return 'yes';
  return 'no';
}
