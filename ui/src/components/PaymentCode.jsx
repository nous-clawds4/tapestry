import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function PaymentCode({ payment }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(payment.payload, { errorCorrectionLevel: 'M', margin: 1, scale: 6 })
      .then(url => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [payment.payload]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payment.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  const label = 'BOLT11 invoice (one-time)';
  const wallet = 'Scan or paste into your Lightning wallet to pay this exact amount.';

  return (
    <div style={{ marginTop: 8, padding: '0.6rem', background: '#010409', border: '1px solid #30363d', borderRadius: 4 }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.85, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: 8 }}>{wallet}</div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="Payment code QR"
            style={{ width: 160, height: 160, background: '#fff', padding: 4, borderRadius: 4, flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <textarea
            readOnly
            value={payment.payload}
            rows={5}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.7rem', background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, padding: 4, resize: 'vertical' }}
            onFocus={e => e.target.select()}
          />
          <button
            type="button"
            onClick={handleCopy}
            style={{ marginTop: 4, padding: '0.25rem 0.6rem', background: 'transparent', color: '#9aa0a6', border: '1px solid #30363d', borderRadius: 4, fontSize: '0.7rem', cursor: 'pointer' }}
          >
            {copied ? 'copied' : 'copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
