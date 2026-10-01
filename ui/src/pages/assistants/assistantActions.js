/**
 * The My Assistants page's three actions, in order (my-assistants #2, ADR my-assistants/0002 sub-decisions 4 and 10):
 *
 *   tagProfile  — one apply of a tag to a profile;
 *   changeTag   — the apply of the other tag FIRST, then the withdrawal of the current one; a half-done change leaves
 *                 the profile listed with both chips (true and recoverable), never with none;
 *   removeTags  — one withdrawal naming every tagging event the row carries.
 *
 * Each resolves { reports, refused? }: one report per step that published (describeTaggingPublish's shape, which the
 * page draws), and `refused` in its own words when a step could not be signed (no extension, a signer on another
 * account, a refused signature, a tag whose definition is not found). Nothing after a refused step runs, and a change
 * whose apply reached no relay does not withdraw.
 *
 * The publishers are passed in (`deps`), never imported here: the page hands it the real ones, and the Node runner
 * hands it fakes (test/my-assistants-actions.test.js O-class). `deps`: { relays, withdrawRelays?, applyTagging(args),
 * withdrawTaggings({ ids, addresses }) }, each publisher resolving { signed, result } or throwing. `relays` are the
 * outside relays an apply is sent to; `withdrawRelays` those a withdrawal is sent to — the same plus the community
 * relay, so it travels between instances (ADR my-assistants/0002 Amendment 1, sub-decision 11) — defaulting to `relays`.
 */

import { describeTaggingPublish } from '../../utils/taggingPublishReport.js';
import { TAG_NAMES, tagAvailability, withdrawalOf } from './myAssistants.js';

function refusalOf(err) {
  return (err && err.message) || 'The signature was refused.';
}

/** The definition's author and slug, from its address 39999:<author>:<slug> — the one copy of both. */
function addressParts(definition) {
  const parts = definition && typeof definition.address === 'string' ? definition.address.split(':') : [];
  return parts.length >= 3 ? { author: parts[1], slug: parts.slice(2).join(':') } : { author: null, slug: null };
}

async function applyTag({ target, tagKey, definitions, deps }) {
  const availability = tagAvailability(definitions)[tagKey];
  if (!availability || !availability.enabled) return { refused: availability ? availability.reason : 'Unknown tag.' };
  const definition = definitions[tagKey];
  const { author, slug } = addressParts(definition);
  try {
    const { result } = await deps.applyTagging({
      tag: { slug, authorPubkey: author, eventId: definition.eventId },
      targetPubkey: target,
      polarity: 1,
    });
    return { report: describeTaggingPublish({ name: TAG_NAMES[tagKey], local: result.local, external: result.external, relays: deps.relays }) };
  } catch (err) {
    return { refused: refusalOf(err) };
  }
}

async function withdraw({ ids, addresses, subject, deps }) {
  try {
    const { result } = await deps.withdrawTaggings({ ids, addresses });
    const relays = Array.isArray(deps.withdrawRelays) ? deps.withdrawRelays : deps.relays;
    return { report: describeTaggingPublish({ name: subject, local: result.local, external: result.external, relays }) };
  } catch (err) {
    return { refused: refusalOf(err) };
  }
}

/** Tag a profile (AC-2). */
export async function tagProfile({ target, tagKey, definitions, deps }) {
  const applied = await applyTag({ target, tagKey, definitions, deps });
  return applied.refused ? { reports: [], refused: applied.refused } : { reports: [applied.report] };
}

/** Change a row's one tag to the other (AC-4): apply first, then withdraw. */
export async function changeTag({ row, toKey, definitions, deps }) {
  const applied = await applyTag({ target: row.pubkey, tagKey: toKey, definitions, deps });
  if (applied.refused) return { reports: [], refused: applied.refused };
  if (!applied.report.ok) return { reports: [applied.report] };
  const fromKeys = row.tags.map((t) => t.key).filter((key) => key !== toKey);
  const withdrawal = withdrawalOf(row, fromKeys);
  const withdrawn = await withdraw({ ...withdrawal, deps });
  return withdrawn.refused
    ? { reports: [applied.report], refused: withdrawn.refused }
    : { reports: [applied.report, withdrawn.report] };
}

/** Withdraw every tag a row carries (AC-5). */
export async function removeTags({ row, deps }) {
  const withdrawn = await withdraw({ ...withdrawalOf(row), deps });
  return withdrawn.refused ? { reports: [], refused: withdrawn.refused } : { reports: [withdrawn.report] };
}
