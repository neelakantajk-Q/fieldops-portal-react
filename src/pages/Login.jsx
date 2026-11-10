import { useState } from 'react';
import { ApiError, ensureOk, post, saveSession } from '../api.js';
import { deviceUuid } from '../lib/utils.js';
import { getApiBaseUrl, isDefaultEndpoint, setApiBaseUrl, BRAND } from '../config.js';
import { Btn, Field } from '../components.jsx';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [endpoint, setEndpoint] = useState(getApiBaseUrl());
  const [showEndpoint, setShowEndpoint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState('');

  async function doLogin(force = false) {
    if (!username.trim() || !password) {
      setMessage('Enter your username and password.');
      return;
    }
    setBusy(true);
    setMessage('');
    setProgress('Checking credentials…');
    try {
      if (endpoint.trim()) setApiBaseUrl(endpoint.trim());
      const res = await post('login', {
        username: username.trim(),
        password,
        deviceUUID: deviceUuid(),
        forceTakeover: Boolean(force)
      }, { queue: false, timeoutMs: 45000 });

      if (res && res.sessionConflict) {
        setBusy(false);
        setProgress('');
        const active = res.activeDevice || 'another device';
        if (window.confirm(`This account is signed in on ${active}. Sign out that device and continue here?`)) {
          return doLogin(true);
        }
        return;
      }

      ensureOk(res);
      setProgress('Opening session…');
      saveSession({
        token: res.sessionToken,
        userId: res.userId,
        username: res.username,
        fullName: res.fullName || '',
        businessCategory: res.businessCategory || '',
        role: res.role,
        hub: res.hub,
        scope: res.scope,
        moduleRights: res.moduleRights,
        expiresAt: res.expiresAt,
        sessionDate: res.sessionDate,
        checkedIn: Boolean(res.checkedIn)
      });
      onLogin();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Unable to sign in.');
      setProgress('');
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <aside className="login-hero">
        <div className="brand-mark">F</div>
        <div>
          <h1>Field operations, without the paperwork.</h1>
          <p>{BRAND.tagline}. Attendance, job cards, vehicle uptime, CAPA holds and MIS reporting in one lean portal — built for technicians in the field and supervisors at the hub.</p>
        </div>
        <div className="hero-points">
          <div className="hero-point"><b>GPS</b> geofenced attendance with photo proof</div>
          <div className="hero-point"><b>TAT</b> turnaround tracking with automatic holds</div>
          <div className="hero-point"><b>CAPA</b> vehicle uptime and compliance reporting</div>
          <div className="hero-point"><b>Roles</b> technician → supervisor → moderator → admin</div>
        </div>
      </aside>

      <main className="login-panel">
        <div className="login-card">
          <div className="row" style={{ marginBottom: 14 }}>
            <div className="brand-mark" style={{ width: 30, height: 30, fontSize: 14 }}>F</div>
            <strong>{BRAND.product}</strong>
          </div>
          <h2>Sign in</h2>
          <p className="muted small" style={{ marginTop: 2, marginBottom: 18 }}>
            Use your assigned field credentials. Sessions are single-device.
          </p>

          <div className="stack">
            <Field label="Username">
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
                placeholder="e.g. supervisor1" />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" placeholder="••••••••"
                onKeyDown={(e) => e.key === 'Enter' && doLogin(false)} />
            </Field>

            <div className="login-msg">{message}</div>

            <Btn block onClick={() => doLogin(false)} disabled={busy}>
              {busy ? (progress || 'Signing in…') : 'Sign in'}
            </Btn>

            <button type="button" className="api-toggle" onClick={() => setShowEndpoint((v) => !v)}>
              {showEndpoint ? 'Hide server settings' : `Server: ${isDefaultEndpoint() ? 'default' : 'custom'}`}
            </button>
            {showEndpoint ? (
              <Field label="API endpoint" hint="Leave as-is for the hosted backend, or point at your PocketBase gateway.">
                <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} spellCheck={false} className="mono" />
              </Field>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
