import { useMemo, useState } from 'react';
import { composeManualUpdate } from '../../utils/treasureMap';
import { getActiveSignerOrThrow } from '../../utils/signerGuard';
import { publishOrThrow } from '../../utils/publishProfileTag';

/**
 * Hand-edit escape hatch (tl-treasure-map #4): the CURRENT found event,
 * verbatim, in an editable field; publish appears only once the text differs.
 *
 * Mounted by the PAGE, never by the delegation card (treasure-map-user-assistant
 * #2). This panel needs nothing but a found event, while the opt-in card
 * withholds itself whenever it has no delegation judgment to show — including
 * for a viewer with no provisioned assistant. Nesting the hatch inside the card
 * inverted that dependency and made it unreachable for exactly the users most
 * likely to want it.
 *
 * The caller keys this on `event.id` so a refreshed event (after any publish on
 * the page, including the card's) re-seeds the editor and deliberately discards
 * edits composed against a Map that is no longer current.
 */
export default function TreasureMapManualEdit({ event, onPublished }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);

  const baseline = useMemo(() => JSON.stringify(event, null, 2), [event]);
  const dirty = open && text !== baseline;

  if (!event) return null;

  function toggle() {
    setError(null);
    if (!open) setText(baseline); // (re)seed from the found event on open
    setOpen((v) => !v);
  }

  async function handleManualPublish() {
    setPublishing(true);
    setError(null);
    try {
      // Refuse to sign as an extension account drifted from the session.
      const authorPk = await getActiveSignerOrThrow();
      const unsigned = { ...composeManualUpdate(text, event), pubkey: authorPk };
      const signed = await window.nostr.signEvent(unsigned);
      await publishOrThrow(signed);
      setOpen(false);
      if (onPublished) onPublished();
    } catch (err) {
      setError(err?.message || 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border, #444)', paddingTop: '0.75rem' }}>
      <button
        className="btn btn-sm"
        onClick={toggle}
        style={{ fontSize: '0.8rem' }}
      >
        {open ? '▾' : '▸'} Update your kind 10040 event Treasure Map by hand
      </button>

      {open && (
        <div style={{ marginTop: '0.75rem' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', minHeight: '260px', resize: 'vertical',
              padding: '0.75rem', boxSizing: 'border-box',
              backgroundColor: 'var(--bg-primary, #0f0f23)',
              border: '1px solid var(--border, #444)',
              borderRadius: '6px', color: 'inherit',
              fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.45,
            }}
          />
          <div style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '0.35rem' }}>
            id, sig, and created_at are re-stamped when the edited event is signed.
          </div>

          {dirty && (
            <button
              className="btn btn-sm btn-primary"
              onClick={handleManualPublish}
              disabled={publishing}
              style={{ marginTop: '0.5rem' }}
            >
              {publishing ? '⏳ Publishing…' : '📤 Publish updated event'}
            </button>
          )}

          {error && (
            <div style={{
              marginTop: '0.5rem', padding: '0.5rem 0.75rem',
              border: '1px solid #f85149', borderRadius: '6px',
              backgroundColor: 'rgba(248, 81, 73, 0.08)',
              color: '#f85149', fontSize: '0.85rem',
            }}>
              Error: {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
