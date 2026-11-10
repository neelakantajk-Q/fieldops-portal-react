import { DEVICE_KEY } from '../config.js';

/** SHA-256 hex digest of a string (browser Web Crypto). */
export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Stable per-device identifier, persisted locally (mirrors legacy DeviceUUID). */
export function deviceUuid() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = 'DEV-' + uuid().slice(0, 8).toUpperCase() + '-' + uuid().slice(0, 8).toUpperCase();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch (_) {
    return 'DEV-UNKNOWN';
  }
}

/** Persisted unique id used for idempotent writes (legacy clientRequestId). */
export function clientRequestId() {
  return uuid();
}

/** Haversine distance in metres. */
export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Detects a mock/simulated location provider.
 * On Android WebView the host app can expose window.FieldOpsNative.isMockProvider().
 * In the browser we cannot prove it, so we return false and rely on accuracy.
 */
export function isMockProvider() {
  try {
    const native = window.FieldOpsNative || window.AndroidBridge;
    if (native && typeof native.isMockProvider === 'function') {
      return Boolean(native.isMockProvider());
    }
  } catch (_) {}
  return false;
}

/** Full hardware/device UUID exposed by the host app when available. */
export function hardwareDeviceUUID() {
  try {
    const native = window.FieldOpsNative || window.AndroidBridge;
    if (native && typeof native.getDeviceUUID === 'function') {
      const value = native.getDeviceUUID();
      if (value) return String(value);
    }
  } catch (_) {}
  return deviceUuid();
}

/** Promisified geolocation with a timeout. */
export function getPosition(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp
      }),
      (err) => reject(new Error(err.message || 'Unable to read GPS position.')),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

/** Sequential-ish job card code: JC-YYYYMM-HUB-XXXX */
export function nextJobCode(hubCode, sequenceNumber) {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const hub = String(hubCode || 'HUB').replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase() || 'HUB';
  const seq = String(sequenceNumber || 1).padStart(4, '0');
  return `JC-${ym}-${hub}-${seq}`;
}

/**
 * Burns telemetry text into the JPEG pixels before upload.
 * Returns a data URL of the watermarked image.
 */
export async function watermarkImage(file, lines) {
  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const boxHeight = 22 + lines.length * 20;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    ctx.fillText(String(line), 12, canvas.height - boxHeight + 10 + i * 20);
  });

  return canvas.toDataURL('image/jpeg', 0.82);
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the captured image.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode the captured image.'));
    img.src = src;
  });
}

/** Resizes a File into { full, thumb } JPEG data URLs for attendance proof. */
export async function preparePhoto(file, fullMax = 1024, fullQ = 0.72) {
  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);
  const toData = (maxSize, quality) => {
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  };
  return { full: toData(fullMax, fullQ), thumb: toData(256, 0.5) };
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function timeOnly(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function minutesToText(minutes) {
  const m = Number(minutes);
  if (!isFinite(m) || m <= 0) return '—';
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

export function minutesBetween(start, end) {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!isFinite(a) || !isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 60000));
}
