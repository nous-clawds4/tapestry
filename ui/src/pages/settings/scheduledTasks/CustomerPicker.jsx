/**
 * CustomerPicker (story #17 / ADR 0015): search-and-select React
 * component that reuses /api/get-customers — the same data source the
 * legacy Task Explorer's customer modal uses. Story #17 AC-9
 * "Customer picker shares the legacy explorer's source".
 *
 * Returns the selected customer's `pubkey` (the canonical 64-char
 * lowercase hex). Filters by name and by pubkey substring.
 */

import { useState, useEffect } from 'react';

export default function CustomerPicker({ value, onChange, required, error }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/get-customers')
      .then((r) => r.json())
      .then((d) => {
        setCustomers(Array.isArray(d.customers) ? d.customers : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('CustomerPicker: failed to load /api/get-customers', err);
        setLoading(false);
      });
  }, []);

  const selected = customers.find((c) => c.pubkey === value);
  const filtered = filter
    ? customers.filter((c) =>
        ((c.name || '').toLowerCase().includes(filter.toLowerCase())) ||
        ((c.pubkey || '').toLowerCase().includes(filter.toLowerCase()))
      )
    : customers;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.9rem' }}>
          Customer{required && <span style={{ color: '#ef4444' }}> *</span>}:
        </span>
        {selected ? (
          <span style={{ fontSize: '0.9rem' }}>
            <strong>{selected.name || 'Unknown'}</strong>{' '}
            <span style={{ color: '#888', fontSize: '0.8rem' }}>
              ({selected.pubkey.slice(0, 8)}…{selected.pubkey.slice(-4)})
            </span>
            <button
              type="button"
              onClick={() => onChange('')}
              style={{ marginLeft: '0.5rem', fontSize: '0.8rem', padding: '0.1rem 0.4rem' }}
            >
              Change
            </button>
          </span>
        ) : (
          <span style={{ color: '#888', fontSize: '0.85rem' }}>(none selected)</span>
        )}
      </div>
      {!selected && (
        <>
          <input
            type="text"
            placeholder="Search customers by name or pubkey…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
          />
          <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
            {loading ? (
              <div style={{ padding: '0.5rem', color: '#888', fontSize: '0.85rem' }}>Loading customers…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '0.5rem', color: '#888', fontSize: '0.85rem' }}>No customers match.</div>
            ) : (
              filtered.map((c) => (
                <div
                  key={c.pubkey}
                  onClick={() => onChange(c.pubkey)}
                  style={{
                    padding: '0.4rem 0.5rem', cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div style={{ fontSize: '0.9rem' }}>{c.name || 'Unknown'}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888', wordBreak: 'break-all' }}>{c.pubkey}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
      {error && (
        <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}
    </div>
  );
}
