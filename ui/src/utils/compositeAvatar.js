/**
 * Build the Tapestry Assistant's stamped avatar: the owner's picture with the
 * brand mark on one corner (ta-avatar #3, ADR 0003).
 *
 * This runs in the owner's browser rather than on the server so the preview and
 * the published artefact are literally the same pixels — the canvas that is shown
 * is the canvas that gets uploaded — and so no native image library has to enter
 * the Docker image.
 *
 * The source image arrives from /api/assistant/owner-avatar, which is same-origin,
 * so the canvas is never tainted and toBlob() always succeeds.
 */

export const COMPOSITE_SIZE = 512;
export const BADGE_SRC = '/ta-badge.svg';
/** Badge diameter as a fraction of the canvas. Matches the in-app badge's weight. */
const BADGE_FRACTION = 0.34;
/** Inset from the bottom-right edge, as a fraction of the canvas. */
const BADGE_INSET = 0.035;
/** Ring behind the badge so it separates from a busy photo. */
const RING_FRACTION = 0.03;
const RING_COLOR = '#0d1117';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

/** Cover-fit: fill the square, cropping the long edge, like every avatar UI. */
function drawCover(ctx, img, size) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('the source image has no dimensions');
  const scale = Math.max(size / w, size / h);
  const dw = w * scale;
  const dh = h * scale;
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
}

/**
 * @param {Blob} sourceBlob  the owner's picture, as fetched from the proxy
 * @returns {Promise<{ blob: Blob, dataUrl: string }>}
 */
export async function buildCompositeAvatar(sourceBlob) {
  const objectUrl = URL.createObjectURL(sourceBlob);
  try {
    const [source, badge] = await Promise.all([loadImage(objectUrl), loadImage(BADGE_SRC)]);

    const size = COMPOSITE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    drawCover(ctx, source, size);

    const badgeSize = size * BADGE_FRACTION;
    const inset = size * BADGE_INSET;
    const cx = size - inset - badgeSize / 2;
    const cy = size - inset - badgeSize / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, badgeSize / 2 + size * RING_FRACTION, 0, Math.PI * 2);
    ctx.fillStyle = RING_COLOR;
    ctx.fill();
    ctx.restore();

    ctx.drawImage(badge, cx - badgeSize / 2, cy - badgeSize / 2, badgeSize, badgeSize);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('the browser produced no image'))), 'image/png');
    });
    return { blob, dataUrl: canvas.toDataURL('image/png') };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
