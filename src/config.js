const STORAGE_KEY = 'fieldops_api_url';

/**
 * Encoded production endpoint (legacy Google Apps Script dispatcher).
 * Kept encoded in source exactly like the shipped PWA so the raw URL is not
 * plainly greppable. Override at runtime from the login screen or at build
 * time with VITE_API_BASE_URL (e.g. to point at PocketBase later).
 */
const DEFAULT_ENDPOINT_B64 =
  'aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J6bGZ3dEk5emVLMG9VYk95WlEtZXpUMkZCbENLZnptOTRiYWVEOXNSakFMN3QtRFRZWTlXNGk4ZEtLME5YZk9CUmV3Zy9leGVj';

function decodeDefaultEndpoint() {
  try {
    return atob(DEFAULT_ENDPOINT_B64);
  } catch (_) {
    return '';
  }
}

export function getApiBaseUrl() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored.replace(/\/$/, '');
  } catch (_) {}
  const env = import.meta.env.VITE_API_BASE_URL;
  if (env) return String(env).replace(/\/$/, '');
  return decodeDefaultEndpoint();
}

export function setApiBaseUrl(url) {
  const clean = String(url || '').trim().replace(/\/$/, '');
  try {
    if (clean) localStorage.setItem(STORAGE_KEY, clean);
    else localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
  return clean;
}

export function isDefaultEndpoint() {
  try {
    return !localStorage.getItem(STORAGE_KEY) && !import.meta.env.VITE_API_BASE_URL;
  } catch (_) {
    return true;
  }
}

export const SESSION_KEY = 'fieldops_session';
export const DEVICE_KEY = 'fieldops_device_uuid';
export const BRAND = {
  product: 'FieldOps',
  tagline: 'Field Operations & Vehicle CAPA',
  primary: '#a6ce39'
};
