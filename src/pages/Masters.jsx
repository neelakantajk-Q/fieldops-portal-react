import { useState } from 'react';
import { call } from '../api.js';
import { Btn, Card, Empty, Field, Modal, PageHeader, Spinner, useAsync, useToast } from '../components.jsx';

export default function Masters() {
  const toast = useToast();
  const [draft, setDraft] = useState(null); // null | {type:'REGION'|'HUB'|'CLIENT', ...}
  const masters = useAsync(() => call('mastersList', {}), []);
  const m = masters.data || {};
  const regions = m.regions || [];
  const hubs = m.hubs || [];
  const clients = m.clients || [];
  const canEdit = Boolean(m.canEdit);

  function saveDraft(payload) {
    return call(draft.existing ? 'masterUpdate' : 'masterCreate', payload)
      .then(() => { toast.push('Master saved.', 'ok'); setDraft(null); masters.reload(); })
      .catch((err) => { throw err; });
  }

  return (
    <>
      <PageHeader title="Master Data"
        subtitle="Region → hub hierarchy and clients. Hubs carry GPS geofence radius for attendance."
        actions={canEdit ? <Btn size="sm" onClick={() => setDraft({ type: 'REGION' })}>Add master</Btn> : <span className="badge warn">Read-only</span>} />

      {masters.loading ? <Spinner label="Loading masters…" /> : null}
      {masters.error ? <div className="hint-banner">{masters.error.message}</div> : null}

      {masters.data ? (
        (!regions.length && !hubs.length && !clients.length) ? <Empty>No master data in scope.</Empty> : (
          <>
            <Card title="Regions & hubs" subtitle="Hierarchy: each region hosts hubs; the hub in-charge is the supervisor assigned in Admin → Users">
              {!regions.length ? <Empty>No regions.</Empty> : (
                <div className="stack">
                  {regions.map((region) => {
                    const regionHubs = hubs.filter((h) => h.region === region.name);
                    return (
                      <div key={region.name} className="card" style={{ marginBottom: 0, padding: '12px 16px' }}>
                        <div className="row between">
                          <div>
                            <strong>{region.name}</strong>
                            <div className="muted small">Region · {regionHubs.length} hubs</div>
                          </div>
                          {canEdit ? <Btn size="sm" variant="ghost" onClick={() => setDraft({ type: 'HUB', region: region.name })}>Add hub</Btn> : null}
                        </div>
                        {regionHubs.length ? (
                          <div style={{ marginTop: 10 }}>
                            {regionHubs.map((h) => (
                              <div key={h.hubId || h.name} className="row between" style={{ padding: '6px 0', borderTop: '1px dashed var(--line)' }}>
                                <div>
                                  <span className="badge primary">{h.name}</span>
                                  <span className="muted small" style={{ marginLeft: 8 }}>
                                    {h.hubId} · lat {h.lat || '—'}, lng {h.lng || '—'} · geofence {h.radiusMeters || '—'} m
                                  </span>
                                </div>
                                {canEdit ? <Btn size="sm" variant="ghost" onClick={() => setDraft({ type: 'HUB', existing: true, ...h })}>Edit</Btn> : null}
                              </div>
                            ))}
                          </div>
                        ) : <div className="muted small" style={{ marginTop: 8 }}>No hubs in this region yet.</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card title="Clients" pad={true}
              actions={canEdit ? <Btn size="sm" variant="ghost" onClick={() => setDraft({ type: 'CLIENT' })}>Add client</Btn> : null}>
              <div className="stack">
                {clients.length ? clients.map((c) => (
                  <div key={c.clientId || c.name} className="row between">
                    <div>
                      <strong>{c.name}</strong>
                      <div className="muted small">{c.clientId} · {c.address || '—'} · hub {c.hubId || '—'}</div>
                    </div>
                    {canEdit ? <Btn size="sm" variant="ghost" onClick={() => setDraft({ type: 'CLIENT', existing: true, ...c })}>Edit</Btn> : null}
                  </div>
                )) : <Empty>No clients.</Empty>}
              </div>
            </Card>
          </>
        )
      ) : null}

      {draft ? <MasterModal draft={draft} hubs={hubs} regions={regions} onClose={() => setDraft(null)} onSave={saveDraft} /> : null}
    </>
  );
}

function MasterModal({ draft, hubs, regions, onClose, onSave }) {
  const [form, setForm] = useState({
    name: draft.name || '',
    region: draft.region || '',
    hubId: draft.hubId || '',
    address: draft.address || '',
    lat: draft.lat || '',
    lng: draft.lng || '',
    radiusMeters: draft.radiusMeters || 200
  });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const titles = { REGION: 'New region', HUB: draft.existing ? 'Edit hub' : 'New hub', CLIENT: draft.existing ? 'Edit client' : 'New client' };

  async function save() {
    if (!form.name || (draft.type === 'HUB' && !form.region)) { setMsg('Required fields missing.'); return; }
    setBusy(true); setMsg('');
    try {
      const payload = { type: draft.type, name: form.name };
      if (draft.type === 'HUB') { payload.region = form.region; payload.lat = form.lat; payload.lng = form.lng; payload.radiusMeters = form.radiusMeters; }
      if (draft.type === 'CLIENT') { payload.hubId = form.hubId; payload.address = form.address; payload.lat = form.lat; payload.lng = form.lng; }
      if (draft.hubId || draft.clientId || draft.name) {
        payload.masterId = draft.hubId || draft.clientId || draft.name;
      }
      await onSave(payload);
    } catch (err) {
      setMsg(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal open wide title={titles[draft.type]} onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn></>}>
      <div className="form-grid">
        <Field label={draft.type === 'REGION' ? 'Region name *' : 'Name *'}><input value={form.name} onChange={set('name')} /></Field>
        {draft.type !== 'REGION' ? (
          <Field label="Region *" hint="Hierarchy: hub belongs to a region">
            <select value={form.region} onChange={set('region')}>
              <option value="">— region —</option>
              {regions.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
          </Field>
        ) : null}
        {draft.type === 'CLIENT' ? (
          <Field label="Hub">
            <select value={form.hubId} onChange={set('hubId')}>
              <option value="">— none —</option>
              {hubs.map((h) => <option key={h.hubId} value={h.hubId}>{h.name}</option>)}
            </select>
          </Field>
        ) : null}
        {draft.type !== 'REGION' ? (
          <><Field label="Latitude"><input value={form.lat} onChange={set('lat')} /></Field>
            <Field label="Longitude"><input value={form.lng} onChange={set('lng')} /></Field></>
        ) : null}
        {draft.type === 'HUB' ? (
          <Field label="Geofence radius (m)" hint="Attendance check-ins validate against this radius">
            <input type="number" value={form.radiusMeters} onChange={set('radiusMeters')} />
          </Field>
        ) : null}
        {draft.type === 'CLIENT' ? <Field label="Address"><input value={form.address} onChange={set('address')} /></Field> : null}
      </div>
      {msg ? <div className="login-msg">{msg}</div> : null}
    </Modal>
  );
}
