/**
 * Reusable confirmation dialog with overlay backdrop.
 */

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="bsp-confirm-overlay" onClick={onCancel}>
      <div className="bsp-confirm-box" onClick={e => e.stopPropagation()}>
        <h3 className="bsp-confirm-title">{title}</h3>
        <p className="bsp-confirm-message">{message}</p>
        <div className="bsp-confirm-buttons">
          <button className="bsp-confirm-cancel" onClick={onCancel}>Cancel</button>
          <button className="bsp-confirm-ok" onClick={onConfirm}>Continue</button>
        </div>
      </div>
    </div>
  );
}
