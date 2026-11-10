import { getApiBaseUrl, SESSION_KEY } from './config.js';
import { deviceUuid, clientRequestId } from './lib/utils.js';

export class ApiError extends Error {
  constructor(message, response) {
    super(message);
    this.name = 'ApiError';
    this.response = response;
    this.code = response && response.code;
  }
}

let session = loadSession();

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch (_) {
    return null;
  }
}

export function saveSession(next) {
  session = next;
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  } catch (_) {}
  return session;
}

export function clearSession() {
  return saveSession(null);
}

export function currentSession() {
  return session;
}

export function isAuthenticated() {
  if (!session || !session.token) return false;
  if (session.expiresAt) {
    const exp = new Date(session.expiresAt).getTime();
    if (isFinite(exp) && exp > 0 && Date.now() > exp) return false;
  }
  return true;
}

/**
 * Mirrors the legacy `doPost` contract:
 *   POST <endpoint>  Content-Type: text/plain
 *   { action, clientRequestId, deviceUUID, sessionToken, ...payload }
 */
export async function post(action, payload = {}, opts = {}) {
  const url = opts.endpoint || getApiBaseUrl();
  if (!url) throw new ApiError('No API endpoint configured. Set it on the login screen.');

  const body = JSON.stringify({
    action,
    clientRequestId: payload.clientRequestId || clientRequestId(),
    deviceUUID: deviceUuid(),
    sessionToken: session && session.token ? session.token : '',
    ...payload
  });

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), opts.timeoutMs || 45000) : null;

  let response;
  let text;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow',
      signal: controller ? controller.signal : undefined
    });
    text = await response.text();
  } catch (err) {
    if (err && err.name === 'AbortError') throw new ApiError('The server took too long to respond. Try again.');
    throw new ApiError('Network error — check the connection or endpoint and retry.');
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ApiError(`Server returned HTTP ${response.status}.`, { code: response.status });
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new ApiError('Server returned an unexpected (non-JSON) response. Verify the endpoint URL.');
  }
  return data;
}

/** Treats `{ok:true}` / `{success:true}` envelopes as success; throws otherwise. */
export function ensureOk(res) {
  if (!res) throw new ApiError('Empty response from the server.');
  const ok = res.ok === true || res.success === true;
  if (!ok && res.sessionConflict) return res;
  if (!ok) {
    throw new ApiError(res.message || res.error || `Request failed (${res.code || 'UNKNOWN'}).`, res);
  }
  return res;
}

export async function call(action, payload = {}, opts = {}) {
  return ensureOk(await post(action, payload, opts));
}
