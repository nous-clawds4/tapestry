import CopyButton from './CopyButton';

/**
 * The body of a row's detail panel on the Active …-tags pages: the description carried by the
 * row's DList Header, and the row's tag value in a form that can be copied in one action.
 *
 * Shared between ActiveBTags and ActiveZTags rather than duplicated, per ADR
 * shared-concepts-row-detail/0001 — the two pages show the same two things and differ only in
 * what the tag is called and where its description comes from (the local carrier on the b-tags
 * page, the foreign concept header on the z-tags page). The caller resolves that; this renders it.
 *
 * `overflowWrap: 'anywhere'` carries over from the column this panel replaces: a tag value is a
 * kind, a 64-character pubkey and a slug, and it must wrap rather than overflow the table.
 *
 * `note` is optional and renders immediately to the right of the copy control — the b-tags page
 * uses it to say a row's b-tag points at its own event (ADR author-scoped-inspection/0002). Omit
 * it and the markup is unchanged.
 */
export default function TagDetailPanel({ description, tagLabel, tagValue, note }) {
  return (
    <div style={{ padding: '0.75rem 1.25rem', background: 'var(--bg-secondary)' }}>
      <p style={{ margin: '0 0 0.6rem' }}>
        {description || <span className="text-muted">No description.</span>}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span className="text-muted">{tagLabel}</span>
        <code style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{tagValue}</code>
        <CopyButton value={tagValue} />
        {note && <span className="text-muted">{note}</span>}
      </div>
    </div>
  );
}
