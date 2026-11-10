import { useMemo, useState } from 'react';
import { call } from '../api.js';
import {
  Btn, Card, Empty, Field, Modal, PageHeader, Spinner, Table, useAsync, useToast
} from '../components.jsx';
import { clientRequestId } from '../lib/utils.js';

const STATUSES = ['InProgress', 'Completed', 'Delayed', 'Interrupted', 'Cancelled'];
const HOLD_CATEGORIES = ['Spare Parts', 'Customer Unavailable', 'Access Issue', 'Vehicle Breakdown', 'Weather', 'Other'];

function elapsed(task) {
  if (!task) return '—';
  const parse = (v) => new Date(v).getTime();
  if (task.turnaroundMinutes && task.endTime) {
    const m = Number(task.turnaroundMinutes);
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }
  if (task.startTime) {
    const m = Math.round((Date.now() - parse(task.startTime)) / 60000);
    if (!isFinite(m) || m < 0) return '—';
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }
  return '—';
}

function statusTone(status) {
  if (status === 'Completed') return 'ok';
  if (status === 'InProgress') return 'primary';
  if (status === 'OnHold' || status === 'HoldRequested') return 'bad';
  return 'warn';
}

export default function Jobs({ session, checkedIn }) {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ status: '', search: '' });
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => call('getTasks', { status: query.status, query: query.search, page: 1, pageSize: 200 }),
    [query.status, query.search]
  );

  const rows = (data && data.tasks) || [];

  async function requestHold(task) {
    const category = window.prompt(`Hold category for ${task.jobId}:`, HOLD_CATEGORIES[0]);
    if (!category) return;
    const reason = window.prompt('Hold reason (visible to supervisor):', '');
    if (reason === null) return;
    try {
      await call('jobHoldRequest', {
        jobId: task.jobId,
        holdCategory: category,
        holdReason: reason,
        holdSource: 'Manual',
        clientRequestId: clientRequestId(),
        mock: false
      });
      toast.push('Hold requested.', 'ok');
      reload();
    } catch (err) {
      toast.push(err.message, 'bad');
    }
  }

  const columns = useMemo(() => [
    { key: 'jobId', label: 'Job card', render: (r) => <strong>{r.jobId}</strong> },
    { key: 'complaintNo', label: 'Complaint', render: (r) => <span className="mono small">{r.complaintNo || '—'}</span> },
    { key: 'vehicleNo', label: 'Vehicle', render: (r) => r.vehicleNo || '—' },
    { key: 'client', label: 'Client', render: (r) => r.client || '—' },
    { key: 'assignedUserId', label: 'Assigned' },
    {
      key: 'status', label: 'Status',
      render: (r) => (
        <span className="row" style={{ gap: 6 }}>
          <span className={`badge ${statusTone(r.status)}`}>{r.status}</span>
          {r.status === 'HoldRequested' ? <span className="badge warn">Held: {r.holdCategory || 'pending'}</span> : null}
          {r.status === 'OnHold' ? <span className="badge bad">Approved {r.holdApprovedBy ? `· ${r.holdApprovedBy}` : ''}</span> : null}
        </span>
      )
    },
    { key: 'elapsed', label: 'Elapsed', render: (r) => elapsed(r) },
    { key: 'plateSource', label: 'Plate src', render: (r) => r.plateSource || '—' },
    { key: 'updatedBy', label: 'Last edit', render: (r) => r.updatedByName || r.updatedBy || '—' },
    {
      key: 'actions', label: 'Actions',
      render: (r) => (
        <div className="row" style={{ gap: 6 }}>
          <Btn size="sm" variant="ghost" onClick={() => { setEditing(r); setModalOpen(true); }}>Edit</Btn>
          {checkedIn && (r.status === 'InProgress' || r.status === 'Delayed')
            ? <Btn size="sm" variant="ghost" onClick={() => requestHold(r)}>Hold</Btn> : null}
        </div>
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [checkedIn]);

  return (
    <>
      <PageHeader
        title="Job Cards"
        subtitle="Create, update and hold field jobs with TAT tracking"
        actions={<Btn size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>New job</Btn>}
      />

      <Card pad={false}
        actions={
          <div className="row">
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 150 }}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input placeholder="Search job / vehicle / client" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />
            <Btn size="sm" variant="ghost" onClick={() => setQuery({ status, search: search.trim() })}>Apply</Btn>
          </div>
        }>
        {error ? <div className="hint-banner" style={{ margin: 16 }}>{error.message}</div> : null}
        {loading ? <Spinner label="Loading job cards…" /> : (
          <div style={{ padding: 16 }}>
            <Table columns={columns} rows={rows} empty="No job cards." rowKey={(r) => r.jobId} />
          </div>
        )}
      </Card>

      <JobModal
        open={modalOpen}
        task={editing}
        session={session}
        checkedIn={checkedIn}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); reload(); }}
      />
    </>
  );
}

function JobModal({ open, task, session, checkedIn, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(task && task.jobId);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const value = (k) => (form[k] !== undefined ? form[k] : (task?.[k] ?? ''));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    const targetStatus = value('status') || 'InProgress';
    if (targetStatus === 'InProgress' && !checkedIn && !editing) {
      setMsg('Complete photo check-in before starting a job.');
      return;
    }
    setBusy(true); setMsg('');
    const payload = {
      client: value('client'),
      hub: value('hub') || session.hub || '',
      assignedUserId: value('assignedUserId'),
      vehicleNo: value('vehicleNo'),
      status: targetStatus,
      delayCategory: value('delayCategory'),
      delayReason: value('delayReason'),
      checklist: value('checklist'),
      partsUsed: value('partsUsed'),
      serviceNotes: value('serviceNotes'),
      rootCause: value('rootCause'),
      resolutionNotes: value('resolutionNotes')
    };
    try {
      if (editing) {
        payload.jobId = task.jobId;
        payload.expectedVersion = task.version || task.expectedVersion || 1;
        await call('updateTaskStatus', payload);
        toast.push('Job updated.', 'ok');
      } else {
        await call('saveTask', payload);
        toast.push('Job created.', 'ok');
      }
      onSaved();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} wide title={editing ? `Edit ${task.jobId}` : 'New job card'} onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save job'}</Btn></>}>
      <div className="form-grid">
        <Field label="Client"><input value={value('client')} onChange={set('client')} /></Field>
        <Field label="Hub"><input value={value('hub')} onChange={set('hub')} placeholder={session.hub || 'HUB'} /></Field>
        <Field label="Assigned user id"><input value={value('assignedUserId')} onChange={set('assignedUserId')} /></Field>
        <Field label="Vehicle no"><input value={value('vehicleNo')} onChange={set('vehicleNo')} /></Field>
        <Field label="Status">
          <select value={value('status') || 'InProgress'} onChange={set('status')}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Delay category">
          <select value={value('delayCategory')} onChange={set('delayCategory')}>
            <option value="">— none —</option>
            {HOLD_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Delay reason"><input value={value('delayReason')} onChange={set('delayReason')} /></Field>
        <Field label="Root cause"><input value={value('rootCause')} onChange={set('rootCause')} /></Field>
        <Field label="Checklist"><input value={value('checklist')} onChange={set('checklist')} placeholder="Comma separated" /></Field>
        <Field label="Parts used"><input value={value('partsUsed')} onChange={set('partsUsed')} /></Field>
        <Field label="Service notes"><textarea value={value('serviceNotes')} onChange={set('serviceNotes')} /></Field>
        <Field label="Resolution notes"><textarea value={value('resolutionNotes')} onChange={set('resolutionNotes')} /></Field>
      </div>
      {msg ? <div className="login-msg">{msg}</div> : null}
    </Modal>
  );
}
