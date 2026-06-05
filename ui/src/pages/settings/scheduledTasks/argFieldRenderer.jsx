/**
 * argFieldRenderer (story #17 / ADR 0015): renders an input field
 * for a single task-argument based on its registry-declared shape.
 *
 * Used by AddOrEditEntryModal. Renderer is a switch over the three
 * known arg shapes — `customer`, `boolean`, `optional` (limit-style) —
 * with a text-input fallback for any unknown shape. The fallback exists
 * so future registry shapes don't silently break the UI; a console.warn
 * surfaces the gap to whichever maintainer's debugging at the time.
 */

import CustomerPicker from './CustomerPicker.jsx';

export default function renderArgField({ name, schema, value, onChange, error }) {
  // ── customer arg: required when schema === true ─────────────────
  if (name === 'customer') {
    return (
      <CustomerPicker
        value={value || ''}
        onChange={(pubkey) => onChange(name, pubkey)}
        required={schema === true}
        error={error}
      />
    );
  }

  // ── boolean arg (e.g., warmStart) ──────────────────────────────
  if (schema && typeof schema === 'object' && schema.type === 'boolean') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(name, e.target.checked)}
        />
        <span style={{ fontSize: '0.9rem' }}>{schema.label || name}</span>
        {schema.description && (
          <span style={{ fontSize: '0.8rem', color: '#888' }}> — {schema.description}</span>
        )}
        {error && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}> ({error})</span>}
      </label>
    );
  }

  // ── "optional" arg (e.g., limit) ───────────────────────────────
  if (schema === 'optional') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.9rem' }}>{name}:</span>
        <input
          type="number"
          min="0"
          value={value ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange(name, v === '' ? undefined : parseInt(v, 10));
          }}
          style={{ width: '6rem', padding: '0.3rem 0.5rem' }}
        />
        <span style={{ fontSize: '0.8rem', color: '#888' }}>(optional)</span>
        {error && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}> ({error})</span>}
      </label>
    );
  }

  // ── fallback for unknown / future arg shapes ───────────────────
  // Logged at runtime so a future maintainer notices the gap.
  if (typeof console !== 'undefined') {
    console.warn(`[argFieldRenderer] Unknown arg shape for '${name}'; rendering text input as fallback. Schema:`, schema);
  }
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.9rem' }}>{name} (default text input):</span>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(name, e.target.value)}
        style={{ flex: 1, padding: '0.3rem 0.5rem' }}
      />
      {error && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}> ({error})</span>}
    </label>
  );
}
