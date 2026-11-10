import { call } from '../api.js';
import { Badge, Card, Empty, PageHeader, Spinner, useAsync } from '../components.jsx';

const TONE = { 'Active': 'ok', 'Pending Approval': 'warn', 'Escalated': 'bad' };

export default function Workflows() {
  const wf = useAsync(() => call('getWorkflows', {}), []);
  const rows = (wf.data && (wf.workflows || wf.rows || [])) || [];

  return (
    <>
      <PageHeader title="Workflows" subtitle="Configurable approval chains: hold requests, transit, onboarding" />
      <Card pad={false}>
        <div style={{ padding: 16 }}>
          {wf.loading ? <Spinner label="Loading workflows…" /> : null}
          {wf.error ? <div className="hint-banner">{wf.error.message}</div> : null}
          {wf.data && !rows.length ? <Empty>No workflows configured for your scope.</Empty> : null}
          {rows.map((w, i) => (
            <div key={w.workflowId || w.id || i} className="card" style={{ marginBottom: 10, padding: '12px 16px' }}>
              <div className="row between">
                <div>
                  <div className="row" style={{ gap: 8 }}>
                    <strong>{w.name || w.workflowId || 'Workflow'}</strong>
                    <Badge tone={TONE[w.status] || 'neutral'}>{w.status || '—'}</Badge>
                  </div>
                  <div className="muted small">{w.description || '—'}</div>
                  <div className="muted small">
                    Approval chain: {w.approvalChain || w.chain || 'L1 hub in-charge → L2 region → L3 admin'}
                  </div>
                </div>
                {w.steps ? <span className="badge neutral">{(w.steps || []).length} steps</span> : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
