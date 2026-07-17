import React from 'react';

/**
 * The raw signed assertions behind one profile row's +N/-M on the tag detail page.
 *
 * Story 2 / ADR 0002 (epic tag-event-inspector). Presentational and stateless:
 * TagPageRow owns the toggle, this renders the blocks.
 *
 * A tagging is an assertion publishable by ANYONE (`nostr-user-tag`: "each element
 * links a target pubkey to a tag event ID"), so a row is backed by N+M distinct
 * events from N+M distinct authors — not one. This renders every one the row's
 * numbers are derived from.
 *
 * `counted` marks the blocks the numbers actually account for. A block can be
 * present but uncounted in exactly one case: it is the viewer's own assertion and
 * its author falls below the active POV's WoT threshold, so the viewer-union put it
 * in the panel while the WoT filter kept it out of the count. Marking it is what
 * keeps AC-4's promise literally true — count the counted blocks and you get the
 * row's numbers.
 *
 * POV note (epic guardrail, as amended): each event's BYTES are POV-invariant and
 * rendered untouched. WHICH events appear is per-POV by construction, because the
 * set is defined as the evidence behind a per-POV number. The envelope carries the
 * server's classification BESIDE the bytes, never inside them.
 *
 * Props:
 *   assertions — [{ polarity: 'apply'|'dispute', counted: boolean, event: {…7 fields} }]
 */
export default function TagRowRawEvents({ assertions }) {
  if (!assertions?.length) return null;

  return (
    <div className="bs-tag-row-raw-list">
      {assertions.map((a) => (
        <div className="bs-tag-row-raw-block" key={a.event.id}>
          <p className="bs-tag-row-raw-caption">
            <span
              className={`bs-tag-row-raw-polarity is-${a.polarity}`}
            >
              {a.polarity === 'apply' ? 'Applied by' : 'Disputed by'}
            </span>
            {/* The author pubkey is the bar, never a display name in its place: the
                audience for a raw-event viewer reads pubkeys, and a name is a claim
                the event itself does not make. */}
            <code className="bs-tag-row-raw-author">{a.event.pubkey}</code>
            {!a.counted && (
              <span
                className="bs-tag-row-raw-uncounted"
                title="This assertion's author is outside the active point-of-view's web of trust, so it is shown but not counted in this row's score."
              >
                not counted under this POV
              </span>
            )}
          </p>
          <pre className="bs-tag-raw-pre">{JSON.stringify(a.event, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}
