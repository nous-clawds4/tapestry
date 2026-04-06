/**
 * NIP-56 Report modal — lets the user select a report reason and submit.
 */

import { useState } from 'react';

const REPORT_TYPES = [
  { value: 'spam',          label: 'Spam',                 description: 'Excessive or unsolicited messages' },
  { value: 'impersonation', label: 'Impersonation',        description: 'Pretending to be someone else' },
  { value: 'nudity',        label: 'Nudity',               description: 'Nudity or sexual content' },
  { value: 'profanity',     label: 'Profanity',            description: 'Profane or hateful content' },
  { value: 'illegal',       label: 'Illegal',              description: 'Illegal activity' },
  { value: 'malware',       label: 'Malware',              description: 'Virus, trojan, or malicious link' },
  { value: 'other',         label: 'Other',                description: 'Other reason (describe below)' },
];

export default function ReportModal({ open, onSubmit, onCancel, loading }) {
  const [selectedType, setSelectedType] = useState('spam');
  const [note, setNote] = useState('');

  if (!open) return null;

  function handleSubmit() {
    onSubmit(selectedType, selectedType === 'other' ? note : '');
  }

  return (
    <div className="bsp-report-overlay" onClick={onCancel}>
      <div className="bsp-report-box" onClick={e => e.stopPropagation()}>
        <h3 className="bsp-report-title">Report User</h3>
        <p className="bsp-report-desc">Select a reason for this report. This will publish a NIP-56 report event.</p>

        <div className="bsp-report-options">
          {REPORT_TYPES.map(rt => (
            <label key={rt.value} className={`bsp-report-option ${selectedType === rt.value ? 'selected' : ''}`}>
              <input
                type="radio"
                name="reportType"
                value={rt.value}
                checked={selectedType === rt.value}
                onChange={() => setSelectedType(rt.value)}
              />
              <div className="bsp-report-option-text">
                <span className="bsp-report-option-label">{rt.label}</span>
                <span className="bsp-report-option-desc">{rt.description}</span>
              </div>
            </label>
          ))}
        </div>

        {selectedType === 'other' && (
          <textarea
            className="bsp-report-textarea"
            placeholder="Describe the reason for this report..."
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
          />
        )}

        <div className="bsp-report-buttons">
          <button className="bsp-report-cancel" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="bsp-report-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
