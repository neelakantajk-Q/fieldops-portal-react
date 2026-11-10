import { useState } from 'react';
import { call } from '../api.js';
import { Badge, Btn, Card, Empty, PageHeader, Spinner, Tabs, formatWhen, useAsync, useToast } from '../components.jsx';

export default function Notifications({ count }) {
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const feed = useAsync(() => call('getNotifications', { unreadOnly: tab === 'unread', limit: 100 }), [tab]);

  const items = (feed.data && feed.data.notifications) || [];

  async function markRead(n) {
    try {
      await call('markNotificationRead', { notificationId: n.notificationId || n.id });
      feed.reload();
    } catch (err) { toast.push(err.message, 'bad'); }
  }

  async function act(n, action) {
    try {
      await call('notificationAction', { notificationId: n.notificationId || n.id, action });
      toast.push('Action sent.', 'ok');
      feed.reload();
    } catch (err) { toast.push(err.message, 'bad'); }
  }

  const cards = items.map((n, i) => (
    <div key={n.notificationId || n.id || i} className="card" style={{ marginBottom: 10, padding: '12px 16px' }}>
      <div className="row between">
        <div>
          <div className="row" style={{ gap: 8 }}>
            <strong>{n.title || n.type || 'Notification'}</strong>
            {!n.read ? <Badge tone="primary">New</Badge> : null}
            {n.severity === 'high' || n.priority === 'high' ? <Badge tone="bad">High</Badge> : null}
          </div>
          <div className="small" style={{ marginTop: 2 }}>{n.message || n.body || '—'}</div>
          <div className="muted small">{n.hubName || n.hub || ''} {n.hubName ? '·' : ''} {formatWhen(n.at || n.createdAt)}</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {n.actions ? (n.actions || []).map((a) =>
            <Btn key={a.action || a} size="sm" variant="ghost" onClick={() => act(n, a.action || a)}>{a.label || a}</Btn>) : null}
          {!n.read ? <Btn size="sm" variant="ghost" onClick={() => markRead(n)}>Mark read</Btn> : null}
        </div>
      </div>
    </div>
  ));

  return (
    <>
      <PageHeader title="Notifications" subtitle={count ? `${count} unread in your scope` : 'Broadcasts, hold alerts and transit requests'} />
      <Tabs
        tabs={[{ id: 'all', label: 'All' }, { id: 'unread', label: `Unread${count ? ` (${count})` : ''}` }]}
        active={tab} onChange={setTab} />
      <Card pad={false}>
        <div style={{ padding: 16 }}>
          {feed.loading ? <Spinner /> : null}
          {feed.error ? <div className="hint-banner">{feed.error.message}</div> : null}
          {feed.data && !items.length ? <Empty>No notifications.</Empty> : null}
          {cards}
        </div>
      </Card>
    </>
  );
}
