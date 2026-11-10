import { useMemo } from 'react';
import { call } from '../api.js';
import { Badge, Card, Empty, PageHeader, Spinner, useAsync } from '../components.jsx';

const ROLE_TONE = { Administrator: 'primary', Moderator: 'info', Supervisor: 'warn', Technician: 'neutral', Platform: 'bad' };

function initialsOf(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  return ((parts[0] || '?').charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
}

function placeText(person) {
  const loc = person.lastLocation || {};
  const lat = Number(loc.lat), lng = Number(loc.lng);
  const has = isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0);
  return loc.address || (has ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'No location reported');
}

function PersonCard({ person, depth }) {
  const name = person.fullName || person.username || person.userId;
  const isInCharge = person.role === 'Supervisor' || person.role === 'Moderator' || person.role === 'Administrator';
  return (
    <div className="card" style={{ marginLeft: Math.min(depth, 3) * 22, marginBottom: 10, padding: '12px 14px' }}>
      <div className="row between">
        <div className="row" style={{ gap: 10 }}>
          {person.profilePhotoUrl
            ? <img className="avatar" style={{ width: 34, height: 34, borderRadius: 10 }} src={person.profilePhotoUrl} alt="" />
            : <div className="brand-mark" style={{ width: 34, height: 34, fontSize: 12, borderRadius: 10 }}>{initialsOf(name)}</div>}
          <div>
            <div className="row" style={{ gap: 8 }}>
              <strong>{name}</strong>
              <Badge tone={ROLE_TONE[person.role] || 'neutral'}>{person.role || 'Member'}</Badge>
              {isInCharge ? <Badge tone="ok">Hub in-charge</Badge> : null}
              {person.role === 'Moderator' ? <Badge tone="info">Region</Badge> : null}
            </div>
            <div className="muted small">
              {[person.userId, person.hub, person.region, person.phone && !String(person.phone).includes('*') ? person.phone : '']
                .filter(Boolean).join(' · ') || '—'} · {placeText(person)}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {person.phone && !String(person.phone).includes('*')
            ? <a className="btn ghost sm" href={`tel:${person.phone}`}>Call</a> : null}
          {(person.lastLocation && String(placeText(person)).indexOf('No location') < 0)
            ? <a className="btn ghost sm" target="_blank" rel="noreferrer"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeText(person))}`}>Locate</a> : null}
        </div>
      </div>
      {(person.children || []).length
        ? <div style={{ marginTop: 10 }}>{(person.children || []).map((c) => <PersonCard key={c.userId || c.username} person={c} depth={depth + 1} />)}</div>
        : null}
    </div>
  );
}

export default function Team({ session }) {
  const tree = useAsync(() => call('getOrgTree', {}), []);
  const nodes = (tree.data && tree.data.tree) || [];

  const chain = useMemo(() => {
    const flat = [];
    const walk = (ns, parents) => (ns || []).forEach((n) => {
      flat.push({ person: n, chain: parents });
      walk(n.children, [...parents, n]);
    });
    walk(nodes, []);
    const me = flat.find((f) => f.person.userId === session.userId || f.person.username === session.username);
    if (!me) return null;
    const roles = { Supervisor: 'Hub in-charge', Moderator: 'Region in-charge', Administrator: 'Admin', Platform: 'Platform' };
    return me.chain.slice().reverse().map((p) => ({ label: roles[p.role] || p.role, name: p.fullName || p.username, role: p.role }));
  }, [nodes, session]);

  return (
    <>
      <PageHeader title="Team"
        subtitle="Hierarchy: Administrator → region in-charge (moderator) → hub in-charge (supervisor) → technicians" />
      {chain ? (
        <div className="hint-info" style={{ marginBottom: 16 }}>
          <strong>Your chain:</strong>{' '}
          {chain.length
            ? chain.map((c, i) => <span key={i}>{i > 0 ? ' → ' : ''}<strong>{c.name}</strong> ({c.label})</span>)
            : 'You are at the top of your visible scope.'}
        </div>
      ) : null}
      <Card pad={false} title="Organization">
        <div style={{ padding: 16 }}>
          {tree.loading ? <Spinner label="Loading org…" /> : null}
          {tree.error ? <div className="hint-banner">{tree.error.message}</div> : null}
          {tree.data && !nodes.length ? <Empty>No people in your scope.</Empty> : null}
          {nodes.map((n) => <PersonCard key={n.userId || n.username} person={n} depth={0} />)}
        </div>
      </Card>
    </>
  );
}
