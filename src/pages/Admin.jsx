import { useMemo, useState } from 'react';
import { call } from '../api.js';
import { Badge, Btn, Card, Field, Modal, PageHeader, Spinner, Table, useAsync, useToast } from '../components.jsx';

const ROLE_OPTIONS = ['Technician', 'Supervisor', 'Moderator', 'Administrator'];
const SCOPES = { Technician: 'SELF', Supervisor: 'HUB', Moderator: 'REGION', Administrator: 'ALL' };

export default function Admin({ session }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | user | {new:true}
  const users = useAsync(() => call('getUsers', {}), []);
  const settings = useAsync(() => call('getAdminSettings', {}), []);
  const rows = ((users.data && (users.data.users || [])) || []);

  const byHub = useMemo(() => rows
    .filter((u) => u.role === 'Supervisor' && u.hub)
    .reduce((acc, u) => { acc[u.hub] = u.fullName || u.username; return acc; }, {}), [rows]);

  async function setPassword(u) {
    const pwd = window.prompt(`New password for ${u.username}:`);
    if (!pwd) return;
    try {
      await call('adminSetPassword', { userId: u.userId || u.username, newPassword: pwd });
      toast.push('Password updated.', 'ok');
    } catch (err) { toast.push(err.message, 'bad'); }
  }

  return (
    <>
      <PageHeader title="Administration"
        subtitle="Users, hierarchy assignment (region / hub / role) and operational settings"
        actions={<Btn size="sm" onClick={() => setEditing({ new: true })}>Add user</Btn>} />

      <Card title="In-charge map" subtitle="Derived: supervisor per hub, moderator per region">
        <div className="grid cols-2">
          <div>
            <span className="field-label">Hub in-charges</span>
            {Object.keys(byHub).length
              ? <div className="stack">{Object.entries(byHub).map(([hub, name]) =>
                  <div key={hub} className="row between"><Badge tone="ok">{hub}</Badge><span className="small">{name}</span></div>)}</div>
              : <span className="muted small">No supervisors assigned yet.</span>}
          </div>
          <div>
            <span className="field-label">Region in-charges</span>
            {rows.filter((u) => u.role === 'Moderator').length
              ? <div className="stack">{rows.filter((u) => u.role === 'Moderator').map((u) =>
                  <div key={u.userId || u.username} className="row between"><Badge tone="info">{u.region || 'region'}</Badge><span className="small">{u.fullName || u.username}</span></div>)}</div>
              : <span className="muted small">No moderators assigned yet.</span>}
          </div>
        </div>
      </Card>

      <Card pad={false} title={`Users (${rows.length})`}>
        {users.loading ? <Spinner label="Loading users…" /> : null}
        {users.error ? <div className="hint-banner" style={{ margin: 16 }}>{users.error.message}</div> : null}
        {users.data ? (
          <div style={{ padding: 16 }}>
            <Table
              columns={[
                { key: 'username', label: 'User', render: (r) => <strong>{r.fullName || r.username}</strong> },
                { key: 'userId', label: 'ID', render: (r) => <span className="mono small">{r.userId || '—'}</span> },
                { key: 'role', label: 'Role', render: (r) => <Badge tone={r.role === 'Administrator' ? 'primary' : r.role === 'Moderator' ? 'info' : 'neutral'}>{r.role}</Badge> },
                { key: 'hub', label: 'Hub', render: (r) => r.hub || '—' },
                { key: 'region', label: 'Region', render: (r) => r.region || '—' },
                { key: 'status', label: 'Status', render: (r) => <span className={`badge ${r.status === 'Active' ? 'ok' : 'neutral'}`}>{r.status || 'Active'}</span> },
                {
                  key: 'actions', label: 'Actions',
                  render: (r) => (
                    <div className="row" style={{ gap: 6 }}>
                      <Btn size="sm" variant="ghost" onClick={() => setEditing(r)}>Edit</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setPassword(r)}>Password</Btn>
                    </div>
                  )
                }
              ]}
              rows={rows}
              empty="No users in scope."
              rowKey={(r) => r.userId || r.username}
            />
          </div>
        ) : null}
      </Card>

      {settings.data ? (
        <Card title="Operational settings">
          <pre className="mono small" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(settings.data.settings || settings.data, null, 2)}</pre>
        </Card>
      ) : null}

      {editing ? <UserModal user={editing} session={session} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); users.reload(); }} /> : null}
    </>
  );
}

function UserModal({ user, session, onClose, onSaved }) {
  const toast = useToast();
  const isNew = Boolean(user.new);
  const [form, setForm] = useState({
    username: user.username || '',
    fullName: user.fullName || '',
    role: user.role || 'Technician',
    hub: user.hub || session.hub || '',
    region: user.region || '',
    phone: user.phone || '',
    password: isNew ? '' : undefined
  });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setBusy(true); setMsg('');
    try {
      if (isNew) {
        await call('adminCreateUser', {
          username: form.username,
          fullName: form.fullName,
          role: form.role,
          hub: form.hub,
          region: form.region,
          phone: form.phone,
          password: form.password,
          scope: SCOPES[form.role] || 'SELF'
        });
        toast.push('User created.', 'ok');
      } else {
        await call('adminUpdateUser', {
          userId: user.userId || user.username,
          fullName: form.fullName,
          role: form.role,
          hub: form.hub,
          region: form.region,
          phone: form.phone
        });
        toast.push('User updated.', 'ok');
      }
      onSaved();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open wide title={isNew ? 'Add user' : `Edit ${user.username}`} onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save user'}</Btn></>}>
      <div className="form-grid">
        <Field label="Username *"><input value={form.username} onChange={set('username')} readOnly={!isNew} /></Field>
        <Field label="Full name"><input value={form.fullName} onChange={set('fullName')} /></Field>
        <Field label="Role *" hint={`${form.role} scope = ${SCOPES[form.role]}`}>
          <select value={form.role} onChange={set('role')}>
            {(session.role === 'Administrator' ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r === 'Technician')).map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Hub" hint="Required for supervisors (they become the hub in-charge)"><input value={form.hub} onChange={set('hub')} /></Field>
        <Field label="Region" hint="Required for moderators (region in-charge)"><input value={form.region} onChange={set('region')} /></Field>
        <Field label="Phone"><input value={form.phone} onChange={set('phone')} /></Field>
        {isNew ? <Field label="Initial password *"><input type="password" value={form.password} onChange={set('password')} /></Field> : null}
      </div>
      {msg ? <div className="login-msg">{msg}</div> : null}
    </Modal>
  );
}
