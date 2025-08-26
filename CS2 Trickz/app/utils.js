/**
 * utils.js
 * Small utilities: id generation, YouTube helpers, image compression, date utils.
 */

// Crockford's Base32 for ULID-like IDs
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * utils.id()
 * ULID-like unique, lexicographically sortable ID
 */
export function id() {
  const now = Date.now();
  const timeChars = encodeTime(now, 10);
  const randChars = encodeRandom(16);
  return timeChars + randChars;
}

function encodeTime(time, len) {
  let out = '';
  for (let i = len - 1; i >= 0; i--) {
    out = BASE32[time % 32] + out;
    time = Math.floor(time / 32);
  }
  return out;
}

function encodeRandom(len) {
  let out = '';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) {
    out += BASE32[arr[i] % 32];
  }
  return out;
}

/**
 * utils.getYoutubeId(urlOrId)
 * Accepts a YouTube URL or raw ID and returns the 11-char video ID if found, else ''.
 */
export function getYoutubeId(urlOrId) {
  if (!urlOrId) return '';
  const raw = String(urlOrId).trim();
  // If it already looks like an ID
  if (/^[\w-]{11}$/.test(raw)) return raw;

  // Try parsing URL formats
  try {
    const u = new URL(raw);
    // youtu.be/VIDEOID
    if (u.hostname.includes('youtu.be')) {
      const idCandidate = u.pathname.split('/').filter(Boolean)[0];
      return /^[\w-]{11}$/.test(idCandidate) ? idCandidate : '';
    }
    // youtube.com/watch?v=VIDEOID
    if (u.searchParams.has('v')) {
      const idCandidate = u.searchParams.get('v') || '';
      return /^[\w-]{11}$/.test(idCandidate) ? idCandidate : '';
    }
    // youtube.com/embed/VIDEOID
    if (u.pathname.includes('/embed/')) {
      const idCandidate = u.pathname.split('/embed/')[1].split(/[/?#&]/)[0];
      return /^[\w-]{11}$/.test(idCandidate) ? idCandidate : '';
    }
  } catch {
    // not a URL
  }
  return '';
}

/**
 * utils.buildYouTubeEmbed(input, startSeconds?)
 * Returns an embed URL string (privacy-enhanced domain) or '' if invalid.
 */
export function buildYouTubeEmbed(input, startSeconds) {
  const vid = getYoutubeId(input);
  if (!vid) return '';
  const base = `https://www.youtube-nocookie.com/embed/${vid}`;
  const params = new URLSearchParams({
    modestbranding: '1',
    rel: '0',
    autoplay: '0'
  });
  if (Number.isFinite(startSeconds) && startSeconds > 0) {
    params.set('start', String(Math.floor(startSeconds)));
  }
  return `${base}?${params.toString()}`;
}

/**
 * utils.youtubeThumb(input)
 * Returns a thumbnail URL for a given URL or ID, or '' if invalid.
 */
export function youtubeThumb(input) {
  const vid = getYoutubeId(input);
  if (!vid) return '';
  return `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
}
/**
 * utils.extractMedalSrc(input)
 * Accepts a Medal.tv iframe embed HTML or a Medal.tv URL and returns a usable src URL, else ''.
 */
export function extractMedalSrc(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  // If iframe HTML was pasted, extract its src
  const m = raw.match(/<iframe[^>]*\s+src=['"]([^'"]+)['"][^>]*>\s*<\/iframe>/i);
  if (m && m[1]) return m[1];

  // If it's a URL, accept medal.tv hosts
  try {
    const u = new URL(raw);
    if (u.hostname.includes('medal.tv')) return u.toString();
  } catch {
    // not a URL
  }
  return '';
}

/**
 * utils.compressImage(fileOrBlob, opts)
 * Returns a dataURL after resizing/compressing.
 * - opts.maxWidth default 1200
 * - opts.quality default 0.7
 * Preserves PNG for transparent images, otherwise JPEG.
 */
export async function compressImage(fileOrBlob, opts = {}) {
  const { maxWidth = 1200, quality = 0.7 } = opts;
  const isFile = 'type' in (fileOrBlob || {});
  const type = isFile ? (fileOrBlob.type || '') : '';
  const isPng = type.includes('png');

  const dataURL = await readAsDataURL(fileOrBlob);
  const img = await loadImage(dataURL);

  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const targetW = Math.round(img.width * scale);
  const targetH = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { alpha: isPng });
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // If source had transparency, keep PNG; else use JPEG
  const outType = isPng ? 'image/png' : 'image/jpeg';
  const outQuality = isPng ? undefined : quality;

  return canvas.toDataURL(outType, outQuality);
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * utils.formatDateForFile(d)
 * Returns YYYYMMDD for filenames.
 */
export function formatDateForFile(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}