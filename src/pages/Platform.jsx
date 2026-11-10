import { useState } from 'react';
import { call } from '../api.js';
import { Btn, Card, PageHeader, Spinner, Stat, useAsync, useToast } from '../components.jsx';

export default function Platform() {
  const toast = useToast();
  const settings = useAsync(() => call('getPlatformSettings', {}), []);
  const s = (settings.data && (settings.data.platform || settings.data.settings || settings.data)) || {};

  return (
    <>
      <PageHeader title="Platform" subtitle="White-label, seats, tenant status and integration URLs" />

      {settings.loading ? <Spinner label="Loading platform settings…" /> : null}
      {settings.error ? <div className="hint-banner">{settings.error.message}</div> : null}

      {settings.data ? (
        <>
          <div className="grid cols-auto">
            <Stat label="Seats allocated" value={s.seatAllocation || s.seats || '—'} />
            <Stat label="Seats used" value={s.seatsUsed || '—'} tone="warn" />
            <Stat label="Tenants" value={s.tenants || '—'} />
          </div>

          <UrlCards s={s} toast={toast} refresh={settings.reload} />
          {s.stack ? <StackCard stack={s.stack} toast={toast} refresh={settings.reload} /> : null}
        </>
      ) : null}
    </>
  );
}

function UrlCards({ s, toast, refresh }) {
  const [urls, setUrls] = useState({
    apiEndpoint: s.apiEndpoint || '',
    portalUrl: s.portalUrl || '',
    splashUrl: s.splashUrl || ''
  });
  const set = (k) => (e) => setUrls({ ...urls, [k]: e.target.value });

  async function save() {
    try {
      await call('updatePlatformUrls', urls);
      toast.push('URLs updated.', 'ok');
      refresh();
    } catch (err) { toast.push(err.message, 'bad'); }
  }

  return (
    <Card title="Integration URLs" className="mt"
      actions={<Btn size="sm" onClick={save}>Save URLs</Btn>}>
      <div className="form-grid">
        <label className="field"><span className="field-label">API endpoint</span>
          <input className="mono" value={urls.apiEndpoint} onChange={set('apiEndpoint')} /></label>
        <label className="field"><span className="field-label">Portal URL</span>
          <input className="mono" value={urls.portalUrl} onChange={set('portalUrl')} /></label>
        <label className="field"><span className="field-label">Splash / app config URL</span>
          <input className="mono" value={urls.splashUrl} onChange={set('splashUrl')} /></label>
      </div>
    </Card>
  );
}

function StackCard({ stack, toast, refresh }) {
  const [form, setForm] = useState({
    apiEndpoint: stack.apiEndpoint || '',
    firebaseConfig: stack.firebaseConfig || ''
  });
  async function save() {
    try {
      await call('updateFirebaseSettings', { firebaseConfig: form.firebaseConfig });
      toast.push('Firebase settings saved.', 'ok');
      refresh();
    } catch (err) { toast.push(err.message, 'bad'); }
  }
  return (
    <Card title="Sync stack" subtitle="Firebase push config used by live dashboards and the Android app">
      <div className="form-grid">
        <label className="field"><span className="field-label">Firebase config (JSON)</span>
          <textarea className="mono" value={form.firebaseConfig} onChange={(e) => setForm({ ...form, firebaseConfig: e.target.value })} /></label>
      </div>
      <div className="row mt"><Btn size="sm" onClick={save}>Save</Btn></div>
    </Card>
  );
}
