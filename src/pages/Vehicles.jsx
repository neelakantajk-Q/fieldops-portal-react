import { useState } from 'react';
import { call } from '../api.js';
import { Btn, Card, Modal, PageHeader, Spinner, Table, useAsync, useToast } from '../components.jsx';

export default function Vehicles() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, object = edit
  const detail = useAsync(() => call('vehicleList', { query }), [q]);

  const rows = (detail.data && detail.data.vehicles) || [];

  async function archive(vehicle) {
    if (!window.confirm(`Archive ${vehicle.plateNo}? Job history is kept.`)) return;
    try {
      await call('vehicleArchive', { plateNo: vehicle.plateNo });
      toast.push('Vehicle archived.', 'ok');
      detail.reload();
    } catch (err) { toast.push(err.message, 'bad'); }
  }

  return (
    <>
      <PageHeader title="Vehicles & OCR"
        subtitle="Fleet master with anomaly flags; OCR plate recognition runs on the mobile app"
        actions={<Btn size="sm" onClick={() => setEditing({})}>Add vehicle</Btn>} />

      <Card pad={false} title="Fleet"
        actions={
          <div className="row">
            <input placeholder="Search plate / hub" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} />
            <Btn size="sm" variant="ghost" onClick={() => setQ(search.trim())}>Search</Btn>
          </div>
        }>
        {detail.loading ? <Spinner label="Loading fleet…" /> : null}
        {detail.error ? <div className="hint-banner" style={{ margin: 16 }}>{detail.error.message}</div> : null}
        {detail.data ? (
          <div style={{ padding: 16 }}>
            <Table
              columns={[
                { key: 'display', label: 'Vehicle', render: (r) => <strong>{r.display || r.plateNo}</strong> },
                { key: 'hub', label: 'Hub', render: (r) => r.hub || '—' },
                { key: 'status', label: 'Status', render: (r) => <span className="badge neutral">{r.status}</span> },
                {
                  key: 'flags', label: 'Flags',
                  render: (r) => (r.anomalyFlags || []).length
                    ? (r.anomalyFlags || []).map((f) => <span key={f} className={`badge ${f === 'UNKNOWN_VEHICLE' ? 'warn' : 'bad'}`}>{f}</span>)
                    : <span className="muted">—</span>
                },
                {
                  key: 'actions', label: 'Actions',
                  render: (r) => (
                    <div className="row" style={{ gap: 6 }}>
                      <Btn size="sm" variant="ghost" onClick={() => setEditing(r)}>Edit</Btn>
                      <Btn size="sm" variant="danger" onClick={() => archive(r)}>Archive</Btn>
                    </div>
                  )
                }
              ]}
              rows={rows}
              empty="No vehicles in scope."
              rowKey={(r) => r.plateNo}
            />
          </div>
        ) : null}
      </Card>

      {editing !== null
        ? <VehicleModal initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); detail.reload(); }} />
        : null}
    </>
  );
}

function VehicleModal({ initial, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(initial.plateNo);
  const [form, setForm] = useState({
    plateNo: initial.plateNo || '',
    make: initial.make || '',
    model: initial.model || '',
    hub: initial.hub || '',
    assignedUserId: initial.assignedUserId || '',
    status: initial.status || 'Active',
    notes: initial.notes || ''
  });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    if (!form.plateNo.trim()) { setMsg('Vehicle number is required.'); return; }
    setBusy(true); setMsg('');
    try {
      await call(editing ? 'vehicleUpdate' : 'vehicleUpsert', form);
      toast.push('Vehicle saved.', 'ok');
      onSaved();
    } catch (err) {
      setMsg(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal open wide title={editing ? `Edit ${initial.plateNo}` : 'New vehicle'} onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save vehicle'}</Btn></>}>
      <div className="form-grid">
        <label className="field"><span className="field-label">Plate no *</span>
          <input value={form.plateNo} onChange={set('plateNo')} readOnly={editing} /></label>
        <label className="field"><span className="field-label">Status</span>
          <select value={form.status} onChange={set('status')}>
            {['Active', 'Inactive', 'UnderRepair', 'Archived'].map((s) => <option key={s}>{s}</option>)}
          </select></label>
        <label className="field"><span className="field-label">Make</span><input value={form.make} onChange={set('make')} /></label>
        <label className="field"><span className="field-label">Model</span><input value={form.model} onChange={set('model')} /></label>
        <label className="field"><span className="field-label">Hub</span><input value={form.hub} onChange={set('hub')} /></label>
        <label className="field"><span className="field-label">Assigned user</span><input value={form.assignedUserId} onChange={set('assignedUserId')} /></label>
        <label className="field full"><span className="field-label">Notes</span><textarea value={form.notes} onChange={set('notes')} /></label>
      </div>
      {msg ? <div className="login-msg">{msg}</div> : null}
    </Modal>
  );
}
