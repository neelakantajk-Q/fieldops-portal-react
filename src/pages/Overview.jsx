import { call } from '../api.js';
import { Card, Empty, PageHeader, Spinner, Stat, formatWhen } from '../components.jsx';
import { useAsync } from '../components.jsx';

function KeyList({ obj, suffix = '' }) {
  const entries = Object.entries(obj || {});
  if (!entries.length) return <Empty>No data.</Empty>;
  const max = Math.max(...entries.map(([, v]) => Number(v) || 0), 1);
  return (
    <div className="bars">
      {entries.map(([k, v]) => (
        <div className="bar-row" key={k}>
          <span title={k} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${((Number(v) || 0) / max) * 100}%` }} /></div>
          <span className="mono" style={{ textAlign: 'right' }}>{v}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

export default function Overview({ session }) {
  const { data, loading, error, reload } = useAsync(() => call('getAnalytics', {}), []);
  const a = (data && data.analytics) || {};

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={`${session.fullName || session.username} · ${session.role} · ${session.hub || 'All hubs'}`}
        actions={<button className="btn ghost sm" onClick={reload}>Refresh</button>}
      />
      {error ? <div className="hint-banner" style={{ marginBottom: 16 }}>{error.message}</div> : null}
      {loading ? <Spinner label="Loading analytics…" /> : (
        <>
          <div className="grid cols-auto" style={{ marginBottom: 18 }}>
            <Stat label="Total jobs" value={a.totalTasks || 0} />
            <Stat label="Completed" value={a.completedTasks || 0} tone="ok" />
            <Stat label="Open" value={a.openTasks || 0} tone="warn" />
            <Stat label="Pending holds" value={a.pendingHolds || 0} tone={a.pendingHolds ? 'bad' : ''} />
            <Stat label="Mock GPS flags" value={a.mockLocationFlags || 0} />
          </div>

          <div className="grid cols-3">
            <Card title="Hold reasons" subtitle="Awaiting supervisor decisions">
              <KeyList obj={a.holdReasons} />
            </Card>
            <Card title="Hub workload" subtitle="Open jobs per hub">
              <KeyList obj={a.hubWorkload} suffix=" jobs" />
            </Card>
            <Card title="Engineer productivity" subtitle="Completed jobs">
              <KeyList obj={a.engineerProductivity} suffix=" done" />
            </Card>
          </div>

          <Card title="Session" subtitle="Current access context">
            <div className="grid cols-4">
              <div><span className="muted small">Role</span><div><strong>{session.role}</strong></div></div>
              <div><span className="muted small">Scope</span><div><strong>{session.scope || 'SELF'}</strong></div></div>
              <div><span className="muted small">Hub</span><div><strong>{session.hub || '—'}</strong></div></div>
              <div><span className="muted small">Session expires</span><div><strong>{formatWhen(session.expiresAt)}</strong></div></div>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
