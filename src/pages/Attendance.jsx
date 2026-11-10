import { useState } from 'react';
import { call } from '../api.js';
import {
  Btn, Card, Empty, Field, Modal, PageHeader, Spinner, Table, formatWhen, useAsync
} from '../components.jsx';
import { clientRequestId, getPosition, minutesToText, preparePhoto, timeOnly, todayISO } from '../lib/utils.js';
import { useToast } from '../components.jsx';

export default function Attendance({ session, onSession }) {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [userId, setUserId] = useState('');
  const [query, setQuery] = useState({ date: todayISO(), userId: '' });
  const [checkInOpen, setCheckInOpen] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => call('getAttendance', { date: query.date, userId: query.userId, page: 1, pageSize: 100 }),
    [query.date, query.userId]
  );

  const rows = (data && data.daily) || [];

  async function checkOut() {
    if (!window.confirm('Record check-out now? This closes your active attendance for today.')) return;
    try {
      const pos = await getPosition(12000).catch(() => null);
      await call('attendanceCheckOut', {
        lat: pos ? pos.lat : 0,
        lng: pos ? pos.lng : 0,
        accuracy: pos ? pos.accuracy : 0,
        clientRequestId: clientRequestId()
      }, { queue: false });
      toast.push('Checked out.', 'ok');
      if (onSession) onSession({ checkedIn: false });
      reload();
    } catch (err) {
      toast.push(err.message, 'bad');
    }
  }

  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'userId', label: 'User' },
    { key: 'hubName', label: 'Hub' },
    { key: 'checkIn', label: 'In', render: (r) => timeOnly(r.checkIn) },
    { key: 'checkOut', label: 'Out', render: (r) => timeOnly(r.checkOut) },
    { key: 'minutes', label: 'Duration', render: (r) => minutesToText(r.minutes) },
    {
      key: 'status', label: 'Status',
      render: (r) => (
        <span className="row" style={{ gap: 6 }}>
          <span className={`badge ${r.status === 'Active' ? 'ok' : r.status === 'LoggedOut' ? 'neutral' : 'warn'}`}>{r.status}</span>
          {r.mock ? <span className="badge bad">MOCK</span> : null}
        </span>
      )
    },
    {
      key: 'proof', label: 'Proof',
      render: (r) => (r.checkInPhoto || r.checkOutPhoto
        ? <a className="btn ghost sm" href={r.checkInPhoto || r.checkOutPhoto} target="_blank" rel="noreferrer">View</a>
        : <span className="muted">—</span>)
    }
  ];

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Geofenced photo attendance with proof bundles"
        actions={
          <div className="row">
            {session.checkedIn ? <span className="badge ok">Checked in</span> : <span className="badge warn">Not checked in</span>}
            <Btn variant="ghost" size="sm" onClick={() => setCheckInOpen(true)} disabled={session.checkedIn}>Check in</Btn>
            <Btn variant="ghost" size="sm" onClick={checkOut}>Check out</Btn>
          </div>
        }
      />

      <Card pad={false} title="Daily register"
        actions={
          <div className="row">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 150 }} />
            <input placeholder="Filter user id" value={userId} onChange={(e) => setUserId(e.target.value)} style={{ width: 170 }} />
            <Btn size="sm" variant="ghost" onClick={() => setQuery({ date, userId: userId.trim() })}>Apply</Btn>
          </div>
        }>
        {error ? <div className="hint-banner" style={{ margin: 16 }}>{error.message}</div> : null}
        {loading ? <Spinner label="Loading attendance…" /> : (
          <div style={{ padding: 16 }}>
            <Table columns={columns} rows={rows} empty="No attendance for this day." rowKey={(r, i) => `${r.userId}-${r.date}-${i}`} />
          </div>
        )}
      </Card>

      <CheckInModal
        open={checkInOpen}
        hub={session.hub}
        onClose={() => setCheckInOpen(false)}
        onDone={() => { if (onSession) onSession({ checkedIn: true }); setCheckInOpen(false); reload(); }}
      />
    </>
  );
}

function CheckInModal({ open, hub, onClose, onDone }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [useGeo, setUseGeo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit() {
    if (!file) { setMsg('Select the attendance photo first.'); return; }
    setBusy(true); setMsg('Preparing photo…');
    try {
      const photo = await preparePhoto(file);
      const pos = useGeo ? await getPosition(12000).catch(() => null) : null;
      setMsg('Uploading…');
      await call('attendanceCheckIn', {
        photoBase64: photo.full,
        photoThumbBase64: photo.thumb,
        lat: pos ? pos.lat : 0,
        lng: pos ? pos.lng : 0,
        accuracy: pos ? pos.accuracy : 0,
        withinGeoFence: Boolean(pos),
        hubName: hub || '',
        clientRequestId: clientRequestId()
      }, { queue: false });
      toast.push('Check-in recorded.', 'ok');
      setFile(null); setMsg('');
      onDone();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Photo check-in" onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={submit} disabled={busy}>{busy ? 'Working…' : 'Check in'}</Btn></>}>
      <div className="hint-info">Capture a live selfie at the site. GPS accuracy and watermark metadata are stored with the proof.</div>
      <Field label="Attendance photo">
        <input type="file" accept="image/*" capture="user" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </Field>
      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" checked={useGeo} onChange={(e) => setUseGeo(e.target.checked)} style={{ width: 'auto' }} />
        <span className="small">Attach GPS location (geofence check)</span>
      </label>
      {msg ? <div className="login-msg">{msg}</div> : null}
      <span className="muted small">Time: {formatWhen(new Date().toISOString())}</span>
    </Modal>
  );
}
