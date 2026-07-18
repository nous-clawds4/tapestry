import React from 'react';

/**
 * The raw signed tagging events behind one aggregate — the shared blocks
 * renderer for the epic's assertion-backed inspection panels.
 *
 * Promoted from TagRowRawEvents.jsx at the third inspection surface
 * (tag-event-inspector ADR 0003 D5 — a rename, not an abstraction: identical
 * export, props, markup, and class names). Presentational and stateless; the
 * surface owns the toggle, this renders the blocks. Consumers:
 *   - TagPageRow (Story 2 / ADR 0002): the assertions behind a profile row's
 *     +N/-M on the tag detail page.
 *   - NoteTags (Story 3 / ADR 0003): the assertions behind a note's tag chip.
 * Story 1's tag-definition panel is deliberately NOT a consumer — one
 * POV-invariant event, no envelope, no polarity; its shared parts are
 * toRawEvent and .bs-tag-raw-pre, not these blocks.
 *
 * The `bs-tag-row-raw-*` class names now render on a non-row surface too —
 * cosmetic naming debt, deliberately kept (ADR 0003 D5): renaming them would
 * touch Story 2's CSS for zero behavior gain. Rename only in a story that owns
 * both surfaces' CSS.
 *
 * A tagging is an assertion publishable by ANYONE, so an aggregate is backed by
 * N+M distinct events from N+M distinct authors — not one. This renders every
 * one the aggregate's numbers are derived from.
 *
 * `counted` marks the blocks the numbers actually account for. A block can be
 * present but uncounted in exactly one case: it is the viewer's own assertion and
 * its author falls below the active POV's WoT threshold, so the viewer-union put it
 * in the panel while the WoT filter kept it out of the count. Marking it is what
 * keeps the count-the-blocks promise literally true — count the counted blocks
 * and you get the aggregate's numbers.
 *
 * POV note (epic guardrail, as amended): each event's BYTES are POV-invariant and
 * rendered untouched. WHICH events appear is per-POV by construction, because the
 * set is defined as the evidence behind a per-POV number. The envelope carries the
 * server's classification BESIDE the bytes, never inside them.
 *
 * Props:
 *   assertions — [{ polarity: 'apply'|'dispute', counted: boolean, event: {…7 fields} }]
 */
export default function RawTaggingEvents({ assertions }) {
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
