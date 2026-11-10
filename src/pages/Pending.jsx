import { useState } from 'react';
import { call } from '../api.js';
import { Badge, Btn, Card, Field, Modal, PageHeader, Spinner, Table, Tabs, formatWhen, useAsync, useToast } from '../components.jsx';
import { clientRequestId } from '../lib/utils.js';

const ROLE_RANK = { Technician: 1, Supervisor: 2, Moderator: 3, Administrator: 4, Platform: 99 };

export default function Pending({ session }) {
  const toast = useToast();
  const rank = ROLE_RANK[session.role] || 1;
  const [tab, setTab] = useState('pending');
  const [decisionJob, setDecisionJob] = useState(null);

  const holds = useAsync(() => call('getHoldRequests', {}), []);
  const unapproved = [];

  const h = holds.data || {};
  const logVisible = rank >= 2;
  const tabs = [
    { id: 'pending', label: 'Hold requests', count: (h.pending || []).length },
    { id: 'onHold', label: 'On hold', count: (h.onHold || []).length },
    { id: 'history', label: 'History', count: (h.history || []).length },
    ...(rank >= 2 && unapproved.length ? [{ id: 'unapproved', label: 'Unapproved jobs' }] : []),
    ...(logVisible ? [{ id: 'log', label: 'Decision log' }] : []),
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  if (holds.loading) return <><PageHeader title="Pending Jobs" /><Spinner label="Loading hold queue…" /></>;
  if (holds.error) return <><PageHeader title="Pending Jobs" /><div className="hint-banner">{holds.error.message}</div></>;

  const cols = (kind) => [
    { key: 'jobId', label: 'Job', render: (r) => <strong>{r.jobId}</strong> },
    { key: 'vehicleNo', label: 'Vehicle', render: (r) => r.vehicleNo || '—' },
    { key: 'hubName', label: 'Hub', render: (r) => r.hubName || r.hub || '—' },
    {
      key: kind === 'pending' ? 'holdCategory' : 'status', label: kind === 'pending' ? 'Category' : 'Status',
      render: (r) => <span className="badge warn">{r.holdCategory || r.status || '—'}</span>
    },
    { key: 'holdReason', label: 'Reason', render: (r) => r.holdReason || r.reason || '—' },
    { key: 'requested', label: 'Requested', render: (r) => r.requestedByName || r.requestedBy || formatWhen(r.requestedAt || r.updatedAt) },
    {
      key: 'actions', label: 'Actions',
      render: (r) => (
        <div className="row" style={{ gap: 6 }}>
          {kind === 'pending' && rank >= 2
            ? <Btn size="sm" onClick={() => setDecisionJob(r)}>Decide</Btn> : null}
          {kind !== 'pending' && rank >= 2 && r.status !== 'Completed'
            ? <Btn size="sm" variant="ghost" onClick={() => setDecisionJob(r)}>Review</Btn> : null}
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Pending Jobs"
        subtitle="Hold approvals follow the hierarchy: technician request → hub in-charge (L1) → region moderator (L2) → admin"
      />
      <Card pad={false}>
        <div style={{ padding: '12px 16px 0' }}>
          <Tabs tabs={tabs} active={active} onChange={setTab} />
        </div>
        <div style={{ padding: 16 }}>
          {active === 'pending' ? <Table columns={cols('pending')} rows={h.pending || []} empty="No open hold requests." rowKey={(r) => r.jobId} /> : null}
          {active === 'onHold' ? <Table columns={cols('onHold')} rows={h.onHold || []} empty="No jobs on hold." rowKey={(r) => r.jobId} /> : null}
          {active === 'history' ? <Table columns={cols('history')} rows={h.history || []} empty="No hold history yet." rowKey={(r, i) => `${r.jobId}-${i}`} /> : null}
          {active === 'log' ? <Table columns={cols('log')} rows={h.log || []} empty="No decisions logged." rowKey={(r, i) => `${r.jobId}-${i}`} /> : null}
        </div>
      </Card>

      <DecisionModal
        job={decisionJob}
        rank={rank}
        session={session}
        onClose={() => setDecisionJob(null)}
        onDone={() => { setDecisionJob(null); holds.reload(); }}
      />
    </>
  );
}

function DecisionModal({ job, rank, session, onClose, onDone }) {
  const toast = useToast();
  const [decision, setDecision] = useState('Approve');
  const [note, setNote] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  if (!job) return null;

  async function submit() {
    setBusy(true); setMsg('');
    try {
      const res = await call('jobHoldDecision', {
        jobId: job.jobId,
        decision,
        note,
        reassignToUserId: reassignTo,
        attachmentIds: [],
        expectedVersion: job.version || 1
      });
      if (res && res.escalated) toast.push(`Escalated to level ${res.level || rank - 1} authority.`, 'info');
      else toast.push(`Hold ${decision.toLowerCase()}d.`, 'ok');
      onDone();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={`Hold decision — ${job.jobId}`} onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit decision'}</Btn></>}>
      <div className="stack">
        <div className="row">
          <Badge tone="warn">{job.holdCategory || 'Hold'}</Badge>
          <span className="muted small">Requested by {job.requestedByName || job.requestedBy || 'technician'} · {session.hub || 'hub'}</span>
        </div>
        <div className="hint-info">As {session.role} you act at level {Math.max(1, ({ Supervisor: 1, Moderator: 2, Administrator: 3 }[session.role] || 1))}. Approval escalates regionally if the job cannot restart.</div>
        <Field label="Decision">
          <select value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option>Approve</option><option>Reject</option>
          </select>
        </Field>
        <Field label="Note"><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible in the job audit trail" /></Field>
        <Field label="Reassign to (optional)" hint="Leave empty to keep the current technician.">
          <input value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} />
        </Field>
        {msg ? <div className="login-msg">{msg}</div> : null}
      </div>
    </Modal>
  );
}
