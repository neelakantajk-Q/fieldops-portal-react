import { useState } from 'react';
import { call } from '../api.js';
import { Btn, Card, PageHeader, Spinner, Stat, Table, useAsync } from '../components.jsx';
import { minutesToText, todayISO } from '../lib/utils.js';

function shiftDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Uptime() {
  const [filters, setFilters] = useState({ from: shiftDate(-7), to: todayISO(), hub: '', userId: '', plateNo: '' });
  const [applied, setApplied] = useState(filters);

  const report = useAsync(
    () => call('getVehicleUptime', { ...applied, page: 1, pageSize: 300 }),
    [applied.from, applied.to, applied.hub, applied.userId, applied.plateNo]
  );

  const rep = (report.data && report.data.report) || {};
  const summary = rep.summary || {};
  const rows = rep.rows || rep.vehicles || [];

  return (
    <>
      <PageHeader title="Vehicle Uptime" subtitle="CAPA downtime analysis per vehicle, hub and engineer" />
      <Card title="Filters" className="mt" pad>
        <div className="form-grid">
          <label className="field"><span className="field-label">From</span>
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
          <label className="field"><span className="field-label">To</span>
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
          <label className="field"><span className="field-label">Hub</span>
            <input value={filters.hub} onChange={(e) => setFilters({ ...filters, hub: e.target.value })} placeholder="All hubs" /></label>
          <label className="field"><span className="field-label">Vehicle plate</span>
            <input value={filters.plateNo} onChange={(e) => setFilters({ ...filters, plateNo: e.target.value })} placeholder="All vehicles" /></label>
        </div>
        <div className="row mt">
          <Btn size="sm" onClick={() => setApplied(filters)}>Run report</Btn>
          <Btn size="sm" variant="ghost" onClick={report.reload}>Refresh</Btn>
        </div>
      </Card>

      {report.loading ? <Spinner label="Crunching uptime…" /> : null}
      {report.error ? <div className="hint-banner mt">{report.error.message}</div> : null}

      {report.data ? (
        <>
          <div className="grid cols-auto mt">
            <Stat label="Downtime %" value={`${summary.downtimePct ?? '—'}`} tone={(summary.downtimePct || 0) > 20 ? 'bad' : 'ok'} />
            <Stat label="Range minutes" value={rep.rangeMinutes || '—'} />
            <Stat label="Vehicles" value={summary.vehicleCount || rep.vehicleCount || rows.length} />
          </div>
          <Card pad={false} title="Vehicle breakdown" className="mt">
            <div style={{ padding: 16 }}>
              <Table
                columns={[
                  { key: 'plateNo', label: 'Plate', render: (r) => <strong>{r.plateNo}</strong> },
                  { key: 'hub', label: 'Hub', render: (r) => r.hubName || r.hub || '—' },
                  { key: 'downtimeMinutes', label: 'Downtime', render: (r) => minutesToText(r.downtimeMinutes) },
                  { key: 'uptimePct', label: 'Uptime %', render: (r) => <span className="badge ok">{r.uptimePct ?? '—'}</span> },
                  { key: 'jobs', label: 'Jobs', render: (r) => r.jobCount ?? r.jobs ?? '—' }
                ]}
                rows={rows}
                empty="No uptime data for this range."
                rowKey={(r) => r.plateNo}
              />
            </div>
          </Card>
        </>
      ) : null}
    </>
  );
}
