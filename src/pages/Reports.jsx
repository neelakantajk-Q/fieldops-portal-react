import { useState } from 'react';
import { call } from '../api.js';
import { Btn, Card, PageHeader, Spinner, Stat, Table, Tabs, formatWhen, useAsync } from '../components.jsx';
import { todayISO } from '../lib/utils.js';

export default function Reports({ session }) {
  const [tab, setTab] = useState('mis');

  return (
    <>
      <PageHeader title="Reports & MIS" subtitle="Operational MIS, audit trail and exports for your scope" />
      <Tabs
        tabs={[
          { id: 'mis', label: 'MIS' },
          { id: 'audit', label: 'Audit trail' },
          { id: 'uptime', label: 'Uptime digest' }
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'mis' ? <MisCard /> : null}
      {tab === 'audit' ? <AuditCard /> : null}
      {tab === 'uptime' ? <UptimeDigestCard /> : null}
    </>
  );
}

function MisCard() {
  const [date, setDate] = useState(todayISO());
  const mis = useAsync(() => call('getMisReport', { date }), [date]);
  const m = mis.data || {};
  const rows = m.rows || m.summary || [];
  const totals = m.totals || (Array.isArray(rows) ? null : rows);

  return (
    <Card title="Daily MIS" subtitle={`Report for ${date}`}
      actions={
        <div className="row">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 150 }} />
          <Btn size="sm" variant="ghost" onClick={mis.reload}>Refresh</Btn>
          {m.exportUrl ? <a className="btn ghost sm" href={m.exportUrl} target="_blank" rel="noreferrer">Export</a> : null}
        </div>
      }>
      {mis.loading ? <Spinner label="Building MIS…" /> : null}
      {mis.error ? <div className="hint-banner">{mis.error.message}</div> : null}
      {mis.data && !mis.loading ? (
        <>
          {totals ? (
            <div className="grid cols-auto" style={{ marginBottom: 16 }}>
              <Stat label="Jobs" value={totals.jobs ?? '—'} />
              <Stat label="Completed" value={totals.completed ?? '—'} tone="ok" />
              <Stat label="Holds" value={totals.holds ?? '—'} tone="warn" />
              <Stat label="Downtime min" value={totals.downtimeMinutes ?? '—'} />
            </div>
          ) : null}
          <Table
            columns={[
              { key: 'hubName', label: 'Hub', render: (r) => r.hubName || r.hub || '—' },
              { key: 'jobs', label: 'Jobs', render: (r) => r.jobs ?? r.total ?? '—' },
              { key: 'completed', label: 'Completed', render: (r) => r.completed ?? '—' },
              { key: 'hold', label: 'Hold', render: (r) => r.holds ?? r.hold ?? '—' },
              { key: 'tat', label: 'Avg TAT', render: (r) => r.avgTatMinutes ?? r.avgTat ?? '—' }
            ]}
            rows={Array.isArray(rows) ? rows : []}
            empty="No MIS rows for this date."
            rowKey={(r, i) => `${r.hubName || r.hub || 'row'}-${i}`}
          />
        </>
      ) : null}
    </Card>
  );
}

function AuditCard() {
  const audit = useAsync(() => call('getAuditLogs', { page: 1, pageSize: 100 }), []);
  const rows = (audit.data && (audit.data.logs || audit.data.audit || [])) || [];
  return (
    <Card title="Audit trail" subtitle="Newest first" actions={<Btn size="sm" variant="ghost" onClick={audit.reload}>Refresh</Btn>}>
      {audit.loading ? <Spinner label="Loading audit…" /> : null}
      {audit.error ? <div className="hint-banner">{audit.error.message}</div> : null}
      {audit.data ? (
        <Table
          columns={[
            { key: 'at', label: 'When', render: (r) => formatWhen(r.at || r.timestamp || r.createdAt) },
            { key: 'actor', label: 'Actor', render: (r) => r.actor || r.userId || '—' },
            { key: 'action', label: 'Action', render: (r) => <span className="mono small">{r.action || r.type || '—'}</span> },
            { key: 'detail', label: 'Detail', render: (r) => r.detail || r.message || '—' },
            { key: 'entity', label: 'Entity', render: (r) => r.entityId || r.jobId || '—' }
          ]}
          rows={rows}
          empty="No audit entries."
          rowKey={(r, i) => i}
        />
      ) : null}
    </Card>
  );
}

function UptimeDigestCard() {
  const dig = useAsync(() => call('getVehicleUptime', { from: todayISO(), to: todayISO(), page: 1, pageSize: 50 }), []);
  const rep = (dig.data && dig.data.report) || {};
  return (
    <Card title="Uptime digest" subtitle="Today at a glance" actions={<Btn size="sm" variant="ghost" onClick={dig.reload}>Refresh</Btn>}>
      {dig.loading ? <Spinner label="Loading uptime…" /> : null}
      {dig.error ? <div className="hint-banner">{dig.error.message}</div> : null}
      {dig.data ? <pre className="mono small" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(rep, null, 2)}</pre> : null}
    </Card>
  );
}
