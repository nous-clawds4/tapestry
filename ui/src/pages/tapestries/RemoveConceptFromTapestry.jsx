import { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { publishOrThrow } from '../../utils/publishProfileTag';
import { getActiveSignerOrThrow } from '../../utils/signerGuard';
import { buildRemoveConceptDraft, authoredConceptMembers } from './tapestryDraft.mjs';
import useConceptOptions from './useConceptOptions';

/**
 * Take a concept OUT of an existing Tapestry — tapestries #6 / ADR tapestries/0006.
 *
 * Sidebar affordance on the EXISTING Exploration page (no new page, no new route, no new
 * server endpoint), rendered under the member rows for owner-editable tapestries only
 * (the canEdit gate lives in TapestryDetail). Remove-only: each authored member concept
 * (authoredConceptMembers — the ONE membership definition, Decision 3-A) gets a
 * per-member "Take out" control while two or more remain; a single-concept tapestry gets
 * the plain-language refusal INSTEAD of any control (the boundary: a tapestry keeps at
 * least one concept — taking out the last one is a deletion, not this feature). Choosing
 * a member publishes NOTHING — an inline confirm step names the member and offers
 * Take out / Cancel; Cancel returns to idle with the tapestry untouched (ratified
 * reading 2). On confirm the replacement comes from the pure subtract transform
 * buildRemoveConceptDraft (remove-only by construction; the page's resolved imports are
 * attribution matcher (a)'s evidence, the shared concept options matcher (b)'s),
 * republished through the #3/#5 publish paths decided by the event's author (Decision 4
 * — duplicated from AddConceptToTapestry deliberately: "adding is already built and
 * stays as it is"; rule of three extracts a shared helper):
 *   author == TA      → POST /api/strfry/publish signAs:"assistant" (server-signed, owner-403-gated)
 *   author == own key → getActiveSignerOrThrow → window.nostr.signEvent → publishOrThrow
 * On success the parent re-reads the same coordinate (onRemoved → reload) — visibility
 * by re-read, not optimism. On failure the error shows inline and membership is unchanged.
 */
export default function RemoveConceptFromTapestry({ event, imports, onRemoved }) {
  const { taPubkey } = useConfig();
  const { concepts } = useConceptOptions();

  const [armed, setArmed] = useState(null); // the member awaiting the owner's confirmation
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const members = authoredConceptMembers(event);

  async function save(member) {
    if (busy) return; // re-entry guard — defense beyond the disabled controls
    setBusy(true);
    setError(null);
    try {
      const draft = buildRemoveConceptDraft({
        event,
        memberUuid: member.uuid,
        resolvedImports: imports || [],
        conceptOptions: concepts,
      });
      const author = event.pubkey;

      if (author === taPubkey) {
        // TA-authored tapestry: the server re-signs as the assistant and publishes
        // (owner-gated → 403 otherwise) — the existing endpoint, exactly as create/add use it.
        const resp = await fetch('/api/strfry/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: draft.unsignedEvent, signAs: 'assistant' }),
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || !data?.success) {
          throw new Error(data?.error || `Publish failed: status ${resp.status}`);
        }
      } else {
        // Own-key tapestry: refuse signer/session drift, sign in the browser under the
        // tapestry's EXISTING author key, publish local + external — the #3 own-key path.
        await getActiveSignerOrThrow(author);
        const signed = await window.nostr.signEvent({ ...draft.unsignedEvent, pubkey: author });
        await publishOrThrow(signed);
      }

      setArmed(null);
      if (onRemoved) onRemoved(draft.removed.node);
    } catch (err) {
      setError(err.message || 'Failed to take the concept out.');
    } finally {
      setBusy(false);
    }
  }

  if (members.length === 0) return null; // nothing authored to take out (degraded pages never render this)

  if (members.length === 1) {
    // AC-2, up-front: the refusal is something the owner SEES, with no control that
    // could attempt the save (ratified reading 3) — the transform's throw is only the
    // backstop behind this.
    return (
      <p className="placeholder" style={{ padding: '0 0.5rem' }}>
        A tapestry keeps at least one concept, so its last one can’t be taken out.
      </p>
    );
  }

  const nameOf = (m) => m.name || m.slug;

  return (
    <div className="tapestry-remove-concept" style={{ padding: '0 0.5rem 0.5rem' }}>
      {members.map((m) => (
        <button
          key={m.uuid}
          type="button"
          className="tapestry-concept-option"
          aria-label={`Take out ${nameOf(m)}`}
          disabled={busy}
          onClick={() => { setArmed(m); setError(null); }}
        >
          <span>{nameOf(m)}</span>
          <span className="tapestry-concept-add">− Take out</span>
        </button>
      ))}
      {armed && !busy && (
        <div className="tapestry-remove-confirm" style={{ margin: '0.25rem 0 0' }}>
          <p style={{ margin: '0 0 0.5rem' }}>
            Take out “{nameOf(armed)}”? The tapestry itself stays, at the same address;
            only this concept leaves it. Nothing changes until you confirm.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-primary" onClick={() => save(armed)}>Take out</button>
            <button type="button" className="btn" onClick={() => setArmed(null)}>Cancel</button>
          </div>
        </div>
      )}
      {busy && <p className="placeholder" style={{ margin: '0.25rem 0 0' }}>Taking out…</p>}
      {error && <p className="error" style={{ margin: '0.25rem 0 0' }}>{error}</p>}
    </div>
  );
}
